"""Recompute investment/assumptions.json from the project's data files.

Usage (from finance_model_api):
    python scripts/build_assumptions.py --data path/to/Data [--dividend-yield 0] [--dry-run]

Reads   NSE_data_all_stocks_*.csv, money_market_funds.csv, Kenya 10-Year Bond Yield Historical Data.csv
Updates mmf, bond and stock in assumptions.json. T-bill is left alone (its source is the Central Bank bulletin).
Prints every number it writes, so you can check it.
"""
import argparse, glob, json, os
import numpy as np
import pandas as pd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGET = os.path.join(ROOT, "investment", "assumptions.json")
MIN_TRADING_DAYS = 5      # a stock needs 5+ trading days in a month (and the month before) to count
WINSOR = 1.0              # monthly moves beyond +/-100% are treated as data errors or corporate actions and clipped
BOND_DURATION = 6.0       # rough modified duration of a 10-year bond paying about 13%


def stock_stats(data_dir):
    frames = [pd.read_csv(f, dtype=str) for f in sorted(glob.glob(os.path.join(data_dir, "NSE_data_all_stocks_*.csv")))]
    if not frames:
        raise SystemExit("No NSE_data_all_stocks_*.csv files found in " + data_dir)
    d = pd.concat(frames)
    d["date"] = pd.to_datetime(d["DATE"], format="mixed", dayfirst=True, errors="coerce")
    d["p"] = pd.to_numeric(d["Day Price"].str.replace(",", ""), errors="coerce")
    d["v"] = pd.to_numeric(d["Volume"].str.replace(",", ""), errors="coerce").fillna(0)
    d = d.dropna(subset=["date", "p"])
    d = d[~d["CODE"].str.startswith("^")]                      # drop index rows
    d = d.sort_values("date").drop_duplicates(["date", "CODE"], keep="last")   # sort first: files are not always in date order
    d["m"] = d["date"].dt.to_period("M")
    g = d.groupby(["CODE", "m"]).agg(p=("p", "last"), days=("v", lambda s: (s > 0).sum())).reset_index()
    price = g.pivot(index="m", columns="CODE", values="p").sort_index()
    days = g.pivot(index="m", columns="CODE", values="days").reindex(price.index)
    ret = price.pct_change(fill_method=None)
    ret = ret.where((days >= MIN_TRADING_DAYS) & (days.shift(1) >= MIN_TRADING_DAYS))
    ret = ret.clip(-WINSOR, WINSOR)
    basket = ret.mean(axis=1).dropna()                          # equal-weighted basket, one number per month
    return {
        "annual_return": basket.mean() * 12 * 100,              # arithmetic, price only
        "geometric": ((1 + basket).prod() ** (12 / len(basket)) - 1) * 100,
        "volatility": basket.std() * np.sqrt(12) * 100,
        "single_stock_vol": (ret.std() * np.sqrt(12)).median() * 100,
        "months": len(basket),
        "avg_names": ret.notna().sum(axis=1).mean(),
        "first": str(price.index[0]), "last": str(price.index[-1]),
    }


def mmf_stats(data_dir):
    m = pd.read_csv(os.path.join(data_dir, "money_market_funds.csv"))
    g = m["Average Return (%)"]
    return {"annual_return": g.median(), "volatility": g.std(), "low": g.min(), "high": g.max(), "n": len(g)}


def bond_stats(data_dir):
    b = pd.read_csv(os.path.join(data_dir, "Kenya 10-Year Bond Yield Historical Data.csv"), encoding="utf-8-sig")
    b["d"] = pd.to_datetime(b["Date"], format="%m/%d/%Y")
    y = b.sort_values("d").set_index("d")["Price"]
    dy = y.diff().dropna()
    return {"annual_return": y.iloc[-1], "volatility": dy.std() * np.sqrt(12) * BOND_DURATION,
            "low": y.min(), "high": y.max(), "first": y.index[0].strftime("%b %Y"), "last": y.index[-1].strftime("%b %Y")}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True)
    ap.add_argument("--dividend-yield", type=float, default=0.0,
                    help="yearly dividend yield in %% to add to the stock price return (the NSE files hold prices only)")
    ap.add_argument("--only", nargs="+", choices=["mmf", "bond", "stock"], default=["mmf", "bond", "stock"],
                    help="update only these assets (default: all three)")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    s, m, b = stock_stats(a.data), mmf_stats(a.data), bond_stats(a.data)
    print("STOCK", {k: (round(v, 2) if isinstance(v, float) else v) for k, v in s.items()})
    print("MMF  ", {k: (round(v, 2) if isinstance(v, float) else v) for k, v in m.items()})
    print("BOND ", {k: (round(v, 2) if isinstance(v, float) else v) for k, v in b.items()})

    with open(TARGET, encoding="utf-8") as f:
        doc = json.load(f)
    A = doc["assets"]
    if "mmf" in a.only:
        A["mmf"].update(annual_return=round(m["annual_return"], 1), volatility=round(m["volatility"], 1),
                        range_low=round(m["low"], 2), range_high=round(m["high"], 2),
                        range_label=f"across the {m['n']} funds in our list",
                        source=f"Median gross yield of {m['n']} Kenyan money market funds (project dataset, date not recorded). "
                               "Volatility is the spread between funds, not a measured month-to-month swing.")
    if "bond" in a.only:
        A["bond"].update(annual_return=round(b["annual_return"], 2), volatility=round(b["volatility"], 1),
                         as_of=f"10-year yield, {b['last']}",
                         source=f"10-year Kenya government bond yield, {b['last']}: {b['annual_return']:.2f}% (range {b['low']:.1f}%-{b['high']:.1f}% since {b['first']}). "
                                f"Volatility = typical monthly yield change x sqrt(12) x duration {BOND_DURATION:g}; it is the price swing if the bond is sold early.")
    ret = round(s["annual_return"] + a.dividend_yield, 1)
    if "stock" in a.only:
        A["stock"].update(annual_return=ret, volatility=round(s["volatility"], 1), as_of=f"NSE data {s['first']} to {s['last']}",
                          range_label="not shown: stock outcomes vary too widely",
                          source=f"NSE daily prices {s['first']} to {s['last']}, month-end, equal-weighted basket of about {s['avg_names']:.0f} listed shares "
                                 f"(indices and thinly traded months removed). Price change only{' plus an ASSUMED ' + str(a.dividend_yield) + '% a year for dividends (not in the data, not verified)' if a.dividend_yield else ', dividends are NOT included'}. "
                                 f"A single share is far riskier: its typical volatility is {s['single_stock_vol']:.0f}%.",
                          needs_review=True)
    if a.dry_run:
        print("dry run: nothing written"); return
    doc["metadata"]["last_reviewed"] = pd.Timestamp.today().strftime("%Y-%m-%d")
    with open(TARGET, "w", encoding="utf-8") as f:
        json.dump(doc, f, indent=2, ensure_ascii=False); f.write("\n")
    print("wrote", TARGET)


if __name__ == "__main__":
    main()
