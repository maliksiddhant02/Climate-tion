// Draki flood model. Pure functions, no imports, so `node src/lib/flood.check.ts` can run it.

export type LatLng = [number, number]

/** hand = height above the river (m); land = ESA WorldCover class. Both only inside the shipped data region. */
export type Cell = { lat: number; lng: number; elev: number; depth: number; hand?: number; land?: number }

export type Level = "clear" | "watch" | "act"

const M_PER_DEG = 111_320

// Rain-pooling knobs. The river side is calibrated from data in scripts/build_ba_data.py (see River).
export const KNOBS = {
  /** Share of rain on the field + upslope that ends up pooling on it (runoff coeff × catchment ratio). */
  pooling: 1.8,
  /** Rain (mm per 72 h) that soaks in or leaves through field drains before anything pools. */
  absorbedMm: 60,
  /** Water deeper than this (m) counts as "under water" for cane and machinery. */
  floodedDepth: 0.15,
  /**
   * Cane value per hectare, A$, for a two-year Northern Rivers crop: 125 t/ha (midpoint of the 105–150 t/ha NSW DPI
   * reports for two-year cane, 2023–24) × A$55/t (the 2024 NSW average cane price, NSW DPI).
   */
  caneValuePerHa: 125 * 55,
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

/** Regular grid of points inside the polygon, coarsened until it fits `max` points (100 = one elevation API call). */
export function gridInPolygon(poly: LatLng[], stepM = 30, max = 100): { points: LatLng[]; stepM: number } {
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
    if (points.length <= max) return { points, stepM }
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

/** Calibrated in scripts/build_ba_data.py from 40 years of GloFAS flow and two recorded facts; shipped in meta.json. */
export type River = { q2: number; q5: number; h0: number; k: number }

/**
 * How far the river rises over its normal level (m) at a discharge (m³/s).
 * Below the 2-year flood it stays in its banks; above that the level grows with √Q, a standard rating-curve shape.
 */
export function riverStage(q: number, r: River): number {
  return q <= r.q2 ? 0 : r.h0 + r.k * (Math.sqrt(q) - Math.sqrt(r.q2))
}

/** River water reaches every cell that sits lower than the river level (HAND = height above the river). */
export function riverDepths(hands: number[], stage: number): number[] {
  return hands.map((h) => Math.max(0, stage - h))
}

// WorldCover often maps sugarcane as grassland (30) rather than cropland (40), so both count as farmland.
const FARMLAND = new Set([30, 40])

const levelOf = (flooded: number, total: number): Level => (flooded === 0 ? "clear" : flooded / total < 0.1 ? "watch" : "act")

/** The level a set of depths would trigger, for scoring forecast ensemble members. */
export function levelFor(depths: number[]): Level {
  return levelOf(depths.filter((d) => d >= KNOBS.floodedDepth).length, depths.length)
}

export function assess(cells: Cell[], stepM: number) {
  const cellHa = (stepM * stepM) / 10_000
  const flooded = cells.filter((c) => c.depth >= KNOBS.floodedDepth)
  const share = cells.length ? flooded.length / cells.length : 0
  const level = levelOf(flooded.length, cells.length)
  // Height above the river is what matters for parking machinery, when we have it.
  const h = (c: Cell) => c.hand ?? c.elev
  const high = cells.reduce((a, c) => (h(c) > h(a) ? c : a), cells[0])
  const low = cells.reduce((a, c) => (h(c) < h(a) ? c : a), cells[0])
  const farm = (c: Cell) => c.land === undefined || FARMLAND.has(c.land)
  return {
    level,
    share,
    areaHa: cells.length * cellHa,
    floodedHa: flooded.length * cellHa,
    valueAtRisk: flooded.filter(farm).length * cellHa * KNOBS.caneValuePerHa,
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
