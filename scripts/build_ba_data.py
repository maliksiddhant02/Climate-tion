"""
Build Draki's static data for the Ba floodplain, Fiji. No API keys needed.

Writes web/public/data/ba/:
  meta.json    grid, river model knobs, validation results, sources
  dem.bin      Int16 LE, elevation in decimetres (Copernicus GLO-30, 1 arc-second)
  hand.bin     Uint16 LE, height above the Ba River / sea in decimetres
  land.bin     Uint8, ESA WorldCover 2021 class (40 = cropland, 80 = permanent water)
  cody.json    Cyclone Cody replay: hourly ERA5 rain + daily GloFAS discharge, so the demo never waits on an API
  flow.json    Ba River flow history (weekly peak, m3/s) for the Validation chart

Run from the repo root:  scripts/.venv/Scripts/python scripts/build_ba_data.py
(set up with: python -m venv scripts/.venv && scripts/.venv/Scripts/pip install -r scripts/requirements.txt)
"""
import datetime as dt
import json
from pathlib import Path

import numpy as np
import planetary_computer as pc
import pystac_client
import rasterio
import requests
from rasterio.enums import Resampling
from rasterio.transform import from_bounds
from rasterio.warp import reproject
from scipy import ndimage

OUT = Path(__file__).resolve().parent.parent / "web" / "public" / "data" / "ba"
OUT.mkdir(parents=True, exist_ok=True)

# Ba floodplain: Ba town, the lower Ba River and the cane land either side, out to the coast.
W, S, E, N = 177.60, -17.60, 177.74, -17.45
RES = 1 / 3600  # 1 arc-second, ~30 m: the DEM's native grid
WIDTH, HEIGHT = round((E - W) / RES), round((N - S) / RES)
DST = from_bounds(W, S, E, N, WIDTH, HEIGHT)
CRS = "EPSG:4326"
CELL_HA = (RES * 111_320) * (RES * 111_320 * np.cos(np.radians(-17.525))) / 1e4

# GloFAS cell on the Ba River main channel. (The 177.675 cell next to town is a side stream.)
GLOFAS = (-17.525, 177.625)
CODY = ("2022-01-06", "2022-01-12")
BA_TOWN = (-17.5345, 177.6735)

# Recorded floods at Ba, with sources. Used to check the river signal, not to tune it.
RECORDED = [
    ("2009-01-08", "2009-01-12", "January 2009 floods (11 deaths nationally)", "McAneney et al. 2017, Int. J. Climatology"),
    ("2012-01-21", "2012-01-25", "January 2012 floods", "Wikipedia: January 2012 Fiji floods"),
    ("2012-03-29", "2012-03-31", "TD17F floods, March 2012", "ReliefWeb: Fiji Floods Mar 2012"),
    ("2022-01-08", "2022-01-09", "Cyclone Cody, Ba Town flooded", "Ba Town Council: Ba Town Flooding 2022"),
    ("2022-01-16", "2022-01-16", "Second Ba Town flood, January 2022", "Ba Town Council: Ba Town Flooding 2022"),
    ("2023-02-15", "2023-02-17", "Western Division floods, roads closed around Ba", "FloodList: Fiji floods February 2023"),
    ("2024-03-16", "2024-03-18", "Ba Town flooded (Elevuka Creek overflow)", "ReliefWeb / ECHO Daily Flash, 19 March 2024"),
]

cat = pystac_client.Client.open("https://planetarycomputer.microsoft.com/api/stac/v1", modifier=pc.sign_inplace)


def item(coll, dt_range=None, contains=None):
    items = list(cat.search(collections=[coll], bbox=[W, S, E, N], datetime=dt_range).items())
    items = [i for i in items if not contains or contains in i.id]
    assert items, f"no {coll} item for {dt_range} {contains}"
    return items[0]


def warp(href, resampling, dtype="float32"):
    out = np.zeros((HEIGHT, WIDTH), dtype=dtype)
    with rasterio.open(href) as src:
        reproject(rasterio.band(src, 1), out, dst_transform=DST, dst_crs=CRS, resampling=resampling, dst_nodata=0)
    return out


