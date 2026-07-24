"use client"

import Link from 'next/link'
import { useState } from 'react'
import {
  MessageSquare,
  UserPlus,
  Briefcase,
  Radio,
  Zap,
  Inbox,
  ChevronDown,
} from 'lucide-react'
import type { ComponentType } from 'react'
import type { ActivityItem, ActivityKind } from '@/lib/dashboard/types'
import { cn } from '@/lib/utils'
import { EmptyState } from './empty-state'
import { Skeleton } from './skeleton'
import { useTranslations } from 'next-intl'

interface ActivityFeedProps {
  items: ActivityItem[] | null
  loading: boolean
}

// How many recent events to consider — a glance, not a full history.
const MAX_ITEMS = 20

interface KindTheme {
  icon: ComponentType<{ className?: string }>
  /** Tailwind classes for the round icon badge + label color. */
  badge: string
}

const KIND_THEME: Record<ActivityKind, KindTheme> = {
  message: { icon: MessageSquare, badge: 'bg-blue-500/10 text-blue-400' },
  contact: { icon: UserPlus, badge: 'bg-primary/10 text-primary' },
  deal: { icon: Briefcase, badge: 'bg-primary/10 text-primary' },
  broadcast: { icon: Radio, badge: 'bg-amber-500/10 text-amber-400' },
  automation: { icon: Zap, badge: 'bg-rose-500/10 text-rose-400' },
}

type T = ReturnType<typeof useTranslations>

function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

/** Build the (translated) sentence for one activity item. */
function sentence(it: ActivityItem, t: T): string {
  const someone = t('someone')
  switch (it.kind) {
    case 'message':
      return t('msgFrom', { who: it.subject || someone })
    case 'contact':
      return t('newContact', { name: it.subject || someone })
    case 'deal':
      return it.variant === 'stage'
        ? t('dealInStage', { title: it.subject ?? '', stage: it.context ?? '' })
        : t('dealUpdated', { title: it.subject ?? '' })
    case 'broadcast':
      return it.variant === 'sent'
        ? t('broadcastSent', { name: it.subject ?? '', count: it.count ?? 0 })
        : t('broadcastOther', { name: it.subject ?? '' })
    case 'automation':
      return it.variant === 'failed'
        ? t('autoFailed', { name: it.subject || t('anAutomation'), who: it.context || someone })
        : t('autoTriggered', { name: it.subject || t('anAutomation'), who: it.context || someone })
    default:
      return ''
  }
}

export function ActivityFeed({ items, loading }: ActivityFeedProps) {
  const t = useTranslations('Dashboard.activityFeed')
  // Each day is a collapsible group. Today starts open; older days start
  // collapsed — so the list stays short and you expand a day on click.
  const [openDays, setOpenDays] = useState<Set<string>>(() => new Set([dayKey(new Date())]))
  const toggle = (key: string) =>
    setOpenDays((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  // Group the recent events by calendar day (items already sorted desc,
  // so the Map keeps days newest-first).
  const dayMap = new Map<string, ActivityItem[]>()
  for (const it of (items ?? []).slice(0, MAX_ITEMS)) {
    const key = dayKey(new Date(it.at))
    const arr = dayMap.get(key)
    if (arr) arr.push(it)
    else dayMap.set(key, [it])
  }
  const dayGroups = [...dayMap.entries()]

  const todayKey = dayKey(new Date())
  const yd = new Date()
  yd.setDate(yd.getDate() - 1)
  const yesterdayKey = dayKey(yd)
  const dayLabel = (key: string) => {
    if (key === todayKey) return t('groupToday')
    if (key === yesterdayKey) return t('groupYesterday')
    return new Date(`${key}T00:00:00`).toLocaleDateString(undefined, {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    })
  }

  return (
    <section className="rounded-xl border border-border bg-card">
      <header className="border-b border-border px-5 py-4">
        <h2 className="text-sm font-semibold text-foreground">{t('title')}</h2>
      </header>

      {loading || !items ? (
        <div className="space-y-2 p-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : dayGroups.length === 0 ? (
        <div className="p-5">
          <EmptyState icon={Inbox} title={t('noActivity')} hint={t('noActivityHint')} />
        </div>
      ) : (
        <div className="divide-y divide-border">
          {dayGroups.map(([key, its]) => {
            const isOpen = openDays.has(key)
            return (
              <div key={key}>
                <button
                  type="button"
                  onClick={() => toggle(key)}
                  className="flex w-full items-center gap-2 px-5 py-2.5 text-left transition-colors hover:bg-muted/40"
                >
                  <ChevronDown
                    className={cn(
                      'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform',
                      !isOpen && '-rotate-90',
                    )}
                  />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {dayLabel(key)}
                  </span>
                  <span className="rounded-full bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
                    {its.length}
                  </span>
                </button>

                {isOpen && (
                  <ul className="pb-1">
                    {its.map((it) => {
                      const theme = KIND_THEME[it.kind]
                      const Icon = theme.icon
                      const row = (
                        <div className="flex items-center gap-3 py-2.5 pl-11 pr-5">
                          <span
                            className={cn(
                              'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full',
                              theme.badge,
                            )}
                          >
                            <Icon className="h-3.5 w-3.5" />
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                            {sentence(it, t)}
                          </span>
                          <span className="flex-shrink-0 text-xs text-muted-foreground tabular-nums">
                            {relativeTime(it.at, t)}
                          </span>
                        </div>
                      )
                      return (
                        <li key={it.id} className="transition-colors hover:bg-muted/40">
                          {it.href ? (
                            <Link href={it.href} className="block">
                              {row}
                            </Link>
                          ) : (
                            row
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

function relativeTime(iso: string, t: T): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diffSec = Math.round((Date.now() - then) / 1000)
  if (diffSec < 60) return t('timeS', { sec: Math.max(1, diffSec) })
  if (diffSec < 3600) return t('timeM', { min: Math.floor(diffSec / 60) })
  if (diffSec < 86400) return t('timeH', { hr: Math.floor(diffSec / 3600) })
  if (diffSec < 2_592_000) return t('timeD', { day: Math.floor(diffSec / 86400) })
  return new Date(iso).toLocaleDateString()
}
