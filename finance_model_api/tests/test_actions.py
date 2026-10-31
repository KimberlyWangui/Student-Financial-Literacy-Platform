"""Tests for the recommendation cards (statement/actions.py). All data is synthetic."""
import io
import re

import pandas as pd
import pytest

from statement.actions import A, CATEGORIES, build_actions
from statement.classify import add_types
from statement.metrics import compute_metrics
from statement.parser import add_row_ids, user_key
from statement.privacy import to_safe_records
from statement.stages import NEXT_STEPS, T, assign_stage, data_quality
from synthetic.personas import PERSONAS

BY_NAME = {p.name: p for p in PERSONAS}
SEEDS = range(100, 108)
FIELDS = {"id", "category", "title", "what", "why", "first_step", "learn", "impact_kes",
          "confidence", "priority", "evidence", "simulator"}


def fresh(df):
    """data_quality as if the statement ended three days ago, so staleness doesn't mask other rules."""
    typed = add_types(df)
    metrics, _ = compute_metrics(typed)
    dq = data_quality(typed, today=pd.Timestamp(typed["time"].max()) + pd.Timedelta(days=3))
    stage = assign_stage(metrics, dq)
    return metrics, dq, stage


# a stable, non-short, no-saving base: typical day 100, wallet 2,000 (20 days), no triggers
BASE = dict(days_covered=200, ending_balance=2000.0, typical_daily_outflow=100.0, median_month_inflow=9000.0,
            cash_out_share=0.1, fees_share_of_outflow=0.005, fees_total=300.0, top5_outflow_share=0.3,
            near_zero_debit_share=0.0, low_balance_day_share=0.0, squeeze_month_share=0.0,
            savings_deposits=0, ziidi_deposits=0, savings_withdrawals=0, ziidi_withdrawals=0,
            net_savings_moved=0.0, savings_return_ratio=None, fuliza_funded_count=0,
            fuliza_repayment_count=0, fuliza_months_active=0)
DQ = dict(unknown_volume_share=0.0, unknown_rows=0, unverified_rows=0, fuliza_draw_rows=0, days_since_last=5,
          last_transaction="2026-01-01T10:00:00")


def cards(**override):
    m = dict(BASE, **override.pop("m", {}))
    dq = dict(DQ, **override.pop("dq", {}))
    stage = assign_stage(m, dq, override.pop("extra", 0.0))
    return stage, build_actions(m, dq, stage, 0.0)


# ---- personas --------------------------------------------------------------------------
@pytest.mark.parametrize("persona", PERSONAS, ids=lambda p: p.name)
def test_primary_card_matches_the_stage_across_seeds(persona):
    for seed in SEEDS:
        m, dq, stage = fresh(persona.build(seed))
        out = build_actions(m, dq, stage)
        assert out and out[0]["id"] == NEXT_STEPS[stage["stage"]], f"seed {seed}"
        assert len(out) <= A["max_cards"]
        assert [c["priority"] for c in out] == sorted(c["priority"] for c in out)
        assert len({c["id"] for c in out}) == len(out)


@pytest.mark.parametrize("persona", PERSONAS, ids=lambda p: p.name)
def test_every_card_is_complete_and_clean(persona):
    m, dq, stage = fresh(persona.build())
    for c in build_actions(m, dq, stage):
        assert set(c) == FIELDS
        assert c["category"] in CATEGORIES
        for field in ("title", "what", "why", "first_step"):
            text = c[field]
            assert isinstance(text, str) and len(text) > 15, (c["id"], field)
            assert not re.search(r"None|nan|\{|\}|\.0 days", text), (c["id"], field, text)
        assert c["evidence"], c["id"]


def test_the_expected_extra_cards_appear_for_the_personas():
    ids = lambda name: [c["id"] for c in build_actions(*fresh(BY_NAME[name].build()))]
    assert "watch_fuliza" in ids("fuliza_dependent")
    assert "track_cash_spending" in ids("cash_heavy")
    assert "plan_big_payments" in ids("sponsor_lumps")


# ---- investing is education only -------------------------------------------------------
INVEST_WORDS = re.compile(r"invest|stock|treasury|money market|sacco", re.I)


@pytest.mark.parametrize("persona", PERSONAS, ids=lambda p: p.name)
def test_investing_is_mentioned_only_for_students_who_are_ready(persona):
    m, dq, stage = fresh(persona.build())
    for c in build_actions(m, dq, stage):
        blob = " ".join(str(c[f]) for f in ("title", "what", "why", "first_step", "learn"))
        if stage["stage"] != "ready_to_explore":
            assert not INVEST_WORDS.search(blob), (persona.name, c["id"])


