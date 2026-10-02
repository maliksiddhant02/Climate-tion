"""
Build Draki's season data for the lower Richmond: how El Nino and La Nina change its rain and floods. No API keys needed.

Writes web/public/data/richmond/season.json:
  latest   the most recent NOAA ONI value (El Nino / La Nina index) and what phase it means
  phases   per phase (El Nino, neutral, La Nina): yearly rain and how often the Richmond River hit "Act today"
  seasons  every calendar year since 1991: rain, peak river flow, ONI (Sep-Nov)

Run from the repo root:  scripts/.venv/Scripts/python scripts/build_season_data.py
Sources: NOAA CPC Oceanic Nino Index (ONI); ERA5 daily rain and GloFAS v4 river flow via Open-Meteo.
"""
import datetime as dt
import json
from pathlib import Path

import requests

OUT = Path(__file__).resolve().parent.parent / "web" / "public" / "data" / "richmond" / "season.json"
BA = (-29.07, 153.34)  # rain: Woodburn
GLOFAS = (-29.025, 153.375)  # river: Richmond River main channel
FIRST, LAST = 1991, 2025  # calendar years (ERA5 + GloFAS both complete)

# ---- ONI: 3-month running mean of Nino 3.4 sea temperature anomalies ----
oni_rows = [l.split() for l in requests.get("https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt", timeout=60).text.splitlines()[1:] if l.strip()]
oni = {(r[0], int(r[1])): float(r[3]) for r in oni_rows}
latest_season, latest_year, *_ = oni_rows[-1]
latest = {"season": latest_season, "year": int(latest_year), "oni": oni[(latest_season, int(latest_year))]}


def phase(v: float) -> str:
    # NOAA's thresholds: +/-0.5 C.
    return "elnino" if v >= 0.5 else "lanina" if v <= -0.5 else "neutral"


latest["phase"] = phase(latest["oni"])

# ---- Daily rain and river flow ----
# Calendar years, classified by the September-November index: in eastern Australia El Nino and La Nina peak in spring
# and shape the whole year's rain (BoM), and Northern Rivers cane is a two-year crop, so a full year is the useful unit.
rain = requests.get(
    "https://archive-api.open-meteo.com/v1/archive",
    params={"latitude": BA[0], "longitude": BA[1], "daily": "precipitation_sum", "start_date": f"{FIRST}-01-01", "end_date": f"{LAST}-12-31", "timezone": "Australia/Sydney"},
    timeout=120,
).json()["daily"]
flow = requests.get(
    "https://flood-api.open-meteo.com/v1/flood",
    params={"latitude": GLOFAS[0], "longitude": GLOFAS[1], "daily": "river_discharge", "start_date": f"{FIRST}-01-01", "end_date": f"{LAST}-12-31"},
    timeout=120,
).json()["daily"]
meta = json.loads((OUT.parent / "meta.json").read_text())
q5 = meta["river"]["q5"]

seasons = []
for y in range(FIRST, LAST + 1):
    r = [v for k, v in zip(rain["time"], rain["precipitation_sum"]) if k.startswith(str(y))]
    q = [v for k, v in zip(flow["time"], flow["river_discharge"]) if k.startswith(str(y)) and v is not None]
    v = oni[("SON", y)]
    seasons.append({
        "season": str(y),
        "rain": round(sum(x or 0 for x in r)),
        "heavyDays": sum(1 for x in r if (x or 0) >= 50),
        "peakFlow": round(max(q)) if q else None,
        "actFlood": bool(q) and max(q) >= q5,
        "oni": v,
        "phase": phase(v),
    })

phases = {}
for p in ("elnino", "neutral", "lanina"):
    s = [x for x in seasons if x["phase"] == p]
    floods = [x for x in s if x["actFlood"]]
    phases[p] = {
        "seasons": len(s),
        "meanRain": round(sum(x["rain"] for x in s) / len(s)),
        "floodSeasons": len(floods),
        "floodShare": round(len(floods) / len(s), 2),
    }
all_mean = round(sum(x["rain"] for x in seasons) / len(seasons))
strong = [x for x in seasons if x["oni"] >= 1.5]

OUT.write_text(json.dumps({
    "latest": latest,
    "allMeanRain": all_mean,
    "phases": phases,
    "strongElNino": {"seasons": [x["season"] for x in strong], "meanRain": round(sum(x["rain"] for x in strong) / len(strong)) if strong else None},
    "seasons": seasons,
    "sources": [
        "NOAA CPC Oceanic Nino Index (ONI), ERSST v6",
        "ERA5 reanalysis daily rain at Woodburn (Copernicus C3S), via Open-Meteo",
        "GloFAS v4 river discharge, Richmond River (Copernicus EMS), via Open-Meteo",
    ],
}, indent=1))

print("latest ONI", latest)
print("all seasons mean wet-season rain", all_mean, "mm")
for p, v in phases.items():
    print(p, v)
print("strong El Nino seasons", [x["season"] for x in strong], "mean rain", round(sum(x["rain"] for x in strong) / len(strong)) if strong else None)
print("wrote", OUT)
