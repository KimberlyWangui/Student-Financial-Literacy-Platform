"""
merge_statements.py  (development only)

Usage (from finance_model_api/, with STATEMENT_HASH_KEY set):
    python -m scripts.merge_statements private/a.pdf private/b.pdf private/c.pdf

Each statement has its own password. Prints SAFE summaries only.
"""
import sys
import getpass
from pathlib import Path

import pikepdf

from statement.parser import load, to_dataframe, add_row_ids, template
from statement.merge import merge_statements, chain_breaks
from statement.classify import add_types
from statement.metrics import compute_metrics
from statement.stages import assign_stage, data_quality


def main():
    paths = sys.argv[1:]
    if len(paths) < 2:
        sys.exit("Usage: python -m scripts.merge_statements <statement1.pdf> <statement2.pdf> ...")

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

    merged, rep = merge_statements(frames)

    print("\nStatements:", rep["statements"])
    for c in rep["coverage"]:
        print(f"  #{c['source']}: {c['start']} -> {c['end']}  ({c['rows']} rows)")
    print(f"Rows in: {rep['rows_in']} | duplicates removed: {rep['duplicates_removed']} | merged: {rep['rows_merged']}")
    print("Key duplicates within one statement (must be 0):", rep["key_duplicates_within_statement"])
    print("Rows sharing a receipt, per statement:", rep["rows_sharing_receipt"])
    print("Overlaps:")
    for o in rep["overlaps"]:
        print("  ", o)
    print("Gaps:")
    for g in rep["gaps"]:
        print("  ", g)
    breaks = chain_breaks(merged)
    print(f"Balance breaks after merge: {len(breaks)}", breaks[:10])

    df = add_types(merged)
    unknown = df[df["type"] == "UNKNOWN"]
    print("UNKNOWN rows:", len(unknown))
    if len(unknown):
       print(unknown["details"].map(template).value_counts().to_string())
       print(unknown[["time", "direction", "amount"]].to_string())
    metrics, monthly = compute_metrics(df)
    print("\nMonthly external flows:\n", monthly.round(0).to_string())
    print("\nMetrics:")
    for k, v in metrics.items():
        print(f"  {k}: {v}")

    dq = data_quality(df)
    print("Data quality:", dq)
    stage = assign_stage(metrics, dq)
    print(f"\nStage: {stage['stage']} (confidence: {stage['confidence']}, borrowing: {stage['borrowing']})")
    for r in stage["reasons"]:
        print("  -", r)
    for n in stage["notes"]:
        print("  note:", n)


if __name__ == "__main__":
    main()