"""
Investment simulation engine for PennyWise.

What it does, in plain terms:
  * Projects one steady growth path (the "projection") using the asset's expected return, after tax.
  * Runs a Monte Carlo of many possible paths to show how wide the outcomes could be.
  * Reports the annualised return as an IRR, which stays correct when money is added every month.

Conventions (kept from the first version so saved simulations still make sense):
  * The starting amount grows for month 1. A monthly top-up is added at the START of months 2, 3, ...
  * Compounding frequency spreads the same effective rate smoothly across months.
  * Tax is applied as withholding on the interest or gain each period (a flat rate on positive returns).

All inputs live in assumptions.json so they can be updated without touching code.
"""
import hashlib
import json
import math
import os
from datetime import datetime

import numpy as np

ALLOWED_FREQUENCIES = ("monthly", "quarterly", "annually")
ALLOWED_RISK_LEVELS = ("very_low", "low", "medium", "high")
PERIODS_PER_YEAR = {"monthly": 12, "quarterly": 4, "annually": 1}
MAX_MONTHS = 600           # 50 years, same cap as the Laravel validation
N_SIMULATIONS = 5000

_REQUIRED_ASSET_FIELDS = (
    "name", "description", "recommended_duration", "annual_return", "volatility",
    "tax_rate", "risk_level", "as_of", "source",
)

_DEFAULT_PATH = os.path.join(os.path.dirname(__file__), "assumptions.json")


