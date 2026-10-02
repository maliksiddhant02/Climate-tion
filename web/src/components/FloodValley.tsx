import { useEffect, useRef, useState, type ReactNode } from "react"
import { ArrowDown, ArrowRight } from "lucide-react"
import { riverStage } from "@/lib/flood"
import { loadRegion, type Region } from "@/lib/region"

// The Home hero: the real lower Richmond floodplain, NSW (Copernicus GLO-30, 30 m) drawn as shaded terrain, with the
// Richmond River rising as the visitor scrolls, from normal flow to the February 2022 peak. Every pixel is our model's own data.

const TOWN = [-29.0717, 153.3408] as const // Woodburn
const NORMAL_Q = 30 // m³/s, a typical dry-season flow
const IN_BANKS = 0.12 // share of the scroll spent showing the river still inside its banks

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
// WorldCover class → land colour (night-time palette, lit by the hillshade).
const LAND: Record<number, number[]> = {
  10: rgb("#22402a"), // trees
  20: rgb("#3a4a2c"), // shrubs
  30: rgb("#4a6a34"), // grassland (where WorldCover puts most sugarcane)
  40: rgb("#55703a"), // cropland
  50: rgb("#77756c"), // built-up: Woodburn, Coraki, Broadwater
  60: rgb("#7a6a4f"), // bare
  80: rgb("#2c5f9e"), // permanent water: the river and the sea
  90: rgb("#2b4a3a"), // wetland
  95: rgb("#1f3b30"), // mangroves
}
const SHALLOW = rgb("#8fbcf0")
const DEEP = rgb("#1d4f94")

// The data is a 30 m grid. Drawn square by square it looks blocky, so for display only we soften it (a 3x3 blur takes the
// speckle out of the surface model and the land-cover mosaic), draw it at twice the resolution with bilinear interpolation,
// and feather the shoreline. The hectare count still comes from the raw, unsmoothed cells.
const UP = 2
const FEATHER_M = 0.3 // the water's edge fades in over this much height

type Prepared = { region: Region; w: number; h: number; base: Uint8ClampedArray; hand: Float32Array; sortedHand: Float32Array; cellHa: number }

/** 3x3 box blur of one channel. */
function blur(src: Float32Array, w: number, h: number) {
  const out = new Float32Array(src.length)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let sum = 0
      let n = 0
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx
          const yy = y + dy
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue
          sum += src[yy * w + xx]
          n++
        }
      out[y * w + x] = sum / n
    }
  return out
}

/** Bilinear upsample of one channel by UP. */
function upsample(src: Float32Array, w: number, h: number) {
  const W = w * UP
  const H = h * UP
  const out = new Float32Array(W * H)
  for (let Y = 0; Y < H; Y++) {
    const fy = Math.min(h - 1, Math.max(0, (Y + 0.5) / UP - 0.5))
    const y0 = Math.floor(fy)
    const y1 = Math.min(h - 1, y0 + 1)
    const ty = fy - y0
    for (let X = 0; X < W; X++) {
      const fx = Math.min(w - 1, Math.max(0, (X + 0.5) / UP - 0.5))
      const x0 = Math.floor(fx)
      const x1 = Math.min(w - 1, x0 + 1)
      const tx = fx - x0
      const top = src[y0 * w + x0] * (1 - tx) + src[y0 * w + x1] * tx
      const bot = src[y1 * w + x0] * (1 - tx) + src[y1 * w + x1] * tx
      out[Y * W + X] = top * (1 - ty) + bot * ty
    }
  }
  return out
}

function prepare(region: Region): Prepared {
  const { width: w, height: h, res } = region.meta
  const dx = res * 111_320 * Math.cos(((region.meta.bbox[1] + region.meta.bbox[3]) / 2) * (Math.PI / 180))
  const dy = res * 111_320
  const r = new Float32Array(w * h)
  const g = new Float32Array(w * h)
  const bl = new Float32Array(w * h)
  const hand = new Float32Array(w * h)
  const land: number[] = []
  const z = (xx: number, yy: number) => region.dem[Math.min(h - 1, Math.max(0, yy)) * w + Math.min(w - 1, Math.max(0, xx))] / 10
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      // Hillshade, sun from the north-west, terrain exaggerated 3x so the floodplain's low relief reads.
      const gx = ((z(x + 1, y) - z(x - 1, y)) / (2 * dx)) * 3
      const gy = ((z(x, y + 1) - z(x, y - 1)) / (2 * dy)) * 3
      const shade = Math.max(0.28, Math.min(1.25, (1 - gx * 0.7071 + gy * 0.7071) / Math.sqrt(1 + gx * gx + gy * gy)))
      const cls = region.land[i]
      const c = LAND[cls] ?? LAND[30]
      const lit = cls === 80 ? 1 : shade
      r[i] = c[0] * lit
      g[i] = c[1] * lit
      bl[i] = c[2] * lit
      // Permanent water is drawn by its land colour; give it height 0 so the blur doesn't drag banks underwater.
      hand[i] = cls === 80 ? 0 : region.hand[i] / 10
      if (cls !== 80) land.push(hand[i])
    }
  const W = w * UP
  const H = h * UP
  const [R, G, B, Hd] = [r, g, bl, hand].map((ch) => upsample(blur(ch, w, h), w, h))
  const base = new Uint8ClampedArray(W * H * 4)
  for (let i = 0; i < W * H; i++) {
    base[i * 4] = R[i]
    base[i * 4 + 1] = G[i]
    base[i * 4 + 2] = B[i]
    base[i * 4 + 3] = 255
  }
  return { region, w: W, h: H, base, hand: Hd, sortedHand: Float32Array.from(land).sort(), cellHa: (dx * dy) / 10_000 }
}

