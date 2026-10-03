"""
Build Draki's data for the lower Richmond River floodplain, NSW (Coraki, Woodburn, Broadwater: Northern Rivers cane country).
No API keys needed.

Writes web/public/data/richmond/:
  meta.json   grid, demo field, river model knobs, validation (Sentinel-1 overlap + recorded floods), sources
  dem.bin     Int16 LE, elevation in decimetres (Copernicus GLO-30, 1 arc-second)
  hand.bin    Uint16 LE, height above the river / sea in decimetres
  land.bin    Uint8, ESA WorldCover 2021 class (30 grassland, 40 cropland, 80 permanent water)
  water.png   what Sentinel-1 saw under water on 2 March 2022 (map overlay)
  agreement.png  model vs satellite: agree (green), missed (blue), over-predicted (amber), for the Validation page
  event.json  the February 2022 flood replay: hourly ERA5 rain + daily GloFAS discharge
  flow.json   Richmond River flow history (weekly peak) for the Validation chart

  agreement-blind.png  the same map for the held-out March 2022 flood (blind check, frozen calibration)

Run from the repo root:  scripts/.venv/Scripts/python scripts/build_region.py
Blind check only (reads the built files, patches meta.json["sentinel1Blind"], changes nothing else):
                         scripts/.venv/Scripts/python scripts/build_region.py --blind
"""
import datetime as dt
import json
import sys
from pathlib import Path

import numpy as np
import planetary_computer as pc
import pystac_client
import rasterio
import requests
from PIL import Image
from rasterio.enums import Resampling
from rasterio.transform import from_bounds
from rasterio.warp import reproject
from scipy import ndimage

OUT = Path(__file__).resolve().parent.parent / "web" / "public" / "data" / "richmond"
OUT.mkdir(parents=True, exist_ok=True)

W, S, E, N = 153.25, -29.12, 153.47, -28.94
RES = 1 / 3600
WIDTH, HEIGHT = round((E - W) / RES), round((N - S) / RES)
DST = from_bounds(W, S, E, N, WIDTH, HEIGHT)
CRS = "EPSG:4326"
CELL_HA = (RES * 111_320) * (RES * 111_320 * np.cos(np.radians(-29.03))) / 1e4

GLOFAS = (-29.025, 153.375)  # Richmond River main channel near Woodburn/Broadwater: peak 3,326 m3/s on 28 Feb 2022
EVENT = ("2022-02-24", "2022-03-04")  # the February 2022 flood, Lismore's record
S1_BEFORE, S1_AFTER = "2022-02-18", "2022-03-02"  # Sentinel-1A descending, same orbit; after = ~2 days past the peak
WOODBURN = (-29.0717, 153.3408)  # flooded >3 m in 2022 (Richmond Valley Council); used as a check, not for tuning
BROADWATER_MILL = (-29.013, 153.431)  # cane mill under ~3 m of water in 2022 (ABC)
# Held-out flood for a blind check: never used to fit anything. Same orbit (147) for both images; after = ~1 day past the 30 March peak.
BLIND = ("Second 2022 flood (30 March)", "2022-03-19", "2022-03-31")

# Recorded floods (Lismore gauge, Wilsons River), each with a source. Used to check the river signal, not to tune it.
RECORDED = [
    ("2009-05-20", "2009-05-24", "May 2009: major flooding on the Wilsons and Richmond rivers", "Australian Severe Weather flood archive"),
    ("2013-01-27", "2013-01-29", "Ex-Cyclone Oswald: ~2,000 evacuated around Lismore and Grafton", "AIDR Knowledge Hub: Cyclone Oswald 2013"),
    ("2017-03-30", "2017-04-01", "Cyclone Debbie: Lismore 11.6 m", "Lismore City Council, flood history"),
    ("2022-02-27", "2022-03-01", "Record flood: Lismore 14.4 m, Woodburn and Broadwater mill under water", "Lismore City Council; ABC; Richmond Valley Council"),
    ("2022-03-29", "2022-03-31", "Second 2022 flood: Lismore 11.4 m", "FloodList; ABC, 30 March 2022"),
    ("2025-03-06", "2025-03-10", "Cyclone Alfred: Lismore 9.31 m", "Lismore City Council, flood history"),
]

