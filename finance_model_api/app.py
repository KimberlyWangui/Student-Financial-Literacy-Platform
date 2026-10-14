"""
PennyWise investment simulator API (port 5000).

Called only by the Laravel backend, never by the browser, so it has no CORS and returns no internals.
The statement analysis service is a separate app (statement_api.py).

"""
import logging
import math

from flask import Flask, jsonify, request

from investment import ALLOWED_FREQUENCIES, load_assumptions, simulate, statistics_for_display
from investment.engine import MAX_MONTHS

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("pennywise.investment")

app = Flask(__name__)

# Fail loudly at start-up if the assumptions file is missing or malformed.
ASSUMPTIONS = load_assumptions()
VALID_TYPES = tuple(ASSUMPTIONS["assets"].keys())
MAX_AMOUNT = 999_999_999.99


class BadInput(Exception):
    pass


def _number(data, field, *, required=False, default=None, minimum=None, maximum=MAX_AMOUNT, integer=False):
    """Read a finite number from the JSON body or raise BadInput with a message a student could read."""
    value = data.get(field)
    if value is None or value == "":
        if required:
            raise BadInput(f"Missing required field: {field}")
        return default
    if isinstance(value, bool):
        raise BadInput(f"{field} must be a number")
    try:
        number = float(value)
    except (TypeError, ValueError):
        raise BadInput(f"{field} must be a number")
    if not math.isfinite(number):
        raise BadInput(f"{field} must be a number")
    if integer:
        if number != int(number):
            raise BadInput(f"{field} must be a whole number")
        number = int(number)
    if minimum is not None and number < minimum:
        raise BadInput(f"{field} is too small")
    if maximum is not None and number > maximum:
        raise BadInput(f"{field} is too large")
    return number


def _error(message, status=400):
    return jsonify({"status": "error", "message": message}), status


@app.route("/api/investment/simulate", methods=["POST"])
def simulate_investment():
    data = request.get_json(silent=True)
    if not isinstance(data, dict) or not data:
        return _error("No JSON data received")

    try:
        investment_type = str(data.get("investment_type", "")).strip().lower()
        if not investment_type:
            raise BadInput("Missing required field: investment_type")
        if investment_type not in VALID_TYPES:
            raise BadInput(f"Invalid investment type. Must be one of: {', '.join(VALID_TYPES)}")

        amount = _number(data, "amount_invested", required=True)
        if amount <= 0:
            raise BadInput("Amount invested must be greater than 0")

        duration_value = _number(data, "duration_value", required=True, integer=True)
        if duration_value <= 0:
            raise BadInput("Duration must be greater than 0")

        unit = str(data.get("duration_unit") or "months").strip().lower()
        if unit not in ("months", "years"):
            raise BadInput('Duration unit must be "months" or "years"')
        if duration_value * (12 if unit == "years" else 1) > MAX_MONTHS:
            raise BadInput("Duration cannot be longer than 50 years")

        topup = _number(data, "monthly_topup", default=0.0)
        if topup < 0:
            raise BadInput("Monthly top-up cannot be negative")

        target = _number(data, "target_amount", default=None)
        if target is not None and target <= 0:
            target = None
        if target is not None and target < amount:
            raise BadInput("Target amount must be greater than initial investment")

        frequency = str(data.get("reinvestment_frequency") or "monthly").strip().lower()
        if frequency not in ALLOWED_FREQUENCIES:
            raise BadInput(f"Compounding frequency must be one of: {', '.join(ALLOWED_FREQUENCIES)}")
    except BadInput as e:
        return _error(str(e))

    try:
        result = simulate(
            ASSUMPTIONS, amount_invested=amount, duration_value=duration_value, duration_unit=unit,
            investment_type=investment_type, monthly_topup=topup, target_amount=target,
            reinvestment_frequency=frequency,
        )
    except Exception:
        log.exception("investment simulation failed")
        return _error("The simulation could not be completed.", 500)

    log.info("simulation type=%s months=%s", investment_type, result["investment_details"]["duration_months"])
    return jsonify({"status": "success", "data": result}), 200


@app.route("/api/investment/statistics", methods=["GET"])
def investment_statistics():
    return jsonify({
        "status": "success",
        "data": {
            "investment_types": statistics_for_display(ASSUMPTIONS),
            "metadata": {
                "currency": ASSUMPTIONS["metadata"]["currency"],
                "last_reviewed": ASSUMPTIONS["metadata"].get("last_reviewed"),
                "disclaimer": ASSUMPTIONS["metadata"]["disclaimer"],
            },
        },
    }), 200


@app.route("/health", methods=["GET"])
@app.route("/api/health", methods=["GET"])
def health_check():
    return jsonify({"status": "healthy", "investment_assumptions": sorted(VALID_TYPES)})


if __name__ == "__main__":
    print("PennyWise investment simulator on http://127.0.0.1:5000")
    print("  POST /api/investment/simulate")
    print("  GET  /api/investment/statistics")
    print("  GET  /health")
    app.run(host="127.0.0.1", port=5000, debug=False)
