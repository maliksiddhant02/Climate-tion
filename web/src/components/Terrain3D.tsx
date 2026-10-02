import { useEffect, useRef } from "react"
import * as maplibregl from "maplibre-gl"
import type { GeoJSONSource } from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
// Hand MapLibre its worker as a Vite-bundled file; its own lookup breaks under Vite's dependency pre-bundling.
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url"
maplibregl.setWorkerUrl(workerUrl)

// The same ground-height tiles as the flat map, served to MapLibre through a relief:// protocol.
const png = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error("tile"))), "image/png")).then((b) => b.arrayBuffer())
const zxy = (url: string) => url.replace(/^\w+:\/\//, "").split("/").map(Number)
maplibregl.addProtocol("relief", async ({ url }) => {
  const [z, x, y] = zxy(url)
  const canvas = document.createElement("canvas")
  await drawRelief(canvas, z, x, y, 512)
  return { data: await png(canvas) }
})
// And the terrain shape from the same smoothed heights, so a single bad height can't become a spike.
maplibregl.addProtocol("terrain", async ({ url }) => {
  const [z, x, y] = zxy(url)
  const canvas = document.createElement("canvas")
  await drawTerrarium(canvas, z, x, y)
  return { data: await png(canvas) }
})
import { KNOBS, type Cell, type LatLng } from "@/lib/flood"
import { drawRelief, drawTerrarium, EXAGGERATION } from "@/lib/relief"
import type { Pin, Shape } from "./FieldMap"

// The tilted view, loaded only when someone presses 3D (MapLibre GL is ~280 kB gzipped; Leaflet can't tilt).
// Terrain: AWS Terrain Tiles (open data, Terrarium encoding). The floodplain's few metres of relief are invisible at
// true scale, so heights are exaggerated (EXAGGERATION, stated on screen).

const M_PER_DEG = 111_320
const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services"

type Props = { poly: LatLng[]; shapes?: Shape[]; cells: Cell[]; stepM: number; pins?: Pin[]; base: "ground" | "satellite" }

const ring = (poly: LatLng[]) => [[...poly, poly[0]].map(([lat, lng]) => [lng, lat])]

function features({ poly, shapes, cells, stepM }: Props): GeoJSON.FeatureCollection {
  const half = stepM / 2 / M_PER_DEG
  const cos = Math.cos((poly[0][0] * Math.PI) / 180)
  const f = (kind: string, coordinates: number[][][], props: Record<string, unknown> = {}): GeoJSON.Feature => ({
    type: "Feature",
    properties: { kind, ...props },
    geometry: { type: "Polygon", coordinates },
  })
  return {
    type: "FeatureCollection",
    features: [
      ...(shapes ?? []).map((s) => f("paddock", ring(s.poly), { color: s.color })),
      ...cells
        .filter((c) => c.depth > 0)
        .map((c) => {
          const deep = c.depth >= KNOBS.floodedDepth
          const [s, n, w, e] = [c.lat - half, c.lat + half, c.lng - half / cos, c.lng + half / cos]
          return f("cell", [[[w, s], [e, s], [e, n], [w, n], [w, s]]], {
            color: deep ? "#d4472a" : "#9db8da",
            opacity: deep ? 0.35 + Math.min(c.depth, 2) * 0.2 : 0.45,
          })
        }),
      f("boundary", ring(poly)),
    ],
  }
}

export default function Terrain3D(props: Props) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map>(undefined)
  const markers = useRef<maplibregl.Marker[]>([])

  useEffect(() => {
    const { poly } = props
    const lats = poly.map((p) => p[0])
    const lngs = poly.map((p) => p[1])
    const m = new maplibregl.Map({
      container: el.current!,
      bounds: [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)],
      fitBoundsOptions: { padding: 60 },
      pitch: 62,
      bearing: -25,
      maxPitch: 80,
      attributionControl: { compact: true },
      style: {
        version: 8,
        sources: {
          sat: { type: "raster", tiles: [`${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`], tileSize: 256, maxzoom: 18, attribution: "Imagery © Esri, Maxar" },
          relief: { type: "raster", tiles: ["relief://{z}/{x}/{y}"], tileSize: 256, maxzoom: 18, attribution: "Ground height: AWS Terrain Tiles (Mapzen)" },
          dem: {
            type: "raster-dem",
            tiles: ["terrain://{z}/{x}/{y}"],
            encoding: "terrarium",
            tileSize: 256,
            // Same consistent z12 surface the ground-height colours use; z13–15 show survey seams here (see lib/relief).
            maxzoom: 12,
            attribution: "Terrain: AWS Terrain Tiles (Mapzen)",
          },
          farm: { type: "geojson", data: features(props) },
        },
        layers: [
          { id: "relief", type: "raster", source: "relief" },
          { id: "sat", type: "raster", source: "sat" },
          { id: "paddocks", type: "fill", source: "farm", filter: ["==", ["get", "kind"], "paddock"], paint: { "fill-color": ["get", "color"], "fill-opacity": 0.25 } },
          { id: "paddock-lines", type: "line", source: "farm", filter: ["==", ["get", "kind"], "paddock"], paint: { "line-color": ["get", "color"], "line-width": 2.5 } },
          { id: "cells", type: "fill", source: "farm", filter: ["==", ["get", "kind"], "cell"], paint: { "fill-color": ["get", "color"], "fill-opacity": ["get", "opacity"] } },
          { id: "boundary", type: "line", source: "farm", filter: ["==", ["get", "kind"], "boundary"], paint: { "line-color": "#ffffff", "line-width": 3 } },
        ],
        terrain: { source: "dem", exaggeration: EXAGGERATION },
      },
    })
    m.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right")
    map.current = m
    return () => m.remove()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- one map per mount; props flow in below

  // Base layer, farm shapes and water follow the props without rebuilding the map.
  useEffect(() => {
    const m = map.current
    if (!m) return
    const apply = () => {
      const ground = props.base === "ground"
      m.setLayoutProperty("sat", "visibility", ground ? "none" : "visible")
      m.setLayoutProperty("relief", "visibility", ground ? "visible" : "none")
      ;(m.getSource("farm") as GeoJSONSource).setData(features(props))
      markers.current.forEach((x) => x.remove())
      markers.current = [
        ...(props.pins ?? []).map((p) => {
          const div = document.createElement("div")
          div.className = `farm-pin${p.wet ? " farm-pin-wet" : ""}`
          div.innerHTML = p.svg
          div.title = p.label
          return new maplibregl.Marker({ element: div }).setLngLat([p.at[1], p.at[0]]).addTo(m)
        }),
        ...(props.shapes ?? []).map((s) => {
          const div = document.createElement("div")
          div.className = "farm-label-3d"
          div.textContent = s.label
          const c = s.poly.reduce((a, p) => [a[0] + p[0] / s.poly.length, a[1] + p[1] / s.poly.length], [0, 0])
          return new maplibregl.Marker({ element: div }).setLngLat([c[1], c[0]]).addTo(m)
        }),
      ]
    }
    if (m.isStyleLoaded()) apply()
    else m.once("load", apply)
  }, [props])

  return <div ref={el} className="h-full w-full" />
}
