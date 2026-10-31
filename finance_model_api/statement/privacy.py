"""
Turns parsed statement rows into the minimal, pseudonymised records that are allowed to leave the parser.

What leaves: time, type, funding, direction, amounts, balance, a keyed row id, a keyed receipt id,
a per-user payee pseudonym and (for shops and billers) the public till or paybill number.
What never leaves: the raw details text, names, phone numbers, receipt numbers, paybill account numbers.
"""
import hashlib
import hmac
import re

import pandas as pd

# Details templates that name a person or private party. Everything after the template prefix is dropped
# and only a keyed hash of it is kept, so the same payee gets the same pseudonym within one user's data.
PAYEE_PATTERNS = [
    re.compile(r"^Customer Transfer(?: Fuliza M-Pesa)? to - (?P<p>.+)$"),
    re.compile(r"^Funds received from - (?P<p>.+)$"),
    re.compile(r"^Customer Payment to Small Business to - (?P<p>.+)$"),
    re.compile(r"^Send Money Reversal via API from - (?P<p>.+)$"),
    re.compile(r"^Recharge for Customer to (?P<p>.+)$"),
    re.compile(r"^Offnet C2B Transfer to (?P<p>.+)$"),
    re.compile(r"^Business Payment from (?P<p>.+)$"),
    re.compile(r"^Transfer from Bank (?P<p>.+)$"),
]

# Public business identifiers (till and paybill numbers). The name and any account number after them are dropped.
MERCHANT_PATTERNS = [
    re.compile(r"^Merchant Payment(?: Fuliza M-Pesa)?(?: Online)? to (?P<m>\d{4,8})"),
    re.compile(r"^(?:Card )?Pay Bill(?: Online)?(?: Fuliza M-Pesa)? to (?P<m>\d{4,8})"),
    re.compile(r"^Customer Bundle Purchase(?: with Fuliza)? to (?P<m>\d{4,8})"),
]


def _normalise(text):
    return re.sub(r"\s+", " ", text).strip().lower()


def payee_id(details, key):
    """Per-user pseudonym such as 'p_3fa91c02b7', or None when the row has no private counterparty."""
    for pat in PAYEE_PATTERNS:
        m = pat.match(details)
        if m:
            digest = hmac.new(key, ("payee:" + _normalise(m.group("p"))).encode(), hashlib.sha256).hexdigest()
            return "p_" + digest[:10]
    return None


def merchant_id(details):
    for pat in MERCHANT_PATTERNS:
        m = pat.match(details)
        if m:
            return m.group("m")
    return None


SAFE_COLUMNS = ["row_id", "receipt_id", "time", "type", "funding", "direction",
                "amount", "paid_in", "withdrawn", "balance", "payee", "merchant_id"]


def to_safe_records(df, key):
    """df: output of to_dataframe + add_types + add_row_ids (still holds the details text).
    Returns a list of plain dicts containing only SAFE_COLUMNS."""
    out = df.copy()
    out["payee"] = out["details"].map(lambda d: payee_id(d, key))
    out["merchant_id"] = out["details"].map(merchant_id)
    out["time"] = out["time"].map(lambda t: t.isoformat())
    out = out[SAFE_COLUMNS].astype(object).where(out[SAFE_COLUMNS].notna(), None)
    return out.to_dict(orient="records")
