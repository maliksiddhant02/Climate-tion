# Idea brainstorm (2026-10-02)

These ideas were scored with [hackathon-idea-evaluator](../.claude/skills/hackathon-idea-evaluator/SKILL.md).

- **Scale:** each dimension is scored 1–10.
- **Columns:** N = novelty, F = feasibility, S = scalability, I = impact, D = demo-ability, Fit = domain fit.
- **Weighted** copies the real judging criteria: 0.3·Fit + 0.3·F + 0.2·N + 0.2·D.

| # | Idea (track) | N | F | S | I | D | Fit | /60 | Weighted |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **Bill→Retrofit** (Buildings) | 6 | 8 | 8 | 7 | 9 | 9 | 47 | **8.1** |
| 2 | **Greenwash Checker** (Awareness) | 6 | 8 | 8 | 6 | 9 | 9 | 46 | **8.1** |
| 3 | **Island Microgrid Sizer** (Electrification) | 5 | 8 | 6 | 7 | 8 | 10 | 44 | **8.0** |
| 4 | **Renter Energy Score** (Buildings) | 6 | 8 | 7 | 6 | 7 | 9 | 43 | 7.7 |
| 5 | **Pacific Farm Advisor** (Awareness) | 7 | 6 | 7 | 8 | 7 | 10 | 45 | 7.6 |
| 6 | **Plug-in Timer** (Electrification) | 4 | 9 | 8 | 5 | 8 | 8 | 42 | 7.5 |
| 7 | **Heat Refuge Map** (Buildings) | 6 | 7 | 7 | 7 | 8 | 8 | 43 | 7.3 |
| 8 | **Plug Swap** (Electrification) | 4 | 8 | 7 | 6 | 7 | 9 | 41 | 7.3 |
| 9 | **Repair-not-Replace** (Industrialisation) | 6 | 7 | 7 | 6 | 8 | 8 | 42 | 7.3 |
| 10 | **My Suburb in 2035** (Awareness) | 5 | 7 | 8 | 5 | 9 | 8 | 42 | 7.3 |
| 11 | **NDC Explainer** (Awareness) | 4 | 9 | 8 | 4 | 7 | 8 | 40 | 7.3 |
| 12 | **Industrial Symbiosis** (Industrialisation) | 6 | 6 | 7 | 6 | 7 | 9 | 41 | 7.1 |
| 13 | **Cyclone-Ready Check** (Buildings) | 7 | 5 | 6 | 7 | 7 | 9 | 41 | 7.0 |
| 14 | **Snap-to-Sort** (Waste) | 4 | 7 | 7 | 5 | 9 | 7 | 39 | 6.8 |
| 15 | **Landfill Methane Estimator** (Waste) | 6 | 5 | 6 | 6 | 6 | 8 | 37 | 6.3 |
| 16 | **Food Rescue Matcher** (Waste) | 3 | 6 | 6 | 6 | 6 | 8 | 35 | 6.0 |

- **1. Bill→Retrofit:** upload an energy bill, AI reads it, compares the building's energy use per m² to the NABERS benchmark (Australia's building energy rating) and suggests retrofits to cut it 25%
- **2. Greenwash Checker:** paste a climate claim or ad, it flags greenwashing tactics against the EU's green-claims rules and cites sources
- **3. Island Microgrid Sizer:** click a Pacific village on a map to size a solar and battery system that replaces diesel, using free NASA solar data
- **4. Renter Energy Score:** rate your rental's energy use and auto-write a retrofit request to your landlord
- **5. Pacific Farm Advisor:** SMS or WhatsApp seasonal climate advice in Fijian, Samoan or Tongan
- **6. Plug-in Timer:** live grid carbon intensity tells you when to charge an EV or run appliances
- **7. Heat Refuge Map:** weather-forecast heat alerts plus a route to the nearest cool public space
- **8. Plug Swap:** plans the order to swap gas appliances for electric, with rebates and payback
- **9. Repair-not-Replace:** photo of a broken item gives a diagnosis, nearby repair cafés and the materials saved
- **10. My Suburb in 2035:** enter an address to see projected heat and flood risk plus local actions
- **11. NDC Explainer:** each country's climate plan in plain language, measured against the 2035 targets
- **12. Industrial Symbiosis:** matches one factory's waste to another factory's inputs
- **13. Cyclone-Ready Check:** AI checks a photo of a Pacific home's roof tie-downs
- **14. Snap-to-Sort:** photo of an item tells you which council bin it goes in
- **15. Landfill Methane Estimator:** methane estimates for landfills from satellite data and the standard IPCC waste model
- **16. Food Rescue Matcher:** connects cafés' surplus food with charities

**Abandon:** #14, #15 and #16. They score under 40, already exist (Recycle Mate, OzHarvest), or need data we can't get in time.

## Team ideas (round 2)

| # | Idea (track) | N | F | S | I | D | Fit | /60 | Weighted |
|---|---|---|---|---|---|---|---|---|---|
| 17 | **FarmShield** (Awareness) | 6 | 7 | 7 | 7 | 8 | 9 | 44 | **7.6** |
| 18 | **EcoRoute** (no clear track) | 3 | 9 | 8 | 4 | 8 | 5 | 37 | 6.4 |
| 19 | **EchoEarth** (no clear track) | 4 | 6 | 6 | 4 | 8 | 5 | 33 | 5.7 |

- **17. FarmShield:** hyper-local farm weather plus elevation data gives field-level flood and frost risk and today's actions (climate-resilient farming)
- **18. EcoRoute:** compares the emissions of each route and transport mode, nudges "6 min later, −42% CO₂", with an impact dashboard
- **19. EchoEarth:** 3D/360° scans of places at risk from climate change, explorable in AR/VR

