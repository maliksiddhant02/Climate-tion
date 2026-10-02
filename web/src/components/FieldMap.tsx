import { useEffect, type ComponentType } from "react"
import { flushSync } from "react-dom"
import { createRoot } from "react-dom/client"
import L from "leaflet"
import { CircleMarker, ImageOverlay, MapContainer, Marker, ZoomControl, Polygon, Polyline, Rectangle, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet"
import { KNOBS, type Cell, type LatLng } from "@/lib/flood"

const M_PER_DEG = 111_320

function Fit({ poly }: { poly: LatLng[] }) {
  const map = useMap()
  useEffect(() => {
    map.fitBounds(poly, { padding: [40, 40] })
  }, [map, poly])
  return null
}

function Fly({ to }: { to?: LatLng }) {
  const map = useMap()
  useEffect(() => {
    if (to) map.setView(to, 16)
  }, [map, to])
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
  /** Jump the map here (e.g. a searched address). */
  flyTo?: LatLng
  /** Let one finger pan on phones too (setup needs it to reach your farm). */
  drag?: boolean
}) {
  const { poly, cells, stepM, high, draft, onMapClick, runKey = "", overlay, shapes, pins, wetOnly, noOutline, flyTo, drag } = props
  const half = stepM / 2 / M_PER_DEG
  const maxDepth = Math.max(0, ...cells.map((c) => c.depth))
  const cos = Math.cos((poly[0][0] * Math.PI) / 180)
  return (
    // One-finger drag on a phone should scroll the page, not get stuck panning the map. Pinch still zooms.
    <MapContainer center={poly[0]} zoom={15} scrollWheelZoom={false} dragging={drag || !L.Browser.mobile} zoomControl={false} className="h-full w-full">
      <ZoomControl position="topright" />
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        attribution="Imagery © Esri, Maxar, Earthstar Geographics · Elevation: Copernicus DEM · Land: ESA WorldCover · River: GloFAS"
        maxZoom={18}
      />
      {overlay && <ImageOverlay url={overlay.url} bounds={overlay.bounds} opacity={0.85} />}
      <Fit poly={poly} />
      <Fly to={flyTo} />
      <Clicks onClick={onMapClick} />
      {shapes?.map((s) => (
        <Polygon key={s.id} positions={s.poly} pathOptions={{ color: s.color, weight: 2, fillColor: s.color, fillOpacity: 0.4 }}>
          <Tooltip permanent direction="center" className="farm-label" pane="shadowPane">
            {s.label}
          </Tooltip>
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
  )
}
