"""
try_api.py  (development only)

Runs ONE statement through the real /v1/parse and /v1/insights code paths, in-process (no server needed),
and prints only safe summaries: no transactions, names or receipt numbers.

Usage (from finance_model_api/, with INTERNAL_API_TOKEN and STATEMENT_HASH_KEY in .env or exported):
    python -m scripts.try_api private/statement.pdf
"""
import getpass
import io
import sys

from statement_api import create_app


def main():
    if len(sys.argv) != 2:
        sys.exit("Usage: python -m scripts.try_api <statement.pdf>")
    password = getpass.getpass("Statement password: ")
    app = create_app()
    client = app.test_client()
    headers = {"X-Internal-Token": app.config["INTERNAL_API_TOKEN"]}

    with open(sys.argv[1], "rb") as f:
        data = {"user_id": "dev-user", "password": password, "file": (io.BytesIO(f.read()), "statement.pdf")}
    r = client.post("/v1/parse", headers=headers, data=data, content_type="multipart/form-data")
    j = r.get_json()
    if r.status_code != 200:
        sys.exit(f"parse failed: HTTP {r.status_code} {j.get('code')}: {j.get('message')}")

    print("PARSE REPORT")
    for k, v in j["report"].items():
        print(f"  {k}: {v}")

    r = client.post("/v1/insights", headers=headers, json={"transactions": j["transactions"]})
    k = r.get_json()
    if r.status_code != 200:
        sys.exit(f"insights failed: HTTP {r.status_code} {k.get('code')}: {k.get('message')}")

    s = k["stage"]
    print(f"\nSTAGE: {s['stage']} (confidence {s['confidence']}, borrowing {s['borrowing']}, buffer {s['buffer_days']} days)")
    for line in s["reasons"]:
        print("  -", line)
    for line in s["notes"]:
        print("  note:", line)
    print("  next step:", s["next_step"]["id"], "-", s["next_step"]["title"])
    m = k["metrics"]
    print("\nKEY METRICS")
    for key in ("days_covered", "inflow", "outflow", "retention_rate", "typical_daily_outflow", "ending_balance",
                "runway_days", "squeeze_month_share", "cash_out_share", "net_savings_moved", "savings_return_ratio"):
        print(f"  {key}: {m.get(key)}")


if __name__ == "__main__":
    main()
