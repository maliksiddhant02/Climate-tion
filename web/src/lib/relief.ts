import { loadRegion, type Region } from "./region"

// Ground-height map tiles, drawn in the browser from AWS Terrain Tiles (Terrarium PNGs: open data, CORS-enabled).
// Same source everywhere, so there's no edge where our own data stops; a fresh tile per zoom, so it never turns to
// blocks or blanks. Above MAX_Z we sample the MAX_Z tile with bilinear interpolation, so it stays smooth.

/** Height (m) → colour. Most steps sit in 0–20 m, where the floodplain is (median 4 m); browns carry on into the hills. */
export const RELIEF_STOPS: [number, string][] = [
  [0, "#173a45"],
  [2, "#2e5f5c"],
  [4, "#4f7f5d"],
  [7, "#8ea064"],
  [12, "#c9c08a"],
  [20, "#e3d6a6"],
  [50, "#c9a97c"],
  [120, "#a0805f"],
  [300, "#7d6552"],
]
const SEA = [44, 95, 158]
/** How much the 3D view stretches heights; the floodplain's few metres are invisible at true scale. */
export const EXAGGERATION = 4
// Deepest Terrarium zoom we read. At z13–15 the tiles mix source surveys and show staircase seams and plateaus on
// the lower Richmond; z12 (~35 m a pixel) is one consistent surface and matches the flood model's 30 m grid.
const MAX_Z = 12
const SEA_BELOW = -3 // m. Swampy floodplain sits at or just under 0 m, so only clearly negative heights are sea.
const Z_FACTOR = 2 // hillshade slope exaggeration, so a 1 m bank still casts a shadow
const TILE = 256

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const STOPS = RELIEF_STOPS.map(([h, c]) => [h, ...rgb(c)] as number[])

function colour(h: number): number[] {
  if (h <= SEA_BELOW) return SEA
  if (h < 0) {
    const t = (h - SEA_BELOW) / -SEA_BELOW // blend into the lowest land colour, no hard shoreline
    return SEA.map((v, k) => v + (STOPS[0][k + 1] - v) * t)
  }
  for (let i = 1; i < STOPS.length; i++)
    if (h <= STOPS[i][0]) {
      const [h0, ...a] = STOPS[i - 1]
      const [h1, ...b] = STOPS[i]
      const t = (h - h0) / (h1 - h0)
      return a.map((v, k) => v + (b[k] - v) * t)
    }
  return STOPS[STOPS.length - 1].slice(1)
}

// Decoded Terrarium tiles (heights in m), shared by the 2D and 3D maps.
// ponytail: FIFO caps, not LRU; plenty for panning around one farm.
const raws = new Map<string, Promise<Float32Array>>()
const blocks = new Map<string, Promise<Float32Array>>()
const remember = <T,>(cache: Map<string, Promise<T>>, key: string, cap: number, make: () => Promise<T>) => {
  let p = cache.get(key)
  if (!p) {
    p = make()
    cache.set(key, p)
    p.catch(() => cache.delete(key))
    if (cache.size > cap) cache.delete(cache.keys().next().value!)
  }
  return p
}

