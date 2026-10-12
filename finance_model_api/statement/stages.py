import pandas as pd
from .classify import UNVERIFIED_TYPES

# First-guess thresholds. NOT calibrated: tune with personas and other students' data.
T = {
    "min_days": 28,
    "short_runway_days": 3,         # buffer covers fewer days of typical spending than this
    "near_zero_debit_share": 0.10,  # share of debits that leave the wallet almost empty
    "low_balance_day_share": 0.20,  # share of days the balance is under one typical day's spend
    "buffer_days_ready": 14,        # target buffer, in days of typical spending
    "leak_ratio": 0.8,              # share of saved money taken back out that counts as "leaky"
    "squeeze_month_share": 0.5,
    "cash_heavy_share": 0.4,
    "stale_days": 45,               # statement ended longer ago than this: advice describes the past
}

NEXT_STEPS = {
    "not_enough_data": "upload_longer_statement",
    "short_of_cash": "slow_spending_after_deposits",
    "stable": "build_buffer",
    "building_habit": "make_saving_consistent",
    "ready_to_explore": "learn_investing_basics",
}


def data_quality(df, today=None):
    """today: a date/datetime; defaults to the current date. Passed in by tests for determinism."""
    unknown = df[df["type"] == "UNKNOWN"]
    total = df["amount"].sum()
    last = pd.Timestamp(df["time"].max())
    now = pd.Timestamp(today) if today is not None else pd.Timestamp.now()
    return {
        "last_transaction": last.isoformat(),
        "days_since_last": max(int((now.normalize() - last.normalize()).days), 0),
        "unknown_rows": int(len(unknown)),
        "unknown_volume_share": round(float(unknown["amount"].sum() / total), 4) if total else 0.0,
        "unverified_rows": int(df["type"].isin(UNVERIFIED_TYPES).sum()),
        "fuliza_draw_rows": int((df["type"] == "fuliza_draw").sum()),
    }


def _confidence(days, dq):
    if days < 60 or dq["unknown_volume_share"] > 0.02:
        return "low"
    return "medium" if days < 180 else "high"


def _result(stage, reasons, notes, confidence, borrowing, buffer_days):
    return {"stage": stage, "reasons": reasons, "notes": notes, "confidence": confidence,
            "borrowing": borrowing, "buffer_days": buffer_days, "next_step": NEXT_STEPS[stage]}


def assign_stage(m, dq, extra_savings=0.0):
    """m: metrics dict, dq: data_quality dict, extra_savings: optional savings balance entered by the student."""
    days = m.get("days_covered") or 0
    if days < T["min_days"]:
        return _result("not_enough_data",
                       [f"Only {days} days of data; at least {T['min_days']} are needed."],
                       [], "low", "unknown", None)

    confidence = _confidence(days, dq)
    notes = []
    age = dq.get("days_since_last")
    if age is not None and age > T["stale_days"]:
        notes.append(f"This statement ended {age} days ago, so the advice describes your finances then. "
                     "Upload a recent statement for current advice.")
        confidence = "low"
    if dq["unknown_volume_share"] > 0.02:
        notes.append("Part of the statement could not be read, so results may be incomplete.")
    if not extra_savings:
        notes.append("Savings balances are not visible on the statement; the buffer counts the wallet only.")

    # borrowing: 'found' or 'none_detected' (never a flat 'none': the detector is only partly verified)
    found = (m.get("fuliza_funded_count") or m.get("fuliza_repayment_count") or dq["fuliza_draw_rows"])
    borrowing = "found" if found else "none_detected"
    if borrowing == "none_detected":
        notes.append("No Fuliza detected. The detector is verified on public examples only, so read this as 'none detected'.")

    if (m.get("cash_out_share") or 0) >= T["cash_heavy_share"]:
          notes.append("A large part of your spending leaves as cash withdrawals, which the statement cannot show in detail.")
          confidence = "low"

    daily = m.get("typical_daily_outflow")
    buffer_days = round((m["ending_balance"] + extra_savings) / daily, 1) if daily else None

    # 1. short of cash
    short = []
    if borrowing == "found":
        short.append("Overdraft (Fuliza) activity was detected.")
    if buffer_days is not None and buffer_days < T["short_runway_days"]:
        short.append(f"Your balance covers only about {buffer_days} days of typical spending.")
    if (m.get("near_zero_debit_share") or 0) >= T["near_zero_debit_share"]:
        short.append("Many payments left your wallet almost empty.")
    if (m.get("low_balance_day_share") or 0) >= T["low_balance_day_share"]:
        short.append("Your balance was often below a day's typical spending.")
    if (m.get("squeeze_month_share") or 0) >= T["squeeze_month_share"]:
          short.append("In most months your balance dropped below a day's typical spending.")
    if short:
        return _result("short_of_cash", short, notes, confidence, borrowing, buffer_days)

    # 2. saving behaviour
    net = m.get("net_savings_moved") or 0.0
    ratio = m.get("savings_return_ratio")
    saves = ((m.get("savings_deposits") or 0) + (m.get("ziidi_deposits") or 0)) > 0
    ready = (buffer_days is not None and buffer_days >= T["buffer_days_ready"]
             and net > 0 and (ratio is None or ratio < T["leak_ratio"]))

    if ready:
        return _result("ready_to_explore", [
            f"Your buffer covers about {buffer_days} days of typical spending.",
            f"About KES {net:,.0f} moved into savings, and only {ratio:.0%} of what you saved was taken back out."
            if ratio is not None else f"About KES {net:,.0f} moved into savings.",
        ], notes, confidence, borrowing, buffer_days)

    if saves:
        gaps = []
        if buffer_days is None or buffer_days < T["buffer_days_ready"]:
            gaps.append(f"your buffer is about {buffer_days} days against a {T['buffer_days_ready']}-day target")
        if net <= 0:
            gaps.append("no net money moved into savings in this period")
        elif ratio is not None and ratio >= T["leak_ratio"]:
            gaps.append(f"{ratio:.0%} of the money you saved was taken back out")
        return _result("building_habit", [
            "Saving activity found (M-Shwari or Ziidi deposits).",
            "Before exploring investing: " + "; ".join(gaps) + ".",
        ], notes, confidence, borrowing, buffer_days)

    return _result("stable", [
        "No overdraft activity detected." if borrowing == "none_detected" else "Overdraft activity detected.",
        f"Your wallet covers about {buffer_days} days of typical spending." if buffer_days is not None
        else "Not enough spending history to estimate your buffer.",
        "No savings deposits seen in this period.",
    ], notes, confidence, borrowing, buffer_days)