cat = pystac_client.Client.open("https://planetarycomputer.microsoft.com/api/stac/v1", modifier=pc.sign_inplace)


def item(coll, dt_range=None, contains=None):
    items = [i for i in cat.search(collections=[coll], bbox=[W, S, E, N], datetime=dt_range).items() if not contains or contains in i.id]
    assert items, f"no {coll} item for {dt_range} {contains}"
    return items


def warp_mosaic(items, asset, resampling, dtype="float32"):
    # A box can straddle two tiles; fill from each in turn.
    out = np.zeros((HEIGHT, WIDTH), dtype=dtype)
    for it in items:
        tmp = np.zeros_like(out)
        with rasterio.open(it.assets[asset].href) as src:
            reproject(rasterio.band(src, 1), tmp, dst_transform=DST, dst_crs=CRS, resampling=resampling, dst_nodata=0)
        out = np.where(out == 0, tmp, out)
    return out


def glofas(start, end):
    r = requests.get("https://flood-api.open-meteo.com/v1/flood", params={"latitude": GLOFAS[0], "longitude": GLOFAS[1], "daily": "river_discharge", "start_date": start, "end_date": end}, timeout=120)
    r.raise_for_status()
    d = r.json()["daily"]
    return [dt.date.fromisoformat(t) for t in d["time"]], np.array([np.nan if x is None else x for x in d["river_discharge"]])


def px(lat, lng):
    return int((N - lat) / RES), int((lng - W) / RES)


def floodplain(dem, land):
    # HAND: height above the nearest permanent water (the river channels, or the sea at Evans Head)
    water = land == 80
    lab, n = ndimage.label(water)
    sizes = ndimage.sum(water, lab, range(1, n + 1))
    drain = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s > 300])
    drain_elev = np.where(drain, ndimage.minimum_filter(dem, size=3), np.nan)
    dist, (iy, ix) = ndimage.distance_transform_edt(~drain, return_indices=True)
    # ponytail: straight-line nearest drainage, not D8 flow routing; fine on a flat floodplain.
    hand = np.clip(dem - drain_elev[iy, ix], 0, 6000)
    plain = (~water) & (dist < 70) & (dem < 15)
    return water, hand, plain


def s1_db(day):
    it = item("sentinel-1-rtc", f"{day}/{day}")
    lin = warp_mosaic(it, "vv", Resampling.average)
    db = 10 * np.log10(np.maximum(ndimage.uniform_filter(np.where(lin > 0, lin, 1e-3), 5), 1e-6))
    # Some passes cover only part of the box; outside the swath (and its smeared edge) is no data, not dark water.
    return np.where(ndimage.binary_erosion(lin > 0, np.ones((7, 7)), border_value=1), db, np.nan)


def s1_water(day_before, day_after, water):
    before, after = s1_db(day_before), s1_db(day_after)
    seen = np.isfinite(after) & np.isfinite(before) & (after > -40)
    return ndimage.binary_opening((after < -15) & ((after - before) < -3) & ~water & seen, np.ones((3, 3))), seen


def agreement_png(path, dem, water, pred, observed):
    gy, gx = np.gradient(dem, RES * 111_320, RES * 111_320 * np.cos(np.radians(-29.03)))
    shade = np.clip(0.55 + (-gx * 0.7 + gy * 0.7) * 3, 0.25, 1.0)
    base = (np.stack([shade] * 3, -1) * np.array([60, 72, 64])).astype("uint8")
    base[water] = (40, 70, 110)
    base[pred & observed] = (93, 170, 110)  # agree: flooded
    base[observed & ~pred] = (90, 143, 216)  # satellite saw water the model missed
    base[pred & ~observed] = (212, 167, 44)  # model flooded, satellite saw none
    Image.fromarray(base, "RGB").save(path, optimize=True)


