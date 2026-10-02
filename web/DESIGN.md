---
name: FarmShield
description: Field-level flood alerts for cane farmers on the Ba floodplain, Fiji.
colors:
  ink: "#13211a"
  ink-2: "#1d3127"
  paper: "#f3eee3"
  paper-2: "#e9e2d2"
  card: "#fbf8f1"
  rule: "#d9d0bd"
  muted-text: "#525e56"
  leaf: "#2f5e3d"
  cane: "#d4a72c"
  cane-light: "#f0d27a"
  rain: "#3c6fae"
  rain-bright: "#5a8fd8"
  rain-soft: "#9db8da"
  flood: "#d4472a"
  silt: "#6f5539"
typography:
  display:
    fontFamily: "Fraunces Variable, Georgia, serif"
    fontSize: "clamp(3rem, 6vw, 4.5rem)"
    fontWeight: 400
    lineHeight: 1.02
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Fraunces Variable, Georgia, serif"
    fontSize: "clamp(2.25rem, 4vw, 3rem)"
    fontWeight: 400
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Geist Variable, ui-sans-serif, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 500
    lineHeight: 1.4
  body:
    fontFamily: "Geist Variable, ui-sans-serif, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.625
  figure:
    fontFamily: "Geist Variable, ui-sans-serif, sans-serif"
    fontSize: "3.75rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.025em"
  label:
    fontFamily: "Geist Mono Variable, ui-monospace, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.33
    letterSpacing: "0.16em"
rounded:
  sm: "8.4px"
  md: "11.2px"
  lg: "14px"
  xl: "19.6px"
  2xl: "25.2px"
  3xl: "30.8px"
  pill: "9999px"
spacing:
  gutter: "24px"
  card: "24px"
  section: "112px"
  section-dark: "96px"
  container: "1280px"
components:
  button-primary:
    backgroundColor: "#ffffff"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "12px 20px"
  button-primary-hover:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
  button-cane:
    backgroundColor: "{colors.cane}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
  button-ghost-dark:
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    padding: "12px 20px"
  map-chip:
    backgroundColor: "{colors.ink}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    padding: "8px 14px"
  status-act:
    backgroundColor: "{colors.flood}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  status-watch:
    backgroundColor: "{colors.cane}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  status-clear:
    backgroundColor: "{colors.leaf}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  card-paper:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.3xl}"
    padding: "24px"
  card-dark:
    textColor: "#ffffff"
    rounded: "{rounded.3xl}"
    padding: "24px"
---

# Design System: FarmShield

## Overview

**Creative North Star: "The Field Almanac"**

FarmShield should read like a farmer's almanac that learned to read the weather forecast. Serif headlines and warm paper surfaces give it the weight of a printed reference. The data is set in plain sans figures and mono labels, so every number looks measured, not marketed. The tone is calm, honest and local: it reassures before it alarms, it shows its working, and it speaks in Ba, F$, iTaukei and cane, never in generic "smart farming" language.

The page alternates between two grounds. **Paper** sections (paper and paper-2) carry the story and the explanation. **Ink** sections (the hero, the live field, the footer) carry live data and the map, like a night-time weather desk. A single **leaf** band carries the COP31 commitment. Colour is drawn from the place: cane gold, leaf green, rain blue, silt brown. Flood red is held back for the one thing that is actually dangerous.

Density is generous on paper (112px section rhythm, long measures, big serif statements) and tighter on ink, where the live dashboard packs map, risk, rain and SMS into one 12-column grid.

**Key Characteristics:**
- Fraunces display serif with cane-gold italic emphasis on the one phrase that matters ("*your farm*", "*bottom third*").
- Paper and ink as the only two grounds; leaf green as a single closing band.
- Flat surfaces. Depth comes from tone, translucency and borders, never from shadows.
- Fully rounded pills for every control; large soft-cornered cards for every container.
- Model inputs, sources and caveats are visible on the page.

## Colors

An earthy, place-derived palette: two neutral grounds (paper and ink), one warm accent (cane), and weather colours that carry meaning.

### Primary
- **Cane Gold** (cane): the accent. The "Try it" button, emphasis italics in headlines on ink, the field outline on the map, the high-ground marker, check icons, the live pulse, text selection. It also marks "Watch" status.
- **Pale Cane** (cane-light): cane lightened for small text on the leaf band, where full cane fails contrast.

