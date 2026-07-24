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
// Height is fixed; width is MEASURED from the container so the drawing
// fills the full card (no letterboxing on wide screens) and 1 user unit
// maps to 1px — keeping circles perfectly round.
const DEFAULT_W = 760
const VB_H = 240
const PADDING = { top: 16, right: 16, bottom: 28, left: 52 }

// Ganho na cor quente (laranja) porque "salta" mais no fundo claro — é o
// número que o vendedor quer ver primeiro. Perda no verde (mais sóbrio).
// Duas cores bem distintas, inclusive para quem confunde vermelho/verde.
const WON = '#ea580c' // orange-600 — ganho (destaque)
const LOST = '#16a34a' // green-600 — perda

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
  const [vbW, setVbW] = useState(DEFAULT_W)
  const svgRef = useRef<SVGSVGElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Measure the container so the viewBox width matches the rendered
  // pixel width (1:1). Fills the whole card and avoids the centred
  // letterbox that left big empty margins on wide screens.
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        setVbW(Math.max(320, Math.round(e.contentRect.width)))
      }
    })
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [])

  const chartW = vbW - PADDING.left - PADDING.right
  const chartH = VB_H - PADDING.top - PADDING.bottom

  const stepX = points.length > 1 ? chartW / (points.length - 1) : 0
  const yFor = (v: number) =>
    maxY === 0 ? PADDING.top + chartH : PADDING.top + chartH - (v / maxY) * chartH
  const xFor = (i: number) => PADDING.left + i * stepX

  const baseY = PADDING.top + chartH
  const wonPts = points.map((p, i) => ({ x: xFor(i), y: yFor(p.wonValue) }))
  const lostPts = points.map((p, i) => ({ x: xFor(i), y: yFor(p.lostValue) }))
  // Smooth monotone curves — premium look without overshooting below
  // the zero baseline (values are never negative).
  const wonPath = smoothPath(wonPts)
  const lostPath = smoothPath(lostPts)
  // Soft gradient area under the "won" curve so the positive trend
  // reads at a glance (the director's headline).
  const wonArea =
    wonPts.length > 0
      ? `${wonPath} L${wonPts[wonPts.length - 1].x},${baseY} L${wonPts[0].x},${baseY} Z`
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
      if (xVb < PADDING.left - 8 || xVb > vbW - PADDING.right + 8) {
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
  }, [points, stepX, vbW])

  const hovered = hover !== null ? points[hover.idx] : null
  const hoverX = hover !== null ? xFor(hover.idx) : 0
  const labelStride = Math.max(1, Math.ceil(points.length / 6))

  return (
    <div ref={wrapRef} className="relative w-full">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${vbW} ${VB_H}`}
        className="h-[240px] w-full"
        role="img"
        aria-label={t('ariaLabel')}
      >
        <defs>
          <linearGradient id="evoWonFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={WON} stopOpacity={0.22} />
            <stop offset="100%" stopColor={WON} stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* Y-axis gridlines + compact currency labels */}
        {ticks.map((tick) => {
          const y = yFor(tick)
          return (
            <g key={tick}>
              <line
                x1={PADDING.left}
                x2={vbW - PADDING.right}
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

        {/* Won area + curve (green) */}
        {wonArea && <path d={wonArea} fill="url(#evoWonFill)" stroke="none" />}
        <path
          d={wonPath}
          fill="none"
          stroke={WON}
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Lost curve (red) */}
        <path
          d={lostPath}
          fill="none"
          stroke={LOST}
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Dots only on days that actually had an event — keeps quiet
            stretches clean instead of a dot on every zero. */}
        {points.map((p, i) =>
          p.wonValue > 0 ? (
            <circle
              key={`w-${p.bucket}`}
              cx={xFor(i)}
              cy={yFor(p.wonValue)}
              r={2.5}
              fill="var(--card)"
              stroke={WON}
              strokeWidth={1.75}
            />
          ) : null,
        )}
        {points.map((p, i) =>
          p.lostValue > 0 ? (
            <circle
              key={`l-${p.bucket}`}
              cx={xFor(i)}
              cy={yFor(p.lostValue)}
              r={2.5}
              fill="var(--card)"
              stroke={LOST}
              strokeWidth={1.75}
            />
          ) : null,
        )}

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
  // Add ~12% headroom first so the tallest point doesn't touch the top
  // edge, then round up to a "nice" number. Finer tiers (incl. 2.5/3)
  // keep the curve filling the box instead of stranding it in the
  // lower half — the "empty top" that made it look robusto.
  const target = max * 1.12
  const pow = Math.pow(10, Math.floor(Math.log10(target)))
  const normalised = target / pow
  let nice: number
  if (normalised <= 1) nice = 1
  else if (normalised <= 1.5) nice = 1.5
  else if (normalised <= 2) nice = 2
  else if (normalised <= 2.5) nice = 2.5
  else if (normalised <= 3) nice = 3
  else if (normalised <= 4) nice = 4
  else if (normalised <= 5) nice = 5
  else if (normalised <= 7.5) nice = 7.5
  else nice = 10
  return nice * pow
}

/**
 * Monotone cubic (Fritsch–Carlson) spline as an SVG path. Produces the
 * smooth premium curve while guaranteeing no overshoot below the zero
 * baseline — important since won/lost values are never negative and a
 * naive Catmull-Rom would dip under the axis on sparse spiky data.
 */
function smoothPath(pts: { x: number; y: number }[]): string {
  const n = pts.length
  if (n === 0) return ''
  if (n === 1) return `M${pts[0].x},${pts[0].y}`
  if (n === 2) return `M${pts[0].x},${pts[0].y} L${pts[1].x},${pts[1].y}`

  const dx: number[] = []
  const slope: number[] = []
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1].x - pts[i].x
    slope[i] = (pts[i + 1].y - pts[i].y) / dx[i]
  }

  const m: number[] = new Array(n)
  m[0] = slope[0]
  m[n - 1] = slope[n - 2]
  for (let i = 1; i < n - 1; i++) {
    if (slope[i - 1] * slope[i] <= 0) {
      m[i] = 0
    } else {
      const w1 = 2 * dx[i] + dx[i - 1]
      const w2 = dx[i] + 2 * dx[i - 1]
      m[i] = (w1 + w2) / (w1 / slope[i - 1] + w2 / slope[i])
    }
  }

  let d = `M${pts[0].x},${pts[0].y}`
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3
    const c1x = pts[i].x + h
    const c1y = pts[i].y + h * m[i]
    const c2x = pts[i + 1].x - h
    const c2y = pts[i + 1].y - h * m[i + 1]
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${pts[i + 1].x},${pts[i + 1].y}`
  }
  return d
}
