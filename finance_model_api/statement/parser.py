import io
import re
from itertools import permutations
import hashlib
import hmac
import os

import pikepdf
import pdfplumber
import pandas as pd
from dotenv import load_dotenv

COLUMNS = ["receipt", "time", "details", "status", "paid_in", "withdrawn", "balance"]
DATE_RE = re.compile(r"\d{4}-\d{2}-\d{2}")


def load(path, password):
    """Decrypt the PDF in memory; return detailed-statement rows, oldest first."""
    with pikepdf.open(path, password=password) as pdf:
        buf = io.BytesIO()
        pdf.save(buf)
        buf.seek(0)

    rows = []
    with pdfplumber.open(buf) as doc:
        for page in doc.pages:
            for table in page.extract_tables():
                for r in table:
                    if r and len(r) > 1 and DATE_RE.match(r[1] or ""):
                        rows.append(r)
    # The statement is newest-first, so reverse it. Rows sharing a second
    # may still be mis-ordered; fix_ties() resolves that using the balances.
    return rows[::-1]


def num(x):
    x = (x or "").replace(",", "").strip()
    return float(x) if x else 0.0


def template(details):
    """Cut everything from the first long number onward, so names are dropped."""
    return re.sub(r"[\d\*]{6,}.*", "<NUM>", details)


def fix_ties(df):
    """Within groups of rows sharing a timestamp, pick the order that keeps the balance chain intact."""
    df = df.reset_index(drop=True)
    order, prev_bal, i = [], None, 0
    while i < len(df):
        j = i
        while j + 1 < len(df) and df.at[j + 1, "time"] == df.at[i, "time"]:
            j += 1
        group = list(range(i, j + 1))
        if 1 < len(group) <= 6 and prev_bal is not None:
            for perm in permutations(group):          # the original order is tried first
                bal, ok = prev_bal, True
                for k in perm:
                    bal = round(bal + df.at[k, "paid_in"] + df.at[k, "withdrawn"], 2)
                    if abs(bal - df.at[k, "balance"]) > 0.01:
                        ok = False
                        break
                if ok:
                    group = list(perm)
                    break
        order += group
        prev_bal = df.at[group[-1], "balance"]
        i = j + 1
    return df.loc[order].reset_index(drop=True)


def to_dataframe(rows):
    """Raw rows -> clean, chronological DataFrame with same-second ties resolved."""
    if any(len(r) != len(COLUMNS) for r in rows):
        raise ValueError(f"Expected {len(COLUMNS)} cells per row; the statement layout may have changed.")
    df = pd.DataFrame(rows, columns=COLUMNS)
    for c in ["paid_in", "withdrawn", "balance"]:
        df[c] = df[c].map(num)
    df["details"] = df["details"].fillna("").str.replace("\n", " ", regex=False)
    df["time"] = pd.to_datetime(df["time"], errors="coerce")
    return fix_ties(df)

def _hash_key():
    load_dotenv()
    key = os.environ.get("STATEMENT_HASH_KEY")
    if not key:
        raise RuntimeError("Set STATEMENT_HASH_KEY to a long random string before merging statements.")
    return key.encode()


def _h(key, text):
    return hmac.new(key, text.encode(), hashlib.sha256).hexdigest()[:20]

def user_key(user_id=None):
    """Hashing key for one user, derived from the server secret."""
    if user_id is None:
        return _hash_key()
    return hmac.new(_hash_key(), f"user:{user_id}".encode(), hashlib.sha256).digest()

def add_row_ids(df, user_id=None):
    """receipt_id: keyed hash of the receipt alone (NOT unique; a transfer and its fee can share one).
    row_id: keyed hash of receipt + time + amounts + balance (unique per row).
    The raw receipt number is dropped afterwards."""
    key = user_key(user_id)
    df = df.copy()
    df["receipt_id"] = df["receipt"].map(lambda r: _h(key, str(r)))
    df["row_id"] = [
        _h(key, f"{r}|{t}|{pi:.2f}|{w:.2f}|{b:.2f}")
        for r, t, pi, w, b in zip(df["receipt"], df["time"], df["paid_in"], df["withdrawn"], df["balance"])
    ]
    return df.drop(columns=["receipt"])