import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, ArrowRight, Check, Eye, PenLine, RotateCcw } from "lucide-react"
import { FieldMap } from "@/components/FieldMap"
import { DECADES, RainBars, wx } from "@/components/weather"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getElevations, getWeather, REPLAY, type Weather } from "@/lib/api"
import { assess, floodDepths, gridInPolygon, maxRolling, PLAYBOOK, type Assessment, type Cell, type LatLng, type Level } from "@/lib/flood"
import { cn } from "@/lib/utils"

// Demo block: cane farms on the east bank of the Ba River, just north of Ba town.
export const DEMO: LatLng[] = [[-17.52031, 177.68509], [-17.51976, 177.69024], [-17.52577, 177.6911], [-17.52686, 177.68566]]

export const fjd = (v: number) => `F$${(Math.round(v / 100) * 100).toLocaleString("en-AU")}`
const dateLabel = (iso: string) => new Date(iso).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })
const weekday = (iso: string) => new Date(iso).toLocaleDateString("en-AU", { weekday: "short" })

type Elev = { points: LatLng[]; stepM: number; e: number[] }

function run(w: Weather | undefined, elev: Elev | undefined) {
  if (!w || !elev) return undefined
  const peak = maxRolling(w.hourly.rain)
  const depths = floodDepths(elev.e, elev.stepM ** 2, peak.total)
  const cells: Cell[] = elev.points.map(([lat, lng], i) => ({ lat, lng, elev: elev.e[i], depth: depths[i] }))
  return { peak, cells, a: assess(cells, elev.stepM), w }
}

type Run = NonNullable<ReturnType<typeof run>>

/** All data for the field. Lives in App so switching pages never refetches. */
export function useFarm() {
  const [poly, setPoly] = useState<LatLng[]>(DEMO)
  const [live, setLive] = useState<Weather>()
  const [replay, setReplay] = useState<Weather>()
  const [elev, setElev] = useState<Elev>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    const center: LatLng = [poly.reduce((s, p) => s + p[0], 0) / poly.length, poly.reduce((s, p) => s + p[1], 0) / poly.length]
    const fail = (e: Error) => setError(e.message)
    setError(undefined)
    getWeather(center, false).then(setLive).catch(fail)
    getWeather(center, true).then(setReplay).catch(fail)
    const { points, stepM } = gridInPolygon(poly)
    getElevations(points).then((e) => setElev({ points, stepM, e })).catch(fail)
  }, [poly])

  const liveRun = useMemo(() => run(live, elev), [live, elev])
  const replayRun = useMemo(() => run(replay, elev), [replay, elev])
  return { poly, setPoly, elev, error, liveRun, replayRun }
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

function smsText({ a, peak, w }: Run, replay: boolean) {
  const from = w.hourly.time[peak.start]
  const head = {
    act: `FLOOD RISK HIGH from ${dateLabel(from)}`,
    watch: `Wet spell from ${dateLabel(from)}`,
    clear: "No flooding expected this week",
  }[a.level]
  const body =
    a.level === "clear"
      ? `Up to ${peak.total.toFixed(0)} mm of rain in 3 days. Your field should drain fine.`
      : `${peak.total.toFixed(0)} mm of rain in 72 h. Your low ground could sit under ~${a.maxDepth.toFixed(1)} m of water. About ${a.floodedHa.toFixed(0)} ha of cane, ${fjd(a.valueAtRisk)}.`
  return [
    `FarmShield · Ba block${replay ? " (replay)" : ""}`,
    head,
    body,
    PLAYBOOK[a.level].map((t, i) => `${i + 1}. ${t}`).join("\n"),
    `Why: Ba now gets ${DECADES.now.toFixed(0)} days a year of 50 mm+ rain, up from ${DECADES.then.toFixed(0)} in the 1990s. Warmer air holds more water.`,
  ].join("\n\n")
}

const card = "rounded-3xl border border-white/10 bg-white/[0.04] p-6"

