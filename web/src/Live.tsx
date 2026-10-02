import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, ArrowRight, Check, Eye, PenLine, RotateCcw } from "lucide-react"
import { FieldMap } from "@/components/FieldMap"
import { DECADES, RainBars, wx } from "@/components/weather"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getCodyReplay, getElevations, getFlowForecast, getWeather, REPLAY, type Flow, type Weather } from "@/lib/api"
import { assess, floodDepths, gridInPolygon, KNOBS, levelFor, maxRolling, PLAYBOOK, riverDepths, riverStage, type Assessment, type Cell, type LatLng, type Level, type River } from "@/lib/flood"
import { covers, loadRegion, sample, type Meta } from "@/lib/region"
import { cn } from "@/lib/utils"

// Demo block: cane farms on the east bank of the Ba River, just north of Ba town.
export const DEMO: LatLng[] = [[-17.52031, 177.68509], [-17.51976, 177.69024], [-17.52577, 177.6911], [-17.52686, 177.68566]]

// Fewer elevation cells than this and the field is too small to say anything useful.
const MIN_CELLS = 4

export const fjd = (v: number) => `F$${(Math.round(v / 100) * 100).toLocaleString("en-AU")}`
const dateLabel = (iso: string) => new Date(iso).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })
const weekday = (iso: string) => new Date(iso).toLocaleDateString("en-AU", { weekday: "short" })

type Elev = { points: LatLng[]; stepM: number; e: number[]; hand?: number[]; land?: number[] }

const flowLabel = (q: number) => `${q < 10 ? q.toFixed(1) : Math.round(q).toLocaleString("en-AU")} m³/s`

const peakQ = (q: (number | null)[]) => Math.max(0, ...q.map((v) => v ?? 0))

