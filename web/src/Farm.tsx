import { useEffect, useMemo, useState } from "react"
import { ArrowRight, ArrowUpRight, Check } from "lucide-react"
import type { Farm } from "@/Live"
import { aud, depthLabel } from "@/Live"
import { BASE } from "@/lib/region"
import { cn } from "@/lib/utils"

// "My farm": the whole season for one Northern Rivers cane block, so a grower hears from Draki every week, not just when it floods.
// Every number is either computed from the shipped data or cited next to where it's defined.

const WRAP = "mx-auto w-full max-w-[1600px] px-6 md:px-10"
const card = "rounded-3xl border border-rule bg-card p-6"

// Cane, NSW DPI: two-year cane yields of 105–150 t/ha (2023–24, we use 125), one-year cane roughly half that;
// 2024 average cane price A$55/t. Mills crush from late June to December (Sunshine Sugar).
const CROP = {
  twoYear: { label: "Two-year cane", months: 24, yield: 125 },
  oneYear: { label: "One-year cane", months: 12, yield: 62 },
} as const
const PRICE_T = 55
const MILL = { open: 5, close: 11 } // month index: June to December

// Fuel: national average pump prices, October 2026 (AIP / dailyfuels). CO₂ per litre burned: US EPA emission factors.
const FUEL = { petrol: { price: 2.26, co2: 2.31 }, diesel: { price: 2.62, co2: 2.68 } }
type Tool = { id: string; name: string; fuel: "petrol" | "diesel"; lph: number; hours: number; swap?: string }
// Litres per hour are typical figures for farm-size machines; every one is shown and editable on the page.
const TOOLS: Tool[] = [
  { id: "pump", name: "Water pump (irrigation)", fuel: "diesel", lph: 0.8, hours: 300, swap: "Solar water pump" },
  { id: "saw", name: "Chainsaw", fuel: "petrol", lph: 0.7, hours: 60, swap: "Battery chainsaw" },
  { id: "cutter", name: "Brush cutter", fuel: "petrol", lph: 0.5, hours: 120, swap: "Battery brush cutter" },
  { id: "sprayer", name: "Motorised sprayer", fuel: "petrol", lph: 0.6, hours: 80, swap: "Battery knapsack sprayer" },
  { id: "genset", name: "Generator", fuel: "petrol", lph: 0.8, hours: 200, swap: "Solar panels + battery" },
  { id: "tractor", name: "Tractor", fuel: "diesel", lph: 6, hours: 250 },
]

type Phase = "elnino" | "lanina" | "neutral"
type Season = {
  latest: { season: string; year: number; oni: number; phase: Phase }
  allMeanRain: number
  phases: Record<Phase, { seasons: number; meanRain: number; floodSeasons: number }>
  seasons: { season: string; rain: number; oni: number; phase: Phase; actFlood: boolean }[]
}

const month = (d: Date) => d.toLocaleDateString("en-AU", { month: "long", year: "numeric" })
const t = (n: number) => `${Math.round(n).toLocaleString("en-AU")} t`
const pct = (a: number, b: number) => Math.round((1 - a / b) * 100)

/** When cut cane can reach the mill: once it's mature, and only while the mill is crushing. */
function readyDate(start: string, months: number) {
  const d = new Date(`${start}-01T00:00:00`)
  d.setMonth(d.getMonth() + months)
  if (d.getMonth() < MILL.open) d.setMonth(MILL.open)
  if (d.getMonth() > MILL.close) d.setFullYear(d.getFullYear() + 1, MILL.open)
  return d
}

const PHASE: Record<Phase, { label: string; color: string }> = {
  elnino: { label: "El Niño", color: "#d4a72c" },
  neutral: { label: "Neutral", color: "#cdc3ad" },
  lanina: { label: "La Niña", color: "#3c6fae" },
}

