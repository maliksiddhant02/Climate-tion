# Climate Hack-tion 2026: hackathon context

This repo is **Team Pixelers'** (Peter Ma, Siddhant Malik, Adin Sreekesh) entry for **Climate Hack-tion**, an EU-funded, fully online hackathon for uni/TAFE students in Australia, NZ and the Pacific, held ahead of COP31.
Sources: the Participant Guide PDF and the "Climate Hacktion Library" background doc (both handed over 2026-10-02).

## Key dates (Sydney time; AEST becomes AEDT at 2am Sun 4 Oct)
- **Opens:** 9:00am Fri 2 Oct 2026. No code, designs or assets from before this time (ideas and research are fine).
- **Submissions open:** 9:00pm Sat 3 Oct
- **Submissions close:** 9:00pm AEDT Sun 4 Oct (10:00 UTC). Submit early and keep updating; uploads fail near the deadline. Only small bug fixes after the deadline, no new features.
- **Closing ceremony / winners:** 3–4pm AEDT Mon 12 Oct (Webex)
- Afterwards: Pre-COP in Fiji & Tuvalu 5–8 Oct, COP31 in Antalya, Türkiye 9–20 Nov

## Project files
- `docs/`: the source documents (Participant Guide, Library) and **`docs/ideas.md`**, the scored idea brainstorm. The team pick is FarmShield v2, now named **Draki**. It started on Fiji's Ba River and on 3 Oct was **moved to the lower Richmond River, NSW (Northern Rivers cane country, the 2022 Lismore floods)**, because the team is Australian and the validation data there is much better. BillShift was dropped.
- `.claude/skills/hackathon-idea-evaluator/`: the skill for scoring ideas, adjusted to this hackathon's judging weights.
- `web/`: the Draki site (Vite + React + Tailwind v4 + Leaflet). Run `npm install` then `npm run dev` inside `web/`. The flood model is in `web/src/lib/flood.ts`, with its check in `node web/src/lib/flood.check.ts`. Data comes from Open-Meteo (cached in localStorage) plus static files in `web/public/data/richmond/`.
- `scripts/build_region.py`: builds the lower Richmond data into `web/public/data/richmond/`:
  - 30 m elevation, height above the river and land cover;
  - the February 2022 replay;
  - the Sentinel-1 calibration and agreement map;
  - the flood-record check and the demo field.

  `scripts/build_season_data.py` writes the El Niño data. The Python venv is in `scripts/.venv` (gitignored); see README.
- `web/src/Farm.tsx` (`#/farm`): "My farm", the grower's own tool. A 4-step setup on the map (mark the boundary, draw paddocks by crop, place equipment and sheds, name and mobile), saved in localStorage, then a personal dashboard: what each item and paddock does in this week / a common (5-year) flood / a 2022-size flood, what to move or prep, harvest dates, fuel, and the texts they'd get. `#/farm?example` opens a filled-in example farm. Farm logic is in `web/src/lib/farm.ts` (check: `node web/src/lib/farm.check.ts`). The saved boundary also drives the 2022 flood page.
- `docs/plan.md`: the real-data build plan and its status (river model, sharper elevation, Sentinel-1 validation), split across the team with a timeline.
- `web/DESIGN.md`: the visual system ("The Field Almanac"). Read it before any UI work.

## The challenge: "Build for 2035"
Turn **at least one** COP31 priority into a practical solution that people, communities or institutions can test and use. The aim is a convincing path from ambition to implementation, not a finished product. The ideal is something that makes climate action easier to **adopt, finance, implement or measure**.
A working prototype is preferred. A Figma-style clickable mockup is accepted.

| Track | 2035 target (cite it explicitly) |
|---|---|
| Electrification | Electricity's share of final energy demand goes from ~20% to 35% |
| Zero Waste & Methane | Halve the growth in municipal solid waste and manage landfill methane |
| Resilient Cities & Buildings | Cut building-sector energy-use intensity by ≥25%; help cities cope with heat and floods |
| Green Industrialisation | Global circular material-use rate of ≥15% |
| Climate Awareness & Education | Climate education for all; climate-resilient farming (EU climate-disinformation material is relevant here) |

These targets come from the COP31 Presidency's Action Agenda (10 themes, launched at Bonn in June 2026). This hackathon uses 5 of them as tracks.

## Judging (scores averaged across the jury; ties go to the higher COP31 alignment score)
- **COP31 alignment, 30%:** a direct, *explained* link to a priority and its target, relevance to real conditions, and why the problem matters.
- **Build quality, 30%:** the core functionality is shown to work and is validated.
- **Creativity, 20%:** an original approach and creative use of data, design or tech.
- **Presentation clarity, 20%:** plain-language problem, solution and audience; target users clearly identified.

## Submission (on Junction) must include
- Project name and a one-sentence summary
- The challenge/track
- Team nationality (AU/NZ/Pacific)
- Members and their roles
- The problem and target users
- The solution and intended impact
- A written pitch
- A **demo video of 2 minutes or less**, made during the event
- A link to a **public repo**, kept live until winners are announced
- Supporting material
- **Tools used:** list every outside tool, dataset, API, library and AI coding/generation tool. **Keep a running list in the README.**
- A no-prior-work disclosure

Quality check before submitting:
- Every link opens without an access request.
- The demo shows the problem, the working solution and evidence.
- The repo is reviewable on its own.
- Every team member is listed.
- The submission is marked complete.

## Rules worth remembering
- Teams have 3–5 members, registered as Australia, NZ or Pacific Islands. Mixed teams count as the majority country.
- AI tools are allowed but must be disclosed. The team stays responsible for originality, licensing and security.
- Every outside asset must be legal to use and disclosed.
- Organisers may inspect code to verify authorship.
- Teams keep their IP. Organisers get a non-exclusive licence to show the submission.
- Don't put confidential or sensitive data in demos.

## Prizes
- Winner: AUD 6,000
- Runner-up: AUD 3,500
- People's Choice: product worth AUD 1,500, chosen by participant voting on Junction
- National awards for AU, NZ and the Pacific
- Prizes are paid per team to one nominated representative.

## Background angles for COP31 alignment and the pitch
- **Hosting:** Türkiye is the formal host. Australia is President of Negotiations (it drafts texts and the "cover decision"). The Pacific shapes priorities through the COP31 Pacific Partnership and the **Blue Pacific** framing, facilitated by the Pacific Islands Forum.
- **The COP31 focus is *delivery*:** turning Paris Agreement commitments into practical outcomes. Pacific-led solutions are a big theme.
- **EU context (it's EU-funded):**
  - The European Climate Law sets climate neutrality by 2050 and a binding 90% cut by 2040 (vs 1990).
  - In 2024 the EU and member states provided €31.7bn in public climate finance and mobilised €11.0bn in private finance.
  - Global Gateway runs the **Green Blue Alliance for the Pacific** (18 countries). Team Europe has committed €650m+ to the Pacific, with ~€300m announced in 2025.
  - The 2026 Council conclusions name the sea-level-rise threats facing SIDS.
- **Glossary:** COP, Paris Agreement (well below 2°C, aiming for 1.5°C), NDC, Article 6 (carbon markets), Loss and Damage Fund (agreed at COP28).

## Links and contacts
- Event hub: https://hackjunction.app/hackathons/climate-hack-tion
- Discord: https://discord.gg/gasmaDwDXY (#getting-started for tech help, #find-a-team, #faq-and-resources, #general)
- Support / urgent: shelly.amir@gdsi.ie (9am–5pm AEST)
- Judging questions: sharon.offenberger@gdsi.ie (Discord @sharon_offenb)