### Secondary
- **Leaf Green** (leaf): the "All clear" status, step icons and numerals on paper, focus rings on paper surfaces, and the full-bleed COP31 band.

### Tertiary
- **Flood Red** (flood): only for water that will cause harm. Flooded map cells, the "Act today" status, error banners, the too-small-field warning.
- **Rain Blue** (rain, rain-bright, rain-soft):
  - rain: the heavy-rain chart bars and the decade figures in the "Why now" headline.
  - rain-bright: the rain bars on the dark rain chart.
  - rain-soft: puddling map cells and the highlighted wettest-day tile.

### Neutral
- **Night Ink** (ink, ink-2): the dark ground for the hero, live field and footer. It is also body text on paper.
- **Almanac Paper** (paper, paper-2, card):
  - paper: the page ground.
  - paper-2: the alternate section ground.
  - card: the risk card and chart panels.
- **Field Rule** (rule): hairline dividers and borders on paper.
- **Weathered Text** (muted-text): secondary text on paper, at least 5:1 on both paper tones.
- **Silt** (silt): small numbered markers and validation notes on paper.

### Named Rules
**The Flood Is Rare Rule.** Flood red appears only where something is under water or has gone wrong. Never use it for decoration, emphasis or branding.

**The Sixty Floor Rule.** On ink, no text goes below 60% white. Small labels on dark surfaces use `white/60` or brighter.

**The Tinted Muted Rule.** Secondary text on a coloured surface is tinted from that surface's hue (ink/75 on rain-soft, cane-light on leaf), never plain grey.

## Typography

**Display Font:** Fraunces Variable (with Georgia, serif)
**Body Font:** Geist Variable (with ui-sans-serif)
**Label/Mono Font:** Geist Mono Variable (with ui-monospace)

**Character:** Fraunces brings the almanac's printed authority and a soft, slightly old-fashioned warmth. Geist keeps the data clean and modern. Mono is used for measurement: labels, dates, model inputs and the SMS header.

### Hierarchy
- **Display** (400, 3rem → 4.5rem, 1.02): the hero question only. Balanced wrapping, with a cane italic on the key phrase.
- **Headline** (400, 2.25rem → 3rem, 1.25): section statements. These are full sentences ("Three steps, then it runs on SMS."), never labels.
- **Title** (Geist 500, 1.25rem): step and card headings.
- **Body** (Geist 400, 1rem–1.125rem, 1.625): explanations, max about 36rem (`max-w-xl`) wide.
- **Figure** (Geist 600, 1.5rem–3.75rem, tight): hectares, millimetres and F$, always with their unit.
- **Label** (Geist Mono 400, 11–12px, 0.16–0.18em, uppercase): section markers, card captions, model inputs.

### Named Rules
**The One Italic Rule.** Each display or headline gets at most one italic phrase, coloured cane on ink or flood/leaf on paper. It marks the single idea the reader should take away.

**The Unit Rule.** A number never appears without its unit (ha, mm, m, F$, °). Dates use Fiji/Australian order ("6 Jan"), never MM/DD.

## Layout

- **Container:** one centred container, max 1280px, with a 24px side gutter at every width.
- **Grid:** content sits on a 12-column grid from `lg` (1024px) up.
  - Paper sections typically split 7/5 or 5/(6 offset 1).
  - The live dashboard puts the map at 7 columns spanning two rows, with risk and rain cards at 5.
- **Vertical rhythm:** 112px for paper sections, 96px for the live field, 80px for the leaf band.
- **Spacing inside sections:**
  - Headings sit 24–32px below their marker.
  - Body text sits 24px below headings.
  - Card grids use a 16px gap.
- **Below `sm` (640px):**
  - The 7-day forecast becomes a horizontal snap-scroller that bleeds to the screen edge.
  - The map readout stacks its legend onto its own row.
  - Long tab labels shorten ("Replay: Cyclone Cody").
- **Map on phones:** one-finger drag scrolls the page rather than panning the map.

## Elevation & Depth

FarmShield is flat. There are no box-shadows anywhere. Depth comes from three things:
1. **The ground switch:** paper ↔ ink.
2. **Translucent white layers on ink:** `white/[0.04]` for cards, `white/[0.07]` for tab tracks, `white/10–15` for borders.
3. **Backdrop blur:** only where a surface floats over imagery or the map, i.e. the hero card, the stat strip and the map chips.