def blind_check(dem, land, hand, river, demo):
    """Out-of-sample check: the frozen river curve (meta.river) at the held-out day's GloFAS flow vs that day's Sentinel-1 water. Fits nothing."""
    name, b, a = BLIND
    water, _, plain = floodplain(dem, land)
    q = float(glofas(a, a)[1][0])
    stage = 0.0 if q <= river["q2"] else river["h0"] + river["k"] * (np.sqrt(q) - np.sqrt(river["q2"]))  # riverStage() in flood.ts
    observed, seen = s1_water(b, a, water)
    judged = plain & seen
    pred = (hand < stage) & judged
    obs = observed & judged
    hits, misses, fa = int((pred & obs).sum()), int((~pred & obs).sum()), int((pred & ~obs).sum())
    y0, x0 = px(*demo[0])
    y1, x1 = px(*demo[2])
    blk = (slice(y0, y1), slice(x0, x1))
    demo_seen = bool(seen[blk].all())
    agreement_png(OUT / "agreement-blind.png", dem, water, pred, observed)
    out = {
        "event": name, "before": b, "after": a, "dischargeThatDay": round(q), "stageM": round(float(stage), 2),
        "csi": round(hits / max(1, hits + misses + fa), 3), "hits": hits, "misses": misses, "falseAlarms": fa,
        "observedHa": round(float(obs.sum() * CELL_HA)), "modelHa": round(float(pred.sum() * CELL_HA)),
        "judgedHa": round(float(judged.sum() * CELL_HA)), "floodplainSeen": round(float(judged.sum() / plain.sum()), 2),
        "demoObserved": round(float(observed[blk].mean()), 2) if demo_seen else None,
        "demoModel": round(float((hand[blk] < stage).mean()), 2) if demo_seen else None,
        "note": "Blind: river curve frozen from the 2 March 2022 fit, run at this day's GloFAS flow; nothing refitted. Different flood, date and orbit."
                " This pass only covers the western part of the floodplain (Coraki side), so scores are for that part; the demo block is outside it.",
    }
    print("blind check:", out)
    return out


if "--blind" in sys.argv:
    # Patch only meta.json["sentinel1Blind"] (+ agreement-blind.png) from the files already built; the rest stays byte-identical.
    meta = json.loads((OUT / "meta.json").read_text())
    dem = np.fromfile(OUT / "dem.bin", "<i2").reshape(HEIGHT, WIDTH) / 10
    land = np.fromfile(OUT / "land.bin", "u1").reshape(HEIGHT, WIDTH)
    hand = np.fromfile(OUT / "hand.bin", "<u2").reshape(HEIGHT, WIDTH) / 10  # what the site reads
    meta["sentinel1Blind"] = blind_check(dem, land, hand, meta["river"], meta["demo"])
    (OUT / "meta.json").write_text(json.dumps(meta, indent=2))
    sys.exit()


print(f"grid {WIDTH}x{HEIGHT}")
dem = warp_mosaic(item("cop-dem-glo-30"), "data", Resampling.bilinear)
land = warp_mosaic([i for i in item("esa-worldcover") if "2021" in i.id], "map", Resampling.mode, "uint8")

water, hand, plain = floodplain(dem, land)

# ---- River climatology ----
days, Q = glofas("1984-01-01", (dt.date.today() - dt.timedelta(days=1)).isoformat())
years = [y for y in sorted({d.year for d in days}) if np.isfinite(Q[[d.year == y for d in days]]).sum() > 300 and y < dt.date.today().year]
annmax = np.array([np.nanmax(Q[[d.year == y for d in days]]) for y in years])
q2, q5 = (float(np.percentile(annmax, p)) for p in (50, 80))
ev_days, ev_q = glofas(*EVENT)
q_peak = float(np.nanmax(ev_q))
q_image = float(Q[days.index(dt.date.fromisoformat(S1_AFTER))])
h0 = float(np.percentile(hand[plain], 2))
print(f"Q2 {q2:.0f}  Q5 {q5:.0f}  Feb-2022 peak {q_peak:.0f}  on image day {q_image:.0f} m3/s  h0 {h0:.2f} m")

