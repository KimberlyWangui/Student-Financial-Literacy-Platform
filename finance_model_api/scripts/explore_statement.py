"""
explore_statement.py  (development only)

Usage (from finance_model_api/):
    python -m scripts.explore_statement private/statement.pdf

Prints SAFE summaries only. Nothing is written to disk and the password is never stored.
"""
import sys
import getpass

import pikepdf

from statement.parser import load, to_dataframe, template
from statement.classify import add_types, INTERNAL, FULIZA_TYPES, UNVERIFIED_TYPES
from statement.metrics import compute_metrics
from statement.stages import assign_stage, data_quality


def main():
    if len(sys.argv) != 2:
        sys.exit("Usage: python -m scripts.explore_statement <path-to-statement.pdf>")
    password = getpass.getpass("Statement password: ")

    try:
        rows = load(sys.argv[1], password)
    except pikepdf.PasswordError:
        sys.exit("Wrong password.")
    if not rows:
        sys.exit("No transaction rows found. The table layout may differ from what the parser expects.")

    try:
        df = to_dataframe(rows)
    except ValueError as e:
        sys.exit(str(e))
    df = add_types(df)

    # 1. overview and integrity
    print(f"Rows: {len(df)}")
    print(f"Period covered: {df['time'].min()}  ->  {df['time'].max()}")
    print(f"Unparseable dates: {int(df['time'].isna().sum())}")
    expected = df["balance"].shift(1) + df["paid_in"] + df["withdrawn"]
    breaks = (expected - df["balance"]).abs() > 0.01
    fz = df["funding"].eq("fuliza") | df["type"].isin(FULIZA_TYPES)
    fz_zone = fz.astype(float).rolling(5, center=True, min_periods=1).max().astype(bool)
    print(f"Balance breaks: {int(breaks.sum())} "
          f"(near Fuliza rows: {int((breaks & fz_zone).sum())}, unexplained: {int((breaks & ~fz_zone).sum())})")

    # 2. statuses and templates
    print("\nStatus counts:")
    print(df["status"].value_counts().to_string())
    print("\nTransaction templates:")
    print(df["details"].map(template).value_counts().to_string())

    # 3. types
    unknown = df[df["type"] == "UNKNOWN"]
    print(f"\nUNKNOWN rows: {len(unknown)}")
    if len(unknown):
        print(unknown["details"].map(template).value_counts().to_string())
    print("\nCount and amount by type and direction:")
    print(df.groupby(["type", "direction"])["amount"].agg(["count", "sum"]).round(2).to_string())
    print(f"Rows matched by UNVERIFIED rules: {int(df['type'].isin(UNVERIFIED_TYPES).sum())}")
    print("Funding:", df["funding"].value_counts().to_dict())

    # 4. largest external outflows (no names or details)
    ext_out = df[(df["direction"] == "out") & (~df["type"].isin(INTERNAL))]
    print("\nLargest outflows:")
    print(ext_out.nlargest(10, "amount")[["time", "type", "amount"]].to_string())

    # 5. metrics
    metrics, monthly = compute_metrics(df)
    print("\nMonthly external flows (excludes savings moves and reversals):")
    print(monthly.round(0).to_string())
    print("\nMetrics:")
    for k, v in metrics.items():
        print(f"  {k}: {v}")
    dq = data_quality(df)
    print("\nData quality:", dq)
    stage = assign_stage(metrics, dq)
    print(f"\nStage: {stage['stage']} (confidence: {stage['confidence']}, borrowing: {stage['borrowing']})")
    for r in stage["reasons"]:
        print("  -", r)
    for n in stage["notes"]:
        print("  note:", n)
    print("  next step id:", stage["next_step"])


if __name__ == "__main__":
    main()