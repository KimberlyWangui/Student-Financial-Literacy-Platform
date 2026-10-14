from statement.stages import assign_stage

BASE = dict(days_covered=180, fuliza_funded_count=0, fuliza_repayment_count=0,
            typical_daily_outflow=300.0, ending_balance=3000.0,
            near_zero_debit_share=0.0, low_balance_day_share=0.0, squeeze_month_share=0.0, cash_out_share=0.0,
            savings_deposits=0, ziidi_deposits=0, net_savings_moved=0.0, savings_return_ratio=None)
DQ = dict(unknown_rows=0, unknown_volume_share=0.0, unverified_rows=0, fuliza_draw_rows=0)


def stage(**override):
    return assign_stage(dict(BASE, **override), DQ)["stage"]


def test_not_enough_data():
    assert stage(days_covered=10) == "not_enough_data"

def test_short_of_cash_borrowing():
    assert stage(fuliza_funded_count=2) == "short_of_cash"

def test_short_of_cash_runway():
    assert stage(ending_balance=300.0) == "short_of_cash"

def test_short_of_cash_when_squeezed_most_months():
    assert stage(squeeze_month_share=0.6) == "short_of_cash"

def test_an_occasional_dip_is_not_a_squeeze():
    assert stage(squeeze_month_share=0.2) == "stable"

def test_stable():
    assert stage() == "stable"

def test_building_habit():
    assert stage(savings_deposits=3) == "building_habit"

def test_ready_to_explore():
    assert stage(ending_balance=6000.0, savings_deposits=5,
                 net_savings_moved=2000.0, savings_return_ratio=0.3) == "ready_to_explore"

def test_unreadable_lowers_confidence():
    res = assign_stage(BASE, dict(DQ, unknown_volume_share=0.05))
    assert res["confidence"] == "low"

def test_cash_heavy_lowers_confidence():
    res = assign_stage(dict(BASE, cash_out_share=0.6), DQ)
    assert res["confidence"] == "low"
    assert any("cash withdrawals" in n for n in res["notes"])

# ---- statement age ----------------------------------------------------------------
def test_old_statement_gets_a_note_and_low_confidence():
    res = assign_stage(BASE, dict(DQ, days_since_last=120))
    assert any("ended 120 days ago" in n for n in res["notes"])
    assert res["confidence"] == "low"


def test_recent_statement_has_no_age_note():
    res = assign_stage(BASE, dict(DQ, days_since_last=10))
    assert not any("days ago" in n for n in res["notes"])


def test_data_quality_counts_days_since_last_transaction():
    import pandas as pd
    from statement.stages import data_quality
    df = pd.DataFrame({"time": pd.to_datetime(["2025-12-01 10:00", "2025-12-30 20:08"]),
                       "type": ["send_money", "send_money"], "amount": [100.0, 50.0]})
    dq = data_quality(df, today="2026-10-12")
    assert dq["days_since_last"] == 286 and dq["last_transaction"].startswith("2025-12-30")
    assert data_quality(df, today="2025-12-01")["days_since_last"] == 0   # never negative
