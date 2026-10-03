import { KNOBS, type Cell, type LatLng } from "@/lib/flood"
import { cn } from "@/lib/utils"

const M_PER_DEG = 111_320

/**
 * The farm drawn as a plain map: paddocks in crop colours, the 30 m squares that go under in flood red, fixed things as dots.
 * Pure SVG, so it prints sharp on a flood record and needs no map tiles.
 */
export function FarmSketch({
  boundary,
  paddocks = [],
  cells = [],
  stepM = 30,
  items = [],
  className,
}: {
  boundary: LatLng[]
  paddocks?: { poly: LatLng[]; color: string }[]
  cells?: Cell[]
  stepM?: number
  items?: { at: LatLng; wet: boolean }[]
  className?: string
}) {
  if (boundary.length < 3) return null
  const lats = boundary.map((p) => p[0])
  const lngs = boundary.map((p) => p[1])
  const cos = Math.cos((((Math.min(...lats) + Math.max(...lats)) / 2) * Math.PI) / 180)
  // Metres east / north from the farm's south-west corner; north is up.
  const x = (lng: number) => (lng - Math.min(...lngs)) * M_PER_DEG * cos
  const y = (lat: number) => (Math.max(...lats) - lat) * M_PER_DEG
  const W = x(Math.max(...lngs))
  const H = y(Math.min(...lats))
  const pad = Math.max(W, H) * 0.04
  const pts = (poly: LatLng[]) => poly.map(([la, ln]) => `${x(ln).toFixed(1)},${y(la).toFixed(1)}`).join(" ")
  const half = stepM / 2
  return (
    <svg viewBox={`${-pad} ${-pad} ${W + 2 * pad} ${H + 2 * pad}`} className={cn("w-full", className)} role="img" aria-label="Sketch of the farm: paddocks, and the squares that go under water in red">
      <polygon points={pts(boundary)} fill="#e9e2d2" stroke="#13211a" strokeWidth={W / 220} />
      {paddocks.map((p, i) => (
        <polygon key={i} points={pts(p.poly)} fill={p.color} fillOpacity={0.35} stroke={p.color} strokeWidth={W / 300} />
      ))}
      {cells
        .filter((c) => c.depth >= KNOBS.floodedDepth)
        .map((c) => (
          <rect
            key={`${c.lat},${c.lng}`}
            x={x(c.lng) - half}
            y={y(c.lat) - half}
            width={stepM}
            height={stepM}
            fill="#d4472a"
            fillOpacity={0.35 + Math.min(c.depth, 2) * 0.25}
          />
        ))}
      {items.map((it, i) => (
        <circle key={i} cx={x(it.at[1])} cy={y(it.at[0])} r={W / 45} fill={it.wet ? "#d4472a" : "#2f5e3d"} stroke="#fbf8f1" strokeWidth={W / 200} />
      ))}
      <polygon points={pts(boundary)} fill="none" stroke="#13211a" strokeWidth={W / 220} />
    </svg>
  )
}