// Valley-wide areas read better in km² (100 hectares) than in hectares.
const km2 = (ha: number) => (ha < 1000 ? (ha / 100).toFixed(1) : Math.round(ha / 100).toLocaleString("en-AU"))

/** How many land cells sit below the water: binary search over the sorted heights. */
const below = (sorted: Float32Array, stage: number) => {
  let lo = 0
  let hi = sorted.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (sorted[mid] < stage) lo = mid + 1
    else hi = mid
  }
  return lo
}

function paint(ctx: CanvasRenderingContext2D, img: ImageData, p: Prepared, stage: number) {
  const out = img.data
  out.set(p.base)
  if (stage > 0)
    for (let i = 0; i < p.hand.length; i++) {
      const d = stage - p.hand[i]
      if (d <= -FEATHER_M) continue
      const e = Math.min(1, (d + FEATHER_M) / (2 * FEATHER_M)) // 0 → 1 across the shoreline
      const a = 0.9 * e * e * (3 - 2 * e) // smoothstep, so the edge has no hard step
      const t = Math.min(1, Math.max(0, d) / 4) // deeper water reads darker
      const o = i * 4
      out[o] = out[o] * (1 - a) + (SHALLOW[0] + (DEEP[0] - SHALLOW[0]) * t) * a
      out[o + 1] = out[o + 1] * (1 - a) + (SHALLOW[1] + (DEEP[1] - SHALLOW[1]) * t) * a
      out[o + 2] = out[o + 2] * (1 - a) + (SHALLOW[2] + (DEEP[2] - SHALLOW[2]) * t) * a
    }
  ctx.putImageData(img, 0, 0)
}

/** Where a lat/lng lands on screen when the canvas is drawn with object-fit: cover, centred. */
function coverPoint(canvas: HTMLCanvasElement, region: Region, [lat, lng]: readonly [number, number]) {
  const { width: cw, height: ch, bbox, res } = region.meta
  const W = canvas.clientWidth
  const H = canvas.clientHeight
  const s = Math.max(W / cw, H / ch)
  return { x: (W - cw * s) / 2 + ((lng - bbox[0]) / res) * s, y: (H - ch * s) / 2 + ((bbox[3] - lat) / res) * s }
}

