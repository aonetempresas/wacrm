"use client"

import { Users } from 'lucide-react'
import type { RepPerformanceRow } from '@/lib/dashboard/types'
import { formatCurrency } from '@/lib/currency'
import { useAuth } from '@/hooks/use-auth'
import { EmptyState } from './empty-state'
import { Skeleton } from './skeleton'
import { useTranslations } from 'next-intl'

interface RepPerformanceProps {
  rows: RepPerformanceRow[] | null
  loading: boolean
}

/**
 * Per-salesperson scoreboard for the current month (Aonet briefing 6.1):
 * wins, won value, average ticket, close rate and open pipeline. A
 * management view — the page only renders it for admins+. Numbers come
 * from `loadRepPerformance`; empty until deals are won/lost.
 */
export function RepPerformance({ rows, loading }: RepPerformanceProps) {
  const t = useTranslations('Dashboard.repPerformance')
  const { defaultCurrency } = useAuth()

  return (
    <section className="rounded-xl border border-border bg-card">
      <header className="border-b border-border px-5 py-4">
        <h2 className="text-sm font-semibold text-foreground">{t('title')}</h2>
        <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
      </header>

      {loading || !rows ? (
        <div className="space-y-2 p-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="p-5">
          <EmptyState icon={Users} title={t('empty')} hint={t('emptyHint')} />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-2.5 font-medium">{t('colRep')}</th>
                <th className="px-3 py-2.5 text-right font-medium">{t('colWon')}</th>
                <th className="px-3 py-2.5 text-right font-medium">{t('colWonValue')}</th>
                <th className="px-3 py-2.5 text-right font-medium">{t('colTicket')}</th>
                <th className="px-3 py-2.5 text-right font-medium">{t('colCloseRate')}</th>
                <th className="px-5 py-2.5 text-right font-medium">{t('colPipeline')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.userId ?? 'unassigned'} className="text-foreground">
                  <td className="whitespace-nowrap px-5 py-2.5 font-medium">
                    {r.userId ? r.name : t('unassigned')}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{r.wonCount}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {formatCurrency(r.wonValue, defaultCurrency)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                    {r.wonCount > 0 ? formatCurrency(r.ticket, defaultCurrency) : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {r.closeRate == null ? '—' : `${Math.round(r.closeRate * 100)}%`}
                  </td>
                  <td className="whitespace-nowrap px-5 py-2.5 text-right tabular-nums text-muted-foreground">
                    {formatCurrency(r.openValue, defaultCurrency)}
                    {r.openCount > 0 && (
                      <span className="ml-1 text-[11px]">({r.openCount})</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
