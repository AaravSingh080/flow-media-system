import { useId, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { fmtDate } from '@/lib/format'
import { cn } from '@/components/ui/cn'

/* ------------------------------------------------------------------ *
 * Charts
 *
 * Hand-rolled SVG. Every chart here plots a single measure, so each one
 * uses a single hue and needs no legend — the title names the series.
 * Two measures of different scale are never put on one pair of axes;
 * where both matter (points and count) the second rides in the tooltip.
 * ------------------------------------------------------------------ */

const AXIS = 'var(--c-line)'
const MUTED = 'var(--c-fg-faint)'

/* ------------------------------ Area trend ---------------------------- */

export interface TrendPoint {
  ts: number
  value: number
  /** Secondary figure surfaced on hover rather than on a second axis. */
  meta?: string
}

export function AreaTrend({
  data,
  height = 160,
  tone = 'var(--c-accent)',
  label,
  valueSuffix = '',
}: {
  data: TrendPoint[]
  height?: number
  tone?: string
  label: string
  valueSuffix?: string
}) {
  const gradId = useId()
  const [hover, setHover] = useState<number | null>(null)
  const W = 640
  const H = height
  const padY = 14
  const padX = 4

  const max = Math.max(1, ...data.map((d) => d.value))
  const step = data.length > 1 ? (W - padX * 2) / (data.length - 1) : 0
  const x = (i: number) => padX + i * step
  const y = (v: number) => padY + (1 - v / max) * (H - padY * 2)

  const line = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(2)},${y(d.value).toFixed(2)}`).join(' ')
  const area = `${line} L${x(data.length - 1).toFixed(2)},${H - padY} L${x(0).toFixed(2)},${H - padY} Z`

  const active = hover !== null ? data[hover] : null

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
        role="img"
        aria-label={`${label} over the last ${data.length} days`}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          const ratio = (e.clientX - rect.left) / rect.width
          setHover(Math.max(0, Math.min(data.length - 1, Math.round(ratio * (data.length - 1)))))
        }}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={tone} stopOpacity="0.28" />
            <stop offset="100%" stopColor={tone} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Recessive baseline + midline only — no full grid. */}
        <line x1="0" y1={H - padY} x2={W} y2={H - padY} stroke={AXIS} strokeWidth="1" />
        <line x1="0" y1={padY + (H - padY * 2) / 2} x2={W} y2={padY + (H - padY * 2) / 2} stroke={AXIS} strokeWidth="1" strokeDasharray="3 5" />

        <motion.path
          d={area}
          fill={`url(#${gradId})`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        />
        <motion.path
          d={line}
          fill="none"
          stroke={tone}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />

        {active && hover !== null && (
          <>
            <line x1={x(hover)} y1={padY - 6} x2={x(hover)} y2={H - padY} stroke={AXIS} strokeWidth="1" />
            <circle cx={x(hover)} cy={y(active.value)} r="4.5" fill={tone} stroke="var(--c-panel)" strokeWidth="2" />
          </>
        )}
      </svg>

      {active && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-line bg-panel px-2.5 py-1.5 shadow-lift"
          style={{ left: `${(hover! / Math.max(1, data.length - 1)) * 100}%` }}
        >
          <p className="num text-xs font-semibold">
            {active.value}
            {valueSuffix}
          </p>
          <p className="text-[10px] text-fg-faint">{fmtDate(active.ts)}</p>
          {active.meta && <p className="mt-0.5 text-[10px] text-fg-muted">{active.meta}</p>}
        </div>
      )}
    </div>
  )
}

/* --------------------------- Ranked bar list -------------------------- */

export interface RankedRow {
  id: string
  label: string
  value: number
  sub?: string
  /** Optional status marker rendered as an icon + label, never colour alone. */
  flag?: { label: string; tone: 'amber' | 'rose' }
  leading?: React.ReactNode
}

