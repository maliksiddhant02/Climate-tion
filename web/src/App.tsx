import { useEffect, useRef, useState } from "react"
import { ArrowRight, ArrowUpRight } from "lucide-react"
import { fjd, LivePage, smsText, useFarm, type Farm } from "@/Live"
import { DECADES, FlowHistory, HeavyRainChart } from "@/components/weather"
import { FloodValley } from "@/components/FloodValley"
import { FarmPage } from "@/Farm"
import { getFlowHistory } from "@/lib/api"
import { KNOBS } from "@/lib/flood"
import { cn } from "@/lib/utils"

// Type: Archivo throughout. font-display = 125% width, 800 weight. One wide frame (WRAP) so every page shares the nav's left edge.
const WRAP = "mx-auto w-full max-w-[1600px] px-6 md:px-10"

const NAV = [
  ["farm", "My farm"],
  ["how", "How it works"],
  ["live", "Live demo"],
  ["why", "Why now"],
  ["proof", "Validation"],
] as const

/** Hash routing: #/how, #/live, #/live?replay … No router needed for five pages. */
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
  // A dry week makes a dull demo: if this week is all clear, open on the Cody replay instead.
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
                className={cn("rounded-full px-4 py-2 text-sm transition-colors", page === id ? "bg-ink text-paper" : "text-muted-foreground hover:text-ink")}
              >
                {label}
              </a>
            ))}
          </div>
          <a href="#/live" className={cn(btn, "bg-cane py-2 text-ink hover:bg-[#e2b84a]")}>
            Try it
          </a>
        </div>
        <div className="flex gap-1 overflow-x-auto px-4 pb-3 md:hidden">
          {NAV.map(([id, label]) => (
            <a key={id} href={`#/${id}`} className={cn("shrink-0 rounded-full px-3 py-1.5 text-sm", page === id ? "bg-ink text-paper" : "text-muted-foreground")}>
              {label}
            </a>
          ))}
        </div>
      </nav>

      <main key={page} className="page-enter flex-1">
        {page === "how" ? (
          <How />
        ) : page === "live" ? (
          <LivePage farm={farm} mode={mode} setMode={chooseMode} />
        ) : page === "why" ? (
          <Why />
        ) : page === "proof" ? (
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
          <p>Data: Copernicus (DEM, Sentinel-1, GloFAS, ERA5), ESA WorldCover, Open-Meteo, Esri · Photos: Unsplash (Troy Olson, insung yoon, Christine Walker)</p>
        </div>
      </footer>
    </div>
  )
}

