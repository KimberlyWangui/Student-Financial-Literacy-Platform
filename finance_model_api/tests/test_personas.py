"""Persona tests. All data is synthetic (see synthetic/personas.py)."""
import pytest

from statement.classify import add_types
from statement.metrics import compute_metrics
from statement.parser import load, to_dataframe
from statement.stages import assign_stage, data_quality
from synthetic.personas import PERSONAS
from synthetic.render_pdf import render_pdf

BY_NAME = {p.name: p for p in PERSONAS}
SEEDS = range(100, 108)          # a few seeds each, so a pass is not a lucky draw
PASSWORD = "test1234"


def analyse(df):
    typed = add_types(df)
    metrics, _ = compute_metrics(typed)
    return typed, metrics, assign_stage(metrics, data_quality(typed))


def chain_breaks(df):
    expected = df["balance"].shift(1) + df["paid_in"] + df["withdrawn"]
    return int(((expected - df["balance"]).abs() > 0.01).iloc[1:].sum())


@pytest.mark.parametrize("persona", PERSONAS, ids=lambda p: p.name)
def test_expected_stage_across_seeds(persona):
    for seed in SEEDS:
        _, _, stage = analyse(persona.build(seed))
        assert stage["stage"] == persona.expected_stage, f"seed {seed}"


@pytest.mark.parametrize("persona", PERSONAS, ids=lambda p: p.name)
def test_generated_statement_is_consistent(persona):
    df = persona.build()
    assert chain_breaks(df) == 0
    assert (add_types(df)["type"] != "UNKNOWN").all()
    assert (df["balance"] >= 0).all()


def test_fuliza_persona_is_flagged_as_borrowing():
    _, metrics, stage = analyse(BY_NAME["fuliza_dependent"].build())
    assert metrics["fuliza_present"] and metrics["fuliza_repayment_count"] > 0
    assert stage["borrowing"] == "found"


def test_cash_heavy_is_flagged_as_low_visibility():
    _, metrics, stage = analyse(BY_NAME["cash_heavy"].build())
    assert metrics["cash_out_share"] >= 0.4
    assert stage["confidence"] == "low"
    assert any("cash withdrawals" in n for n in stage["notes"])


def test_sponsor_lumps_do_not_look_like_stress():
    _, metrics, stage = analyse(BY_NAME["sponsor_lumps"].build())
    assert metrics["top5_outflow_share"] > 0.4          # lumps dominate the outflow...
    assert stage["stage"] != "short_of_cash"            # ...but the typical-spending measures stay robust


def test_leaky_saver_is_caught_by_the_leak_ratio():
    _, metrics, _ = analyse(BY_NAME["leaky_saver"].build())
    assert metrics["savings_return_ratio"] >= 0.8


def test_steady_saver_keeps_most_of_what_it_saves():
    _, metrics, _ = analyse(BY_NAME["steady_saver"].build())
    assert metrics["savings_return_ratio"] < 0.8 and metrics["net_savings_moved"] > 0


def test_pdf_round_trip_is_lossless(tmp_path):
    original = BY_NAME["steady_saver"].build()           # includes wrapped Ziidi text and shared-receipt fee rows
    path = tmp_path / "persona.pdf"
    render_pdf(original, str(path), PASSWORD)
    parsed = to_dataframe(load(str(path), PASSWORD))
    assert len(parsed) == len(original)
    assert (parsed["details"].values == original["details"].values).all()
    assert ((parsed["balance"] - original["balance"]).abs() < 0.005).all()
    assert chain_breaks(parsed) == 0
