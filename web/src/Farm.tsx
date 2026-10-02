import { useEffect, useMemo, useState } from "react"
import { ArrowRight, ArrowUpRight, Check } from "lucide-react"
import type { Farm } from "@/Live"
import { fjd } from "@/Live"
import { cn } from "@/lib/utils"

// "My farm": the whole season for one cane block, so a grower hears from Draki every week, not just when it floods.
// Every number is either computed from the shipped data or cited next to where it's defined.

const WRAP = "mx-auto w-full max-w-[1600px] px-6 md:px-10"
const card = "rounded-3xl border border-rule bg-card p-6"

// Cane: Fiji's 2025 average yield, FSC's 2026 forecast price (both cited in lib/flood.ts KNOBS.caneValuePerHa).
const YIELD_T_HA = 46.4
const PRICE_T = 57.4
// Maturity: plant cane 12–18 months (we use 14), ratoon about 12. The mill season runs from about 30 June to November (FSC, 2026).
const MATURITY = { plant: 14, ratoon: 12 } as const
const MILL = { open: 6, close: 10 } // month index, Jul–Nov
// 1997–98 El Niño drought: Fiji's cane harvest fell about 50% (Fiji drought loss-and-damage study, Local Environment 2024).
const EL_NINO_9798_LOSS = 0.5

// Fuel: FCCC prices for Viti Levu from 1 October 2026. CO₂ per litre burned: US EPA emission factors.
const FUEL = { petrol: { price: 3.15, co2: 2.31 }, diesel: { price: 3.41, co2: 2.68 } }
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

type Season = {
  latest: { season: string; year: number; oni: number; phase: "elnino" | "lanina" | "neutral" }
  allMeanRain: number
  phases: Record<"elnino" | "lanina" | "neutral", { seasons: number; meanRain: number; floodSeasons: number }>
  seasons: { season: string; rain: number; oni: number; phase: "elnino" | "lanina" | "neutral" }[]
}

const month = (d: Date) => d.toLocaleDateString("en-AU", { month: "long", year: "numeric" })
const t = (n: number) => `${Math.round(n).toLocaleString("en-AU")} t`
const pct = (a: number, b: number) => Math.round((1 - a / b) * 100)

/** When cut cane can reach the mill: once it's mature, and only while the mill is crushing. */
function readyDate(start: string, crop: keyof typeof MATURITY) {
  const d = new Date(`${start}-01T00:00:00`)
  d.setMonth(d.getMonth() + MATURITY[crop])
  if (d.getMonth() < MILL.open) d.setMonth(MILL.open)
  if (d.getMonth() > MILL.close) d.setFullYear(d.getFullYear() + 1, MILL.open)
  return d
}

const PHASE = {
  elnino: { label: "El Niño", color: "#d4a72c" },
  neutral: { label: "Neutral", color: "#cdc3ad" },
  lanina: { label: "La Niña", color: "#3c6fae" },
}