**FarmShield: Pivot, then build.** It's a solid idea.
- **Fit:** the guide names climate-resilient farming under the Awareness track.
- **Data:** free sources cover it: Open-Meteo for forecasts, plus elevation models (Geoscience Australia ELVIS, or SRTM globally) to find low-lying parts of a field.
- **Demo:** draw a field on a map, a storm comes in, the low spots light up and a list of actions appears.
- **Risks:**
  - Scope creep: the rough notes reach into crop prices, forums and pesticides. Cut all of that.
  - Novelty: Climate FieldView, DTN and CropX already offer farm weather tools.
- **To gain points:**
  - Merge with #5 Pacific Farm Advisor. Target Pacific smallholders (Fiji sugarcane, cyclones) and give advice in Fijian, Samoan or Tongan. That gives Fit 10, N7, about **47/60 and 8.0 weighted**.
  - Stick to one hazard (flood) and do it well.

**EcoRoute: Abandon.**
- Google Maps already offers eco-friendly routing and shows CO₂ per transport mode, so novelty is 3.
- Shifting how people travel isn't one of the five tracks or targets, so fit is weak.
- Persuading people to change how they travel is the hard part, and judges know it.

**EchoEarth: Abandon or pivot.**
- **Prior work:** Tuvalu already announced a "digital nation" scan of itself at COP27, and photogrammetry apps already exist.
- **Targets:** preserving places doesn't move any 2035 target. It's closer to Loss & Damage than to the five tracks.
- **Hardware:** drones are a hardware gap.
- **Salvage:** a "Your street in 2035" phone 360° capture with a sea-level-rise overlay could fit the Awareness track. It would land emotionally given the Tuvalu Leaders' event, but it would still be about 40/60.

## Team pick: FarmShield v2 (improved #17), now named Draki
This is our own idea, so the team prefers it to the AI-generated ones. BillShift (#1 + #8) has been dropped.

**One-liner:** field-level flood warnings for smallholder farmers. They show exactly which part of the farm will flood, what to do today, and *why* (climate education built into every alert).

**Track and target:** Climate Awareness & Education, aimed at "climate action education for all by 2035" (Library), with climate-resilient farming as the route in (Participant Guide).
- Alignment is 30% of the score and also the tie-breaker. The Library asks us to point to the *exact* target, so the education part has to be core, not extra.

### MVP scope
1. **One place, one user, one hazard.** Pick the region the team is registered for:
   - Fiji sugarcane smallholders (Cyclone Winston, 2016). This is the strongest fit with the Library's Pacific focus and the Fiji/Tuvalu Pre-COP.
   - Northern Rivers, NSW (Lismore floods, 2022).
   - Hawke's Bay, NZ (Cyclone Gabrielle, 2023).
   - Hazard is flooding only. Frost, drought and heat go on a roadmap slide.
2. **Field-level risk map (the core novelty).** The farmer draws their field. We combine its elevation with the rainfall forecast to show which part of the paddock floods, not a generic storm warning.
3. **Education in every alert.** Each warning explains the *why*, e.g.:
   - "Rain like this is now X% more common here than in 1990."
   - "Here's why your low paddock floods."
   - "This is what climate change means for cane in Fiji."
4. **Rule-based actions.** A fixed playbook table per hazard × crop, e.g. "harvested cane: move off low ground", "machinery: move to the high point". The AI only puts it into plain language or translates it, and never invents farming advice.
5. **$ at risk** per paddock, from area × crop value.
6. **Delivery by SMS or WhatsApp,** in English plus Fijian or Hindi if we go Pacific. The map is only for setup, which handles patchy connectivity and older users.

### Free data
| Need | Source |
|---|---|
| Forecasts and historical weather | Open-Meteo (forecast + ERA5 archive) |
| Elevation | ELVIS 1m LiDAR (Australia); Open-Meteo elevation API or SRTM (elsewhere) |
| Real flood extent, for validation | Copernicus Sentinel-1 radar (EU data, sees through cloud) |

### Validation (Build quality is 30%)
Backtest against a real past flood:
1. Replay the forecast from a few days before the event.
2. Show the predicted flood zones next to the Sentinel-1 image of where it actually flooded.

The headline we want is something like "would have warned 3 days early; 4 of the 5 flagged paddocks went under."

### Pitch hooks from the Library
- **COP31 is about delivery.** This turns climate knowledge into action on the farm today.
- **Pacific-led solutions and the Blue Pacific,** with the Fiji/Tuvalu Pre-COP straight after the hackathon.
- **Scale and finance:** "Built to scale through the EU–Pacific Green Blue Alliance" (Team Europe has committed €650m+ to the Pacific). The challenge asks for solutions that make climate action easier to finance.
- **Optional second scenario:** saltwater getting into taro and pulaka pits in Tuvalu or Kiribati. The EU has formally named the sea-level threat to small island states.

### Cut from MVP
Crop prices, forums, pesticides, "what to grow", and scraping news or government notices.

### 2-minute demo
| Time | Content |
|---|---|
| 0:00–0:20 | The problem, with a real flood photo |
| 0:20–0:50 | The farmer draws their field |
| 0:50–1:20 | The storm comes in, the low spots light up red, and the $ at risk appears |
| 1:20–1:40 | The SMS alert arrives with three actions and a "why this is happening" line |
| 1:40–2:00 | The backtest next to the satellite image, plus the 2035 target |

**Re-score:** N7 F7 S7 I8 D9 Fit10, which is **48/60 and about 8.3 weighted**. That's the best on the list.

**Open question:** which region is the team registered for? That decides which flood to backtest.

## Runner-up: Greenwash Checker (#2)
It's the safest build and fits the EU climate-disinformation material in the brief. The catch is that judges may see it as a ChatGPT wrapper.
