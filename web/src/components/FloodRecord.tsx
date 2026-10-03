import { createPortal } from "react-dom"
import { Printer } from "lucide-react"
import { FarmSketch } from "@/components/FarmSketch"
import { aud, type Farm } from "@/Live"
import { areaHa, cropLabel, CROPS, itemDepth, ITEMS, paddockRisk, type Profile } from "@/lib/farm"
import { KNOBS } from "@/lib/flood"
import { cn } from "@/lib/utils"

const longDate = (d: string | Date) => new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })
const depth = (d: number) => (d >= 2 ? "2 m+" : `${d.toFixed(1)} m`)

/** Everything the record says, worked out once for the card and the printed page. */
function useRecord(farm: Farm, profile: Profile) {
  const run = farm.replayRun
  const cells = run?.cells ?? []
  const stepM = farm.elev?.stepM ?? 30
  const paddocks = profile.paddocks.map((p) => ({ p, ...paddockRisk(p, cells, stepM) }))
  const items = profile.items.map((it) => ({ it, d: itemDepth(it, cells, stepM) }))
  return {
    ready: !!run,
    cells,
    stepM,
    paddocks,
    items,
    under: paddocks.reduce((s, x) => s + x.floodedHa, 0),
    deepest: Math.max(0, ...paddocks.map((x) => x.maxDepth)),
    atRisk: paddocks.reduce((s, x) => s + x.atRisk, 0),
    peak: run?.river?.day,
    stage: run?.river?.stage,
    q: run?.river?.q,
  }
}

function Sketch({ profile, rec }: { profile: Profile; rec: ReturnType<typeof useRecord> }) {
  return (
    <FarmSketch
      boundary={profile.boundary}
      paddocks={profile.paddocks.map((p) => ({ poly: p.poly, color: CROPS[p.crop].color }))}
      cells={rec.cells}
      stepM={rec.stepM}
      items={rec.items.map(({ it, d }) => ({ at: it.at, wet: (d ?? 0) >= KNOBS.floodedDepth }))}
    />
  )
}

function Table({ rec }: { rec: ReturnType<typeof useRecord> }) {
  return (
    <table className="w-full text-left text-sm">
      <thead className="text-muted-foreground">
        <tr className="border-b border-rule">
          <th className="py-2 pr-3 font-normal">Paddock</th>
          <th className="py-2 pr-3 text-right font-normal">Area</th>
          <th className="py-2 pr-3 text-right font-normal">Under water</th>
          <th className="py-2 pr-3 text-right font-normal">Deepest</th>
          <th className="py-2 text-right font-normal">Crop value</th>
        </tr>
      </thead>
      <tbody className="tabular-nums">
        {rec.paddocks.map(({ p, ha, floodedHa, maxDepth, atRisk }) => (
          <tr key={p.id} className="border-b border-rule">
            <td className="py-2 pr-3">
              <i className="mr-2 inline-block size-2.5 rounded-full align-middle" style={{ background: CROPS[p.crop].color }} />
              {cropLabel(p)}
            </td>
            <td className="py-2 pr-3 text-right">{ha.toFixed(1)} ha</td>
            <td className={cn("py-2 pr-3 text-right", floodedHa > 0 && "font-medium text-flood")}>{floodedHa.toFixed(1)} ha</td>
            <td className="py-2 pr-3 text-right">{floodedHa > 0 ? depth(maxDepth) : "–"}</td>
            <td className="py-2 text-right">{atRisk ? aud(atRisk) : "–"}</td>
          </tr>
        ))}
        {rec.items
          .filter(({ d }) => (d ?? 0) >= KNOBS.floodedDepth)
          .map(({ it, d }) => (
            <tr key={it.id} className="border-b border-rule">
              <td className="py-2 pr-3" colSpan={3}>
                {ITEMS[it.kind].label}
              </td>
              <td className="py-2 pr-3 text-right">{depth(d!)}</td>
              <td className="py-2 text-right text-muted-foreground">under water</td>
            </tr>
          ))}
      </tbody>
    </table>
  )
}

/**
 * A flood record for a disaster grant or insurance claim: date, hectares, depth, value, per paddock.
 * Shown as a card on My farm; "Print" prints only the record (see #print-root in index.css).
 */
