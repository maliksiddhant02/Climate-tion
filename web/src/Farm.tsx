import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Droplets, FlaskConical, Fuel, House, MapPin, Pencil, Tractor, Trash2, Undo2, Warehouse } from "lucide-react"
import { FieldMap, iconSvg, type Pin } from "@/components/FieldMap"
import { DECADES, HeavyRainChart, wx } from "@/components/weather"
import { Phone } from "@/components/Phone"
import { FloodRecord } from "@/components/FloodRecord"
import { aud, DEMO, type Farm } from "@/Live"
import { insertCorner, areaHa, cropLabel, CROPS, fuelYear, itemDepth, ITEMS, loadProfile, paddockRisk, readyDate, safeGround, saveProfile as save, uid, valuePerHa, type CropId, type ItemId, type Paddock, type Profile } from "@/lib/farm"
import { gridInPolygon, KNOBS, riverDepths, riverStage, type Cell, type LatLng } from "@/lib/flood"
import { BASE } from "@/lib/region"
import { cn } from "@/lib/utils"

const WRAP = "mx-auto w-full max-w-[1600px] px-6 md:px-10"
const card = "rounded-3xl border border-rule bg-card p-6"
const btn = "press inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-medium disabled:opacity-40"
const chip = "press inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm"

export const ICON: Record<ItemId, typeof Fuel> = {
  pump: Droplets,
  fuel: Fuel,
  chem: FlaskConical,
  shed: Warehouse,
  house: House,
}
// Map pin markup, rendered once at load (see iconSvg).
const SVG = Object.fromEntries(Object.entries(ICON).map(([k, I]) => [k, iconSvg(I)])) as Record<ItemId, string>
const SAFE_SVG = iconSvg(MapPin)


// The example farm: the 40 ha demo block near Broadwater, split into cane, soybeans and pasture, with its shed, tank, pump and store.
const [[n, w], , [s, e]] = DEMO
const mid = (a: number, b: number, t = 0.5) => a + (b - a) * t
export const EXAMPLE: Profile = {
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
    { id: "i2", kind: "pump", at: [mid(n, s, 0.85), mid(w, e, 0.1)], hours: 300 },
    { id: "i3", kind: "fuel", at: [mid(n, s, 0.25), mid(w, e, 0.38)] },
    { id: "i4", kind: "chem", at: [mid(n, s, 0.8), mid(w, e, 0.55)] },
    { id: "i5", kind: "shed", at: [mid(n, s, 0.15), mid(w, e, 0.42)] },
  ],
}

const EMPTY: Profile = { boundary: [], paddocks: [], items: [], name: "", phone: "", done: false }
const STEPS = ["Your farm", "Crops", "Sheds & tanks", "Your details"]
const monthYear = (d: Date) => d.toLocaleDateString("en-AU", { month: "long", year: "numeric" })

