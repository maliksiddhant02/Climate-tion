import { useEffect, useMemo, useRef, useState } from "react"
import { AlertTriangle, ArrowRight, ArrowUpRight, Check, Eye, MapPin, PenLine, RotateCcw, Satellite } from "lucide-react"
import { FieldMap } from "@/components/FieldMap"
import { DECADES, HeavyRainChart, RainBars, wx } from "@/components/weather"
import { buttonVariants } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getElevations, getWeather, REPLAY, type Weather } from "@/lib/api"
import { assess, floodDepths, gridInPolygon, KNOBS, maxRolling, PLAYBOOK, type Assessment, type Cell, type LatLng, type Level } from "@/lib/flood"
import { cn } from "@/lib/utils"

// Demo block: cane farms on the east bank of the Ba River, just north of Ba town.
const DEMO: LatLng[] = [[-17.52031, 177.68509], [-17.51976, 177.69024], [-17.52577, 177.6911], [-17.52686, 177.68566]]

// Fewer elevation cells than this and the field is too small to say anything useful.
const MIN_CELLS = 4

const fjd =(v: number) => `F$${(Math.round(v / 100) * 100).toLocaleString("en-AU")}`
const dateLabel = (iso: string) => new Date(iso).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })
const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short" })
const weekday = (iso: string) => new Date(iso).toLocaleDateString("en-AU", { weekday: "short" })

function run(w: Weather | undefined, elev: { points: LatLng[]; stepM: number; e: number[] } | undefined) {
  if (!w || !elev) return undefined
  const peak = maxRolling(w.hourly.rain)
  const depths = floodDepths(elev.e, elev.stepM ** 2, peak.total)
  const cells: Cell[] = elev.points.map(([lat, lng], i) => ({ lat, lng, elev: elev.e[i], depth: depths[i] }))
  return { peak, cells, a: assess(cells, elev.stepM), w }
}

const STATUS: Record<Level, { label: string; Icon: typeof Check; cls: string }> = {
  act: { label: "Act today", Icon: AlertTriangle, cls: "bg-flood text-white" },
  watch: { label: "Watch", Icon: Eye, cls: "bg-cane text-ink" },
  clear: { label: "All clear", Icon: Check, cls: "bg-leaf text-white" },
}

function StatusPill({ level, className }: { level: Level; className?: string }) {
  const { label, Icon, cls } = STATUS[level]
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider", cls, className)}>
      <Icon className="size-3.5" aria-hidden />
      {label}
    </span>
  )
}

function Eyebrow({ n, children, dark }: { n: string; children: React.ReactNode; dark?: boolean }) {
  return (
    <p className={cn("flex items-center gap-3 font-mono text-xs uppercase tracking-[0.18em]", dark ? "text-white/60" : "text-muted-foreground")}>
      <span className={dark ? "text-cane" : "text-leaf"}>{n}</span>
      <span className={cn("h-px w-8", dark ? "bg-white/25" : "bg-rule")} />
      {children}
    </p>
  )
}

function Logo({ light }: { light?: boolean }) {
  return (
    <a href="#top" className={cn("flex items-center gap-2.5", light ? "text-white" : "text-ink")}>
      <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
        <path d="M16 2 4 7v8c0 7.5 5 12.6 12 15 7-2.4 12-7.5 12-15V7L16 2Z" fill="currentColor" opacity={0.12} />
        <path d="M16 2 4 7v8c0 7.5 5 12.6 12 15 7-2.4 12-7.5 12-15V7L16 2Z" fill="none" stroke="currentColor" strokeWidth={1.6} />
        <path d="M8 14c3-2.2 5.5-2.2 8 0s5 2.2 8 0" fill="none" stroke="#d4a72c" strokeWidth={1.6} strokeLinecap="round" />
        <path d="M9 19c2.5-1.8 4.6-1.8 7 0s4.5 1.8 7 0" fill="none" stroke="#5a8fd8" strokeWidth={1.6} strokeLinecap="round" />
      </svg>
      <span className="font-display text-xl font-medium tracking-tight">FarmShield</span>
    </a>
  )
}