def test_the_investing_card_carries_its_risk_warning_and_names_no_product_to_buy():
    m, dq, stage = fresh(BY_NAME["steady_saver"].build())
    card = build_actions(m, dq, stage)[0]
    assert card["id"] == "learn_investing_basics"
    assert "not guaranteed" in card["learn"] and "not a recommendation" in card["learn"]
    blob = " ".join(str(card[f]) for f in ("what", "first_step")).lower()
    assert "simulator" in blob
    assert not re.search(r"\b(buy|put your money in|you should invest)\b", blob)


# ---- individual rules ------------------------------------------------------------------
def test_stale_statement_card_comes_first():
    stage, out = cards(dq={"days_since_last": 120})
    assert out[0]["id"] == "upload_recent_statement" and out[0]["priority"] == 0
    assert out[1]["id"] == NEXT_STEPS[stage["stage"]]


def test_no_stale_card_when_the_statement_is_recent_or_too_short_anyway():
    assert "upload_recent_statement" not in [c["id"] for c in cards(dq={"days_since_last": T["stale_days"]})[1]]
    _, out = cards(m={"days_covered": 10}, dq={"days_since_last": 300})
    assert [c["id"] for c in out] == ["upload_longer_statement"]


def test_fuliza_card_only_when_fuliza_was_found():
    assert "watch_fuliza" not in [c["id"] for c in cards()[1]]
    _, out = cards(m={"fuliza_funded_count": 4, "fuliza_months_active": 2})
    card = next(c for c in out if c["id"] == "watch_fuliza")
    assert "4 of your payments" in card["why"] and "2 months" in card["why"]


@pytest.mark.parametrize("key,id,threshold,below,above", [
    ("top5_outflow_share", "plan_big_payments", A["lump_share"], 0.49, 0.5),
    ("fees_share_of_outflow", "cut_transaction_costs", A["fee_share"], 0.019, 0.02),
    ("cash_out_share", "track_cash_spending", T["cash_heavy_share"], 0.39, 0.4),
])
def test_threshold_rules_switch_on_at_the_boundary(key, id, threshold, below, above):
    assert id not in [c["id"] for c in cards(m={key: below})[1]]
    assert id in [c["id"] for c in cards(m={key: above})[1]]


def test_buffer_gap_is_turned_into_a_weekly_amount_and_extra_savings_shrink_it():
    m = dict(BASE, ending_balance=500.0)            # 5 days of buffer, target 14 -> gap 900
    dq = dict(DQ)
    stage = assign_stage(m, dq)
    card = build_actions(m, dq, stage)[0]
    assert card["id"] == "build_buffer" and card["impact_kes"] == 900
    assert "KES 120 a week for 8 weeks" in card["first_step"]       # 900 / 8 = 112.5 -> 120
    stage2 = assign_stage(m, dq, 400.0)
    assert build_actions(m, dq, stage2, 400.0)[0]["impact_kes"] == 500


def test_a_student_who_already_has_the_buffer_gets_the_saving_habit_variant():
    card = cards()[1][0]            # BASE: 20 days in the wallet, no saving
    assert card["id"] == "build_buffer" and card["title"] == "Start saving regularly"
    assert card["impact_kes"] is None


def test_building_habit_variants():
    leak = cards(m={"savings_deposits": 10, "savings_withdrawals": 9, "net_savings_moved": 500.0,
                    "savings_return_ratio": 0.9})[1][0]
    assert leak["title"] == "Let your savings stay put" and "90%" in leak["why"]

    capped = cards(m={"savings_deposits": 3, "net_savings_moved": 100.0, "savings_return_ratio": 1.4})[1][0]
    assert "100%" in capped["why"] and "140%" not in capped["why"]

    flat = cards(m={"savings_deposits": 3, "savings_withdrawals": 3, "net_savings_moved": 0.0,
                    "savings_return_ratio": 1.0})[1][0]
    assert flat["title"] == "Put in a little more than you take out"

    thin = cards(m={"savings_deposits": 6, "net_savings_moved": 4000.0, "savings_return_ratio": 0.2,
                    "ending_balance": 500.0})[1][0]
    assert thin["title"] == "Keep saving, and grow your buffer" and thin["impact_kes"] == 900


def test_at_most_three_cards_even_when_everything_triggers():
    _, out = cards(dq={"days_since_last": 200},
                   m={"fuliza_funded_count": 5, "fuliza_months_active": 3, "top5_outflow_share": 0.8,
                      "fees_share_of_outflow": 0.05, "cash_out_share": 0.7})
    assert len(out) == A["max_cards"]
    assert [c["id"] for c in out][:2] == ["upload_recent_statement", "slow_spending_after_deposits"]


def test_evidence_matches_the_metrics_it_came_from():
    m, dq, stage = fresh(BY_NAME["sponsor_lumps"].build())
    lumps = next(c for c in build_actions(m, dq, stage) if c["id"] == "plan_big_payments")
    assert lumps["evidence"]["top5_outflow_share"] == pytest.approx(m["top5_outflow_share"])
    assert f"{m['top5_outflow_share']:.0%}" in lumps["why"]


