import type { LatLng } from "./flood"

// All weather and elevation data: Open-Meteo (CC BY 4.0). Forecast = best-match models, archive = ERA5.
const TZ = "timezone=Australia%2FSydney"

export type Weather = {
  hourly: { time: string[]; rain: number[] }
  daily: { time: string[]; rain: number[]; temp: number[]; code: number[]; prob?: number[] }
}

/** Richmond River discharge (m³/s) per day; `members` are the GloFAS ensemble runs, forecast only. */
export type Flow = { time: string[]; q: number[]; members?: number[][]; url: string; fetchedAt?: number }

const HOUR = 3_600_000

/**
 * fetch + JSON with a localStorage cache, so reloads during a demo don't burn Open-Meteo's rate limit.
 * Archive and elevation data never change; the forecast is reused for an hour.
 * ponytail: no eviction; localStorage's ~5 MB cap is plenty for a handful of fields.
 */
async function cachedJson(url: string, ttlMs: number, fail: (status: number) => string) {
  try {
    const hit = JSON.parse(localStorage.getItem(url) ?? "null")
    if (hit && Date.now() - hit.at < ttlMs) return hit.data
  } catch {
    /* storage blocked or corrupt: just fetch */
  }
  const r = await fetch(url)
  if (!r.ok) throw new Error(fail(r.status))
  const data = await r.json()
  try {
    localStorage.setItem(url, JSON.stringify({ at: Date.now(), data }))
  } catch {
    /* full or blocked: fine without cache */
  }
  return data
}

export const REPLAY = { name: "February 2022 flood", start: "2022-02-24", end: "2022-03-04" }

/** The exact request Draki makes for rain, so anyone can open it and see the raw numbers. */
export function weatherUrl([lat, lng]: LatLng, replay: boolean) {
  const at = `latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&${TZ}&hourly=precipitation`
  return replay
    ? `https://archive-api.open-meteo.com/v1/archive?${at}&start_date=${REPLAY.start}&end_date=${REPLAY.end}&daily=precipitation_sum,temperature_2m_max,weather_code`
    : `https://api.open-meteo.com/v1/forecast?${at}&forecast_days=7&daily=precipitation_sum,temperature_2m_max,weather_code,precipitation_probability_max`
}

/** When a cached response was fetched (ms), for showing how fresh the data is. */
const fetchedAt = (url: string) => {
  try {
    return JSON.parse(localStorage.getItem(url) ?? "null")?.at as number | undefined
  } catch {
    return undefined
  }
}

export const riverUrl = ([lat, lng]: LatLng, replay: boolean) =>
  `https://flood-api.open-meteo.com/v1/flood?latitude=${lat}&longitude=${lng}&daily=river_discharge` +
  (replay ? `&start_date=${REPLAY.start}&end_date=${REPLAY.end}` : "&forecast_days=7&ensemble=true")

export async function getWeather(center: LatLng, replay: boolean): Promise<Weather> {
  const url = weatherUrl(center, replay)
  const d = await cachedJson(url, replay ? Infinity : HOUR, (s) =>
    s === 429 ? "The weather service is busy right now. Wait a minute, then try again." : `The weather service returned an error (${s}). Try again in a minute.`,
  )
  return {
    hourly: { time: d.hourly.time, rain: d.hourly.precipitation },
    daily: {
      time: d.daily.time,
      rain: d.daily.precipitation_sum,
      temp: d.daily.temperature_2m_max,
      code: d.daily.weather_code,
      prob: d.daily.precipitation_probability_max,
    },
  }
}

/** The February 2022 flood replay, shipped with the site (scripts/build_region.py) so the demo never waits on an API. */
export async function getEventReplay(glofas: LatLng): Promise<{ weather: Weather; flow: Flow }> {
  const d = await fetch("/data/richmond/event.json").then((r) => r.json())
  return { weather: d, flow: { time: d.daily.time, q: d.daily.discharge, url: riverUrl(glofas, true) } }
}

/** Weekly peak Richmond River flow (GloFAS), shipped static for the Validation chart. */
export const getFlowHistory = (): Promise<{ time: string[]; q: number[] }> => fetch("/data/richmond/flow.json").then((r) => r.json())

/** GloFAS v4 river discharge forecast, 7 days, with its 50-member ensemble (Copernicus EMS via Open-Meteo). */
export async function getFlowForecast(glofas: LatLng): Promise<Flow> {
  const url = riverUrl(glofas, false)
  const d = await cachedJson(url, HOUR, (s) =>
    s === 429 ? "The river forecast service is busy right now. Wait a minute, then try again." : `The river forecast returned an error (${s}). Try again in a minute.`,
  )
  const members = Object.keys(d.daily)
    .filter((k) => k.startsWith("river_discharge_member"))
    .map((k) => d.daily[k] as number[])
  return { time: d.daily.time, q: d.daily.river_discharge, members, url, fetchedAt: fetchedAt(url) }
}

/** Copernicus GLO-90 DEM via Open-Meteo. Max 100 points per call. */
export async function getElevations(points: LatLng[]): Promise<number[]> {
  const q = (i: 0 | 1) => points.map((p) => p[i].toFixed(5)).join(",")
  const d = await cachedJson(`https://api.open-meteo.com/v1/elevation?latitude=${q(0)}&longitude=${q(1)}`, Infinity, (s) =>
    s === 429 ? "The elevation service is busy right now. Wait a minute, then try again." : `We couldn't read the land height for this field (error ${s}). Try redrawing it.`,
  )
  return d.elevation
}

/**
 * Days per year with 50 mm+ rain at Woodburn (−29.07, 153.34), ERA5 via the Open-Meteo archive API,
 * calendar years 1991–2025 (scripts/build_season_data.py, October 2026). Static so the page never waits on 12k rows.
 */
export const HEAVY_RAIN_DAYS: [number, number][] = [
  [1991, 2], [1992, 0], [1993, 0], [1994, 1], [1995, 0], [1996, 4], [1997, 2], [1998, 0], [1999, 0], [2000, 0],
  [2001, 1], [2002, 0], [2003, 2], [2004, 2], [2005, 1], [2006, 5], [2007, 1], [2008, 3], [2009, 2], [2010, 2],
  [2011, 1], [2012, 3], [2013, 2], [2014, 1], [2015, 1], [2016, 1], [2017, 4], [2018, 0], [2019, 0], [2020, 4],
  [2021, 7], [2022, 5], [2023, 0], [2024, 2], [2025, 3],
]
