import type { LatLng, River } from "./flood"

// The Ba floodplain grids built by scripts/build_ba_data.py and served from public/data/ba/.
// Fields inside this box get the river model at 30 m; anywhere else falls back to rain-only at 90 m.

export type FloodRecord = { start: string; end: string; name: string; source: string; peak: number; level: "act" | "watch" | "missed"; percentile: number }

export type Meta = {
  bbox: [number, number, number, number]
  width: number
  height: number
  res: number
  glofas: LatLng
  river: River & { codyPeak: number; townStreetsM: number }
  record: FloodRecord[]
  unmatchedAlarms: string[]
  sentinel1: { before: string; after: string; newWaterHa: number; dischargeDayBefore: number; note: string }
  sources: string[]
}

export type Region = { meta: Meta; dem: Int16Array; hand: Uint16Array; land: Uint8Array }

const BASE = "/data/ba"
const bin = (name: string) =>
  fetch(`${BASE}/${name}`).then((r) => {
    if (!r.ok) throw new Error(`Missing ${name}`)
    return r.arrayBuffer()
  })

let region: Promise<Region> | undefined

/** Loads once per page; ~1.3 MB, served static so it never touches a rate-limited API. */
export function loadRegion(): Promise<Region> {
  region ??= Promise.all([fetch(`${BASE}/meta.json`).then((r) => r.json()), bin("dem.bin"), bin("hand.bin"), bin("land.bin")]).then(
    ([meta, dem, hand, land]) => ({ meta, dem: new Int16Array(dem), hand: new Uint16Array(hand), land: new Uint8Array(land) }),
  )
  return region
}

const index = ({ meta }: Region, [lat, lng]: LatLng) => {
  const [w, , , n] = meta.bbox
  const x = Math.floor((lng - w) / meta.res)
  const y = Math.floor((n - lat) / meta.res)
  return x < 0 || y < 0 || x >= meta.width || y >= meta.height ? -1 : y * meta.width + x
}

export const covers = (r: Region, poly: LatLng[]) => poly.every((p) => index(r, p) >= 0)

/** Elevation (m), height above the river (m) and land-cover class at a point. Call only after `covers`. */
export function sample(r: Region, p: LatLng) {
  const i = index(r, p)
  return { elev: r.dem[i] / 10, hand: r.hand[i] / 10, land: r.land[i] }
}