function smsText(r: NonNullable<ReturnType<typeof run>>, replay: boolean, demo: boolean) {
  const { a, peak, w } = r
  const from = w.hourly.time[peak.start]
  const head = {
    act: `FLOOD RISK HIGH from ${from ? dateLabel(from) : "this week"}`,
    watch: `Wet spell from ${from ? dateLabel(from) : "this week"}`,
    clear: "No flooding expected this week",
  }[a.level]
  const body =
    a.level === "clear"
      ? `Up to ${peak.total.toFixed(0)} mm of rain in any 3 days. Your field should drain fine.`
      : `${peak.total.toFixed(0)} mm of rain in 72 h. Your lowest ground (${a.low.elev.toFixed(0)} m) could sit under ~${a.maxDepth.toFixed(1)} m of water. About ${a.floodedHa.toFixed(0)} ha of cane, ${fjd(a.valueAtRisk)}.`
  return [
    `FarmShield · ${demo ? "Ba block" : "your field"}${replay ? " (replay)" : ""}`,
    head,
    body,
    PLAYBOOK[a.level].map((t, i) => `${i + 1}. ${t}`).join("\n"),
    `Why: Ba now gets ${DECADES.now.toFixed(0)} days a year of 50 mm+ rain, up from ${DECADES.then.toFixed(0)} in the 1990s. Warmer air holds ~7% more water per °C, so storms drop more.`,
  ].join("\n\n")
}

