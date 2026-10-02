import { useEffect, useRef } from "react"
import * as maplibregl from "maplibre-gl"
import type { GeoJSONSource } from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
// Hand MapLibre its worker as a Vite-bundled file; its own lookup breaks under Vite's dependency pre-bundling.
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url"
maplibregl.setWorkerUrl(workerUrl)
import { KNOBS, type Cell, type LatLng } from "@/lib/flood"
import type { Relief } from "@/lib/relief"
import type { Pin, Shape } from "./FieldMap"

// The tilted view, loaded only when someone presses 3D (MapLibre GL is ~280 kB gzipped; Leaflet can't tilt).
// Terrain: AWS Terrain Tiles (open data, Terrarium encoding). The floodplain's few metres of relief are invisible at
// true scale, so heights are exaggerated (EXAGGERATION, stated on screen).

export const EXAGGERATION = 6
const M_PER_DEG = 111_320
const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services"

type Props = { poly: LatLng[]; shapes?: Shape[]; cells: Cell[]; stepM: number; pins?: Pin[]; base: "ground" | "satellite"; relief?: Relief }

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
    const { poly, relief } = props
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
          shade: { type: "raster", tiles: [`${ESRI}/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}`], tileSize: 256, maxzoom: 16, attribution: "Hillshade © Esri" },
          dem: {
            type: "raster-dem",
            tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
            encoding: "terrarium",
            tileSize: 256,
            maxzoom: 15,
            attribution: "Terrain: AWS Terrain Tiles (Mapzen)",
          },
          ...(relief && {
            relief: {
              type: "image",
              url: relief.url,
              coordinates: [
                [relief.bounds[0][1], relief.bounds[1][0]],
                [relief.bounds[1][1], relief.bounds[1][0]],
                [relief.bounds[1][1], relief.bounds[0][0]],
                [relief.bounds[0][1], relief.bounds[0][0]],
              ],
            },
          }),
          farm: { type: "geojson", data: features(props) },
        },
        layers: [
          { id: "shade", type: "raster", source: "shade" },
          ...(relief ? [{ id: "relief", type: "raster" as const, source: "relief", paint: { "raster-opacity": 0.95 } }] : []),
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
      m.setLayoutProperty("shade", "visibility", ground ? "visible" : "none")
      if (m.getLayer("relief")) m.setLayoutProperty("relief", "visibility", ground ? "visible" : "none")
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
