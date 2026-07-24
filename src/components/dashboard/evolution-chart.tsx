"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import { TrendingUp } from 'lucide-react'
import type { EvolutionSeries } from '@/lib/dashboard/types'
import { formatCurrency, formatCompactNumber } from '@/lib/currency'
import { CURRENCIES, DEFAULT_CURRENCY } from '@/lib/currency'
import { EmptyState } from './empty-state'
import { Skeleton } from './skeleton'
import { useTranslations } from 'next-intl'

interface EvolutionChartProps {
  data: EvolutionSeries | null
  loading: boolean
  currency: string
}

// Same viewBox strategy as the conversations chart: fixed coordinate
// space, CSS-scaled. See that component for the CTM-hover rationale.
const VB_W = 760
const VB_H = 240
const PADDING = { top: 16, right: 16, bottom: 28, left: 52 }

const WON = '#16a34a' // green-600
const LOST = '#dc2626' // red-600

export function EvolutionChart({ data, loading, currency }: EvolutionChartProps) {
  const t = useTranslations('Dashboard.evolutionChart')
  const points = data?.points ?? []

  const { maxY, niceTicks } = useMemo(() => {
    const max = points.reduce((m, p) => Math.max(m, p.wonValue, p.lostValue), 0)
    const ceil = niceCeil(max)
    const ticks = [0, ceil / 4, ceil / 2, (3 * ceil) / 4, ceil]
    return { maxY: ceil, niceTicks: Array.from(new Set(ticks)) }
  }, [points])

  const isEmpty = points.every((p) => p.wonValue === 0 && p.lostValue === 0)

  return (
    <section className="flex h-full flex-col rounded-xl border border-border bg-card">
      <header className="border-b border-border px-5 py-4">
        <h2 className="text-sm font-semibold text-foreground">{t('title')}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{t('description')}</p>
      </header>

      <div className="p-5">
        {loading || !data ? (
          <Skeleton className="h-[240px] w-full" />
        ) : isEmpty ? (
          <EmptyState icon={TrendingUp} title={t('empty')} hint={t('emptyHint')} />
        ) : (
          <LineSvg
            data={data}
            maxY={maxY}
            ticks={niceTicks}
            currency={currency}
            t={t}
          />
        )}
      </div>

      <footer className="flex items-center gap-4 border-t border-border px-5 py-3 text-xs text-muted-foreground">
        <LegendDot color={WON} label={t('won')} />
        <LegendDot color={LOST} label={t('lost')} />
      </footer>
    </section>
  )
}