/** Rain pooling everywhere; plus the Ba River rising over the field when we have its height above the river. */
function run(w: Weather | undefined, elev: Elev | undefined, flow?: Flow, cal?: River) {
  if (!w || !elev) return undefined
  const peak = maxRolling(w.hourly.rain)
  const rain = floodDepths(elev.e, elev.stepM ** 2, peak.total)
  let depths = rain
  let river: { q: number; day: string; stage: number; cal: River; odds?: { flood: number; act: number; n: number } } | undefined
  if (flow && cal && elev.hand) {
    const hand = elev.hand
    const withRiver = (q: number) => riverDepths(hand, riverStage(q, cal)).map((d, i) => Math.max(d, rain[i]))
    const q = peakQ(flow.q)
    depths = withRiver(q)
    river = { q, day: flow.time[flow.q.indexOf(q)] ?? flow.time[0], stage: riverStage(q, cal), cal }
    // Forecast confidence: run the field once per GloFAS ensemble member.
    if (flow.members?.length) {
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
  const [poly, setPoly] = useState<LatLng[]>(DEMO)
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
          // Ba floodplain: 30 m grid from the shipped data, river model on, Cody replay from static files.
          const { points, stepM } = gridInPolygon(poly, 30, 2500)
          const s = points.map((p) => sample(region, p))
          setElev({ points, stepM, e: s.map((x) => x.elev), hand: s.map((x) => x.hand), land: s.map((x) => x.land) })
          getCodyReplay()
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
  const riverLine = river && river.stage > 0 ? `Ba River rising ~${river.stage.toFixed(1)} m above normal. ` : ""
  const body =
    a.level === "clear"
      ? `Up to ${peak.total.toFixed(0)} mm of rain in 3 days. Your field should drain fine.`
      : `${riverLine}${peak.total.toFixed(0)} mm of rain in 72 h. Your low ground could sit under ~${a.maxDepth.toFixed(1)} m of water. About ${a.floodedHa.toFixed(0)} ha of cane, ${fjd(a.valueAtRisk)}.`
  return [
    `Draki · ${demo ? "Ba block" : "your field"}${replay ? " (replay)" : ""}`,
    head,
    body,
    PLAYBOOK[a.level].map((t, i) => `${i + 1}. ${t}`).join("\n"),
    `Why: Ba now gets ${DECADES.now.toFixed(0)} days a year of 50 mm+ rain, up from ${DECADES.then.toFixed(0)} in the 1990s. Warmer air holds more water.`,
  ].join("\n\n")
}

const card = "rounded-3xl border border-white/10 bg-white/[0.04] p-6"

export function LivePage({ farm, mode, setMode }: { farm: Farm; mode: "live" | "replay"; setMode: (m: "live" | "replay") => void }) {
  const { poly, setPoly, elev, error, liveRun, replayRun, retry, isDemo } = farm
  const [draft, setDraft] = useState<LatLng[]>()
  const [draftError, setDraftError] = useState<string>()
  const [lang, setLang] = useState("en")
  const r = mode === "live" ? liveRun : replayRun

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
      setDraftError("Too small to read. Mark a block at least 1 ha across.")
      return
    }
    setDraftError(undefined)
    setPoly(draft)
    setDraft(undefined)
  }
  const pill = "rounded-full bg-ink/80 px-4 py-2 text-sm backdrop-blur hover:bg-ink"

  return (
    <section className="bg-ink text-white">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <h1 className="font-display text-5xl">Live field</h1>
            <p className="mt-3 text-white/60">{isDemo ? "40 ha of cane on the Ba River, Fiji." : r ? `Your ${r.a.areaHa.toFixed(1)} ha field.` : "Your field."}</p>
          </div>
          <Tabs value={mode} onValueChange={(v) => setMode(v as "live" | "replay")}>
            <TabsList className="h-11 rounded-full bg-white/[0.07] p-1">
              <TabsTrigger value="live" className="rounded-full px-4 text-white/60 data-active:bg-white data-active:text-ink">
                This week
              </TabsTrigger>
              <TabsTrigger value="replay" className="rounded-full px-4 text-white/60 data-active:bg-white data-active:text-ink">
                {REPLAY.name}, 2022
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {error && (
          <div role="alert" className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-flood/40 bg-flood/10 px-4 py-3 text-sm">
            <p>{error}</p>
            <div className="flex gap-2">
              <button onClick={retry} className="rounded-full bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-paper">
                Try again
              </button>
              {!isDemo && (
                <button onClick={() => setPoly(DEMO)} className="rounded-full border border-white/25 px-4 py-2 text-sm hover:bg-white/10">
                  Back to demo
                </button>
              )}
            </div>
          </div>
        )}

        <div className={cn("mt-10 grid gap-4 transition-opacity lg:grid-cols-12", !r && "opacity-60")}>
          <div className="relative overflow-hidden rounded-3xl border border-white/10 lg:col-span-7 lg:row-span-2">
            <div className="h-[460px] lg:h-full lg:min-h-[540px]">
              <FieldMap
                poly={poly}
                cells={r?.cells ?? []}
                stepM={elev?.stepM ?? 30}
                high={r && r.cells.length > 1 && r.a.high.depth < KNOBS.floodedDepth ? r.a.high : undefined}
                draft={draft}
                onMapClick={draft ? (p) => setDraft([...draft, p]) : undefined}
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
                  <button onClick={finishDraft} disabled={draft.length < 3} className="rounded-full bg-cane px-4 py-2 text-sm font-medium text-ink disabled:opacity-40">
                    Done
                  </button>
                </>
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
            {r && !draft && (
              <div className="absolute bottom-3 left-3 z-[1000] flex gap-4 rounded-full bg-ink/80 px-4 py-2 text-sm backdrop-blur">
                <span className="flex items-center gap-2">
                  <i className="size-3 rounded-sm bg-flood" /> Under water
                </span>
                <span className="flex items-center gap-2">
                  <i className="size-3 rounded-sm bg-rain-soft" /> Puddling
                </span>
              </div>
            )}
          </div>

          <RiskCard r={r} live={mode === "live"} onReplay={mode === "live" ? () => setMode("replay") : undefined} />

          <div className={cn(card, "lg:col-span-5")}>
            <div className="flex items-baseline justify-between">
              <p className="text-sm text-white/60">Wettest 72 hours</p>
              <p className="text-2xl font-semibold">{r ? `${r.peak.total.toFixed(0)} mm` : "–"}</p>
            </div>
            <div className="mt-4">{r && <RainBars time={r.w.hourly.time} rain={r.w.hourly.rain} start={r.peak.start} />}</div>
          </div>

          <div className="-mx-6 flex snap-x gap-3 overflow-x-auto px-6 pb-1 sm:mx-0 sm:grid sm:grid-cols-7 sm:overflow-visible sm:px-0 lg:col-span-12">
            {r?.w.daily.time.map((t, i) => {
              const { Icon, label } = wx(r.w.daily.code[i])
              // Only call out a day that's actually wet, not the least-dry day of a dry week.
              const wettest = r.w.daily.rain[i] >= 10 && r.w.daily.rain[i] === Math.max(...r.w.daily.rain)
              return (
                <div key={t} className={cn("min-w-[6.5rem] shrink-0 snap-start rounded-3xl p-4 sm:min-w-0", wettest ? "bg-rain-soft text-ink" : "border border-white/10 bg-white/[0.04]")}>
                  <p className={cn("text-sm", !wettest && "text-white/60")}>{weekday(t)}{wettest && " · wettest"}</p>
                  <Icon className="my-4 size-7" aria-label={label} />
                  <p className="text-2xl font-semibold">{r.w.daily.rain[i].toFixed(0)}<span className="text-sm font-normal"> mm</span></p>
                </div>
              )
            })}
          </div>

          <div className={cn(card, "lg:col-span-5")}>
            <div className="flex items-center justify-between">
              <p className="text-sm text-white/60">SMS</p>
              <Tabs value={lang} onValueChange={(v) => setLang(v as string)}>
                <TabsList className="h-9 rounded-full bg-white/[0.07] p-0.5">
                  {[["en", "English"], ["fj", "iTaukei"], ["hi", "Hindi"]].map(([v, l]) => (
                    <TabsTrigger key={v} value={v} className="rounded-full px-3 text-sm text-white/60 data-active:bg-white data-active:text-ink">
                      {l}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
            <div className="mx-auto mt-5 max-w-sm rounded-[2rem] border border-white/15 bg-[#0d1712] p-3">
              <p className="rounded-[1.5rem] bg-white/10 p-4 text-sm leading-relaxed whitespace-pre-line text-white/90">
                {lang !== "en" ? "Native-speaker translation coming." : r ? smsText(r, mode === "replay", isDemo) : "…"}
              </p>
            </div>
          </div>

          <div className={cn(card, "flex flex-col lg:col-span-7")}>
            <p className="text-sm text-white/60">What to do</p>
            <ol className="mt-4 space-y-3">
              {(r ? PLAYBOOK[r.a.level] : []).map((t, i) => (
                <li key={t} className="flex items-baseline gap-4 border-t border-white/10 pt-3">
                  <span className="font-display text-2xl text-cane">{i + 1}</span>
                  {t}
                </li>
              ))}
            </ol>
            <a href="#/proof" className="mt-auto inline-flex items-center gap-2 pt-6 text-sm text-white/60 hover:text-white">
              How we check this <ArrowRight className="size-4" aria-hidden />
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}

function RiskCard({ r, live, onReplay }: { r?: Run; live: boolean; onReplay?: () => void }) {
  const a: Assessment | undefined = r?.a
  const river = r?.river
  return (
    <div className="flex flex-col justify-between rounded-3xl bg-paper p-6 text-ink lg:col-span-5">
      <div className="flex items-start justify-between">
        <p className="text-sm text-muted-foreground">Likely under water</p>
        {a && <StatusPill level={a.level} />}
      </div>
      <p className={cn("mt-6 text-5xl tracking-tight", a?.level === "clear" ? "font-display" : "font-semibold")}>
        {!a ? "–" : a.level === "clear" ? "Nothing goes under." : `${a.floodedHa.toFixed(1)} ha`}
      </p>
      {river && (
        <p className="mt-3 text-sm text-muted-foreground">
          {river.stage > 0
            ? `Ba River peaks at ${flowLabel(river.q)}, ~${river.stage.toFixed(1)} m above normal.`
            : `Ba River stays in its banks (peak ${flowLabel(river.q)}).`}
          {live && river.odds && ` ${river.odds.flood} of ${river.odds.n} forecast runs flood this field.`}
        </p>
      )}
      <div className="mt-6 flex items-end justify-between border-t border-rule pt-4">
        <div>
          <p className="text-sm text-muted-foreground">Cane at risk</p>
          <p className="text-2xl font-semibold">{a ? (a.valueAtRisk > 0 ? fjd(a.valueAtRisk) : "None") : "–"}</p>
        </div>
        {a?.level === "clear" && onReplay && (
          <button onClick={onReplay} className="inline-flex items-center gap-1 text-sm font-medium text-leaf hover:underline">
            See a cyclone week <ArrowRight className="size-4" aria-hidden />
          </button>
        )}
      </div>
    </div>
  )
}
