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
export const DECADES = { then: mean(1991, 2000), now: mean(2016, 2025) }

/** 50 mm+ rain days per year at Woodburn, 1991–2025; the two compared decades in rain blue, the rest recessive. Light surface. */
export function HeavyRainChart() {
  const W = 640, H = 220, padL = 26, padB = 24, padT = 26
  const n = HEAVY_RAIN_DAYS.length
  const slot = (W - padL) / n
  const bw = Math.min(12, slot - 2)
  const max = Math.max(5, ...HEAVY_RAIN_DAYS.map(([, d]) => d)) + 1
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
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Days with 50 mm or more rain at Woodburn: ${DECADES.then.toFixed(1)} a year in 1991–2000, ${DECADES.now.toFixed(1)} a year in 2016–2025`}>
        {[0, 2, 4, 6, 8].filter((v) => v <= max).map((v) => (
          <g key={v}>
            <line x1={padL} x2={W} y1={y(v)} y2={y(v)} stroke="#d9d0bd" />
            <text x={padL - 6} y={y(v) + 3} textAnchor="end" className="fill-[#525e56] text-[10px] tabular-nums">{v}</text>
          </g>
        ))}
        {HEAVY_RAIN_DAYS.map(([yr, d], i) => {
          const hot = (yr >= 1991 && yr <= 2000) || (yr >= 2016 && yr <= 2025)
          return (
            <g key={yr}>
              <path d={bar(x(i), y(d), bw, y(0) - y(d))} fill={hot ? "#3c6fae" : "#cdc3ad"} />
              <rect x={padL + i * slot} y={padT} width={slot} height={H - padB - padT} fill="transparent">
                <title>{`${yr}: ${d} days with 50 mm+`}</title>
              </rect>
              {[1991, 2000, 2016, 2025].includes(yr) && (
                <text x={yr === 2025 ? x(i) + bw : x(i) + bw / 2} y={H - 6} textAnchor={yr === 2025 ? "end" : "middle"} className="fill-[#525e56] text-[10px]">{yr}</text>
              )}
            </g>
          )
        })}
        {decade(1991, 2000, DECADES.then, `1990s avg ${DECADES.then.toFixed(1)}`)}
        {decade(2016, 2025, DECADES.now, `2016–25 avg ${DECADES.now.toFixed(1)}`)}
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

const linePath = (xs: number[], ys: number[]) => xs.map((x, i) => `${i ? "L" : "M"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join("")

/**
 * Richmond River flow (GloFAS), daily, against the two lines that matter: in its banks below the 2-year flood,
 * "Act today" above the 5-year flood. Ensemble members, when there are any, are the thin lines. Dark surface.
 */
export function RiverChart({ time, q, members, q2, q5, cursor }: { time: string[]; q: (number | null)[]; members?: number[][]; q2: number; q5: number; cursor?: number }) {
  const W = 480, H = 170, padL = 40, padB = 22, padT = 10
  const all = [q, ...(members ?? [])].flat().map((v) => v ?? 0)
  const max = Math.max(q5 * 1.25, ...all) * 1.05
  const x = (i: number) => padL + (i / Math.max(1, time.length - 1)) * (W - padL - 8)
  const y = (v: number) => padT + (H - padB - padT) * (1 - v / max)
  const xs = time.map((_, i) => x(i))
  const peak = Math.max(...q.map((v) => v ?? 0))
  const pi = q.findIndex((v) => v === peak)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Richmond River flow, peak ${Math.round(peak)} cubic metres per second`}>
      {[
        [q2, "Over its banks above this line"],
        [q5, "Act today above this line"],
      ].map(([v, label]) => (
        <g key={label}>
          <line x1={padL} x2={W - 8} y1={y(v as number)} y2={y(v as number)} stroke={v === q5 ? "#d4472a" : "white"} strokeOpacity={v === q5 ? 0.8 : 0.3} strokeDasharray="4 4" />
          <text x={W - 8} y={y(v as number) - 5} textAnchor="end" className="fill-white/60 text-[10px]">{label as string}</text>
        </g>
      ))}
      {members?.map((m, k) => (
        <path key={k} d={linePath(xs, m.map((v) => y(v ?? 0)))} fill="none" stroke="#9db8da" strokeOpacity={0.18} strokeWidth={1} />
      ))}
      <path d={linePath(xs, q.map((v) => y(v ?? 0)))} fill="none" stroke="#5a8fd8" strokeWidth={2.5} strokeLinejoin="round" />
      {cursor !== undefined && (
        // Daily values are plotted at the start of each day; the playhead runs in the same day units.
        <line x1={x(Math.min(time.length - 1, cursor))} x2={x(Math.min(time.length - 1, cursor))} y1={padT} y2={H - padB} stroke="#d4a72c" strokeWidth={2} />
      )}
      {time.map((t, i) => (
        <text key={t} x={xs[i]} y={H - 6} textAnchor="middle" className="fill-white/60 text-[10px]">{day(t)}</text>
      ))}
      <text x={padL - 6} y={y(0) + 3} textAnchor="end" className="fill-white/60 text-[10px] tabular-nums">0</text>
      {peak > 0 && (
        <text x={xs[pi]} y={Math.max(padT + 10, y(peak) - 8)} textAnchor="middle" className="fill-white text-[11px] font-semibold">{"Peak"}</text>
      )}
    </svg>
  )
}

/**
 * Decades of Richmond River flow (GloFAS weekly peaks) with every recorded flood marked. The point of the chart:
 * the floods that made the news are the tallest spikes. Light surface.
 */
export function FlowHistory({ time, q, floods, q2, q5 }: { time: string[]; q: number[]; floods: { start: string; name: string; peak: number; level: string }[]; q2: number; q5: number }) {
  const W = 960, H = 260, padL = 44, padB = 24, padT = 16
  const t0 = new Date(time[0]).getTime()
  const t1 = new Date(time[time.length - 1]).getTime()
  const max = Math.max(...q) * 1.12
  const x = (iso: string) => padL + ((new Date(iso).getTime() - t0) / (t1 - t0)) * (W - padL - 8)
  const y = (v: number) => padT + (H - padB - padT) * (1 - v / max)
  const years = time.map((t) => t.slice(0, 4)).filter((yr, i, a) => a.indexOf(yr) === i && +yr % 5 === 0)
  // One label per year above the Act line, on that year's biggest flood ("2012 ×2" when two floods share a year).
  const big = floods.filter((f) => f.peak >= q5)
  const label = (f: (typeof floods)[number]) => {
    const same = big.filter((g) => g.start.slice(0, 4) === f.start.slice(0, 4))
    if (Math.max(...same.map((g) => g.peak)) !== f.peak) return undefined
    return same.length > 1 ? `${f.start.slice(0, 4)} ×${same.length}` : f.start.slice(0, 4)
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Richmond River flow over the years, with recorded floods marked at the tallest peaks">
      {[0, 500, 1000].map((v) => (
        <g key={v}>
          <line x1={padL} x2={W - 8} y1={y(v)} y2={y(v)} stroke="#d9d0bd" />
          <text x={padL - 6} y={y(v) + 3} textAnchor="end" className="fill-[#525e56] text-[10px] tabular-nums">{v}</text>
        </g>
      ))}
      <line x1={padL} x2={W - 8} y1={y(q5)} y2={y(q5)} stroke="#d4472a" strokeDasharray="5 4" />
      <text x={W - 8} y={y(q5) - 5} textAnchor="end" className="fill-[#a8361f] text-[10px]">{"Act today"}</text>
      <line x1={padL} x2={W - 8} y1={y(q2)} y2={y(q2)} stroke="#6f5539" strokeOpacity={0.6} strokeDasharray="2 4" />
      <text x={W - 8} y={y(q2) - 5} textAnchor="end" className="fill-[#525e56] text-[10px]">{"Watch"}</text>
      <path d={linePath(time.map(x), q.map(y))} fill="none" stroke="#3c6fae" strokeWidth={1.2} strokeLinejoin="round" />
      {floods.map((f) => (
        <g key={f.start}>
          <circle cx={x(f.start)} cy={y(f.peak)} r={5} fill={f.level === "missed" ? "#fbf8f1" : "#d4472a"} stroke="#d4472a" strokeWidth={2}>
            <title>{`${f.name}: ${f.peak} m³/s`}</title>
          </circle>
          {f.peak >= q5 && label(f) && <text x={x(f.start)} y={y(f.peak) - 10} textAnchor="middle" className="fill-ink text-[11px] font-semibold">{label(f)}</text>}
        </g>
      ))}
      {years.map((yr) => (
        <text key={yr} x={x(`${yr}-01-01`)} y={H - 6} textAnchor="middle" className="fill-[#525e56] text-[10px]">{yr}</text>
      ))}
    </svg>
  )
}
