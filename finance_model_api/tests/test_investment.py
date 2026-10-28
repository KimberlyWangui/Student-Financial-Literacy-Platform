"""Investment simulator: maths, the API contract the Laravel/React side relies on, and the assumptions file."""
import json
import math

import pytest

from investment import load_assumptions, simulate, statistics_for_display
from investment.engine import (
    _after_tax_rate, _monthly_factor, annualised_irr, months_to_target, monte_carlo, project,
)

A = load_assumptions()


def run(**kw):
    base = dict(amount_invested=10000, duration_value=12, duration_unit="months", investment_type="mmf",
                monthly_topup=0, target_amount=None, reinvestment_frequency="monthly")
    base.update(kw)
    return simulate(A, **base)


# ---------------------------------------------------------------- deterministic projection
def test_projection_matches_closed_form():
    # value = P*g^N + c * (g^(N-1) + ... + g)   (top-ups start in month 2)
    g, n, p, c = _monthly_factor(8.5, "monthly"), 24, 10000, 500
    expected = p * g ** n + c * sum(g ** k for k in range(1, n))
    got = project(p, c, g, n)[-1][1]
    assert got == pytest.approx(expected, rel=1e-12)


def test_zero_growth_returns_exactly_what_was_put_in():
    path = project(1000, 100, 1.0, 6)
    assert path[-1][1] == pytest.approx(1000 + 5 * 100)
    assert path[-1][2] == pytest.approx(1500)


def test_tax_reduces_the_result_and_only_taxes_gains():
    assert _after_tax_rate(10, 0.15) == pytest.approx(8.5)
    assert _after_tax_rate(10, 0.0) == 10
    assert _after_tax_rate(-5, 0.15) == -5            # no tax relief or tax on a loss

    r = run(investment_type="mmf", duration_value=5, duration_unit="years", monthly_topup=1000)
    p = r["projections"]
    assert p["after_tax"] is True
    assert p["gross_final_value"] > p["projected_final_value"] > p["total_invested"]
    assert p["tax_paid"] == pytest.approx(p["gross_final_value"] - p["projected_final_value"], abs=0.01)


def test_untaxed_asset_has_no_tax_paid():
    assert A["assets"]["stock"]["tax_rate"] == 0
    assert run(investment_type="stock")["projections"]["tax_paid"] == 0


def test_frequencies_are_ordered_and_the_same_over_a_whole_year_at_most():
    m = run(reinvestment_frequency="monthly", duration_value=5, duration_unit="years")["projections"]["projected_final_value"]
    q = run(reinvestment_frequency="quarterly", duration_value=5, duration_unit="years")["projections"]["projected_final_value"]
    y = run(reinvestment_frequency="annually", duration_value=5, duration_unit="years")["projections"]["projected_final_value"]
    assert m > q > y


# ---------------------------------------------------------------- annualised return (IRR)
@pytest.mark.parametrize("topup", [0, 500, 5000])
@pytest.mark.parametrize("months", [12, 36, 120])
def test_annualised_return_equals_the_effective_rate_whatever_the_top_ups(topup, months):
    # Money grows at one constant rate, so the money-weighted yearly return must equal that rate.
    net = _after_tax_rate(A["assets"]["mmf"]["annual_return"], A["assets"]["mmf"]["tax_rate"])
    effective = ((1 + net / 100 / 12) ** 12 - 1) * 100
    r = run(duration_value=months, monthly_topup=topup)
    assert r["projections"]["annualized_return"] == pytest.approx(effective, abs=0.01)


def test_the_old_formula_would_have_been_wrong_with_top_ups():
    # Documenting why IRR is used: final/total_invested ignores that top-ups arrive late.
    r = run(duration_value=5, duration_unit="years", monthly_topup=2000)
    p = r["projections"]
    old = ((p["projected_final_value"] / p["total_invested"]) ** (1 / 5) - 1) * 100
    assert old < p["annualized_return"] - 1.0


def test_irr_handles_a_loss_and_bad_input():
    assert annualised_irr(1000, 0, 12, 900) < 0
    assert annualised_irr(1000, 0, 12, 0) is None


