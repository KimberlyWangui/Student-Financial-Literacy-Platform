import pandas as pd
from .parser import fix_ties


def coverage(frames):
    return [{"source": int(f["source"].iloc[0]), "start": f["time"].min(),
             "end": f["time"].max(), "rows": int(len(f))} for f in frames]


def overlaps(frames):
    """For each pair of statements that overlap, both should hold the same rows in the shared window."""
    out = []
    for i in range(len(frames)):
        for j in range(i + 1, len(frames)):
            a, b = frames[i], frames[j]
            lo = max(a["time"].min(), b["time"].min())
            hi = min(a["time"].max(), b["time"].max())
            if lo <= hi:
                na, nb = int(a["time"].between(lo, hi).sum()), int(b["time"].between(lo, hi).sum())
                out.append({"pair": (i, j), "from": str(lo), "to": str(hi),
                            "rows_a": na, "rows_b": nb, "equal": na == nb})
    return out


def gaps(cov, min_days=1):
    """Stretches not covered by any statement (a quiet stretch can look like a gap; the balance check tells them apart)."""
    cov = sorted(cov, key=lambda c: c["start"])
    out, current_end = [], cov[0]["end"]
    for c in cov[1:]:
        if c["start"] - current_end > pd.Timedelta(days=min_days):
            out.append({"from": str(current_end), "to": str(c["start"]),
                        "days": int((c["start"] - current_end).days)})
        current_end = max(current_end, c["end"])
    return out


def chain_breaks(df):
    expected = df["balance"].shift(1) + df["paid_in"] + df["withdrawn"]
    bad = (expected - df["balance"]).abs() > 0.01
    return df.loc[bad, "time"].astype(str).tolist()


def merge_statements(frames):
    """frames: DataFrames from to_dataframe() + add_row_ids(). Returns (merged, report)."""
    tagged = []
    for i, f in enumerate(frames):
        f = f.copy()
        f["source"] = i
        tagged.append(f)

    combined = pd.concat(tagged, ignore_index=True)
    rows_in = len(combined)
    combined = combined.drop_duplicates(subset="row_id", keep="first")
    merged = fix_ties(combined.sort_values("time", kind="stable").reset_index(drop=True))

    cov = coverage(tagged)
    report = {
        "statements": len(frames),
        "rows_in": rows_in,
        "duplicates_removed": rows_in - len(merged),
        "rows_merged": len(merged),
        "key_duplicates_within_statement": int(sum(f["row_id"].duplicated().sum() for f in tagged)),
        "rows_sharing_receipt": [int(f["receipt_id"].duplicated(keep=False).sum()) for f in tagged],
        "coverage": cov,
        "overlaps": overlaps(tagged),
        "gaps": gaps(cov),
    }
    return merged, report