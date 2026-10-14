"""
run_personas.py  (development only)

Generates every synthetic persona, runs it through the real engine and compares the stage with what we expect.
Everything is made up, so nothing here is private.

Usage (from finance_model_api/):
    python -m scripts.run_personas                 # in-memory only
    python -m scripts.run_personas --pdf out_dir   # also writes password-protected PDFs and re-parses them
"""
import argparse
from pathlib import Path

from statement.classify import add_types
from statement.metrics import compute_metrics
from statement.stages import assign_stage, data_quality
from statement.parser import load, to_dataframe
from synthetic.personas import PERSONAS
from synthetic.render_pdf import render_pdf

PASSWORD = "test1234"


def chain_breaks(df):
    expected = df["balance"].shift(1) + df["paid_in"] + df["withdrawn"]
    return int(((expected - df["balance"]).abs() > 0.01).iloc[1:].sum())


def analyse(df):
    typed = add_types(df)
    metrics, _ = compute_metrics(typed)
    stage = assign_stage(metrics, data_quality(typed))
    return typed, metrics, stage


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", help="folder to write PDFs into; they are then parsed back and re-checked")
    args = ap.parse_args()

    print(f"{'persona':<19}{'rows':>5}{'days':>5}{'expected':>18}{'actual':>18}  conf    runway  near0  lowdays  cash   retention")
    all_ok = True
    for p in PERSONAS:
        df = p.build()
        if args.pdf:
            out = Path(args.pdf)
            out.mkdir(parents=True, exist_ok=True)
            pdf_path = out / f"{p.name}.pdf"
            render_pdf(df, pdf_path, PASSWORD)
            df = to_dataframe(load(str(pdf_path), PASSWORD))
        typed, m, s = analyse(df)
        ok = s["stage"] == p.expected_stage
        all_ok &= ok
        print(f"{p.name:<19}{len(df):>5}{m['days_covered']:>5}{p.expected_stage:>18}{s['stage']:>18}  "
              f"{s['confidence']:<7}{str(m['runway_days']):>7}{str(m['near_zero_debit_share']):>7}"
              f"{str(m['low_balance_day_share']):>9}{str(m['cash_out_share']):>7}{str(m['retention_rate']):>11}"
              f"  {'ok' if ok else 'MISMATCH'}  breaks={chain_breaks(df)} unknown={int((typed['type'] == 'UNKNOWN').sum())}")
        if not ok or p.name in ("cash_heavy", "sponsor_lumps"):
            for r in s["reasons"]:
                print("     -", r)
            for n in s["notes"]:
                print("     note:", n)
    print("\nAll stages match expectations." if all_ok else "\nSome stages differ from expectations.")


if __name__ == "__main__":
    main()