# --------------------------------------------------------------------------------------
# Assumptions
# --------------------------------------------------------------------------------------
def load_assumptions(path=None):
    """Read and validate the assumptions file. Raises ValueError with a clear message if it is wrong."""
    with open(path or _DEFAULT_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    if "metadata" not in data or "assets" not in data:
        raise ValueError("assumptions file needs 'metadata' and 'assets'")
    for key in ("currency", "disclaimer"):
        if not data["metadata"].get(key):
            raise ValueError(f"metadata.{key} is missing")

    for name, a in data["assets"].items():
        for field in _REQUIRED_ASSET_FIELDS:
            if field not in a:
                raise ValueError(f"asset '{name}' is missing '{field}'")
        if not 0 <= a["tax_rate"] < 1:
            raise ValueError(f"asset '{name}': tax_rate must be between 0 and 1 (for example 0.15)")
        if a["volatility"] < 0:
            raise ValueError(f"asset '{name}': volatility cannot be negative")
        if a["risk_level"] not in ALLOWED_RISK_LEVELS:
            raise ValueError(f"asset '{name}': risk_level must be one of {ALLOWED_RISK_LEVELS}")
        if a["annual_return"] <= -100:
            raise ValueError(f"asset '{name}': annual_return must be above -100")
    return data


# --------------------------------------------------------------------------------------
# Core maths
# --------------------------------------------------------------------------------------
def _monthly_factor(annual_rate_pct, frequency):
    """Growth factor for one month. The rate is spread smoothly across the compounding periods."""
    n = PERIODS_PER_YEAR[frequency]
    return (1 + (annual_rate_pct / 100) / n) ** (n / 12)


def _after_tax_rate(annual_rate_pct, tax_rate):
    """Tax is taken from positive interest or gains only, so the net rate is rate x (1 - tax)."""
    return annual_rate_pct * (1 - tax_rate) if annual_rate_pct > 0 else annual_rate_pct


def project(principal, topup, factor, months):
    """Month-by-month path. Returns a list of (month, value, contributions_to_date)."""
    value = principal
    contributed = principal
    rows = []
    for m in range(1, months + 1):
        if m > 1:
            value += topup
            contributed += topup
        value *= factor
        rows.append((m, value, contributed))
    return rows


def annualised_irr(principal, topup, months, final_value):
    """
    Money-weighted annual return: the single yearly rate that turns the actual deposits into the
    final value. (Dividing final value by total invested, as the first version did, ignores that
    top-ups arrive late and so understates the return.)
    """
    total_in = principal + topup * max(months - 1, 0)
    if final_value <= 0 or total_in <= 0:
        return None

    def fv(i):
        # principal for `months` months, each top-up from the start of month m for months-m+1 months
        total = principal * (1 + i) ** months
        for m in range(2, months + 1):
            total += topup * (1 + i) ** (months - m + 1)
        return total

    lo, hi = -0.99, 1.0
    if fv(lo) > final_value or fv(hi) < final_value:
        return None
    for _ in range(100):
        mid = (lo + hi) / 2
        if fv(mid) < final_value:
            lo = mid
        else:
            hi = mid
    monthly = (lo + hi) / 2
    return ((1 + monthly) ** 12 - 1) * 100


def months_to_target(principal, topup, factor, target, max_months=MAX_MONTHS):
    """Months until the after-tax value first reaches the target, using the same rules as project()."""
    if principal >= target:
        return 0
    value = principal
    for m in range(1, max_months + 1):
        if m > 1:
            value += topup
        value *= factor
        if value >= target:
            return m
    return None


def _seed_for(params):
    """Same inputs always give the same random paths, so a preview and the saved copy match."""
    blob = json.dumps(params, sort_keys=True, default=str).encode()
    return int.from_bytes(hashlib.sha256(blob).digest()[:8], "big")


def monte_carlo(principal, topup, annual_rate_pct, volatility_pct, tax_rate, months, frequency,
                total_invested, n=N_SIMULATIONS, seed=0):
    """
    Many possible paths. Monthly returns are log-normal, so a month can never lose more than 100%
    and the average monthly return matches the expected return. Tax is withheld from positive months.
    """
    mu = _monthly_factor(annual_rate_pct, frequency) - 1
    sigma = (volatility_pct / 100) / math.sqrt(12)
    rng = np.random.default_rng(seed)

    if sigma == 0:
        returns = np.full((n, months), mu)
    else:
        v = math.log(1 + (sigma / (1 + mu)) ** 2)
        m = math.log(1 + mu) - v / 2
        returns = np.exp(rng.normal(m, math.sqrt(v), size=(n, months))) - 1

    returns = np.where(returns > 0, returns * (1 - tax_rate), returns)

    values = np.full(n, float(principal))
    for month in range(1, months + 1):
        if month > 1:
            values = values + topup
        values = values * (1 + returns[:, month - 1])

    return {
        "best_case": round(float(np.percentile(values, 95)), 2),
        "worst_case": round(float(np.percentile(values, 5)), 2),
        "median_case": round(float(np.median(values)), 2),
        "mean_case": round(float(np.mean(values)), 2),
        "range_low": round(float(np.percentile(values, 2.5)), 2),
        "range_high": round(float(np.percentile(values, 97.5)), 2),
        "probability_of_loss": round(float(np.mean(values < total_invested - 0.005)) * 100, 1),
    }


# --------------------------------------------------------------------------------------
# Public entry points
# --------------------------------------------------------------------------------------
def simulate(assumptions, amount_invested, duration_value, duration_unit="months",
             investment_type="mmf", monthly_topup=0.0, target_amount=None,
             reinvestment_frequency="monthly", simulations=N_SIMULATIONS):
    """Run one simulation and return the JSON-ready result. Inputs are expected to be validated by the caller."""
    asset = assumptions["assets"][investment_type]
    meta = assumptions["metadata"]

    months = int(duration_value * 12 if duration_unit == "years" else duration_value)
    gross_rate = asset["annual_return"]
    tax = asset["tax_rate"]
    net_rate = _after_tax_rate(gross_rate, tax)

    gross_factor = _monthly_factor(gross_rate, reinvestment_frequency)
    net_factor = _monthly_factor(net_rate, reinvestment_frequency)

    path = project(amount_invested, monthly_topup, net_factor, months)
    gross_path = project(amount_invested, monthly_topup, gross_factor, months)
    final_value = path[-1][1]
    total_invested = path[-1][2]
    gross_final = gross_path[-1][1]
    growth = final_value - total_invested

    irr = annualised_irr(amount_invested, monthly_topup, months, final_value)
    if irr is None:   # never expected, but the database column must always get a number
        irr = ((final_value / total_invested) ** (12 / months) - 1) * 100

    seed = _seed_for([investment_type, amount_invested, months, monthly_topup, reinvestment_frequency,
                      gross_rate, asset["volatility"], tax])
    mc = monte_carlo(amount_invested, monthly_topup, gross_rate, asset["volatility"], tax, months,
                     reinvestment_frequency, total_invested, n=simulations, seed=seed)

    goal = None
    if target_amount and target_amount > amount_invested:
        needed = months_to_target(amount_invested, monthly_topup, net_factor, target_amount)
        if needed is None:
            goal = {
                "months_needed": None, "achievable": False, "reached_within_duration": False,
                "message": "Target not reachable with these numbers within 50 years.",
            }
        else:
            years, rem = divmod(needed, 12)
            within = needed <= months
            goal = {
                "months_needed": needed, "years": years, "remaining_months": rem,
                "achievable": True, "reached_within_duration": within,
                "message": (
                    f"At the expected return, you reach this target in about {years} years and {rem} months."
                    + ("" if within else " That is longer than the period you chose.")
                ),
            }

    return {
        "simulation_id": f"SIM_{datetime.now().strftime('%Y%m%d%H%M%S')}",
        "timestamp": datetime.now().isoformat(),
        "disclaimer": meta["disclaimer"],

        "investment_details": {
            "investment_type": investment_type,
            "amount_invested": amount_invested,
            "duration_value": duration_value,
            "duration_unit": duration_unit,
            "duration_months": months,
            "monthly_topup": monthly_topup,
            "reinvestment_frequency": reinvestment_frequency,
            "target_amount": target_amount,
        },

        # Headline numbers are AFTER tax: what the student would actually keep.
        "projections": {
            "projected_final_value": round(final_value, 2),
            "total_invested": round(total_invested, 2),
            "total_growth": round(growth, 2),
            "percentage_return": round(growth / total_invested * 100, 2),
            "annualized_return": None if irr is None else round(irr, 2),
            "gross_final_value": round(gross_final, 2),
            "tax_paid": round(gross_final - final_value, 2),
            "after_tax": True,
        },

        "risk_analysis": {
            "risk_level": asset["risk_level"],
            "volatility": asset["volatility"],
            "best_case_scenario": mc["best_case"],
            "worst_case_scenario": mc["worst_case"],
            "median_scenario": mc["median_case"],
            # Kept under the old key names. They are the middle 95% of simulated outcomes.
            "confidence_95_lower": mc["range_low"],
            "confidence_95_upper": mc["range_high"],
            "probability_of_loss": mc["probability_of_loss"],
            "simulations": simulations,
        },

        "timeline": [
            {
                "month": m,
                "value": round(v, 2),
                "contributions_to_date": round(c, 2),
                "growth": round(v - c, 2),
            }
            for m, v, c in path
        ],

        "goal_analysis": goal,

        "model_parameters": {
            "average_annual_return": gross_rate,
            "after_tax_annual_return": round(net_rate, 2),
            "historical_volatility": asset["volatility"],
            "tax_rate": tax,
            "currency": meta["currency"],
            "data_period": asset["as_of"],
            "source": asset["source"],
            "needs_review": bool(asset.get("needs_review", False)),
            "notes": asset.get("notes", []),
            "calculation_method": "after_tax_compound_projection_with_lognormal_monte_carlo",
        },
    }


def statistics_for_display(assumptions):
    """The list the Explore tab shows. Old field names are kept so the page keeps working."""
    out = []
    for key in ("mmf", "tbill", "stock", "bond"):
        a = assumptions["assets"].get(key)
        if not a:
            continue
        out.append({
            "type": key,
            "name": a["name"],
            "description": a["description"],
            "average_return": round(a["annual_return"], 2),
            "after_tax_return": round(_after_tax_rate(a["annual_return"], a["tax_rate"]), 2),
            "tax_rate": a["tax_rate"],
            "risk_level": a["risk_level"],
            "volatility": round(a["volatility"], 2),
            "min_expected_return": a.get("range_low"),
            "max_expected_return": a.get("range_high"),
            "range_label": a.get("range_label", ""),
            "recommended_duration": a["recommended_duration"],
            "as_of": a["as_of"],
            "source": a["source"],
            "needs_review": bool(a.get("needs_review", False)),
            "notes": a.get("notes", []),
        })
    return out
