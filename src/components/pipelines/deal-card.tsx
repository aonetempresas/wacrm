"use client";

import type { Deal, PipelineStage } from "@/types";
import { Calendar, Check, X, Flame, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import {
  TEMPERATURE_STYLE,
  STUCK_DAYS,
  type AonetTemperature,
} from "@/lib/crm/aonet-lists";
import { useTranslations } from "next-intl";

interface DealCardProps {
  deal: Deal;
  stage: PipelineStage | null;
  onEdit: (deal: Deal) => void;
  isOverlay?: boolean;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function initials(name?: string, fallback?: string) {
  const source = (name || fallback || "?").trim();
  if (!source) return "?";
  return source.charAt(0).toUpperCase();
}

export function DealCard({ deal, stage, onEdit, isOverlay }: DealCardProps) {
  const t = useTranslations("Pipelines.card");
  const tTemp = useTranslations("Pipelines.temperature");
  const tProd = useTranslations("Pipelines.products");
  const temp = deal.temperature as AonetTemperature | null | undefined;

  const company = deal.contact?.company?.trim();
  const contactName = deal.contact?.name || deal.contact?.phone || null;
  // B2B: the company is the headline; fall back to the person, then the
  // deal's own label so a deal with no contact still reads.
  const primary = company || contactName || deal.title || t("noContact");
  const secondaryName = company ? contactName : null;
  const productLabel = deal.products?.length ? tProd(deal.products[0]) : null;
  const assigneeLabel = deal.assignee?.full_name || null;

  // Attention cues (only meaningful on an open deal in the funnel):
  //  🔥 hot lead → act now;  ⚠️ stalled → nobody worked it in STUCK_DAYS.
  const isHot = temp === "quente";
  const isClosed = deal.status === "won" || deal.status === "lost";
  const lastTouch = deal.updated_at ?? deal.created_at;
  const isStuck =
    !isClosed &&
    !!lastTouch &&
    Date.now() - new Date(lastTouch).getTime() > STUCK_DAYS * 86_400_000;

  return (
    <button
      type="button"
      onClick={(e) => {
        // `onClick` still fires after a non-drag tap because the PointerSensor
        // requires 5px movement before it counts as a drag.
        if (isOverlay) return;
        e.stopPropagation();
        onEdit(deal);
      }}
      title={temp ? tTemp(temp) : undefined}
      className={cn(
        "group relative w-full cursor-pointer rounded-xl border pl-4 pr-3 py-3 text-left shadow-sm transition-all",
        // Whole-card tint by temperature (soft border + faint bg); falls
        // back to the neutral card when the deal has no heat set.
        temp && TEMPERATURE_STYLE[temp]
          ? TEMPERATURE_STYLE[temp].card
          : "border-border/50 bg-muted/70",
        isOverlay ? "shadow-xl" : "hover:-translate-y-0.5 hover:shadow-lg",
      )}
    >
      {/* 4px left accent bar using stage color */}
      <span
        aria-hidden
        className="absolute left-0 top-0 h-full w-1 rounded-l-xl"
        style={{ backgroundColor: stage?.color ?? "#94a3b8" }}
      />

      <div className="flex items-start justify-between gap-2">
        <h4 className="flex-1 text-sm font-semibold leading-snug text-foreground break-words">
          {primary}
        </h4>
        {isHot && (
          <Flame
            aria-label={tTemp("quente")}
            className="h-4 w-4 shrink-0 animate-bounce text-red-500"
          />
        )}
        {isStuck && (
          <AlertTriangle
            aria-label={t("stuck")}
            className="h-4 w-4 shrink-0 animate-pulse text-amber-500"
          />
        )}
        {deal.status === "won" && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
            <Check className="h-3 w-3" />
            {t("won")}
          </span>
        )}
        {deal.status === "lost" && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-400">
            <X className="h-3 w-3" />
            {t("lost")}
          </span>
        )}
      </div>

      {/* Person + product — the supporting line under the company */}
      {(secondaryName || productLabel) && (
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {secondaryName && <span className="truncate">{secondaryName}</span>}
          {productLabel && (
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
              {productLabel}
            </span>
          )}
        </div>
      )}

      {/* Value + close date + assignee */}
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-sm font-bold text-primary">
          {formatCurrency(deal.value, deal.currency)}
        </span>
        <div className="flex items-center gap-2">
          {deal.expected_close_date && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {formatDate(deal.expected_close_date)}
            </span>
          )}
          {assigneeLabel && (
            <span
              title={assigneeLabel}
              className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary"
            >
              {initials(assigneeLabel)}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
