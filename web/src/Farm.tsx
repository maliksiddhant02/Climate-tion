import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, ArrowLeft, ArrowRight, ArrowUpRight, Beef, Check, Droplets, FlaskConical, Fuel, House, MapPin, Pencil, Tractor, Trash2, Truck, Undo2, Warehouse } from "lucide-react"
import { FieldMap, iconSvg, type Pin } from "@/components/FieldMap"
import { wx } from "@/components/weather"
import { aud, DEMO, type Farm } from "@/Live"
import { areaHa, CROPS, fuelYear, itemDepth, ITEMS, loadProfile, paddockRisk, readyDate, safeGround, saveProfile as save, uid, valuePerHa, type CropId, type ItemId, type Paddock, type Profile } from "@/lib/farm"
import { gridInPolygon, KNOBS, riverDepths, riverStage, type Cell, type LatLng } from "@/lib/flood"
import { BASE } from "@/lib/region"
import { cn } from "@/lib/utils"

const WRAP = "mx-auto w-full max-w-[1600px] px-6 md:px-10"
const card = "rounded-3xl border border-rule bg-card p-6"
const btn = "press inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-medium disabled:opacity-40"
const chip = "press inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm"

export const ICON: Record<ItemId, typeof Tractor> = {
  tractor: Tractor,
  harvester: Tractor,
  truck: Truck,
  pump: Droplets,
  fuel: Fuel,
  chem: FlaskConical,
  shed: Warehouse,
  house: House,
  cattle: Beef,
}
// Map pin markup, rendered once at load (see iconSvg).
const SVG = Object.fromEntries(Object.entries(ICON).map(([k, I]) => [k, iconSvg(I)])) as Record<ItemId, string>
const SAFE_SVG = iconSvg(MapPin)


// The example farm: the 40 ha demo block near Broadwater, split into cane, soybeans and pasture, with the usual kit.
const [[n, w], , [s, e]] = DEMO
const mid = (a: number, b: number, t = 0.5) => a + (b - a) * t
const EXAMPLE: Profile = {
  name: "",
  phone: "",
  done: true,
  boundary: DEMO,
  paddocks: [
    { id: "p1", crop: "cane", planted: "2025-09", poly: [[n, w], [n, mid(w, e)], [s, mid(w, e)], [s, w]] },
    { id: "p2", crop: "soy", planted: "2026-11", poly: [[n, mid(w, e)], [n, e], [mid(n, s), e], [mid(n, s), mid(w, e)]] },
    { id: "p3", crop: "pasture", poly: [[mid(n, s), mid(w, e)], [mid(n, s), e], [s, e], [s, mid(w, e)]] },
  ],
  items: [
    { id: "i1", kind: "tractor", at: [mid(n, s, 0.2), mid(w, e, 0.3)] },
    { id: "i2", kind: "pump", at: [mid(n, s, 0.85), mid(w, e, 0.1)], hours: 300 },
    { id: "i3", kind: "fuel", at: [mid(n, s, 0.25), mid(w, e, 0.38)] },
    { id: "i4", kind: "chem", at: [mid(n, s, 0.8), mid(w, e, 0.55)] },
    { id: "i5", kind: "shed", at: [mid(n, s, 0.15), mid(w, e, 0.42)] },
    { id: "i6", kind: "cattle", at: [mid(n, s, 0.75), mid(w, e, 0.8)] },
  ],
}

const EMPTY: Profile = { boundary: [], paddocks: [], items: [], name: "", phone: "", done: false }
const STEPS = ["Your farm", "Crops", "Equipment", "Your details"]
const monthYear = (d: Date) => d.toLocaleDateString("en-AU", { month: "long", year: "numeric" })

export function FarmPage({ farm }: { farm: Farm }) {
  // #/farm?example opens the filled-in example farm (for demos and judges).
  const [profile, setProfileState] = useState<Profile | undefined>(() => (location.hash.includes("example") ? EXAMPLE : loadProfile()))
  const [step, setStep] = useState(0)
  const setProfile = (p?: Profile) => {
    setProfileState(p)
    save(p)
  }
  // The flood model always runs on the farm the grower marked.
  useEffect(() => {
    if (profile && profile.boundary.length >= 3 && JSON.stringify(profile.boundary) !== JSON.stringify(farm.poly)) farm.setPoly(profile.boundary)
  }, [profile?.boundary]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!profile) return <Intro onStart={() => (setProfile(EMPTY), setStep(0))} onExample={() => setProfile(EXAMPLE)} />
  if (!profile.done)
    return <Setup profile={profile} setProfile={setProfile} step={step} setStep={setStep} onExample={() => setProfile(EXAMPLE)} />
  return (
    <Dashboard
      farm={farm}
      profile={profile}
      onEdit={(i) => (setProfile({ ...profile, done: false }), setStep(i))}
      onReset={() => setProfile(undefined)}
    />
  )
}

