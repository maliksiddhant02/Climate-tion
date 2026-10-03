import { useEffect, useRef, useState } from "react"
import { ArrowRight, ArrowUpRight } from "lucide-react"
import { ago, aud, LivePage, smsText, useFarm, type Farm } from "@/Live"
import { Phone } from "@/components/Phone"
import { DECADES, FlowHistory, HeavyRainChart } from "@/components/weather"
import { FloodValley } from "@/components/FloodValley"
import { FarmPage } from "@/Farm"
import { getFlowHistory, weatherUrl } from "@/lib/api"
import { BASE } from "@/lib/region"
import { KNOBS } from "@/lib/flood"
import { cn } from "@/lib/utils"

// Type: Archivo throughout. font-display = 125% width, 800 weight. One wide frame (WRAP) so every page shares the nav's left edge.
const WRAP = "mx-auto w-full max-w-[1600px] px-6 md:px-10"

const NAV = [
  ["farm", "My farm"],
  ["live", "2022 flood"],
  ["proof", "Evidence"],
] as const

/** Hash routing: #/farm, #/live, #/live?replay … No router needed for a few pages. */
function useRoute() {
  const get = () => location.hash.replace(/^#\/?/, "")
  const [hash, setHash] = useState(get)
  useEffect(() => {
    const on = () => {
      setHash(get())
      window.scrollTo(0, 0)
    }
    addEventListener("hashchange", on)
    return () => removeEventListener("hashchange", on)
  }, [])
  return hash
}

function Logo() {
  return (
    <a href="#/" className="flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
        <path d="M4 12c4-3 8-3 12 0s8 3 12 0" fill="none" stroke="#d4a72c" strokeWidth={2.4} strokeLinecap="round" />
        <path d="M4 20c4-3 8-3 12 0s8 3 12 0" fill="none" stroke="#3c6fae" strokeWidth={2.4} strokeLinecap="round" />
      </svg>
      <span className="font-display text-2xl uppercase">Draki</span>
    </a>
  )
}

const btn = "press inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-medium"

export default function App() {
  const route = useRoute()
  const page = route.split(/[/?]/)[0]
  const farm = useFarm()
  // Publish the nav's height as --nav so the pinned hero can fill exactly the space under it.
  const nav = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = nav.current
    if (!el) return
    const set = () => document.documentElement.style.setProperty("--nav", `${el.offsetHeight}px`)
    set()
    const ro = new ResizeObserver(set)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const [mode, setMode] = useState<"live" | "replay">(route.includes("replay") ? "replay" : "live")
  // Once someone picks a tab we stop auto-switching for them.
  const modeChosen = useRef(route.includes("replay"))
  const chooseMode = (m: "live" | "replay") => {
    modeChosen.current = true
    setMode(m)
  }
  useEffect(() => {
    if (route.includes("replay")) chooseMode("replay")
  }, [route])
  // A dry week makes a dull demo: if this week is all clear, open on the 2022 flood replay instead.
  useEffect(() => {
    if (farm.liveRun?.a.level === "clear" && !modeChosen.current) setMode("replay")
  }, [farm.liveRun])

  return (
    <div className="flex min-h-svh flex-col bg-paper text-ink">
      <nav ref={nav} className="sticky top-0 z-[2000] border-b border-rule bg-paper/85 backdrop-blur">
        <div className={cn(WRAP, "flex items-center justify-between py-4")}>
          <Logo />
          <div className="hidden gap-1 md:flex">
            {NAV.map(([id, label]) => (
              <a
                key={id}
                href={`#/${id}`}
                className={cn("rounded-full px-4 py-2 text-sm transition-colors", (page === id || (id === "proof" && page === "why")) ? "bg-ink text-paper" : "text-muted-foreground hover:text-ink")}
              >
                {label}
              </a>
            ))}
          </div>
          <a href="#/farm" className={cn(btn, "bg-cane py-2 text-ink hover:bg-[#e2b84a]")}>
            Set up my farm
          </a>
        </div>
        <div className="flex gap-1 overflow-x-auto px-4 pb-3 md:hidden">
          {NAV.map(([id, label]) => (
            <a key={id} href={`#/${id}`} className={cn("shrink-0 rounded-full px-3 py-1.5 text-sm", (page === id || (id === "proof" && page === "why")) ? "bg-ink text-paper" : "text-muted-foreground")}>
              {label}
            </a>
          ))}
        </div>
      </nav>

      <main key={page} className="page-enter flex-1">
        {page === "live" ? (
          <LivePage farm={farm} mode={mode} setMode={chooseMode} />
        ) : page === "proof" || page === "why" ? (
          <Proof farm={farm} />
        ) : page === "farm" ? (
          <FarmPage farm={farm} />
        ) : (
          <Home farm={farm} />
        )}
      </main>

      <footer className="border-t border-rule">
        <div className={cn(WRAP, "flex flex-wrap justify-between gap-4 py-8 text-sm text-muted-foreground")}>
          <p>Team Pixelers · Peter Ma, Siddhant Malik, Adin Sreekesh · Climate Hack-tion 2026</p>
          <p>Data: Copernicus (DEM, Sentinel-1, GloFAS, ERA5), ESA WorldCover, Open-Meteo, Esri, OpenStreetMap · Photos: Unsplash (Troy Olson, insung yoon, Christine Walker)</p>
        </div>
      </footer>
    </div>
  )
}

function Home({ farm }: { farm: Farm }) {
  const r = farm.replayRun
  return (
    <>
      <FloodValley>
        <div className={cn(WRAP, "stagger absolute inset-x-0 bottom-0 pb-16 text-white md:pb-32")}>
          <h1 className="font-display text-[clamp(2.1rem,7vw,8rem)] leading-[0.92] uppercase">
            Know which part of your farm will <em className="text-cane">flood.</em>
          </h1>
          <div className="mt-5 grid gap-4 border-t border-white/25 pt-4 md:mt-8 md:grid-cols-12 md:items-end md:gap-6 md:pt-5">
            <p className="text-white/80 md:col-span-6 md:text-lg">
              <strong className="font-semibold text-white">Real data, not a mock-up.</strong> This is the lower Richmond floodplain in NSW, mapped in 30-metre
              squares from satellite height data. Scroll, and the river rises to its February 2022 peak, replayed from the recorded rain and river flow.
            </p>
            <div className="flex flex-wrap gap-3 md:col-span-6 md:justify-end">
              <a href="#/farm" className={cn(btn, "bg-white text-ink hover:bg-paper")}>
                Set up my farm <ArrowRight className="size-4" aria-hidden />
              </a>
              <a href="#/live?replay" className={cn(btn, "border border-white/30 text-white hover:bg-white/10")}>
                Watch the 2022 flood
              </a>
            </div>
          </div>
        </div>
      </FloodValley>

      <RealData farm={farm} />

      <section className={cn(WRAP, "grid gap-12 py-20 md:grid-cols-12 md:items-center md:py-28")}>
        <div className="md:col-span-7">
          <h2 className="font-display text-[clamp(2.25rem,4.6vw,5rem)] leading-[0.95]">
            Flood warnings cover districts. <span className="text-flood">Floods hit paddocks.</span>
          </h2>
          <p className="mt-8 max-w-xl text-lg leading-relaxed text-muted-foreground">
            A flood warning for the whole Richmond valley can't tell a grower that the bottom of their block goes under first. Draki works it out for
            one field: how high each 30 m of ground sits above the river, how high the river is forecast to rise, and what to move before it does.
          </p>
          <a href="#/farm" className="mt-8 inline-flex items-center gap-2 font-medium text-leaf hover:underline">
            Mark your farm and see it <ArrowRight className="size-4" aria-hidden />
          </a>
        </div>
        <figure className="md:col-span-5">
          <Phone {...(r ? smsText(r, true, farm.isDemo) : { msgs: [] })} empty="…" />
          <figcaption className="mx-auto mt-4 max-w-[22rem] text-center text-sm text-muted-foreground">
            The texts Draki writes from the February 2022 flood's recorded rain and river flow. The grower's reply is an example.
          </figcaption>
        </figure>
      </section>

      <section className="bg-ink text-white">
        <div className={cn(WRAP, "grid gap-10 py-20 md:grid-cols-12 md:items-end md:py-28")}>
          <p className="font-display text-[clamp(4rem,13vw,13rem)] leading-[0.85] text-cane md:col-span-8">
            14.4
            <span className="ml-3 align-top text-[0.28em] tracking-normal text-white/70">metres</span>
          </p>
          <div className="md:col-span-4">
            <p className="text-lg leading-relaxed text-white/80">
              The river at Lismore on 28 February 2022, its highest flood on record, after {r ? `${r.peak.total.toFixed(0)} mm of rain in three days` : "days of heavy rain"}.
              Downstream, the towns of Woodburn and Broadwater, and the Broadwater sugar mill, went under.
            </p>
            <a href="#/live?replay" className="mt-6 inline-flex items-center gap-2 text-white hover:text-cane">
              Replay it on the map <ArrowRight className="size-4" aria-hidden />
            </a>
          </div>
        </div>
      </section>

      <section className="grid md:grid-cols-2">
        {/* The text sets the height; the photo just fills its half. */}
        <div className="relative min-h-72">
          <img src="/photos/flooded-field.jpg" alt="Farm fields partly under floodwater" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
        </div>
        <div className="px-6 py-16 md:px-14 md:py-24">
          <h2 className="font-display text-[clamp(2rem,3.6vw,3.75rem)] leading-[0.95]">Climate Awareness & Education</h2>
          <dl className="mt-10 max-w-xl space-y-6">
            {[
              ["COP31 target", "Climate action education for all by 2035"],
              ["How", "Each alert ends with one line on why heavy rain is getting more common here, tied to rain the grower can see"],
              ["Where", "Northern Rivers cane country, NSW. Australia is leading the COP31 talks, and this is climate action you can see on a farm"],
            ].map(([k, v]) => (
              <div key={k} className="grid grid-cols-[7rem_1fr] border-t border-rule pt-4">
                <dt className="text-sm text-muted-foreground">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </>
  )
}


/** The landing page's proof that nothing is mocked: live forecasts with their numbers right now, and the records behind the model. */
function RealData({ farm }: { farm: Farm }) {
  const r = farm.liveRun
  const m = farm.meta
  const where = farm.isDemo ? "the demo block" : "your farm"
  const centre: [number, number] = [farm.poly.reduce((a, p) => a + p[0], 0) / farm.poly.length, farm.poly.reduce((a, p) => a + p[1], 0) / farm.poly.length]
  const rainWeek = r ? r.w.daily.rain.reduce((a, v) => a + (v || 0), 0) : undefined
  const rows: { live: boolean; value: string; what: string; source: string; href?: string }[] = [
    {
      live: true,
      value: rainWeek !== undefined ? `${rainWeek.toFixed(0)} mm` : "…",
      what: `of rain forecast at ${where} over the next 7 days`,
      source: "Open-Meteo weather forecast, updated hourly",
      href: weatherUrl(centre, false),
    },
    {
      live: true,
      value: r?.river ? (r.river.q < 1 ? "Under 1 m³/s" : `${Math.round(r.river.q).toLocaleString("en-AU")} m³/s`) : "…",
      what: r?.river
        ? `Richmond River flow at its forecast peak this week, across ${r.river.flow.members?.length ?? 1} forecasts. It bursts its banks above ${r.river.cal.q2.toLocaleString("en-AU")} m³/s · fetched ${ago(r.river.flow.fetchedAt)}`
        : "Richmond River flow at its forecast peak this week",
      source: "Copernicus GloFAS river forecast (EU)",
      href: r?.river?.flow.url,
    },
    {
      live: false,
      value: m?.sentinel1 ? `${Math.round(m.sentinel1.observedHa / 100)} km²` : "…",
      what: "under water on 2 March 2022, mapped by satellite radar. We check Draki's flood map against it",
      source: "Copernicus Sentinel-1 (EU)",
      href: "#/proof",
    },
    {
      live: false,
      value: m ? `${m.record.length} floods` : "…",
      what: "on record since 2009, each matched to the river's flow that day",
      source: "Councils, ABC, AIDR and FloodList records",
      href: "#/proof",
    },
    {
      live: false,
      value: "30 m",
      what: "squares of ground height across the whole floodplain, plus a 10 m land-cover map",
      source: "Copernicus DEM GLO-30, ESA WorldCover",
      href: "https://planetarycomputer.microsoft.com/dataset/cop-dem-glo-30",
    },
  ]
  return (
    <section className="border-b border-rule bg-paper-2">
      <div className={cn(WRAP, "py-16 md:py-20")}>
        <div className="grid gap-6 md:grid-cols-12 md:items-end">
          <h2 className="font-display text-[clamp(2rem,4.4vw,4.5rem)] leading-[0.95] md:col-span-7">Every number here is real.</h2>
          <p className="text-lg leading-relaxed text-muted-foreground md:col-span-5">
            Forecasts are fetched live when you open the page. Past floods come from satellite images and official records. Every row links to the raw data.
          </p>
        </div>
        <ul className="mt-10">
          {rows.map((row) => (
            <li key={row.source} className="grid grid-cols-[auto_1fr] items-baseline gap-x-5 gap-y-1 border-t border-rule py-5 md:grid-cols-[7.5rem_14rem_1fr_auto]">
              <span className={cn("inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-medium", row.live ? "bg-leaf text-white" : "border border-silt/40 text-silt")}>
                {row.live && <i className="size-1.5 animate-pulse rounded-full bg-white" aria-hidden />}
                {row.live ? "Live now" : "Recorded"}
              </span>
              <span className="text-3xl font-semibold tabular-nums">{row.value}</span>
              <span className="col-span-2 md:col-span-1">{row.what}</span>
              {row.href ? (
                <a
                  href={row.href}
                  {...(row.href.startsWith("#") ? {} : { target: "_blank", rel: "noreferrer" })}
                  className="col-span-2 text-sm text-leaf hover:underline md:col-span-1 md:text-right"
                >
                  {row.source} <ArrowUpRight className="inline size-3.5" aria-hidden />
                </a>
              ) : (
                <span className="col-span-2 text-sm text-muted-foreground md:col-span-1">{row.source}</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

const LEVEL = { act: ["Act today", "bg-flood text-white"], watch: ["Watch", "bg-cane text-ink"], missed: ["Missed", "border border-rule text-muted-foreground"] } as const

const monthYear = (iso: string) => new Date(iso).toLocaleDateString("en-AU", { month: "short", year: "numeric" })

function Proof({ farm }: { farm: Farm }) {
  const m = farm.meta
  const s1 = m?.sentinel1
  const caught = m?.record.filter((e) => e.level === "act").length ?? 0
  const [history, setHistory] = useState<{ time: string[]; q: number[] }>()
  useEffect(() => {
    getFlowHistory().then(setHistory).catch(() => undefined)
  }, [])
  // Area of one 1 arc-second square at this latitude, in hectares.
  const cellHa = m ? ((m.res * 111_320) ** 2 * Math.cos((((m.bbox[1] + m.bbox[3]) / 2) * Math.PI) / 180)) / 10_000 : 0
  const day = (iso: string) => new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })
  return (
    <section className={cn(WRAP, "py-16")}>
      <h1 className="font-display text-5xl uppercase md:text-7xl">Does it work?</h1>
      <p className="mt-6 max-w-4xl text-2xl leading-snug">
        {s1 && m ? (
          <>
            Two days after the February 2022 peak, a satellite mapped <strong className="font-semibold">{Math.round(s1.observedHa / 100)} km²</strong> under
            water on the lower Richmond. Draki's map of the same flood overlaps it by <strong className="font-semibold">{Math.round(s1.csi * 100)}%</strong>, square by
            square. And all {caught} recorded floods since 2009 would have triggered <strong className="font-semibold">Act today</strong>.
          </>
        ) : (
          "Loading the evidence…"
        )}
      </p>

      {s1 && (
        <div className="mt-12 grid gap-8 lg:grid-cols-12">
          <figure className="lg:col-span-8">
            <img src={`${BASE}/agreement.png`} alt="Map of the lower Richmond floodplain: green where Draki and the satellite agree it flooded, blue where only the satellite saw water, amber where only Draki predicted it" className="w-full rounded-3xl" />
            <figcaption className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              {[
                ["#5daa6e", `Both agree: flooded (${Math.round((s1.hits * cellHa) / 100)} km²)`],
                ["#5a8fd8", "Satellite saw water, Draki didn't"],
                ["#d4a72c", "Draki flooded it, satellite saw none"],
              ].map(([c, l]) => (
                <span key={l} className="flex items-center gap-2">
                  <i className="inline-block size-3 rounded-sm" style={{ background: c }} />
                  {l}
                </span>
              ))}
            </figcaption>
          </figure>
          <div className="space-y-6 lg:col-span-4">
            <div>
              <h2 className="text-2xl">How we checked</h2>
              <p className="mt-3 text-muted-foreground">
                Sentinel-1 radar (EU Copernicus) passed over on {day(s1.after)}. Calm water reflects radar away, so it shows dark. We compared it with an image from{" "}
                {day(s1.before)} to find new water, then compared that with Draki's prediction for the river level that day.
              </p>
            </div>
            <div>
              <h2 className="text-2xl">On the demo block</h2>
              <p className="mt-3 text-muted-foreground">
                The satellite saw {Math.round(s1.demoObserved * 100)}% of the block under water. Draki predicted {Math.round(s1.demoModel * 100)}%.{" "}
                <a href="#/live?replay" className="font-medium text-leaf hover:underline">
                  Compare them on the map
                </a>
                .
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              One honest caveat: we used this same image to set the model up, so the overlap is a best fit rather than a blind test. The flood record below
              is the independent check.
            </p>
          </div>
        </div>
      )}

      <figure className="mt-16 rounded-3xl border border-rule bg-card p-6">
        <p className="text-sm text-muted-foreground">How much water the Richmond River carried near Woodburn, week by week, from the European flood-forecast system (GloFAS). Red dots are floods on record.</p>
        <div className="mt-4">{history && m ? <FlowHistory time={history.time} q={history.q} floods={m.record} q2={m.river.q2} q5={m.river.q5} /> : <div className="h-64" />}</div>
        <figcaption className="mt-3 text-sm text-muted-foreground">
          The tallest spikes in the river record are the floods people remember. That is the signal Draki forecasts.{" "}
          {m && (
            <a href={`https://flood-api.open-meteo.com/v1/flood?latitude=${m.glofas[0]}&longitude=${m.glofas[1]}&daily=river_discharge&start_date=1997-01-01&end_date=2026-09-30`} target="_blank" rel="noreferrer" className="text-leaf hover:underline">
              Raw data <ArrowUpRight className="inline size-3.5" aria-hidden />
            </a>
          )}
        </figcaption>
      </figure>

      <h2 className="mt-20 text-2xl">Every recorded flood since 2009</h2>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead className="text-muted-foreground">
            <tr className="border-b border-rule">
              <th className="py-3 pr-4 font-normal">When</th>
              <th className="py-3 pr-4 font-normal">What happened</th>
              <th className="py-3 pr-4 text-right font-normal">River flow at its peak</th>
              <th className="py-3 font-normal">Draki river alert</th>
            </tr>
          </thead>
          <tbody>
            {m?.record.map((e) => (
              <tr key={e.start} className="border-b border-rule">
                <td className="py-3 pr-4 whitespace-nowrap">{monthYear(e.start)}</td>
                <td className="py-3 pr-4">
                  {e.name}
                  <span className="block text-xs text-muted-foreground">{e.source}</span>
                </td>
                <td className="py-3 pr-4 text-right whitespace-nowrap tabular-nums">{e.peak.toLocaleString("en-AU")} m³/s</td>
                <td className="py-3">
                  <span className={cn("inline-block rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap", LEVEL[e.level][1])}>{LEVEL[e.level][0]}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {m && (
        <p className="mt-4 max-w-3xl text-sm text-muted-foreground">
          {m.unmatchedAlarms.length === 0
            ? "River flow is in cubic metres of water a second (m³/s); one cubic metre is 1,000 litres. Every time the river reached the Act today level since 2009, a flood was recorded. No false alarms."
            : `The river also reached the Act today level ${m.unmatchedAlarms.length} times with no flood we could find a record of (${m.unmatchedAlarms.map(monthYear).join(", ")}).`}
        </p>
      )}

      <h2 className="mt-20 max-w-5xl text-2xl">Why now: very heavy rain days have nearly tripled on the lower Richmond</h2>
      <p className="mt-4 max-w-3xl text-muted-foreground">
        Days a year with 50 mm or more of rain at Woodburn: about {Math.round(DECADES.then)} in the 1990s, about {Math.round(DECADES.now)} in 2016–25. These are small numbers, so treat it as a sign, not proof. Every alert ends with a line like this.
      </p>
      <figure className="mt-6 max-w-5xl rounded-3xl border border-rule bg-card p-6">
        <HeavyRainChart />
        <figcaption className="mt-3 text-sm text-muted-foreground">Source: ERA5, the European long-term weather record, via Open-Meteo.</figcaption>
      </figure>

      <h2 className="mt-20 text-2xl">How the model works</h2>
      <p className="mt-4 max-w-3xl text-muted-foreground">
        The lower Richmond floods when the river overtops its banks. For every 30 m square of a field we know how high it sits above the river. When the
        forecast river flow pushes the water higher than that, the square floods. Heavy local rain can also pool in the low spots.
      </p>
      <details className="mt-8">
        <summary className="text-leaf hover:underline">Technical details</summary>
      <dl className="mt-6 grid gap-x-10 gap-y-4 sm:grid-cols-3">
        {[
          ["River bursts its banks above", m ? `${m.river.q2.toLocaleString("en-AU")} m³/s (a flood that comes about every 2 years)` : "–"],
          ["Act today from", m ? `${m.river.q5.toLocaleString("en-AU")} m³/s (about every 5 years)` : "–"],
          ["River level above normal", m ? `${m.river.h0} m + ${m.river.k} × (√flow − √${m.river.q2})` : "–"],
          ["Tuned on", "Sentinel-1 flood map, 2 March 2022"],
          ["Counts as flooded", `${KNOBS.floodedDepth} m deep`],
          ["Cane value", `${aud(KNOBS.caneValuePerHa)} per hectare (125 t × A$55, two-year crop)`],
          ["Elevation", "Copernicus GLO-30, 30 m"],
          ["Land cover", "ESA WorldCover, 10 m"],
          ["River flow", "GloFAS v4"],
        ].map(([k, v]) => (
          <div key={k} className="border-t border-rule pt-3">
            <dt className="text-sm text-muted-foreground">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      </details>
      <p className="mt-8 max-w-3xl text-sm text-muted-foreground">
        What would make it better: our height map includes the tops of crops and roofs, not just the ground, and our river figures come from a global
        model, not the local river gauges. NSW publishes a far sharper height map (1-metre laser survey) and the Bureau of Meteorology runs river
        gauges here. Plugging both in is the next step.
      </p>
    </section>
  )
}
