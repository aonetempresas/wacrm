"use client";

import { useState } from "react";
import type { Deal } from "@/types";
import { formatCurrency } from "@/lib/currency";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { Trophy, XCircle, Calendar } from "lucide-react";
import { useTranslations } from "next-intl";

interface ClosedDealsViewProps {
  /** Deals already filtered to the given outcome. */
  deals: Deal[];
  mode: "won" | "lost";
  onEditDeal: (deal: Deal) => void;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function firstOfMonth() {
  const n = new Date();
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-01`;
}
function today() {
  const n = new Date();
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
}

/**
 * "Ganhos" / "Perdidos" — the sales record of closed deals, with a
 * calendar date-range filter (De / Até). Won deals show the trophy +
 * close date; lost deals show the loss reasons + lost date. Distinct
 * from the active funnel and from Voalle (the operational carteira).
 */
export function ClosedDealsView({ deals, mode, onEditDeal }: ClosedDealsViewProps) {
  const t = useTranslations(mode === "won" ? "Pipelines.won" : "Pipelines.lost");
  const tf = useTranslations("Pipelines.closedFilter");
  const tProd = useTranslations("Pipelines.products");
  const tLoss = useTranslations("Pipelines.lostReasons");
  const { defaultCurrency } = useAuth();
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());

  const dateOf = (d: Deal) => (mode === "won" ? d.won_at : d.lost_at);

  const inRange = (iso?: string | null) => {
    if (!iso) return !from && !to; // undated rows only when the range is cleared
    const ts = new Date(iso).getTime();
    if (from && ts < new Date(`${from}T00:00:00`).getTime()) return false;
    if (to && ts > new Date(`${to}T23:59:59`).getTime()) return false;
    return true;
  };

  const rows = deals
    .filter((d) => inRange(dateOf(d)))
    .sort((a, b) => {
      const ta = dateOf(a) ? new Date(dateOf(a)!).getTime() : 0;
      const tb = dateOf(b) ? new Date(dateOf(b)!).getTime() : 0;
      return tb - ta;
    });
  const total = rows.reduce((s, d) => s + Number(d.value || 0), 0);

  const Icon = mode === "won" ? Trophy : XCircle;
  const accent = mode === "won" ? "text-primary" : "text-red-400";
  const iconBg =
    mode === "won" ? "bg-primary/10 text-primary" : "bg-red-500/10 text-red-400";

  const label = (d: Deal) =>
    d.contact?.company?.trim() || d.contact?.name || d.contact?.phone || d.title;

  return (
    <div className="space-y-4">
      {/* Total + calendar date-range filter */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Icon className={cn("h-5 w-5", accent)} />
          <div>
            <p className="text-sm font-semibold text-foreground">
              {t("total", {
                count: rows.length,
                value: formatCurrency(total, defaultCurrency),
              })}
            </p>
            <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            {tf("from")}
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-9 rounded-lg border border-border bg-muted px-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </label>
          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            {tf("to")}
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-9 rounded-lg border border-border bg-muted px-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </label>
          {(from || to) && (
            <button
              type="button"
              onClick={() => {
                setFrom("");
                setTo("");
              }}
              className="h-9 rounded-lg px-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {tf("clear")}
            </button>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30">
          <Icon className="h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium text-foreground">{t("empty")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("emptyHint")}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((d) => {
            const productLabel = d.products?.length ? tProd(d.products[0]) : null;
            const dt = dateOf(d);
            return (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => onEditDeal(d)}
                  className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-border/70 hover:bg-muted/40"
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full",
                      iconBg,
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {label(d)}
                    </span>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      {productLabel && (
                        <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                          {productLabel}
                        </span>
                      )}
                      {mode === "lost" &&
                        d.lost_reasons?.map((r) => (
                          <span
                            key={r}
                            className="inline-flex items-center rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-400"
                          >
                            {tLoss(r)}
                          </span>
                        ))}
                      {dt && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {t("closedOn", { date: new Date(dt).toLocaleDateString() })}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className={cn("flex-shrink-0 text-sm font-bold", accent)}>
                    {formatCurrency(d.value, d.currency)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