function LineSvg({
  data,
  maxY,
  ticks,
  currency,
  t,
}: {
  data: EvolutionSeries
  maxY: number
  ticks: number[]
  currency: string
  t: ReturnType<typeof useTranslations>
}) {
  const points = data.points
  const [hover, setHover] = useState<{ idx: number; tooltipLeftPx: number } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const chartW = VB_W - PADDING.left - PADDING.right
  const chartH = VB_H - PADDING.top - PADDING.bottom

  const stepX = points.length > 1 ? chartW / (points.length - 1) : 0
  const yFor = (v: number) =>
    maxY === 0 ? PADDING.top + chartH : PADDING.top + chartH - (v / maxY) * chartH
  const xFor = (i: number) => PADDING.left + i * stepX

  const wonPath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${xFor(i)},${yFor(p.wonValue)}`)
    .join(' ')
  const lostPath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${xFor(i)},${yFor(p.lostValue)}`)
    .join(' ')
  // Subtle area fill under the "won" line so the positive trend reads
  // at a glance (the director's headline number).
  const wonArea =
    points.length > 0
      ? `${wonPath} L${xFor(points.length - 1)},${PADDING.top + chartH} L${xFor(0)},${
          PADDING.top + chartH
        } Z`
      : ''

  // CTM-inverse hover mapping — identical approach to the conversations
  // chart (accounts for letterboxing under preserveAspectRatio).
  useEffect(() => {
    const svg = svgRef.current
    const wrap = wrapRef.current
    if (!svg || !wrap) return
    const onMove = (e: MouseEvent) => {
      const ctm = svg.getScreenCTM()
      if (!ctm) return
      const pt = svg.createSVGPoint()
      pt.x = e.clientX
      pt.y = e.clientY
      const local = pt.matrixTransform(ctm.inverse())
      const xVb = local.x
      if (xVb < PADDING.left - 8 || xVb > VB_W - PADDING.right + 8) {
        setHover(null)
        return
      }
      const relative = xVb - PADDING.left
      const idx = Math.max(
        0,
        Math.min(points.length - 1, Math.round(stepX === 0 ? 0 : relative / stepX)),
      )
      const dataPointPt = svg.createSVGPoint()
      dataPointPt.x = PADDING.left + idx * stepX
      dataPointPt.y = 0
      const screen = dataPointPt.matrixTransform(ctm)
      const wrapRect = wrap.getBoundingClientRect()
      setHover({ idx, tooltipLeftPx: screen.x - wrapRect.left })
    }
    const onLeave = () => setHover(null)
    svg.addEventListener('mousemove', onMove)
    svg.addEventListener('mouseleave', onLeave)
    return () => {
      svg.removeEventListener('mousemove', onMove)
      svg.removeEventListener('mouseleave', onLeave)
    }
  }, [points, stepX])

  const hovered = hover !== null ? points[hover.idx] : null
  const hoverX = hover !== null ? xFor(hover.idx) : 0
  const labelStride = Math.max(1, Math.ceil(points.length / 6))

  return (
    <div ref={wrapRef} className="relative w-full">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="h-[240px] w-full"
        role="img"
        aria-label={t('ariaLabel')}
      >
        {/* Y-axis gridlines + compact currency labels */}
        {ticks.map((tick) => {
          const y = yFor(tick)
          return (
            <g key={tick}>
              <line
                x1={PADDING.left}
                x2={VB_W - PADDING.right}
                y1={y}
                y2={y}
                stroke="var(--border)"
                strokeDasharray="3 3"
              />
              <text
                x={PADDING.left - 8}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-muted-foreground text-[10px]"
              >
                {shortCurrency(tick, currency)}
              </text>
            </g>
          )
        })}

        {/* X-axis labels */}
        {points.map((p, i) =>
          i % labelStride === 0 ? (
            <text
              key={p.bucket}
              x={xFor(i)}
              y={VB_H - 8}
              textAnchor="middle"
              className="fill-muted-foreground text-[10px]"
            >
              {axisLabel(p.bucket, data.granularity)}
            </text>
          ) : null,
        )}

        {/* Won area + line (green) */}
        {wonArea && <path d={wonArea} fill={WON} fillOpacity={0.08} stroke="none" />}
        <path
          d={wonPath}
          fill="none"
          stroke={WON}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Lost line (red) */}
        <path
          d={lostPath}
          fill="none"
          stroke={LOST}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Hover crosshair */}
        {hover !== null && (
          <g pointerEvents="none">
            <line
              x1={hoverX}
              x2={hoverX}
              y1={PADDING.top}
              y2={PADDING.top + chartH}
              stroke="var(--muted-foreground)"
              strokeDasharray="3 3"
            />
            <circle cx={hoverX} cy={yFor(points[hover.idx].wonValue)} r={3.5} fill={WON} />
            <circle cx={hoverX} cy={yFor(points[hover.idx].lostValue)} r={3.5} fill={LOST} />
          </g>
        )}
      </svg>

      {hovered && hover !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-md border border-border bg-popover px-2.5 py-1.5 text-[11px] shadow-lg"
          style={{ left: `${hover.tooltipLeftPx}px` }}
        >
          <div className="font-medium text-popover-foreground">
            {tooltipLabel(hovered.bucket, data.granularity)}
          </div>
          <div className="mt-1 flex flex-col gap-0.5">
            <span className="flex items-center gap-1.5" style={{ color: WON }}>
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: WON }} />
              {t('tooltipWon', {
                value: formatCurrency(hovered.wonValue, currency),
                count: hovered.wonCount,
              })}
            </span>
            <span className="flex items-center gap-1.5" style={{ color: LOST }}>
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: LOST }} />
              {t('tooltipLost', {
                value: formatCurrency(hovered.lostValue, currency),
                count: hovered.lostCount,
              })}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  )
}

/** "R$ 1,2k"-style compact value for the Y axis. */
function shortCurrency(value: number, currency: string): string {
  const code = currency || DEFAULT_CURRENCY
  const symbol = CURRENCIES.find((c) => c.code === code)?.symbol ?? ''
  return value === 0 ? '0' : `${symbol}${formatCompactNumber(value)}`
}

/** Bucket key ("YYYY-MM-DD" | "YYYY-MM") → short x-axis label. */
function axisLabel(bucket: string, granularity: 'day' | 'month'): string {
  const parts = bucket.split('-').map(Number)
  if (granularity === 'month') {
    const date = new Date(parts[0], parts[1] - 1, 1)
    return date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
  }
  const date = new Date(parts[0], parts[1] - 1, parts[2])
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

/** Longer label for the hover tooltip. */
function tooltipLabel(bucket: string, granularity: 'day' | 'month'): string {
  const parts = bucket.split('-').map(Number)
  if (granularity === 'month') {
    const date = new Date(parts[0], parts[1] - 1, 1)
    return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  }
  const date = new Date(parts[0], parts[1] - 1, parts[2])
  return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

function niceCeil(max: number): number {
  if (max <= 0) return 4
  const pow = Math.pow(10, Math.floor(Math.log10(max)))
  const normalised = max / pow
  let nice: number
  if (normalised <= 1) nice = 1
  else if (normalised <= 2) nice = 2
  else if (normalised <= 5) nice = 5
  else nice = 10
  return nice * pow
}
