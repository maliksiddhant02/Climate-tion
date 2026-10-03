import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, ArrowRight, ArrowUpRight, Check, Eye, Pause, PenLine, Play, RotateCcw } from "lucide-react"
import { FieldMap } from "@/components/FieldMap"
import { RainBars, RiverChart, wx } from "@/components/weather"
import { Phone, type Msg } from "@/components/Phone"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getEventReplay, getElevations, getFlowForecast, getWeather, REPLAY, weatherUrl, type Flow, type Weather } from "@/lib/api"
import { assess, floodDepths, gridInPolygon, KNOBS, levelFor, maxRolling, PLAYBOOK, riverDepths, riverStage, type Assessment, type Cell, type LatLng, type Level, type River } from "@/lib/flood"
import { BASE, covers, loadRegion, sample, type Meta } from "@/lib/region"
import { cn } from "@/lib/utils"
import { loadProfile } from "@/lib/farm"

// Demo block: ~40 ha of farmland near Broadwater mill on the lower Richmond, picked by scripts/build_region.py (meta.json demo).
export const DEMO: LatLng[] = [[-29.00167, 153.39944], [-29.00167, 153.40556], [-29.00778, 153.40556], [-29.00778, 153.39944]]

// Fewer elevation cells than this and the field is too small to say anything useful.
const MIN_CELLS = 4

export const aud = (v: number) => `A$${(Math.round(v / 100) * 100).toLocaleString("en-AU")}`
const dateLabel = (iso: string) => new Date(iso).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })
const hourLabel = (iso: string) => new Date(iso).toLocaleString("en-AU", { weekday: "short", day: "numeric", month: "short", hour: "numeric" })
const weekday = (iso: string) => new Date(iso).toLocaleDateString("en-AU", { weekday: "short" })

type Elev = { points: LatLng[]; stepM: number; e: number[]; hand?: number[]; land?: number[] }

// Past 2 m the elevation data (which includes crop and roof heights) can't honestly say more than "deep".
export const depthLabel = (d: number) => (d >= 2 ? "more than 2 m" : `~${d.toFixed(1)} m`)


const peakQ = (q: (number | null)[]) => Math.max(0, ...q.map((v) => v ?? 0))

/** River flow at hour h of a daily record: each day's value sits at midday, linear in between. */
function qAt(flow: Flow, h: number) {
  const d = h / 24 - 0.5
  const i = Math.max(0, Math.min(flow.q.length - 1, Math.floor(d)))
  const j = Math.min(flow.q.length - 1, i + 1)
  const a = flow.q[i] ?? 0
  return d <= 0 ? a : a + ((flow.q[j] ?? 0) - a) * Math.min(1, d - i)
}

/**
 * Rain pooling everywhere; plus the river rising over the field when we have its height above the river.
 * With `hour`, the field as it stood at that hour of the replay (rain of the previous 72 h, river flow then).
 */
function run(w: Weather | undefined, elev: Elev | undefined, flow?: Flow, cal?: River, hour?: number) {
  if (!w || !elev) return undefined
  const atHour = hour !== undefined
  const from = atHour ? Math.max(0, hour - 71) : 0
  const peak = atHour ? { total: w.hourly.rain.slice(from, hour + 1).reduce((s, v) => s + (v || 0), 0), start: from } : maxRolling(w.hourly.rain)
  const rain = floodDepths(elev.e, elev.stepM ** 2, peak.total)
  let depths = rain
  let river: { q: number; day: string; stage: number; cal: River; flow: Flow; odds?: { flood: number; act: number; n: number } } | undefined
  if (flow && cal && elev.hand) {
    const hand = elev.hand
    const withRiver = (q: number) => riverDepths(hand, riverStage(q, cal)).map((d, i) => Math.max(d, rain[i]))
    const q = atHour ? qAt(flow, hour) : peakQ(flow.q)
    depths = withRiver(q)
    river = { q, day: atHour ? w.hourly.time[hour] : (flow.time[flow.q.indexOf(q)] ?? flow.time[0]), stage: riverStage(q, cal), cal, flow }
    // Forecast confidence: run the field once per GloFAS ensemble member.
    if (!atHour && flow.members?.length) {
      const levels = flow.members.map((m) => levelFor(withRiver(peakQ(m))))
      river.odds = { flood: levels.filter((l) => l !== "clear").length, act: levels.filter((l) => l === "act").length, n: levels.length }
    }
  }
  const cells: Cell[] = elev.points.map(([lat, lng], i) => ({ lat, lng, elev: elev.e[i], depth: depths[i], hand: elev.hand?.[i], land: elev.land?.[i] }))
  return { peak, cells, a: assess(cells, elev.stepM), w, river }
}

