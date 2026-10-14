"""
Synthetic M-Pesa statements for testing the pipeline end to end.

Everything here is made up: names, numbers, amounts and the fee schedule.
Wording follows templates seen on real statements, EXCEPT the Fuliza lines (and the overdraft credit row),
which come from a public excerpt and are UNVERIFIED against a statement of yours. Passing persona tests
therefore shows the engine behaves as designed on these assumptions, not that real students look like this.
"""
import math
from dataclasses import dataclass
from typing import Callable

import numpy as np
import pandas as pd

COLUMNS = ["receipt", "time", "details", "status", "paid_in", "withdrawn", "balance"]

DAILY_MIX = {"send": 0.30, "merchant": 0.30, "bundle": 0.15, "paybill": 0.10, "airtime": 0.15}

SHOP_TEMPLATES = {
    "send": ("Customer Transfer to - {who}", "Customer Transfer Fuliza M-Pesa to - {who}"),
    "merchant": ("Merchant Payment to {till} - Test Shop", "Merchant Payment Fuliza M-Pesa Online to {till} - Test Shop"),
    "paybill": ("Pay Bill to {biller} - Test Biller Acc.{acc}", "Pay Bill Online Fuliza M-Pesa to {biller} - Test Biller Acc.{acc}"),
    "bundle": ("Customer Bundle Purchase to 4093441SAFARICOM DATA BUNDLES by - 0791***181 Test Person",
               "Customer Bundle Purchase with Fuliza to 4093441SAFARICOM DATA BUNDLES by - 0791***181 Test Person"),
    "airtime": ("Airtime Purchase", "Airtime Purchase with Fuliza"),
    "cash_out": ("Customer Withdrawal At Agent Till {till} - Test Agent", None),
}


def _fee(kind, amount, rng):
    """Made-up fee schedule."""
    if kind == "send":
        return 7.0 if amount <= 100 else 13.0 if amount <= 500 else 23.0 if amount <= 1000 else 33.0
    if kind == "paybill":
        return 5.0 if rng.random() < 0.3 else 0.0
    if kind == "cash_out":
        return 29.0 if amount >= 1000 else 11.0
    return 0.0


FEE_TEXT = {"send": "Customer Transfer of Funds Charge", "paybill": "Pay Bill Charge", "cash_out": "Withdrawal Charge"}


