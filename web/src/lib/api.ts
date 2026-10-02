import type { LatLng } from "./flood"

// All weather and elevation data: Open-Meteo (CC BY 4.0). Forecast = best-match models, archive = ERA5.
const TZ = "timezone=Pacific%2FFiji"

export type Weather = {
  hourly: { time: string[]; rain: number[] }
  daily: { time: string[]; rain: number[]; temp: number[]; code: number[]; prob?: number[] }
}

/** Ba River discharge (m³/s) per day; `members` are the GloFAS ensemble runs, forecast only. */
export type Flow = { time: string[]; q: number[]; members?: number[][] }

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

export const REPLAY = { name: "Cyclone Cody", start: "2022-01-06", end: "2022-01-12" }

export async function getWeather([lat, lng]: LatLng, replay: boolean): Promise<Weather> {
  const at = `latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&${TZ}&hourly=precipitation`
  const url = replay
    ? `https://archive-api.open-meteo.com/v1/archive?${at}&start_date=${REPLAY.start}&end_date=${REPLAY.end}&daily=precipitation_sum,temperature_2m_max,weather_code`
    : `https://api.open-meteo.com/v1/forecast?${at}&forecast_days=7&daily=precipitation_sum,temperature_2m_max,weather_code,precipitation_probability_max`
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

/** The Cyclone Cody replay, shipped with the site (scripts/build_ba_data.py) so the demo never waits on an API. */
export async function getCodyReplay(): Promise<{ weather: Weather; flow: Flow }> {
  const d = await fetch("/data/ba/cody.json").then((r) => r.json())
  return { weather: d, flow: { time: d.daily.time, q: d.daily.discharge } }
}

/** GloFAS v4 river discharge forecast, 7 days, with its 50-member ensemble (Copernicus EMS via Open-Meteo). */
export async function getFlowForecast([lat, lng]: LatLng): Promise<Flow> {
  const url = `https://flood-api.open-meteo.com/v1/flood?latitude=${lat}&longitude=${lng}&daily=river_discharge&forecast_days=7&ensemble=true`
  const d = await cachedJson(url, HOUR, (s) =>
    s === 429 ? "The river forecast service is busy right now. Wait a minute, then try again." : `The river forecast returned an error (${s}). Try again in a minute.`,
  )
  const members = Object.keys(d.daily)
    .filter((k) => k.startsWith("river_discharge_member"))
    .map((k) => d.daily[k] as number[])
  return { time: d.daily.time, q: d.daily.river_discharge, members }
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
 * Days per year with 50 mm+ rain at Ba (−17.53, 177.67), ERA5 via the Open-Meteo archive API,
 * daily precipitation_sum 1991-01-01 → 2024-12-31, pulled 2 Oct 2026. Static so the page never waits on 12k rows.
 */
export const HEAVY_RAIN_DAYS: [number, number][] = [
  [1991, 3], [1992, 3], [1993, 4], [1994, 6], [1995, 1], [1996, 8], [1997, 15], [1998, 3], [1999, 5], [2000, 6],
  [2001, 1], [2002, 3], [2003, 2], [2004, 4], [2005, 4], [2006, 1], [2007, 5], [2008, 7], [2009, 9], [2010, 3],
  [2011, 5], [2012, 17], [2013, 3], [2014, 4], [2015, 2], [2016, 9], [2017, 4], [2018, 16], [2019, 6], [2020, 5],
  [2021, 11], [2022, 14], [2023, 7], [2024, 15],
]