function Intro({ onStart, onExample }: { onStart: () => void; onExample: () => void }) {
  return (
    <section className={cn(WRAP, "grid gap-12 py-16 lg:grid-cols-2 lg:items-center")}>
      <div>
        <h1 className="font-display text-5xl uppercase md:text-7xl">Set up your farm</h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">Four short steps on a map. Then Draki tells you what floods, what to move, and when your crops are ready.</p>
        <ol className="mt-10 max-w-xl">
          {["Mark your farm on the map", "Show what you grow, and where", "Place your tractor, pump and sheds", "Add your name and mobile"].map((t, i) => (
            <li key={t} className="flex items-center gap-5 border-t border-rule py-4 text-lg">
              <span className="font-display text-3xl text-leaf">{i + 1}</span>
              {t}
            </li>
          ))}
        </ol>
        <div className="mt-8 flex flex-wrap gap-3">
          <button onClick={onStart} className={cn(btn, "bg-ink text-paper hover:bg-ink-2")}>
            Start <ArrowRight className="size-4" aria-hidden />
          </button>
          <button onClick={onExample} className={cn(btn, "border border-rule hover:bg-paper-2")}>
            See an example farm
          </button>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">Everything you enter stays on this device.</p>
      </div>
      <img src="/photos/cane-harvest.jpg" alt="Cane harvester beside a tall sugarcane crop" className="aspect-[4/3] w-full rounded-3xl object-cover" />
    </section>
  )
}

// ---------------------------------------------------------------- Setup

