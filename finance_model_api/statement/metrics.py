import pandas as pd
from .classify import INTERNAL, SAVE_TYPES, DRAW_TYPES


def _ratio(a, b, nd=3):
    return round(float(a) / float(b), nd) if b else None


def full_months_in(df, tol_days=3):
    """Months the statement covers (within a few days of each boundary)."""
    tol = pd.Timedelta(days=tol_days)
    first, last = df["time"].min().normalize(), df["time"].max().normalize()
    return [m for m in pd.period_range(first, last, freq="M")
            if first <= m.start_time + tol and last >= m.end_time.normalize() - tol]

def squeeze_month_share(daily_bal, typical_daily, min_days=20):
    """Share of months (with at least min_days of data) whose lowest daily balance fell under one typical day's spending."""
    if not typical_daily:
         return None
    g = daily_bal.groupby(daily_bal.index.to_period("M"))
    low, n = g.min(), g.size()
    keep = n >= min_days
    return round(float((low[keep] < typical_daily).mean()), 3) if keep.any() else None

def fuliza_metrics(df):
    funded = df[(df["funding"] == "fuliza") & (df["direction"] == "out") & (~df["type"].isin(INTERNAL))]
    repaid = df[df["type"] == "fuliza_repayment"]
    return {
        "fuliza_present": bool(len(funded) or len(repaid)),
        "fuliza_funded_count": int(len(funded)),
        "fuliza_funded_amount": round(float(funded["amount"].sum()), 2),
        "fuliza_repayment_count": int(len(repaid)),
        "fuliza_repayment_total": round(float(repaid["amount"].sum()), 2),
        "fuliza_months_active": int(funded["time"].dt.to_period("M").nunique()),
        "fuliza_outstanding_approx": round(float(funded["amount"].sum() - repaid["amount"].sum()), 2),
    }


def compute_metrics(df):
    """df: cleaned, chronological frame with type, direction, amount, balance."""
    ext = df[~df["type"].isin(INTERNAL)]
    out_rows = ext[ext["direction"] == "out"]
    inflow = ext.loc[ext["direction"] == "in", "amount"].sum()
    reversals = df.loc[df["type"] == "reversal", "amount"].sum()
    outflow = out_rows["amount"].sum() - reversals       # a reversed send isn't spending

    # savings, by product and pooled (positive net = money moved into savings)
    ms_in = df.loc[df["type"].isin(["savings_deposit", "savings_lock"]), "amount"].sum()
    ms_out = df.loc[df["type"] == "savings_withdraw", "amount"].sum()
    zi_in = df.loc[df["type"] == "ziidi_deposit", "amount"].sum()
    zi_out = df.loc[df["type"] == "ziidi_withdraw", "amount"].sum()
    saved = df.loc[df["type"].isin(SAVE_TYPES), "amount"].sum()
    drawn = df.loc[df["type"].isin(DRAW_TYPES), "amount"].sum()

    opening = df["balance"].iloc[0] - df["paid_in"].iloc[0] - df["withdrawn"].iloc[0]
    ending_balance = float(df["balance"].iloc[-1])
    kept = (ending_balance - opening) + (saved - drawn)

    # coverage-aware monthly view
    monthly = (ext.assign(month=ext["time"].dt.to_period("M"))
                  .groupby(["month", "direction"])["amount"].sum().unstack(fill_value=0))
    for col in ("in", "out"):
        if col not in monthly:
            monthly[col] = 0.0
    full = full_months_in(df)
    fm = monthly.loc[monthly.index.isin(full)]

    # robust typical spending: weekly median (lumps barely move it)
    weekly = out_rows.set_index("time")["amount"].resample("W").sum()
    if len(weekly) >= 6:
        weekly = weekly.iloc[1:-1]                        # drop partial edge weeks
    typical_daily_out = float(weekly.median() / 7) if len(weekly) >= 4 else None

    daily_bal = df.set_index("time")["balance"].resample("D").last().ffill()
    debits = df[df["direction"] == "out"]
    fees = df.loc[df["type"] == "fee", "amount"].sum()
    top5 = out_rows.nlargest(5, "amount")["amount"].sum()

    result = {
        "days_covered": int((df["time"].max().normalize() - df["time"].min().normalize()).days + 1),
        "full_months": len(full),
        "inflow": round(float(inflow), 2),
        "outflow": round(float(outflow), 2),
        "kept": round(float(kept), 2),
        "retention_rate": _ratio(kept, inflow, 4),
        "median_month_inflow": round(float(fm["in"].median()), 2) if len(fm) >= 3 else None,
        "median_month_outflow": round(float(fm["out"].median()), 2) if len(fm) >= 3 else None,
        "typical_daily_outflow": round(typical_daily_out, 2) if typical_daily_out else None,
        "ending_balance": round(ending_balance, 2),
        "runway_days": round(ending_balance / typical_daily_out, 1) if typical_daily_out else None,
        "min_balance": round(float(df["balance"].min()), 2),
        "low_balance_day_share": round(float((daily_bal < typical_daily_out).mean()), 3) if typical_daily_out else None,
        "squeeze_month_share": squeeze_month_share(daily_bal, typical_daily_out),
        "near_zero_debit_share": round(float((debits["balance"] < 50).mean()), 3) if len(debits) else None,
        "top5_outflow_share": _ratio(top5, outflow, 3),
        "fees_total": round(float(fees), 2),
        "fees_share_of_outflow": _ratio(fees, outflow, 4),
        "airtime_count": int((df["type"] == "airtime_data").sum()),
        "airtime_total": round(float(df.loc[df["type"] == "airtime_data", "amount"].sum()), 2),
        "cash_out_share": _ratio(df.loc[df["type"] == "cash_out", "amount"].sum(), outflow, 3),
        "net_savings_moved": round(float(saved - drawn), 2),
        "mshwari_net": round(float(ms_in - ms_out), 2),
        "ziidi_net": round(float(zi_in - zi_out), 2),
        "savings_return_ratio": _ratio(drawn, saved, 3),
        "savings_deposits": int((df["type"] == "savings_deposit").sum()),
        "savings_withdrawals": int((df["type"] == "savings_withdraw").sum()),
        "ziidi_deposits": int((df["type"] == "ziidi_deposit").sum()),
        "ziidi_withdrawals": int((df["type"] == "ziidi_withdraw").sum()),
    }
    result.update(fuliza_metrics(df))
    return result, monthly