/** Nov–Apr rain at Ba for every wet season since 1991, coloured by El Niño / La Niña. Light surface. */
function SeasonChart({ s }: { s: Season }) {
  const W = 760, H = 220, padL = 40, padB = 26, padT = 12
  const max = Math.max(...s.seasons.map((x) => x.rain)) * 1.08
  const slot = (W - padL) / s.seasons.length
  const y = (v: number) => padT + (H - padB - padT) * (1 - v / max)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Wet-season rain at Ba by year. El Niño seasons average ${s.phases.elnino.meanRain} mm, La Niña ${s.phases.lanina.meanRain} mm.`}>
      {[0, 1000, 2000, 3000].filter((v) => v < max).map((v) => (
        <g key={v}>
          <line x1={padL} x2={W} y1={y(v)} y2={y(v)} stroke="#d9d0bd" />
          <text x={padL - 6} y={y(v) + 3} textAnchor="end" className="fill-[#525e56] text-[10px] tabular-nums">{v}</text>
        </g>
      ))}
      {s.seasons.map((x, i) => (
        <rect key={x.season} x={padL + i * slot + 1.5} y={y(x.rain)} width={slot - 3} height={y(0) - y(x.rain)} rx={2} fill={PHASE[x.phase].color}>
          <title>{`${x.season}: ${x.rain} mm, ${PHASE[x.phase].label} (ONI ${x.oni})`}</title>
        </rect>
      ))}
      <line x1={padL} x2={W} y1={y(s.allMeanRain)} y2={y(s.allMeanRain)} stroke="#13211a" strokeDasharray="4 4" />
      <text x={W} y={y(s.allMeanRain) - 5} textAnchor="end" className="fill-ink text-[10px]">{`Average ${s.allMeanRain.toLocaleString("en-AU")} mm`}</text>
      {s.seasons.map((x, i) =>
        x.season.endsWith("-98") || x.season.endsWith("-12") || x.season.endsWith("-22") || i === 0 || i === s.seasons.length - 1 ? (
          <text key={x.season} x={padL + i * slot + slot / 2} y={H - 8} textAnchor="middle" className="fill-[#525e56] text-[10px]">{x.season.slice(0, 4)}</text>
        ) : null,
      )}
    </svg>
  )
}

export function FarmPage({ farm }: { farm: Farm }) {
  const r = farm.replayRun // the Cody replay: what a record flood does to this field
  const now = farm.liveRun
  const [crop, setCrop] = useState<keyof typeof MATURITY>("ratoon")
  const [start, setStart] = useState("2026-08")
  const [tools, setTools] = useState<Record<string, { on: boolean; hours: number; lph: number }>>(() =>
    Object.fromEntries(TOOLS.map((x) => [x.id, { on: x.id === "pump" || x.id === "saw" || x.id === "tractor", hours: x.hours, lph: x.lph }])),
  )
  const [season, setSeason] = useState<Season>()
  useEffect(() => {
    fetch("/data/ba/season.json").then((r) => r.json()).then(setSeason).catch(() => undefined)
  }, [])

  // Cane only grows on farmland squares (WorldCover grass/cropland), not on the house or the trees.
  const cellHa = farm.elev ? farm.elev.stepM ** 2 / 10_000 : 0
  const caneHa = r ? r.cells.filter((c) => c.land === undefined || c.land === 30 || c.land === 40).length * cellHa : 0
  const tonnes = caneHa * YIELD_T_HA
  const value = tonnes * PRICE_T
  const ready = readyDate(start, crop)
  const elNinoNow = season?.latest.phase === "elnino"

  const toolRows = useMemo(
    () =>
      TOOLS.filter((x) => tools[x.id].on).map((x) => {
        const litres = tools[x.id].lph * tools[x.id].hours
        return { ...x, litres, cost: litres * FUEL[x.fuel].price, co2: litres * FUEL[x.fuel].co2 }
      }),
    [tools],
  )
  const swappable = toolRows.filter((x) => x.swap)
  const saved = { cost: swappable.reduce((s, x) => s + x.cost, 0), co2: swappable.reduce((s, x) => s + x.co2, 0) }

  const texts: { when: string; from: "draki" | "farmer"; body: string }[] = [
    {
      when: "October, before the wet season",
      from: "draki",
      body: season
        ? `Draki: ${elNinoNow ? "El Niño is under way" : `${PHASE[season.latest.phase].label} conditions`}. In El Niño years Ba gets about ${pct(season.phases.elnino.meanRain, season.allMeanRain)}% less rain from Nov to Apr. Leave cane trash on the field as mulch, don't burn it: it holds water in the soil.`
        : "…",
    },
    {
      when: "Every week",
      from: "draki",
      body: now ? `Draki: ${now.peak.total.toFixed(0)} mm of rain in the next 3 days, Ba River ${now.river && now.river.stage > 0 ? "rising" : "in its banks"}. ${now.a.level === "clear" ? "No flooding expected on your block." : "Flood watch for your low ground."}` : "…",
    },
    {
      when: "When a flood is coming",
      from: "draki",
      body: r
        ? `Draki: FLOOD RISK HIGH. Ba River rising ~${r.river?.stage.toFixed(1) ?? "–"} m. Your low ground could sit under ~${r.a.maxDepth.toFixed(1)} m of water. 1. Move cut cane off the low corner today. 2. Park the tractor on the high ground. Reply 1 if your block floods, 2 if it stays dry.`
        : "…",
    },
    { when: "", from: "farmer", body: "1" },
    { when: "", from: "draki", body: "Draki: Thanks. Your sector officer knows your block flooded. Your flood report (date, hectares, depth) is ready for your insurance or assistance claim." },
    { when: "Before harvest", from: "draki", body: `Draki: Your block is ready from ${month(ready)}. Expect about ${t(tonnes)} of cane, ${fjd(value)} at F$${PRICE_T.toFixed(2)}/t.` },
  ]

  return (
    <section className={cn(WRAP, "py-16")}>
      <h1 className="font-display text-5xl uppercase md:text-7xl">My farm</h1>
      <p className="mt-4 max-w-3xl text-lg text-muted-foreground">
        One cane block through a whole season: what it will earn, what the weather could take, and what to change. A grower gets all of this as texts.
        This page is for the extension officer who helps them set it up.
      </p>

      <div className="mt-10 flex flex-wrap items-end gap-6 rounded-3xl border border-rule bg-paper-2 p-5">
        <div>
          <p className="text-sm text-muted-foreground">Field</p>
          <p className="text-lg">{r ? `${r.a.areaHa.toFixed(1)} ha on the Ba River` : "Loading…"}</p>
          <a href="#/live" className="text-sm text-leaf hover:underline">
            Change the field on the map
          </a>
        </div>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Crop</span>
          <select value={crop} onChange={(e) => setCrop(e.target.value as keyof typeof MATURITY)} className="rounded-full border border-rule bg-card px-4 py-2 text-base">
            <option value="ratoon">Sugarcane, ratoon (regrowth)</option>
            <option value="plant">Sugarcane, newly planted</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">{crop === "plant" ? "Planted" : "Last harvested"}</span>
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
              <p className="mt-1 text-sm text-muted-foreground">Mill crushes July to November</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Expected harvest</p>
              <p className="mt-1 text-3xl font-semibold">{r ? t(tonnes) : "–"}</p>
              <p className="mt-1 text-sm text-muted-foreground">{caneHa.toFixed(1)} ha of cane × {YIELD_T_HA} t/ha (Fiji average)</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Worth</p>
              <p className="mt-1 text-3xl font-semibold">{r ? fjd(value) : "–"}</p>
              <p className="mt-1 text-sm text-muted-foreground">at FSC's F${PRICE_T.toFixed(2)}/t forecast price</p>
            </div>
          </div>
          <h3 className="mt-8 text-sm text-muted-foreground">What the weather could take</h3>
          <ul className="mt-2 divide-y divide-rule border-y border-rule">
            <li className="flex flex-wrap items-baseline justify-between gap-2 py-3">
              <span>A drought like the 1997–98 El Niño, when Fiji's cane harvest halved</span>
              <span className="font-semibold text-flood">−{fjd(value * EL_NINO_9798_LOSS)}</span>
            </li>
            <li className="flex flex-wrap items-baseline justify-between gap-2 py-3">
              <span>A flood like Cyclone Cody: cane under water on this block</span>
              <span className="font-semibold text-flood">{r ? `−${fjd(r.a.valueAtRisk)} at risk` : "–"}</span>
            </li>
          </ul>
          <p className="mt-3 text-sm text-muted-foreground">The price is FSC's 2026 forecast; the final payment can differ. Yield is the Fiji average, not this block's own record.</p>
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
                In El Niño years Ba averages <strong>{season.phases.elnino.meanRain.toLocaleString("en-AU")} mm</strong> of rain from November to April, against{" "}
                {season.phases.lanina.meanRain.toLocaleString("en-AU")} mm in La Niña years. That's {pct(season.phases.elnino.meanRain, season.allMeanRain)}% below average: a
                dry season for cane.
              </p>
              {season.seasons.find((x) => x.season === "1997-98") && (
                <p className="mt-3 text-white/70">
                  In 1997–98, the strongest El Niño on record here, Ba got just {season.seasons.find((x) => x.season === "1997-98")!.rain} mm, about a quarter of normal. Not every
                  El Niño is dry (2023–24 was wet), so Draki watches the actual rain all season.
                </p>
              )}
              <h3 className="mt-6 text-sm text-white/60">What to do this season</h3>
              <ul className="mt-2 space-y-2">
                {[
                  "Leave cane trash on the field as mulch instead of burning it. It keeps water in the soil.",
                  "Check pumps and water sources before the dry months.",
                  "Ask your sector officer about drought-tolerant varieties before replanting.",
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
              <p className="text-sm text-muted-foreground">Rain at Ba, November to April, every season since 1991</p>
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
              ERA5 rain at Ba, classified by NOAA's Oceanic Niño Index for December–February. Ba's three record floods (2009, 2012, 2022) all came in La Niña
              years; the 1997–98 El Niño brought the drought that halved Fiji's cane harvest.
            </figcaption>
          </figure>
        )}

        {/* 3. Flood risk */}
        <div className={cn(card, "lg:col-span-5")}>
          <h2 className="text-2xl">Flood risk</h2>
          <dl className="mt-6 space-y-4">
            <div>
              <dt className="text-sm text-muted-foreground">This week</dt>
              <dd className="text-lg">{now ? (now.a.level === "clear" ? "No flooding expected" : `${now.a.floodedHa.toFixed(1)} ha could go under`) : "–"}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">In a Cyclone Cody-size flood</dt>
              <dd className="text-lg">{r ? `${r.a.floodedHa.toFixed(1)} of ${r.a.areaHa.toFixed(1)} ha under water, ${fjd(r.a.valueAtRisk)} of cane` : "–"}</dd>
            </div>
          </dl>
          <a href="#/live?replay" className="mt-6 inline-flex items-center gap-2 font-medium text-leaf hover:underline">
            Watch the cyclone replay <ArrowRight className="size-4" aria-hidden />
          </a>
        </div>

        {/* 4. Equipment */}
        <div className={cn(card, "lg:col-span-7")}>
          <h2 className="text-2xl">Switch your equipment</h2>
          <p className="mt-2 text-sm text-muted-foreground">Tick what you use. Fuel at FCCC prices for Viti Levu, October 2026. Hours and litres per hour are typical; change them to yours.</p>
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
                      <td className="py-2 pr-3 text-right tabular-nums">{s.on ? `${Math.round(litres)} L · ${fjd(litres * FUEL[x.fuel].price)}` : "–"}</td>
                      <td className="py-2">{x.swap ?? <span className="text-muted-foreground">No practical electric option yet. Keep it tuned.</span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-lg">
            Switching the ticked tools saves about <strong>{Math.round(swappable.reduce((s, x) => s + x.litres, 0)).toLocaleString("en-AU")} L of fuel</strong>,{" "}
            <strong>{fjd(saved.cost)}</strong> and <strong>{(saved.co2 / 1000).toFixed(1)} t of CO₂</strong> a year.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">Fuel savings only: the cost of the new tools, batteries and panels isn't included. CO₂: 2.31 kg per litre of petrol, 2.68 kg per litre of diesel (US EPA).</p>
        </div>

        {/* The texts */}
        <div className="rounded-3xl bg-ink p-6 text-white lg:col-span-5">
          <h2 className="text-2xl">The texts this farm gets</h2>
          <p className="mt-2 text-sm text-white/60">An example season. No app, no internet: any phone, and replies are one number.</p>
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
                "Climate micro-insurance (PICAP)",
                "About F$100 a year. Pays up to F$1,000 by mobile money within weeks of a cyclone. Sold through the Sugar Cane Growers Fund and Council.",
                "https://www.uncdf.org/article/8039/timely-risk-cover-for-sugar-cane-farmers-in-fiji",
              ],
              [
                "Anticipatory action pilot",
                "Pays Fijian farming groups before a forecast cyclone, so they can prepare. A Draki forecast is exactly the kind of early signal it needs.",
                "https://www.uncdf.org/article/8428/pacifics-first-anticipatory-action-pilot-insurance-scheme-to-provide-fijian-farming-groups-with-funds-to-better-prepare-for-cyclones",
              ],
              [
                "2026 harvest fuel subsidy",
                "F$5 million from the government to cut cane growers' harvest fuel costs this crushing season.",
                "https://www.chinimandi.com/fiji-launches-5-million-fuel-subsidy-to-cut-sugar-harvest-costs-during-2026-crushing-season/",
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
