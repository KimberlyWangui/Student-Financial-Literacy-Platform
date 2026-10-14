"""API tests. All statements are synthetic (see synthetic/personas.py)."""
import json
import os

import pytest

from statement.classify import add_types
from statement.metrics import compute_metrics
from statement.parser import add_row_ids, user_key
from statement.privacy import SAFE_COLUMNS, to_safe_records
from statement.stages import assign_stage, data_quality
from statement_api import create_app
from synthetic.personas import PERSONAS
from synthetic.render_pdf import render_pdf

BY_NAME = {p.name: p for p in PERSONAS}
TOKEN = os.environ["INTERNAL_API_TOKEN"]
H = {"X-Internal-Token": TOKEN}
PW = "pw-test-123"


@pytest.fixture(scope="module")
def client():
    return create_app().test_client()


@pytest.fixture(scope="module")
def pdfs(tmp_path_factory):
    folder = tmp_path_factory.mktemp("pdfs")
    out = {}
    for name in ("steady_saver", "thin_data"):
        path = folder / f"{name}.pdf"
        render_pdf(BY_NAME[name].build(), str(path), PW)
        out[name] = path.read_bytes()
    return out


def post_parse(client, pdf, user="u1", password=PW, headers=H):
    import io
    data = {"user_id": user, "password": password, "file": (io.BytesIO(pdf), "statement.pdf")}
    return client.post("/v1/parse", headers=headers, data=data, content_type="multipart/form-data")


def post_insights(client, body, headers=H):
    return client.post("/v1/insights", headers=headers, json=body)


def records_for(name, user="u1"):
    """Safe transactions for a persona without going through a PDF (fast)."""
    typed = add_row_ids(add_types(BY_NAME[name].build()), user)
    return to_safe_records(typed, user_key(user))


def engine(df):
    typed = add_types(df)
    metrics, _ = compute_metrics(typed)
    return metrics, assign_stage(metrics, data_quality(typed))


# ---- startup, health, authentication ---------------------------------------------
def test_health_needs_no_token(client):
    r = client.get("/v1/health")
    assert r.status_code == 200 and r.get_json()["status"] == "ok"


@pytest.mark.parametrize("headers", [{}, {"X-Internal-Token": "wrong-token-0123456789"}])
def test_requests_without_the_right_token_are_rejected(client, pdfs, headers):
    assert post_parse(client, pdfs["thin_data"], headers=headers).status_code == 401
    assert post_insights(client, {"transactions": []}, headers=headers).status_code == 401


def test_app_refuses_to_start_without_secrets(monkeypatch):
    with pytest.raises(RuntimeError):
        create_app({"INTERNAL_API_TOKEN": "short"})
    monkeypatch.delenv("STATEMENT_HASH_KEY")
    # create_app() calls load_dotenv(), which would put the key back from a real .env
    monkeypatch.setattr("statement_api.load_dotenv", lambda *a, **k: False)
    with pytest.raises(RuntimeError):
        create_app()


# ---- /v1/parse -------------------------------------------------------------------
def test_parse_returns_only_safe_fields(client, pdfs):
    r = post_parse(client, pdfs["steady_saver"])
    assert r.status_code == 200
    j = r.get_json()
    assert j["report"]["rows_parsed"] == len(BY_NAME["steady_saver"].build()) == len(j["transactions"])
    assert j["report"]["balance_breaks"] == 0 and j["report"]["warnings"] == []
    assert all(set(t) == set(SAFE_COLUMNS) for t in j["transactions"])
    assert "unknown_templates" not in j["report"]


def test_parse_response_leaks_no_names_numbers_or_receipts(client, pdfs):
    text = post_parse(client, pdfs["steady_saver"]).get_data(as_text=True)
    for forbidden in ("Test Person", "2547***", "0791***", "SYN0", "Test Shop", "Test Biller", "Test Agent",
                      "Acc.", "details", PW):
        assert forbidden not in text, forbidden


def test_ids_are_stable_for_one_user_and_unlinkable_across_users(client, pdfs):
    a = post_parse(client, pdfs["steady_saver"], user="u1").get_json()["transactions"]
    b = post_parse(client, pdfs["steady_saver"], user="u1").get_json()["transactions"]
    c = post_parse(client, pdfs["steady_saver"], user="u2").get_json()["transactions"]
    assert [t["row_id"] for t in a] == [t["row_id"] for t in b]
    assert not {t["row_id"] for t in a} & {t["row_id"] for t in c}
    assert not {t["receipt_id"] for t in a} & {t["receipt_id"] for t in c}
    pa, pc = {t["payee"] for t in a if t["payee"]}, {t["payee"] for t in c if t["payee"]}
    assert pa and not pa & pc


def test_fee_rows_keep_their_own_row_id_even_when_they_share_a_receipt(client, pdfs):
    txs = post_parse(client, pdfs["steady_saver"]).get_json()["transactions"]
    row_ids = [t["row_id"] for t in txs]
    receipts = [t["receipt_id"] for t in txs]
    assert len(set(row_ids)) == len(row_ids)
    assert len(set(receipts)) < len(receipts)              # a transfer and its fee share a receipt