type Run = NonNullable<ReturnType<typeof run>>

/** All data for the field. Lives in App so switching pages never refetches. */
export function useFarm() {
  // Start on the farm the grower marked in My farm, if they have one.
  const [poly, setPoly] = useState<LatLng[]>(() => {
    const b = loadProfile()?.boundary
    return b && b.length >= 3 ? b : DEMO
  })
  const [live, setLive] = useState<Weather>()
  const [replay, setReplay] = useState<Weather>()
  const [liveFlow, setLiveFlow] = useState<Flow>()
  const [replayFlow, setReplayFlow] = useState<Flow>()
  const [elev, setElev] = useState<Elev>()
  const [meta, setMeta] = useState<Meta>()
  const [error, setError] = useState<string>()
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let stale = false
    const center: LatLng = [poly.reduce((s, p) => s + p[0], 0) / poly.length, poly.reduce((s, p) => s + p[1], 0) / poly.length]
    const fail = (e: unknown) => {
      if (!stale) setError(e instanceof TypeError ? "We couldn't reach the weather service. Check your connection and try again." : (e as Error).message)
    }
    // Drop the old field's numbers so nothing stale shows while (or if) the new one loads.
    setError(undefined)
    setLive(undefined)
    setReplay(undefined)
    setLiveFlow(undefined)
    setReplayFlow(undefined)
    setElev(undefined)
    getWeather(center, false).then((w) => !stale && setLive(w)).catch(fail)
    loadRegion()
      .catch(() => undefined) // no region data: rain-only everywhere
      .then((region) => {
        if (stale) return
        setMeta(region?.meta)
        if (region && covers(region, poly)) {
          // Inside the data area: 30 m grid from the shipped data, river model on, 2022 flood replay from static files.
          const { points, stepM } = gridInPolygon(poly, 30, 2500)
          const s = points.map((p) => sample(region, p))
          setElev({ points, stepM, e: s.map((x) => x.elev), hand: s.map((x) => x.hand), land: s.map((x) => x.land) })
          getEventReplay(region.meta.glofas)
            .then(({ weather, flow }) => !stale && (setReplay(weather), setReplayFlow(flow)))
            .catch(fail)
          getFlowForecast(region.meta.glofas).then((f) => !stale && setLiveFlow(f)).catch(fail)
        } else {
          getWeather(center, true).then((w) => !stale && setReplay(w)).catch(fail)
          const { points, stepM } = gridInPolygon(poly)
          getElevations(points).then((e) => !stale && setElev({ points, stepM, e })).catch(fail)
        }
      })
    return () => {
      stale = true
    }
  }, [poly, attempt])

  const cal = elev?.hand ? meta?.river : undefined
  const liveRun = useMemo(() => run(live, elev, liveFlow, cal), [live, elev, liveFlow, cal])
  const replayRun = useMemo(() => run(replay, elev, replayFlow, cal), [replay, elev, replayFlow, cal])
  return { poly, setPoly, elev, meta, error, liveRun, replayRun, retry: () => setAttempt((n) => n + 1), isDemo: poly === DEMO }
}

export type Farm = ReturnType<typeof useFarm>

const STATUS: Record<Level, { label: string; Icon: typeof Check; cls: string }> = {
  act: { label: "Act today", Icon: AlertTriangle, cls: "bg-flood text-white" },
  watch: { label: "Watch", Icon: Eye, cls: "bg-cane text-ink" },
  clear: { label: "All clear", Icon: Check, cls: "bg-leaf text-white" },
}

