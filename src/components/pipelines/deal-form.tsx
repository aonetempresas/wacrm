"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type {
  Contact,
  Conversation,
  Deal,
  DealStatus,
  PipelineStage,
  Profile,
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
import {
  Check,
  X,
  Trash2,
  MessageSquare,
  Loader2,
  CalendarClock,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { TaskForm } from "@/components/agenda/task-form";
import { cn } from "@/lib/utils";
import {
  AONET_CHANNELS,
  AONET_LOSS_REASONS,
  AONET_PRODUCTS,
  AONET_TEMPERATURES,
  TEMPERATURE_STYLE,
  type AonetTemperature,
} from "@/lib/crm/aonet-lists";

interface DealFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal?: Deal | null;
  pipelineId: string;
  stages: PipelineStage[];
  defaultStageId?: string;
  onSaved: () => void;
}

export function DealForm({
  open,
  onOpenChange,
  deal,
  pipelineId,
  stages,
  defaultStageId,
  onSaved,
}: DealFormProps) {
  const t = useTranslations("Pipelines.form");
  const tTemp = useTranslations("Pipelines.temperature");
  const tChan = useTranslations("Pipelines.channels");
  const tProd = useTranslations("Pipelines.products");
  const tLoss = useTranslations("Pipelines.lostReasons");
  const supabase = createClient();
  const { accountId, defaultCurrency } = useAuth();

  const [value, setValue] = useState("");
  const [contactId, setContactId] = useState("");
  const [stageId, setStageId] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [expectedCloseDate, setExpectedCloseDate] = useState("");
  const [notes, setNotes] = useState("");
  // Lead qualification (Aonet Fase A)
  const [temperature, setTemperature] = useState<AonetTemperature | "">("");
  const [sourceChannel, setSourceChannel] = useState("");
  const [products, setProducts] = useState<string[]>([]);
  const [lostReasons, setLostReasons] = useState<string[]>([]);
  const [lostReasonNote, setLostReasonNote] = useState("");
  const [showLostPicker, setShowLostPicker] = useState(false);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [linkedConversation, setLinkedConversation] =
    useState<Conversation | null>(null);

  const [saving, setSaving] = useState(false);
  const [statusAction, setStatusAction] = useState<DealStatus | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [taskFormOpen, setTaskFormOpen] = useState(false);

  // Reset the form fields every time the sheet opens or its input
  // props change. This is a legitimate prop-driven sync; the rule is
  // over-cautious here, hence the block-level disable.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return;
    setConfirmDelete(false);
    setShowLostPicker(false);
    if (deal) {
      setValue(String(deal.value ?? ""));
      // contact_id is nullable when the contact has been deleted
      // (migration 004: ON DELETE SET NULL). "" means "no selection".
      setContactId(deal.contact_id ?? "");
      setStageId(deal.stage_id);
      setAssignedTo(deal.assigned_to ?? "");
      setExpectedCloseDate(deal.expected_close_date ?? "");
      setNotes(deal.notes ?? "");
      setTemperature((deal.temperature as AonetTemperature) ?? "");
      setSourceChannel(deal.source_channel ?? "");
      setProducts(deal.products ?? []);
      setLostReasons(deal.lost_reasons ?? []);
      setLostReasonNote(deal.lost_reason_note ?? "");
    } else {
      setValue("");
      setContactId("");
      setStageId(defaultStageId || stages[0]?.id || "");
      setAssignedTo("");
      setExpectedCloseDate("");
      setNotes("");
      setTemperature("");
      setSourceChannel("");
      setProducts([]);
      setLostReasons([]);
      setLostReasonNote("");
    }
  }, [open, deal, defaultStageId, stages]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Load supporting data once the sheet is open
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const [c, p] = await Promise.all([
        supabase.from("contacts").select("*").order("name"),
        supabase.from("profiles").select("*").order("full_name"),
      ]);
      if (cancelled) return;
      setContacts((c.data ?? []) as Contact[]);
      setProfiles((p.data ?? []) as Profile[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, supabase]);

  // Fetch linked conversation for the selected contact (newest open one).
  // Clearing on no-selection is sync with prop state; the populated
  // case runs setLinkedConversation inside the async fetch callback.
  useEffect(() => {
    if (!open || !contactId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLinkedConversation(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("conversations")
        .select("*")
        .eq("contact_id", contactId)
        .order("last_message_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      setLinkedConversation((data as Conversation | null) ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, contactId, supabase]);

  async function handleSave() {
    if (!contactId || !stageId) {
      toast.error(t("toastRequired"));
      return;
    }
    setSaving(true);

    // The deal has no user-typed title anymore. Build a readable
    // identifier from the contact + first product (e.g. "Padaria do
    // João · Link Dedicado") so two deals of the same contact stay
    // distinguishable. `title` is NOT NULL in the DB, hence the
    // fallback chain (contact always has at least a phone).
    const selectedContact = contacts.find((c) => c.id === contactId);
    const contactName = selectedContact?.name || selectedContact?.phone || "";
    const productLabel = products.length ? tProd(products[0]) : "";
    const autoTitle =
      (productLabel ? `${contactName} · ${productLabel}` : contactName) ||
      t("untitledDeal");

    const payload = {
      title: autoTitle,
      value: parseFloat(value) || 0,
      currency: defaultCurrency,
      contact_id: contactId,
      pipeline_id: pipelineId,
      stage_id: stageId,
      assigned_to: assignedTo || null,
      notes: notes.trim() || null,
      expected_close_date: expectedCloseDate || null,
      // Lead qualification (Aonet Fase A) — all optional
      temperature: temperature || null,
      source_channel: sourceChannel || null,
      products,
    };

    if (deal) {
      const { error } = await supabase
        .from("deals")
        .update(payload)
        .eq("id", deal.id);
      if (error) {
        toast.error(t("toastFailedSave"));
        setSaving(false);
        return;
      }
    } else {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        toast.error(t("toastNotSignedIn"));
        setSaving(false);
        return;
      }
      if (!accountId) {
        toast.error(t("toastNotLinked"));
        setSaving(false);
        return;
      }
      const { error } = await supabase
        .from("deals")
        .insert({ ...payload, user_id: user.id, account_id: accountId, status: "open" });
      if (error) {
        toast.error(t("toastFailedCreate"));
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    toast.success(deal ? t("toastUpdated") : t("toastCreated"));
    onOpenChange(false);
    onSaved();
  }

  async function handleStatusChange(status: DealStatus) {
    if (!deal) return;
    setStatusAction(status);
    const { error } = await supabase
      .from("deals")
      .update({ status })
      .eq("id", deal.id);
    setStatusAction(null);
    if (error) {
      toast.error(t("toastFailedStatus"));
      return;
    }
    toast.success(
      status === "won" ? t("toastMarkedWon") : status === "lost" ? t("toastMarkedLost") : t("toastReopened"),
    );
    onOpenChange(false);
    onSaved();
  }

  // Marking a deal lost requires a reason (briefing: motivo da perda
  // obrigatório no estágio "Não fechou"). Separate from handleStatusChange
  // because it also writes the loss fields.
  async function handleMarkLost() {
    if (!deal) return;
    if (lostReasons.length === 0) {
      toast.error(t("lostReasonRequired"));
      return;
    }
    setStatusAction("lost");
    const { error } = await supabase
      .from("deals")
      .update({
        status: "lost",
        lost_reasons: lostReasons,
        lost_reason_note: lostReasonNote.trim() || null,
      })
      .eq("id", deal.id);
    setStatusAction(null);
    if (error) {
      toast.error(t("toastFailedStatus"));
      return;
    }
    toast.success(t("toastMarkedLost"));
    onOpenChange(false);
    onSaved();
  }

  async function handleDelete() {
    if (!deal) return;
    setDeleting(true);
    const { error } = await supabase.from("deals").delete().eq("id", deal.id);
    setDeleting(false);
    if (error) {
      toast.error(t("toastFailedDelete"));
      return;
    }
    toast.success(t("toastDeleted"));
    setConfirmDelete(false);
    onOpenChange(false);
    onSaved();
  }

  return (
    <>
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="bg-popover border-border text-popover-foreground sm:max-w-lg w-full p-0"
      >
        <div className="flex h-full flex-col">
          <SheetHeader className="border-b border-border/50 p-4">
            <SheetTitle className="text-popover-foreground">
              {deal ? t("editDeal") : t("newDeal")}
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="grid gap-2">
              <Label className="text-muted-foreground">{t("contact")}</Label>
              <select
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-muted px-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              >
                <option value="">{t("selectContact")}</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || c.phone}
                  </option>
                ))}
              </select>

              {linkedConversation && (
                <Link
                  href="/inbox"
                  className="mt-1 inline-flex items-center gap-1.5 self-start rounded-md bg-primary/10 px-2 py-1 text-xs text-primary hover:bg-primary/20"
                >
                  <MessageSquare className="h-3 w-3" />
                  {t("linkToConversation")}
                </Link>
              )}
            </div>

            {/* ---- Qualificação do lead (Aonet Fase A) ---- */}
            <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t("qualificationSection")}
              </p>

              {/* Temperatura */}
              <div className="grid gap-2">
                <Label className="text-muted-foreground">{t("temperature")}</Label>
                <div className="flex gap-2">
                  {AONET_TEMPERATURES.map((temp) => {
                    const active = temperature === temp;
                    const style = TEMPERATURE_STYLE[temp];
                    return (
                      <button
                        key={temp}
                        type="button"
                        onClick={() => setTemperature(active ? "" : temp)}
                        className={cn(
                          "flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-sm font-medium transition-colors",
                          active
                            ? style.chip
                            : "border-border bg-muted text-muted-foreground hover:bg-muted/70",
                        )}
                      >
                        <span className={cn("h-2 w-2 rounded-full", style.dot)} />
                        {tTemp(temp)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Canal de origem */}
              <div className="grid gap-2">
                <Label className="text-muted-foreground">{t("sourceChannel")}</Label>
                <select
                  value={sourceChannel}
                  onChange={(e) => setSourceChannel(e.target.value)}
                  className="h-9 w-full rounded-lg border border-border bg-muted px-2.5 text-sm text-foreground outline-none focus:border-primary"
                >
                  <option value="">{t("sourceChannelNone")}</option>
                  {AONET_CHANNELS.map((ch) => (
                    <option key={ch} value={ch}>
                      {tChan(ch)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Valor (R$) — um único campo: o valor do negócio */}
              <div className="grid gap-2">
                <Label className="text-muted-foreground">{t("value")}</Label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
                    R$
                  </span>
                  <Input
                    type="number"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="0,00"
                    className="border-border bg-muted pl-9 text-foreground"
                  />
                </div>
              </div>

              {/* Produtos de interesse (múltipla escolha) */}
              <div className="grid gap-2">
                <Label className="text-muted-foreground">{t("products")}</Label>
                <div className="flex flex-wrap gap-1.5">
                  {AONET_PRODUCTS.map((p) => {
                    const active = products.includes(p);
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() =>
                          setProducts((prev) =>
                            prev.includes(p)
                              ? prev.filter((x) => x !== p)
                              : [...prev, p],
                          )
                        }
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                          active
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-border bg-muted text-muted-foreground hover:bg-muted/70",
                        )}
                      >
                        {tProd(p)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <Label className="text-muted-foreground">{t("expectedCloseDate")}</Label>
              <Input
                type="date"
                value={expectedCloseDate}
                onChange={(e) => setExpectedCloseDate(e.target.value)}
                className="border-border bg-muted text-foreground"
              />
            </div>

            <div className="grid gap-2">
              <Label className="text-muted-foreground">{t("stage")}</Label>
              <select
                value={stageId}
                onChange={(e) => setStageId(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-muted px-2.5 text-sm text-foreground outline-none focus:border-primary"
              >
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label className="text-muted-foreground">{t("assignedTo")}</Label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-muted px-2.5 text-sm text-foreground outline-none focus:border-primary"
              >
                <option value="">{t("unassigned")}</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name || p.email}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label className="text-muted-foreground">{t("notes")}</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("notesPlaceholder")}
                className="min-h-[100px] border-border bg-muted text-foreground"
              />
            </div>

            {deal && (
              <div className="space-y-2 rounded-lg border border-border bg-muted/50 p-3">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {t("status")}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={() => handleStatusChange("won")}
                    disabled={!!statusAction || deal.status === "won"}
                    className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {statusAction === "won" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Check className="mr-1 h-4 w-4" />
                        {t("markAsWon")}
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setShowLostPicker((v) => !v)}
                    disabled={!!statusAction || deal.status === "lost"}
                    className="flex-1 bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    <X className="mr-1 h-4 w-4" />
                    {t("markAsLost")}
                  </Button>
                </div>

                {/* Loss-reason picker — appears when marking as lost.
                    At least one reason is required (briefing 8.1 / L6). */}
                {showLostPicker && deal.status !== "lost" && (
                  <div className="space-y-2 rounded-md border border-red-500/30 bg-red-500/10 p-2.5">
                    <p className="text-xs font-medium text-red-300">{t("lostReason")}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {AONET_LOSS_REASONS.map((r) => {
                        const active = lostReasons.includes(r);
                        return (
                          <button
                            key={r}
                            type="button"
                            onClick={() =>
                              setLostReasons((prev) =>
                                prev.includes(r)
                                  ? prev.filter((x) => x !== r)
                                  : [...prev, r],
                              )
                            }
                            className={cn(
                              "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                              active
                                ? "border-red-500/50 bg-red-500/20 text-red-200"
                                : "border-border bg-muted text-muted-foreground hover:bg-muted/70",
                            )}
                          >
                            {tLoss(r)}
                          </button>
                        );
                      })}
                    </div>
                    <Textarea
                      value={lostReasonNote}
                      onChange={(e) => setLostReasonNote(e.target.value)}
                      placeholder={t("lostReasonNotePlaceholder")}
                      className="min-h-[60px] border-border bg-muted text-sm text-foreground"
                    />
                    <Button
                      type="button"
                      onClick={handleMarkLost}
                      disabled={!!statusAction || lostReasons.length === 0}
                      className="w-full bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {statusAction === "lost" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        t("markAsLost")
                      )}
                    </Button>
                  </div>
                )}

                {deal.status && deal.status !== "open" && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => handleStatusChange("open")}
                    disabled={!!statusAction}
                    className="w-full text-muted-foreground hover:text-foreground"
                  >
                    {t("reopenDeal")}
                  </Button>
                )}
              </div>
            )}

            {deal && (
              <button
                type="button"
                onClick={() => setTaskFormOpen(true)}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
              >
                <CalendarClock className="h-4 w-4 text-primary" />
                {t("scheduleTask")}
              </button>
            )}
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
                disabled={saving || !contactId || !stageId}
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {saving ? t("saving") : deal ? t("saveChanges") : t("createDeal")}
              </Button>
            </div>

            {deal &&
              (confirmDelete ? (
                <div className="mt-3 flex items-center justify-between gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs">
                  <span className="text-red-300">{t("deletePrompt")}</span>
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
                      {deleting ? t("deleting") : t("confirm")}
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
                  {t("deleteDeal")}
                </button>
              ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
    <TaskForm
      open={taskFormOpen}
      onOpenChange={setTaskFormOpen}
      defaultDealId={deal?.id}
      defaultContactId={deal?.contact_id ?? contactId}
      defaultConversationId={deal?.conversation_id ?? linkedConversation?.id ?? null}
      onSaved={() => {}}
    />
    </>
  );
}
