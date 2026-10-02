// Run: node src/lib/flood.check.ts
import assert from "node:assert/strict"
import { assess, floodDepths, gridInPolygon, inPolygon, KNOBS, maxRolling, type LatLng } from "./flood.ts"

const square: LatLng[] = [[0, 0], [0, 1], [1, 1], [1, 0]]
assert.equal(inPolygon([0.5, 0.5], square), true)
assert.equal(inPolygon([1.5, 0.5], square), false)

// No rain, no water.
assert.deepEqual(floodDepths([1, 2, 3], 100, 0), [0, 0, 0])

// Water conserves volume and fills the lowest cell first.
const elevs = [5, 1, 3, 2]
const d = floodDepths(elevs, 100, 10, 1, 0)
const stored = d.reduce((s, x) => s + x * 100, 0)
assert.ok(Math.abs(stored - (10 / 1000) * 100 * 4) < 1e-6, "volume conserved")
assert.ok(d[1] > d[3] && d[3] >= d[2] && d[0] === 0, "lowest fills first, peak stays dry")

// Grid fits one elevation request.
const { points } = gridInPolygon([[-17.51, 177.678], [-17.511, 177.686], [-17.517, 177.687], [-17.518, 177.679]])
assert.ok(points.length > 10 && points.length <= 100)

assert.deepEqual(maxRolling([0, 5, 5, 0, 20, 0], 2), { total: 20, start: 3 })

const a = assess([{ lat: 0, lng: 0, elev: 1, depth: 0.5 }, { lat: 0, lng: 0, elev: 9, depth: 0 }], 100)
assert.equal(a.level, "act")
assert.equal(a.floodedHa, 1)
assert.equal(a.high.elev, 9)

console.log("flood model: ok")

// River: stays in its banks up to the 2-year flood, then rises with √Q.
import { levelFor, riverDepths, riverStage } from "./flood.ts"
const ba = { q2: 400, q5: 750, h0: 0.5, k: 0.3 }
assert.equal(riverStage(100, ba), 0)
assert.equal(riverStage(400, ba), 0)
assert.ok(riverStage(900, ba) > riverStage(500, ba) && riverStage(500, ba) > 0.5)
assert.deepEqual(riverDepths([0, 1, 5], 2), [2, 1, 0])
assert.equal(levelFor([0, 0, 0]), "clear")
assert.equal(levelFor([1, ...Array(19).fill(0)]), "watch")
assert.equal(levelFor([1, 1, 0]), "act")
// Farm value only counts farmland cells (WorldCover 30/40), not houses (50).
const b = assess([{ lat: 0, lng: 0, elev: 1, depth: 1, land: 50 }, { lat: 0, lng: 0, elev: 1, depth: 1, land: 40 }], 100)
assert.equal(b.floodedHa, 2)
assert.equal(b.valueAtRisk, KNOBS.caneValuePerHa)
console.log("river model: ok")
