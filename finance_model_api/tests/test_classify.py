import pytest
from statement.classify import classify, funding

CASES = [
    ("Customer Transfer Fuliza M-Pesa to",              "send_money",       "fuliza"),
    ("Pay Bill Online Fuliza M-Pesa to 247247 - Test",  "paybill",          "fuliza"),
    ("OD Loan Repayment to 232323 - M-PESA Overdraw",   "fuliza_repayment", "wallet"),
    ("Card Pay Bill Online to 903470 - M-PESA",         "paybill",          "wallet"),
    ("Customer Transfer to - 2547***123 Test Name",     "send_money",       "wallet"),
    (r"Unit Trust Invest To 4145555 - ZIIDI MMF by M-PESA\UnitTrust", "ziidi_deposit", "wallet"),
    ("Offnet C2B Transfer to 2547***123 Test Name",     "send_money",       "wallet"),
]

@pytest.mark.parametrize("details,kind,fund", CASES)
def test_classify(details, kind, fund):
    assert classify(details) == kind
    assert funding(details) == fund