export function RankedBars({
  rows,
  unit,
  tone = 'var(--c-accent)',
  emptyLabel = 'Nothing to rank yet.',
}: {
  rows: RankedRow[]
  unit: string
  tone?: string
  emptyLabel?: string
}) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  if (!rows.length) return <p className="py-6 text-center text-[13px] text-fg-faint">{emptyLabel}</p>

  return (
    <ol className="space-y-1">
      {rows.map((r, i) => (
        <li key={r.id}>
          <div className="group/row relative flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-panel-2">
            <span className="num w-5 shrink-0 text-right text-[11px] text-fg-faint">{i + 1}</span>
            {r.leading}
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <p className="truncate text-[13px] font-medium">{r.label}</p>
                <p className="num shrink-0 text-[13px] font-semibold">
                  {r.value}
                  <span className="ml-1 text-[10px] font-normal text-fg-faint">{unit}</span>
                </p>
              </div>
              {/* 4px rounded data-end, anchored to the baseline. */}
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-panel-3">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: tone }}
                  initial={{ width: 0 }}
                  animate={{ width: `${(r.value / max) * 100}%` }}
                  transition={{ type: 'spring', stiffness: 90, damping: 20, delay: i * 0.04 }}
                />
              </div>
              {(r.sub || r.flag) && (
                <p className="mt-1 flex items-center gap-2 text-[11px] text-fg-faint">
                  {r.sub}
                  {r.flag && (
                    <span className={cn('inline-flex items-center gap-1 font-medium', r.flag.tone === 'rose' ? 'text-rose' : 'text-amber')}>
                      <span aria-hidden>▲</span>
                      {r.flag.label}
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>
        </li>
      ))}
    </ol>
  )
}

/* ------------------------------ Radial score -------------------------- */

/**
 * A single headline number. Banded by status, and the band is always
 * spelled out in words next to it — never carried by colour alone.
 */
export function RadialScore({
  value,
  size = 128,
  label,
  caption,
}: {
  value: number
  size?: number
  label?: string
  caption?: string
}) {
  const band = useMemo(() => {
    if (value >= 80) return { tone: 'var(--c-accent)', word: 'Strong' }
    if (value >= 60) return { tone: 'var(--c-cyan)', word: 'Steady' }
    if (value >= 35) return { tone: 'var(--c-amber)', word: 'Patchy' }
    return { tone: 'var(--c-rose)', word: 'At risk' }
  }, [value])

  const stroke = 9
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  const dash = (Math.max(0, Math.min(100, value)) / 100) * circumference

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" role="img" aria-label={`${label ?? 'Score'}: ${value} out of 100, ${band.word}`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--c-panel-3)" strokeWidth={stroke} />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={band.tone}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference - dash }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="num text-2xl font-semibold leading-none">{value}</span>
          <span className="mt-1 text-[10px] uppercase tracking-wider text-fg-faint">/ 100</span>
        </div>
      </div>
      <p className="mt-3 text-[13px] font-medium" style={{ color: band.tone }}>
        {band.word}
      </p>
      {caption && <p className="mt-0.5 text-center text-[11px] leading-relaxed text-fg-faint">{caption}</p>}
    </div>
  )
}

/* -------------------------------- Sparkline --------------------------- */

export function Sparkline({ values, tone = 'var(--c-accent)', width = 88, height = 26 }: { values: number[]; tone?: string; width?: number; height?: number }) {
  if (values.length < 2) return <div style={{ width, height }} />
  const max = Math.max(...values, 1)
  const step = width / (values.length - 1)
  const d = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(height - (v / max) * (height - 3) - 1.5).toFixed(1)}`).join(' ')
  return (
    <svg width={width} height={height} aria-hidden className="overflow-visible">
      <path d={d} fill="none" stroke={tone} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* ------------------------------ Status meter -------------------------- */

/** Proportional strip. Segments are separated by a 2px surface gap. */
export function StatusMeter({ segments }: { segments: { label: string; value: number; tone: string }[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0)
  if (!total) return <div className="h-2 rounded-full bg-panel-3" />
  return (
    <div className="space-y-2.5">
      <div className="flex h-2 gap-0.5 overflow-hidden">
        {segments
          .filter((s) => s.value > 0)
          .map((s) => (
            <motion.div
              key={s.label}
              className="h-full rounded-full first:rounded-l-full last:rounded-r-full"
              style={{ background: s.tone }}
              initial={{ flexGrow: 0 }}
              animate={{ flexGrow: s.value }}
              transition={{ type: 'spring', stiffness: 90, damping: 22 }}
            />
          ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {segments.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5 text-[11px] text-fg-muted">
            <span className="h-2 w-2 rounded-sm" style={{ background: s.tone }} />
            {s.label}
            <span className="num font-medium text-fg">{s.value}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

export { MUTED }