# ---------------------------------------------------------------- goal
@pytest.mark.parametrize("k", [2, 6, 18, 30, 59])
def test_goal_time_agrees_with_the_projection_timeline(k):
    """The goal month must be the first month the projected value reaches the target, at every point."""
    r = run(duration_value=60, monthly_topup=1000)
    tl = r["timeline"]
    mmf = A["assets"]["mmf"]
    g = _monthly_factor(_after_tax_rate(mmf["annual_return"], mmf["tax_rate"]), "monthly")

    just_reached = tl[k - 1]["value"] - 0.01           # reached in month k, not before
    just_missed = tl[k - 1]["value"] + 0.01            # not reached until month k + 1
    assert months_to_target(10000, 1000, g, just_reached) == k
    assert months_to_target(10000, 1000, g, just_missed) == k + 1

    goal = run(duration_value=60, monthly_topup=1000, target_amount=just_reached)["goal_analysis"]
    assert goal["months_needed"] == k
    assert (goal["years"], goal["remaining_months"]) == divmod(k, 12)
    assert goal["achievable"] is True and goal["reached_within_duration"] is True


def test_goal_beyond_the_chosen_period_says_so():
    goal = run(duration_value=12, monthly_topup=500, target_amount=50000)["goal_analysis"]
    assert goal["achievable"] is True
    assert goal["reached_within_duration"] is False
    assert "longer than the period you chose" in goal["message"]


def test_unreachable_goal():
    goal = run(duration_value=12, investment_type="tbill", amount_invested=1, monthly_topup=0,
               target_amount=10 ** 9)["goal_analysis"]
    assert goal["achievable"] is False and goal["months_needed"] is None


def test_no_goal_when_none_given():
    assert run()["goal_analysis"] is None


# ---------------------------------------------------------------- Monte Carlo
def test_same_inputs_give_identical_results_so_preview_matches_saved():
    a = run(investment_type="stock", duration_value=3, duration_unit="years", monthly_topup=500)
    b = run(investment_type="stock", duration_value=3, duration_unit="years", monthly_topup=500)
    assert a["risk_analysis"] == b["risk_analysis"]
    c = run(investment_type="stock", duration_value=3, duration_unit="years", monthly_topup=501)
    assert c["risk_analysis"] != a["risk_analysis"]


def test_scenarios_are_ordered_and_never_negative():
    r = run(investment_type="stock", duration_value=10, duration_unit="years", monthly_topup=500)["risk_analysis"]
    assert 0 < r["worst_case_scenario"] <= r["median_scenario"] <= r["best_case_scenario"]
    assert r["confidence_95_lower"] <= r["worst_case_scenario"]
    assert r["confidence_95_upper"] >= r["best_case_scenario"]


def test_extreme_volatility_still_cannot_go_below_zero():
    mc = monte_carlo(10000, 0, 8, 150, 0.0, 60, "monthly", 10000, n=2000, seed=1)
    assert mc["worst_case"] > 0


def test_zero_volatility_collapses_to_the_projection():
    mc = monte_carlo(10000, 500, 10, 0, 0.15, 24, "monthly", 21500, n=50, seed=1)
    g = _monthly_factor(_after_tax_rate(10, 0.15), "monthly")
    expected = project(10000, 500, g, 24)[-1][1]
    assert mc["best_case"] == pytest.approx(expected, abs=0.01) == pytest.approx(mc["worst_case"], abs=0.01)


def test_average_simulated_outcome_matches_the_expected_return():
    # Untaxed, no top-ups: the mean of the simulated paths should sit on the projection.
    mc = monte_carlo(10000, 0, 8, 20, 0.0, 60, "monthly", 10000, n=20000, seed=7)
    expected = 10000 * _monthly_factor(8, "monthly") ** 60
    assert mc["mean_case"] == pytest.approx(expected, rel=0.03)


