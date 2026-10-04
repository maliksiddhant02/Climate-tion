## Draki: flood warnings for every paddock

Draki tells a farmer which part of their farm will go under in a flood and what to move before it does. Every warning also says, in one line, why heavy rain is getting more common.

**Track:** Climate Awareness & Education. **2035 target:** climate education for all, and climate-resilient farming (COP31 Action Agenda).

**Team (Australia), Team Pixelers:**
- Siddhant Malik: the idea and research
- Peter Ma: the website and flood model
- Adin Sreekesh: combined both into the final entry

### The problem
On 28 February 2022, the river at Lismore reached **14.4 m**, two metres above the 1954 record.
- Thousands of homes and farms went under.
- The Broadwater sugar mill sat under about 3 m of water.
- The Northern Rivers cane crush fell 17%.

Flood warnings cover whole districts. They can't tell a farmer that the bottom of their own block goes under first, or that they have two days to get the tractor out. Meanwhile, very heavy rain days at Woodburn have nearly tripled: 0.9 a year in the 1990s, 2.6 in 2016–25.

### Who it's for
Farmers on floodplains. The first users are cane growers on the lower Richmond in NSW (Coraki, Woodburn, Broadwater). Mill cane advisers, co-ops and family members can also set it up for someone. It works by SMS, so there's no app to install.

### What we built (working prototype)
- **Live field:** checks every 30 m square of a farm against the river forecast (Copernicus GloFAS, 7 days, 50 runs) and against rain pooling in low spots. It gives a flood chance and an *Act today / Watch / All clear* level.
- **2022 replay:** the real flood, hour by hour. Draki's first *Act today* comes **45 hours before the peak**.
- **My farm:** the farmer marks their paddocks, sheds, fuel tanks and pumps once. Draki then shows what this week, a common flood or another 2022 would do:
  - which paddocks go under, in hectares and A$;
  - where to move machinery and stock;
  - what to tie down, from NSW SES advice.

  It also shows harvest timing, *Your climate* (the local heavy-rain trend and El Niño), diesel costs against a solar pump, the texts the farmer would get, and a **printable flood record** for disaster grants and insurance.
- **Climate education in the warning itself:** every text ends with why heavy rain is getting more common here.
- **No AI advice:** actions come from a fixed playbook, never from AI.

### Evidence it works
- **72% overlap** with the Sentinel-1 radar flood map of 2 March 2022 (critical success index; this is the flood the model was tuned on).
- **Blind test** on the second 2022 flood, using a different radar pass: 54%. It caught almost all the water and leans towards over-warning.
- **All 6 recorded floods since 2009** trigger *Act today*, and every Act-level river peak since 2009 matches a recorded flood.

### Why it matters for COP31
COP31 is about delivery. Draki turns *climate education for all and climate-resilient farming* into something a farmer acts on this week:
- move the gear;
- tie down the tank;
- understand why it keeps happening.

It runs only on free global data from the EU's Copernicus programme, so the same method can run on any farm, anywhere. Pacific farms are next: *Draki* is Fijian for "weather", and our first prototype modelled Fiji's Ba River.

### Pitch
In 2022 a district-wide warning couldn't tell a cane grower which paddock would flood. Draki can, down to 30 m squares. It sends a text two days ahead: what floods, what to move, and why heavy rain keeps getting worse. We checked it against satellite radar and every recorded flood since 2009. It's built on free EU data, so it's ready to scale from the Richmond to the Pacific.

### Tech
- **Site:** React, Vite, TypeScript, Tailwind, Leaflet and MapLibre.
- **Data build:** Python (numpy, scipy, rasterio, Microsoft Planetary Computer).
- **Live data:** Open-Meteo APIs.

### Tools and data used (full list with licences in the README)
- **Data:**
  - Copernicus DEM (GLO-30/90), GloFAS v4, Sentinel-1 and ERA5 (via Open-Meteo and Planetary Computer);
  - ESA WorldCover and NOAA ONI;
  - NSW DPI, NSW SES and Lismore City Council;
  - OpenStreetMap Nominatim, Esri imagery and AWS Terrain Tiles;
  - Unsplash photos.
- **Libraries:** React, Vite, Tailwind, shadcn/ui, lucide, Leaflet, MapLibre, devices.css, the Archivo font and Playwright.
- **AI, disclosed:**
  - Claude Code (Anthropic) for coding, design and the demo video edit;
  - Microsoft neural text-to-speech for the video voiceover;
  - the video's music was synthesised in code, with no licensed tracks.

### No prior work
All code, design and assets were created after 9:00am AEST, Fri 2 Oct 2026. Only ideas and research came before.