class Ledger:
    """Builds statement rows in time order and keeps a consistent running balance."""

    def __init__(self, rng, start_balance):
        self.rng = rng
        self.balance = float(start_balance)
        self.rows = []
        self.owed = 0.0          # Fuliza owed
        self.mshwari = 0.0       # money held in M-Shwari (only used to keep withdrawals possible)
        self._n = 0

    # ---- low level -------------------------------------------------------
    def _receipt(self):
        self._n += 1
        return "SYN" + format((self._n * 7919) % 10_000_000, "07d")

    def _row(self, t, details, paid_in=0.0, withdrawn=0.0, receipt=None):
        self.balance = round(self.balance + paid_in - withdrawn, 2)
        rc = receipt or self._receipt()
        # Same convention as the parser's output: withdrawals are stored as NEGATIVE numbers.
        self.rows.append((rc, pd.Timestamp(t).floor("s"), details, "Completed",
                          round(paid_in, 2), -round(withdrawn, 2), self.balance))
        return rc

    def _who(self):
        return f"2547***{int(self.rng.integers(100, 999))} Test Person {chr(65 + int(self.rng.integers(0, 12)))}"

    # ---- inflows ---------------------------------------------------------
    def receive(self, t, amount):
        self._row(t, f"Funds received from - {self._who()}", paid_in=float(amount))
        if self.owed > 0:                                   # money received can pay down an overdraft
            repay = float(min(self.owed, math.floor(self.balance)))
            if repay >= 1:
                self._row(pd.Timestamp(t) + pd.Timedelta(seconds=1),
                          "OD Loan Repayment to 232323 - M-PESA Overdraw", withdrawn=repay)
                self.owed = round(self.owed - repay, 2)

    # ---- outflows --------------------------------------------------------
    def pay(self, t, kind, amount, fuliza=False):
        amount = float(round(amount))
        fee = _fee(kind, amount, self.rng)
        use_fuliza = False
        if self.balance < amount + fee:
            if fuliza and kind != "cash_out":
                short = float(math.ceil(amount + fee - self.balance))
                self._row(t, "OverDraft of Credit Party", paid_in=short)
                self.owed = round(self.owed + short, 2)
                use_fuliza = True
            else:                                           # can only spend what is there
                amount = float(math.floor(self.balance - fee))
                if amount < 10:
                    return
                fee = _fee(kind, amount, self.rng)
                if self.balance < amount + fee:
                    return
        plain, fz = SHOP_TEMPLATES[kind]
        text = (fz if use_fuliza else plain).format(
            who=self._who(), till=int(self.rng.integers(1_000_000, 9_999_999)),
            biller=int(self.rng.integers(100_000, 999_999)), acc=int(self.rng.integers(1000, 9999)))
        rc = self._row(t, text, withdrawn=amount)
        if fee > 0:
            self._row(t, FEE_TEXT[kind], withdrawn=fee, receipt=rc)    # a fee shares its transaction's receipt

    # ---- savings ---------------------------------------------------------
    def mshwari_deposit(self, t, amount):
        if self.balance >= amount:
            self._row(t, "M-Shwari Deposit", withdrawn=float(amount))
            self.mshwari += amount

    def mshwari_withdraw(self, t, amount):
        amount = min(float(amount), self.mshwari)
        if amount >= 1:
            self._row(t, "M-Shwari Withdraw", paid_in=amount)
            self.mshwari -= amount

    def ziidi_invest(self, t, amount):
        if self.balance >= amount:
            self._row(t, "Unit Trust Invest To 4145555 - ZIIDI MMF by M-PESA\\UnitTrust", withdrawn=float(amount))

    def frame(self):
        return pd.DataFrame(self.rows, columns=COLUMNS)


# ---- plan helpers --------------------------------------------------------
def receive(amount, hour=9.0):
    return (hour, lambda L, t: L.receive(t, amount))


def pay(kind, amount, hour=12.0, fuliza=False):
    return (hour, lambda L, t: L.pay(t, kind, amount, fuliza=fuliza))


def mshwari_in(amount, hour=10.0):
    return (hour, lambda L, t: L.mshwari_deposit(t, amount))


def mshwari_out(amount, hour=10.0):
    return (hour, lambda L, t: L.mshwari_withdraw(t, amount))


def ziidi_in(amount, hour=11.0):
    return (hour, lambda L, t: L.ziidi_invest(t, amount))


def spend_events(rng, mean, mix=None, p_active=0.92, fuliza=False):
    """A day's ordinary spending: a few small payments that add up to roughly `mean`."""
    mix = mix or DAILY_MIX
    if rng.random() > p_active:
        return []
    total = mean * rng.lognormal(-0.18, 0.6)
    n = int(rng.integers(1, 5))
    parts = rng.dirichlet(np.ones(n)) * total
    kinds = rng.choice(list(mix), size=n, p=list(mix.values()))
    hours = sorted(rng.uniform(7, 22, n))
    return [pay(str(k), max(float(a), 10.0), float(h), fuliza) for h, k, a in zip(hours, kinds, parts)]


def simulate(start, days, start_balance, plan, seed):
    rng = np.random.default_rng(seed)
    L = Ledger(rng, start_balance)
    for d in range(days):
        day = pd.Timestamp(start) + pd.Timedelta(days=d)
        events = sorted(plan(day, rng), key=lambda e: e[0])
        for hour, fn in events:
            fn(L, day + pd.Timedelta(hours=float(hour)))
    return L.frame()