def test_risk_ordering_across_assets_is_sensible():
    def spread(t):
        r = run(investment_type=t, duration_value=3, duration_unit="years")["risk_analysis"]
        return (r["best_case_scenario"] - r["worst_case_scenario"]) / 10000, r["probability_of_loss"]

    stock, bond, mmf, tbill = spread("stock"), spread("bond"), spread("mmf"), spread("tbill")
    assert stock[0] > bond[0] > mmf[0] > tbill[0]
    assert tbill[1] == 0 and mmf[1] == 0 and stock[1] > 5


# ---------------------------------------------------------------- result contract (Laravel + React)
def test_result_has_every_key_the_laravel_controller_and_react_page_read():
    r = run(target_amount=50000)
    for key in ("simulation_id", "investment_details", "projections", "risk_analysis", "timeline",
                "goal_analysis", "model_parameters", "disclaimer"):
        assert key in r
    for key in ("investment_type", "amount_invested", "duration_value", "duration_unit", "duration_months",
                "monthly_topup", "reinvestment_frequency", "target_amount"):
        assert key in r["investment_details"]
    for key in ("projected_final_value", "total_invested", "total_growth", "percentage_return", "annualized_return"):
        assert isinstance(r["projections"][key], (int, float))
    for key in ("risk_level", "volatility", "best_case_scenario", "worst_case_scenario", "median_scenario",
                "confidence_95_lower", "confidence_95_upper"):
        assert key in r["risk_analysis"]
    assert set(r["timeline"][0]) == {"month", "value", "contributions_to_date", "growth"}
    assert len(r["timeline"]) == 12
    assert all(k in r["goal_analysis"] for k in ("achievable", "message"))
    json.dumps(r)                                     # must be serialisable


def test_years_are_converted_to_months_in_the_result():
    r = run(duration_value=3, duration_unit="years")
    assert r["investment_details"]["duration_months"] == 36 and len(r["timeline"]) == 36


def test_every_result_carries_the_disclaimer_and_its_sources():
    for t in A["assets"]:
        r = run(investment_type=t)
        assert "not a prediction" in r["disclaimer"].lower() and "financial advice" in r["disclaimer"].lower()
        assert r["model_parameters"]["source"] and r["model_parameters"]["data_period"]


# ---------------------------------------------------------------- assumptions file
def test_assumptions_are_complete_and_sane():
    assert set(A["assets"]) == {"mmf", "tbill", "bond", "stock"}
    for name, a in A["assets"].items():
        assert 0 <= a["tax_rate"] < 1, name
        assert -50 < a["annual_return"] < 40, name
        assert 0 <= a["volatility"] < 80, name
        assert a["risk_level"] in ("very_low", "low", "medium", "high"), name
        assert a["source"].strip() and a["as_of"].strip(), name


def test_risk_levels_follow_volatility():
    vol = {k: v["volatility"] for k, v in A["assets"].items()}
    assert vol["tbill"] < vol["mmf"] < vol["bond"] < vol["stock"]


def test_a_broken_assumptions_file_is_refused(tmp_path):
    bad = json.loads(json.dumps(A))
    bad["assets"]["mmf"]["tax_rate"] = 15                # someone typed 15 instead of 0.15
    p = tmp_path / "bad.json"
    p.write_text(json.dumps(bad))
    with pytest.raises(ValueError, match="tax_rate"):
        load_assumptions(str(p))

    bad = json.loads(json.dumps(A))
    del bad["assets"]["stock"]["source"]
    p.write_text(json.dumps(bad))
    with pytest.raises(ValueError, match="source"):
        load_assumptions(str(p))


def test_statistics_list_has_what_the_explore_tab_reads():
    items = statistics_for_display(A)
    assert [i["type"] for i in items] == ["mmf", "tbill", "stock", "bond"]
    for i in items:
        for key in ("name", "description", "average_return", "risk_level", "volatility",
                    "min_expected_return", "max_expected_return", "recommended_duration", "after_tax_return"):
            assert key in i
        assert i["after_tax_return"] <= i["average_return"]


# ---------------------------------------------------------------- HTTP API
@pytest.fixture()
def client():
    import app as flask_app
    flask_app.app.config["TESTING"] = True
    return flask_app.app.test_client()


