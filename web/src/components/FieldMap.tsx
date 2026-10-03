import { lazy, Suspense, useEffect, useState, type ComponentType, type ReactNode } from "react"
import { flushSync } from "react-dom"
import { createRoot } from "react-dom/client"
import L from "leaflet"
import { CircleMarker, ImageOverlay, MapContainer, Marker, Popup, ZoomControl, Polygon, Polyline, Rectangle, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet"
import { KNOBS, type Cell, type LatLng } from "@/lib/flood"
import { drawRelief, EXAGGERATION, RELIEF_GRADIENT } from "@/lib/relief"
import { cn } from "@/lib/utils"

// MapLibre (~280 kB gzipped) only downloads when someone presses 3D.
const Terrain3D = lazy(() => import("./Terrain3D"))
const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services"

// Ground-height tiles, drawn in the browser at 2× for sharp screens (see lib/relief).
class ReliefLayer extends L.GridLayer {
  createTile(coords: L.Coords, done: L.DoneCallback) {
    const tile = document.createElement("canvas")
    drawRelief(tile, coords.z, coords.x, coords.y, 512).then(
      () => done(undefined, tile),
      (e) => done(e, tile),
    )
    return tile
  }
}

function Relief() {
  const map = useMap()
  useEffect(() => {
    const layer = new ReliefLayer({ maxZoom: 19, zIndex: 1, attribution: "Ground height: AWS Terrain Tiles (Mapzen)" })
    layer.addTo(map)
    return () => {
      layer.remove()
    }
  }, [map])
  return null
}

const M_PER_DEG = 111_320

// A 40 ha block fills the map at about zoom 17, which hides everything around it. Cap the opening zoom so the farm shows in context.
function Fit({ poly, maxZoom }: { poly: LatLng[]; maxZoom: number }) {
  const map = useMap()
  useEffect(() => {
    map.fitBounds(poly, { padding: [40, 40], maxZoom })
  }, [map, poly, maxZoom])
  return null
}

function Fly({ to, zoom }: { to?: LatLng; zoom: number }) {
  const map = useMap()
  useEffect(() => {
    if (to) map.setView(to, zoom)
  }, [map, to, zoom])
  return null
}

function Clicks({ onClick }: { onClick?: (p: LatLng) => void }) {
  useMapEvents({ click: (e) => onClick?.([e.latlng.lat, e.latlng.lng]) })
  return null
}

// Bucket a wet cell by depth so the deepest (lowest) ground fills first when the map animates.
const riseClass = (c: Cell, maxDepth: number) => (c.depth > 0 ? `rise rise-${Math.min(9, Math.floor((1 - c.depth / (maxDepth || 1)) * 10))}` : undefined)

function cellStyle(c: Cell) {
  if (c.depth >= KNOBS.floodedDepth)
    return { fillColor: "#d4472a", fillOpacity: 0.35 + Math.min(c.depth, 2) * 0.2, color: "#d4472a", weight: 0 }
  if (c.depth > 0) return { fillColor: "#9db8da", fillOpacity: 0.45, color: "#9db8da", weight: 0 }
  return { fillOpacity: 0, color: "#ffffff", opacity: 0.18, weight: 1 }
}

/** A farm item on the map: an icon in a round chip, red when it would sit in water. `svg` comes from iconSvg. */
export type Pin = { id: string; at: LatLng; svg: string; label: string; wet?: boolean }
export type Shape = { id: string; poly: LatLng[]; color: string; label: string }

/**
 * An icon's SVG markup, rendered with the React client already on the page (react-dom/server would add ~60 kB gzipped).
 * Call at module load, never during a render: React can't flush a second root mid-render.
 */
export function iconSvg(Icon: ComponentType<{ className?: string }>) {
  const el = document.createElement("div")
  const root = createRoot(el)
  flushSync(() => root.render(<Icon className="size-[18px]" />))
  const svg = el.innerHTML
  root.unmount()
  return svg
}

const pinIcon = ({ svg, wet }: Pin) =>
  L.divIcon({ className: "", iconSize: [34, 34], iconAnchor: [17, 17], html: `<div class="farm-pin${wet ? " farm-pin-wet" : ""}">${svg}</div>` })

function RemovePopup({ label, onRemove, offset = [0, 7] }: { label: string; onRemove: () => void; offset?: [number, number] }) {
  const map = useMap()
  return (
    <Popup offset={offset} closeButton={false}>
      <span className="flex items-center gap-3">
        <span className="font-medium">{label}</span>
        <button
          onClick={(e) => {
            e.stopPropagation()
            map.closePopup()
            onRemove()
          }}
          className="rounded-full bg-flood px-3 py-1 text-xs font-medium text-white"
        >
          Remove
        </button>
      </span>
    </Popup>
  )
}

export function FieldMap(props: {
  poly: LatLng[]
  cells: Cell[]
  stepM: number
  high?: Cell
  draft?: LatLng[]
  onMapClick?: (p: LatLng) => void
  /** Changing this replays the water-rising animation (e.g. switching This week / the 2022 flood). */
  runKey?: string
  /** What the satellite saw under water, drawn under the model's squares. */
  overlay?: { url: string; bounds: [LatLng, LatLng] }
  /** Paddocks, coloured by crop and labelled. */
  shapes?: Shape[]
  pins?: Pin[]
  /** Only draw cells that hold water (no grid over dry ground), for maps that already show paddocks. */
  wetOnly?: boolean
  /** Hide the field outline (e.g. while the farmer is still marking it). */
  noOutline?: boolean
  /** Closest the map opens to `poly` (lower = more of the area around it). */
  fitMaxZoom?: number
  /** Jump the map here (e.g. a searched address, or a tapped item). Pass a new array to jump again. */
  flyTo?: LatLng
  flyZoom?: number
  /** Let one finger pan on phones too (setup needs it to reach your farm). */
  drag?: boolean
  /** Tapping a pin or paddock offers to remove it (setup). */
  onRemove?: (id: string) => void
  /** Swatches for what's drawn on the map; shown in the bar under it. */
  legend?: ReactNode
}) {
  const { poly, cells, stepM, high, draft, onMapClick, runKey = "", overlay, shapes, pins, wetOnly, noOutline, fitMaxZoom = 15, flyTo, flyZoom = 15, drag, legend, onRemove } = props
  const half = stepM / 2 / M_PER_DEG
  const maxDepth = Math.max(0, ...cells.map((c) => c.depth))
  const cos = Math.cos((poly[0][0] * Math.PI) / 180)
  // Ground height is the default: it shows where the land dips, which is where water goes first.
  const [base, setBase] = useState<"ground" | "satellite">("ground")
  const [tilt, setTilt] = useState(false)
  const ground = base === "ground"
  // No 3D while the farmer is tapping corners or placing things: taps need the flat map.
  const canTilt = !onMapClick
  const seg = (on: boolean) => cn("press px-3 py-1.5 text-sm", on ? "bg-white text-ink" : "text-white/80 hover:text-white")
  return (
    <div className="flex h-full w-full flex-col">
      <div className="relative min-h-0 flex-1">
      {tilt && canTilt ? (
        <Suspense fallback={<div className="grid h-full place-items-center bg-ink text-sm text-white/70">Loading 3D…</div>}>
          <Terrain3D poly={poly} shapes={shapes} cells={cells} stepM={stepM} pins={pins} base={base} />
        </Suspense>
      ) : (
    // One-finger drag on a phone should scroll the page, not get stuck panning the map. Pinch still zooms.
    <MapContainer center={poly[0]} zoom={15} scrollWheelZoom dragging={drag || !L.Browser.mobile} zoomControl={false} className="h-full w-full">
      <ZoomControl position="topright" />
      {ground ? (
        <>
          <Relief />
          <TileLayer url={`${ESRI}/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}`} maxZoom={18} opacity={0.6} zIndex={2} />
        </>
      ) : (
        <TileLayer url={`${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`} attribution="Imagery © Esri, Maxar, Earthstar Geographics" maxZoom={18} />
      )}
      <TileLayer url={`${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`} maxZoom={18} zIndex={3} attribution="Labels © Esri · Flood model: Copernicus DEM, ESA WorldCover, GloFAS" />
      {overlay && <ImageOverlay url={overlay.url} bounds={overlay.bounds} opacity={0.85} />}
      <Fit poly={poly} maxZoom={fitMaxZoom} />
      <Fly to={flyTo} zoom={flyZoom} />
      <Clicks onClick={onMapClick} />
      {shapes?.map((s) => (
        <Polygon key={s.id} positions={s.poly} pathOptions={{ color: s.color, weight: ground ? 3 : 2, fillColor: s.color, fillOpacity: ground ? 0.1 : 0.4 }}>
          <Tooltip permanent direction="center" className="farm-label" pane="shadowPane">
            {s.label}
          </Tooltip>
          {onRemove && <RemovePopup label={s.label} onRemove={() => onRemove(s.id)} />}
        </Polygon>
      ))}
      {!draft &&
        cells.filter((c) => !wetOnly || c.depth > 0).map((c) => (
          <Rectangle
            key={`${runKey}:${c.lat},${c.lng}`}
            bounds={[[c.lat - half, c.lng - half / cos], [c.lat + half, c.lng + half / cos]]}
            pathOptions={{ ...cellStyle(c), className: riseClass(c, maxDepth) }}
          >
            <Tooltip sticky>{`${c.hand !== undefined ? `${c.hand.toFixed(1)} m above the river` : `${c.elev.toFixed(0)} m above sea level`}${c.depth > 0.01 ? ` · ~${c.depth.toFixed(1)} m of water` : ""}`}</Tooltip>
          </Rectangle>
        ))}
      {!noOutline && (!draft || shapes) && <Polygon positions={poly} pathOptions={{ color: shapes ? "#ffffff" : "#d4a72c", weight: 2.5, fill: false }} />}
      {pins?.map((p) => (
        <Marker key={p.id} position={p.at} icon={pinIcon(p)}>
          <Tooltip direction="top" offset={[0, -16]}>{p.label}</Tooltip>
          {onRemove && <RemovePopup label={p.label} onRemove={() => onRemove(p.id)} offset={[0, -12]} />}
        </Marker>
      ))}
      {!draft && high && (
        <CircleMarker center={[high.lat, high.lng]} radius={6} pathOptions={{ color: "#13211a", weight: 2, fillColor: "#d4a72c", fillOpacity: 1 }}>
          <Tooltip permanent direction="top" offset={[0, -8]}>High ground · park machinery here</Tooltip>
        </CircleMarker>
      )}
      {draft && <Polyline positions={draft} pathOptions={{ color: "#d4a72c", weight: 2 }} />}
      {draft?.map((p, i) => (
        <CircleMarker key={i} center={p} radius={5} pathOptions={{ color: "#13211a", weight: 2, fillColor: "#d4a72c", fillOpacity: 1 }} />
      ))}
    </MapContainer>
      )}

      </div>

      {/* The bar under the map: view switch, then what the colours mean. Never covers the map, at any width. */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 bg-ink px-3 py-2.5 text-sm text-white">
        <div className="flex overflow-hidden rounded-full bg-white/10" role="group" aria-label="Map view">
          <button onClick={() => setBase("ground")} aria-pressed={ground} className={seg(ground)}>
            Ground height
          </button>
          <button onClick={() => setBase("satellite")} aria-pressed={!ground} className={seg(!ground)}>
            Satellite
          </button>
          {canTilt && (
            <button onClick={() => setTilt(!tilt)} aria-pressed={tilt} className={cn(seg(tilt), "border-l border-white/20")}>
              3D
            </button>
          )}
        </div>
        {ground && (
          <span className="flex items-center gap-2">
            Low
            <i className="inline-block h-2.5 w-24 rounded-full" style={{ background: RELIEF_GRADIENT }} title="Ground height: dark is low ground, which floods first" />
            High{tilt && canTilt ? ` · heights ×${EXAGGERATION}` : ""}
          </span>
        )}
        {legend}
      </div>
    </div>
  )
}