def glofas(start, end):
    r = requests.get(
        "https://flood-api.open-meteo.com/v1/flood",
        params={"latitude": GLOFAS[0], "longitude": GLOFAS[1], "daily": "river_discharge", "start_date": start, "end_date": end},
        timeout=120,
    )
    r.raise_for_status()
    d = r.json()["daily"]
    return [dt.date.fromisoformat(t) for t in d["time"]], np.array([np.nan if x is None else x for x in d["river_discharge"]])


def px(lat, lng):
    return int((N - lat) / RES), int((lng - W) / RES)


print(f"grid {WIDTH}x{HEIGHT}")
dem = warp(item("cop-dem-glo-30").assets["data"].href, Resampling.bilinear)
land = warp(item("esa-worldcover", contains="2021").assets["map"].href, Resampling.mode, "uint8")

# ---- HAND: height above the nearest drainage (the Ba River channel or the sea) ----
water = land == 80
lab, n = ndimage.label(water)
sizes = ndimage.sum(water, lab, range(1, n + 1))
sea = lab == int(np.argmax(sizes)) + 1
river = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s > 300]) & ~sea
drain = river | sea
drain_elev = np.where(drain, ndimage.minimum_filter(dem, size=3), np.nan)
_, (iy, ix) = ndimage.distance_transform_edt(~drain, return_indices=True)
# ponytail: nearest drainage by straight-line distance, not along flow paths. Fine on a flat floodplain;
# upgrade to D8 flow-routing HAND if fields up in the hills ever matter.
hand = np.clip(dem - drain_elev[iy, ix], 0, 6000)
plain = (~water) & (ndimage.distance_transform_edt(~river) < 70) & (dem < 15)

# ---- River discharge climatology (GloFAS v4, main channel) ----
days, Q = glofas("1984-01-01", (dt.date.today() - dt.timedelta(days=1)).isoformat())
years = [y for y in sorted({d.year for d in days}) if np.isfinite(Q[[d.year == y for d in days]]).sum() > 300 and y < dt.date.today().year]
annmax = np.array([np.nanmax(Q[[d.year == y for d in days]]) for y in years])
q2, q5 = (float(np.percentile(annmax, p)) for p in (50, 80))  # ~2-year and ~5-year floods

# ---- Rating curve: river level above normal, from discharge ----
# Two anchors, both from the record rather than fitted to a single image:
#  1. Rivers run about bank-full at their 2-year flood, so at Q2 the water only reaches the lowest
#     2% of the floodplain.
#  2. Ba Town's streets flooded during Cyclone Cody (Ba Town Council), so at Cody's peak the river
#     stands ~0.5 m above the lowest streets of the town centre.
# Between the anchors the level grows with sqrt(Q), a standard rating-curve shape.
cody_days, cody_q = glofas(*CODY)
q_cody = float(np.nanmax(cody_q))
h0 = float(np.percentile(hand[plain], 2))
ty, tx = px(*BA_TOWN)
town_streets = float(hand[ty - 5:ty + 6, tx - 5:tx + 6].min())
k = (town_streets + 0.5 - h0) / (np.sqrt(q_cody) - np.sqrt(q2))


def stage(q):
    return 0.0 if q <= q2 else h0 + k * (np.sqrt(q) - np.sqrt(q2))  # same as riverStage() in web/src/lib/flood.ts


print(f"Q2 {q2:.0f}, Q5 {q5:.0f}, Cody {q_cody:.0f} m3/s | h0 {h0:.2f} m, town streets {town_streets:.2f} m, k {k:.3f}")
for q in (q2, q5, q_cody):
    print(f"  Q {q:6.0f}: river {stage(q):4.1f} m above normal -> {((hand < stage(q)) & ~water).sum() * CELL_HA:6.0f} ha under water in the box")

# ---- Check against recorded floods ----
V = Q[np.isfinite(Q)]
record = []
for a, b, name, src in RECORDED:
    lo, hi = dt.date.fromisoformat(a) - dt.timedelta(days=1), dt.date.fromisoformat(b) + dt.timedelta(days=1)
    pk = float(np.nanmax(Q[[lo <= d <= hi for d in days]]))
    level = "act" if pk >= q5 else "watch" if pk >= q2 else "missed"
    record.append({"start": a, "end": b, "name": name, "source": src, "peak": round(pk), "level": level, "percentile": round(100 * float((V < pk).mean()), 2)})
    print(f"  {a} {name[:40]:40s} peak {pk:6.0f} -> {level}")