GOOD = {"amount_invested": 10000, "duration_value": 12, "duration_unit": "months",
        "investment_type": "mmf", "monthly_topup": 500, "target_amount": 50000, "reinvestment_frequency": "monthly"}


def test_simulate_endpoint_success(client):
    res = client.post("/api/investment/simulate", json=GOOD)
    body = res.get_json()
    assert res.status_code == 200 and body["status"] == "success"
    assert body["data"]["projections"]["after_tax"] is True


def test_simulate_accepts_what_laravel_sends(client):
    # Laravel sends null target and strings/numbers mixed; empty top-up becomes 0.
    res = client.post("/api/investment/simulate", json={**GOOD, "target_amount": None, "monthly_topup": 0})
    assert res.status_code == 200 and res.get_json()["data"]["goal_analysis"] is None


@pytest.mark.parametrize("change, fragment", [
    ({"investment_type": "crypto"}, "Invalid investment type"),
    ({"investment_type": ""}, "investment_type"),
    ({"amount_invested": 0}, "greater than 0"),
    ({"amount_invested": -5}, "greater than 0"),
    ({"amount_invested": "abc"}, "must be a number"),
    ({"amount_invested": True}, "must be a number"),
    ({"amount_invested": float("inf")}, "must be a number"),
    ({"amount_invested": 10 ** 12}, "too large"),
    ({"duration_value": 0}, "Duration"),
    ({"duration_value": 1.5}, "whole number"),
    ({"duration_value": 601}, "50 years"),
    ({"duration_value": 51, "duration_unit": "years"}, "50 years"),
    ({"duration_unit": "weeks"}, "months"),
    ({"monthly_topup": -1}, "negative"),
    ({"target_amount": 5000}, "Target amount"),
    ({"reinvestment_frequency": "daily"}, "Compounding frequency"),
])
def test_simulate_rejects_bad_input_with_a_clear_message(client, change, fragment):
    body = json.dumps({**GOOD, **change}, allow_nan=True)    # allow_nan so Infinity can be sent
    res = client.post("/api/investment/simulate", data=body, content_type="application/json")
    assert res.status_code == 400
    assert fragment in res.get_json()["message"]


def test_simulate_rejects_missing_or_non_json_body(client):
    assert client.post("/api/investment/simulate").status_code == 400
    assert client.post("/api/investment/simulate", data="not json", content_type="application/json").status_code == 400
    assert client.post("/api/investment/simulate", json=[1, 2]).status_code == 400
    assert client.post("/api/investment/simulate", json={}).status_code == 400


def test_internal_errors_do_not_leak_details(client, monkeypatch):
    import app as flask_app

    def boom(*a, **k):
        raise RuntimeError("secret internal detail /srv/app/path")

    monkeypatch.setattr(flask_app, "simulate", boom)
    res = client.post("/api/investment/simulate", json=GOOD)
    assert res.status_code == 500
    assert "secret" not in res.get_data(as_text=True) and "trace" not in res.get_json()


def test_statistics_endpoint(client):
    res = client.get("/api/investment/statistics")
    data = res.get_json()["data"]
    assert res.status_code == 200 and len(data["investment_types"]) == 4
    assert "disclaimer" in data["metadata"]


def test_health_and_the_old_predict_endpoint_is_gone(client):
    assert client.get("/health").status_code == 200
    assert client.get("/api/health").status_code == 200
    assert client.post("/predict", json={}).status_code == 404
    assert "behavior" not in client.get("/health").get_data(as_text=True).lower()


def test_no_cors_headers_on_the_internal_service(client):
    res = client.get("/health", headers={"Origin": "http://evil.example"})
    assert "Access-Control-Allow-Origin" not in res.headers


def test_annualised_return_is_always_a_number_even_if_the_solver_gives_up(monkeypatch):
    import investment.engine as eng
    monkeypatch.setattr(eng, "annualised_irr", lambda *a, **k: None)
    r = eng.simulate(A, 10000, 12, "months", "mmf", 0, None, "monthly")
    assert isinstance(r["projections"]["annualized_return"], float)
