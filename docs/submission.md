**Draki: flood warnings for every paddock.** Draki tells a farmer which part of their farm goes under in a flood, what to move before it does, and why heavy rain is getting more common.

**Track:** Climate Awareness & Education. **2035 target:** climate education for all, and climate-resilient farming.
**Team (Australia):**
- Siddhant Malik: idea and research
- Peter Ma: website and flood model
- Adin Sreekesh: final entry

### The problem
In February 2022, the river at Lismore hit 14.4 m, two metres above any flood on record. Flood warnings cover whole districts, so farmers couldn't tell which paddocks would go under. Very heavy rain days here have nearly tripled since the 1990s.

### What Draki does
- **Checks every 30 m of the farm** against Europe's Copernicus river forecast (50 runs) and the rain.
- **Texts the farmer on any phone:** what floods, what to move, and one line on why heavy rain is getting more common.
- **My farm:** the farmer marks paddocks and sheds once. Draki shows what a common flood or another 2022 would do to each paddock (ha and A$), plus a printable flood record for grants.

### Does it work?
- 72% match with Sentinel-1 radar for the 2022 flood.
- 54% on a blind test against a flood the model never saw.
- All 6 recorded floods since 2009 caught.
- The first alert came **45 hours** before the 2022 peak.

### Why it matters for COP31
COP31 is about delivery. Draki turns the 2035 target into actions a farmer takes this week, and teaches the climate trend inside the warning itself. It runs on free EU Copernicus data, so it can reach any farm. Pacific farms are next.

**Try it:** open the example farm, or watch the 2022 flood replay on the live site.

**Built with:**
- **Code:** React, Vite, TypeScript, Tailwind, Leaflet, MapLibre, and Python (numpy, scipy, rasterio).
- **Data:** Copernicus DEM, GloFAS, Sentinel-1 and ERA5 (via Open-Meteo and Microsoft Planetary Computer), ESA WorldCover, NOAA ONI, NSW DPI and NSW SES.
- **AI:** Claude Code (coding and video edit) and Microsoft neural text-to-speech (voiceover).

The full list with licences is in the README.

**No prior work:** everything was built after 9am AEST on 2 Oct 2026.