function StatusPill({ level }: { level: Level }) {
  const { label, Icon, cls } = STATUS[level]
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium", cls)}>
      <Icon className="size-4" aria-hidden />
      {label}
    </span>
  )
}

export function smsText({ a, peak, w, river }: Run, replay: boolean, demo: boolean) {
  const from = river && river.stage > 0 ? river.day : w.hourly.time[peak.start]
  const odds = !replay && river?.odds ? ` (${Math.round((100 * river.odds.flood) / river.odds.n)}% chance)` : ""
  const head = {
    act: `FLOOD RISK HIGH from ${dateLabel(from)}${odds}`,
    watch: `Flood watch from ${dateLabel(from)}${odds}`,
    clear: "No flooding expected this week",
  }[a.level]
  const riverLine = river && river.stage > 0 ? `The Richmond River is rising, about ${Math.round(river.stage)} m above normal. ` : ""
  const body =
    a.level === "clear"
      ? `Up to ${peak.total.toFixed(0)} mm of rain in 3 days. Your field should drain fine.`
      : `${riverLine}${peak.total.toFixed(0)} mm of rain in 3 days. Your low ground could sit under ${depthLabel(a.maxDepth)} of water. About ${a.floodedHa.toFixed(0)} hectares of cane, ${aud(a.valueAtRisk)}.`
  const msgs: Msg[] = [
    { text: `${head}\n${body}` },
    { text: `What to do:\n${PLAYBOOK[a.level].map((t, i) => `${i + 1}. ${t}`).join("\n")}` },
    { text: "Why: very heavy rain days (50 mm or more) have nearly tripled here since the 1990s. A warmer climate puts more water in the air." },
  ]
  // An example reply, so it reads as a conversation the grower can answer (Draki doesn't read replies yet).
  if (a.level !== "clear") msgs.push({ me: true, text: "Thanks. Moving the gear up to the shed now." })
  return { msgs, stamp: `${demo ? "Demo block" : "Your field"} · ${dateLabel(from)}${replay ? " (replay)" : ""}` }
}

const card = "rounded-3xl border border-rule bg-card p-6"

