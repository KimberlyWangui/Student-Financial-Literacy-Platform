import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.linear_model import Ridge
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from .classify import INTERNAL

FEATURES = ["out_lag1", "out_med4", "out_med8", "out_mean8",
            "in_lag1", "in_sum4", "balance_end", "wom_next"]
BASELINES = ["last_week", "median4", "median8", "train_median"]
MODELS = ["ridge", "gbm"]
WEEK = pd.Timedelta(days=7)


def weekly_table(df, train_end, lump_multiple=3.0):
    """One row per complete week (weeks end on Sunday).

    Single payments of at least lump_multiple x the typical weekly outflow are split out as 'lumps'.
    The threshold uses weeks up to train_end only, so the test period never influences it.
    """
    ext = df[~df["type"].isin(INTERNAL)]
    out_rows = ext[ext["direction"] == "out"]

    balance = df.set_index("time")["balance"].resample("W").last().ffill()
    all_out = out_rows.set_index("time")["amount"].resample("W").sum()
    threshold = lump_multiple * float(all_out[all_out.index <= train_end].median())

    is_lump = out_rows["amount"] >= threshold
    core = out_rows[~is_lump].set_index("time")["amount"].resample("W").sum()
    lump = out_rows[is_lump].set_index("time")["amount"].resample("W").sum()
    inflow = ext[ext["direction"] == "in"].set_index("time")["amount"].resample("W").sum()

    weekly = (pd.DataFrame({"out_core": core, "out_lump": lump, "inflow": inflow})
                .reindex(balance.index).fillna(0.0))
    weekly["balance_end"] = balance
    weekly = weekly.iloc[1:-1]                      # drop the partial first and last weeks
    return weekly, threshold


def make_features(weekly):
    """Row t holds what is known at the end of week t; 'target' is week t+1's core outflow."""
    o = weekly["out_core"]
    f = pd.DataFrame(index=weekly.index)
    f["out_lag1"] = o
    f["out_med4"] = o.rolling(4).median()
    f["out_med8"] = o.rolling(8).median()
    f["out_mean8"] = o.rolling(8).mean()
    f["in_lag1"] = weekly["inflow"]
    f["in_sum4"] = weekly["inflow"].rolling(4).sum()
    f["balance_end"] = weekly["balance_end"]
    f["wom_next"] = ((weekly.index + WEEK).day - 1) // 7 + 1     # week of month of the week being predicted
    f["target"] = o.shift(-1)
    return f


def walk_forward(feats, test_start, min_train=20):
    """Expanding-window backtest: refit every week, predict the next one."""
    labelled = feats.dropna(subset=FEATURES + ["target"])
    rows = []
    for t in labelled.index:
        target_week = t + WEEK
        if target_week < test_start:
            continue
        train = labelled[labelled.index <= t - WEEK]       # only targets already observed at time t
        if len(train) < min_train:
            continue
        x = labelled.loc[[t], FEATURES]
        ridge = make_pipeline(StandardScaler(), Ridge(alpha=10.0)).fit(train[FEATURES], train["target"])
        gbm = GradientBoostingRegressor(loss="absolute_error", n_estimators=150, max_depth=2,
                                        learning_rate=0.05, subsample=0.8, random_state=0
                                        ).fit(train[FEATURES], train["target"])
        rows.append({
            "week": target_week,
            "actual": float(labelled.loc[t, "target"]),
            "last_week": float(labelled.loc[t, "out_lag1"]),
            "median4": float(labelled.loc[t, "out_med4"]),
            "median8": float(labelled.loc[t, "out_med8"]),
            "train_median": float(train["target"].median()),
            "ridge": float(ridge.predict(x)[0]),
            "gbm": float(gbm.predict(x)[0]),
        })
    return pd.DataFrame(rows).set_index("week")


def paired_bootstrap(err_a, err_b, n=2000, seed=0):
    """Mean of (err_a - err_b) with a 95% interval. Negative means a is better. Treats weeks as independent,
    which is optimistic for time series, so read the interval as a rough guide."""
    rng = np.random.default_rng(seed)
    d = np.asarray(err_a, dtype=float) - np.asarray(err_b, dtype=float)
    means = [rng.choice(d, size=len(d), replace=True).mean() for _ in range(n)]
    return float(d.mean()), float(np.percentile(means, 2.5)), float(np.percentile(means, 97.5))


def score(preds):
    errs = {m: (preds[m] - preds["actual"]).abs() for m in BASELINES + MODELS}
    mae = pd.Series({m: float(e.mean()) for m, e in errs.items()}, name="MAE")
    best = mae[BASELINES].idxmin()
    comparisons = {m: paired_bootstrap(errs[m], errs[best]) for m in MODELS}
    return mae, best, comparisons

def band_backtest(feats, test_start, lo=0.10, hi=0.90, window=None, min_train=20):
    """Does the usual range of past weeks (a quantile band) contain next week's actual value?
    window=None uses every week observed so far; window=26 uses only the last 26."""
    labelled = feats.dropna(subset=FEATURES + ["target"])
    rows = []
    for t in labelled.index:
        target_week = t + WEEK
        if target_week < test_start:
            continue
        past = labelled.loc[labelled.index <= t - WEEK, "target"]   # only weeks already observed at time t
        if window:
            past = past.iloc[-window:]
        if len(past) < min_train:
            continue
        q_lo, q_mid, q_hi = (float(v) for v in past.quantile([lo, 0.5, hi]))
        actual = float(labelled.loc[t, "target"])
        rows.append({"week": target_week, "actual": actual, "q_lo": q_lo, "q_mid": q_mid,
                     "q_hi": q_hi, "inside": bool(q_lo <= actual <= q_hi)})
    return pd.DataFrame(rows).set_index("week")


def band_summary(bands):
    return {"weeks": int(len(bands)),
            "actual_coverage": float(bands["inside"].mean()),
            "median_width": float((bands["q_hi"] - bands["q_lo"]).median())}