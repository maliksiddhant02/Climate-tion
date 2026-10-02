# Idea brainstorm (2026-10-02)

These ideas were scored with [hackathon-idea-evaluator](../.claude/skills/hackathon-idea-evaluator/SKILL.md).

- **Scale:** each dimension is scored 1–10.
- **Columns:** N = novelty, F = feasibility, S = scalability, I = impact, D = demo-ability, Fit = domain fit.
- **Weighted** copies the real judging criteria: 0.3·Fit + 0.3·F + 0.2·N + 0.2·D.

| # | Idea (track) | N | F | S | I | D | Fit | /60 | Weighted |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **Bill→Retrofit**: upload an energy bill, AI reads it, compares the building's energy use per m² to the NABERS benchmark (Australia's building energy rating) and suggests retrofits to cut it 25% (Buildings) | 6 | 8 | 8 | 7 | 9 | 9 | 47 | **8.1** |
| 2 | **Greenwash Checker**: paste a climate claim or ad, it flags greenwashing tactics against the EU's green-claims rules and cites sources (Awareness) | 6 | 8 | 8 | 6 | 9 | 9 | 46 | **8.1** |
| 3 | **Island Microgrid Sizer**: click a Pacific village on a map to size a solar and battery system that replaces diesel, using free NASA solar data (Electrification) | 5 | 8 | 6 | 7 | 8 | 10 | 44 | **8.0** |
| 4 | **Renter Energy Score**: rate your rental's energy use and auto-write a retrofit request to your landlord (Buildings) | 6 | 8 | 7 | 6 | 7 | 9 | 43 | 7.7 |
| 5 | **Pacific Farm Advisor**: SMS or WhatsApp seasonal climate advice in Fijian, Samoan or Tongan (Awareness) | 7 | 6 | 7 | 8 | 7 | 10 | 45 | 7.6 |
| 6 | **Plug-in Timer**: live grid carbon intensity tells you when to charge an EV or run appliances (Electrification) | 4 | 9 | 8 | 5 | 8 | 8 | 42 | 7.5 |
| 7 | **Heat Refuge Map**: weather-forecast heat alerts plus a route to the nearest cool public space (Buildings) | 6 | 7 | 7 | 7 | 8 | 8 | 43 | 7.3 |
| 8 | **Plug Swap**: plans the order to swap gas appliances for electric, with rebates and payback (Electrification) | 4 | 8 | 7 | 6 | 7 | 9 | 41 | 7.3 |
| 9 | **Repair-not-Replace**: photo of a broken item gives a diagnosis, nearby repair cafés and the materials saved (Industrialisation) | 6 | 7 | 7 | 6 | 8 | 8 | 42 | 7.3 |
| 10 | **My Suburb in 2035**: enter an address to see projected heat and flood risk plus local actions (Awareness) | 5 | 7 | 8 | 5 | 9 | 8 | 42 | 7.3 |
| 11 | **NDC Explainer**: each country's climate plan in plain language, measured against the 2035 targets (Awareness) | 4 | 9 | 8 | 4 | 7 | 8 | 40 | 7.3 |
| 12 | **Industrial Symbiosis**: matches one factory's waste to another factory's inputs (Industrialisation) | 6 | 6 | 7 | 6 | 7 | 9 | 41 | 7.1 |
| 13 | **Cyclone-Ready Check**: AI checks a photo of a Pacific home's roof tie-downs (Buildings) | 7 | 5 | 6 | 7 | 7 | 9 | 41 | 7.0 |
| 14 | **Snap-to-Sort**: photo of an item tells you which council bin it goes in (Waste) | 4 | 7 | 7 | 5 | 9 | 7 | 39 | 6.8 |
| 15 | **Landfill Methane Estimator**: methane estimates for landfills from satellite data and the standard IPCC waste model (Waste) | 6 | 5 | 6 | 6 | 6 | 8 | 37 | 6.3 |
| 16 | **Food Rescue Matcher**: connects cafés' surplus food with charities (Waste) | 3 | 6 | 6 | 6 | 6 | 8 | 35 | 6.0 |

**Abandon:** #14, #15 and #16. They score under 40, already exist (Recycle Mate, OzHarvest), or need data we can't get in time.

## Team ideas (round 2)

| # | Idea (track) | N | F | S | I | D | Fit | /60 | Weighted |
|---|---|---|---|---|---|---|---|---|---|
| 17 | **FarmShield**: hyper-local farm weather plus elevation data gives field-level flood and frost risk and today's actions (Awareness: climate-resilient farming) | 6 | 7 | 7 | 7 | 8 | 9 | 44 | **7.6** |
| 18 | **EcoRoute**: compares the emissions of each route and transport mode, nudges "6 min later, −42% CO₂", with an impact dashboard | 3 | 9 | 8 | 4 | 8 | 5 | 37 | 6.4 |
| 19 | **EchoEarth**: 3D/360° scans of places at risk from climate change, explorable in AR/VR | 4 | 6 | 6 | 4 | 8 | 5 | 33 | 5.7 |

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

## Top pick: BillShift (#1 + #8, optionally #3)
Upload an Australian electricity or gas bill, or a Pacific diesel fuel log. The app pulls out the usage, then produces an electrification and efficiency plan with $ saved, CO₂ saved and payback. It names two 2035 targets: 35% electrification and a 25% cut in buildings' energy use per m².

- Score: N6 F8 S8 I7 D9 Fit10, which is **48/60 and 8.4 weighted**.
- Demo: upload a real bill live and a plan appears.
- Biggest risk is novelty. Rewiring Australia already has a household electrification calculator.
- To fix that, add a Pacific mode (diesel log in, solar sizing out). That takes novelty to about 7 and costs about 1 point of feasibility.

## Runner-up: Greenwash Checker (#2)
It's the safest build and fits the EU climate-disinformation material in the brief. The catch is that judges may see it as a ChatGPT wrapper.
