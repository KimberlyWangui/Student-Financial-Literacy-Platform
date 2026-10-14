"""Turns the stage and metrics into ranked, plain-language recommendation cards.

Rule-based on purpose: every card says what to do, why (using the student's own numbers) and one
concrete first step, and carries the numbers it used in `evidence` so it can be checked.

Investing is education only. No card names a product to buy; the only investing card appears once the
stage engine says the student has a buffer and a saving habit, and it points to the in-app simulator.
"""
import math

import pandas as pd

from .stages import T, days_phrase

A = {
    "max_cards": 3,
    "lump_share": 0.5,          # top-5 payments make up at least this share of spending
    "fee_share": 0.02,          # fees are at least this share of spending
    "buffer_weeks": 8,          # spread the buffer gap over this many weeks in the suggested first step
    "invest_share": 0.2,        # suggest this share of a typical month's leftover money for the simulator
    "invest_round": 50,         # amounts are rounded down to a multiple of this, in KES
    "invest_cap": 5000,         # never suggest more than this per month
    "invest_type": "mmf",       # simulator starting point: low risk and easy to withdraw from
}

CATEGORIES = ("Budget", "Goal", "Saving", "Spending", "Income", "General")   # matches the Laravel recommendations table


def _num(x, default=0.0):
    return default if x is None else float(x)


def _kes(x):
    return f"KES {x:,.0f}"


def _round_up(x, base=10):
    return int(math.ceil(x / base) * base)