def test_parse_errors_are_clear_and_safe(client, pdfs):
    r = post_parse(client, pdfs["thin_data"], password="not-the-password")
    assert (r.status_code, r.get_json()["code"]) == (422, "WRONG_PASSWORD")
    assert (post_parse(client, b"hello, not a pdf").status_code, post_parse(client, b"hello").get_json()["code"]) == (400, "NOT_PDF")
    r = post_parse(client, b"%PDF-1.4 this is not really a pdf")
    assert (r.status_code, r.get_json()["code"]) == (422, "UNREADABLE")
    assert post_parse(client, pdfs["thin_data"], user="").get_json()["code"] == "MISSING_USER_ID"
    assert client.post("/v1/parse", headers=H, data={"user_id": "u1"}).get_json()["code"] == "MISSING_FILE"


def test_oversized_upload_is_rejected(pdfs):
    small = create_app({"MAX_CONTENT_LENGTH": 1000}).test_client()
    r = post_parse(small, pdfs["steady_saver"])
    assert (r.status_code, r.get_json()["code"]) == (413, "TOO_LARGE")


# ---- /v1/insights ----------------------------------------------------------------
@pytest.mark.parametrize("name", ["steady_saver", "month_end_squeeze", "fuliza_dependent", "thin_data"])
def test_insights_stage_matches_the_expected_stage(client, name):
    j = post_insights(client, {"transactions": records_for(name)}).get_json()
    assert j["stage"]["stage"] == BY_NAME[name].expected_stage
    assert j["stage"]["next_step"]["title"]


def test_parse_then_insights_matches_running_the_engine_directly(client, pdfs):
    txs = post_parse(client, pdfs["steady_saver"]).get_json()["transactions"]
    j = post_insights(client, {"transactions": txs}).get_json()
    metrics, stage = engine(BY_NAME["steady_saver"].build())
    assert j["stage"]["stage"] == stage["stage"] == "ready_to_explore"
    assert j["stage"]["buffer_days"] == stage["buffer_days"]
    for key in ("inflow", "outflow", "kept", "ending_balance", "net_savings_moved", "savings_return_ratio"):
        assert j["metrics"][key] == pytest.approx(metrics[key])


def test_fuliza_persona_is_reported_as_borrowing(client):
    j = post_insights(client, {"transactions": records_for("fuliza_dependent")}).get_json()
    assert j["stage"]["borrowing"] == "found" and j["metrics"]["fuliza_present"] is True


def test_extra_savings_raises_the_buffer(client):
    txs = records_for("month_end_squeeze")
    base = post_insights(client, {"transactions": txs}).get_json()["stage"]["buffer_days"]
    more = post_insights(client, {"transactions": txs, "extra_savings": 20000}).get_json()["stage"]["buffer_days"]
    assert more > base


def test_insights_rejects_bad_input(client):
    good = records_for("thin_data")
    assert post_insights(client, None).status_code == 400
    assert client.post("/v1/insights", headers=H, data="nope", content_type="text/plain").get_json()["code"] == "BAD_REQUEST"
    assert post_insights(client, {"transactions": []}).get_json()["code"] == "NO_TRANSACTIONS"
    assert post_insights(client, {"transactions": [{"time": "2026-01-01T10:00:00"}]}).get_json()["code"] == "BAD_ROWS"
    assert post_insights(client, {"transactions": [dict(good[0], type="made_up")]}).get_json()["code"] == "BAD_ROWS"
    assert post_insights(client, {"transactions": [dict(good[0], withdrawn=50.0)]}).get_json()["code"] == "BAD_ROWS"
    assert post_insights(client, {"transactions": [dict(good[0], balance="abc")]}).get_json()["code"] == "BAD_ROWS"
    assert post_insights(client, {"transactions": good[::-1]}).get_json()["code"] == "ROWS_NOT_CHRONOLOGICAL"
    assert post_insights(client, {"transactions": good, "extra_savings": -5}).get_json()["code"] == "BAD_REQUEST"
    assert post_insights(client, {"transactions": good, "extra_savings": True}).get_json()["code"] == "BAD_REQUEST"


def test_caller_cannot_override_amount_or_direction(client):
    txs = records_for("thin_data")
    honest = post_insights(client, {"transactions": txs}).get_json()["metrics"]["inflow"]
    tampered = [dict(t, amount=1_000_000.0, direction="in") for t in txs]
    assert post_insights(client, {"transactions": tampered}).get_json()["metrics"]["inflow"] == honest


# ---- failure behaviour -----------------------------------------------------------
def test_unexpected_errors_leak_no_details(client, monkeypatch):
    def boom(df):
        raise RuntimeError("secret row 12345 Test Person A")
    monkeypatch.setattr("api.v1.compute_metrics", boom)
    r = post_insights(client, {"transactions": records_for("thin_data")})
    body = r.get_data(as_text=True)
    assert r.status_code == 500 and json.loads(body)["code"] == "INTERNAL"
    assert "secret row" not in body and "Traceback" not in body and "Test Person" not in body


def test_unknown_routes_return_json(client):
    r = client.get("/v1/nope", headers=H)
    assert r.status_code == 404 and r.get_json()["status"] == "error"
