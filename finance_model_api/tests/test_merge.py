import os
import pandas as pd

os.environ.setdefault("STATEMENT_HASH_KEY", "test-key-not-secret")

from statement.parser import add_row_ids
from statement.merge import merge_statements, chain_breaks


def rows(spec):
    return pd.DataFrame([{"receipt": r, "time": pd.Timestamp(t), "details": "x", "status": "Completed",
                          "paid_in": pi, "withdrawn": w, "balance": b} for r, t, pi, w, b in spec])


A = rows([
    ("R1", "2025-10-01 10:00:00", 1000.0, 0.0, 1000.0),
    ("R2", "2025-10-02 10:00:00", 0.0, -100.0, 900.0),   # a transfer...
    ("R2", "2025-10-02 10:00:00", 0.0, -5.0, 895.0),     # ...and its fee, sharing the receipt
    ("R3", "2025-10-03 10:00:00", 0.0, -50.0, 845.0),
])
B = rows([
    ("R2", "2025-10-02 10:00:00", 0.0, -100.0, 900.0),
    ("R2", "2025-10-02 10:00:00", 0.0, -5.0, 895.0),
    ("R3", "2025-10-03 10:00:00", 0.0, -50.0, 845.0),
    ("R4", "2025-10-04 10:00:00", 200.0, 0.0, 1045.0),
])


def test_overlap_removed_and_shared_receipt_rows_kept():
    merged, rep = merge_statements([add_row_ids(A), add_row_ids(B)])
    assert rep["duplicates_removed"] == 3
    assert len(merged) == 5                         # the fee row is NOT collapsed into its transfer
    assert rep["key_duplicates_within_statement"] == 0
    assert rep["rows_sharing_receipt"] == [2, 2]
    assert all(o["equal"] for o in rep["overlaps"])
    assert chain_breaks(merged) == []