function Setup(props: { profile: Profile; setProfile: (p: Profile) => void; step: number; setStep: (n: number) => void; onExample: () => void }) {
  const { profile, setProfile, step, setStep, onExample } = props
  const [draft, setDraft] = useState<LatLng[]>([])
  const [crop, setCrop] = useState<CropId>()
  const [kind, setKind] = useState<ItemId>()
  const [error, setError] = useState<string>()
  const [flyTo, setFlyTo] = useState<LatLng>()
  const update = (patch: Partial<Profile>) => setProfile({ ...profile, ...patch })
  const go = (n: number) => {
    setDraft([])
    setCrop(undefined)
    setKind(undefined)
    setError(undefined)
    setStep(n)
  }
  // Keep the map still while the grower taps: frame the farm once it exists, otherwise the lower Richmond demo area.
  const view = profile.boundary.length >= 3 ? profile.boundary : DEMO

  const onMapClick = (p: LatLng) => {
    setError(undefined)
    if (step === 0 || (step === 1 && crop)) setDraft([...draft, p])
    if (step === 2 && kind) {
      const spec = ITEMS[kind]
      update({ items: [...profile.items, { id: uid(), kind, at: p, hours: spec.hours }] })
    }
  }

  const finishBoundary = () => {
    if (gridInPolygon(draft).points.length < 4) return setError("That's too small to read. Mark an area at least 100 m across.")
    update({ boundary: draft, paddocks: [] })
    go(1)
  }
  const finishPaddock = (poly = draft) => {
    if (!crop || poly.length < 3) return
    update({ paddocks: [...profile.paddocks, { id: uid(), crop, poly, planted: CROPS[crop].months ? new Date().toISOString().slice(0, 7) : undefined }] })
    setDraft([])
    setCrop(undefined)
  }

  const drawing = step === 0 || (step === 1 && !!crop)
  const shapes = profile.paddocks.map((p) => ({ id: p.id, poly: p.poly, color: CROPS[p.crop].color, label: `${CROPS[p.crop].label} · ${areaHa(p.poly).toFixed(1)} ha` }))
  const pins: Pin[] = profile.items.map((it) => ({ id: it.id, at: it.at, svg: SVG[it.kind], label: ITEMS[it.kind].label }))
  const hint =
    step === 0
      ? draft.length < 3
        ? `Tap each corner of your farm. ${draft.length} of at least 3.`
        : `${areaHa(draft).toFixed(1)} hectares. Tap more corners, or press Done.`
      : step === 1
        ? crop
          ? `Tap the corners of your ${CROPS[crop].label.toLowerCase()} paddock.`
          : "Pick a crop, then tap its paddock on the map."
        : step === 2
          ? kind
            ? `Tap where your ${ITEMS[kind].label.toLowerCase()} usually sits.`
            : "Pick something, then tap where it usually sits."
          : ""

  return (
    <section className={cn(WRAP, "py-10")}>
      <ol className="flex flex-wrap gap-2">
        {STEPS.map((t, i) => (
          <li key={t}>
            <button
              onClick={() => i < step && go(i)}
              disabled={i > step}
              className={cn(chip, i === step ? "border-ink bg-ink text-paper" : i < step ? "border-leaf text-leaf" : "border-rule text-muted-foreground")}
            >
              {i < step ? <Check className="size-4" aria-hidden /> : <span>{i + 1}</span>}
              {t}
            </button>
          </li>
        ))}
      </ol>

      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        {step < 3 && (
          <div className="relative overflow-hidden rounded-3xl border border-rule lg:col-span-7">
            <div className="h-[460px] lg:h-[620px]">
              <FieldMap
                poly={view}
                cells={[]}
                stepM={30}
                draft={drawing ? draft : undefined}
                noOutline={step === 0}
                shapes={step > 0 ? shapes : undefined}
                pins={step === 2 ? pins : undefined}
                onMapClick={drawing || kind ? onMapClick : undefined}
                flyTo={flyTo}
                drag
              />
            </div>
            {hint && <p className="absolute top-3 left-3 z-[1000] max-w-[80%] rounded-full bg-ink/85 px-4 py-2 text-sm text-white">{hint}</p>}
          </div>
        )}

        <div className={cn("flex flex-col", step < 3 ? "lg:col-span-5" : "lg:col-span-6")}>
          {step === 0 && (
            <>
              <h1 className="font-display text-5xl uppercase">Mark your farm</h1>
              <p className="mt-3 text-muted-foreground">Find your farm, then tap each corner of its boundary.</p>
              <Find onFound={setFlyTo} />
              <DrawButtons draft={draft} setDraft={setDraft} onDone={finishBoundary} />
              {error && <p role="alert" className="mt-4 rounded-xl bg-flood px-4 py-2 text-sm text-white">{error}</p>}
              <button onClick={onExample} className="mt-auto pt-8 text-left text-sm text-leaf hover:underline">
                Or skip this and see an example farm
              </button>
            </>
          )}

          {step === 1 && (
            <>
              <h1 className="font-display text-5xl uppercase">What do you grow?</h1>
              <p className="mt-3 text-muted-foreground">Pick a crop, then tap out its paddock. Add as many as you have.</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {(Object.keys(CROPS) as CropId[]).map((c) => (
                  <button key={c} onClick={() => (setCrop(c), setDraft([]))} className={cn(chip, crop === c ? "border-ink bg-ink text-paper" : "border-rule hover:bg-paper-2")}>
                    <i className="inline-block size-3 rounded-full" style={{ background: CROPS[c].color }} />
                    {CROPS[c].label}
                  </button>
                ))}
              </div>
              {crop && (
                <div className="mt-4 rounded-2xl bg-paper-2 p-4">
                  <DrawButtons draft={draft} setDraft={setDraft} onDone={() => finishPaddock()} />
                  {profile.paddocks.length === 0 && (
                    <button onClick={() => finishPaddock(profile.boundary)} className="mt-3 text-sm text-leaf hover:underline">
                      My whole farm is {CROPS[crop].label.toLowerCase()}
                    </button>
                  )}
                </div>
              )}
              <CropBar profile={profile} />
              <PaddockList profile={profile} update={update} />
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="font-display text-5xl uppercase">What's on your farm?</h1>
              <p className="mt-3 text-muted-foreground">Place the things a flood could reach. Draki tells you which ones to move.</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {(Object.keys(ITEMS) as ItemId[]).map((k) => {
                  const I = ICON[k]
                  return (
                    <button key={k} onClick={() => setKind(kind === k ? undefined : k)} className={cn(chip, kind === k ? "border-ink bg-ink text-paper" : "border-rule hover:bg-paper-2")}>
                      <I className="size-4" aria-hidden />
                      {ITEMS[k].label}
                    </button>
                  )
                })}
              </div>
              <ul className="mt-6 divide-y divide-rule border-y border-rule">
                {profile.items.length === 0 && <li className="py-3 text-muted-foreground">Nothing placed yet.</li>}
                {profile.items.map((it) => {
                  const I = ICON[it.kind]
                  return (
                    <li key={it.id} className="flex items-center gap-3 py-3">
                      <I className="size-5 text-leaf" aria-hidden />
                      <span className="flex-1">{ITEMS[it.kind].label}</span>
                      {ITEMS[it.kind].lph && (
                        <label className="flex items-center gap-2 text-sm text-muted-foreground">
                          <input
                            type="number"
                            min={0}
                            value={it.hours ?? 0}
                            onChange={(e) => update({ items: profile.items.map((x) => (x.id === it.id ? { ...x, hours: Math.max(0, +e.target.value) } : x)) })}
                            className="w-20 rounded-lg border border-rule bg-paper px-2 py-1 text-ink tabular-nums"
                          />
                          hours a year
                        </label>
                      )}
                      <button onClick={() => update({ items: profile.items.filter((x) => x.id !== it.id) })} aria-label={`Remove ${ITEMS[it.kind].label}`} className="press p-1 text-muted-foreground hover:text-flood">
                        <Trash2 className="size-4" />
                      </button>
                    </li>
                  )
                })}
              </ul>
            </>
          )}

          {step === 3 && (
            <>
              <h1 className="font-display text-5xl uppercase">Your details</h1>
              <p className="mt-3 text-muted-foreground">So the texts know who they're for.</p>
              <label className="mt-8 grid gap-2">
                <span className="text-sm text-muted-foreground">Your name</span>
                <input value={profile.name} onChange={(e) => update({ name: e.target.value })} autoComplete="given-name" className="rounded-2xl border border-rule bg-card px-4 py-3 text-lg" />
              </label>
              <label className="mt-5 grid gap-2">
                <span className="text-sm text-muted-foreground">Mobile number</span>
                <input value={profile.phone} onChange={(e) => update({ phone: e.target.value })} type="tel" autoComplete="tel" placeholder="04xx xxx xxx" className="rounded-2xl border border-rule bg-card px-4 py-3 text-lg" />
              </label>
              <p className="mt-3 text-sm text-muted-foreground">This is a demo: no texts are sent, and nothing leaves this device.</p>
            </>
          )}

          {step > 0 && (
            <div className="mt-8 flex justify-between gap-3 pt-4">
              <button onClick={() => go(step - 1)} className={cn(btn, "border border-rule hover:bg-paper-2")}>
                <ArrowLeft className="size-4" aria-hidden /> Back
              </button>
              {step < 3 ? (
                <button onClick={() => go(step + 1)} disabled={step === 1 && profile.paddocks.length === 0} className={cn(btn, "bg-ink text-paper hover:bg-ink-2")}>
                  Next <ArrowRight className="size-4" aria-hidden />
                </button>
              ) : (
                <button onClick={() => setProfile({ ...profile, done: true })} className={cn(btn, "bg-cane text-ink hover:bg-[#e2b84a]")}>
                  See my farm <ArrowRight className="size-4" aria-hidden />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

/** Jump the map to a road or town. OpenStreetMap Nominatim: free, light use, attribution in the footer. */
function Find({ onFound }: { onFound: (p: LatLng) => void }) {
  const [q, setQ] = useState("")
  const [msg, setMsg] = useState<string>()
  const search = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!q.trim()) return
    setMsg("Searching…")
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=au&q=${encodeURIComponent(q)}`)
      const [hit] = await r.json()
      if (!hit) return setMsg("Couldn't find that. Try a road name and town.")
      onFound([+hit.lat, +hit.lon])
      setMsg(undefined)
    } catch {
      setMsg("Search isn't working right now. Zoom the map by hand.")
    }
  }
  return (
    <form onSubmit={search} className="mt-5">
      <div className="flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Road or town, e.g. Broadwater" aria-label="Find your farm" className="min-w-0 flex-1 rounded-full border border-rule bg-card px-4 py-3" />
        <button className={cn(btn, "bg-ink text-paper hover:bg-ink-2")}>Find</button>
      </div>
      {msg && <p className="mt-2 text-sm text-muted-foreground">{msg}</p>}
    </form>
  )
}

function DrawButtons({ draft, setDraft, onDone }: { draft: LatLng[]; setDraft: (d: LatLng[]) => void; onDone: () => void }) {
  return (
    <div className="mt-5 flex flex-wrap gap-2">
      <button onClick={() => setDraft(draft.slice(0, -1))} disabled={!draft.length} className={cn(btn, "border border-rule hover:bg-card")}>
        <Undo2 className="size-4" aria-hidden /> Undo
      </button>
      <button onClick={() => setDraft([])} disabled={!draft.length} className={cn(btn, "border border-rule hover:bg-card")}>
        Start over
      </button>
      <button onClick={onDone} disabled={draft.length < 3} className={cn(btn, "bg-cane text-ink hover:bg-[#e2b84a]")}>
        <Check className="size-4" aria-hidden /> Done
      </button>
    </div>
  )
}

/** How the farm splits by crop, as one bar. */
function CropBar({ profile }: { profile: Profile }) {
  const total = areaHa(profile.boundary)
  const by = new Map<CropId, number>()
  for (const p of profile.paddocks) by.set(p.crop, (by.get(p.crop) ?? 0) + areaHa(p.poly))
  const marked = [...by.values()].reduce((a, b) => a + b, 0)
  if (!total) return null
  return (
    <div className="mt-6">
      <div className="flex h-4 gap-0.5 overflow-hidden rounded-full bg-paper-2">
        {[...by].map(([c, ha]) => (
          <div key={c} style={{ width: `${(100 * ha) / Math.max(total, marked)}%`, background: CROPS[c].color }} title={`${CROPS[c].label}: ${ha.toFixed(1)} ha`} />
        ))}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {marked ? `${marked.toFixed(1)} of ${total.toFixed(1)} hectares marked` : `${total.toFixed(1)} hectares, none marked yet`}
      </p>
    </div>
  )
}

function PaddockList({ profile, update }: { profile: Profile; update: (p: Partial<Profile>) => void }) {
  const set = (id: string, patch: Partial<Paddock>) => update({ paddocks: profile.paddocks.map((p) => (p.id === id ? { ...p, ...patch } : p)) })
  return (
    <ul className="mt-4 divide-y divide-rule border-y border-rule">
      {profile.paddocks.map((p) => (
        <li key={p.id} className="grid gap-3 py-4">
          <div className="flex items-center gap-3">
            <i className="inline-block size-3 rounded-full" style={{ background: CROPS[p.crop].color }} />
            <span className="flex-1">
              {CROPS[p.crop].label} · {areaHa(p.poly).toFixed(1)} ha
            </span>
            <button onClick={() => update({ paddocks: profile.paddocks.filter((x) => x.id !== p.id) })} aria-label="Remove paddock" className="press p-1 text-muted-foreground hover:text-flood">
              <Trash2 className="size-4" />
            </button>
          </div>
          <div className="flex flex-wrap gap-4 pl-6 text-sm text-muted-foreground">
            {CROPS[p.crop].months && (
              <label className="flex items-center gap-2">
                Planted
                <input type="month" value={p.planted ?? ""} onChange={(e) => set(p.id, { planted: e.target.value })} className="rounded-lg border border-rule bg-paper px-2 py-1 text-ink" />
              </label>
            )}
            <label className="flex items-center gap-2">
              Worth A$
              <input
                type="number"
                min={0}
                step={100}
                value={p.valuePerHa ?? CROPS[p.crop].valuePerHa ?? ""}
                placeholder="?"
                onChange={(e) => set(p.id, { valuePerHa: e.target.value === "" ? undefined : Math.max(0, +e.target.value) })}
                className="w-24 rounded-lg border border-rule bg-paper px-2 py-1 text-ink tabular-nums"
              />
              per hectare
            </label>
          </div>
        </li>
      ))}
    </ul>
  )
}

// ---------------------------------------------------------------- Dashboard

type Scenario = "week" | "common" | "record"
const SCENARIO: Record<Scenario, string> = { week: "This week", common: "A common flood", record: "A flood like 2022" }

function Dashboard({ farm, profile, onEdit, onReset }: { farm: Farm; profile: Profile; onEdit: (step: number) => void; onReset: () => void }) {
  const [scenario, setScenario] = useState<Scenario>("week")
  const [focus, setFocus] = useState<LatLng>()
  const [season, setSeason] = useState<{ latest: { phase: string }; allMeanRain: number; phases: Record<string, { meanRain: number }> }>()
  useEffect(() => {
    fetch(`${BASE}/season.json`).then((r) => r.json()).then(setSeason).catch(() => undefined)
  }, [])

  const { elev, meta } = farm
  const stepM = elev?.stepM ?? 30
  // "A common flood": the river at its about-once-in-5-years level, the point where Draki says Act today.
  const common = useMemo<Cell[] | undefined>(() => {
    if (!elev?.hand || !meta) return undefined
    const d = riverDepths(elev.hand, riverStage(meta.river.q5, meta.river))
    return elev.points.map(([lat, lng], i) => ({ lat, lng, elev: elev.e[i], depth: d[i], hand: elev.hand?.[i] }))
  }, [elev, meta])
  const cells = scenario === "week" ? farm.liveRun?.cells : scenario === "record" ? farm.replayRun?.cells : common
  const loading = !cells

  const items = profile.items.map((it) => ({ it, depth: cells ? itemDepth(it, cells, stepM) : undefined }))
  const isWet = (d?: number) => (d ?? 0) >= KNOBS.floodedDepth
  const wet = items.filter((x) => isWet(x.depth))
  const toMove = wet.filter((x) => !ITEMS[x.it.kind].prep)
  const toPrep = wet.filter((x) => ITEMS[x.it.kind].prep)
  const paddocks = profile.paddocks.map((p) => ({ p, ...paddockRisk(p, cells ?? [], stepM) }))
  const atRisk = paddocks.reduce((s, x) => s + x.atRisk, 0)
  const shed = items.find((x) => (x.it.kind === "shed" || x.it.kind === "house") && x.depth !== undefined && !isWet(x.depth))
  // The highest dry ground on the farm, pinned as Safe ground (only if there's enough of it to use).
  const high = cells ? safeGround(cells, stepM) : undefined
  const safePlace = shed ? `your ${ITEMS[shed.it.kind].label.toLowerCase()}, which stays dry` : high ? "the safe ground on your map" : "higher ground off the floodplain"
  const ha = areaHa(profile.boundary)
  const name = profile.name.trim()

  const pins: Pin[] = [
    ...(wet.length && high && !shed ? [{ id: "safe", at: [high.lat, high.lng] as LatLng, svg: SAFE_SVG, label: "Safe ground: highest dry spot" }] : []),
    ...items.map(({ it, depth }) => ({
    id: it.id,
    at: it.at,
    svg: SVG[it.kind],
    label: `${ITEMS[it.kind].label}${depth !== undefined && depth >= KNOBS.floodedDepth ? ` · under ${depth >= 2 ? "more than 2" : depth.toFixed(1)} m of water` : " · stays dry"}`,
    wet: isWet(depth),
  })),
  ]
  const shapes = profile.paddocks.map((p) => ({ id: p.id, poly: p.poly, color: CROPS[p.crop].color, label: CROPS[p.crop].label }))
  const fuel = profile.items.map((it) => ({ it, f: fuelYear(it) })).filter((x) => x.f && x.f.litres > 0)
  const cane = paddocks.filter((x) => x.p.crop === "cane")
  const ready = profile.paddocks.map((p) => ({ p, d: readyDate(p) })).filter((x) => x.d).sort((a, b) => +a.d! - +b.d!)

  const texts = [
    wet.length
      ? `Draki: FLOOD WARNING${name ? `, ${name}` : ""}.${toMove.length ? ` Move your ${list(toMove.map((x) => ITEMS[x.it.kind].label.toLowerCase()))} to ${safePlace} before the river peaks.` : ""}${toPrep.map((x) => ` Your ${ITEMS[x.it.kind].label.toLowerCase()} will flood: ${ITEMS[x.it.kind].prep}.`).join("")}`
      : `Draki: ${name ? `${name}, n` : "N"}othing on your farm is in the water's way. Draki keeps watching the river.`,
    cane.length && cane[0].floodedHa > 0
      ? `Draki: ${cane[0].floodedHa.toFixed(1)} of your ${cane[0].ha.toFixed(1)} ha of cane could go under. Hold off fertilising the low rows.`
      : undefined,
    ready[0] ? `Draki: your ${CROPS[ready[0].p.crop].label.toLowerCase()} (${areaHa(ready[0].p.poly).toFixed(0)} ha) is ready from ${monthYear(ready[0].d!)}.` : undefined,
  ].filter(Boolean) as string[]

  return (
    <section className={cn(WRAP, "py-10")}>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="font-display text-5xl uppercase md:text-6xl">{name ? `${name}'s farm` : "My farm"}</h1>
          <p className="mt-2 text-muted-foreground">
            {ha.toFixed(1)} hectares · {profile.paddocks.length} paddock{profile.paddocks.length === 1 ? "" : "s"} · {profile.items.length} things placed
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {STEPS.slice(0, 3).map((t, i) => (
            <button key={t} onClick={() => onEdit(i)} className={cn(chip, "border-rule hover:bg-paper-2")}>
              <Pencil className="size-3.5" aria-hidden /> {t}
            </button>
          ))}
          <button onClick={onReset} className={cn(chip, "border-rule text-muted-foreground hover:text-flood")}>
            Start again
          </button>
        </div>
      </div>

      <Week farm={farm} />

      <h2 className="mt-12 text-2xl">What would a flood do to your farm?</h2>
      <div className="mt-4 flex flex-wrap gap-2" role="tablist">
        {(Object.keys(SCENARIO) as Scenario[]).map((k) => (
          <button key={k} role="tab" aria-selected={scenario === k} onClick={() => setScenario(k)} className={cn(chip, scenario === k ? "border-ink bg-ink text-paper" : "border-rule hover:bg-paper-2")}>
            {SCENARIO[k]}
          </button>
        ))}
      </div>

      <div
        className={cn(
          "mt-4 flex flex-wrap items-center gap-4 rounded-3xl px-6 py-5",
          loading ? "bg-paper-2" : wet.length || atRisk ? "bg-flood text-white" : "bg-leaf text-white",
        )}
      >
        {!loading && (wet.length || atRisk ? <AlertTriangle className="size-6" aria-hidden /> : <Check className="size-6" aria-hidden />)}
        <p className="text-2xl">
          {loading
            ? "Reading your farm…"
            : wet.length
              ? `${wet.length} thing${wet.length === 1 ? "" : "s"} in the water's way${atRisk ? `, ${aud(atRisk)} of crops under water` : ""}`
              : atRisk
                ? `${aud(atRisk)} of crops under water`
                : scenario === "week"
                  ? "This week, nothing on your farm floods."
                  : "Your farm stays dry."}
        </p>
        {scenario === "week" && !loading && !wet.length && (
          <button onClick={() => setScenario("common")} className="ml-auto text-sm underline underline-offset-4">
            See what a flood would do
          </button>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        <div className="relative overflow-hidden rounded-3xl border border-rule lg:col-span-7 lg:row-span-2">
          <div className="h-[460px] lg:h-full lg:min-h-[600px]">
            <FieldMap poly={profile.boundary} cells={cells ?? []} stepM={stepM} shapes={shapes} pins={pins} wetOnly runKey={scenario} flyTo={focus} flyZoom={17} />
          </div>
          <p className="absolute bottom-3 left-3 z-[1000] flex gap-4 rounded-full bg-ink/85 px-4 py-2 text-sm text-white">
            <span className="flex items-center gap-2">
              <i className="size-3 rounded-sm bg-flood" /> Under water
            </span>
            <span className="flex items-center gap-2">
              <i className="size-3 rounded-full bg-flood ring-2 ring-white" /> Move this
            </span>
          </p>
        </div>

        <div className={cn(card, "lg:col-span-5")}>
          <h2 className="text-2xl">Before the water comes</h2>
          <ul className="mt-4 divide-y divide-rule">
            {items.length === 0 && <li className="py-3 text-muted-foreground">Place your equipment to see what to move.</li>}
            {items.map(({ it, depth }) => {
              const I = ICON[it.kind]
              const w = isWet(depth)
              const deep = depth === undefined ? "" : depth >= 2 ? "2 m+" : `${depth.toFixed(1)} m`
              return (
                <li key={it.id}>
                  <button onClick={() => setFocus([...it.at])} title="Show on the map" className="press flex w-full items-center gap-3 rounded-xl py-3 text-left hover:bg-paper-2">
                  <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", w ? "bg-flood text-white" : "bg-paper-2 text-leaf")}>
                    <I className="size-4" aria-hidden />
                  </span>
                  <span className="flex-1">
                    {ITEMS[it.kind].label}
                    {w && ITEMS[it.kind].prep && <span className="block text-sm text-muted-foreground">{ITEMS[it.kind].prep}</span>}
                  </span>
                  <span className={cn("text-right text-sm", w ? "font-medium text-flood" : "text-muted-foreground")}>
                    {depth === undefined ? "off your farm" : w ? `${ITEMS[it.kind].prep ? "floods" : "move it"} · ${deep}` : "stays dry"}
                  </span>
                  </button>
                </li>
              )
            })}
          </ul>
          {toMove.length > 0 && <p className="mt-4 text-sm text-muted-foreground">Move them to {safePlace}.</p>}
        </div>

        <div className={cn(card, "lg:col-span-5")}>
          <h2 className="text-2xl">Your paddocks</h2>
          <ul className="mt-4 divide-y divide-rule">
            {paddocks.map(({ p, ha, floodedHa, atRisk }) => {
              const d = readyDate(p)
              return (
                <li key={p.id} onClick={() => setFocus(centre(p.poly))} title="Show on the map" className="grid cursor-pointer grid-cols-[auto_1fr_auto] items-baseline gap-x-3 rounded-xl py-3 hover:bg-paper-2">
                  <i className="inline-block size-3 rounded-full" style={{ background: CROPS[p.crop].color }} />
                  <span>
                    {CROPS[p.crop].label} · {ha.toFixed(1)} ha
                    {d && <span className="block text-sm text-muted-foreground">Ready {monthYear(d)}</span>}
                  </span>
                  <span className={cn("text-right text-sm", floodedHa ? "text-flood" : "text-muted-foreground")}>
                    {floodedHa ? `${floodedHa.toFixed(1)} ha under` : "dry"}
                    {floodedHa > 0 && (
                      <span className="block">{valuePerHa(p) ? aud(atRisk) : <button onClick={() => onEdit(1)} className="underline">add value</button>}</span>
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>

        <div className={cn(card, "lg:col-span-7")}>
          <h2 className="text-2xl">Your year</h2>
          <Timeline paddocks={profile.paddocks} onEdit={() => onEdit(1)} />
        </div>

        <div className="rounded-3xl bg-ink p-6 text-white lg:col-span-5">
          <h2 className="text-2xl">Your texts</h2>
          <p className="mt-1 text-sm text-white/60">{profile.phone ? `To ${profile.phone}` : "Any phone, no app"} · {SCENARIO[scenario].toLowerCase()}</p>
          <ol className="mt-4 space-y-3">
            {texts.map((t) => (
              <li key={t} className="max-w-[90%] rounded-2xl rounded-tl-sm bg-white/10 px-4 py-3 text-sm leading-relaxed">
                {t}
              </li>
            ))}
          </ol>
        </div>

        <div className={cn(card, "lg:col-span-12")}>
          <h2 className="text-2xl">Worth knowing</h2>
          <ul className="mt-4 grid gap-x-10 md:grid-cols-2 [&>li]:border-t [&>li]:border-rule">
            {season && (
              <li className="py-3">
                <span className="font-medium">{season.latest.phase === "elnino" ? "El Niño is under way." : "No El Niño this season."}</span>{" "}
                <span className="text-muted-foreground">
                  {season.latest.phase === "elnino"
                    ? `El Niño years bring about ${Math.round((1 - season.phases.elnino.meanRain / season.allMeanRain) * 100)}% less rain here. Keep the trash blanket on and check your pump.`
                    : "Draki watches the rain all season."}
                </span>
              </li>
            )}
            {fuel.map(({ it, f }) => (
              <li key={it.id} className="py-3">
                <span className="font-medium">
                  Your {ITEMS[it.kind].label.toLowerCase()} burns about {Math.round(f!.litres).toLocaleString("en-AU")} L of diesel a year ({aud(f!.cost)}).
                </span>{" "}
                <span className="text-muted-foreground">{f!.swap ? `Switching to ${f!.swap} saves that fuel.` : "No practical electric option yet. Keep it tuned."}</span>
              </li>
            ))}
            <li className="py-3">
              <span className="font-medium">If you flood,</span>{" "}
              <span className="text-muted-foreground">
                Draki's record of your farm (date, hectares, depth) backs up a{" "}
                <a href="https://www.disasterassist.gov.au/" target="_blank" rel="noreferrer" className="text-leaf hover:underline">
                  disaster grant <ArrowUpRight className="inline size-3.5" aria-hidden />
                </a>{" "}
                or insurance claim.
              </span>
            </li>
          </ul>
        </div>
      </div>
    </section>
  )
}

const centre = (poly: LatLng[]): LatLng => [poly.reduce((a, p) => a + p[0], 0) / poly.length, poly.reduce((a, p) => a + p[1], 0) / poly.length]

/** This week's weather at the farm: what a grower checks every day. */
function Week({ farm }: { farm: Farm }) {
  const r = farm.liveRun
  const day = (iso: string, i: number) => (i === 0 ? "Today" : new Date(iso).toLocaleDateString("en-AU", { weekday: "short" }))
  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-2xl">This week at your farm</h2>
        {r?.river && (
          <p className="text-muted-foreground">
            Richmond River: {r.river.stage > 0 ? `${r.river.stage.toFixed(1)} m above normal` : "in its banks"}
            {r.river.odds ? ` · ${r.river.odds.flood} of ${r.river.odds.n} forecasts flood your farm` : ""}
          </p>
        )}
      </div>
      <div className="-mx-6 mt-4 flex snap-x gap-3 overflow-x-auto px-6 pb-1 sm:mx-0 sm:grid sm:grid-cols-7 sm:overflow-visible sm:px-0">
        {r
          ? r.w.daily.time.map((t, i) => {
              const { Icon, label } = wx(r.w.daily.code[i])
              const rain = r.w.daily.rain[i]
              return (
                <div key={t} className={cn("min-w-[6.5rem] shrink-0 snap-start rounded-3xl border p-4 sm:min-w-0", rain >= 10 ? "border-rain-soft bg-rain-soft/40" : "border-rule bg-card")}>
                  <p className="text-sm text-muted-foreground">{day(t, i)}</p>
                  <Icon className="my-3 size-7 text-ink" aria-label={label} />
                  <p className="text-2xl font-semibold">
                    {rain.toFixed(0)}
                    <span className="text-sm font-normal"> mm</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {Math.round(r.w.daily.temp[i])}°{r.w.daily.prob ? ` · ${r.w.daily.prob[i]}% rain` : ""}
                  </p>
                </div>
              )
            })
          : [...Array(7)].map((_, i) => <div key={i} className="h-36 min-w-[6.5rem] rounded-3xl bg-paper-2 sm:min-w-0" />)}
      </div>
    </div>
  )
}

/** Planting to harvest for each paddock over the next two years, with the mill's crushing season shaded. */
function Timeline({ paddocks, onEdit }: { paddocks: Paddock[]; onEdit: () => void }) {
  const start = new Date()
  start.setDate(1)
  const MONTHS = 24
  const at = (d: Date) => ((d.getFullYear() - start.getFullYear()) * 12 + d.getMonth() - start.getMonth() + (d.getDate() - 1) / 30) / MONTHS
  const clamp = (x: number) => Math.min(1, Math.max(0, x))
  const months = [...Array(MONTHS)].map((_, i) => new Date(start.getFullYear(), start.getMonth() + i, 1))
  const rows = paddocks.map((p) => ({ p, ready: readyDate(p), planted: p.planted ? new Date(`${p.planted}-01T00:00:00`) : undefined })).filter((r) => r.ready && r.planted)
  if (!rows.length)
    return (
      <p className="mt-4 text-muted-foreground">
        Add when you planted to see your harvests here.{" "}
        <button onClick={onEdit} className="text-leaf underline">
          Add planting months
        </button>
      </p>
    )
  const crush = paddocks.some((p) => p.crop === "cane")
  return (
    <div className="mt-6">
      <div className="grid grid-cols-[7.5rem_1fr] items-center gap-x-4 gap-y-3 sm:grid-cols-[10rem_1fr]">
        <span />
        <div className="relative h-5 text-sm text-muted-foreground">
          {months.map((m, i) =>
            // Skip a year label that would sit on top of "Now".
            i === 0 || (m.getMonth() === 0 && i >= 5) ? (
              <span key={i} className="absolute whitespace-nowrap" style={{ left: `${(100 * i) / MONTHS}%` }}>
                {i === 0 ? "Now" : m.getFullYear()}
              </span>
            ) : null,
          )}
        </div>
        {rows.map(({ p, ready, planted }) => {
          const a = clamp(at(planted!))
          const b = clamp(at(ready!))
          return [
            <span key={`${p.id}l`} className="flex items-start gap-2 text-sm">
              <i className="mt-1 inline-block size-3 shrink-0 rounded-full" style={{ background: CROPS[p.crop].color }} />
              <span>
                {CROPS[p.crop].label}
                <span className="block text-muted-foreground">Ready {ready!.toLocaleDateString("en-AU", { month: "short", year: "numeric" })}</span>
              </span>
            </span>,
            <div key={`${p.id}b`} className="relative h-8 overflow-hidden rounded-full bg-paper-2">
              {crush &&
                p.crop === "cane" &&
                months.map((m, i) =>
                  m.getMonth() >= 5 ? <span key={i} className="absolute inset-y-0 bg-cane/15" style={{ left: `${(100 * i) / MONTHS}%`, width: `${100 / MONTHS}%` }} /> : null,
                )}
              <span className="absolute inset-y-1.5 rounded-full" style={{ left: `${100 * a}%`, width: `${100 * Math.max(0.01, b - a)}%`, background: CROPS[p.crop].color }} />
            </div>,
          ]
        })}
      </div>
      {crush && (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <i className="inline-block h-3 w-5 rounded-sm bg-cane/15" /> Mill crushing season (June to December)
        </p>
      )}
    </div>
  )
}

const list = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`)