def test_missing_metrics_never_crash_the_cards():
    m = {"days_covered": 100}
    dq = dict(DQ)
    stage = assign_stage(dict(m, ending_balance=0.0), dq)
    out = build_actions(dict(m, ending_balance=0.0), dq, stage)
    assert out and all("None" not in c["why"] for c in out)


# ---- through the API -------------------------------------------------------------------
def test_insights_endpoint_returns_the_same_cards_as_the_engine():
    from statement_api import create_app
    import os

    client = create_app().test_client()
    df = BY_NAME["fuliza_dependent"].build()
    typed = add_row_ids(add_types(df), "u7")
    rows = to_safe_records(typed, user_key("u7"))
    r = client.post("/v1/insights", json={"transactions": rows}, headers={"X-Internal-Token": os.environ["INTERNAL_API_TOKEN"]})
    assert r.status_code == 200
    body = r.get_json()
    # the same engine, run directly with the real clock, must give identical cards
    typed_df = add_types(df)
    metrics, _ = compute_metrics(typed_df)
    dq = data_quality(typed_df)
    expected = build_actions(metrics, dq, assign_stage(metrics, dq))
    assert body["actions"] == expected
    assert "watch_fuliza" in [c["id"] for c in body["actions"]]
    assert all(FIELDS == set(c) for c in body["actions"])


# ---- the amount suggested for the simulator ---------------------------------------------
from statement.actions import suggest_monthly       # noqa: E402

READY = dict(BASE, savings_deposits=6, net_savings_moved=6000.0, savings_return_ratio=0.1,
             median_month_inflow=9000.0, median_month_outflow=6000.0)


def ready_card(extra=0.0, **override):
    m = dict(READY, **override)
    stage = assign_stage(m, DQ, extra)
    assert stage["stage"] == "ready_to_explore", stage["stage"]
    return build_actions(m, DQ, stage, extra)[0]


@pytest.mark.parametrize("inflow,outflow,expected", [
    (9000, 6000, 600),          # leftover 3,000 -> 20% = 600
    (9000, 6100, 550),          # 2,900 -> 580 -> rounded down to 550
    (6000, 5750, 50),           # 250 -> 50, the smallest amount suggested
    (6000, 5800, None),         # 200 -> 40, under KES 50
    (6000, 6000, None),         # nothing left over
    (6000, 7000, None),         # spends more than comes in
    (None, 6000, None),         # too few full months to know
    (9000, None, None),
    (500000, 100000, 5000),     # capped
])
def test_suggested_monthly_amount_is_a_fifth_of_the_leftover(inflow, outflow, expected):
    got = suggest_monthly({"median_month_inflow": inflow, "median_month_outflow": outflow})
    assert got == expected


def test_the_ready_card_carries_the_amount_and_a_simulator_hint():
    c = ready_card()
    assert c["id"] == "learn_investing_basics"
    assert c["simulator"] == {"investment_type": "mmf", "monthly_amount": 600}
    assert "KES 600 a month" in c["first_step"] and "a fifth" in c["first_step"]
    assert c["evidence"]["suggested_monthly_kes"] == 600


def test_the_ready_card_still_works_when_no_amount_can_be_suggested():
    c = ready_card(median_month_outflow=9500.0)
    assert c["simulator"] == {"investment_type": "mmf", "monthly_amount": None}
    assert "KES" not in c["first_step"] and "small amount" in c["first_step"]
    assert c["evidence"]["suggested_monthly_kes"] is None


@pytest.mark.parametrize("persona", PERSONAS, ids=lambda p: p.name)
def test_only_the_investing_card_has_a_simulator_hint(persona):
    m, dq, stage = fresh(persona.build())
    for c in build_actions(m, dq, stage):
        if c["id"] == "learn_investing_basics":
            assert c["simulator"]["investment_type"] == "mmf"
        else:
            assert c["simulator"] is None, c["id"]


def test_nothing_is_suggested_to_a_student_with_no_buffer():
    for m in (dict(READY, ending_balance=100.0),                          # 1 day of buffer
              dict(READY, ending_balance=100.0, savings_deposits=0)):
        stage = assign_stage(m, DQ)
        assert stage["stage"] != "ready_to_explore"
        assert all(c["simulator"] is None for c in build_actions(m, DQ, stage))


def test_savings_balance_counts_towards_the_buffer_and_the_wording_says_so():
    m = dict(READY, ending_balance=500.0)                                 # 5 days in the wallet alone
    assert assign_stage(m, DQ)["stage"] != "ready_to_explore"
    c = ready_card(extra=1500.0, ending_balance=500.0)                    # 500 + 1,500 = 20 days
    assert "wallet and savings cover" in c["why"] and "wallet covers" not in c["why"]
    assert "wallet covers" in ready_card()["why"]
