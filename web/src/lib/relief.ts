import { loadRegion, type Region } from "./region"

// Ground-height map of the lower Richmond from our own 30 m Copernicus DEM: colour by height, lit by a hillshade.
// The floodplain's relief is only a few metres (median 4 m), so the colour steps are packed into 0–20 m.

/** Height (m) → colour stops: dark low ground (floods first) to pale high ground. Monotonic lightness, one scale. */
export const RELIEF_STOPS: [number, string][] = [
  [0, "#173a45"],
  [2, "#2e5f5c"],
  [4, "#4f7f5d"],
  [7, "#8ea064"],
  [12, "#cdbf86"],
  [20, "#f1e7c9"],
]
const WATER = [44, 95, 158] // WorldCover 80: the river and the sea

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const STOPS = RELIEF_STOPS.map(([h, c]) => [h, ...rgb(c)])

function colour(h: number) {
  if (h <= STOPS[0][0]) return STOPS[0].slice(1)
  for (let i = 1; i < STOPS.length; i++)
    if (h <= STOPS[i][0]) {
      const [h0, ...a] = STOPS[i - 1]
      const [h1, ...b] = STOPS[i]
      const t = (h - h0) / (h1 - h0)
      return a.map((v, k) => v + (b[k] - v) * t)
    }
  return STOPS[STOPS.length - 1].slice(1)
}

export type Relief = { url: string; bounds: [[number, number], [number, number]] }

function draw(region: Region): Relief {
  const { width: w, height: h, res, bbox } = region.meta
  const dx = res * 111_320 * Math.cos((((bbox[1] + bbox[3]) / 2) * Math.PI) / 180)
  const dy = res * 111_320
  const z = (x: number, y: number) => region.dem[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))] / 10
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d")!
  const img = ctx.createImageData(w, h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      // Hillshade, sun from the north-west, slopes exaggerated 3× so a 1 m bank still casts a shadow.
      const gx = ((z(x + 1, y) - z(x - 1, y)) / (2 * dx)) * 3
      const gy = ((z(x, y + 1) - z(x, y - 1)) / (2 * dy)) * 3
      const shade = Math.max(0.55, Math.min(1.15, (1 - gx * 0.7071 + gy * 0.7071) / Math.sqrt(1 + gx * gx + gy * gy)))
      const c = region.land[i] === 80 ? WATER : colour(z(x, y)).map((v) => v * shade)
      img.data.set([c[0], c[1], c[2], 255], i * 4)
    }
  ctx.putImageData(img, 0, 0)
  return { url: canvas.toDataURL(), bounds: [[bbox[1], bbox[0]], [bbox[3], bbox[2]]] }
}

let relief: Promise<Relief | undefined> | undefined

/** The relief image for the shipped region, drawn once per page; undefined if the region data isn't there. */
export function loadRelief(): Promise<Relief | undefined> {
  relief ??= loadRegion().then(draw, () => undefined)
  return relief
}
