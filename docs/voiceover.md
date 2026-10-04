# Demo video: final cut

**File:** `Draki Demo 1080p.mp4`, 1:46, 1920×1080, 30 fps, H.264, with AAC audio, quiet background music under the voice, and English captions as a subtitle track. The same captions are in `captions.srt`, for uploading to YouTube.

It's built from the "Draki Reveal" animation, with two sections of the real site and COP31 cards added. Every number in it is on the site.

## Script

| Time | On screen | Voiceover |
|---|---|---|
| 0:00 | *(reveal)* 14.4 metres at Lismore, held a little longer | February 2022. The river at Lismore hit 14.4 metres. Two metres above any flood on record. |
| 0:08 | *(reveal)* "Floods hit paddocks.", held a little longer | Thousands of homes and farms went under. Flood warnings cover whole districts. But floods hit paddocks. |
| 0:17 | *(reveal)* DRAKI logo. The line under it now reads **"Flood warnings for every paddock."** | This is Draki. Flood warnings for every paddock, on any farm, anywhere. |
| 0:23 | *(reveal)* Grid flooding | Every hour, it runs Europe's Copernicus flood forecast, 50 versions of it, over every 30-metre square of the farm. |
| 0:30 | *(reveal)* Phone text | The grower gets a text, on any phone. What floods, what to move, and why heavy rain is getting more common here. |
| 0:38 | *(reveal)* 72%, 6 of 6, 45 hours | And it works. A 72% match with satellite radar. Six of six floods since 2009. |
| 0:46 | **Live site:** the 2022 replay, played hour by hour. "Act today" appears as it's said. | This is the working site. Replaying 2022 hour by hour, Draki says act today, 45 hours before the river peaks. |
| 0:54 | **Live site:** My farm. Zoom into the paddocks, then the flood sizes switch from this week to a common flood to 2022. Zoom into "Before the water comes". | A grower marks their farm once. Paddocks, sheds, fuel tanks. Draki shows what a common flood, or another 2022, would do to each paddock, in hectares and dollars. Where to move the gear, and what to tie down. Advice from the SES, not AI. |
| 1:12 | **COP31 card:** Climate Awareness & Education. The 2035 target fades in as it's spoken. | COP31 is about delivery. We built Draki for its Climate Awareness and Education track, and the 2035 target: climate education for all, and climate-resilient farming. |
| 1:23 | **Live site:** Your climate (heavy-rain chart), then the flood-warning text | Very heavy rain days here have nearly tripled. Draki teaches that where a farmer will actually read it: the flood warning. |
| 1:31 | **Card:** Free global data. Any farm, anywhere. Shows the Copernicus data sources and the team's names. | And it runs on free global data from Europe's Copernicus programme, so the same method can run on any farm, anywhere. Pacific farms are next. |
| 1:40 | *(reveal)* "Your whole farm, ready for the next flood", then the logo and climate-tion.vercel.app | Your whole farm, ready for the next flood. Draki. |

## Against the judging criteria

| Criterion | Where the video covers it |
|---|---|
| **COP31 alignment (30%)** | Names the track and reads out the 2035 target. Opens that section with "COP31 is about delivery" (the Presidency's framing). Includes the "nearly tripled" heavy-rain trend, Europe's Copernicus data and the path to Pacific farms. |
| **Build quality (30%)** | Shows the real site twice: the 2022 replay and My farm. Gives the evidence: 72% match with satellite radar, 6 of 6 recorded floods, 45 hours' lead. |
| **Creativity (20%)** | Per-paddock flood maps, climate education inside the flood text, a 50-run forecast over every 30 m square. |
| **Presentation (20%)** | The problem comes first, in plain words. Names the users (any farmer, tested first on the lower Richmond). Explains why 14.4 m matters: two metres above the old record, and thousands of homes and farms went under. Has captions and names the team. |

## How it was made

- **Voice:** Microsoft neural text-to-speech, voice `en-AU-WilliamMultilingualNeural`, via `edge-tts`.
- **Site footage:** screenshots of https://climate-tion.vercel.app at 2× resolution, taken with Playwright.
- **Camera moves:** rendered frame by frame with Pillow, using sub-pixel crops so the zooms are smooth.
- **Music:** a quiet bed synthesised in code with numpy (soft chords, a gentle pulse, reverb). It dips under the voice and was made for this video.
- **Assembly:** cut with FFmpeg, with crossfades between sections.
- **Logo line:** the old line under the logo was covered with a feathered strip of the same background, and the new line set in Archivo to match.
