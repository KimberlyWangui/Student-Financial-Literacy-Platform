import numpy as np
import pandas as pd

from statement.forecast import weekly_table, make_features, band_backtest, band_summary, FEATURES, WEEK


def synthetic(seed=0, end="2026-03-01"):
    """Made-up transactions, no real data."""
    rng = np.random.default_rng(seed)
    rows, t, bal = [], pd.Timestamp("2025-01-02 09:00"), 5000.0
    while t < pd.Timestamp(end):
        amt = float(np.round(rng.lognormal(5, 0.8)))
        bal -= amt
        rows.append((t, "send_money", "out", amt, bal))
        if rng.random() < 0.2:
            inc = float(np.round(rng.lognormal(7, 0.5)))
            bal += inc
            rows.append((t + pd.Timedelta(minutes=5), "received_money", "in", inc, bal))
        t += pd.Timedelta(hours=int(rng.integers(8, 30)))
    return pd.DataFrame(rows, columns=["time", "type", "direction", "amount", "balance"])


TRAIN_END = pd.Timestamp("2025-12-31")


def test_large_payment_is_split_out_as_a_lump():
    df = synthetic()
    df.loc[df.index[200], "amount"] = 90000.0
    weekly, threshold = weekly_table(df, TRAIN_END)
    assert weekly["out_lump"].sum() >= 90000.0
    assert weekly["out_core"].max() < threshold


def test_features_do_not_use_the_future():
    weekly, _ = weekly_table(synthetic(), TRAIN_END)
    original = make_features(weekly)
    changed = weekly.copy()
    changed.iloc[-5:, changed.columns.get_loc("out_core")] *= 10
    altered = make_features(changed)
    cut = weekly.index[-6]
    assert original.loc[:cut, FEATURES].equals(altered.loc[:cut, FEATURES])


def test_band_uses_only_the_past():
    weekly, _ = weekly_table(synthetic(end="2026-10-01"), TRAIN_END)
    feats = make_features(weekly)
    start = pd.Timestamp("2026-01-01")
    base = band_backtest(feats, start)
    labelled = feats.dropna(subset=FEATURES + ["target"])
    m = labelled.index[-25]                                  # an origin inside the test period
    changed = feats.copy()
    changed.loc[m, "target"] *= 10
    altered = band_backtest(changed, start)
    cols = ["q_lo", "q_mid", "q_hi"]
    before = base.index[base.index < m + 2 * WEEK]           # origins that cannot have seen row m yet
    after = base.index[base.index >= m + 2 * WEEK]
    assert len(before) > 0 and len(after) > 0
    assert base.loc[before, cols].equals(altered.loc[before, cols])
    assert not base.loc[after, cols].equals(altered.loc[after, cols])


def test_band_summary_is_a_share():
    weekly, _ = weekly_table(synthetic(end="2026-10-01"), TRAIN_END)
    s = band_summary(band_backtest(make_features(weekly), pd.Timestamp("2026-01-01")))
    assert 0.0 <= s["actual_coverage"] <= 1.0 and s["median_width"] > 0