export function LivePage({ farm, mode, setMode }: { farm: Farm; mode: "live" | "replay"; setMode: (m: "live" | "replay") => void }) {
  const { poly, setPoly, elev, error, liveRun, replayRun, retry, isDemo } = farm
  const [draft, setDraft] = useState<LatLng[]>()
  const [draftError, setDraftError] = useState<string>()
  // Show what Sentinel-1 actually saw under water on 2 March 2022, under the model's squares.
  const [satellite, setSatellite] = useState(false)
  // ---- The 2022 flood film: replay the week hour by hour ----
  const [hour, setHour] = useState<number>()
  const [playing, setPlaying] = useState(false)
  const film = mode === "replay" && replayRun?.river && elev?.hand ? replayRun : undefined
  const hours = film?.w.hourly.time.length ?? 0
  const frameAt = (h: number) => (film?.river ? run(film.w, elev, film.river.flow, film.river.cal, h) : undefined)
  // When would Draki have sent its first "Act today", and when did the river peak?
  const moments = useMemo(() => {
    if (!film?.river) return undefined
    let alert: number | undefined
    let peakHour = 0
    for (let h = 0; h < hours; h++) {
      if (alert === undefined && run(film.w, elev, film.river.flow, film.river.cal, h)?.a.level === "act") alert = h
      if (qAt(film.river.flow, h) > qAt(film.river.flow, peakHour)) peakHour = h
    }
    return { alert, peakHour }
  }, [film, elev, hours])
  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setHour((h) => Math.min(hours - 1, (h ?? -1) + 1)), 70)
    return () => clearInterval(id)
  }, [playing, hours])
  useEffect(() => {
    if (playing && hour === hours - 1) setPlaying(false)
  }, [playing, hour, hours])
  useEffect(() => {
    if (mode !== "replay") {
      setPlaying(false)
      setHour(undefined)
    }
  }, [mode])
  const frame = useMemo(() => (film && hour !== undefined ? frameAt(hour) : undefined), [film, hour]) // frameAt only reads film + elev
  const r = frame ?? (mode === "live" ? liveRun : replayRun)
  const togglePlay = () => {
    if (!playing && (hour === undefined || hour >= hours - 1)) setHour(0)
    setPlaying(!playing)
  }

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
      setDraftError("Too small to read. Mark a block at least 100 m across.")
      return
    }
    setDraftError(undefined)
    setPoly(draft)
    setDraft(undefined)
  }
  const pill = "press rounded-full bg-ink/80 text-white px-4 py-2 text-sm backdrop-blur hover:bg-ink"

  return (
    <section>
      <div className="mx-auto w-full max-w-[1600px] px-6 py-16 md:px-10">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <h1 className="font-display text-5xl uppercase md:text-6xl">Live field</h1>
            <p className="mt-3 text-muted-foreground">{isDemo ? "A 40-hectare cane block near Broadwater, lower Richmond River, NSW. (1 hectare = 100 m × 100 m.)" : r ? `Your ${r.a.areaHa.toFixed(1)}-hectare field. (1 hectare = 100 m × 100 m.)` : "Your field."}</p>
          </div>
          <Tabs value={mode} onValueChange={(v) => setMode(v as "live" | "replay")}>
            <TabsList className="h-11 rounded-full bg-paper-2 p-1">
              <TabsTrigger value="live" className="press rounded-full px-4 text-muted-foreground data-active:bg-ink data-active:text-paper">
                This week
              </TabsTrigger>
              <TabsTrigger value="replay" className="press rounded-full px-4 text-muted-foreground data-active:bg-ink data-active:text-paper">
                {REPLAY.name}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {error && (
          <div role="alert" className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-flood/40 bg-flood/10 text-ink px-4 py-3 text-sm">
            <p>{error}</p>
            <div className="flex gap-2">
              <button onClick={retry} className="press rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-ink-2">
                Try again
              </button>
              {!isDemo && (
                <button onClick={() => setPoly(DEMO)} className="press rounded-full border border-rule px-4 py-2 text-sm hover:bg-paper-2">
                  Back to demo
                </button>
              )}
            </div>
          </div>
        )}

        {film && moments && (
          <div className="mt-8 rounded-3xl border border-rule bg-card p-4 md:p-5">
            <div className="flex flex-wrap items-center gap-4">
              <button onClick={togglePlay} className="press inline-flex items-center gap-2 rounded-full bg-cane px-5 py-3 text-sm font-medium text-ink hover:bg-[#e2b84a]">
                {playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
                {playing ? "Pause" : hour === undefined || hour >= hours - 1 ? "Play the flood" : "Resume"}
              </button>
              <div className="relative min-w-[12rem] flex-1">
                <input
                  type="range"
                  min={0}
                  max={hours - 1}
                  value={hour ?? hours - 1}
                  onChange={(e) => {
                    setPlaying(false)
                    setHour(+e.target.value)
                  }}
                  aria-label="Replay time"
                  className="w-full accent-cane"
                />
                {moments.alert !== undefined && (
                  <span
                    className="pointer-events-none absolute -top-2 h-3 w-0.5 bg-flood"
                    style={{ left: `${(moments.alert / (hours - 1)) * 100}%` }}
                    title="Draki's first Act today alert"
                  />
                )}
              </div>
              <p className="w-full text-sm tabular-nums text-ink sm:w-auto sm:min-w-[15rem] sm:text-right">
                {hour !== undefined && r?.river
                  ? `${hourLabel(film.w.hourly.time[hour])} · river ${r.river.stage > 0 ? `${r.river.stage.toFixed(1)} m above normal` : "in its banks"}`
                  : "Showing the peak of the flood"}
              </p>
            </div>
            {moments.alert !== undefined && (
              <p className="mt-3 text-sm text-muted-foreground">
                <span className="font-medium text-ink">Draki's alert: {hourLabel(film.w.hourly.time[moments.alert])}</span>
                {moments.peakHour > moments.alert && `, about ${moments.peakHour - moments.alert} hours before the river peaked`}. Replayed with the recorded rain and
                river flow, not the forecast made at the time.
              </p>
            )}
          </div>
        )}

        <div className={cn("mt-10 grid gap-4 transition-opacity lg:grid-cols-12", !r && "opacity-60")}>
          <div className="relative overflow-hidden rounded-3xl border border-rule lg:col-span-7 lg:row-span-2">
            <div className="h-[460px] lg:h-full lg:min-h-[540px]">
              <FieldMap
                poly={poly}
                cells={r?.cells ?? []}
                stepM={elev?.stepM ?? 30}
                high={r && r.cells.length > 1 && r.a.high.depth < KNOBS.floodedDepth ? r.a.high : undefined}
                draft={draft}
                runKey={mode}
                overlay={
                  satellite && mode === "replay" && farm.meta
                    ? { url: `${BASE}/water.png`, bounds: [[farm.meta.bbox[1], farm.meta.bbox[0]], [farm.meta.bbox[3], farm.meta.bbox[2]]] }
                    : undefined
                }
                onMapClick={draft ? (p) => setDraft([...draft, p]) : undefined}
                legend={
                  r &&
                  !draft && (
                    <>
                      <span className="flex items-center gap-2">
                        <i className="size-3 rounded-sm bg-flood" /> Under water
                      </span>
                      <span className="flex items-center gap-2">
                        <i className="size-3 rounded-sm bg-rain-soft" /> {satellite ? "Satellite: under water, 2 Mar 2022" : "Shallow water"}
                      </span>
                    </>
                  )
                }
              />
            </div>
            <div className="absolute inset-x-3 top-3 z-[1000] flex flex-wrap gap-2 pr-12">
              {!draft ? (
                <button onClick={startDraft} className={cn(pill, "inline-flex items-center gap-2")}>
                  <PenLine className="size-4" aria-hidden /> Draw your field
                </button>
              ) : (
                <>
                  <span className={pill} aria-live="polite">
                    {draft.length < 3 ? `Tap corners · ${draft.length} of 3+` : `${draft.length} corners`}
                  </span>
                  {draft.length > 0 && (
                    <button onClick={() => setDraft(draft.slice(0, -1))} className={pill}>
                      Undo
                    </button>
                  )}
                  <button onClick={cancelDraft} className={pill}>
                    Cancel
                  </button>
                  <button onClick={finishDraft} disabled={draft.length < 3} className="press rounded-full bg-cane px-4 py-2 text-sm font-medium text-ink disabled:opacity-40">
                    Done
                  </button>
                </>
              )}
              {mode === "replay" && farm.meta && !draft && (
                <button onClick={() => setSatellite(!satellite)} aria-pressed={satellite} className={cn(pill, satellite && "bg-rain-soft text-ink hover:bg-rain-soft")}>
                  {satellite ? "Hide" : "Show"} what the satellite saw
                </button>
              )}
              {poly !== DEMO && !draft && (
                <button onClick={() => setPoly(DEMO)} className={cn(pill, "inline-flex items-center gap-2")}>
                  <RotateCcw className="size-4" aria-hidden /> Reset
                </button>
              )}
              {draftError && (
                <p role="alert" className="w-full max-w-sm rounded-xl bg-flood px-4 py-2 text-sm text-white">
                  {draftError}
                </p>
              )}
            </div>
          </div>

          <RiskCard key={mode} r={r} now={hour !== undefined} live={mode === "live"} onReplay={mode === "live" ? () => setMode("replay") : undefined} />

          <div className={cn(card, "lg:col-span-5")}>
            <div className="flex items-baseline justify-between">
              <p className="text-sm text-muted-foreground">Wettest 3 days</p>
              <p className="text-2xl font-semibold">{r ? `${r.peak.total.toFixed(0)} mm` : "–"}</p>
            </div>
            <div className="mt-4">{r && <RainBars time={r.w.hourly.time} rain={r.w.hourly.rain} start={r.peak.start} />}</div>
          </div>

          <div className="-mx-6 flex snap-x gap-3 overflow-x-auto px-6 pb-1 sm:mx-0 sm:grid sm:auto-cols-fr sm:grid-flow-col sm:overflow-visible sm:px-0 lg:col-span-12">
            {r?.w.daily.time.map((t, i) => {
              const { Icon, label } = wx(r.w.daily.code[i])
              // Only call out a day that's actually wet, not the least-dry day of a dry week.
              const wettest = r.w.daily.rain[i] >= 10 && r.w.daily.rain[i] === Math.max(...r.w.daily.rain)
              return (
                <div key={t} className={cn("min-w-[6.5rem] shrink-0 snap-start rounded-3xl p-4 sm:min-w-0", wettest ? "bg-rain-soft text-ink" : "border border-rule bg-card")}>
                  <p className={cn("text-sm", !wettest && "text-muted-foreground")}>{weekday(t)}{wettest && " · wettest"}</p>
                  <Icon className="my-4 size-7" aria-label={label} />
                  <p className="text-2xl font-semibold">{r.w.daily.rain[i].toFixed(0)}<span className="text-sm font-normal"> mm</span></p>
                </div>
              )
            })}
          </div>

          <div className={cn(card, "lg:col-span-5")}>
            <p className="text-sm text-muted-foreground">The text the grower gets</p>
            <Phone
              className="mt-5"
              {...(r && !(frame && frame.a.level === "clear") ? smsText(r, mode === "replay", isDemo) : { msgs: [] })}
              empty={frame ? "No alert yet. Draki is watching the river." : "…"}
            />
          </div>

          <div className={cn(card, "flex flex-col lg:col-span-7")}>
            <p className="text-sm text-muted-foreground">What to do</p>
            <ol className="mt-4 space-y-3">
              {(r ? PLAYBOOK[r.a.level] : []).map((t, i) => (
                <li key={t} className="flex items-baseline gap-4 border-t border-rule pt-3">
                  <span className="font-display text-2xl text-leaf">{i + 1}</span>
                  {t}
                </li>
              ))}
            </ol>
            <a href="#/proof" className="mt-auto inline-flex items-center gap-2 pt-6 text-sm text-muted-foreground hover:text-ink">
              How we check this <ArrowRight className="size-4" aria-hidden />
            </a>
          </div>

          {r?.river && (
            <div className={cn(card, "lg:col-span-7")}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  Richmond River flow, {mode === "live" ? "next 7 days" : "24 February – 4 March 2022"}
                  {mode === "live" && r.river.flow.members?.length ? ` · ${r.river.flow.members.length} forecasts` : ""}
                </p>
                <p className="text-sm text-muted-foreground">European flood forecasts (GloFAS)</p>
              </div>
              <div className="mt-4">
                <RiverChart
                  time={r.river.flow.time}
                  q={r.river.flow.q}
                  members={mode === "live" ? r.river.flow.members : undefined}
                  q2={r.river.cal.q2}
                  q5={r.river.cal.q5}
                  cursor={hour !== undefined ? hour / 24 : undefined}
                />
              </div>
            </div>
          )}

          <Sources r={r} mode={mode} poly={poly} hasRegion={!!elev?.hand} />
        </div>
      </div>
    </section>
  )
}

