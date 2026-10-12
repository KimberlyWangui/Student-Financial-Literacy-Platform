"""
PennyWise statement API, version 1. INTERNAL ONLY: it is meant to be called by the Laravel backend, never by a browser.

  GET  /v1/health     liveness check, no authentication
  POST /v1/parse      statement PDF + password + user id  ->  clean, pseudonymised transactions + a parse report
  POST /v1/insights   a user's cleaned transactions       ->  metrics, stage, reasons and next step

The service keeps nothing: the PDF is parsed in memory and never written to disk, the password is used once,
and no raw details text, names, phone numbers or receipt numbers are returned or logged.
"""
import hmac
import io

import numpy as np
import pandas as pd
import pikepdf
from flask import Blueprint, current_app, jsonify, request
from werkzeug.exceptions import HTTPException

from statement import PARSER_VERSION
from statement.classify import RULES, UNVERIFIED_RULES, add_types
from statement.metrics import compute_metrics
from statement.parser import add_row_ids, load, template, to_dataframe, user_key
from statement.privacy import to_safe_records
from statement.stages import assign_stage, data_quality

bp = Blueprint("v1", __name__)

KNOWN_TYPES = {kind for _, kind in RULES + UNVERIFIED_RULES} | {"UNKNOWN"}
KNOWN_FUNDING = {"wallet", "fuliza"}
MAX_ROWS = 20_000

NEXT_STEP_TITLES = {
    "upload_longer_statement": "Upload a longer statement",
    "slow_spending_after_deposits": "Slow down spending after money comes in",
    "build_buffer": "Build a small buffer first",
    "make_saving_consistent": "Make your saving regular",
    "learn_investing_basics": "Learn how saving and investing options compare",
}


# ---- helpers --------------------------------------------------------------
def err(code, message, status):
    return jsonify({"status": "error", "code": code, "message": message}), status


