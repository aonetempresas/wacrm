"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { fetchAccountMembers, memberLabel } from "@/lib/account/members";
import type {
  AccountMember,
  Contact,
  Task,
  TaskPriority,
  TaskType,
} from "@/types";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

const TASK_TYPES: TaskType[] = ["call", "meeting", "follow_up", "whatsapp", "other"];
const TASK_PRIORITIES: TaskPriority[] = ["low", "normal", "high"];

// Split a stored ISO timestamp into local date (yyyy-MM-dd) and time
// (HH:mm) strings for the native <input> fields. Built from local
// getters (not toISOString) so the pickers show the user's wall clock.
function splitLocal(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

interface TaskFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task | null;
  onSaved: () => void;
  /** Pre-fill for a NEW task opened from a lead / conversation / deal. */
  defaultContactId?: string | null;
  defaultDealId?: string | null;
  defaultConversationId?: string | null;
}

export function TaskForm({
  open,
  onOpenChange,
  task,
  onSaved,
  defaultContactId,
  defaultDealId,
  defaultConversationId,
}: TaskFormProps) {
  const t = useTranslations("Agenda");
  const supabase = createClient();
  const { accountId, user } = useAuth();

  const [title, setTitle] = useState("");
  const [type, setType] = useState<TaskType>("follow_up");
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [description, setDescription] = useState("");
  const [contactId, setContactId] = useState("");
  const [dealId, setDealId] = useState("");
  const [assignedTo, setAssignedTo] = useState("");

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [members, setMembers] = useState<AccountMember[]>([]);
  const [deals, setDeals] = useState<{ id: string; title: string }[]>([]);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Reset fields whenever the sheet opens (prop-driven sync).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return;
    setConfirmDelete(false);
    if (task) {
      const { date: d, time: tm } = splitLocal(task.due_at);
      setTitle(task.title);
      setType(task.type);
      setPriority(task.priority);
      setDate(d);
      setTime(tm);
      setDescription(task.description ?? "");
      setContactId(task.contact_id ?? "");
      setDealId(task.deal_id ?? "");
      setAssignedTo(task.assigned_to ?? user?.id ?? "");
    } else {
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      setTitle("");
      setType("follow_up");
      setPriority("normal");
      setDate(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
      setTime("09:00");
      setDescription("");
      setContactId(defaultContactId ?? "");
      setDealId(defaultDealId ?? "");
      setAssignedTo(user?.id ?? "");
    }
  }, [open, task, user?.id, defaultContactId, defaultDealId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Load supporting data (contacts + members) once the sheet is open.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const [c, m] = await Promise.all([
        supabase.from("contacts").select("id, name, phone").order("name"),
        fetchAccountMembers(),
      ]);
      if (cancelled) return;
      setContacts((c.data ?? []) as Contact[]);
      setMembers(m);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, supabase]);

  // Load the selected contact's opportunities so a task can link one.
  useEffect(() => {
    if (!open || !contactId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDeals([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("deals")
        .select("id, title")
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      setDeals((data ?? []) as { id: string; title: string }[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, contactId, supabase]);

  async function handleSave() {
    if (!title.trim() || !date) {
      toast.error(t("toastRequired"));
      return;
    }
    if (!accountId || !user) {
      toast.error(t("toastNotAuthenticated"));
      return;
    }
    setSaving(true);

    const dueAt = new Date(`${date}T${time || "09:00"}`).toISOString();
    const payload = {
      title: title.trim(),
      type,
      priority,
      due_at: dueAt,
      description: description.trim() || null,
      contact_id: contactId || null,
      // A deal only makes sense with its contact; drop it if none.
      deal_id: contactId ? dealId || null : null,
      assigned_to: assignedTo || user.id,
    };

    if (task) {
      const { error } = await supabase.from("tasks").update(payload).eq("id", task.id);
      if (error) {
        toast.error(t("toastFailed"));
        setSaving(false);
        return;
      }
    } else {
      const { error } = await supabase.from("tasks").insert({
        ...payload,
        account_id: accountId,
        created_by: user.id,
        conversation_id: defaultConversationId ?? null,
        status: "pending",
      });
      if (error) {
        toast.error(t("toastFailed"));
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    toast.success(task ? t("toastUpdated") : t("toastCreated"));
    onOpenChange(false);
    onSaved();
  }

  async function handleDelete() {
    if (!task) return;
    setDeleting(true);
    const { error } = await supabase.from("tasks").delete().eq("id", task.id);
    setDeleting(false);
    if (error) {
      toast.error(t("toastFailed"));
      return;
    }
    toast.success(t("toastDeleted"));
    setConfirmDelete(false);
    onOpenChange(false);
    onSaved();
  }

  const selectClass =
    "h-9 w-full rounded-lg border border-border bg-muted px-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="bg-popover border-border text-popover-foreground sm:max-w-lg w-full p-0"
      >
        <div className="flex h-full flex-col">
          <SheetHeader className="border-b border-border/50 p-4">
            <SheetTitle className="text-popover-foreground">
              {task ? t("formEditTitle") : t("formNewTitle")}
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            <div className="grid gap-2">
              <Label className="text-muted-foreground">{t("fieldTitle")}</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("titlePlaceholder")}
                className="border-border bg-muted text-foreground"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label className="text-muted-foreground">{t("fieldType")}</Label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as TaskType)}
                  className={selectClass}
                >
                  {TASK_TYPES.map((tp) => (
                    <option key={tp} value={tp}>
                      {t(
                        `type${tp
                          .split("_")
                          .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
                          .join("")}`,
                      )}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label className="text-muted-foreground">{t("fieldPriority")}</Label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                  className={selectClass}
                >
                  {TASK_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {t(`priority${p.charAt(0).toUpperCase() + p.slice(1)}`)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label className="text-muted-foreground">{t("fieldDate")}</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="border-border bg-muted text-foreground"
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-muted-foreground">{t("fieldTime")}</Label>
                <Input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="border-border bg-muted text-foreground"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label className="text-muted-foreground">{t("fieldContact")}</Label>
              <select
                value={contactId}
                onChange={(e) => {
                  setContactId(e.target.value);
                  setDealId("");
                }}
                className={selectClass}
              >
                <option value="">{t("selectContact")}</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || c.phone}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label className="text-muted-foreground">{t("fieldDeal")}</Label>
              <select
                value={dealId}
                onChange={(e) => setDealId(e.target.value)}
                disabled={!contactId}
                className={selectClass}
              >
                <option value="">{t("selectDeal")}</option>
                {deals.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
              </select>
              {!contactId && (
                <p className="text-xs text-muted-foreground">{t("dealNeedsContact")}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label className="text-muted-foreground">{t("fieldAssignee")}</Label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className={selectClass}
              >
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {memberLabel(m)}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label className="text-muted-foreground">{t("fieldDescription")}</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("descriptionPlaceholder")}
                className="min-h-[90px] border-border bg-muted text-foreground"
              />
            </div>
          </div>

          <div className="border-t border-border/50 bg-popover/80 p-4">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1 border-border bg-transparent text-muted-foreground hover:bg-muted"
              >
                {t("cancel")}
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || !title.trim() || !date}
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {saving ? t("saving") : task ? t("save") : t("create")}
              </Button>
            </div>

            {task &&
              (confirmDelete ? (
                <div className="mt-3 flex items-center justify-between gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs">
                  <span className="text-red-300">{t("deleteConfirm")}</span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      disabled={deleting}
                      className="rounded px-2 py-1 text-muted-foreground hover:bg-muted"
                    >
                      {t("cancel")}
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleting}
                      className="rounded bg-red-600 px-2 py-1 font-medium text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {deleting ? t("deleting") : t("deleteConfirmYes")}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="mt-3 flex w-full items-center justify-center gap-1 text-xs text-red-400 hover:text-red-300"
                >
                  <Trash2 className="h-3 w-3" />
                  {t("delete")}
                </button>
              ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