function RiskCard({ r, live, now, onReplay }: { r?: Run; live: boolean; now?: boolean; onReplay?: () => void }) {
  const a: Assessment | undefined = r?.a
  const river = r?.river
  return (
    <div className="swap flex flex-col justify-between rounded-3xl border border-rule bg-card p-6 text-ink lg:col-span-5">
      <div className="flex items-start justify-between">
        <p className="text-sm text-muted-foreground">Likely under water</p>
        {a && <StatusPill level={a.level} />}
      </div>
      <p className={cn("mt-6 text-5xl tracking-tight", a?.level === "clear" ? "font-display" : "font-semibold")}>
        {!a ? "–" : a.level === "clear" ? "Nothing goes under." : (
          <>
            {a.floodedHa.toFixed(1)}
            <span className="ml-2 text-2xl font-normal">hectares</span>
          </>
        )}
      </p>
      {river && (
        <p className="mt-3 text-sm text-muted-foreground">
          {river.stage > 0
            ? `The Richmond River ${now ? "is" : "peaks"} about ${river.stage.toFixed(1)} m above normal.`
            : `The Richmond River ${now ? "is in its banks" : "stays in its banks"}.`}
          {live && river.odds && ` ${river.odds.flood} of ${river.odds.n} forecasts flood this field.`}
        </p>
      )}
      <div className="mt-6 flex items-end justify-between border-t border-rule pt-4">
        <div>
          <p className="text-sm text-muted-foreground">Cane at risk</p>
          <p className="text-2xl font-semibold">{a ? (a.valueAtRisk > 0 ? aud(a.valueAtRisk) : "None") : "–"}</p>
        </div>
        {a?.level === "clear" && onReplay && (
          <button onClick={onReplay} className="inline-flex items-center gap-1 text-sm font-medium text-leaf hover:underline">
            See the 2022 flood <ArrowRight className="size-4" aria-hidden />
          </button>
        )}
      </div>
    </div>
  )
}

