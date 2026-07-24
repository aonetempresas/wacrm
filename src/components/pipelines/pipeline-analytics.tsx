"use client";

import { useMemo } from "react";
import type { Deal } from "@/types";
import { BarChart3, DollarSign, Flame, Clock, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency } from "@/lib/currency";
import { STUCK_DAYS } from "@/lib/crm/aonet-lists";
import { useTranslations } from "next-intl";

interface PipelineAnalyticsProps {
  deals: Deal[];
}

/**
 * Funnel top strip — operator-focused glance (Aonet): how many open
 * deals, how much is in play, where the heat is, and what's stalling.
 * Manager metrics (conversion, ticket, wins by rep) live on the Painel;
 * won/lost live in the Ganhos/Perdidos views.
 */
export function PipelineAnalytics({ deals }: PipelineAnalyticsProps) {
  const t = useTranslations("Pipelines.analytics");
  const { defaultCurrency } = useAuth();

  const stats = useMemo(() => {
    const open = deals.filter((d) => d.status !== "won" && d.status !== "lost");
    const openValue = open.reduce((sum, d) => sum + Number(d.value || 0), 0);
    const hot = open.filter((d) => d.temperature === "quente").length;
    const cutoff = Date.now() - STUCK_DAYS * 86_400_000;
    const stuck = open.filter((d) => {
      const ts = d.updated_at ?? d.created_at;
      return ts ? new Date(ts).getTime() < cutoff : false;
    }).length;
    return { openCount: open.length, openValue, hot, stuck };
  }, [deals]);

  return (
    <TooltipProvider>
      <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-card/60 p-4 sm:grid-cols-4">
        <Metric
          icon={<BarChart3 className="h-4 w-4 text-muted-foreground" />}
          label={t("openDeals")}
          value={String(stats.openCount)}
          tooltip={t("openDealsTooltip")}
          t={t}
        />
        <Metric
          icon={<DollarSign className="h-4 w-4 text-primary" />}
          label={t("inNegotiation")}
          value={formatCurrency(stats.openValue, defaultCurrency)}
          tooltip={t("inNegotiationTooltip")}
          t={t}
        />
        <Metric
          icon={<Flame className="h-4 w-4 text-red-500" />}
          label={t("hot")}
          value={String(stats.hot)}
          tooltip={t("hotTooltip")}
          t={t}
        />
        <Metric
          icon={<Clock className="h-4 w-4 text-amber-500" />}
          label={t("stuck")}
          value={String(stats.stuck)}
          tooltip={t("stuckTooltip")}
          t={t}
        />
      </div>
    </TooltipProvider>
  );
}

function Metric({
  icon,
  label,
  value,
  tooltip,
  t,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tooltip: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: any;
}) {
  return (
    <div className="rounded-lg bg-muted/50 p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {icon}
        <span>{label}</span>
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                aria-label={t("howCalculated", { label })}
                className="ml-auto text-muted-foreground hover:text-foreground focus:outline-none"
              />
            }
          >
            <Info className="h-3 w-3" />
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-left">
            {tooltip}
          </TooltipContent>
        </Tooltip>
      </div>
      <p className="mt-1 text-base font-semibold text-foreground">{value}</p>
    </div>
  );
}
