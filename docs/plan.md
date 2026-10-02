# Draki: making it work on real data

**Written:** Fri 2 Oct 2026.
**Deadline:** submissions close 9pm AEDT Sun 4 Oct.

**Goal:** every number in the demo comes from real data, and section 05 shows the model checked against a real satellite flood map.

## Where we are

| Piece | Today | Real? |
|---|---|---|
| Rain forecast | Open-Meteo 7-day forecast | ✅ real |
| Cyclone Cody replay | ERA5 archive rain, 6–12 Jan 2022 | ✅ real |
| Elevation | Copernicus GLO-90 via Open-Meteo: **90 m** cells, max 100 points per call | ⚠️ real but coarse; a 40 ha block is only ~50 cells |
| Flood model | "Bathtub": rain that falls *on the field* pools in its low cells | ❌ **wrong mechanism.** Ba floods because the **Ba River overtops its banks**, not because rain pools on the paddock |
| Land / crop | Whole drawn polygon assumed to be cane at F$3,825/ha | ⚠️ assumption, uncited |
| Climate "why" line | Static Ba numbers pulled once from ERA5 | ✅ real, but only for Ba |
| Validation (section 05) | "Coming next" | ❌ missing |
| SMS | On-screen mock | mock |

## Verified data sources (all free, no API key)

| Source | What it gives us | Checked |
|---|---|---|
| **Open-Meteo Flood API** (GloFAS v4) `flood-api.open-meteo.com/v1/flood` | Daily river discharge: history from 1984, plus a forecast | Ba main-channel cell **−17.525, 177.625**. Cody peak **1,090 m³/s on 9 Jan 2022**, against ~4 m³/s before. (The cell at 177.675 is a side stream, peaking at 85.) |
| **AWS Terrain Tiles** (Terrarium PNG) `s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png` | Elevation encoded in PNG pixels. Source in Fiji is roughly SRTM 30 m | CORS `*`, so the browser can decode pixels in a canvas |
| **Microsoft Planetary Computer** STAC: `sentinel-1-rtc`, `esa-worldcover` | Sentinel-1 radar (flood mapping) and ESA WorldCover 10 m land cover | S1A descending passes on **30 Dec 2021** (before) and **11 Jan 2022 17:40 UTC** (after, ~2.5 days after peak) |
| **Open-Meteo Ensemble API** | Many forecast versions, which gives a probability instead of one number | Not yet probed |
| **OSM Overpass API** | The Ba River's centreline (`waterway=river`) | Not yet probed |

## Workstreams, in priority order

### P0-1. Model the river, not just the rain (most important, ~5 h)
Ba's damaging floods are overbank flooding from the Ba River. We switch to the standard quick method, **HAND (Height Above Nearest Drainage)**:
1. **Get the river line.** Fetch it from Overpass once and ship it as static GeoJSON in `web/public/data/ba-river.json`.
2. **Compute HAND per cell.** For each field cell: `HAND = cell elevation − elevation of the nearest river point`.
3. **Fetch discharge.** Get GloFAS discharge for the main-channel cell: the forecast for live mode, the archive for the Cody replay.
4. **Convert discharge to water level.** Use a simple rating curve, `stage = a · Q^b` metres above the normal river level, with `a` and `b` tuned in P0-3.
5. **Combine.** `depth = max(river: stage − HAND, rain: current bathtub depth)`. Keep the bathtub for ponding from local rain.
6. **Explain it on the page.** Update "How the model got there": add river discharge and water level, and the "lumpy bathtub" copy becomes "the river rises; anything lower than the water floods".

**Done when:**
- The Cody replay floods the low ground near the river, not just the low corner of the field.
- `flood.check.ts` gains HAND tests.

### P0-2. Sharper elevation (~3 h)
- **Replace** the Open-Meteo GLO-90 call with Terrarium tiles at zoom 15. Elevation = `(R·256 + G + B/256) − 32768`.
- **Sample more points.** Decode the tiles once into a grid at ~30 m spacing. There's no 100-point cap any more.
- **Cache** decoded tiles (the localStorage cache already exists; tiles may need IndexedDB).
- **Be honest about it.** On the page, say "~30 m elevation (SRTM). 1 m LiDAR would sharpen this; Fiji doesn't have it publicly yet". That gap is a good roadmap point.

**Done when:** the demo block has 400+ cells and the flood edges follow the land.