def suggest_monthly(m):
    """About 20% of what a typical month leaves over (money in minus money out), rounded down to KES 50.
    None when the statement has too few full months, nothing is left over, or the amount would be under KES 50."""
    inflow, outflow = m.get("median_month_inflow"), m.get("median_month_outflow")
    if inflow is None or outflow is None:
        return None
    leftover = float(inflow) - float(outflow)
    if leftover <= 0:
        return None
    amount = int(leftover * A["invest_share"] // A["invest_round"]) * A["invest_round"]
    amount = min(amount, A["invest_cap"])
    return amount if amount >= A["invest_round"] else None


def _card(id, category, title, what, why, first_step, priority, confidence,
          learn=None, impact_kes=None, evidence=None, simulator=None):
    assert category in CATEGORIES, category
    return {
        "simulator": simulator,
        "id": id, "category": category, "title": title, "what": what, "why": why,
        "first_step": first_step, "learn": learn,
        "impact_kes": None if impact_kes is None else round(float(impact_kes)),
        "confidence": confidence, "priority": priority, "evidence": evidence or {},
    }


# ---- the one card tied to the student's stage ------------------------------------------
def _primary(m, dq, stage, extra):
    conf = stage["confidence"]
    sid = stage["stage"]
    daily = _num(m.get("typical_daily_outflow"))
    buffer_days = stage.get("buffer_days")
    reasons = " ".join(stage["reasons"])
    bdt = days_phrase(buffer_days)
    holds = "wallet and savings" if extra > 0 else "wallet"      # what the buffer is made of

    if sid == "not_enough_data":
        days = int(_num(m.get("days_covered")))
        return _card(
            "upload_longer_statement", "General", "Add more of your statement",
            f"We need at least {T['min_days']} days of M-Pesa activity to say anything useful. "
            "A statement covering 6 to 12 months works best.",
            f"The statement you uploaded covers {days} days.",
            "Request a longer statement from M-PESA and upload it here.",
            10, conf, evidence={"days_covered": days, "days_needed": T["min_days"]})

    if sid == "short_of_cash":
        monthly = _num(m.get("median_month_inflow"))
        weekly = _round_up(monthly / 4.3) if monthly > 0 else None
        step = ("When money arrives, split it by the weeks until the next deposit and treat that as your weekly limit"
                + (f" (for a typical month of yours, about {_kes(weekly)} a week)." if weekly else "."))
        return _card(
            "slow_spending_after_deposits", "Spending", "Make each deposit last until the next one",
            "Your wallet runs low often. The aim is not to spend less overall, but to spread what you receive "
            "so you are not stuck at the end of the month.",
            reasons, step, 10, conf,
            evidence={"buffer_days": buffer_days, "typical_daily_outflow": daily,
                      "low_balance_day_share": m.get("low_balance_day_share"),
                      "squeeze_month_share": m.get("squeeze_month_share")})

    target = T["buffer_days_ready"] * daily
    held = _num(m.get("ending_balance")) + extra
    gap = max(0.0, target - held)

    if sid == "stable":
        if gap > 0:
            per_week = _round_up(gap / A["buffer_weeks"])
            return _card(
                "build_buffer", "Saving", "Build a small buffer first",
                f"Aim to hold about {T['buffer_days_ready']} days of spending in reserve, which is roughly {_kes(target)} for you.",
                f"Your {holds} cover{'' if extra > 0 else 's'} {bdt} of typical spending (about {_kes(daily)} a day).",
                f"Move about {_kes(per_week)} a week for {A['buffer_weeks']} weeks into a savings pocket you don't "
                "touch day to day, such as M-Shwari or Ziidi. Check each product's current terms in its app.",
                10, conf, impact_kes=gap,
                evidence={"buffer_days": buffer_days, "target_days": T["buffer_days_ready"],
                          "typical_daily_outflow": daily, "gap_kes": round(gap)})
        return _card(
            "build_buffer", "Saving", "Start saving regularly",
            f"Your {holds} already cover{'' if extra > 0 else 's'} a good buffer. The next step is to build a saving habit so the buffer "
            "doesn't depend on what happens to be left over.",
            f"Your {holds} cover{'' if extra > 0 else 's'} {bdt} of typical spending, but we found no saving activity.",
            "Pick one day each month, right after your main deposit arrives, and move a fixed amount into a "
            "savings pocket such as M-Shwari or Ziidi.",
            10, conf, evidence={"buffer_days": buffer_days, "savings_deposits": m.get("savings_deposits")})

    if sid == "building_habit":
        deposits = int(_num(m.get("savings_deposits")) + _num(m.get("ziidi_deposits")))
        withdrawals = int(_num(m.get("savings_withdrawals")) + _num(m.get("ziidi_withdrawals")))
        ratio = m.get("savings_return_ratio")
        net = _num(m.get("net_savings_moved"))
        ev = {"savings_deposits": deposits, "savings_withdrawals": withdrawals,
              "savings_return_ratio": ratio, "net_savings_moved": net, "buffer_days": buffer_days}
        if net <= 0:
            return _card(
                "make_saving_consistent", "Saving", "Put in a little more than you take out",
                "You already use savings, which is the hardest part. The next step is to end each month with "
                "slightly more saved than you started with.",
                f"You made {deposits} deposits and {withdrawals} withdrawals, and overall nothing was added to your savings.",
                "Before taking money out of savings, check whether the wallet can cover it; if it can't, take out only what you need.",
                10, conf, evidence=ev)
        if ratio is not None and ratio >= T["leak_ratio"]:
            shown = min(float(ratio), 1.0)
            return _card(
                "make_saving_consistent", "Saving", "Let your savings stay put",
                "You already save, which is the hardest part. The next step is leaving some of it alone long "
                "enough to become a cushion.",
                f"You made {deposits} deposits and {withdrawals} withdrawals. Roughly {shown:.0%} of what you put in "
                "came back out.",
                "Choose one amount you won't touch for the next 30 days. If your savings product has a lock option, "
                "that can make it easier to leave alone.",
                10, conf, evidence=ev)
        return _card(
            "make_saving_consistent", "Saving", "Keep saving, and grow your buffer",
            f"Your saving habit is working. The gap now is your buffer, which covers {bdt} "
            f"against a {T['buffer_days_ready']}-day target.",
            reasons,
            f"Add about {_kes(_round_up(gap / A['buffer_weeks']))} a week for {A['buffer_weeks']} weeks to your "
            "wallet or savings.", 10, conf, impact_kes=gap, evidence=ev)

    # ready_to_explore: education only
    amount = suggest_monthly(m)
    net = _num(m.get("net_savings_moved"))
    ratio = m.get("savings_return_ratio")
    if ratio is None or ratio < 0.1:
        kept = "and almost none of it has come back out"
    else:
        kept = f"and only about {min(float(ratio), 1.0):.0%} of it has come back out"
    return _card(
        "learn_investing_basics", "General", "Learn how saving and investing options compare",
        "You have a buffer and a saving habit, which is the right foundation. Before putting money anywhere, "
        "learn how common options for small amounts differ: money market funds, treasury bills and SACCOs.",
        f"Your {holds} cover{'' if extra > 0 else 's'} {bdt} of typical spending, you have moved about {_kes(net)} into savings, {kept}.",
        (f"Try the investment simulator with {_kes(amount)} a month, about a fifth of what a typical month leaves you,"
         if amount else "Try the investment simulator with a small amount")
        + " and compare the options on risk and on how quickly you can get your money back.",
        10, conf,
        learn="Returns are not guaranteed, rates change, and some options lock your money for a period. "
              "Don't invest money you may need for fees or rent. This is for learning, not a recommendation to buy a product.",
        evidence={"buffer_days": buffer_days, "net_savings_moved": m.get("net_savings_moved"),
                  "savings_return_ratio": m.get("savings_return_ratio"),
                  "median_month_inflow": m.get("median_month_inflow"),
                  "median_month_outflow": m.get("median_month_outflow"),
                  "suggested_monthly_kes": amount},
        simulator={"investment_type": A["invest_type"], "monthly_amount": amount})


# ---- extra cards triggered by specific patterns ----------------------------------------
def _stale(dq, stage):
    age = dq.get("days_since_last")
    if age is None or age <= T["stale_days"] or stage["stage"] == "not_enough_data":
        return None
    last = str(dq.get("last_transaction", ""))[:10]
    try:
        shown = pd.Timestamp(last).strftime("%d %b %Y").lstrip("0")      # 30 Dec 2025
    except (ValueError, TypeError):
        shown = last
    return _card(
        "upload_recent_statement", "General", "Upload a recent statement",
        f"This advice is based on a statement that ended {age} days ago. A recent one will give advice that fits you now.",
        f"The last transaction we saw was on {shown}.",
        "Request a new statement from M-PESA that runs up to today and upload it.",
        0, "low", evidence={"days_since_last": age, "last_transaction": last})


def _fuliza(m, daily, stage):
    count = int(_num(m.get("fuliza_funded_count")))
    if stage["borrowing"] != "found" or count == 0:
        return None
    months = int(_num(m.get("fuliza_months_active")))
    return _card(
        "watch_fuliza", "Spending", "Watch your Fuliza use",
        "Fuliza is convenient, but it carries fees that add up when you rely on it. The aim is to need it "
        "less, not to feel bad about using it.",
        f"{count} of your payments were covered by Fuliza, across {months} month{'s' if months != 1 else ''}.",
        f"Keep about {_kes(daily)} (one day's typical spending) spare in your wallet so small payments don't tip into Fuliza."
        if daily else "Keep a small amount spare in your wallet so small payments don't tip into Fuliza.",
        21, stage["confidence"], evidence={"fuliza_funded_count": count, "fuliza_months_active": months})


def _lumps(m, stage):
    share = _num(m.get("top5_outflow_share"))
    if share < A["lump_share"]:
        return None
    return _card(
        "plan_big_payments", "Budget", "Plan for your few big payments",
        "A handful of large payments make up most of what you spend. Because they are predictable, you can "
        "plan for them instead of being caught out.",
        f"Your five biggest payments were {share:.0%} of everything you spent.",
        "List the big payments you expect soon (fees, rent, deposits) and set a little aside each week for each one.",
        22, stage["confidence"], evidence={"top5_outflow_share": share})


def _fees(m, stage):
    share = _num(m.get("fees_share_of_outflow"))
    if share < A["fee_share"]:
        return None
    total = _num(m.get("fees_total"))
    return _card(
        "cut_transaction_costs", "Spending", "Cut avoidable transaction costs",
        "Fees on M-Pesa transactions are small one at a time but add up across many small transfers and withdrawals.",
        f"You paid {_kes(total)} in transaction fees, which is {share:.1%} of what you spent.",
        "Where you can, combine several small transfers into one and avoid repeated small withdrawals.",
        23, stage["confidence"], impact_kes=total, evidence={"fees_total": total, "fees_share_of_outflow": share})


def _cash(m, stage):
    share = _num(m.get("cash_out_share"))
    if share < T["cash_heavy_share"]:
        return None
    return _card(
        "track_cash_spending", "Spending", "Keep track of your cash spending",
        "A large part of your money leaves as cash, which a statement can't break down, so some of your "
        "spending is invisible to this analysis.",
        f"{share:.0%} of what you spent left as cash withdrawals.",
        "For one week, note what you spend each cash withdrawal on right after you take it out.",
        24, stage["confidence"], evidence={"cash_out_share": share})


def build_actions(metrics, dq, stage, extra_savings=0.0):
    """Ranked cards, most important first, at most A['max_cards']."""
    extra = float(extra_savings or 0.0)
    daily = _num(metrics.get("typical_daily_outflow"))
    cards = [
        _stale(dq, stage),
        _primary(metrics, dq, stage, extra),
        _fuliza(metrics, daily, stage),
        _lumps(metrics, stage),
        _fees(metrics, stage),
        _cash(metrics, stage),
    ]
    cards = sorted((c for c in cards if c), key=lambda c: c["priority"])
    return cards[: A["max_cards"]]