/** Yearly rain at Woodburn since 1991, coloured by El Niño / La Niña. Light surface. */
function SeasonChart({ s }: { s: Season }) {
  const W = 760, H = 220, padL = 40, padB = 26, padT = 12
  const max = Math.max(...s.seasons.map((x) => x.rain)) * 1.08
  const slot = (W - padL) / s.seasons.length
  const y = (v: number) => padT + (H - padB - padT) * (1 - v / max)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Yearly rain at Woodburn. El Niño years average ${s.phases.elnino.meanRain} mm, La Niña ${s.phases.lanina.meanRain} mm.`}>
      {[0, 500, 1000, 1500, 2000].filter((v) => v < max).map((v) => (
        <g key={v}>
          <line x1={padL} x2={W} y1={y(v)} y2={y(v)} stroke="#d9d0bd" />
          <text x={padL - 6} y={y(v) + 3} textAnchor="end" className="fill-[#525e56] text-[10px] tabular-nums">{v}</text>
        </g>
      ))}
      {s.seasons.map((x, i) => (
        <rect key={x.season} x={padL + i * slot + 1.5} y={y(x.rain)} width={slot - 3} height={y(0) - y(x.rain)} rx={2} fill={PHASE[x.phase].color}>
          <title>{`${x.season}: ${x.rain} mm, ${PHASE[x.phase].label} (spring ONI ${x.oni})${x.actFlood ? ", Act-level flood" : ""}`}</title>
        </rect>
      ))}
      <line x1={padL} x2={W} y1={y(s.allMeanRain)} y2={y(s.allMeanRain)} stroke="#13211a" strokeDasharray="4 4" />
      <text x={W} y={y(s.allMeanRain) - 5} textAnchor="end" className="fill-ink text-[10px]">{`Average ${s.allMeanRain.toLocaleString("en-AU")} mm`}</text>
      {s.seasons.map((x, i) =>
        ["1991", "2000", "2010", "2022", "2025"].includes(x.season) ? (
          <text key={x.season} x={padL + i * slot + slot / 2} y={H - 8} textAnchor="middle" className="fill-[#525e56] text-[10px]">{x.season}</text>
        ) : null,
      )}
    </svg>
  )
}

export function FarmPage({ farm }: { farm: Farm }) {
  const r = farm.replayRun // the February 2022 replay: what a record flood does to this field
  const now = farm.liveRun
  const [crop, setCrop] = useState<keyof typeof CROP>("twoYear")
  const [start, setStart] = useState("2025-09")
  const [tools, setTools] = useState<Record<string, { on: boolean; hours: number; lph: number }>>(() =>
    Object.fromEntries(TOOLS.map((x) => [x.id, { on: x.id === "pump" || x.id === "saw" || x.id === "tractor", hours: x.hours, lph: x.lph }])),
  )
  const [season, setSeason] = useState<Season>()
  useEffect(() => {
    fetch(`${BASE}/season.json`).then((r) => r.json()).then(setSeason).catch(() => undefined)
  }, [])

  // Cane only grows on farmland squares (WorldCover grass/cropland), not on the house or the trees.
  const cellHa = farm.elev ? farm.elev.stepM ** 2 / 10_000 : 0
  const caneHa = r ? r.cells.filter((c) => c.land === undefined || c.land === 30 || c.land === 40).length * cellHa : 0
  const tonnes = caneHa * CROP[crop].yield
  const value = tonnes * PRICE_T
  const ready = readyDate(start, CROP[crop].months)
  const elNinoNow = season?.latest.phase === "elnino"
  const driest = season ? season.seasons.reduce((a, b) => (b.rain < a.rain ? b : a)) : undefined
  const floodShare = (p: Phase) => (season ? `${season.phases[p].floodSeasons} of ${season.phases[p].seasons}` : "–")

  const toolRows = useMemo(
    () =>
      TOOLS.filter((x) => tools[x.id].on).map((x) => {
        const litres = tools[x.id].lph * tools[x.id].hours
        return { ...x, litres, cost: litres * FUEL[x.fuel].price, co2: litres * FUEL[x.fuel].co2 }
      }),
    [tools],
  )
  const swappable = toolRows.filter((x) => x.swap)
  const saved = { litres: swappable.reduce((s, x) => s + x.litres, 0), cost: swappable.reduce((s, x) => s + x.cost, 0), co2: swappable.reduce((s, x) => s + x.co2, 0) }

  const texts: { when: string; from: "draki" | "farmer"; body: string }[] = [
    {
      when: "Spring, before the wet season",
      from: "draki",
      body: season
        ? `Draki: ${elNinoNow ? "El Niño is under way" : `${PHASE[season.latest.phase].label} conditions`}. In El Niño years this part of the Richmond gets about ${pct(season.phases.elnino.meanRain, season.allMeanRain)}% less rain. Keep your trash blanket on the ground to hold soil moisture.`
        : "…",
    },
    {
      when: "Every week",
      from: "draki",
      body: now ? `Draki: ${now.peak.total.toFixed(0)} mm of rain in the next 3 days, Richmond River ${now.river && now.river.stage > 0 ? "rising" : "in its banks"}. ${now.a.level === "clear" ? "No flooding expected on your block." : "Flood watch for your low ground."}` : "…",
    },
    {
      when: "When a flood is coming",
      from: "draki",
      body: r
        ? `Draki: FLOOD RISK HIGH. Richmond River rising ~${r.river?.stage.toFixed(1) ?? "–"} m. Your low ground could sit under ${depthLabel(r.a.maxDepth)} of water. 1. Move the harvester and haul-outs to the high ground. 2. Shift fertiliser and fuel off the low side. Reply 1 if your block floods, 2 if it stays dry.`
        : "…",
    },
    { when: "", from: "farmer", body: "1" },
    { when: "", from: "draki", body: "Draki: Thanks. Your mill's cane adviser knows your block flooded. Your flood report (date, hectares, depth) is ready for your insurer or a disaster grant claim." },
    { when: "Before the crush", from: "draki", body: `Draki: Your block is ready from ${month(ready)}. Expect about ${t(tonnes)} of cane, ${aud(value)} at A$${PRICE_T}/t.` },
  ]

  return (
    <section className={cn(WRAP, "py-16")}>
      <h1 className="font-display text-5xl uppercase md:text-7xl">My farm</h1>
      <p className="mt-4 max-w-3xl text-lg text-muted-foreground">
        One cane block through a whole season: what it will earn, what the weather could take, and what to change. A grower gets all of this as texts.
        This page is for whoever sets it up with them: a mill cane adviser, a co-op, or a family member.
      </p>

      <div className="mt-10 flex flex-wrap items-end gap-6 rounded-3xl border border-rule bg-paper-2 p-5">
        <div>
          <p className="text-sm text-muted-foreground">Field</p>
          <p className="text-lg">{r ? `${r.a.areaHa.toFixed(1)} hectares on the lower Richmond` : "Loading…"}</p>
          <p className="text-sm text-muted-foreground">1 hectare = 100 m × 100 m</p>
          <a href="#/live" className="text-sm text-leaf hover:underline">
            Change the field on the map
          </a>
        </div>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Crop</span>
          <select value={crop} onChange={(e) => setCrop(e.target.value as keyof typeof CROP)} className="rounded-full border border-rule bg-card px-4 py-2 text-base">
            {Object.entries(CROP).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Planted or last harvested</span>
          <input type="month" value={start} onChange={(e) => e.target.value && setStart(e.target.value)} className="rounded-full border border-rule bg-card px-4 py-2 text-base" />
        </label>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-12">
        {/* 1. Harvest and money */}
        <div className={cn(card, "lg:col-span-7")}>
          <h2 className="text-2xl">Harvest and money</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Ready to cut</p>
              <p className="mt-1 text-3xl font-semibold">{ready.toLocaleDateString("en-AU", { month: "short", year: "numeric" })}</p>
              <p className="mt-1 text-sm text-muted-foreground">Mills crush June to December</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Expected harvest</p>
              <p className="mt-1 text-3xl font-semibold">{r ? t(tonnes) : "–"}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {caneHa.toFixed(1)} hectares of cane × {CROP[crop].yield} t per hectare
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Worth</p>
              <p className="mt-1 text-3xl font-semibold">{r ? aud(value) : "–"}</p>
              <p className="mt-1 text-sm text-muted-foreground">at A${PRICE_T}/t, the 2024 NSW average</p>
            </div>
          </div>
          <h3 className="mt-8 text-sm text-muted-foreground">What the weather could take</h3>
          <ul className="mt-2 divide-y divide-rule border-y border-rule">
            <li className="flex flex-wrap items-baseline justify-between gap-2 py-3">
              <span>A flood like February 2022: cane under water on this block</span>
              <span className="font-semibold text-flood">{r ? (r.a.valueAtRisk >= value * 0.95 ? `the whole crop, ${aud(r.a.valueAtRisk)}` : `${aud(r.a.valueAtRisk)} at risk`) : "–"}</span>
            </li>
            <li className="flex flex-wrap items-baseline justify-between gap-2 py-3">
              <span>An El Niño year: less rain while the cane grows</span>
              <span className="font-semibold text-flood">{season ? `about ${pct(season.phases.elnino.meanRain, season.allMeanRain)}% less rain` : "–"}</span>
            </li>
          </ul>
          <p className="mt-3 text-sm text-muted-foreground">Yield is the NSW DPI range for this crop type, not this block's own record. The price changes every season.</p>
        </div>

        {/* 2. This season: El Niño */}
        <div className="rounded-3xl bg-ink p-6 text-white lg:col-span-5">
          <h2 className="text-2xl">This season</h2>
          {season ? (
            <>
              <p className="mt-6 font-display text-4xl leading-none text-cane">{elNinoNow ? "El Niño is under way" : `${PHASE[season.latest.phase].label} conditions`}</p>
              <p className="mt-3 text-white/70">
                NOAA's El Niño index is {season.latest.oni > 0 ? "+" : ""}
                {season.latest.oni.toFixed(1)} ({season.latest.season} {season.latest.year}). Above +0.5 is El Niño.
              </p>
              <p className="mt-6 text-lg leading-snug">
                In El Niño years Woodburn averages <strong>{season.phases.elnino.meanRain.toLocaleString("en-AU")} mm</strong> of rain, against{" "}
                {season.phases.lanina.meanRain.toLocaleString("en-AU")} mm in La Niña years. Floods go the other way: the river hit Act level in {floodShare("lanina")}{" "}
                La Niña years and {floodShare("elnino")} El Niño years.
              </p>
              {driest && (
                <p className="mt-3 text-white/70">
                  The driest year since 1991 was {driest.season}, with {driest.rain.toLocaleString("en-AU")} mm ({PHASE[driest.phase].label}). Not every El Niño is dry, so
                  Draki watches the actual rain all season.
                </p>
              )}
              <h3 className="mt-6 text-sm text-white/60">What to do this season</h3>
              <ul className="mt-2 space-y-2">
                {[
                  "Keep the trash blanket from harvest on the ground. It holds water in the soil.",
                  "Check pumps and irrigation before the dry months.",
                  "Ask your mill's cane adviser about drought-tolerant varieties before replanting.",
                ].map((x) => (
                  <li key={x} className="flex gap-3">
                    <Check className="mt-1 size-4 shrink-0 text-cane" aria-hidden />
                    {x}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-6 text-white/60">Loading the season outlook…</p>
          )}
        </div>

        {season && (
          <figure className={cn(card, "lg:col-span-12")}>
            <div className="flex flex-wrap items-baseline justify-between gap-4">
              <p className="text-sm text-muted-foreground">Rain at Woodburn, every year since 1991</p>
              <p className="flex flex-wrap gap-4 text-sm">
                {(["elnino", "neutral", "lanina"] as const).map((p) => (
                  <span key={p} className="flex items-center gap-2">
                    <i className="inline-block size-3 rounded-sm" style={{ background: PHASE[p].color }} />
                    {PHASE[p].label}: {season.phases[p].meanRain.toLocaleString("en-AU")} mm average
                  </span>
                ))}
              </p>
            </div>
            <div className="mt-4">
              <SeasonChart s={season} />
            </div>
            <figcaption className="mt-3 text-sm text-muted-foreground">
              ERA5 rain at Woodburn, each year classified by NOAA's Oceanic Niño Index for September–November, when El Niño and La Niña peak.
            </figcaption>
          </figure>
        )}

        {/* 3. Flood risk */}
        <div className={cn(card, "lg:col-span-5")}>
          <h2 className="text-2xl">Flood risk</h2>
          <dl className="mt-6 space-y-4">
            <div>
              <dt className="text-sm text-muted-foreground">This week</dt>
              <dd className="text-lg">{now ? (now.a.level === "clear" ? "No flooding expected" : `${now.a.floodedHa.toFixed(1)} hectares could go under`) : "–"}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">In a flood like February 2022</dt>
              <dd className="text-lg">{r ? `${r.a.floodedHa.toFixed(1)} of ${r.a.areaHa.toFixed(1)} hectares under water, ${aud(r.a.valueAtRisk)} of cane` : "–"}</dd>
            </div>
          </dl>
          <a href="#/live?replay" className="mt-6 inline-flex items-center gap-2 font-medium text-leaf hover:underline">
            Watch the 2022 flood replay <ArrowRight className="size-4" aria-hidden />
          </a>
        </div>

        {/* 4. Equipment */}
        <div className={cn(card, "lg:col-span-7")}>
          <h2 className="text-2xl">Switch your equipment</h2>
          <p className="mt-2 text-sm text-muted-foreground">Tick what you use. Fuel at national average pump prices, October 2026. Hours and litres per hour are typical; change them to yours.</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <thead className="text-muted-foreground">
                <tr className="border-b border-rule">
                  <th className="py-2 pr-3 font-normal">Tool</th>
                  <th className="py-2 pr-3 font-normal">Hours / year</th>
                  <th className="py-2 pr-3 font-normal">Litres / hour</th>
                  <th className="py-2 pr-3 text-right font-normal">Fuel / year</th>
                  <th className="py-2 font-normal">Switch to</th>
                </tr>
              </thead>
              <tbody>
                {TOOLS.map((x) => {
                  const s = tools[x.id]
                  const set = (patch: Partial<typeof s>) => setTools({ ...tools, [x.id]: { ...s, ...patch } })
                  const litres = s.lph * s.hours
                  return (
                    <tr key={x.id} className={cn("border-b border-rule", !s.on && "text-muted-foreground")}>
                      <td className="py-2 pr-3">
                        <label className="flex items-center gap-2">
                          <input type="checkbox" checked={s.on} onChange={(e) => set({ on: e.target.checked })} className="size-4 accent-leaf" />
                          {x.name} <span className="text-muted-foreground">({x.fuel})</span>
                        </label>
                      </td>
                      <td className="py-2 pr-3">
                        <input type="number" min={0} value={s.hours} disabled={!s.on} onChange={(e) => set({ hours: Math.max(0, +e.target.value) })} aria-label={`${x.name} hours per year`} className="w-20 rounded-lg border border-rule bg-paper px-2 py-1 tabular-nums" />
                      </td>
                      <td className="py-2 pr-3">
                        <input type="number" min={0} step={0.1} value={s.lph} disabled={!s.on} onChange={(e) => set({ lph: Math.max(0, +e.target.value) })} aria-label={`${x.name} litres per hour`} className="w-20 rounded-lg border border-rule bg-paper px-2 py-1 tabular-nums" />
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">{s.on ? `${Math.round(litres)} L · ${aud(litres * FUEL[x.fuel].price)}` : "–"}</td>
                      <td className="py-2">{x.swap ?? <span className="text-muted-foreground">No practical electric option yet. Keep it tuned.</span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-lg">
            Switching the ticked tools saves about <strong>{Math.round(saved.litres).toLocaleString("en-AU")} L of fuel</strong>, <strong>{aud(saved.cost)}</strong> and{" "}
            <strong>{(saved.co2 / 1000).toFixed(1)} t of CO₂</strong> a year.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">Fuel savings only: the cost of the new tools, batteries and panels isn't included. CO₂: 2.31 kg per litre of petrol, 2.68 kg per litre of diesel (US EPA).</p>
        </div>

        {/* The texts */}
        <div className="rounded-3xl bg-ink p-6 text-white lg:col-span-5">
          <h2 className="text-2xl">The texts this farm gets</h2>
          <p className="mt-2 text-sm text-white/60">An example season. No app needed: any phone, and replies are one number.</p>
          <ol className="mt-5 space-y-3">
            {texts.map((m, i) => (
              <li key={i} className={cn("flex flex-col", m.from === "farmer" ? "items-end" : "items-start")}>
                {m.when && <span className="mb-1 text-xs text-white/60">{m.when}</span>}
                <p className={cn("max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed", m.from === "farmer" ? "rounded-br-sm bg-cane text-ink" : "rounded-tl-sm bg-white/10 text-white/90")}>{m.body}</p>
              </li>
            ))}
          </ol>
        </div>

        {/* Help to claim */}
        <div className={cn(card, "lg:col-span-7")}>
          <h2 className="text-2xl">Help you can claim</h2>
          <ul className="mt-4 divide-y divide-rule border-y border-rule">
            {[
              [
                "Special Disaster Grants for primary producers",
                "After the 2022 floods, NSW and the Commonwealth offered grants of up to A$75,000 through the NSW Rural Assistance Authority (Disaster Recovery Funding Arrangements) for clean-up, repairs and restoring fields.",
                "https://www.nsw.gov.au/sites/default/files/2023-01/Special-Disaster-Assistance-AGRN-1025-Primary-Producer-Grant-Guidelines-V1.1-November.pdf",
              ],
              [
                "Disaster assistance for the 2022 floods",
                "The Australian Government's register of what was available for the Northern Rivers floods, and the model for what opens after the next one.",
                "https://www.disasterassist.gov.au/Pages/disasters/current-disasters/New-South-Wales/nth-nsw-floods-22-february-2022.aspx",
              ],
            ].map(([h, p, href]) => (
              <li key={h} className="py-4">
                <a href={href} target="_blank" rel="noreferrer" className="font-medium text-leaf hover:underline">
                  {h} <ArrowUpRight className="inline size-4" aria-hidden />
                </a>
                <p className="mt-1 text-muted-foreground">{p}</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-muted-foreground">After a flood, Draki's report for the block (date, hectares, depth, sources) is the evidence a claim needs.</p>
        </div>
      </div>
    </section>
  )
}