function Home({ farm }: { farm: Farm }) {
  const r = farm.replayRun
  const m = farm.meta
  return (
    <>
      <FloodValley>
        <div className={cn(WRAP, "stagger absolute inset-x-0 bottom-0 pb-6 text-white md:pb-14")}>
          <h1 className="font-display text-[clamp(2.1rem,7vw,8rem)] leading-[0.92] uppercase">
            Know which part of your farm will <em className="text-cane">flood.</em>
          </h1>
          <div className="mt-5 grid gap-4 border-t border-white/25 pt-4 md:mt-8 md:grid-cols-12 md:items-end md:gap-6 md:pt-5">
            <p className="text-white/80 md:col-span-6 md:text-lg">
              This is the real Ba floodplain in Fiji, 30 m at a time. Scroll, and the Ba River rises to Cyclone Cody's peak.
            </p>
            <div className="flex flex-wrap gap-3 md:col-span-6 md:justify-end">
              <a href="#/live" className={cn(btn, "bg-white text-ink hover:bg-paper")}>
                Open live demo <ArrowRight className="size-4" aria-hidden />
              </a>
              <a href="#/how" className={cn(btn, "border border-white/30 text-white hover:bg-white/10")}>
                How it works
              </a>
            </div>
          </div>
        </div>
      </FloodValley>

      <section className={cn(WRAP, "py-24 md:py-32")}>
        <h2 className="font-display text-[clamp(2.25rem,5.6vw,6rem)] leading-[0.95]">
          Flood warnings cover districts. <span className="text-flood">Floods hit paddocks.</span>
        </h2>
        <div className="mt-16 grid gap-12 md:grid-cols-12">
          <div className="md:col-span-5">
            <p className="text-lg leading-relaxed text-muted-foreground">
              A warning for the whole Western Division can't tell a grower that the bottom of their block goes under first. Draki works it out for
              one field: how high each 30 m of ground sits above the Ba River, how high the river is forecast to rise, and what to move before it does.
            </p>
            <a href="#/how" className="mt-8 inline-flex items-center gap-2 font-medium text-leaf hover:underline">
              How the model works <ArrowRight className="size-4" aria-hidden />
            </a>
          </div>
          <figure className="md:col-span-6 md:col-start-7 md:-mt-4">
            <div className="rounded-[2rem] bg-ink p-3">
              <p className="rounded-[1.5rem] bg-white/10 p-5 text-base leading-relaxed whitespace-pre-line text-white/90">{r ? smsText(r, true, true) : "…"}</p>
            </div>
            <figcaption className="mt-3 text-sm text-muted-foreground">The text Draki writes for the demo block from Cyclone Cody's recorded rain and river flow.</figcaption>
          </figure>
        </div>
      </section>

      <section className="bg-ink text-white">
        <div className={cn(WRAP, "grid gap-10 py-20 md:grid-cols-12 md:items-end md:py-28")}>
          <p className="font-display text-[clamp(4rem,13vw,13rem)] leading-[0.85] text-cane md:col-span-8">
            {m ? m.river.codyPeak.toLocaleString("en-AU") : "1,090"}
            <span className="ml-3 align-top text-[0.28em] tracking-normal text-white/70">m³/s</span>
          </p>
          <div className="md:col-span-4">
            <p className="text-lg leading-relaxed text-white/80">
              The Ba River at Cyclone Cody's peak, January 2022: its highest flow since records began in 1997, after{" "}
              {r ? `${r.peak.total.toFixed(0)} mm` : "450 mm"} of rain in three days.
            </p>
            <a href="#/live?replay" className="mt-6 inline-flex items-center gap-2 text-white hover:text-cane">
              Replay it on the map <ArrowRight className="size-4" aria-hidden />
            </a>
          </div>
        </div>
      </section>

      <section className="grid md:grid-cols-2">
        <img src="/photos/flooded-field.jpg" alt="Farm fields partly under floodwater" className="h-full min-h-80 w-full object-cover" loading="lazy" />
        <div className="px-6 py-20 md:px-14 md:py-28">
          <h2 className="font-display text-[clamp(2rem,3.6vw,3.75rem)] leading-[0.95]">Climate Awareness & Education</h2>
          <dl className="mt-10 max-w-xl space-y-6">
            {[
              ["COP31 target", "Climate action education for all by 2035"],
              ["How", "Each alert ends with one line on why Ba's storms are getting heavier, tied to rain the grower can see"],
              ["Where", "Ba, Fiji. Built for the Pacific growers COP31 is putting first"],
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

function How() {
  return (
    <section className={cn(WRAP, "grid gap-12 py-16 lg:grid-cols-2")}>
      <div>
        <h1 className="font-display text-5xl uppercase md:text-7xl">How it works</h1>
        <ol className="mt-12">
          {[
            ["Mark your field", "Tap its corners on a satellite map. Once."],
            ["We match land to river and rain", "We know how high every part of the field sits above the Ba River. River and rain forecasts say how high the water will go."],
            ["You get a text", "What to move, where to park, and why it's happening."],
          ].map(([h, p], i) => (
            <li key={h} className="grid grid-cols-[3.5rem_1fr] border-t border-rule py-8">
              <span className="font-display text-5xl leading-none text-leaf">{i + 1}</span>
              <div>
                <h2 className="text-2xl">{h}</h2>
                <p className="mt-2 text-muted-foreground">{p}</p>
              </div>
            </li>
          ))}
        </ol>
        <a href="#/live" className={cn(btn, "bg-ink text-paper hover:bg-ink-2")}>
          Try it on a field <ArrowRight className="size-4" aria-hidden />
        </a>
      </div>
      <img src="/photos/cane-harvest.jpg" alt="Cane harvester beside a tall sugarcane crop" className="h-full min-h-80 w-full rounded-3xl object-cover" />
    </section>
  )
}

function Why() {
  const up = Math.round((DECADES.now / DECADES.then - 1) * 100)
  return (
    <section className={cn(WRAP, "py-16")}>
      <h1 className="max-w-5xl font-display text-5xl leading-[0.95] md:text-7xl">Heavy-rain days in Ba are up {up}%.</h1>
      <p className="mt-4 text-muted-foreground">
        Days a year with 50 mm+ rain: {DECADES.then.toFixed(1)} in the 1990s, {DECADES.now.toFixed(1)} in 2015–24. Every alert ends with this why.
      </p>
      <div className="mt-12 max-w-5xl rounded-3xl border border-rule bg-card p-6">
        <HeavyRainChart />
      </div>
      <p className="mt-4 text-sm text-muted-foreground">ERA5 reanalysis via Open-Meteo. Context for farmers, not proof of a trend.</p>
    </section>
  )
}

const LEVEL = { act: ["Act today", "bg-flood text-white"], watch: ["Watch", "bg-cane text-ink"], missed: ["Missed", "border border-rule text-muted-foreground"] } as const

const monthYear = (iso: string) => new Date(iso).toLocaleDateString("en-AU", { month: "short", year: "numeric" })

function Proof({ farm }: { farm: Farm }) {
  const r = farm.replayRun
  const m = farm.meta
  const major = m?.record.filter((e) => e.peak >= m.river.q5) ?? []
  const caught = m?.record.filter((e) => e.level !== "missed").length ?? 0
  const [history, setHistory] = useState<{ time: string[]; q: number[] }>()
  useEffect(() => {
    getFlowHistory().then(setHistory).catch(() => undefined)
  }, [])
  return (
    <section className={cn(WRAP, "py-16")}>
      <h1 className="font-display text-5xl uppercase md:text-7xl">Does it work?</h1>
      <p className="mt-6 max-w-3xl text-2xl leading-snug">
        {m ? (
          <>
            All {major.length} major Ba River floods on record would have triggered <strong className="font-semibold">Act today</strong>. Counting
            smaller floods, {caught} of {m.record.length} would have triggered a warning.
          </>
        ) : (
          "Loading the flood record…"
        )}
      </p>
      <p className="mt-4 max-w-3xl text-muted-foreground">
        We can't wait for the next flood, so we checked the river record against every Ba flood we could find a source for.
        {r && (
          <>
            {" "}
            In the Cyclone Cody replay, {r.a.floodedHa.toFixed(1)} of the demo block's {r.a.areaHa.toFixed(1)} ha go under.{" "}
            <a href="#/live?replay" className="font-medium text-leaf hover:underline">
              See it on the map
            </a>
            .
          </>
        )}
      </p>

      <figure className="mt-12 rounded-3xl border border-rule bg-card p-6">
        <p className="text-sm text-muted-foreground">Ba River flow since 1997 (GloFAS, weekly peak, m³/s). Red dots are floods that made the news.</p>
        <div className="mt-4">{history && m ? <FlowHistory time={history.time} q={history.q} floods={m.record} q2={m.river.q2} q5={m.river.q5} /> : <div className="h-64" />}</div>
        <figcaption className="mt-3 text-sm text-muted-foreground">
          The tallest spikes in 30 years of river data are the floods people remember. That is the signal Draki forecasts.{" "}
          <a href="https://flood-api.open-meteo.com/v1/flood?latitude=-17.525&longitude=177.625&daily=river_discharge&start_date=1997-01-01&end_date=2026-09-30" target="_blank" rel="noreferrer" className="text-leaf hover:underline">
            Raw data <ArrowUpRight className="inline size-3.5" aria-hidden />
          </a>
        </figcaption>
      </figure>

      <h2 className="mt-20 text-2xl">Every recorded Ba flood we could source</h2>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead className="text-muted-foreground">
            <tr className="border-b border-rule">
              <th className="py-3 pr-4 font-normal">When</th>
              <th className="py-3 pr-4 font-normal">What happened</th>
              <th className="py-3 pr-4 text-right font-normal">River peak</th>
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
          In the two misses the Ba River itself stayed low, so the water likely came from creeks or heavy local rain instead. We haven't confirmed that. Those are the floods the rain-pooling half of the model is meant to catch. Since 2009 the
          river also crossed the Act line {m.unmatchedAlarms.length} times with no flood we could find a record of (
          {m.unmatchedAlarms.map(monthYear).join(", ")}). Some of those may be floods that never made the news; we haven't checked yet.
        </p>
      )}

      <h2 className="mt-20 text-2xl">Why not use satellite flood maps?</h2>
      <p className="mt-4 max-w-3xl text-muted-foreground">
        We tried. Sentinel-1 radar passed over Ba on {m ? new Date(m.sentinel1.after).toLocaleDateString("en-AU", { day: "numeric", month: "long" }) : "11 January"},
        2.5 days after Cody's peak, and found {m?.sentinel1.newWaterHa ?? 0} ha of open floodwater left. Ba's floods drain before the satellite
        comes back twelve days later. A warning has to come from a forecast.
      </p>

      <h2 className="mt-20 text-2xl">How the model works</h2>
      <p className="mt-4 max-w-3xl text-muted-foreground">
        Ba floods when the Ba River overtops its banks. For every 30 m square of a field we know how high it sits above the river. When the
        forecast river flow pushes the water higher than that, the square floods. Heavy local rain can also pool in the low spots.
      </p>
      <dl className="mt-8 grid gap-x-10 gap-y-4 sm:grid-cols-3">
        {[
          ["River stays in its banks up to", m ? `${m.river.q2} m³/s (2-year flood)` : "–"],
          ["Act today from", m ? `${m.river.q5} m³/s (5-year flood)` : "–"],
          ["River level above normal", m ? `${m.river.h0} m + ${m.river.k} × (√flow − √${m.river.q2})` : "–"],
          ["Tuned on", "Ba Town's streets flooding in Cody"],
          ["Counts as flooded", `${KNOBS.floodedDepth} m deep`],
          ["Cane value", `${fjd(KNOBS.caneValuePerHa)}/ha (46.4 t × F$57.40)`],
          ["Elevation", "Copernicus GLO-30, 30 m"],
          ["Land cover", "ESA WorldCover, 10 m"],
          ["River flow", "GloFAS v4, 1984–today"],
        ].map(([k, v]) => (
          <div key={k} className="border-t border-rule pt-3">
            <dt className="text-sm text-muted-foreground">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-8 max-w-3xl text-sm text-muted-foreground">
        Limits we know about: the elevation model measures the top of crops and roofs, not bare ground; height above the river is measured in a
        straight line, not along how water actually flows; and the river level curve rests on one tuning point. Each would sharpen with Fiji LiDAR
        and a river gauge record.
      </p>
    </section>
  )
}
