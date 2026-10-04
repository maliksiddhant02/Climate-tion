# Draki: demo video script (aim for 1:50, hard limit 2:00)

About 260 spoken words, which comes to roughly 1:50 at a calm pace. Read it aloud with a stopwatch before you record. If it runs long, cut lines marked *(cut if long)*.

The judges score four things, and each one is covered here:
- **COP31 alignment:** scene 6 names the target out loud.
- **Build quality:** scenes 3–5 show it working and the evidence.
- **Creativity:** the replay and the per-paddock farm view.
- **Clarity:** scenes 1–2 say the problem and who it's for in plain words.

---

## Before recording

- Run `npm run dev` in `web/` at 1920×1080, browser zoom 100%, with bookmarks and extensions hidden.
- Open every page once so the Open-Meteo data is cached and nothing spins on camera:
  - `#/`
  - `#/live?replay`
  - `#/farm?example`
  - `#/proof`
- Record each scene as its own clip, then cut them together. Voiceover goes on a separate track so you can re-take it.
- Add captions. Judges often watch on mute.

---

## Scene 1: The problem (0:00–0:15)

**On screen:** Landing hero (`#/`). Hold, then scroll slowly to the "What 2022 cost" section. Optional: the Unsplash flooded-farmland photo as a full-bleed opener.

**Voiceover:**
> February 2022. The Richmond River hit a record flood. The Broadwater sugar mill sat under three metres of water, and the Northern Rivers cane crush fell seventeen percent. Growers got a warning for the town, but not for their own paddocks.

## Scene 2: What Draki is (0:15–0:25)

**On screen:** Back at the top of the hero. Hover over (don't click) "My farm" and "2022 flood".

**Voiceover:**
> Draki is a flood warning and season companion for cane growers on the lower Richmond. It works out which part of your farm goes under, and it texts you what to move before it does.

## Scene 3: The 2022 replay (0:25–0:50)

**On screen:** `#/live?replay`. Click **Play the flood**. Let the water spread across the map. Pause when the "Act today" marker on the slider lights up, and show the alert text with the "about N hours before the river peaked" line. Then resume to the peak.

**Voiceover:**
> This is the 2022 flood, replayed hour by hour with the recorded rain and river flow. Every thirty-metre square floods when the river climbs past its height. Rain pools in the low spots as well. Draki's first "Act today" alert comes about forty-five hours before the river peaked. That's two days to get machinery and stock out.

## Scene 4: My farm (0:50–1:20)

**On screen:**
1. `#/farm`: a 3–4 second sped-up clip of marking a boundary and drawing one paddock. Just enough to show the setup takes minutes.
2. Cut to `#/farm?example`. Scroll to **What would a flood do to your farm?** and switch between this week, a common flood and a 2022-size flood. Paddocks turn blue and the hectares and A$ change.
3. Show **Before the water comes** (move from these paddocks to this shed; tie the fuel tank down).
4. Show **Your texts** in the phone frame.
5. Show **Flood record** and click **Print flood record** to bring up the print preview.

**Voiceover:**
> A grower marks their farm once: the boundary, the paddocks and the sheds. Then Draki shows what this week, a common flood or another 2022 would do. It names which paddocks go under, how much cane that is in dollars, where to move gear, and what to tie down. Those steps come from SES advice, not AI. The same advice arrives as a text. *(cut if long:)* After a flood, it prints a paddock-by-paddock record for a disaster grant or insurance claim.

## Scene 5: Does it work? (1:20–1:38)

**On screen:** `#/proof`. Linger on each number for about a second:
- 72% overlap with the satellite
- the blind test at 54%
- the table of recorded floods since 2009 with every one ticked

**Voiceover:**
> We checked it against the Sentinel-1 radar map of the 2022 flood: seventy-two percent overlap. On a second flood the model never saw, it still caught nearly all the water. And every one of the six recorded floods since 2009 would have triggered "Act today", with no false alarms.

## Scene 6: COP31 and the close (1:38–1:55)

**On screen:** **Your climate** on `#/farm?example`, showing heavy-rain days then vs now and El Niño. End card with the Draki logo, the track name, the repo URL and the team names (Peter Ma, Siddhant Malik, Adin Sreekesh).

**Voiceover:**
> Our track is Climate Awareness and Education. The 2035 target is climate education for all and climate-resilient farming. Every Draki text ends with one line on why heavy rain is getting more common here. Very heavy rain days have nearly tripled. Draki only uses free global data, so the same method can reach Pacific farms next. Draki is Fijian for "weather".

---

## Final check
- [ ] Under 2:00, including the end card
- [ ] The track and the 2035 target are said out loud, not just shown
- [ ] Problem, working solution and evidence all appear
- [ ] Team names are on screen
- [ ] Uploaded somewhere that opens without an access request