# ---- What Sentinel-1 saw on 2 March 2022 ----
observed, seen = s1_water(S1_BEFORE, S1_AFTER, water)
print(f"Sentinel-1 new open water on {S1_AFTER}: {observed.sum() * CELL_HA:.0f} ha")

# ---- Calibrate k on that image: the river level that best explains where the water was ----
judged = plain & seen
obs = observed[judged]
hj = hand[judged]


def scores(stage):
    pred = hj < stage
    hits, misses, fa = int((pred & obs).sum()), int((~pred & obs).sum()), int((pred & ~obs).sum())
    return {"csi": round(hits / max(1, hits + misses + fa), 3), "hits": hits, "misses": misses, "falseAlarms": fa}


best = max(np.arange(0.2, 12, 0.05), key=lambda s: scores(s)["csi"])
k = (best - h0) / max(1e-6, np.sqrt(q_image) - np.sqrt(q2))
fit = scores(best)


def stage(q):
    return 0.0 if q <= q2 else h0 + k * (np.sqrt(q) - np.sqrt(q2))  # same as riverStage() in web/src/lib/flood.ts


wy, wx = px(*WOODBURN)
woodburn_hand = float(np.median(hand[wy - 4:wy + 5, wx - 4:wx + 5]))
print(f"best stage on image day {best:.2f} m -> k {k:.3f}; CSI {fit}; at the peak the river stands {stage(q_peak):.1f} m; Woodburn sits {woodburn_hand:.1f} m above it")

# ---- Demo field: a ~40 ha block of farmland near Broadwater mill, on the floodplain ----
farm = np.isin(land, [30, 40]).astype(float)
size = 22  # cells per side, ~640 m
share = ndimage.uniform_filter(farm, size)
low = ndimage.uniform_filter(((hand > 0.5) & (hand < 6)).astype(float), size)
my, mx = px(*BROADWATER_MILL)
yy, xx = np.mgrid[0:HEIGHT, 0:WIDTH]
near = np.hypot(yy - my, xx - mx) < 120  # within ~3.5 km
score = np.where(near & ~water, share * low, -1)
cy, cx = np.unravel_index(np.argmax(score), score.shape)
half = size // 2
lat0, lng0 = N - (cy - half) * RES, W + (cx - half) * RES
lat1, lng1 = N - (cy + half) * RES, W + (cx + half) * RES
demo = [[round(lat0, 5), round(lng0, 5)], [round(lat0, 5), round(lng1, 5)], [round(lat1, 5), round(lng1, 5)], [round(lat1, 5), round(lng0, 5)]]
blk = (slice(cy - half, cy + half), slice(cx - half, cx + half))
demo_obs = observed[blk]
demo_pred = hand[blk] < best
print("demo field", demo, f"farmland {share[cy, cx]:.0%}", f"observed flooded {demo_obs.mean():.0%}, model {demo_pred.mean():.0%}")

# ---- Recorded floods ----
V = Q[np.isfinite(Q)]
record = []
for a, b, name, src in RECORDED:
    lo, hi = dt.date.fromisoformat(a) - dt.timedelta(days=1), dt.date.fromisoformat(b) + dt.timedelta(days=1)
    pk = float(np.nanmax(Q[[lo <= d <= hi for d in days]]))
    level = "act" if pk >= q5 else "watch" if pk >= q2 else "missed"
    record.append({"start": a, "end": b, "name": name, "source": src, "peak": round(pk), "level": level, "percentile": round(100 * float((V < pk).mean()), 2)})
    print(f"  {a} {name[:45]:45s} peak {pk:6.0f} -> {level}")
eps, last = [], None
for d, x in zip(days, Q):
    if d.year >= 2009 and x >= q5:
        if last is None or (d - last).days > 5:
            eps.append(d)
        last = d
