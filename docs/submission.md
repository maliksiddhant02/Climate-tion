**Draki: flood warnings for every paddock.** Draki tells a farmer which part of their farm will flood, what to move before the water arrives, and why heavy rain is getting more common.

**Track:** Climate Awareness & Education. **2035 target:** climate education for everyone, and farming that can cope with a changing climate.
**Team (Australia):** Peter Ma, Siddhant Malik, Adin Sreekesh

### The problem
In February 2022, the river at Lismore, NSW rose to 14.4 metres, two metres higher than any flood on record. Flood warnings cover a whole region, so farmers couldn't tell which of their own paddocks would go under. Days of very heavy rain here are now nearly three times as common as in the 1990s.

### What Draki does
- **Splits the farm into small squares** (30 m across) and checks each one against Europe's river and rain forecasts.
- **Sends a text to any phone:** which paddocks will flood, what to move, and one line on why heavy rain keeps getting worse.
- **My farm:** a farmer draws their paddocks and sheds once. Draki shows what an ordinary flood, or another 2022, would do to each paddock in hectares and dollars. It also makes a printable flood record for insurance and disaster grants.

### Does it work?
- Draki's map of the 2022 flood and the satellite's map of it overlap by 72%.
- On a second 2022 flood it wasn't tuned on, they still overlap by 54%. Where it was wrong, it tended to warn too much rather than too little.
- It would have warned for all 6 recorded floods here since 2009.
- Replaying 2022, its first warning came 45 hours before the river peaked.

### Why it matters for COP31
COP31 is about turning promises into action. Draki turns the 2035 target into steps a farmer can take this week, and explains the changing climate inside the warning itself. It runs on free data that covers the whole world, so it can work for any farm. Pacific farms are next.

**Try it:** open the example farm, or watch the 2022 flood play out on the live site.

**Built with:**
- **Website:** React, Vite, TypeScript, Tailwind, Leaflet and MapLibre. The data is prepared in Python (numpy, scipy, rasterio).
- **Data:**
  - free satellite, river and weather data from the EU's Copernicus programme (Copernicus DEM elevation maps, GloFAS river forecasts, Sentinel-1 radar, ERA5 rainfall), via Open-Meteo and Microsoft Planetary Computer;
  - ESA WorldCover land maps;
  - NOAA El Niño data;
  - NSW DPI and NSW SES advice.
- **AI tools:** Claude Code (help writing the code and editing the video) and Microsoft text-to-speech (the video's voiceover).

The full list, with licences, is in the README.

**No prior work:** everything was built after 9am AEST on 2 October 2026.