# River-only alarms since 2009 that match no recorded flood (some may be unrecorded floods).
eps, last = [], None
for d, x in zip(days, Q):
    if d.year >= 2009 and x >= q5:
        if last is None or (d - last).days > 5:
            eps.append(d)
        last = d
recorded_days = [(dt.date.fromisoformat(r["start"]) - dt.timedelta(days=3), dt.date.fromisoformat(r["end"]) + dt.timedelta(days=3)) for r in record]
unmatched = [e.isoformat() for e in eps if not any(lo <= e <= hi for lo, hi in recorded_days)]
print("act-level episodes since 2009:", len(eps), "unmatched:", unmatched)

# ---- What Sentinel-1 saw ~2.5 days after Cody's peak ----
def s1_db(day):
    it = item("sentinel-1-rtc", f"{day}/{day}")
    lin = warp(it.assets["vv"].href, Resampling.average)
    return 10 * np.log10(np.maximum(ndimage.uniform_filter(np.where(lin > 0, lin, 1e-3), 5), 1e-6))


before, after = s1_db("2021-12-30"), s1_db("2022-01-11")
s1_water = ndimage.binary_opening((after < -15) & ((after - before) < -3) & ~water, np.ones((3, 3)))
s1_ha = float(s1_water.sum() * CELL_HA)
print(f"Sentinel-1, 11 Jan 2022: {s1_ha:.0f} ha of new open water")

# ---- Cyclone Cody replay bundle ----
wx = requests.get(
    "https://archive-api.open-meteo.com/v1/archive",
    params={
        "latitude": -17.523, "longitude": 177.688, "timezone": "Pacific/Fiji", "hourly": "precipitation",
        "daily": "precipitation_sum,temperature_2m_max,weather_code", "start_date": CODY[0], "end_date": CODY[1],
    },
    timeout=60,
).json()
(OUT / "cody.json").write_text(json.dumps({
    "hourly": {"time": wx["hourly"]["time"], "rain": wx["hourly"]["precipitation"]},
    "daily": {
        "time": wx["daily"]["time"], "rain": wx["daily"]["precipitation_sum"], "temp": wx["daily"]["temperature_2m_max"],
        "code": wx["daily"]["weather_code"], "discharge": [None if np.isnan(x) else float(x) for x in cody_q],
    },
}))

np.round(dem * 10).astype("<i2").tofile(OUT / "dem.bin")
np.round(hand * 10).astype("<u2").tofile(OUT / "hand.bin")
land.astype("u1").tofile(OUT / "land.bin")

# ---- River flow history for the Validation chart: weekly peaks keep every flood spike at ~1/7 the size ----
first = next(i for i, x in enumerate(Q) if np.isfinite(x))
weeks = [(days[i].isoformat(), round(float(np.nanmax(Q[i:i + 7])))) for i in range(first, len(Q) - 6, 7) if np.isfinite(Q[i:i + 7]).any()]
(OUT / "flow.json").write_text(json.dumps({"time": [w[0] for w in weeks], "q": [w[1] for w in weeks]}))

(OUT / "meta.json").write_text(json.dumps({
    "bbox": [W, S, E, N], "width": WIDTH, "height": HEIGHT, "res": RES,
    "glofas": GLOFAS,
    "river": {"q2": round(q2), "q5": round(q5), "h0": round(h0, 2), "k": round(float(k), 4), "codyPeak": round(q_cody), "townStreetsM": round(town_streets, 2)},
    "record": record,
    "unmatchedAlarms": unmatched,
    "sentinel1": {
        "before": "2021-12-30", "after": "2022-01-11", "newWaterHa": round(s1_ha),
        "dischargeDayBefore": round(float(Q[days.index(dt.date(2022, 1, 10))])),
        "note": "Pass ~2.5 days after Cody's peak. Almost no open water left: Ba's floods drain within a day or two, faster than the 12-day satellite revisit.",
    },
    "sources": [
        "Copernicus DEM GLO-30 (ESA/Airbus), via Microsoft Planetary Computer",
        "ESA WorldCover 2021 v200, via Microsoft Planetary Computer",
        "Sentinel-1A RTC (Copernicus, EU), via Microsoft Planetary Computer",
        "GloFAS v4 river discharge (Copernicus EMS), via Open-Meteo Flood API",
        "ERA5 reanalysis rain (Copernicus C3S), via Open-Meteo archive API",
    ],
}, indent=2))
print("wrote", OUT)