windows = [(dt.date.fromisoformat(r["start"]) - dt.timedelta(days=3), dt.date.fromisoformat(r["end"]) + dt.timedelta(days=3)) for r in record]
unmatched = [e.isoformat() for e in eps if not any(lo <= e <= hi for lo, hi in windows)]
print("act-level episodes since 2009:", len(eps), "unmatched:", unmatched)

# ---- Replay + history ----
wx_ = requests.get(
    "https://archive-api.open-meteo.com/v1/archive",
    params={"latitude": round((lat0 + lat1) / 2, 4), "longitude": round((lng0 + lng1) / 2, 4), "timezone": "Australia/Sydney", "hourly": "precipitation",
            "daily": "precipitation_sum,temperature_2m_max,weather_code", "start_date": EVENT[0], "end_date": EVENT[1]},
    timeout=60,
).json()
(OUT / "event.json").write_text(json.dumps({
    "hourly": {"time": wx_["hourly"]["time"], "rain": wx_["hourly"]["precipitation"]},
    "daily": {"time": wx_["daily"]["time"], "rain": wx_["daily"]["precipitation_sum"], "temp": wx_["daily"]["temperature_2m_max"],
              "code": wx_["daily"]["weather_code"], "discharge": [None if np.isnan(x) else float(x) for x in ev_q]},
}))
first = next(i for i, x in enumerate(Q) if np.isfinite(x))
weeks = [(days[i].isoformat(), round(float(np.nanmax(Q[i:i + 7])))) for i in range(first, len(Q) - 6, 7) if np.isfinite(Q[i:i + 7]).any()]
(OUT / "flow.json").write_text(json.dumps({"time": [w[0] for w in weeks], "q": [w[1] for w in weeks]}))

np.round(dem * 10).astype("<i2").tofile(OUT / "dem.bin")
np.round(hand * 10).astype("<u2").tofile(OUT / "hand.bin")
land.astype("u1").tofile(OUT / "land.bin")
rgba = np.zeros((HEIGHT, WIDTH, 4), dtype="uint8")
rgba[observed] = (157, 184, 218, 210)
Image.fromarray(rgba, "RGBA").save(OUT / "water.png", optimize=True)

# Agreement map for the Validation page: model (at the image day's river level) vs what Sentinel-1 saw, over a hillshade.
agreement_png(OUT / "agreement.png", dem, water, (hand < best) & plain & seen, observed)
river = {"q2": round(q2), "q5": round(q5), "h0": round(h0, 2), "k": round(float(k), 4), "eventPeak": round(q_peak)}

(OUT / "meta.json").write_text(json.dumps({
    "name": "Lower Richmond River, NSW",
    "bbox": [W, S, E, N], "width": WIDTH, "height": HEIGHT, "res": RES,
    "glofas": GLOFAS,
    "demo": demo,
    "event": {"name": "February 2022 flood", "start": EVENT[0], "end": EVENT[1]},
    "river": river,
    "sentinel1": {
        "before": S1_BEFORE, "after": S1_AFTER, "observedHa": round(float(observed.sum() * CELL_HA)), "dischargeThatDay": round(q_image),
        **fit,
        "demoObserved": round(float(demo_obs.mean()), 2), "demoModel": round(float(demo_pred.mean()), 2),
        "note": "Calibrated on this image (in-sample). The image is ~2 days after the peak, so the observed water is a lower bound for the peak flood.",
    },
    "sentinel1Blind": blind_check(dem, land, hand, river, demo),
    "checks": {"woodburnAboveRiverM": round(woodburn_hand, 1), "stageAtPeakM": round(float(stage(q_peak)), 1)},
    "record": record,
    "unmatchedAlarms": unmatched,
    "sources": [
        "Copernicus DEM GLO-30, via Microsoft Planetary Computer",
        "ESA WorldCover 2021 v200, via Microsoft Planetary Computer",
        "Sentinel-1A RTC (Copernicus, EU), via Microsoft Planetary Computer",
        "GloFAS v4 river discharge (Copernicus EMS), via Open-Meteo Flood API",
        "ERA5 reanalysis rain (Copernicus C3S), via Open-Meteo archive API",
    ],
}, indent=2))
print("wrote", OUT)