def _clean(obj):
    """Make a structure JSON-safe: numpy scalars become Python ones, NaN and infinity become null."""
    if isinstance(obj, dict):
        return {str(k): _clean(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_clean(v) for v in obj]
    if isinstance(obj, np.generic):
        obj = obj.item()
    if isinstance(obj, float) and not np.isfinite(obj):
        return None
    return obj


class BadInput(Exception):
    def __init__(self, code, message, status=422):
        super().__init__(message)
        self.code, self.message, self.status = code, message, status


# ---- authentication and errors ---------------------------------------------
@bp.before_request
def require_token():
    if request.endpoint == "v1.health":
        return None
    sent = request.headers.get("X-Internal-Token", "")
    expected = current_app.config["INTERNAL_API_TOKEN"]
    if not hmac.compare_digest(sent.encode(), expected.encode()):
        return err("UNAUTHORIZED", "Missing or invalid internal token.", 401)
    return None


@bp.app_errorhandler(BadInput)
def handle_bad_input(e):
    return err(e.code, e.message, e.status)


@bp.app_errorhandler(HTTPException)
def handle_http(e):
    code = "TOO_LARGE" if e.code == 413 else e.name.upper().replace(" ", "_")
    return err(code, e.description, e.code)


@bp.app_errorhandler(Exception)
def handle_unexpected(e):
    # Log only the exception class: messages and tracebacks can contain statement data.
    current_app.logger.error("unexpected %s (parser %s)", type(e).__name__, PARSER_VERSION)
    return err("INTERNAL", "Something went wrong while processing the request.", 500)


# ---- endpoints ------------------------------------------------------------
@bp.get("/v1/health")
def health():
    return jsonify({"status": "ok", "parser_version": PARSER_VERSION})


@bp.post("/v1/parse")
def parse():
    user_id = (request.form.get("user_id") or "").strip()
    password = request.form.get("password", "")
    upload = request.files.get("file")
    if not user_id:
        raise BadInput("MISSING_USER_ID", "Send an opaque user_id so ids are keyed per user.", 400)
    if upload is None:
        raise BadInput("MISSING_FILE", "Send the statement as the multipart field 'file'.", 400)

    data = upload.read()
    if not data.startswith(b"%PDF"):
        raise BadInput("NOT_PDF", "The uploaded file is not a PDF.", 400)

    try:
        rows = load(io.BytesIO(data), password)          # decrypted and parsed in memory only
    except pikepdf.PasswordError:
        raise BadInput("WRONG_PASSWORD", "The statement password is wrong.")
    except Exception as e:                               # corrupt PDF, or a table the parser cannot read
        current_app.logger.warning("unreadable statement: %s (parser %s)", type(e).__name__, PARSER_VERSION)
        raise BadInput("UNREADABLE", "We could not read this statement.")
    if not rows:
        raise BadInput("NO_TRANSACTIONS", "No transaction rows were found. The statement layout may have changed.")

    try:
        df = to_dataframe(rows)
    except ValueError:
        raise BadInput("LAYOUT_CHANGED", "The statement layout is different from what the parser expects.")
    if df["time"].isna().any():
        raise BadInput("LAYOUT_CHANGED", "Some transaction dates could not be read.")

    typed = add_row_ids(add_types(df), user_id)

    expected = typed["balance"].shift(1) + typed["paid_in"] + typed["withdrawn"]
    breaks = int(((expected - typed["balance"]).abs() > 0.01).iloc[1:].sum())
    dq = data_quality(typed)
    duplicates = int(typed["row_id"].duplicated().sum())
    not_completed = int((typed["status"] != "Completed").sum())

    warnings = []
    if breaks:
        warnings.append("BALANCE_BREAKS")
    if dq["unknown_volume_share"] > 0.02:
        warnings.append("UNREADABLE_PART")
    if dq["unverified_rows"]:
        warnings.append("UNVERIFIED_ROWS")
    if duplicates:
        warnings.append("DUPLICATE_ROW_IDS")
    if not_completed:
        warnings.append("NON_COMPLETED_ROWS")

    report = {
        "parser_version": PARSER_VERSION,
        "rows_parsed": int(len(typed)),
        "period": {"start": typed["time"].min().isoformat(), "end": typed["time"].max().isoformat()},
        "balance_breaks": breaks,
        "unknown_rows": dq["unknown_rows"],
        "unknown_volume_share": dq["unknown_volume_share"],
        "unverified_rows": dq["unverified_rows"],
        "duplicate_row_ids": duplicates,
        "non_completed_rows": not_completed,
        "warnings": warnings,
    }
    if current_app.config.get("PARSE_DEBUG_TEMPLATES"):    # off by default: templates can still hold a stray name
        unknown = typed.loc[typed["type"] == "UNKNOWN", "details"].map(template)
        report["unknown_templates"] = unknown.value_counts().to_dict()

    current_app.logger.info("parsed %d rows (parser %s, %d warnings)", len(typed), PARSER_VERSION, len(warnings))
    return jsonify(_clean({"status": "ok", "report": report,
                           "transactions": to_safe_records(typed, user_key(user_id))}))


def frame_from_transactions(rows):
    """Validate the transactions sent to /v1/insights and rebuild the DataFrame the engine expects."""
    if not isinstance(rows, list) or not rows:
        raise BadInput("NO_TRANSACTIONS", "Send a non-empty 'transactions' list.", 400)
    if len(rows) > MAX_ROWS:
        raise BadInput("TOO_MANY_ROWS", f"At most {MAX_ROWS} transactions per request.", 413)
    if not all(isinstance(r, dict) for r in rows):
        raise BadInput("BAD_ROWS", "Every transaction must be an object.", 400)

    df = pd.DataFrame(rows)
    missing = [c for c in ("time", "type", "funding", "paid_in", "withdrawn", "balance") if c not in df.columns]
    if missing:
        raise BadInput("BAD_ROWS", f"Missing fields: {', '.join(missing)}", 400)

    for col in ("paid_in", "withdrawn", "balance"):
        df[col] = pd.to_numeric(df[col], errors="coerce")
    if df[["paid_in", "withdrawn", "balance"]].isna().any().any():
        raise BadInput("BAD_ROWS", "paid_in, withdrawn and balance must be numbers.")
    if (df["paid_in"] < 0).any() or (df["withdrawn"] > 0).any():
        raise BadInput("BAD_ROWS", "paid_in must be >= 0 and withdrawn must be <= 0 (withdrawals are negative).")
    if not df["type"].isin(KNOWN_TYPES).all():
        raise BadInput("BAD_ROWS", "Unknown transaction type.")
    if not df["funding"].isin(KNOWN_FUNDING).all():
        raise BadInput("BAD_ROWS", "funding must be 'wallet' or 'fuliza'.")

    t = pd.to_datetime(df["time"], errors="coerce")
    if t.isna().any():
        raise BadInput("BAD_ROWS", "Some times could not be read as ISO date-times.")
    if getattr(t.dt, "tz", None) is not None:
        t = t.dt.tz_convert("Africa/Nairobi").dt.tz_localize(None)
    df["time"] = t
    if not df["time"].is_monotonic_increasing:
        raise BadInput("ROWS_NOT_CHRONOLOGICAL", "Send transactions oldest first, in the order /v1/parse returned them.")

    df["amount"] = df["paid_in"] + df["withdrawn"].abs()          # recomputed, never trusted from the caller
    df["direction"] = "none"
    df.loc[df["paid_in"] > 0, "direction"] = "in"
    df.loc[df["withdrawn"] != 0, "direction"] = "out"
    return df.reset_index(drop=True)


@bp.post("/v1/insights")
def insights():
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        raise BadInput("BAD_REQUEST", "Send a JSON object.", 400)
    extra = body.get("extra_savings", 0)
    if isinstance(extra, bool) or not isinstance(extra, (int, float)) or extra < 0:
        raise BadInput("BAD_REQUEST", "extra_savings must be a number >= 0.", 400)

    df = frame_from_transactions(body.get("transactions"))
    metrics, monthly = compute_metrics(df)
    dq = data_quality(df)
    stage = assign_stage(metrics, dq, float(extra))

    next_id = stage["next_step"]
    return jsonify(_clean({
        "status": "ok",
        "parser_version": PARSER_VERSION,
        "metrics": metrics,
        "monthly_flows": [{"month": str(m), "in": row["in"], "out": row["out"]} for m, row in monthly.iterrows()],
        "data_quality": dq,
        "stage": {
            "stage": stage["stage"],
            "confidence": stage["confidence"],
            "borrowing": stage["borrowing"],
            "buffer_days": stage["buffer_days"],
            "reasons": stage["reasons"],
            "notes": stage["notes"],
            "next_step": {"id": next_id, "title": NEXT_STEP_TITLES[next_id]},
        },
    }))