export function LivePage({ farm, mode, setMode }: { farm: Farm; mode: "live" | "replay"; setMode: (m: "live" | "replay") => void }) {
  const { poly, setPoly, elev, error, liveRun, replayRun } = farm
  const [draft, setDraft] = useState<LatLng[]>()
  const [lang, setLang] = useState("en")
  const r = mode === "live" ? liveRun : replayRun

  const finishDraft = () => {
    if (draft && draft.length >= 3) setPoly(draft)
    setDraft(undefined)
  }
  const pill = "rounded-full bg-ink/80 px-4 py-2 text-sm backdrop-blur hover:bg-ink"

  return (
    <section className="bg-ink text-white">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <h1 className="font-display text-5xl">Live field</h1>
            <p className="mt-3 text-white/60">40 ha of cane on the Ba River, Fiji.</p>
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

        {error && <p className="mt-6 rounded-xl border border-flood/40 bg-flood/10 px-4 py-3 text-sm">Couldn't load data: {error}</p>}

        <div className={cn("mt-10 grid gap-4 transition-opacity lg:grid-cols-12", !r && "opacity-60")}>
          <div className="relative overflow-hidden rounded-3xl border border-white/10 lg:col-span-7 lg:row-span-2">
            <div className="h-[460px] lg:h-full lg:min-h-[540px]">
              <FieldMap
                poly={poly}
                cells={r?.cells ?? []}
                stepM={elev?.stepM ?? 30}
                high={r?.a.high}
                draft={draft}
                onMapClick={draft ? (p) => setDraft([...draft, p]) : undefined}
              />
            </div>
            <div className="absolute top-3 left-3 z-[1000] flex gap-2">
              {!draft ? (
                <button onClick={() => setDraft([])} className={cn(pill, "inline-flex items-center gap-2")}>
                  <PenLine className="size-4" aria-hidden /> Draw your field
                </button>
              ) : (
                <>
                  <span className={pill}>Tap corners · {draft.length}</span>
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

          <RiskCard a={r?.a} onReplay={mode === "live" ? () => setMode("replay") : undefined} />

          <div className={cn(card, "lg:col-span-5")}>
            <div className="flex items-baseline justify-between">
              <p className="text-sm text-white/60">Wettest 72 hours</p>
              <p className="text-2xl font-semibold">{r ? `${r.peak.total.toFixed(0)} mm` : "–"}</p>
            </div>
            <div className="mt-4">{r && <RainBars time={r.w.hourly.time} rain={r.w.hourly.rain} start={r.peak.start} />}</div>
          </div>

          <div className="grid grid-cols-4 gap-3 sm:grid-cols-7 lg:col-span-12">
            {r?.w.daily.time.map((t, i) => {
              const { Icon, label } = wx(r.w.daily.code[i])
              const wettest = r.w.daily.rain[i] === Math.max(...r.w.daily.rain)
              return (
                <div key={t} className={cn("rounded-3xl p-4", wettest ? "bg-rain-soft text-ink" : "border border-white/10 bg-white/[0.04]")}>
                  <p className={cn("text-sm", !wettest && "text-white/60")}>{weekday(t)}</p>
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
                {lang !== "en" ? "Native-speaker translation coming." : r ? smsText(r, mode === "replay") : "…"}
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

function RiskCard({ a, onReplay }: { a?: Assessment; onReplay?: () => void }) {
  return (
    <div className="flex flex-col justify-between rounded-3xl bg-paper p-6 text-ink lg:col-span-5">
      <div className="flex items-start justify-between">
        <p className="text-sm text-muted-foreground">Likely under water</p>
        {a && <StatusPill level={a.level} />}
      </div>
      <p className="mt-6 text-5xl font-semibold tracking-tight">{a ? `${a.floodedHa.toFixed(1)} ha` : "–"}</p>
      <div className="mt-6 flex items-end justify-between border-t border-rule pt-4">
        <div>
          <p className="text-sm text-muted-foreground">Cane at risk</p>
          <p className="text-2xl font-semibold">{a ? fjd(a.valueAtRisk) : "–"}</p>
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
