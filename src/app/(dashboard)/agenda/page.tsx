"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useCan } from "@/hooks/use-can";
import { fetchAccountMembers, memberLabel } from "@/lib/account/members";
import type { AccountMember, Task, TaskType } from "@/types";
import { isToday, isBefore, startOfToday } from "date-fns";
import {
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  RotateCcw,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GatedButton } from "@/components/ui/gated-button";
import { TaskForm } from "@/components/agenda/task-form";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Bucket = "overdue" | "today" | "upcoming" | "done";

const TYPE_ICON: Record<TaskType, typeof Phone> = {
  call: Phone,
  meeting: Users,
  follow_up: RotateCcw,
  whatsapp: MessageCircle,
  other: Circle,
};
const TYPE_LABEL: Record<TaskType, string> = {
  call: "typeCall",
  meeting: "typeMeeting",
  follow_up: "typeFollowUp",
  whatsapp: "typeWhatsapp",
  other: "typeOther",
};
const PRIORITY_ACCENT: Record<string, string> = {
  high: "border-l-red-500",
  normal: "border-l-primary/60",
  low: "border-l-transparent",
};

export default function AgendaPage() {
  const t = useTranslations("Agenda");
  const { accountId, user, canManageMembers } = useAuth();
  const canManage = useCan("send-messages");

  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [members, setMembers] = useState<AccountMember[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [viewAll, setViewAll] = useState(false);
  const [agentFilter, setAgentFilter] = useState("");
  const [showUpcoming, setShowUpcoming] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);

  const load = useCallback(async () => {
    if (!accountId) return;
    const supabase = createClient();
    const { data, error: fetchErr } = await supabase
      .from("tasks")
      .select("*, contact:contacts(id,name,phone), deal:deals(id,title)")
      .eq("account_id", accountId)
      .order("due_at", { ascending: true })
      .limit(500);
    if (fetchErr) {
      setError(fetchErr.message);
      return;
    }
    setError(null);
    setTasks((data ?? []) as Task[]);
  }, [accountId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const m = await fetchAccountMembers();
      if (!cancelled) setMembers(m);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Realtime — refetch on any task change (raw payload has no joins).
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("tasks-page")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => {
        load();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  const memberName = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of members) map.set(m.user_id, memberLabel(m));
    return map;
  }, [members]);

  const filtered = useMemo(() => {
    if (!tasks) return [];
    const uid = user?.id;
    return tasks.filter((task) => {
      if (!canManageMembers || !viewAll) return task.assigned_to === uid;
      if (agentFilter) return task.assigned_to === agentFilter;
      return true;
    });
  }, [tasks, viewAll, agentFilter, canManageMembers, user?.id]);

  const { overdue, today, upcoming, doneArchive } = useMemo(() => {
    const o: Task[] = [];
    const td: Task[] = [];
    const up: Task[] = [];
    const dn: Task[] = [];
    const start = startOfToday();
    for (const task of filtered) {
      const d = new Date(task.due_at);
      if (isToday(d)) {
        td.push(task); // today keeps both pending and done, for the progress bar
        continue;
      }
      if (task.status !== "pending") {
        dn.push(task);
        continue;
      }
      if (isBefore(d, start)) o.push(task);
      else up.push(task);
    }
    const byDue = (a: Task, b: Task) => (a.due_at < b.due_at ? -1 : 1);
    return {
      overdue: o.sort(byDue),
      today: td.sort(byDue),
      upcoming: up.sort(byDue),
      doneArchive: dn.sort((a, b) => (a.due_at > b.due_at ? -1 : 1)),
    };
  }, [filtered]);

  const todayDone = today.filter((x) => x.status !== "pending").length;
  const todayPct = today.length ? Math.round((todayDone / today.length) * 100) : 0;

  const toggleDone = useCallback(
    async (task: Task) => {
      const next = task.status === "pending" ? "done" : "pending";
      const completed_at = next === "done" ? new Date().toISOString() : null;
      setTasks((prev) =>
        prev?.map((x) => (x.id === task.id ? { ...x, status: next, completed_at } : x)) ?? prev,
      );
      const supabase = createClient();
      const { error: updErr } = await supabase
        .from("tasks")
        .update({ status: next, completed_at })
        .eq("id", task.id);
      if (updErr) {
        toast.error(t("toastFailed"));
        load();
      } else {
        toast.success(next === "done" ? t("toastCompleted") : t("toastReopened"));
      }
    },
    [t, load],
  );

  const reschedule = useCallback(
    async (task: Task, target: Date) => {
      const src = new Date(task.due_at);
      target.setHours(src.getHours(), src.getMinutes(), 0, 0);
      const due_at = target.toISOString();
      setTasks((prev) => prev?.map((x) => (x.id === task.id ? { ...x, due_at } : x)) ?? prev);
      const supabase = createClient();
      const { error: updErr } = await supabase.from("tasks").update({ due_at }).eq("id", task.id);
      if (updErr) {
        toast.error(t("toastFailed"));
        load();
      } else {
        toast.success(t("toastRescheduled"));
      }
    },
    [t, load],
  );

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (task: Task) => {
    setEditing(task);
    setFormOpen(true);
  };

  const renderTask = (task: Task, bucket: Bucket) => {
    const Icon = TYPE_ICON[task.type] ?? Circle;
    const d = new Date(task.due_at);
    const isDone = task.status !== "pending";
    const when = isToday(d)
      ? d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
      : `${d.toLocaleDateString(undefined, { weekday: "short", day: "2-digit", month: "short" })} · ${d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`;
    const assigneeName = task.assigned_to ? memberName.get(task.assigned_to) : null;

    return (
      <li
        key={task.id}
        className={cn(
          "flex items-center gap-3 rounded-xl border border-l-[3px] bg-card p-3 transition-colors hover:border-border/70 sm:p-3.5",
          PRIORITY_ACCENT[task.priority],
          bucket === "overdue" && "bg-red-500/5",
          isDone && "opacity-60",
        )}
      >
        {/* Checkbox — the primary "mark done" action */}
        {canManage ? (
          <button
            type="button"
            onClick={() => toggleDone(task)}
            title={isDone ? t("reopen") : t("markDone")}
            aria-label={isDone ? t("reopen") : t("markDone")}
            className="flex-shrink-0 text-muted-foreground transition-colors hover:text-primary"
          >
            {isDone ? (
              <CheckCircle2 className="h-6 w-6 text-primary" />
            ) : (
              <Circle className="h-6 w-6" />
            )}
          </button>
        ) : (
          <span className="flex-shrink-0" aria-hidden>
            {isDone ? (
              <CheckCircle2 className="h-6 w-6 text-primary" />
            ) : (
              <Circle className="h-6 w-6 text-muted-foreground" />
            )}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <span
            className={cn(
              "block truncate text-sm font-semibold text-foreground",
              isDone && "text-muted-foreground line-through",
            )}
          >
            {task.title}
          </span>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span
              className={cn(
                "inline-flex items-center gap-1 font-medium",
                bucket === "overdue" && !isDone && "text-red-400",
              )}
            >
              <Clock className="h-3 w-3" /> {when}
            </span>
            <span className="inline-flex items-center gap-1">
              <Icon className="h-3 w-3" /> {t(TYPE_LABEL[task.type])}
            </span>
            {task.contact?.name || task.contact?.phone ? (
              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5">
                {task.contact.name || task.contact.phone}
              </span>
            ) : null}
            {task.deal?.title ? (
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                {task.deal.title}
              </span>
            ) : null}
            {canManageMembers && viewAll && assigneeName ? (
              <span className="inline-flex items-center gap-1">
                <Users className="h-3 w-3" /> {assigneeName}
              </span>
            ) : null}
          </div>
        </div>

        {canManage && (
          <div className="flex flex-shrink-0 items-center gap-1">
            {bucket === "overdue" && !isDone && (
              <button
                type="button"
                onClick={() => reschedule(task, new Date())}
                title={t("moveToToday")}
                aria-label={t("moveToToday")}
                className="flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-primary hover:bg-primary/10"
              >
                <CalendarClock className="h-3.5 w-3.5" /> {t("sectionToday")}
              </button>
            )}
            {(bucket === "today" || bucket === "upcoming") && !isDone && (
              <button
                type="button"
                onClick={() => {
                  const tm = new Date();
                  tm.setDate(tm.getDate() + 1);
                  reschedule(task, tm);
                }}
                title={t("snoozeTomorrow")}
                aria-label={t("snoozeTomorrow")}
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Clock className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => openEdit(task)}
              title={t("edit")}
              aria-label={t("edit")}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Pencil className="h-4 w-4" />
            </button>
          </div>
        )}
      </li>
    );
  };

  if (error) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <p className="text-sm text-destructive">{t("loadError")}</p>
        <Button variant="outline" onClick={() => load()}>
          {t("retry")}
        </Button>
      </div>
    );
  }

  if (tasks === null) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const nothing = overdue.length + today.length + upcoming.length + doneArchive.length === 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <GatedButton canAct={canManage} gateReason={t("gateManage")} onClick={openNew}>
          <Plus className="mr-1 h-4 w-4" />
          {t("newTask")}
        </GatedButton>
      </div>

      {/* Summary strip — compact, glance and go */}
      <div className="flex flex-wrap gap-2">
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg border px-3 py-1.5",
            overdue.length > 0 ? "border-red-500/30 bg-red-500/5" : "border-border bg-card",
          )}
        >
          <span className={cn("text-lg font-bold leading-none", overdue.length > 0 ? "text-red-400" : "text-foreground")}>
            {overdue.length}
          </span>
          <span className="text-xs text-muted-foreground">{t("sectionOverdue")}</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
          <span className="text-lg font-bold leading-none text-foreground">{today.length}</span>
          <span className="text-xs text-muted-foreground">{t("sectionToday")}</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
          <span className="text-lg font-bold leading-none text-foreground">{upcoming.length}</span>
          <span className="text-xs text-muted-foreground">{t("sectionUpcoming")}</span>
        </div>
      </div>

      {/* Manager filters */}
      {canManageMembers && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-border p-0.5">
            <button
              type="button"
              onClick={() => {
                setViewAll(false);
                setAgentFilter("");
              }}
              className={cn(
                "rounded-md px-3 py-1 text-sm font-medium transition-colors",
                !viewAll ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t("filterMine")}
            </button>
            <button
              type="button"
              onClick={() => setViewAll(true)}
              className={cn(
                "rounded-md px-3 py-1 text-sm font-medium transition-colors",
                viewAll ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t("filterAll")}
            </button>
          </div>
          {viewAll && (
            <select
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              className="h-9 rounded-lg border border-border bg-muted px-2.5 text-sm text-foreground outline-none focus:border-primary"
            >
              <option value="">{t("allAgents")}</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {memberLabel(m)}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {nothing ? (
        <div className="flex h-56 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/40">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <CalendarCheck className="h-6 w-6 text-primary" />
          </div>
          <p className="mt-3 text-sm font-medium text-foreground">{t("emptyTitle")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("emptyDesc")}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Overdue — resolve first */}
          {overdue.length > 0 && (
            <section>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-red-400">
                {t("sectionOverdue")}
                <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium">
                  {overdue.length}
                </span>
                <span className="text-xs font-normal text-muted-foreground">· {t("overdueHint")}</span>
              </h2>
              <ul className="space-y-2">{overdue.map((task) => renderTask(task, "overdue"))}</ul>
            </section>
          )}

          {/* Today — the hero, with progress */}
          <section>
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                {t("sectionToday")}
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {today.length}
                </span>
              </h2>
              {today.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted sm:w-32">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${todayPct}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {t("progress", { done: todayDone, total: today.length })}
                  </span>
                </div>
              )}
            </div>
            {today.length > 0 ? (
              <ul className="space-y-2">{today.map((task) => renderTask(task, "today"))}</ul>
            ) : (
              <p className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-xs text-muted-foreground">
                {t("emptyDesc")}
              </p>
            )}
          </section>

          {/* Upcoming — collapsed by default */}
          {upcoming.length > 0 && (
            <section>
              <button
                type="button"
                onClick={() => setShowUpcoming((v) => !v)}
                className="flex items-center gap-2 text-sm font-semibold text-foreground hover:text-primary"
              >
                {showUpcoming ? t("hideUpcoming") : t("showUpcoming")}
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {upcoming.length}
                </span>
              </button>
              {showUpcoming && (
                <ul className="mt-2 space-y-2">{upcoming.map((task) => renderTask(task, "upcoming"))}</ul>
              )}
            </section>
          )}

          {/* Completed archive — collapsed */}
          {doneArchive.length > 0 && (
            <section>
              <button
                type="button"
                onClick={() => setShowCompleted((v) => !v)}
                className="text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                {showCompleted ? t("hideCompleted") : t("showCompleted")} ({doneArchive.length})
              </button>
              {showCompleted && (
                <ul className="mt-2 space-y-2">{doneArchive.map((task) => renderTask(task, "done"))}</ul>
              )}
            </section>
          )}
        </div>
      )}

      <TaskForm open={formOpen} onOpenChange={setFormOpen} task={editing} onSaved={load} />
    </div>
  );
}