export default function App() {
  const [poly, setPoly] = useState<LatLng[]>(DEMO)
  const [draft, setDraft] = useState<LatLng[]>()
  const [mode, setMode] = useState<"live" | "replay">(location.hash === "#replay" ? "replay" : "live")
  const [lang, setLang] = useState("en")
  const [live, setLive] = useState<Weather>()
  const [replay, setReplay] = useState<Weather>()
  const [elev, setElev] = useState<{ points: LatLng[]; stepM: number; e: number[] }>()
  const [error, setError] = useState<string>()
  const [draftError, setDraftError] = useState<string>()
  const [attempt, setAttempt] = useState(0)
  // Once someone picks a tab we stop auto-switching for them.
  const modeChosen = useRef(location.hash === "#replay")
  const chooseMode = (m: "live" | "replay") => {
    modeChosen.current = true
    setMode(m)
  }
  const isDemo = poly === DEMO

  const center = useMemo<LatLng>(() => [poly.reduce((s, p) => s + p[0], 0) / poly.length, poly.reduce((s, p) => s + p[1], 0) / poly.length], [poly])

  useEffect(() => {
    // Drop the old field's numbers so nothing stale shows while (or if) the new one loads.
    setError(undefined)
    setLive(undefined)
    setReplay(undefined)
    setElev(undefined)
    const fail = (e: unknown) =>
      setError(e instanceof TypeError ? "We couldn't reach the weather service. Check your connection and try again." : (e as Error).message)
    getWeather(center, false).then(setLive).catch(fail)
    getWeather(center, true).then(setReplay).catch(fail)
    const { points, stepM } = gridInPolygon(poly)
    getElevations(points)
      .then((e) => setElev({ points, stepM, e }))
      .catch(fail)
  }, [poly, center, attempt])

  const liveRun = useMemo(() => run(live, elev), [live, elev])
  const replayRun = useMemo(() => run(replay, elev), [replay, elev])
  const r = mode === "live" ? liveRun : replayRun

  // A dry week makes a dull demo: if this week is all clear, open on the Cody replay instead.
  useEffect(() => {
    if (liveRun?.a.level === "clear" && !modeChosen.current) setMode("replay")
  }, [liveRun])

  const startDraft = () => {
    setDraftError(undefined)
    setDraft([])
  }
  const cancelDraft = () => {
    setDraftError(undefined)
    setDraft(undefined)
  }
  const finishDraft = () => {
    if (!draft || draft.length < 3) return
    if (gridInPolygon(draft).points.length < MIN_CELLS) {
      setDraftError("That field is too small to read. Tap the corners of a block at least 1 ha across.")
      return
    }
    setDraftError(undefined)
    setPoly(draft)
    setDraft(undefined)
  }

  return (
    <div id="top" className="bg-paper text-ink">
      {/* ───────────── Hero ───────────── */}
      <header className="relative isolate min-h-[min(100svh,980px)] overflow-hidden bg-ink text-white">
        <img src="/photos/storm-field.jpg" alt="Storm clouds building over a green field" className="absolute inset-0 -z-20 h-full w-full object-cover object-[center_65%]" />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(100deg,rgba(19,33,26,.88)_0%,rgba(19,33,26,.55)_45%,rgba(19,33,26,.05)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-56 bg-gradient-to-t from-ink to-transparent" />

        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
          <Logo light />
          <div className="hidden items-center gap-1 rounded-full border border-white/15 bg-white/5 p-1 text-sm backdrop-blur-md md:flex">
            {[["How it works", "#how"], ["Live field", "#live"], ["Why now", "#why"], ["Validation", "#proof"]].map(([l, h]) => (
              <a key={h} href={h} className="rounded-full px-4 py-1.5 text-white/75 transition-colors hover:bg-white/10 hover:text-white">
                {l}
              </a>
            ))}
          </div>
          <a href="#live" className="rounded-full bg-cane px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-[#e2b84a]">
            Try it
          </a>
        </nav>

        <div className="mx-auto grid max-w-7xl gap-12 px-6 pt-10 pb-12 lg:grid-cols-12 lg:pt-16 lg:pb-40">
          <div className="lg:col-span-7">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.16em] text-white/75 backdrop-blur">
              <MapPin className="size-3.5 text-cane" aria-hidden /> Ba River floodplain, Fiji
            </p>
            <h1 className="mt-6 font-display text-5xl leading-[1.02] font-normal tracking-tight text-balance sm:text-6xl lg:text-7xl">
              The rain is coming. Which part of <em className="text-cane">your farm</em> goes under?
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/75">
              FarmShield puts this week's rain forecast on top of the shape of your land. Then it texts you what to move to high ground today, and
              why storms in Ba keep getting heavier.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <a href="#live" className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-ink transition-colors hover:bg-paper">
                See the live field <ArrowRight className="size-4" aria-hidden />
              </a>
              <a
                href="#live"
                onClick={() => chooseMode("replay")}
                className="inline-flex items-center gap-2 rounded-full border border-white/25 px-5 py-3 text-sm text-white transition-colors hover:bg-white/10"
              >
                <RotateCcw className="size-4" aria-hidden /> Replay Cyclone Cody, 2022
              </a>
            </div>
          </div>

          {/* Live card, after agriculture-3's right rail */}
          <aside className="self-end lg:col-span-4 lg:col-start-9">
            <div className="rounded-3xl border border-white/15 bg-white/[0.07] p-5 backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/60">This week · demo block</p>
                <span className="flex items-center gap-1.5 font-mono text-[11px] text-white/60">
                  <span className="size-1.5 animate-pulse rounded-full bg-cane" /> live
                </span>
              </div>
              <div className="mt-4 grid grid-cols-4 gap-2">
                {(live?.daily.time.slice(0, 4) ?? [0, 1, 2, 3].map(String)).map((t, i) => {
                  const { Icon, label } = wx(live?.daily.code[i] ?? 0)
                  return (
                    <div key={t} className={cn("rounded-2xl px-2 py-3 text-center", i === 0 ? "bg-white/15" : "bg-white/[0.04]")}>
                      <p className="text-[11px] text-white/60">{!live ? "…" : i === 0 ? "Today" : weekday(t)}</p>
                      <Icon className="mx-auto my-2 size-5 text-white/90" aria-label={label} />
                      <p className="font-mono text-xs">{live ? `${live.daily.rain[i].toFixed(0)} mm` : "–"}</p>
                    </div>
                  )
                })}
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4">
                <div>
                  <p className="text-xs text-white/60">Wettest 72 h this week</p>
                  <p className="text-2xl font-semibold">{liveRun ? `${liveRun.peak.total.toFixed(0)} mm` : "–"}</p>
                </div>
                {liveRun && <StatusPill level={liveRun.a.level} />}
              </div>
              {liveRun?.a.level === "clear" ? (
                <a
                  href="#live"
                  onClick={() => chooseMode("replay")}
                  className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-white/[0.05] px-3 py-2.5 text-[13px] leading-snug text-white/80 transition-colors hover:bg-white/10"
                >
                  <span>No flooding this week. See the week Cyclone Cody hit Ba.</span>
                  <ArrowRight className="size-4 shrink-0 text-cane" aria-hidden />
                </a>
              ) : (
                <ul className="mt-4 space-y-2">
                  {(liveRun ? PLAYBOOK[liveRun.a.level] : []).slice(0, 2).map((t) => (
                    <li key={t} className="flex gap-2.5 rounded-xl bg-white/[0.05] px-3 py-2.5 text-[13px] leading-snug text-white/80">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-cane" aria-hidden />
                      {t}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>

        {/* Stat strip: every number here comes from data we pulled, none are vanity metrics */}
        <div className="px-6 pb-6 lg:absolute lg:inset-x-0 lg:bottom-6 lg:pb-0">
          <dl className="mx-auto grid max-w-7xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 backdrop-blur-xl md:grid-cols-4">
            {[
              [`${DECADES.now.toFixed(1)}`, `days a year of 50 mm+ rain at Ba, 2015–24. It was ${DECADES.then.toFixed(1)} in the 1990s.`],
              ["450+ mm", "fell on Ba in 72 hours during Cyclone Cody, January 2022 (ERA5)."],
              ["SMS", "Alerts reach basic phones. No app, no data plan."],
              ["2035", "COP31 Awareness & Education track: climate action education for all by 2035."],
            ].map(([v, l]) => (
              <div key={v} className="bg-ink/40 px-5 py-4">
                <dt className="sr-only">{l}</dt>
                <dd className="text-2xl font-semibold">{v}</dd>
                <dd className="mt-1 text-xs leading-snug text-white/60">{l}</dd>
              </div>
            ))}
          </dl>
        </div>
      </header>

      <main>
        {/* ───────────── The gap ───────────── */}
        <section className="mx-auto max-w-7xl px-6 py-28">
          <Eyebrow n="01">The gap</Eyebrow>
          <div className="mt-10 grid gap-12 lg:grid-cols-12">
            <p className="font-display text-3xl leading-[1.2] tracking-tight text-pretty lg:col-span-8 lg:text-[2.6rem]">
              A district flood warning tells a whole valley to be careful. It can't tell a cane grower that the <em className="text-flood">bottom third</em> of
              their block will be under water by Thursday, or that the tractor parked there should move tonight.
            </p>
          </div>
          <div className="mt-16 grid gap-6 lg:grid-cols-12">
            <figure className="overflow-hidden rounded-3xl lg:col-span-7">
              <img src="/photos/flooded-field.jpg" alt="Aerial view of farm fields partly under brown floodwater, with two trees" className="aspect-[4/3] w-full object-cover" loading="lazy" />
              <figcaption className="bg-paper-2 px-5 py-3 font-mono text-[11px] text-muted-foreground">
                Water finds the low ground first, one paddock at a time. Photo: insung yoon / Unsplash (illustrative, not Fiji).
              </figcaption>
            </figure>
            <div className="flex flex-col justify-between gap-6 lg:col-span-5">
              {[
                ["Warnings are regional", "Fiji Met warnings cover whole divisions. A farm is a few hectares with a high end and a low end."],
                ["Advice is generic", "“Take precautions” doesn't say which cane to move, where to park, or which drain to clear."],
                ["Nobody explains why", "Farmers feel the seasons changing. Almost no alert connects today's storm to the long-term trend."],
              ].map(([h, p], i) => (
                <div key={h} className="border-t border-rule pt-5">
                  <p className="font-mono text-xs text-silt">0{i + 1}</p>
                  <h3 className="mt-2 text-xl font-medium">{h}</h3>
                  <p className="mt-2 leading-relaxed text-muted-foreground">{p}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ───────────── How it works ───────────── */}
        <section id="how" className="border-y border-rule bg-paper-2">
          <div className="mx-auto grid max-w-7xl gap-12 px-6 py-28 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <Eyebrow n="02">How it works</Eyebrow>
              <h2 className="mt-8 font-display text-4xl leading-tight tracking-tight lg:text-5xl">Three steps, then it runs on SMS.</h2>
              <img src="/photos/cane-harvest.jpg" alt="Cane harvester and haul-out tractor working beside a tall sugarcane crop" className="mt-10 aspect-[4/3] w-full rounded-3xl object-cover" loading="lazy" />
              <p className="mt-2 font-mono text-[11px] text-muted-foreground">Cane harvest. Photo: Christine Walker / Unsplash.</p>
            </div>
            <ol className="space-y-px lg:col-span-6 lg:col-start-7">
              {[
                [PenLine, "Tap the corners of your field", "Four taps on a satellite map, done once by the farmer or an extension officer. After that, everything comes by text."],
                [Satellite, "We read the land against the rain", `Copernicus satellite elevation shows where water settles. The 7-day forecast says how much is coming. A fill model pours the rain onto your field and lets it find the low ground.`],
                [ArrowUpRight, "You get a text with three actions", "What to move, where to park, which drain to clear. Actions come from a fixed playbook, never made up by AI. Every message ends with one line on why this is happening."],
              ].map(([Icon, h, p], i) => {
                const I = Icon as typeof PenLine
                return (
                  <li key={h as string} className="grid grid-cols-[auto_1fr] gap-6 border-t border-rule py-8 first:border-t-0 first:pt-0">
                    <span className="font-display text-5xl leading-none text-leaf/30">{i + 1}</span>
                    <div>
                      <h3 className="flex items-center gap-2 text-xl font-medium">
                        <I className="size-5 text-leaf" aria-hidden /> {h as string}
                      </h3>
                      <p className="mt-3 max-w-md leading-relaxed text-muted-foreground">{p as string}</p>
                    </div>
                  </li>
                )
              })}
            </ol>
          </div>
        </section>

        {/* ───────────── Live dashboard ───────────── */}
        <section id="live" className="scroll-mt-4 bg-ink text-white">
          <div className="mx-auto max-w-7xl px-6 py-24">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <Eyebrow n="03" dark>
                  Live field
                </Eyebrow>
                <h2 className="mt-6 font-display text-4xl tracking-tight lg:text-5xl">
                  {isDemo ? "A 40 ha cane block on the Ba floodplain" : r ? `Your ${r.a.areaHa.toFixed(1)} ha field` : "Your field"}
                </h2>
                <p className="mt-3 max-w-xl text-white/60">Real forecast, real elevation, the same model the SMS uses. Draw your own field to try it.</p>
              </div>
              <div className="flex max-w-full flex-col items-start gap-2">
              <Tabs value={mode} onValueChange={(v) => chooseMode(v as "live" | "replay")} className="max-w-full">
                <TabsList className="h-10 max-w-full rounded-full bg-white/[0.07] p-1">
                  <TabsTrigger value="live" className="rounded-full px-4 text-white/60 data-active:bg-white data-active:text-ink">
                    This week
                  </TabsTrigger>
                  <TabsTrigger value="replay" className="rounded-full px-4 text-white/60 data-active:bg-white data-active:text-ink">
                    Replay: {REPLAY.name}
                    <span className="hidden sm:inline">, Jan 2022</span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              {liveRun?.a.level === "clear" && <p className="px-1 text-xs text-white/60">This week: no flooding expected on this field.</p>}
              </div>
            </div>

            {error && (
              <div role="alert" className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-flood/40 bg-flood/10 px-4 py-3 text-sm">
                <p>{error}</p>
                <div className="flex gap-2">
                  <button onClick={() => setAttempt((n) => n + 1)} className="rounded-full bg-white px-3.5 py-1.5 text-xs font-medium text-ink hover:bg-paper">
                    Try again
                  </button>
                  {!isDemo && (
                    <button onClick={() => setPoly(DEMO)} className="rounded-full border border-white/25 px-3.5 py-1.5 text-xs hover:bg-white/10">
                      Back to demo block
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className={cn("mt-10 grid gap-4 transition-opacity lg:grid-cols-12", !r && "opacity-60")}>
              {/* Map */}
              <div className="relative overflow-hidden rounded-3xl border border-white/10 lg:col-span-7 lg:row-span-2">
                <div className="h-[460px] lg:h-full lg:min-h-[560px]">
                  <FieldMap
                    poly={poly}
                    cells={r?.cells ?? []}
                    stepM={elev?.stepM ?? 30}
                    high={r && r.cells.length > 1 && r.a.high.depth < KNOBS.floodedDepth ? r.a.high : undefined}
                    draft={draft}
                    onMapClick={draft ? (p) => setDraft([...draft, p]) : undefined}
                  />
                </div>
                <div className="pointer-events-none absolute inset-x-3 top-3 z-[1000]">
                  <div className="pointer-events-auto flex flex-wrap gap-2">
                    {!draft ? (
                      <button onClick={startDraft} className="inline-flex items-center gap-1.5 rounded-full bg-ink/80 px-3.5 py-2 text-xs backdrop-blur hover:bg-ink">
                        <PenLine className="size-3.5" aria-hidden /> Draw your field
                      </button>
                    ) : (
                      <>
                        <span className="rounded-full bg-ink/80 px-3.5 py-2 text-xs backdrop-blur" aria-live="polite">
                          {draft.length < 3 ? `Tap each corner of your field · ${draft.length} of 3+` : `${draft.length} corners · tap more or press Done`}
                        </span>
                        {draft.length > 0 && (
                          <button onClick={() => setDraft(draft.slice(0, -1))} className="rounded-full bg-ink/80 px-3.5 py-2 text-xs backdrop-blur hover:bg-ink">
                            Undo
                          </button>
                        )}
                        <button onClick={cancelDraft} className="rounded-full bg-ink/80 px-3.5 py-2 text-xs backdrop-blur hover:bg-ink">
                          Cancel
                        </button>
                        <button onClick={finishDraft} disabled={draft.length < 3} className="rounded-full bg-cane px-3.5 py-2 text-xs font-medium text-ink disabled:opacity-40">
                          Done
                        </button>
                      </>
                    )}
                    {poly !== DEMO && !draft && (
                      <button onClick={() => setPoly(DEMO)} className="inline-flex items-center gap-1.5 rounded-full bg-ink/80 px-3.5 py-2 text-xs backdrop-blur hover:bg-ink">
                        <RotateCcw className="size-3.5" aria-hidden /> Demo block
                      </button>
                    )}
                  </div>
                  {draftError && (
                    <p role="alert" className="pointer-events-auto mt-2 max-w-sm rounded-xl bg-flood px-3.5 py-2 text-xs text-white">
                      {draftError}
                    </p>
                  )}
                </div>
                {/* Field readout, after dashboard.webp's overlay card */}
                {r && !draft && (
                  <div className="absolute inset-x-3 bottom-3 z-[1000] rounded-2xl border border-white/10 bg-ink/75 p-4 backdrop-blur-md">
                    <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                      <div>
                        <p className="text-[11px] text-white/60">Field</p>
                        <p className="font-medium">{r.a.areaHa.toFixed(1)} ha</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-white/60">Low → high</p>
                        <p className="font-medium">
                          {r.a.low.elev.toFixed(0)} → {r.a.high.elev.toFixed(0)} m
                        </p>
                      </div>
                      <div className="col-span-2 sm:col-span-1">
                        <p className="text-[11px] text-white/60">Legend</p>
                        <p className="flex items-center gap-3 text-xs">
                          <span className="flex items-center gap-1">
                            <i className="inline-block size-2.5 shrink-0 rounded-sm bg-flood" /> under water
                          </span>
                          <span className="flex items-center gap-1">
                            <i className="inline-block size-2.5 shrink-0 rounded-sm bg-rain-soft" /> puddling
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Risk */}
              <RiskCard a={r?.a} mode={mode} onReplay={() => chooseMode("replay")} />

              {/* Rain chart */}
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 lg:col-span-5">
                <div className="flex items-baseline justify-between">
                  <p className="text-sm text-white/60">Wettest 72 hours, mm per 3 h</p>
                  <p className="text-2xl font-semibold">{r ? `${r.peak.total.toFixed(0)} mm` : "–"}</p>
                </div>
                <div className="mt-4">{r && <RainBars time={r.w.hourly.time} rain={r.w.hourly.rain} start={r.peak.start} />}</div>
              </div>

              {/* 7 days, after weather-idea-2 */}
              <div className="-mx-6 flex snap-x gap-3 overflow-x-auto px-6 pb-1 sm:mx-0 sm:grid sm:grid-cols-7 sm:overflow-visible sm:px-0 lg:col-span-12">
                {r?.w.daily.time.map((t, i) => {
                  const { Icon, label } = wx(r.w.daily.code[i])
                  // Only call out a day that's actually wet, not the least-dry day of a dry week.
                  const wettest = r.w.daily.rain[i] >= 10 && r.w.daily.rain[i] === Math.max(...r.w.daily.rain)
                  return (
                    <div key={t} className={cn("min-w-[6.5rem] shrink-0 snap-start rounded-3xl p-4 transition-colors sm:min-w-0", wettest ? "bg-rain-soft text-ink" : "border border-white/10 bg-white/[0.04]")}>
                      <p className={cn("text-sm", wettest ? "font-medium" : "text-white/70")}>{weekday(t)}</p>
                      <p className={cn("font-mono text-[11px]", wettest ? "text-ink/75" : "text-white/60")}>{shortDate(t)}{wettest && " · wettest"}</p>
                      <Icon className="my-4 size-7" aria-label={label} />
                      <p className="text-xl font-semibold">{r.w.daily.rain[i].toFixed(0)} mm</p>
                      <p className={cn("text-xs", wettest ? "text-ink/75" : "text-white/60")}>
                        {r.w.daily.temp[i].toFixed(0)}°{r.w.daily.prob ? ` · ${r.w.daily.prob[i]}% rain` : ""}
                      </p>
                    </div>
                  )
                })}
              </div>

              {/* SMS */}
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 lg:col-span-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-white/60">The text the farmer gets</p>
                  <Tabs value={lang} onValueChange={(v) => setLang(v as string)}>
                    <TabsList className="h-8 rounded-full bg-white/[0.07] p-0.5">
                      {[["en", "English"], ["fj", "iTaukei"], ["hi", "Fiji Hindi"]].map(([v, l]) => (
                        <TabsTrigger key={v} value={v} className="rounded-full px-3 text-xs text-white/60 data-active:bg-white data-active:text-ink">
                          {l}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                </div>
                <div className="mx-auto mt-5 max-w-sm rounded-[2rem] border border-white/15 bg-[#0d1712] p-3">
                  <div className="rounded-[1.5rem] bg-[#16241c] p-4">
                    <p className="text-center font-mono text-[11px] text-white/60">FarmShield · +679 SMS</p>
                    {lang === "en" ? (
                      <p className="mt-3 rounded-2xl rounded-tl-sm bg-white/10 p-3.5 text-[13px] leading-relaxed whitespace-pre-line text-white/90">
                        {r ? smsText(r, mode === "replay", isDemo) : "…"}
                      </p>
                    ) : (
                      <p className="mt-3 rounded-2xl border border-dashed border-white/20 p-3.5 text-[13px] leading-relaxed text-white/60">
                        Translations come from native speakers, not machine translation. We're recruiting reviewers for {lang === "fj" ? "iTaukei" : "Fiji Hindi"}.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Show the work */}
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 lg:col-span-7">
                <p className="text-sm text-white/60">How the model got there</p>
                <dl className="mt-5 grid grid-cols-2 gap-x-8 gap-y-4 font-mono text-sm sm:grid-cols-3">
                  {[
                    ["Elevation cells", elev ? `${elev.points.length} × ${elev.stepM.toFixed(0)} m` : "–"],
                    ["Rain used", r ? `${r.peak.total.toFixed(0)} mm / 72 h` : "–"],
                    ["Soaks in or drains", `${KNOBS.absorbedMm} mm`],
                    ["Pooling factor", `× ${KNOBS.pooling}`],
                    ["Counts as flooded", `≥ ${KNOBS.floodedDepth} m deep`],
                    ["Cane value", `${fjd(KNOBS.caneValuePerHa)}/ha`],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-[11px] tracking-wide text-white/60 uppercase">{k}</dt>
                      <dd className="mt-1 tabular-nums">{v}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-6 border-t border-white/10 pt-4 text-sm leading-relaxed text-white/60">
                  Rain that doesn't soak in or drain away settles into the lowest cells first, like filling a bathtub with a lumpy floor. It's a simple
                  model on purpose. We tune these numbers against what the satellites saw during real floods (section 05), and every knob is listed here.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ───────────── Why now ───────────── */}
        <section id="why" className="mx-auto max-w-7xl px-6 py-28">
          <div className="grid gap-12 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <Eyebrow n="04">Why the alert explains itself</Eyebrow>
              <h2 className="mt-8 font-display text-4xl leading-tight tracking-tight lg:text-5xl">
                Ba's heavy-rain days have gone from <span className="text-rain">{DECADES.then.toFixed(1)}</span> to{" "}
                <span className="text-rain">{DECADES.now.toFixed(1)}</span> a year.
              </h2>
              <p className="mt-6 leading-relaxed text-muted-foreground">
                Every FarmShield text ends with one line on why. Over a wet season that adds up to a short climate course, sent to a phone the farmer
                already owns and tied to rain they can see out the window. That is the COP31 education goal, delivered one alert at a time.
              </p>
            </div>
            <div className="rounded-3xl border border-rule bg-card p-6 lg:col-span-7">
              <p className="text-sm text-muted-foreground">Days per year with 50 mm or more of rain, Ba, 1991–2024</p>
              <div className="mt-4">
                <HeavyRainChart />
              </div>
              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                Blue bars are the two decades we compare. The years between are grey for context, not left out. Source: ERA5 reanalysis via
                Open-Meteo, one ~25 km grid cell over Ba. Year-to-year swings are large and reanalysis rainfall carries
                uncertainty. We use this as context for farmers, not as proof of a trend.
              </p>
            </div>
          </div>
        </section>

        {/* ───────────── Validation ───────────── */}
        <section id="proof" className="border-t border-rule bg-paper-2">
          <div className="mx-auto max-w-7xl px-6 py-28">
            <Eyebrow n="05">How we'll validate</Eyebrow>
            <div className="mt-8 grid gap-10 lg:grid-cols-12">
              <h2 className="font-display text-4xl leading-tight tracking-tight lg:col-span-6 lg:text-5xl">Next: check the model against what satellites saw.</h2>
              <p className="leading-relaxed text-muted-foreground lg:col-span-5 lg:col-start-8">
                We replay the forecast from the days before Cyclone Cody, then lay FarmShield's predicted flood cells over Sentinel-1 radar images
                (the EU's Copernicus satellites see through cloud). The question: would it have warned the right paddocks, early enough to act?
              </p>
            </div>
            <div className="mt-12 grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-rule bg-card p-6">
                <p className="font-mono text-xs tracking-wider text-muted-foreground uppercase">Predicted · FarmShield replay</p>
                <p className="mt-4 text-5xl font-semibold">{replayRun ? `${replayRun.a.floodedHa.toFixed(1)} ha` : "–"}</p>
                <p className="mt-2 text-muted-foreground">
                  of the {replayRun?.a.areaHa.toFixed(1) ?? "–"} ha demo block flagged as under water from {replayRun ? `${replayRun.peak.total.toFixed(0)} mm` : "–"} of rain.
                </p>
                <button onClick={() => { chooseMode("replay"); document.getElementById("live")?.scrollIntoView({ behavior: "smooth" }) }} className={cn(buttonVariants({ variant: "outline" }), "mt-6 rounded-full")}>
                  See it on the map <ArrowRight aria-hidden />
                </button>
              </div>
              <div className="flex flex-col justify-between rounded-3xl border border-dashed border-silt/50 p-6">
                <div>
                  <p className="font-mono text-xs tracking-wider text-muted-foreground uppercase">Observed · Sentinel-1, Jan 2022</p>
                  <p className="mt-4 text-xl font-medium">Coming next</p>
                  <p className="mt-2 text-muted-foreground">We're processing the radar flood extent for the Ba floodplain. When it's ready, this panel shows how many flagged cells really flooded.</p>
                </div>
                <p className="mt-6 font-mono text-xs text-silt">Target: flag the paddocks that flooded at least 2 days before the peak.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ───────────── COP31 ───────────── */}
        <section className="bg-leaf text-white">
          <div className="mx-auto grid max-w-7xl gap-10 px-6 py-20 md:grid-cols-3">
            {[
              ["COP31 track", "Climate Awareness & Education, through climate-resilient farming."],
              ["2035 target", "Climate action education for all. Each alert teaches the why behind the weather."],
              ["Path to scale", "SMS-first, one playbook per crop and hazard, native-speaker translations. Built to run through Pacific extension services and partners like the EU–Pacific Green Blue Alliance."],
            ].map(([h, p]) => (
              <div key={h} className="border-t border-white/25 pt-5">
                <p className="font-mono text-xs tracking-[0.16em] text-[#f0d27a] uppercase">{h}</p>
                <p className="mt-3 text-lg leading-snug text-white/90">{p}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="bg-ink text-white/60">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-16 text-sm md:grid-cols-12">
          <div className="md:col-span-4">
            <Logo light />
            <p className="mt-4 max-w-xs leading-relaxed">Built from scratch at Climate Hack-tion 2026, 2–4 October. Team Pixelers: Peter Ma, Siddhant Malik and Adin Sreekesh.</p>
          </div>
          <div className="md:col-span-4">
            <p className="font-mono text-xs tracking-wider text-white/60 uppercase">Data</p>
            <ul className="mt-3 space-y-1.5">
              <li>Forecast, ERA5 archive, elevation: Open-Meteo (CC BY 4.0)</li>
              <li>Elevation model: Copernicus GLO-90 DEM</li>
              <li>Satellite imagery: Esri World Imagery</li>
            </ul>
          </div>
          <div className="md:col-span-4">
            <p className="font-mono text-xs tracking-wider text-white/60 uppercase">Photos (Unsplash)</p>
            <ul className="mt-3 space-y-1.5">
              <li>Storm over field: Troy Olson</li>
              <li>Flooded farmland: insung yoon</li>
              <li>Cane harvest: Christine Walker</li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  )
}

function RiskCard({ a, mode, onReplay }: { a?: Assessment; mode: "live" | "replay"; onReplay: () => void }) {
  return (
    <div className="flex flex-col justify-between rounded-3xl bg-paper p-6 text-ink lg:col-span-5">
      <div className="flex items-start justify-between">
        <p className="text-sm text-muted-foreground">Likely under water</p>
        {a && <StatusPill level={a.level} />}
      </div>
      <div className="mt-6">
        {a?.level === "clear" ? (
          <>
            <p className="font-display text-5xl tracking-tight">Nothing goes under.</p>
            <p className="mt-2 text-muted-foreground">{`All ${a.areaHa.toFixed(1)} ha should drain this week.`}</p>
          </>
        ) : (
          <>
            <p className="text-6xl font-semibold tracking-tight">{a ? `${a.floodedHa.toFixed(1)} ha` : "–"}</p>
            <p className="mt-2 text-muted-foreground">{a ? `of ${a.areaHa.toFixed(1)} ha · deepest ~${a.maxDepth.toFixed(1)} m` : "Loading field…"}</p>
          </>
        )}
      </div>
      <div className="mt-6 flex items-end justify-between border-t border-rule pt-4">
        <div>
          <p className="text-xs text-muted-foreground">Cane at risk</p>
          <p className="text-2xl font-semibold">{a ? (a.valueAtRisk > 0 ? fjd(a.valueAtRisk) : "None") : "–"}</p>
        </div>
        {a?.level === "clear" && mode === "live" ? (
          <button onClick={onReplay} className="inline-flex items-center gap-1 text-sm font-medium text-leaf hover:underline">
            See a cyclone week <ArrowRight className="size-4" aria-hidden />
          </button>
        ) : (
          <p className="max-w-[12rem] text-right text-[11px] text-muted-foreground">Assumes 45 t/ha at F$85/t</p>
        )}
      </div>
    </div>
  )
}
