// Run: node src/lib/farm.check.ts
import assert from "node:assert/strict"
import { areaHa, insertCorner, itemDepth, paddockRisk, readyDate, safeGround, type Paddock } from "./farm.ts"
import type { Cell, LatLng } from "./flood.ts"

// 100 m × 100 m square at the equator is 1 ha.
const d = 100 / 111_320
const sq: LatLng[] = [[0, 0], [0, d], [d, d], [d, 0]]
assert.ok(Math.abs(areaHa(sq) - 1) < 0.01)

// Two 50 m cells inside the paddock, one flooded; one cell outside.
const cells: Cell[] = [
  { lat: d * 0.25, lng: d * 0.25, elev: 1, depth: 1 },
  { lat: d * 0.75, lng: d * 0.75, elev: 5, depth: 0 },
  { lat: d * 3, lng: d * 3, elev: 0, depth: 2 },
]
const cane: Paddock = { id: "a", crop: "cane", poly: sq }
const r = paddockRisk(cane, cells, 50)
assert.equal(r.floodedHa, 0.25)
assert.equal(r.maxDepth, 1)
assert.ok(r.atRisk > 0)
assert.equal(paddockRisk({ ...cane, crop: "pasture" }, cells, 50).atRisk, 0) // no value entered yet

assert.equal(itemDepth({ id: "t", kind: "fuel", at: [d * 0.25, d * 0.25] }, cells, 50), 1)
assert.equal(itemDepth({ id: "t", kind: "fuel", at: [d * 10, d * 10] }, cells, 50), undefined)

// Cane planted Jan 2025 matures Jan 2027, waits for the mill to open in June.
assert.equal(readyDate({ ...cane, planted: "2025-01" })?.getMonth(), 5)

// Flooded area never exceeds the paddock, even when edge cells spill over.
assert.ok(paddockRisk(cane, [...Array(8)].map(() => ({ lat: d / 2, lng: d / 2, elev: 0, depth: 1 })), 50).floodedHa <= 1.01)

// One dry 30 m square is not safe ground; seven are (0.63 ha).
const wet = (n: number, depth: number): Cell[] => [...Array(n)].map((_, i) => ({ lat: i, lng: 0, elev: i, depth }))
assert.equal(safeGround([...wet(20, 1), ...wet(1, 0)], 30), undefined)
assert.ok(safeGround([...wet(20, 1), ...wet(7, 0)], 30))

// A tap just outside the top edge (corners 3 and 4) goes between them, not on the end.
const tapped = insertCorner(sq, [d * 1.1, d * 0.5])
assert.deepEqual(tapped[3], [d * 1.1, d * 0.5])
assert.equal(insertCorner([[0, 0]], [1, 1]).length, 2)

console.log("farm model: ok")