export function FloodRecord({ farm, profile }: { farm: Farm; profile: Profile }) {
  const rec = useRecord(farm, profile)
  const name = profile.name.trim()
  const n = profile.boundary.length
  const centre = n ? [profile.boundary.reduce((s, p) => s + p[0], 0) / n, profile.boundary.reduce((s, p) => s + p[1], 0) / n] : [0, 0]
  const stats = [
    [`${rec.under.toFixed(1)} ha`, "under water"],
    [rec.deepest ? depth(rec.deepest) : "–", "deepest water"],
    [rec.atRisk ? aud(rec.atRisk) : "–", "crop value under water"],
  ]

  return (
    <>
      <div className="grid gap-8 md:grid-cols-12">
        <div className="md:col-span-4">
          <div className="rounded-2xl bg-paper-2 p-4">{rec.ready ? <Sketch profile={profile} rec={rec} /> : <div className="aspect-square" />}</div>
          <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <i className="inline-block size-2.5 rounded-sm bg-flood" /> Under water at the peak
          </p>
        </div>
        <div className="md:col-span-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl">Flood record</h2>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                What Draki would have recorded on your farm in the February 2022 flood{rec.peak ? `, peak ${longDate(rec.peak)}` : ""}. Print it to back up a
                disaster grant or insurance claim.
              </p>
            </div>
            <button onClick={() => print()} disabled={!rec.ready} className="press inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-medium text-paper hover:bg-ink-2 disabled:opacity-40">
              <Printer className="size-4" aria-hidden /> Print flood record
            </button>
          </div>
          <dl className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-3">
            {stats.map(([v, k]) => (
              <div key={k} className="flex flex-col-reverse justify-end gap-2 border-t border-ink pt-3">
                <dt className="text-sm text-muted-foreground">{k}</dt>
                <dd className="font-display text-[clamp(1.4rem,2.2vw,2.25rem)] leading-none whitespace-nowrap tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-6 overflow-x-auto">
            <Table rec={rec} />
          </div>
        </div>
      </div>

      {/* The printed page: only this shows on paper. */}
      {createPortal(
        <div id="print-root" className="text-ink">
          <div className="flex items-start justify-between border-b-2 border-ink pb-4">
            <div>
              <p className="font-display text-3xl uppercase">Draki · Flood record</p>
              <p className="mt-1 text-sm">{name ? `${name}'s farm` : "Farm"} · {areaHa(profile.boundary).toFixed(1)} ha · centre {centre[0].toFixed(5)}, {centre[1].toFixed(5)}</p>
            </div>
            <p className="text-right text-sm">
              Printed {longDate(new Date())}
              {profile.phone && <span className="block">{profile.phone}</span>}
            </p>
          </div>
          <p className="mt-4 text-sm">
            <strong>Event:</strong> Richmond River flood{rec.peak ? `, peak ${longDate(rec.peak)}` : ""}
            {rec.stage !== undefined && rec.q !== undefined && ` · river about ${rec.stage.toFixed(1)} m above normal, ${Math.round(rec.q).toLocaleString("en-AU")} m³/s`}
          </p>
          <div className="mt-5 grid grid-cols-[38%_1fr] gap-6">
            <div>
              {rec.ready && <Sketch profile={profile} rec={rec} />}
              <p className="mt-1 text-xs">Red: 30 m squares under at least {KNOBS.floodedDepth} m of water at the peak. North is up.</p>
            </div>
            <div>
              <dl className="grid grid-cols-3 gap-4">
                {stats.map(([v, k]) => (
                  <div key={k} className="border-t border-ink pt-2">
                    <dd className="text-2xl font-semibold">{v}</dd>
                    <dt className="text-xs">{k}</dt>
                  </div>
                ))}
              </dl>
              <div className="mt-4">
                <Table rec={rec} />
              </div>
            </div>
          </div>
          <p className="mt-6 border-t border-rule pt-3 text-xs leading-relaxed">
            How this was worked out: Draki models each 30 m square of the farm from Copernicus GLO-30 elevation (height above the river), GloFAS v4 river
            flow and ERA5 rain, and was checked against Sentinel-1 satellite radar of this flood (72% overlap, square by square, on 2 March 2022). Crop
            values use the figures entered for each paddock (cane: {aud(KNOBS.caneValuePerHa)} per hectare, NSW DPI). This is a modelled estimate to support
            a claim, not a loss assessment: attach photos, receipts and your own records. Disaster help: disasterassist.gov.au.
          </p>
        </div>,
        document.body,
      )}
    </>
  )
}
