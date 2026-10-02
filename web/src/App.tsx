import { useEffect, useRef, useState } from "react"
import { ArrowRight } from "lucide-react"
import { fjd, LivePage, smsText, useFarm, type Farm } from "@/Live"
import { DECADES, HeavyRainChart } from "@/components/weather"
import { KNOBS } from "@/lib/flood"
import { cn } from "@/lib/utils"

// Type scale, four sizes only: text-sm (labels), text-base (body), text-2xl (subheads, numbers), text-5xl (page titles).

const NAV = [
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
      <span className="font-display text-2xl">Draki</span>
    </a>
  )
}

const btn = "inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-medium transition-colors"

export default function App() {
  const route = useRoute()
  const page = route.split(/[/?]/)[0]
  const farm = useFarm()
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
      <nav className="sticky top-0 z-[2000] border-b border-rule bg-paper/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
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

      <main className="flex-1">
        {page === "how" ? (
          <How />
        ) : page === "live" ? (
          <LivePage farm={farm} mode={mode} setMode={chooseMode} />
        ) : page === "why" ? (
          <Why />
        ) : page === "proof" ? (
          <Proof farm={farm} />
        ) : (
          <Home farm={farm} />
        )}
      </main>

      <footer className="border-t border-rule">
        <div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-4 px-6 py-8 text-sm text-muted-foreground">
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
      <section className="relative isolate flex min-h-[min(80svh,760px)] items-end overflow-hidden">
        <img src="/photos/storm-field.jpg" alt="Storm clouds over a green field" className="absolute inset-0 -z-10 h-full w-full object-cover object-[center_65%]" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ink/90 via-ink/40 to-ink/10" />
        <div className="mx-auto w-full max-w-7xl px-6 pt-24 pb-14 text-white md:pb-20">
          <h1 className="max-w-3xl font-display text-5xl leading-[1.05] lg:text-6xl">
            Know which part of your farm will <em className="text-cane">flood.</em>
          </h1>
          <p className="mt-5 max-w-xl text-white/75">Field-level flood alerts by SMS for cane growers on the Ba River, Fiji.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#/live" className={cn(btn, "bg-white text-ink hover:bg-paper")}>
              Open live demo <ArrowRight className="size-4" aria-hidden />
            </a>
            <a href="#/how" className={cn(btn, "border border-white/30 text-white hover:bg-white/10")}>
              How it works
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-24 lg:grid-cols-2">
        <div>
          <h2 className="font-display text-5xl leading-tight">Flood warnings cover districts. Floods hit paddocks.</h2>
          <p className="mt-6 max-w-xl text-muted-foreground">
            A warning for the whole Western Division can't tell a grower that the bottom of their block goes under first. Draki works it out for one
            field: how high each 30 m of ground sits above the Ba River, how high the river is forecast to rise, and what to move before it does.
          </p>
        </div>
        <figure>
          <div className="mx-auto max-w-sm rounded-[2rem] bg-ink p-3">
            <p className="rounded-[1.5rem] bg-white/10 p-4 text-sm leading-relaxed whitespace-pre-line text-white/90">{r ? smsText(r, true, true) : "…"}</p>
          </div>
          <figcaption className="mx-auto mt-3 max-w-sm text-sm text-muted-foreground">
            The text Draki writes for the demo block from Cyclone Cody's recorded rain and river flow.
          </figcaption>
        </figure>
      </section>

      <section className="bg-ink text-white">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <p className="max-w-4xl font-display text-3xl leading-snug md:text-4xl">
            In January 2022 Cyclone Cody dropped {r ? `${r.peak.total.toFixed(0)} mm` : "450 mm"} of rain on Ba in three days, and the Ba River reached{" "}
            {m ? `${m.river.codyPeak.toLocaleString("en-AU")} m³/s` : "1,090 m³/s"}, its highest flow since records began in 1997.
          </p>
          <a href="#/live?replay" className="mt-8 inline-flex items-center gap-2 text-white/70 hover:text-white">
            Replay it on the map <ArrowRight className="size-4" aria-hidden />
          </a>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-24 md:grid-cols-2">
        <div>
          <h2 className="font-display text-5xl leading-tight">Climate Awareness & Education</h2>
          <dl className="mt-10 space-y-6">
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
        <img src="/photos/flooded-field.jpg" alt="Farm fields partly under floodwater" className="aspect-[4/3] w-full rounded-3xl object-cover" loading="lazy" />
      </section>
    </>
  )
}

function How() {
  return (
    <section className="mx-auto grid max-w-7xl gap-12 px-6 py-16 lg:grid-cols-2">
      <div>
        <h1 className="font-display text-5xl">How it works</h1>
        <ol className="mt-12">
          {[
            ["Mark your field", "Tap its corners on a satellite map. Once."],
            ["We match land to river and rain", "We know how high every part of the field sits above the Ba River. River and rain forecasts say how high the water will go."],
            ["You get a text", "What to move, where to park, and why it's happening."],
          ].map(([h, p], i) => (
            <li key={h} className="grid grid-cols-[3.5rem_1fr] border-t border-rule py-8">
              <span className="font-display text-5xl leading-none text-leaf/40">{i + 1}</span>
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
    <section className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="font-display text-5xl leading-tight">Heavy-rain days in Ba are up {up}%.</h1>
      <p className="mt-4 text-muted-foreground">
        Days a year with 50 mm+ rain: {DECADES.then.toFixed(1)} in the 1990s, {DECADES.now.toFixed(1)} in 2015–24. Every alert ends with this why.
      </p>
      <div className="mt-12 rounded-3xl border border-rule bg-card p-6">
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
  return (
    <section className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="font-display text-5xl leading-tight">Does it work?</h1>
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
