import { useEffect, useState } from "react"
import { ArrowRight } from "lucide-react"
import { fjd, LivePage, useFarm, type Farm } from "@/Live"
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
        <path d="M16 2 4 7v8c0 7.5 5 12.6 12 15 7-2.4 12-7.5 12-15V7L16 2Z" fill="none" stroke="currentColor" strokeWidth={1.8} />
        <path d="M8 14c3-2.2 5.5-2.2 8 0s5 2.2 8 0" fill="none" stroke="#d4a72c" strokeWidth={1.8} strokeLinecap="round" />
        <path d="M9 19c2.5-1.8 4.6-1.8 7 0s4.5 1.8 7 0" fill="none" stroke="#5a8fd8" strokeWidth={1.8} strokeLinecap="round" />
      </svg>
      <span className="font-display text-2xl">FarmShield</span>
    </a>
  )
}

const btn = "inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-medium transition-colors"

export default function App() {
  const route = useRoute()
  const page = route.split(/[/?]/)[0]
  const farm = useFarm()
  const [mode, setMode] = useState<"live" | "replay">(route.includes("replay") ? "replay" : "live")
  useEffect(() => {
    if (route.includes("replay")) setMode("replay")
  }, [route])

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
          <LivePage farm={farm} mode={mode} setMode={setMode} />
        ) : page === "why" ? (
          <Why />
        ) : page === "proof" ? (
          <Proof farm={farm} />
        ) : (
          <Home />
        )}
      </main>

      <footer className="border-t border-rule">
        <div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-4 px-6 py-8 text-sm text-muted-foreground">
          <p>Built at Climate Hack-tion 2026</p>
          <p>Data: Open-Meteo, Copernicus, Esri · Photos: Unsplash (Troy Olson, insung yoon, Christine Walker)</p>
        </div>
      </footer>
    </div>
  )
}

function Home() {
  return (
    <>
      <section className="px-4 pt-4 md:px-6">
        <div className="relative isolate mx-auto flex min-h-[min(78svh,760px)] max-w-7xl items-end overflow-hidden rounded-3xl">
          <img src="/photos/storm-field.jpg" alt="Storm clouds over a green field" className="absolute inset-0 -z-10 h-full w-full object-cover object-[center_65%]" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ink/90 via-ink/40 to-ink/10" />
          <div className="max-w-3xl p-8 text-white md:p-14">
            <p className="text-sm text-white/70">Climate Hack-tion 2026 · Road to COP31</p>
            <h1 className="mt-4 font-display text-5xl leading-[1.05] lg:text-6xl">
              Know which part of your farm will <em className="text-cane">flood.</em>
            </h1>
            <p className="mt-5 text-white/75">Field-level flood alerts by SMS for cane growers in Fiji.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#/live" className={cn(btn, "bg-white text-ink hover:bg-paper")}>
                Open live demo <ArrowRight className="size-4" aria-hidden />
              </a>
              <a href="#/how" className={cn(btn, "border border-white/30 text-white hover:bg-white/10")}>
                How it works
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-24">
        <h2 className="max-w-3xl font-display text-5xl leading-tight">Flood warnings cover districts. Floods hit paddocks.</h2>
        <div className="mt-14 grid gap-10 md:grid-cols-3">
          {[
            ["Your field", "Satellite elevation shows where water settles."],
            ["A text, not an app", "Three actions, sent to any phone."],
            ["The why", "Every alert links the storm to the climate trend."],
          ].map(([h, p]) => (
            <div key={h} className="border-t border-ink pt-5">
              <h3 className="text-2xl">{h}</h3>
              <p className="mt-2 text-muted-foreground">{p}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-ink text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-20 md:grid-cols-3">
          {[
            [DECADES.now.toFixed(1), `heavy-rain days a year in Ba, up from ${DECADES.then.toFixed(1)}`],
            ["450+ mm", "in 72 hours during Cyclone Cody, 2022"],
            ["2035", "COP31 target: climate education for all"],
          ].map(([v, l]) => (
            <div key={v}>
              <p className="text-5xl font-semibold">{v}</p>
              <p className="mt-3 text-white/60">{l}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-24 md:grid-cols-2">
        <div>
          <h2 className="font-display text-5xl leading-tight">Built for COP31.</h2>
          <dl className="mt-10 space-y-6">
            {[
              ["Track", "Climate Awareness & Education"],
              ["Target", "Climate action education for all by 2035"],
              ["Region", "Pacific-led, starting in Ba, Fiji"],
            ].map(([k, v]) => (
              <div key={k} className="grid grid-cols-[6rem_1fr] border-t border-rule pt-4">
                <dt className="text-sm text-muted-foreground">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <img src="/photos/flooded-field.jpg" alt="Farm fields partly under floodwater" className="aspect-[4/3] w-full rounded-3xl object-cover" loading="lazy" />
      </section>

      <section className="px-4 pb-16 md:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-6 rounded-3xl bg-leaf px-8 py-12 text-white md:px-14">
          <h2 className="font-display text-5xl">See it on a real field.</h2>
          <a href="#/live" className={cn(btn, "bg-white text-ink hover:bg-paper")}>
            Open live demo <ArrowRight className="size-4" aria-hidden />
          </a>
        </div>
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
            ["We match land to rain", "Elevation finds the low ground. The forecast says how much is coming."],
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

function Proof({ farm }: { farm: Farm }) {
  const r = farm.replayRun
  return (
    <section className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="font-display text-5xl">Does it work?</h1>
      <p className="mt-4 text-muted-foreground">We replay Cyclone Cody and compare with Sentinel-1 satellite flood maps.</p>
      <div className="mt-12 grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-rule bg-card p-6">
          <p className="text-sm text-muted-foreground">Predicted by FarmShield</p>
          <p className="mt-4 text-5xl font-semibold">{r ? `${r.a.floodedHa.toFixed(0)} ha` : "–"}</p>
          <p className="mt-2 text-muted-foreground">of {r?.a.areaHa.toFixed(0) ?? "–"} ha under water</p>
          <a href="#/live?replay" className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-leaf hover:underline">
            See it on the map <ArrowRight className="size-4" aria-hidden />
          </a>
        </div>
        <div className="rounded-3xl border border-dashed border-silt/50 p-6">
          <p className="text-sm text-muted-foreground">Observed by Sentinel-1</p>
          <p className="mt-4 text-5xl font-semibold text-muted-foreground/50">Soon</p>
          <p className="mt-2 text-muted-foreground">Radar flood extent, January 2022</p>
        </div>
      </div>
      <h2 className="mt-20 text-2xl">Model settings</h2>
      <dl className="mt-6 grid gap-x-10 gap-y-4 sm:grid-cols-3">
        {[
          ["Soaks in or drains", `${KNOBS.absorbedMm} mm`],
          ["Pooling factor", `× ${KNOBS.pooling}`],
          ["Counts as flooded", `${KNOBS.floodedDepth} m deep`],
          ["Cane value", `${fjd(KNOBS.caneValuePerHa)}/ha`],
          ["Elevation", "Copernicus 90 m"],
          ["Rain window", "72 hours"],
        ].map(([k, v]) => (
          <div key={k} className="border-t border-rule pt-3">
            <dt className="text-sm text-muted-foreground">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
