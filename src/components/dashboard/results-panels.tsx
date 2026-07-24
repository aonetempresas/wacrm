"use client"

import { XCircle, Radio } from "lucide-react"
import { formatCurrency } from "@/lib/currency"
import { useAuth } from "@/hooks/use-auth"
import { EmptyState } from "./empty-state"
import { useTranslations } from "next-intl"
import type { SalesResults } from "@/lib/dashboard/types"

function Bar({ pct, className }: { pct: number; className: string }) {
  return (
    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
      <div className={`h-full rounded-full ${className}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function Skel() {
  return (
    <div className="space-y-2 p-5">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-6 w-full animate-pulse rounded bg-muted" />
      ))}
    </div>
  )
}

/** Ranking of loss reasons this month — "por que perdemos" (briefing 6.2). */
export function LossReasonsPanel({
  items,
  loading,
}: {
  items: SalesResults["lossReasons"] | null
  loading: boolean
}) {
  const t = useTranslations("Dashboard.results")
  const tLoss = useTranslations("Pipelines.lostReasons")
  const max = items?.length ? Math.max(...items.map((i) => i.count)) : 0

  return (
    <section className="rounded-xl border border-border bg-card">
      <header className="border-b border-border px-5 py-4">
        <h2 className="text-sm font-semibold text-foreground">{t("lossTitle")}</h2>
        <p className="text-xs text-muted-foreground">{t("thisMonth")}</p>
      </header>
      {loading || !items ? (
        <Skel />
      ) : items.length === 0 ? (
        <div className="p-5">
          <EmptyState icon={XCircle} title={t("lossEmpty")} hint={t("lossEmptyHint")} />
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((it) => (
            <li key={it.reason} className="px-5 py-2.5">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="text-foreground">{tLoss(it.reason)}</span>
                <span className="font-semibold text-foreground">{it.count}</span>
              </div>
              <Bar pct={max ? (it.count / max) * 100 : 0} className="bg-red-400" />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** Wins by source channel this month — "de onde vêm as vendas" (briefing 6.2). */
export function ByChannelPanel({
  items,
  loading,
}: {
  items: SalesResults["byChannel"] | null
  loading: boolean
}) {
  const t = useTranslations("Dashboard.results")
  const tChan = useTranslations("Pipelines.channels")
  const { defaultCurrency } = useAuth()
  const max = items?.length ? Math.max(...items.map((i) => i.value)) : 0

  return (
    <section className="rounded-xl border border-border bg-card">
      <header className="border-b border-border px-5 py-4">
        <h2 className="text-sm font-semibold text-foreground">{t("channelTitle")}</h2>
        <p className="text-xs text-muted-foreground">{t("thisMonth")}</p>
      </header>
      {loading || !items ? (
        <Skel />
      ) : items.length === 0 ? (
        <div className="p-5">
          <EmptyState icon={Radio} title={t("channelEmpty")} hint={t("channelEmptyHint")} />
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((it) => (
            <li key={it.channel} className="px-5 py-2.5">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="text-foreground">
                  {it.channel === "—" ? t("noChannel") : tChan(it.channel)}
                </span>
                <span className="font-semibold text-primary">
                  {formatCurrency(it.value, defaultCurrency)}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    ({it.count})
                  </span>
                </span>
              </div>
              <Bar pct={max ? (it.value / max) * 100 : 0} className="bg-primary" />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