### Named Rules
**The No Shadow Rule.** Surfaces are flat. A new element that needs separation gets a tonal step or a hairline border, never a drop shadow.

**The Blur Earns Its Place Rule.** Backdrop blur is only for surfaces sitting on a photo or a map. A card on a plain ground stays solid.

## Shapes

The form language is soft and tactile:
- **Controls:** every button, tab, chip and status marker is a full pill (9999px).
- **Containers:** cards and photo frames use a large 30.8px radius (`rounded-3xl`, from a 14px base radius × 2.2).
- **Smaller items:** inner tiles and list rows use 19.6–25.2px.
- **SMS phone:** a nested 2rem / 1.5rem radius pair.
- **Map cells:** square, matching the data grid.
- **Lines:** hairline (1px) rules, never thicker.

## Components

### Buttons
Soft, confident pills with no shadow; the colour carries the hierarchy.
- **Shape:** full pill (9999px).
- **Primary on ink:** white fill, ink text, 12px × 20px, 14px medium. Hover shifts to paper.
- **Cane action:** cane fill, ink text ("Try it", "Done"). Hover warms slightly (#e2b84a).
- **Ghost on ink:** a 25% white hairline border, white text. Hover adds a 10% white fill.
- **Map chip:** ink at 80% with backdrop blur, 12px text ("Draw your field", "Undo", "Cancel").
- **Focus:** a 2px outline with 2px offset. It is leaf on paper surfaces and cane on ink or leaf surfaces.
- **Disabled:** 40% opacity.

### Status pills
Mono, 11px, uppercase, tracked, with an icon:
- **Act today:** flood fill, white text.
- **Watch:** cane fill, ink text.
- **All clear:** leaf fill, white text.

These three are the only status vocabulary.

### Cards / Containers
- **Corner style:** 30.8px.
- **Paper card:** the card colour on ink, ink text. Used for the risk card, the one "answer" on the dark dashboard.
- **Dark card:** a `white/[0.04]` fill with a `white/10` hairline border, 24px padding.
- **Glass card:** `white/[0.07]` with backdrop blur and a `white/15` border, only over the hero photo.
- **Shadow strategy:** none (see Elevation & Depth).

### Tabs
- **Shape:** a pill track at `white/[0.07]` holding pill triggers.
- **Text:** inactive triggers are `white/60`. The active trigger is a white fill with ink text.
- **Sizes:** 40px for the mode switch, 32px for the language switch.

### Navigation
A floating pill group in the hero: a `white/5` fill with a `white/15` border and blur. It holds 4 anchor links, with a cane "Try it" pill to the right. Below `md` (768px) only the logo and "Try it" remain.

### Field map (signature)
- **Base layer:** Esri satellite imagery.
- **Field:** the outline is a 2px cane line.
- **Elevation cells:**
  - Dry cells are a 1px white outline at 18% opacity.
  - Puddling cells are rain-soft at 45%.
  - Flooded cells are flood red, at 35% + 20% per metre of depth.
- **High ground:** a cane dot with an ink ring and a permanent "park machinery here" label. It is hidden when that cell is itself flooded.
- **Readout:** an ink/75 blurred card along the bottom edge.

### SMS mock (signature)
- **Frame:** a phone frame in a near-black green (#0d1712), with an inner screen in #16241c.
- **Bubble:** a `white/10` message bubble with a square top-left corner, 13px text.
- **Content:** shows the exact text the farmer receives: headline, numbered actions, and a "Why:" climate line.

## Do's and Don'ts

### Do:
- **Do** put live data and the map on ink, and explanation on paper.
- **Do** show your working: list model inputs, data sources and caveats next to the result.
- **Do** use local language and units: Ba, F$, cane, iTaukei, and "6 Jan" date order.
- **Do** keep every control a full pill and every container at 30.8px corners.
- **Do** give the clear state a positive answer ("Nothing goes under.") rather than a row of zeros.
- **Do** keep small text on ink at `white/60` or brighter, and secondary text on paper at the muted-text colour.

### Don't:
- **Don't** add box-shadows. Separation comes from tone and hairlines.
- **Don't** use flood red for anything that isn't water damage or an error.
- **Don't** use cane gold for small text on the leaf band; use cane-light.
- **Don't** let AI-generated wording stand in for the farming playbook. Actions come from the fixed playbook only.
- **Don't** show a dry week as the first impression: when the live forecast is clear, lead with the Cyclone Cody replay.