function raw(z: number, x: number, y: number): Promise<Float32Array> {
  const n = 2 ** z
  x = ((x % n) + n) % n
  y = Math.min(n - 1, Math.max(0, y))
  const key = `${z}/${x}/${y}`
  return remember(raws, key, 150, () => new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      const c = document.createElement("canvas")
      c.width = c.height = TILE
      const ctx = c.getContext("2d", { willReadFrequently: true })!
      ctx.drawImage(img, 0, 0)
      const d = ctx.getImageData(0, 0, TILE, TILE).data
      const h = new Float32Array(TILE * TILE)
      for (let i = 0; i < h.length; i++) h[i] = d[i * 4] * 256 + d[i * 4 + 1] + d[i * 4 + 2] / 256 - 32768
      resolve(h)
    }
    img.onerror = () => reject(new Error(`terrain tile ${key}`))
    img.src = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${key}.png`
  }))
}

// Each tile is smoothed and shaded with a margin borrowed from its 8 neighbours, so neighbouring tiles meet seamlessly.
const M = 8 // ≥ blur reach (2 passes × 2 px) + slope sample (1 px) + bilinear (1 px)
const B = TILE + 2 * M

function heights(z: number, x: number, y: number): Promise<Float32Array> {
  return remember(blocks, `${z}/${x}/${y}`, 64, async () => {
    const around = await Promise.all([-1, 0, 1].flatMap((dy) => [-1, 0, 1].map((dx) => raw(z, x + dx, y + dy))))
    const h = new Float32Array(B * B)
    for (let by = 0; by < B; by++)
      for (let bx = 0; bx < B; bx++) {
        const gx = bx - M // position relative to the centre tile
        const gy = by - M
        const tx = gx < 0 ? 0 : gx >= TILE ? 2 : 1
        const ty = gy < 0 ? 0 : gy >= TILE ? 2 : 1
        h[by * B + bx] = around[ty * 3 + tx][(gy - (ty - 1) * TILE) * TILE + (gx - (tx - 1) * TILE)]
      }
    return smooth(h)
  })
}

/**
 * Two passes of a 5-pixel box blur, each way (≈ a Gaussian of ~2 px). Terrarium's z12 here is upsampled from coarser
 * data and carries ~90 m staircase steps; this rounds them off without moving the hills or the low ground.
 */
function smooth(h: Float32Array) {
  const R = 2
  const tmp = new Float32Array(h.length)
  const pass = (src: Float32Array, dst: Float32Array, dx: number, dy: number) => {
    for (let y = 0; y < B; y++)
      for (let x = 0; x < B; x++) {
        let sum = 0
        for (let k = -R; k <= R; k++) {
          const xx = Math.min(B - 1, Math.max(0, x + k * dx))
          const yy = Math.min(B - 1, Math.max(0, y + k * dy))
          sum += src[yy * B + xx]
        }
        dst[y * B + x] = sum / (2 * R + 1)
      }
  }
  for (let i = 0; i < 2; i++) {
    pass(h, tmp, 1, 0)
    pass(tmp, h, 0, 1)
  }
  return h
}

// Rivers and creeks: Terrarium has no water mask, so inside the lower Richmond we take ESA WorldCover's water class
// (80) from the region data, blended between 30 m cells so the banks curve instead of stepping.
let region: Promise<{ r: Region; water: Float32Array } | undefined> | undefined

/** WorldCover water as 0/1, box-blurred twice so the banks come out as curves rather than 30 m steps. */
function waterMask(r: Region) {
  const { width: w, height: h } = r.meta
  let a = Float32Array.from(r.land, (c) => (c === 80 ? 1 : 0))
  for (let pass = 0; pass < 2; pass++) {
    const b = new Float32Array(a.length)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let sum = 0
        let n = 0
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx
            const yy = y + dy
            if (xx >= 0 && yy >= 0 && xx < w && yy < h) (sum += a[yy * w + xx]), n++
          }
        b[y * w + x] = sum / n
      }
    a = b
  }
  return a
}

const waterAt = ({ r, water }: { r: Region; water: Float32Array }, lat: number, lng: number) => {
  const { bbox, res, width: w, height: h } = r.meta
  const fx = (lng - bbox[0]) / res - 0.5
  const fy = (bbox[3] - lat) / res - 0.5
  if (fx < 0 || fy < 0 || fx >= w - 1 || fy >= h - 1) return 0
  const x0 = Math.floor(fx)
  const y0 = Math.floor(fy)
  const tx = fx - x0
  const ty = fy - y0
  const v = (x: number, y: number) => water[y * w + x]
  const f = (v(x0, y0) * (1 - tx) + v(x0 + 1, y0) * tx) * (1 - ty) + (v(x0, y0 + 1) * (1 - tx) + v(x0 + 1, y0 + 1) * tx) * ty
  const e = Math.min(1, Math.max(0, (f - 0.35) / 0.3)) // soft edge around the half-way line
  return e * e * (3 - 2 * e)
}

const tileLat = (y: number, z: number) => Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** z)))

/** Draw the relief tile z/x/y into `canvas` at `size` px (pass 512 for sharp screens). */
export async function drawRelief(canvas: HTMLCanvasElement, z: number, x: number, y: number, size: number) {
  const dz = Math.max(0, z - MAX_Z)
  const k = 2 ** dz
  const zs = z - dz
  const H = await heights(zs, Math.floor(x / k), Math.floor(y / k))
  const ox = ((x % k) * TILE) / k // where this tile starts inside the source tile, in source pixels
  const oy = ((y % k) * TILE) / k
  const step = TILE / k / size // source pixels per output pixel
  const mpp = (40_075_016.686 * Math.cos(tileLat(y + 0.5, z))) / (TILE * 2 ** zs) // metres per source pixel
  const at = (fx: number, fy: number) => {
    fx = Math.min(B - 1, Math.max(0, fx + M))
    fy = Math.min(B - 1, Math.max(0, fy + M))
    const x0 = Math.floor(fx)
    const y0 = Math.floor(fy)
    const x1 = Math.min(B - 1, x0 + 1)
    const y1 = Math.min(B - 1, y0 + 1)
    const tx = fx - x0
    const ty = fy - y0
    const top = H[y0 * B + x0] * (1 - tx) + H[y0 * B + x1] * tx
    const bot = H[y1 * B + x0] * (1 - tx) + H[y1 * B + x1] * tx
    return top * (1 - ty) + bot * ty
  }
  region ??= loadRegion().then(
    (r) => ({ r, water: waterMask(r) }),
    () => undefined,
  )
  const rw = await region
  const r = rw?.r
  const n = 2 ** z
  const [w, e, nLat, sLat] = [(x / n) * 360 - 180, ((x + 1) / n) * 360 - 180, tileLat(y, z) * (180 / Math.PI), tileLat(y + 1, z) * (180 / Math.PI)]
  const rivers = rw && r && !(e < r.meta.bbox[0] || w > r.meta.bbox[2] || nLat < r.meta.bbox[1] || sLat > r.meta.bbox[3]) ? rw : undefined
  canvas.width = canvas.height = size
  const ctx = canvas.getContext("2d")!
  const img = ctx.createImageData(size, size)
  for (let py = 0; py < size; py++)
    for (let px = 0; px < size; px++) {
      const fx = ox + (px + 0.5) * step - 0.5
      const fy = oy + (py + 0.5) * step - 0.5
      const h = at(fx, fy)
      // Hillshade from the north-west, slopes measured one source pixel either side.
      const gx = ((at(fx + 1, fy) - at(fx - 1, fy)) / (2 * mpp)) * Z_FACTOR
      const gy = ((at(fx, fy + 1) - at(fx, fy - 1)) / (2 * mpp)) * Z_FACTOR
      const shade = h <= SEA_BELOW ? 1 : Math.max(0.55, Math.min(1.15, (1 - gx * 0.7071 + gy * 0.7071) / Math.sqrt(1 + gx * gx + gy * gy)))
      const c = colour(h).map((v) => v * shade)
      if (rivers) {
        const lat = tileLat(y + (py + 0.5) / size, z) * (180 / Math.PI)
        const lng = ((x + (px + 0.5) / size) / n) * 360 - 180
        const a = waterAt(rivers, lat, lng)
        if (a) for (let k = 0; k < 3; k++) c[k] += (SEA[k] - c[k]) * a
      }
      img.data.set([c[0], c[1], c[2], 255], (py * size + px) * 4)
    }
  ctx.putImageData(img, 0, 0)
}

/** CSS gradient for the legend: stops evenly spaced (the scale itself is uneven, packed into the low metres). */
export const RELIEF_GRADIENT = `linear-gradient(to right, ${RELIEF_STOPS.map(([, c], i) => `${c} ${(100 * i) / (RELIEF_STOPS.length - 1)}%`).join(", ")})`

/** The smoothed heights for tile z/x/y (z ≤ MAX_Z), re-encoded as a Terrarium PNG so the 3D terrain matches the colours. */
export async function drawTerrarium(canvas: HTMLCanvasElement, z: number, x: number, y: number) {
  const H = await heights(z, x, y)
  canvas.width = canvas.height = TILE
  const ctx = canvas.getContext("2d")!
  const img = ctx.createImageData(TILE, TILE)
  for (let py = 0; py < TILE; py++)
    for (let px = 0; px < TILE; px++) {
      const v = H[(py + M) * B + (px + M)] + 32768
      img.data.set([Math.floor(v / 256), Math.floor(v) % 256, Math.floor((v % 1) * 256), 255], (py * TILE + px) * 4)
    }
  ctx.putImageData(img, 0, 0)
}
