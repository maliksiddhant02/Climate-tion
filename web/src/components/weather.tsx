import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSun, Sun } from "lucide-react"
import { HEAVY_RAIN_DAYS } from "@/lib/api"

/** WMO weather code → icon + plain label. */
export function wx(code: number) {
  if (code >= 95) return { Icon: CloudLightning, label: "Thunderstorms" }
  if (code >= 61) return { Icon: CloudRain, label: code >= 65 ? "Heavy rain" : "Rain" }
  if (code >= 51) return { Icon: CloudDrizzle, label: "Drizzle" }
  if (code >= 45) return { Icon: CloudFog, label: "Fog" }
  if (code >= 3) return { Icon: Cloud, label: "Cloudy" }
  if (code >= 1) return { Icon: CloudSun, label: "Partly cloudy" }
  return { Icon: Sun, label: "Clear" }
}

const day = (iso: string) => new Date(iso).toLocaleDateString("en-AU", { weekday: "short" })

/** Rounded data-end, square at the baseline. */
const bar = (x: number, y: number, w: number, h: number, r = 4) =>
  h < r
    ? `M${x},${y + h}V${y}H${x + w}V${y + h}Z`
    : `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`

const niceMax = (v: number) => [10, 20, 25, 50, 100, 150, 200, 300].find((n) => n >= v) ?? Math.ceil(v / 100) * 100

/** The 72 h window the model uses, as 3-hourly bars. Dark surface. */
export function RainBars({ time, rain, start }: { time: string[]; rain: number[]; start: number }) {
  const buckets = Array.from({ length: 24 }, (_, i) => {
    const s = start + i * 3
    return { t: time[s], mm: rain.slice(s, s + 3).reduce((a, b) => a + (b || 0), 0) }
  }).filter((b) => b.t)
  const W = 480, H = 150, padL = 28, padB = 22
  const max = niceMax(Math.max(1, ...buckets.map((b) => b.mm)))
  const slot = (W - padL) / 24
  const bw = Math.min(14, slot - 2)
  const y = (v: number) => (H - padB) * (1 - v / max)
  const peak = buckets.reduce((a, b, i) => (b.mm > buckets[a].mm ? i : a), 0)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Rain in 3-hour steps, peak ${buckets[peak]?.mm.toFixed(0)} mm`}>
      {[0, max / 2, max].map((v) => (
        <g key={v}>
          <line x1={padL} x2={W} y1={y(v)} y2={y(v)} stroke="white" strokeOpacity={0.08} />
          <text x={padL - 6} y={y(v) + 3} textAnchor="end" className="fill-white/60 text-[10px] tabular-nums">{v}</text>
        </g>
      ))}
      {buckets.map((b, i) => {
        const x = padL + i * slot + (slot - bw) / 2
        return (
          <g key={b.t}>
            <rect x={padL + i * slot} y={0} width={slot} height={H - padB} fill="transparent">
              <title>{`${day(b.t)} ${b.t.slice(11, 16)} · ${b.mm.toFixed(1)} mm`}</title>
            </rect>
            {b.mm > 0 && <path d={bar(x, y(b.mm), bw, H - padB - y(b.mm))} fill="#5a8fd8" pointerEvents="none" />}
            {b.t.endsWith("T00:00") && (
              <text x={x + bw / 2} y={H - 6} textAnchor="middle" className="fill-white/60 text-[10px]">{day(b.t)}</text>
            )}
          </g>
        )
      })}
      {buckets[peak]?.mm > 0 && (
        <text x={padL + peak * slot + slot / 2} y={y(buckets[peak].mm) - 6} textAnchor="middle" className="fill-white text-[10px]">
          {buckets[peak].mm.toFixed(0)} mm
        </text>
      )}
    </svg>
  )
}

const mean = (from: number, to: number) => {
  const r = HEAVY_RAIN_DAYS.filter(([y]) => y >= from && y <= to)
  return r.reduce((s, [, n]) => s + n, 0) / r.length
}
export const DECADES = { then: mean(1991, 2000), now: mean(2015, 2024) }

/** 50 mm+ rain days per year at Ba, 1991–2024; the two compared decades in rain blue, the rest recessive. Light surface. */
export function HeavyRainChart() {
  const W = 640, H = 220, padL = 26, padB = 24, padT = 26
  const n = HEAVY_RAIN_DAYS.length
  const slot = (W - padL) / n
  const bw = Math.min(12, slot - 2)
  const max = 20
  const y = (v: number) => padT + (H - padB - padT) * (1 - v / max)
  const x = (i: number) => padL + i * slot + (slot - bw) / 2
  const idx = (yr: number) => HEAVY_RAIN_DAYS.findIndex(([y]) => y === yr)
  const decade = (from: number, to: number, m: number, label: string) => (
    <g>
      <line x1={x(idx(from))} x2={x(idx(to)) + bw} y1={y(m)} y2={y(m)} stroke="#13211a" strokeWidth={1.5} />
      <text x={x(idx(from))} y={y(m) - 6} stroke="#fbf8f1" strokeWidth={4} paintOrder="stroke" className="fill-ink text-[10px]">{label}</text>
    </g>
  )
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Days with 50 mm or more rain at Ba: ${DECADES.then.toFixed(1)} a year in 1991–2000, ${DECADES.now.toFixed(1)} a year in 2015–2024`}>
        {[0, 5, 10, 15, 20].map((v) => (
          <g key={v}>
            <line x1={padL} x2={W} y1={y(v)} y2={y(v)} stroke="#d9d0bd" />
            <text x={padL - 6} y={y(v) + 3} textAnchor="end" className="fill-[#525e56] text-[10px] tabular-nums">{v}</text>
          </g>
        ))}
        {HEAVY_RAIN_DAYS.map(([yr, d], i) => {
          const hot = (yr >= 1991 && yr <= 2000) || (yr >= 2015 && yr <= 2024)
          return (
            <g key={yr}>
              <path d={bar(x(i), y(d), bw, y(0) - y(d))} fill={hot ? "#3c6fae" : "#cdc3ad"} />
              <rect x={padL + i * slot} y={padT} width={slot} height={H - padB - padT} fill="transparent">
                <title>{`${yr}: ${d} days with 50 mm+`}</title>
              </rect>
              {[1991, 2000, 2015, 2024].includes(yr) && (
                <text x={yr === 2024 ? x(i) + bw : x(i) + bw / 2} y={H - 6} textAnchor={yr === 2024 ? "end" : "middle"} className="fill-[#525e56] text-[10px]">{yr}</text>
              )}
            </g>
          )
        })}
        {decade(1991, 2000, DECADES.then, `1990s avg ${DECADES.then.toFixed(1)}`)}
        {decade(2015, 2024, DECADES.now, `2015–24 avg ${DECADES.now.toFixed(1)}`)}
      </svg>
      <details className="mt-3 text-sm text-muted-foreground">
        <summary className="cursor-pointer">Show the numbers</summary>
        <table className="mt-2 w-full max-w-sm tabular-nums">
          <tbody className="grid grid-cols-3 gap-x-6">
            {HEAVY_RAIN_DAYS.map(([yr, d]) => (
              <tr key={yr} className="flex justify-between border-b border-rule py-0.5">
                <td>{yr}</td>
                <td>{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}