export const ago = (t?: number) => {
  if (!t) return "just now"
  const min = Math.round((Date.now() - t) / 60_000)
  return min < 1 ? "just now" : min < 60 ? `${min} min ago` : `${Math.round(min / 60)} h ago`
}

/** Every number on this page, where it came from, and a link to the raw data so anyone can check. */
function Sources({ r, mode, poly, hasRegion }: { r?: Run; mode: "live" | "replay"; poly: LatLng[]; hasRegion: boolean }) {
  const center: LatLng = [poly.reduce((s, p) => s + p[0], 0) / poly.length, poly.reduce((s, p) => s + p[1], 0) / poly.length]
  const live = mode === "live"
  const rows: [string, string, string | undefined][] = [
    [
      "River flow",
      r?.river ? (live ? `European flood forecast (GloFAS), next 7 days, ${r.river.flow.members?.length ?? 0} versions · fetched ${ago(r.river.flow.fetchedAt)}` : "European flood record (GloFAS), daily, February–March 2022") : "Only inside the lower Richmond area",
      r?.river?.flow.url,
    ],
    ["Rain", live ? "Weather forecast (Open-Meteo), hourly, next 7 days" : "European weather record (ERA5), hourly, 24 February – 4 March 2022", weatherUrl(center, !live)],
    [
      "Land height",
      hasRegion ? `Satellite height map (Copernicus), ${r?.cells.length ?? "–"} squares of 30 m` : "Satellite height map (Copernicus), 90 m squares",
      hasRegion ? "https://planetarycomputer.microsoft.com/dataset/cop-dem-glo-30" : undefined,
    ],
    ["Land cover", hasRegion ? "Satellite land-cover map (ESA WorldCover)" : "Not used outside the lower Richmond area", hasRegion ? "https://planetarycomputer.microsoft.com/dataset/esa-worldcover" : undefined],
    ["How it's built", "Every step, in one Python script", "https://github.com/maliksiddhant02/Climate-tion/blob/main/scripts/build_region.py"],
  ]
  return (
    <div className={cn(card, "lg:col-span-5")}>
      <p className="text-sm text-muted-foreground">Where these numbers come from</p>
      <dl className="mt-4 space-y-3 text-sm">
        {rows.map(([k, v, href]) => (
          <div key={k} className="grid grid-cols-[6.5rem_1fr] gap-3 border-t border-rule pt-3">
            <dt className="text-muted-foreground">{k}</dt>
            <dd>
              {v}
              {href && (
                <a href={href} target="_blank" rel="noreferrer" className="ml-2 whitespace-nowrap text-leaf hover:underline">
                  {k === "How it's built" ? "View code" : "Raw data"} <ArrowUpRight className="inline size-3.5" aria-hidden />
                </a>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
