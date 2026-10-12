"""
backtest_forecast.py  (development only)

Forecasts next week's core outflow (single large payments split out) using the weeks before it,
trained on 2025 and tested week by week on 2026, against simple baselines.

Usage (from finance_model_api/, with STATEMENT_HASH_KEY set):
    python -m scripts.backtest_forecast private/a.pdf private/b.pdf private/c.pdf

Prints SAFE summaries only.
"""
import sys
import getpass
from pathlib import Path

import pandas as pd
import pikepdf

from statement.parser import load, to_dataframe, add_row_ids
from statement.merge import merge_statements
from statement.classify import add_types, INTERNAL
from statement.forecast import weekly_table, make_features, walk_forward, score, band_backtest, band_summary

TRAIN_END = pd.Timestamp("2025-12-31")
TEST_START = pd.Timestamp("2026-01-01")


def main():
    paths = sys.argv[1:]
    if not paths:
        sys.exit("Usage: python -m scripts.backtest_forecast <statement1.pdf> [<statement2.pdf> ...]")

    frames = []
    for p in paths:
        name = Path(p).name
        password = getpass.getpass(f"Password for {name}: ")
        try:
            frames.append(add_row_ids(to_dataframe(load(p, password))))
        except pikepdf.PasswordError:
            sys.exit(f"Wrong password for {name}.")
        except (ValueError, RuntimeError) as e:
            sys.exit(f"{name}: {e}")

    merged, _ = merge_statements(frames)
    df = add_types(merged)

    weekly, threshold = weekly_table(df, TRAIN_END)
    n_train = int((weekly.index <= TRAIN_END).sum())
    print(f"\nWeeks: {len(weekly)} complete weeks ({n_train} up to {TRAIN_END.date()}, {len(weekly) - n_train} after)")
    print(f"Lump threshold (3x typical training week): KES {threshold:,.0f}")

    ext_out = df[(df["direction"] == "out") & (~df["type"].isin(INTERNAL))]
    lumps = ext_out[ext_out["amount"] >= threshold]
    for label, part in (("training", lumps[lumps["time"] <= TRAIN_END + pd.Timedelta(days=1)]),
                        ("test", lumps[lumps["time"] > TRAIN_END + pd.Timedelta(days=1)])):
        print(f"Lump payments in {label} period: {len(part)} totalling KES {part['amount'].sum():,.0f} (excluded from the forecast target)")

    feats = make_features(weekly)
    preds = walk_forward(feats, TEST_START)
    if preds.empty:
        sys.exit("Not enough weeks for a backtest.")
    mae, best, comparisons = score(preds)

    print(f"\nTest weeks: {len(preds)} ({preds.index.min().date()} -> {preds.index.max().date()})")
    print(f"Median actual weekly core outflow in the test period: KES {preds['actual'].median():,.0f}")
    print("\nMean absolute error per week (KES):")
    print(mae.round(0).to_string())
    print(f"\nBest baseline: {best}")
    for model, (d, lo, hi) in comparisons.items():
        verdict = "better" if hi < 0 else "worse" if lo > 0 else "no clear difference"
        print(f"  {model} vs {best}: error difference {d:+.0f} (95% interval {lo:+.0f} to {hi:+.0f}) -> {verdict}")
    for lo, hi in ((0.10, 0.90), (0.05, 0.95)):
        print(f"\nUsual range: {lo:.0%} to {hi:.0%} of past weeks (target about {hi - lo:.0%} inside)")
        for label, window in (("all weeks so far", None), ("last 26 weeks", 26)):
            s = band_summary(band_backtest(feats, TEST_START, lo=lo, hi=hi, window=window))
            print(f"  {label}: {s['actual_coverage']:.0%} of {s['weeks']} test weeks inside, "
                  f"median band width KES {s['median_width']:,.0f}")


if __name__ == "__main__":
    main()