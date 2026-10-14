import pandas as pd
from statement.classify import add_types


def test_ziidi_invest_row():
    df = pd.DataFrame([{
        "details": "Unit Trust Invest To 4145555 - ZIIDI MMF by M-PESA\\UnitTrust",
        "paid_in": 0.0,
        "withdrawn": -1000.0,
        "balance": 2000.0,
    }])
    row = add_types(df).iloc[0]
    assert row["type"] == "ziidi_deposit"
    assert row["direction"] == "out"
    assert row["amount"] == 1000.0