### P0-3. Validation against Sentinel-1 (section 05, ~5 h, can run in parallel)
This is an offline Python script in `scripts/s1_flood.py`, using Planetary Computer, `pystac-client` and `rioxarray`:
1. **Load the radar pair.** S1 RTC VV backscatter for 30 Dec 2021 and 11 Jan 2022 over the Ba floodplain bounding box.
2. **Find the water.** Mark a pixel as water where `VV_after < −18 dB` **and** `VV_after − VV_before < −3 dB`. Remove specks with a 3×3 majority filter.
3. **Export the water mask** as GeoJSON to `web/public/data/cody-s1-water.json`.
4. **Score the model.** Compare the model's Cody replay against the water mask: hits, misses and false alarms, plus the critical success index (CSI). Score the demo block and also the wider floodplain, so the result isn't one cherry-picked block.
5. **Tune the rating curve** (`a`, `b`) from P0-1 on this event, and **say so on the page**. With one event, tuning and testing on the same data is a known limitation. If time allows, test on a second event (a Ba flood with an S1 pass, e.g. March 2023).
6. **Show it on the site.**
   - Section 05: a predicted-vs-observed overlay on the map, the CSI, and one honest miss.
   - Caveat: the radar image is from ~2.5 days after the peak, so the water it shows is a *lower bound*.

**Done when:** section 05 shows a real number and an overlay, and the "Coming next" placeholder is gone.

### P1-4. Real land (~2 h)
- **Cropland mask.** Precompute ESA WorldCover 2021 (10 m) for the Ba area in the same Python script. Count F$ at risk only on cropland cells, and show non-crop cells (houses, roads, river) differently.
- **Cane value.** Replace the 45 t/ha × F$85/t assumption with cited figures (Fiji Sugar Corporation or SRIF annual report: average yield and cane price per tonne). Keep it as a knob and cite the source in the footer.
- **Field boundaries.** The farmer or extension officer still draws them; that stays. Fiji's land registry (FLIS) has no open API. Note it as a future integration.

### P1-5. Forecast confidence (~2 h)
- **Probability of flooding.** Pull the Ensemble API rain members and GloFAS ensemble discharge. Run the model per member and report a probability: "In 7 of 10 forecasts your low corner floods."
- **Use it in the alert.** The SMS header becomes `FLOOD RISK HIGH (70%)`.

**Done when:** live mode shows a probability, not a single yes/no.

### P1-6. Make the demo bulletproof (~1 h, do this early)
- **Ship the Cody replay as static JSON in `web/public/data/`:** rain, discharge, elevation and the S1 mask. The judging video and the live judges' click-through then never depend on Open-Meteo, which already rate-limited us (HTTP 429) once.
- **Live mode keeps calling the APIs** and falls back to the static replay if they fail.

### P2-7. The "why" line for any field (~1 h)
- **Compute per field.** Count 50 mm+ rain days per year from the ERA5 archive for the drawn field's location: one request, cached. That replaces the static Ba array.
- **Keep Ba precomputed** for the demo.

### P2-8. Real SMS (stretch, team decision)
- **What it is.** Use a Twilio trial and a tiny serverless function (Netlify or Vercel) to send the alert to the presenter's own verified phone on camera.
- **Costs.** It needs an account, keeps secrets out of the repo (use environment variables only), and has to be listed under tools used.
- **Recommendation.** Only do it if P0 is finished by Saturday night. The on-screen mock is fine for judging.

## Timeline

| When | Peter | Siddhant | Adin |
|---|---|---|---|
| Fri evening | P1-6 static replay data, then start P0-2 elevation tiles | P0-3: set up Python, pull the S1 pair, get a first water mask | P0-1: river GeoJSON from Overpass, HAND function + tests |
| Sat morning | Finish P0-2 | P0-3 water mask → GeoJSON, scoring script | P0-1 wire discharge + rating curve into the model |
| Sat afternoon | P1-5 ensemble probability | P0-3 tune `a`, `b`, write section 05 numbers | P1-4 cropland mask + cited cane value |
| Sat night | **Integration**: replay end-to-end, check the numbers make sense | Section 05 overlay on the map | P2-7 per-field "why" |
| Sun to 12pm | Bug fixes only. **Feature freeze at 12pm.** | README tools list and data sources | Pitch text, Junction fields |
| Sun 12–5pm | Record the ≤2 min demo video | | |
| Sun by 6pm | **Submit** (3 h buffer before the 9pm close). Small fixes only after that. | | |

Who does what is only a suggestion. Swap freely.

## Risks

| Risk | Mitigation |
|---|---|
| The S1 image is 2.5 days after the peak, so the observed flood is already shrinking | Call the observed extent a lower bound; judge mainly on whether the flooded areas match, not on how many ha |
| Discharge-to-level is a guess with one event | Show `a` and `b` as knobs, state that we tuned them, and test on a second event if possible |
| Terrarium tiles may be coarse in Fiji | Measure the effective resolution; fall back to GLO-90 if the tiles add nothing |
| Open-Meteo rate limit during judging | Static replay data (P1-6) plus the existing localStorage cache |
| Scope creep | Only P0 items are required. P1 if there's time. P2 only if everything else works. |

## Every new source goes in the README tools list
GloFAS via Open-Meteo Flood API, AWS Terrain Tiles (Mapzen/Tilezen, SRTM), Microsoft Planetary Computer, Sentinel-1 (Copernicus, EU), ESA WorldCover, OpenStreetMap (ODbL), the Python libraries used, and any AI tools.