# ---- personas ------------------------------------------------------------
def month_end_squeeze(seed=1):
    def plan(day, rng):
        ev = []
        if day.day == 1:
            ev.append(receive(9000))
        if day.day == 15:
            ev.append(receive(1500, 10.0))
        return ev + spend_events(rng, 430)
    return simulate("2026-01-05", 180, 1200, plan, seed)


def fuliza_dependent(seed=2):
    def plan(day, rng):
        ev = []
        if rng.random() < 0.25:
            ev.append(receive(float(rng.choice([1000, 1500, 2000])), 9.0))
        return ev + spend_events(rng, 520, fuliza=True)
    return simulate("2026-02-01", 150, 800, plan, seed)


def steady_saver(seed=3):
    def plan(day, rng):
        ev = []
        if day.day == 1:
            ev.append(receive(22000))
        if day.day == 15:
            ev.append(receive(3000, 10.0))
        if day.day == 2:
            ev.append(mshwari_in(3000))
        if day.day == 16:
            ev.append(ziidi_in(1000))
        if day.day == 20 and rng.random() < 0.15:
            ev.append(mshwari_out(500))
        return ev + spend_events(rng, 400, p_active=0.9)
    return simulate("2026-01-03", 240, 2000, plan, seed)


def leaky_saver(seed=4):
    def plan(day, rng):
        ev = []
        if day.day == 1:
            ev.append(receive(14000))
        if day.day == 2:
            ev.append(mshwari_in(3000))
        if day.day == 5:
            ev.append(mshwari_out(2900))
        if day.day == 16:
            ev.append(mshwari_in(1500))
        if day.day == 19:
            ev.append(mshwari_out(1500))
        return ev + spend_events(rng, 400, p_active=0.9)
    return simulate("2026-01-04", 180, 2500, plan, seed)


def cash_heavy(seed=5):
    small = {"airtime": 0.5, "bundle": 0.3, "send": 0.2}

    def plan(day, rng):
        ev = []
        if day.day == 1:
            ev.append(receive(12000))
        if day.day in (3, 10, 17, 24):
            ev.append(pay("cash_out", 2000, 11.0))
        return ev + spend_events(rng, 120, mix=small, p_active=0.6)
    return simulate("2026-02-01", 150, 1500, plan, seed)


def sponsor_lumps(seed=6):
    sponsor = {(1, 10), (5, 10), (9, 10)}
    school = {(1, 12), (5, 12), (9, 12)}

    def plan(day, rng):
        ev = []
        if day.day == 1:
            ev.append(receive(4000))
        if (day.month, day.day) in sponsor:
            ev.append(receive(70000, 10.0))
        if (day.month, day.day) in school:
            ev.append(pay("paybill", 55000, 14.0))
        return ev + spend_events(rng, 220)
    return simulate("2026-01-02", 300, 3000, plan, seed)


def thin_data(seed=7):
    def plan(day, rng):
        ev = [receive(5000)] if day.day == 1 else []
        return ev + spend_events(rng, 300)
    return simulate("2026-06-01", 20, 500, plan, seed)


@dataclass
class Persona:
    name: str
    description: str
    expected_stage: str
    build: Callable[[], pd.DataFrame]


PERSONAS = [
    Persona("month_end_squeeze", "Allowance arrives monthly and runs out before the next one", "short_of_cash", month_end_squeeze),
    Persona("fuliza_dependent", "Spends more than comes in and covers the gap with Fuliza", "short_of_cash", fuliza_dependent),
    Persona("steady_saver", "Regular deposits, rare withdrawals, a healthy wallet buffer", "ready_to_explore", steady_saver),
    Persona("leaky_saver", "Saves, then takes the money back out within days", "building_habit", leaky_saver),
    Persona("cash_heavy", "Most spending leaves as agent cash withdrawals", "stable", cash_heavy),
    Persona("sponsor_lumps", "A big sponsor payment each term, mostly paid straight out as fees", "stable", sponsor_lumps),
    Persona("thin_data", "Only three weeks of transactions", "not_enough_data", thin_data),
]
