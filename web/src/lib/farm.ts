// A farmer's own farm: boundary, paddocks (what grows where) and things on the farm (machines, stores, stock).
// Pure functions, no imports beyond types, so `node src/lib/farm.check.ts` can run it.
import { inPolygon, KNOBS, type Cell, type LatLng } from "./flood.ts"

export type CropId = "cane" | "soy" | "pasture" | "macadamia" | "veg" | "other"
export type ItemId = "tractor" | "harvester" | "truck" | "pump" | "fuel" | "chem" | "shed" | "house" | "cattle"

export type Paddock = { id: string; crop: CropId; poly: LatLng[]; planted?: string; valuePerHa?: number }
export type Item = { id: string; kind: ItemId; at: LatLng; hours?: number }
export type Profile = { boundary: LatLng[]; paddocks: Paddock[]; items: Item[]; name: string; phone: string; done: boolean }

// Colours checked with the dataviz validator (CVD-safe adjacent pairs); every paddock also carries a text label.
// Cane value: two-year Northern Rivers cane, 125 t/ha × A$55/t (NSW DPI, see KNOBS). Other crops: the farmer enters theirs.
export const CROPS: Record<CropId, { label: string; color: string; valuePerHa?: number; months?: number }> = {
  cane: { label: "Sugarcane", color: "#d4a72c", valuePerHa: KNOBS.caneValuePerHa, months: 24 },
  pasture: { label: "Pasture / cattle", color: "#3f8a5a" },
  soy: { label: "Soybeans", color: "#a8662e", months: 5 },
  macadamia: { label: "Macadamias", color: "#c96f9b" },
  veg: { label: "Vegetables", color: "#a77fd0", months: 4 },
  other: { label: "Something else", color: "#4f9ed9" },
}

// Fuel use: typical farm-size machines (editable on the page). Prices: national average pump prices, Oct 2026 (AIP).
const DIESEL = 2.62
// `prep`: what to do for things that can't be driven away (NSW SES flood advice: secure tanks so they can't float off).
export const ITEMS: Record<ItemId, { label: string; lph?: number; hours?: number; swap?: string; prep?: string }> = {
  tractor: { label: "Tractor", lph: 6, hours: 250 },
  harvester: { label: "Harvester" },
  truck: { label: "Truck / haul-out" },
  pump: { label: "Water pump", lph: 0.8, hours: 300, swap: "a solar pump" },
  fuel: { label: "Fuel tank", prep: "tie it down so it can't float off" },
  chem: { label: "Fertiliser & chemicals" },
  shed: { label: "Shed", prep: "lift what's inside off the floor" },
  house: { label: "House", prep: "move valuables up high" },
  cattle: { label: "Cattle" },
}

const M_PER_DEG = 111_320

/** Polygon area in hectares (equirectangular, fine for a farm). */
export function areaHa(poly: LatLng[]): number {
  if (poly.length < 3) return 0
  const cos = Math.cos((poly[0][0] * Math.PI) / 180)
  let s = 0
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++)
    s += poly[j][1] * cos * M_PER_DEG * poly[i][0] * M_PER_DEG - poly[i][1] * cos * M_PER_DEG * poly[j][0] * M_PER_DEG
  return Math.abs(s) / 2 / 10_000
}

export const valuePerHa = (p: Paddock) => p.valuePerHa ?? CROPS[p.crop].valuePerHa ?? 0

/** Hectares, flooded hectares and money at risk for one paddock, from the farm's model cells. */
export function paddockRisk(p: Paddock, cells: Cell[], stepM: number) {
  const cellHa = (stepM * stepM) / 10_000
  const inside = cells.filter((c) => inPolygon([c.lat, c.lng], p.poly))
  const ha = areaHa(p.poly)
  // Cells are 30 m squares that can spill past the paddock edge; never report more water than paddock.
  const floodedHa = Math.min(ha, inside.filter((c) => c.depth >= KNOBS.floodedDepth).length * cellHa)
  return { ha, floodedHa, atRisk: floodedHa * valuePerHa(p), maxDepth: Math.max(0, ...inside.map((c) => c.depth)) }
}

/** Water depth where an item sits: the model cell it's in, or undefined if it's off the marked farm. */
export function itemDepth(it: Item, cells: Cell[], stepM: number): number | undefined {
  const cos = Math.cos((it.at[0] * Math.PI) / 180)
  let best: Cell | undefined
  let bestD = Infinity
  for (const c of cells) {
    const d = Math.hypot((c.lat - it.at[0]) * M_PER_DEG, (c.lng - it.at[1]) * M_PER_DEG * cos)
    if (d < bestD) [best, bestD] = [c, d]
  }
  return best && bestD <= stepM ? best.depth : undefined
}

/** When a paddock is ready, from its planting month. Cane only reaches the mill while it crushes (June–December). */
export function readyDate(p: Paddock): Date | undefined {
  const months = CROPS[p.crop].months
  if (!months || !p.planted) return undefined
  const d = new Date(`${p.planted}-01T00:00:00`)
  d.setMonth(d.getMonth() + months)
  if (p.crop === "cane" && d.getMonth() < 5) d.setMonth(5)
  return d
}

export const fuelYear = (it: Item) => {
  const spec = ITEMS[it.kind]
  if (!spec.lph) return undefined
  const litres = spec.lph * (it.hours ?? spec.hours ?? 0)
  return { litres, cost: litres * DIESEL, swap: spec.swap }
}

export const uid = () => Math.random().toString(36).slice(2, 9)

// Saved on this device only.
const KEY = "draki-farm-v1"
export function loadProfile(): Profile | undefined {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "null") ?? undefined
  } catch {
    return undefined
  }
}
export const saveProfile = (p?: Profile) => (p ? localStorage.setItem(KEY, JSON.stringify(p)) : localStorage.removeItem(KEY))

/** Highest dry ground on the farm, if there's enough of it (≥ 0.5 ha) to park machinery and hold stock. */
export function safeGround(cells: Cell[], stepM: number): Cell | undefined {
  const dry = cells.filter((c) => c.depth < KNOBS.floodedDepth)
  if (dry.length * ((stepM * stepM) / 10_000) < 0.5) return undefined
  return dry.reduce((a, c) => ((c.hand ?? c.elev) > (a.hand ?? a.elev) ? c : a))
}
