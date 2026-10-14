# Ordered rules: the first match wins. Anything unmatched becomes UNKNOWN.
import re

RULES = [
    (r"Charge$",                              "fee"),
    (r"^M-Shwari Lock",                       "savings_lock"),
    (r"^M-Shwari Deposit",                    "savings_deposit"),
    (r"^M-Shwari Withdraw",                   "savings_withdraw"),
    (r"^Unit Trust Invest.*ZIIDI",            "ziidi_deposit"),      
    (r"Reversal",                             "reversal"),
    (r"^OD Loan Repayment",                   "fuliza_repayment"),
    (r"^Customer Transfer to",                "send_money"),
    (r"^Customer Transfer Fuliza",            "send_money"),
    (r"^Offnet C2B Transfer",                 "send_money"),         
    (r"^Funds received from",                 "received_money"),
    (r"^Merchant Payment",                    "merchant_payment"),
    (r"^(Card )?Pay Bill",                    "paybill"),
    (r"^Customer Payment to Small Business",  "small_business_payment"),
    (r"^(Customer Bundle Purchase|Airtime Purchase|Recharge for Customer)", "airtime_data"),
    (r"^Customer Withdrawal At Agent",        "cash_out"),
    (r"^Deposit of Funds at Agent",           "cash_in"),
    (r"^Business Payment from",               "business_income"),
    (r"^Transfer from Bank",                  "bank_in"),
]

# Candidates NOT yet confirmed on real statements. Only applied after RULES.
UNVERIFIED_RULES = [
    (r"OverDraft of Credit Party",       "fuliza_draw"),
    (r"^Unit Trust Withdraw.*ZIIDI",     "ziidi_withdraw"),
    (r"^Unit Trust Invest",              "investment_deposit"),    # other unit trusts
    (r"^Unit Trust Withdraw",            "investment_withdraw"),   # other unit trusts
]

FULIZA_TYPES     = {"fuliza_repayment", "fuliza_draw"}
UNVERIFIED_TYPES = {"fuliza_draw", "ziidi_withdraw", "investment_deposit", "investment_withdraw"}
SAVE_TYPES       = {"savings_deposit", "savings_lock", "ziidi_deposit", "investment_deposit"}
DRAW_TYPES       = {"savings_withdraw", "ziidi_withdraw", "investment_withdraw"}

# Movements between your own pockets, or debt service: not income or spending
INTERNAL = {"savings_deposit", "savings_withdraw", "savings_lock", "reversal",
            "fuliza_repayment", "fuliza_draw",
            "ziidi_deposit", "ziidi_withdraw", "investment_deposit", "investment_withdraw"}

def classify(details):
    for pattern, kind in RULES + UNVERIFIED_RULES:
        if re.search(pattern, details):
            return kind
    return "UNKNOWN"

def funding(details):
    """How the payment was funded: 'fuliza' (overdraft) or 'wallet'."""
    return "fuliza" if re.search(r"Fuliza M-Pesa|with Fuliza", details, re.IGNORECASE) else "wallet"

def add_types(df):
    """Add type, amount and direction columns. Zero-amount rows get direction 'none'."""
    df = df.copy()
    df["type"] = df["details"].map(classify)
    df["funding"] = df["details"].map(funding)
    df["amount"] = df["paid_in"] + df["withdrawn"].abs()
    df["direction"] = "none"
    df.loc[df["paid_in"] > 0, "direction"] = "in"
    df.loc[df["withdrawn"] != 0, "direction"] = "out"
    return df