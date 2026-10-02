// FarmShield flood model. Pure functions, no imports, so `node src/lib/flood.check.ts` can run it.

export type LatLng = [number, number]

export type Cell = { lat: number; lng: number; elev: number; depth: number }

export type Level = "clear" | "watch" | "act"

const M_PER_DEG = 111_320

// Calibration knobs. Tune these against the Sentinel-1 backtest, not by feel.
export const KNOBS = {
  /** Share of rain on the field + upslope that ends up pooling on it (runoff coeff × catchment ratio). */
  pooling: 1.8,
  /** Rain (mm per 72 h) that soaks in or leaves through field drains before anything pools. */
  absorbedMm: 60,
  /** Water deeper than this (m) counts as "under water" for cane and machinery. */
  floodedDepth: 0.15,
  /** Cane value per hectare, F$. ~45 t/ha × F$85/t. Assumption, check against FSC / SRIF figures. */
  caneValuePerHa: 45 * 85,
}

export function inPolygon([lat, lng]: LatLng, poly: LatLng[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [yi, xi] = poly[i]
    const [yj, xj] = poly[j]
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** Regular grid of points inside the polygon, coarsened until it fits one elevation API call (100 points). */
export function gridInPolygon(poly: LatLng[], stepM = 30): { points: LatLng[]; stepM: number } {
  const lats = poly.map((p) => p[0])
  const lngs = poly.map((p) => p[1])
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)]
  const cos = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180)
  for (;;) {
    const dLat = stepM / M_PER_DEG
    const dLng = stepM / (M_PER_DEG * cos)
    const points: LatLng[] = []
    for (let lat = minLat + dLat / 2; lat < maxLat; lat += dLat)
      for (let lng = minLng + dLng / 2; lng < maxLng; lng += dLng)
        if (inPolygon([lat, lng], poly)) points.push([lat, lng])
    if (points.length <= 100) return { points, stepM }
    stepM *= 1.15
  }
}

/** Largest rain total (mm) over any `hours`-long window. */
export function maxRolling(hourly: number[], hours = 72): { total: number; start: number } {
  let best = { total: 0, start: 0 }
  let sum = 0
  hourly.forEach((v, i) => {
    sum += v || 0
    if (i >= hours) sum -= hourly[i - hours] || 0
    if (sum > best.total) best = { total: sum, start: Math.max(0, i - hours + 1) }
  })
  return best
}

/**
 * "Bathtub" fill: the rain that pools on the field settles into the lowest cells first.
 * Finds the water level L where Σ max(0, L − elev) × cellArea equals the pooled volume.
 * ponytail: ignores drainage paths and river overbank flow; upgrade to HAND (height above
 * nearest drainage) + river gauge data if the Sentinel-1 backtest says the shapes are off.
 */
export function floodDepths(
  elevs: number[],
  cellAreaM2: number,
  rainMm: number,
  pooling = KNOBS.pooling,
  absorbedMm = KNOBS.absorbedMm,
): number[] {
  const volume = (Math.max(0, rainMm - absorbedMm) / 1000) * pooling * cellAreaM2 * elevs.length
  if (!elevs.length || volume <= 0) return elevs.map(() => 0)
  const stored = (level: number) => elevs.reduce((s, e) => s + Math.max(0, level - e), 0) * cellAreaM2
  let lo = Math.min(...elevs)
  let hi = Math.max(...elevs) + volume / (cellAreaM2 * elevs.length)
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (stored(mid) < volume) lo = mid
    else hi = mid
  }
  return elevs.map((e) => Math.max(0, hi - e))
}

export function assess(cells: Cell[], stepM: number) {
  const cellHa = (stepM * stepM) / 10_000
  const flooded = cells.filter((c) => c.depth >= KNOBS.floodedDepth)
  const share = cells.length ? flooded.length / cells.length : 0
  const level: Level = flooded.length === 0 ? "clear" : share < 0.1 ? "watch" : "act"
  const high = cells.reduce((a, c) => (c.elev > a.elev ? c : a), cells[0])
  const low = cells.reduce((a, c) => (c.elev < a.elev ? c : a), cells[0])
  return {
    level,
    share,
    areaHa: cells.length * cellHa,
    floodedHa: flooded.length * cellHa,
    valueAtRisk: flooded.length * cellHa * KNOBS.caneValuePerHa,
    maxDepth: Math.max(0, ...cells.map((c) => c.depth)),
    high,
    low,
  }
}

export type Assessment = ReturnType<typeof assess>

// Fixed playbook. The app never invents farming advice; an LLM may only reword or translate these.
// ponytail: one crop (cane), one hazard (flood); needs a SRIF / extension-officer review before real use.
export const PLAYBOOK: Record<Level, string[]> = {
  act: [
    "Move cut cane, fertiliser and seed off the low corner today.",
    "Park the tractor and cane trucks on the high ground (pin on your map).",
    "Clear the drain on the lowest edge before the rain starts.",
  ],
  watch: [
    "Clear field drains, especially on the low side.",
    "Keep cut cane off the low corner until the rain passes.",
    "Hold off fertilising the low rows. It will wash out.",
  ],
  clear: [
    "No ponding expected on this field in the next 7 days.",
    "Good window for drain maintenance before the wet season.",
  ],
}