export function FarmPage({ farm }: { farm: Farm }) {
  // #/farm?example opens the filled-in example farm (for demos and judges).
  const [profile, setProfileState] = useState<Profile | undefined>(() => (location.hash.includes("example") ? EXAMPLE : loadProfile()))
  const [step, setStep] = useState(0)
  const setProfile = (p?: Profile) => {
    setProfileState(p)
    save(p)
  }
  // The flood model always runs on the farm the farmer marked.
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
          {["Mark your farm on the map", "Show what you grow, and where", "Mark your sheds, fuel tanks and pumps", "Add your name and mobile"].map((t, i) => (
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
  // Editing an existing farm starts from its saved corners, not from nothing.
  const [draft, setDraftRaw] = useState<LatLng[]>(() => (step === 0 ? profile.boundary : []))
  // Every change (tap, drag, remove, add) is one step back for Undo.
  const [past, setPast] = useState<LatLng[][]>([])
  const setDraft = (d: LatLng[]) => {
    setPast([...past, draft])
    setDraftRaw(d)
  }
  const undo = () => {
    setDraftRaw(past[past.length - 1] ?? [])
    setPast(past.slice(0, -1))
  }
  // A paddock being reshaped ("Change shape"), so Done replaces it instead of adding a new one.
  const [editing, setEditing] = useState<string>()
  const [crop, setCrop] = useState<CropId>()
  const [kind, setKind] = useState<ItemId>()
  // "Something else": the farmer types what it is before drawing it.
  const [otherName, setOtherName] = useState("")
  const [error, setError] = useState<string>()
  const [flyTo, setFlyTo] = useState<LatLng>()
  const update = (patch: Partial<Profile>) => setProfile({ ...profile, ...patch })
  const go = (n: number) => {
    setDraftRaw(n === 0 ? profile.boundary : [])
    setPast([])
    setEditing(undefined)
    setCrop(undefined)
    setKind(undefined)
    setError(undefined)
    setStep(n)
  }
  // Keep the map still while the farmer taps: frame the farm once it exists, otherwise the lower Richmond demo area.
  const view = profile.boundary.length >= 3 ? profile.boundary : DEMO

  const onMapClick = (p: LatLng, zoom: number) => {
    setError(undefined)
    // Zoomed out over the whole valley, one tap spans hundreds of metres: ask for a closer look first.
    if (zoom < 14) return setError("Zoom in closer to your farm first (use + or the search), then tap.")
    if (step === 0 || (step === 1 && crop)) setDraft(insertCorner(draft, p))
    if (step === 2 && kind) {
      const spec = ITEMS[kind]
      update({ items: [...profile.items, { id: uid(), kind, at: p, hours: spec.hours }] })
    }
  }

  const finishBoundary = () => {
    if (gridInPolygon(draft).points.length < 4) return setError("That's too small to read. Mark an area at least 100 m across.")
    // Keep the paddocks and things already marked: changing the boundary shouldn't wipe them.
    update({ boundary: draft })
    go(1)
  }
  const finishPaddock = (poly = draft) => {
    if (!crop || poly.length < 3) return
    if (crop === "other" && !otherName.trim()) return setError("Type what it is first.")
    const name = crop === "other" ? otherName.trim() : undefined
    update({
      paddocks: editing
        ? profile.paddocks.map((x) => (x.id === editing ? { ...x, crop, poly, name } : x))
        : [...profile.paddocks, { id: uid(), crop, poly, planted: CROPS[crop].months ? new Date().toISOString().slice(0, 7) : undefined, name }],
    })
    setOtherName("")
    setDraftRaw([])
    setPast([])
    setEditing(undefined)
    setCrop(undefined)
  }

  const drawing = step === 0 || (step === 1 && !!crop)
  const reshape = (id: string) => {
    const p = profile.paddocks.find((x) => x.id === id)
    if (!p) return
    setCrop(p.crop)
    setOtherName(p.name ?? "")
    setEditing(id)
    setDraftRaw(p.poly)
    setPast([])
  }
  const shapes = profile.paddocks.filter((p) => p.id !== editing).map((p) => ({ id: p.id, poly: p.poly, color: CROPS[p.crop].color, label: `${cropLabel(p)} · ${areaHa(p.poly).toFixed(1)} ha` }))
  const pins: Pin[] = profile.items.map((it) => ({ id: it.id, at: it.at, svg: SVG[it.kind], label: ITEMS[it.kind].label }))
  const hint =
    step === 0
      ? draft.length === 0
        ? "Zoom in to your farm, then tap its first corner."
        : draft.length < 3
          ? `Corner ${draft.length} placed. Tap the next corner (at least 3).`
          : `${areaHa(draft).toFixed(1)} hectares. Drag a corner to move it, or press Done.`
      : step === 1
        ? crop
          ? crop === "other" && !otherName.trim()
            ? "Type what it is, then tap its corners."
            : draft.length >= 3
              ? `${areaHa(draft).toFixed(1)} hectares. Drag a corner to move it, or press Done.`
              : `Tap the corners of your ${(crop === "other" ? otherName.trim() : CROPS[crop].label).toLowerCase()} paddock.`
          : profile.paddocks.length
            ? "Pick a crop, then tap its paddock. Tap a paddock to change or remove it."
            : "Pick a crop, then tap its paddock on the map."
        : step === 2
          ? kind
            ? `Tap where your ${ITEMS[kind].label.toLowerCase()} is.`
            : profile.items.length
              ? "Pick something, then tap where it is. Tap a pin to remove it."
              : "Pick something, then tap where it is."
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
                onDraftChange={drawing ? setDraft : undefined}
                onEditShape={step === 1 && !crop ? reshape : undefined}
                noOutline={step === 0}
                // No farm yet: open on the whole lower Richmond so the farmer can find theirs.
                fitMaxZoom={profile.boundary.length >= 3 ? 15 : 12}
                shapes={step > 0 ? shapes : undefined}
                pins={step === 2 ? pins : undefined}
                onMapClick={drawing || kind ? onMapClick : undefined}
                // With nothing picked, tapping a pin or paddock offers to remove it.
                onRemove={
                  step === 1 && !crop
                    ? (id) => update({ paddocks: profile.paddocks.filter((x) => x.id !== id) })
                    : step === 2 && !kind
                      ? (id) => update({ items: profile.items.filter((x) => x.id !== id) })
                      : undefined
                }
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
              <ol className="mt-4 space-y-2 text-muted-foreground">
                <li>1. Search for your road or town, or zoom in on the map.</li>
                <li>2. Tap each corner of your farm's boundary. The area fills in as you go.</li>
                <li>3. Drag a numbered dot to move it. Tap a dot to remove it. Tap a small + to add a corner between two.</li>
              </ol>
              <Find onFound={setFlyTo} />
              <DrawButtons draft={draft} canUndo={past.length > 0} onUndo={undo} onClear={() => setDraft([])} onDone={finishBoundary} doneLabel={profile.boundary.length >= 3 ? "Save boundary" : "Done"} />
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
                  <button key={c} onClick={() => (setCrop(c), setDraftRaw([]), setPast([]), setEditing(undefined))} className={cn(chip, crop === c ? "border-ink bg-ink text-paper" : "border-rule hover:bg-paper-2")}>
                    <i className="inline-block size-3 rounded-full" style={{ background: CROPS[c].color }} />
                    {CROPS[c].label}
                  </button>
                ))}
              </div>
              {crop && (
                <div className="mt-4 rounded-2xl bg-paper-2 p-4">
                  {crop === "other" && (
                    <label className="grid gap-2">
                      <span className="text-sm text-muted-foreground">What is it?</span>
                      <input
                        value={otherName}
                        onChange={(e) => (setOtherName(e.target.value), setError(undefined))}
                        placeholder="e.g. Sweet potato, tea tree, dam"
                        autoFocus
                        className="rounded-xl border border-rule bg-card px-3 py-2"
                      />
                    </label>
                  )}
                  {editing && <p className="mb-2 text-sm text-muted-foreground">Changing this paddock's shape. Drag its corners, then press Save.</p>}
                  <DrawButtons draft={draft} canUndo={past.length > 0} onUndo={undo} onClear={() => setDraft([])} onDone={() => finishPaddock()} doneLabel={editing ? "Save" : "Done"} />
                  {error && <p role="alert" className="mt-3 rounded-xl bg-flood px-4 py-2 text-sm text-white">{error}</p>}
                  {profile.paddocks.length === 0 && (
                    <button onClick={() => finishPaddock(profile.boundary)} className="mt-3 text-sm text-leaf hover:underline">
                      My whole farm is {(crop === "other" ? otherName.trim() || "something else" : CROPS[crop].label).toLowerCase()}
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
              <p className="mt-3 text-muted-foreground">
                Mark the things that stay put. No need to add your tractor or stock: they move every day, so Draki tells you which paddocks flood and you
                move whatever is there.
              </p>
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

type Hit = { lat: string; lon: string; display_name: string; type: string; class: string }

/**
 * Find an address, road or town and jump the map there. OpenStreetMap Nominatim: free, light use (one search per press, no
 * autocomplete, per its usage policy), attribution in the footer. Results near the Northern Rivers come first, not Broadwater WA.
 */
function Find({ onFound }: { onFound: (p: LatLng) => void }) {
  const [q, setQ] = useState("")
  const [hits, setHits] = useState<Hit[]>()
  const [msg, setMsg] = useState<string>()
  const pick = (h: Hit) => {
    onFound([+h.lat, +h.lon])
    setHits(undefined)
    // Rural house numbers are mostly missing from the map data, so an address often lands on its road.
    setMsg(/\d/.test(q) && h.class === "highway" ? "We found the road, not the house number. Zoom in to your farm along it." : undefined)
  }
  const search = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!q.trim()) return
    setHits(undefined)
    setMsg("Searching…")
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=au&viewbox=152.8,-28.4,153.8,-29.5&q=${encodeURIComponent(q)}`
      const found: Hit[] = await (await fetch(url)).json()
      if (!found.length) return setMsg("Couldn't find that. Try the road name and town, e.g. Rileys Hill Road, Broadwater.")
      setMsg(undefined)
      if (found.length === 1) pick(found[0])
      else setHits(found)
    } catch {
      setMsg("Search isn't working right now. Zoom the map by hand.")
    }
  }
  return (
    <form onSubmit={search} className="mt-5">
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Address, road or town"
          aria-label="Find your farm by address"
          autoComplete="street-address"
          className="min-w-0 flex-1 rounded-full border border-rule bg-card px-4 py-3"
        />
        <button className={cn(btn, "bg-ink text-paper hover:bg-ink-2")}>Find</button>
      </div>
      {hits && (
        <ul className="mt-2 divide-y divide-rule overflow-hidden rounded-2xl border border-rule bg-card" aria-label="Places found">
          {hits.map((h) => (
            <li key={`${h.lat},${h.lon}`}>
              <button type="button" onClick={() => pick(h)} className="w-full px-4 py-2.5 text-left text-sm hover:bg-paper-2">
                {h.display_name.replace(/, Australia$/, "")}
              </button>
            </li>
          ))}
        </ul>
      )}
      {msg && <p className="mt-2 text-sm text-muted-foreground">{msg}</p>}
    </form>
  )
}

function DrawButtons(props: { draft: LatLng[]; canUndo: boolean; onUndo: () => void; onClear: () => void; onDone: () => void; doneLabel: string }) {
  const { draft, canUndo, onUndo, onClear, onDone, doneLabel } = props
  return (
    <div className="mt-5 flex flex-wrap gap-2">
      <button onClick={onUndo} disabled={!canUndo} className={cn(btn, "border border-rule hover:bg-card")}>
        <Undo2 className="size-4" aria-hidden /> Undo
      </button>
      <button onClick={onClear} disabled={!draft.length} className={cn(btn, "border border-rule hover:bg-card")}>
        Start over
      </button>
      <button onClick={onDone} disabled={draft.length < 3} className={cn(btn, "bg-cane text-ink hover:bg-[#e2b84a]")}>
        <Check className="size-4" aria-hidden /> {doneLabel}
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
            {p.crop === "other" ? (
              <span className="flex flex-1 items-center gap-2">
                <input
                  value={p.name ?? ""}
                  onChange={(e) => set(p.id, { name: e.target.value })}
                  placeholder="What is it?"
                  aria-label="What this paddock is"
                  className="w-40 rounded-lg border border-rule bg-paper px-2 py-1"
                />
                · {areaHa(p.poly).toFixed(1)} ha
              </span>
            ) : (
              <span className="flex-1">
                {cropLabel(p)} · {areaHa(p.poly).toFixed(1)} ha
              </span>
            )}
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
  const paddocks = profile.paddocks.map((p) => ({ p, ...paddockRisk(p, cells ?? [], stepM) }))
  const wetPaddocks = paddocks.filter((x) => x.floodedHa > 0)
  const paddockName = (p: Paddock) => `${cropLabel(p).split(" /")[0].toLowerCase()} paddock`
  const atRisk = paddocks.reduce((s, x) => s + x.atRisk, 0)
  const shed = items.find((x) => (x.it.kind === "shed" || x.it.kind === "house") && x.depth !== undefined && !isWet(x.depth))
  // The highest dry ground on the farm, pinned as Safe ground (only if there's enough of it to use).
  const high = cells ? safeGround(cells, stepM) : undefined
  const safePlace = shed ? `your ${ITEMS[shed.it.kind].label.toLowerCase()}, which stays dry` : high ? "the safe ground on your map" : "higher ground off the floodplain"
  const ha = areaHa(profile.boundary)
  const name = profile.name.trim()

  const pins: Pin[] = [
    ...((wet.length || wetPaddocks.length) && high && !shed ? [{ id: "safe", at: [high.lat, high.lng] as LatLng, svg: SAFE_SVG, label: "Safe ground: highest dry spot" }] : []),
    ...items.map(({ it, depth }) => ({
    id: it.id,
    at: it.at,
    svg: SVG[it.kind],
    label: `${ITEMS[it.kind].label}${depth !== undefined && depth >= KNOBS.floodedDepth ? ` · under ${depth >= 2 ? "more than 2" : depth.toFixed(1)} m of water` : " · stays dry"}`,
    wet: isWet(depth),
  })),
  ]
  const shapes = profile.paddocks.map((p) => ({ id: p.id, poly: p.poly, color: CROPS[p.crop].color, label: cropLabel(p) }))
  const fuel = profile.items.map((it) => ({ it, f: fuelYear(it) })).filter((x) => x.f && x.f.litres > 0)
  const cane = paddocks.filter((x) => x.p.crop === "cane")
  const record = farm.replayRun?.cells
  const firstUnder = record
    ? profile.paddocks.map((p) => ({ p, ...paddockRisk(p, record, stepM) })).sort((a, b) => b.floodedHa - a.floodedHa)[0]
    : undefined
  const ready = profile.paddocks.map((p) => ({ p, d: readyDate(p) })).filter((x) => x.d).sort((a, b) => +a.d! - +b.d!)

  const texts = [
    wet.length || wetPaddocks.length
      ? `Draki: FLOOD WARNING${name ? `, ${name}` : ""}.${wetPaddocks.length ? ` Your ${list(wetPaddocks.map((x) => paddockName(x.p)))} ${wetPaddocks.length === 1 ? "goes" : "go"} under. Move any machinery or stock parked there to ${safePlace} before the river peaks.` : ""}${wet.map((x) => ` Your ${ITEMS[x.it.kind].label.toLowerCase()} will flood: ${ITEMS[x.it.kind].prep}.`).join("")}`
      : `Draki: ${name ? `${name}, n` : "N"}othing on your farm is in the water's way. Draki keeps watching the river.`,
    cane.length && cane[0].floodedHa > 0
      ? `Draki: ${cane[0].floodedHa.toFixed(1)} of your ${cane[0].ha.toFixed(1)} ha of cane could go under. Hold off fertilising the low rows.`
      : undefined,
    ready[0] ? `Draki: your ${cropLabel(ready[0].p).toLowerCase()} (${areaHa(ready[0].p.poly).toFixed(0)} ha) is ready from ${monthYear(ready[0].d!)}.` : undefined,
    `Draki: why this matters more now. Very heavy rain days at Woodburn have gone from about ${DECADES.then.toFixed(1)} a year in the 1990s to ${DECADES.now.toFixed(1)}. Warmer air holds more water.`,
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
          loading ? "bg-paper-2" : wet.length || wetPaddocks.length ? "bg-flood text-white" : "bg-leaf text-white",
        )}
      >
        {!loading && (wet.length || wetPaddocks.length ? <AlertTriangle className="size-6" aria-hidden /> : <Check className="size-6" aria-hidden />)}
        <p className="text-2xl">
          {loading
            ? "Reading your farm…"
            : wet.length || wetPaddocks.length
              ? [
                  wetPaddocks.length && `${wetPaddocks.length} paddock${wetPaddocks.length === 1 ? "" : "s"} under water`,
                  wet.length && `${wet.length} thing${wet.length === 1 ? "" : "s"} to prepare`,
                  atRisk && `${aud(atRisk)} of crops`,
                ]
                  .filter(Boolean)
                  .join(", ")
              : scenario === "week"
                  ? "This week, nothing on your farm floods."
                  : "Your farm stays dry."}
        </p>
        {scenario === "week" && !loading && !wet.length && !wetPaddocks.length && (
          <button onClick={() => setScenario("common")} className="ml-auto text-sm underline underline-offset-4">
            See what a flood would do
          </button>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        <div className="relative overflow-hidden rounded-3xl border border-rule lg:col-span-7 lg:row-span-2">
          <div className="h-[460px] lg:h-full lg:min-h-[600px]">
            <FieldMap poly={profile.boundary} cells={cells ?? []} stepM={stepM} shapes={shapes} pins={pins} wetOnly
              runKey={scenario}
              flyTo={focus}
              flyZoom={16}
              legend={
                <>
                  <span className="flex items-center gap-2">
                    <i className="size-3 rounded-sm bg-flood" /> Under water
                  </span>
                  <span className="flex items-center gap-2">
                    <i className="size-3 rounded-full bg-flood ring-2 ring-white" /> Floods: prepare it
                  </span>
                </>
              }
            />
          </div>
        </div>

        <div className={cn(card, "lg:col-span-5")}>
          <h2 className="text-2xl">Before the water comes</h2>
          <ul className="mt-4 divide-y divide-rule">
            <li className="flex items-center gap-3 py-3">
              <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", wetPaddocks.length ? "bg-flood text-white" : "bg-paper-2 text-leaf")}>
                <Tractor className="size-4" aria-hidden />
              </span>
              <span className="flex-1">
                Machinery and stock
                <span className="block text-sm text-muted-foreground">
                  {wetPaddocks.length
                    ? `Move anything in your ${list(wetPaddocks.map((x) => paddockName(x.p)))} to ${safePlace}.`
                    : "Nothing you park on your paddocks is in the water's way."}
                </span>
              </span>
            </li>
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
                    {depth === undefined ? "off your farm" : w ? `floods · ${deep}` : "stays dry"}
                  </span>
                  </button>
                </li>
              )
            })}
          </ul>
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
                    {cropLabel(p)} · {ha.toFixed(1)} ha
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

        <div className={cn(card, "lg:col-span-5")}>
          <h2 className="text-2xl">Your texts</h2>
          <p className="mt-1 text-sm text-muted-foreground">{profile.phone ? `To ${profile.phone}` : "Any phone, no app"}</p>
          <Phone className="mt-4" msgs={texts.map((text) => ({ text }))} stamp={SCENARIO[scenario].toLowerCase()} />
        </div>

        <div className={cn(card, "lg:col-span-12")}>
          <div className="grid gap-8 md:grid-cols-12">
            <div className="md:col-span-5">
              <h2 className="text-2xl">Your climate</h2>
              <p className="mt-1 text-sm text-muted-foreground">What's changing here, and what it means for your farm.</p>
              <ol className="mt-4 divide-y divide-rule">
                {[
                  [
                    "Very heavy rain days have nearly tripled here.",
                    `Days with 50 mm or more of rain at Woodburn: about ${DECADES.then.toFixed(1)} a year in the 1990s, ${DECADES.now.toFixed(1)} in 2016–25. That's a small number of days, so read it as a sign, not proof.`,
                  ],
                  ["Why: warmer air holds more water.", "Each 1 °C of warming lets the air hold about 7% more moisture, so the same storm can drop more rain (IPCC, 2021)."],
                  ...(season
                    ? [
                        season.latest.phase === "elnino"
                          ? [
                              "El Niño is under way this season.",
                              `El Niño seasons here average ${season.phases.elnino.meanRain.toLocaleString("en-AU")} mm of rain, against ${season.phases.lanina.meanRain.toLocaleString("en-AU")} mm in La Niña seasons. Expect a drier run: keep the trash blanket on and check your pump.`,
                            ]
                          : ["No El Niño this season.", "Draki watches the rain and the river all season, and texts you when that changes."],
                      ]
                    : []),
                  firstUnder && firstUnder.floodedHa > 0
                    ? [
                        "What it means for your farm.",
                        `In a 2022-size flood your ${cropLabel(firstUnder.p).toLowerCase()} paddock goes under first: ${firstUnder.floodedHa >= firstUnder.ha - 0.05 ? `all ${firstUnder.ha.toFixed(1)} ha` : `${firstUnder.floodedHa.toFixed(1)} of its ${firstUnder.ha.toFixed(1)} ha`}. With heavy rain getting more common, plan where machinery and stock go now, not on the day.`,
                      ]
                    : ["What it means for your farm.", "In a 2022-size flood your paddocks stay dry. Draki still watches the river for you all season."],
                ].map(([t, d], i) => (
                  <li key={t} className="flex gap-4 py-3">
                    <span className="font-display text-xl text-leaf">{i + 1}</span>
                    <span>
                      <span className="font-medium">{t}</span> <span className="text-muted-foreground">{d}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            <figure className="md:col-span-7">
              <HeavyRainChart />
              <figcaption className="mt-2 text-sm text-muted-foreground">Days a year with 50 mm or more of rain at Woodburn, 1991–2025. ERA5, the European long-term weather record, via Open-Meteo.</figcaption>
            </figure>
          </div>
        </div>

        <div className={cn(card, "lg:col-span-12")}>
          <FloodRecord farm={farm} profile={profile} />
        </div>

        <div className={cn(card, "lg:col-span-12")}>
          <h2 className="text-2xl">Worth knowing</h2>
          <ul className="mt-4 grid gap-x-10 md:grid-cols-2 [&>li]:border-t [&>li]:border-rule">
            {fuel.map(({ it, f }) => (
              <li key={it.id} className="py-3">
                <span className="font-medium">
                  Your {ITEMS[it.kind].label.toLowerCase()} burns about {Math.round(f!.litres).toLocaleString("en-AU")} L of diesel a year ({aud(f!.cost)}).
                </span>{" "}
                <span className="text-muted-foreground">{f!.swap ? `Switching to ${f!.swap} saves that fuel.` : "No practical electric option yet. Keep it tuned."}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

const centre = (poly: LatLng[]): LatLng => [poly.reduce((a, p) => a + p[0], 0) / poly.length, poly.reduce((a, p) => a + p[1], 0) / poly.length]

/** This week's weather at the farm: what a farmer checks every day. */
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
                {cropLabel(p)}
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