export function FloodValley({ children }: { children: ReactNode }) {
  const section = useRef<HTMLElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [prep, setPrep] = useState<Prepared>()
  const [progress, setProgress] = useState(0)
  const [town, setTown] = useState<{ x: number; y: number }>()

  useEffect(() => {
    let live = true
    loadRegion()
      .then((r) => live && setPrep(prepare(r)))
      .catch(() => undefined) // no data: the storm photo underneath stays
    return () => {
      live = false
    }
  }, [])

  // Scroll position through the tall section drives the river.
  useEffect(() => {
    let frame = 0
    const on = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const el = section.current
        if (!el) return
        const r = el.getBoundingClientRect()
        const navH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--nav")) || 0
        setProgress(Math.min(1, Math.max(0, (navH - r.top) / Math.max(1, r.height - (innerHeight - navH)))))
      })
    }
    on()
    addEventListener("scroll", on, { passive: true })
    addEventListener("resize", on)
    return () => {
      cancelAnimationFrame(frame)
      removeEventListener("scroll", on)
      removeEventListener("resize", on)
    }
  }, [])

  const cal = prep?.region.meta.river
  const q = !cal ? 0 : progress < IN_BANKS ? NORMAL_Q + (cal.q2 - NORMAL_Q) * (progress / IN_BANKS) : cal.q2 + (cal.eventPeak - cal.q2) * ((progress - IN_BANKS) / (1 - IN_BANKS))
  const stage = cal ? riverStage(q, cal) : 0
  const ha = prep ? below(prep.sortedHand, stage) * prep.cellHa : 0

  useEffect(() => {
    const c = canvas.current
    if (!prep || !c) return
    const ctx = c.getContext("2d")
    if (!ctx) return
    const img = ctx.createImageData(prep.w, prep.h)
    paint(ctx, img, prep, stage)
  }, [prep, stage])

  useEffect(() => {
    const c = canvas.current
    if (!prep || !c) return
    const place = () => setTown(coverPoint(c, prep.region, TOWN))
    place()
    addEventListener("resize", place)
    return () => removeEventListener("resize", place)
  }, [prep])

  const phase = !cal ? "" : q < cal.q2 ? "In its banks" : q < cal.q5 ? "Over its banks: Watch" : progress < 0.995 ? "Act today" : "28 February 2022"

  return (
    <section ref={section} className="relative h-[280svh] bg-ink">
      <div className="sticky top-[var(--nav,0px)] h-[calc(100svh-var(--nav,0px))] overflow-hidden">
        <img src="/photos/storm-field.jpg" alt="" className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${prep ? "opacity-0" : "opacity-100"}`} />
        <canvas
          ref={canvas}
          width={prep?.w ?? 1}
          height={prep?.h ?? 1}
          role="img"
          aria-label="Map of the lower Richmond River floodplain in NSW. As you scroll, the river rises to its February 2022 peak and floods the low ground."
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${prep ? "opacity-100" : "opacity-0"}`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/30 to-ink/0" />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-ink/70 to-transparent" />

        {town && prep && (
          <div className="pointer-events-none absolute" style={{ left: town.x, top: town.y }}>
            <span className="absolute -translate-x-1/2 -translate-y-1/2 size-3 rounded-full border-2 border-white bg-cane" />
            <span className="absolute top-3 left-3 text-sm font-medium whitespace-nowrap text-white drop-shadow">Woodburn</span>
          </div>
        )}

        {prep && cal && (
          <div className="absolute top-5 right-6 w-52 rounded-2xl bg-ink/70 p-4 text-white backdrop-blur sm:w-64 sm:p-5 md:top-8 md:right-10 md:w-72" aria-live="polite">
            <p className="text-sm text-white/70">Richmond River</p>
            <p className="mt-1 font-display text-4xl leading-none tabular-nums sm:text-5xl">
              {Math.round(q).toLocaleString("en-AU")}
              <span className="ml-1 font-sans text-base font-normal tracking-normal text-white/70">m³/s</span>
            </p>
            <p className={`mt-3 inline-block rounded-full px-3 py-1 text-sm font-medium ${q >= cal.q5 ? "bg-flood text-white" : q >= cal.q2 ? "bg-cane text-ink" : "bg-white/15 text-white"}`}>{phase}</p>
            <dl className="mt-4 hidden grid-cols-2 gap-3 border-t border-white/15 pt-3 text-sm sm:grid">
              <div>
                <dt className="text-white/60">River level</dt>
                <dd className="tabular-nums">{stage > 0 ? `+${stage.toFixed(1)} m` : "Normal"}</dd>
              </div>
              <div>
                <dt className="text-white/60">Under water</dt>
                <dd className="tabular-nums">{km2(ha)} km²</dd>
              </div>
            </dl>
            {progress < 0.04 && <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-white/60">Scroll to raise the river <ArrowDown className="size-4" aria-hidden /></p>}
          </div>
        )}

        {/* The headline steps aside once the river starts rising, so the flood has the stage. */}
        <div style={{ opacity: Math.max(0, 1 - Math.max(0, progress - 0.06) / 0.12) }} className={progress > 0.2 ? "pointer-events-none" : ""}>
          {children}
        </div>

        {prep && cal && (
          <div
            className="absolute inset-x-0 bottom-0 px-6 pb-12 text-white transition-opacity duration-500 md:px-10 md:pb-16"
            style={{ opacity: progress > 0.9 ? 1 : 0 }}
            aria-hidden={progress <= 0.9}
          >
            <div className="mx-auto max-w-[1600px]">
              <p className="max-w-4xl font-display text-[clamp(2rem,4.6vw,4.75rem)] leading-[0.95]">
                {ha > 0 ? `${km2(ha)} km²` : ""} under water. <span className="text-cane">Which part is yours?</span>
              </p>
              <a href="#/live?replay" className="press mt-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-ink hover:bg-paper">
                See it field by field <ArrowRight className="size-4" aria-hidden />
              </a>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
