"use client"

import { cn } from "@/lib/utils"
import { useTranslations } from "next-intl"

export interface Period {
  /** YYYY-MM-DD (inclusive). */
  from: string
  /** YYYY-MM-DD (inclusive). */
  to: string
}

function fmt(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`
}

/** Default period: the last 30 days. */
export function defaultPeriod(): Period {
  const n = new Date()
  const f = new Date(n)
  f.setDate(f.getDate() - 29)
  return { from: fmt(f), to: fmt(n) }
}

/**
 * Global period selector for the Painel. The calendar (De/Até) leads,
 * with rolling-window shortcuts beside it. One control drives every
 * results panel, so all numbers stay in sync for the same window — and
 * you can compare periods by switching it.
 */
export function PeriodFilter({
  period,
  onChange,
}: {
  period: Period
  onChange: (p: Period) => void
}) {
  const t = useTranslations("Dashboard.period")
  const n = new Date()

  const rollDays = (days: number): Period => {
    const f = new Date(n)
    f.setDate(f.getDate() - (days - 1))
    return { from: fmt(f), to: fmt(n) }
  }

  const presets: { key: string; make: () => Period }[] = [
    { key: "last7", make: () => rollDays(7) },
    { key: "last30", make: () => rollDays(30) },
    {
      key: "lastYear",
      make: () => {
        const f = new Date(n)
        f.setFullYear(f.getFullYear() - 1)
        return { from: fmt(f), to: fmt(n) }
      },
    },
    {
      key: "lastMonth",
      make: () => ({
        from: fmt(new Date(n.getFullYear(), n.getMonth() - 1, 1)),
        to: fmt(new Date(n.getFullYear(), n.getMonth(), 0)),
      }),
    },
  ]
  const activeKey = presets.find((p) => {
    const pp = p.make()
    return pp.from === period.from && pp.to === period.to
  })?.key

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Calendar leads */}
      <div className="flex items-center gap-1.5">
        <input
          type="date"
          value={period.from}
          max={period.to}
          onChange={(e) => onChange({ ...period, from: e.target.value })}
          className="h-8 rounded-lg border border-border bg-muted px-2 text-xs text-foreground outline-none focus:border-primary"
        />
        <span className="text-xs text-muted-foreground">{t("to")}</span>
        <input
          type="date"
          value={period.to}
          min={period.from}
          onChange={(e) => onChange({ ...period, to: e.target.value })}
          className="h-8 rounded-lg border border-border bg-muted px-2 text-xs text-foreground outline-none focus:border-primary"
        />
      </div>
      {/* Rolling-window shortcuts */}
      <div className="inline-flex flex-wrap rounded-lg border border-border p-0.5">
        {presets.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => onChange(p.make())}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              activeKey === p.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t(p.key)}
          </button>
        ))}
      </div>
    </div>
  )
}
