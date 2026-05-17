"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { createLogger } from "@/lib/log";
import { createOrder } from "@/lib/orders/api";
import { createClient } from "@/lib/clients/api";
import type { CreateOrderRequest, CreateOrderItemRequest } from "@/lib/orders/types";
import type { ClientDto } from "@/lib/clients/types";
import type { UserStubDto } from "@/lib/users/types";
import { ClientPicker } from "@/components/clients/ClientPicker";
import { NewOrderItemRow, type ItemRowState } from "./NewOrderItemRow";
import { plnToCents, centsToPlnDisplay } from "@/lib/orders/money";
import { KIND_LABELS_PL } from "@/lib/orders/status";

const log = createLogger("new-order-form");

type ClientMode = "existing" | "adhoc";

interface Props {
  users: UserStubDto[];
}

function makeFreshItem(): ItemRowState {
  return { kind: "USLUGA", description: "", pricePln: "" };
}

function toDateStr(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

const QUICK_PICKS = [
  { label: "+1 tydz.", days: 7 },
  { label: "+2 tyg.", days: 14 },
  { label: "+4 tyg.", days: 28 },
];

// ── Main component ────────────────────────────────────────────────────────────

export function NewOrderForm({ users }: Props) {
  const router = useRouter();

  // --- client mode ---
  const [clientMode, setClientMode] = useState<ClientMode>("adhoc");

  // existing-client state
  const [client, setClient] = useState<ClientDto | null>(null);
  const [clientError, setClientError] = useState(false);

  // ad-hoc client state
  const [adhocName, setAdhocName] = useState("");
  const [adhocPhone, setAdhocPhone] = useState("");
  const [adhocEmail, setAdhocEmail] = useState("");
  const [adhocNameError, setAdhocNameError] = useState<string | null>(null);
  const [adhocContactError, setAdhocContactError] = useState<string | null>(null);

  // order fields
  const [description, setDescription] = useState("");
  const [plannedPickupAt, setPlannedPickupAt] = useState("");
  const [quickPick, setQuickPick] = useState<number | null>(null);
  const [assignedCraftsmanId, setAssignedCraftsmanId] = useState("");
  const [advancePaidPln, setAdvancePaidPln] = useState("");
  const [items, setItems] = useState<ItemRowState[]>(() => [makeFreshItem()]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const wycenaCents = useMemo(
    () => items.reduce((sum, it) => sum + plnToCents(it.pricePln), 0),
    [items],
  );
  const advancePaidCents = plnToCents(advancePaidPln);
  const balanceCents = Math.max(0, wycenaCents - advancePaidCents);

  function addItem() {
    setItems((prev) => [...prev, makeFreshItem()]);
  }

  function updateItem(index: number, next: ItemRowState) {
    setItems((prev) => prev.map((it, i) => (i === index ? next : it)));
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function switchMode(mode: ClientMode) {
    setClientMode(mode);
    setClientError(false);
    setAdhocNameError(null);
    setAdhocContactError(null);
  }

  function handleQuickPick(days: number) {
    const iso = toDateStr(days);
    setPlannedPickupAt(iso);
    setQuickPick(days);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    let resolvedClientId: string;

    if (clientMode === "existing") {
      if (!client) {
        setClientError(true);
        log.warn("op=submit outcome=validation_failed reason=no_client");
        return;
      }
      setClientError(false);
      resolvedClientId = client.id;
    } else {
      let valid = true;
      if (!adhocName.trim()) {
        setAdhocNameError("Podaj imię i nazwisko");
        valid = false;
      } else {
        setAdhocNameError(null);
      }
      if (!adhocPhone.trim() && !adhocEmail.trim()) {
        setAdhocContactError("Podaj telefon lub email");
        valid = false;
      } else {
        setAdhocContactError(null);
      }
      if (!valid) {
        log.warn("op=submit outcome=validation_failed reason=adhoc_fields");
        return;
      }

      const parts = adhocName.trim().split(/\s+/);
      const firstName = parts[0]!;
      const lastName = parts.length > 1 ? parts.slice(1).join(" ") : null;

      log.info("op=adhoc-client-create attempt", { firstName, hasPhone: !!adhocPhone, hasEmail: !!adhocEmail });
      setSubmitting(true);
      setSubmitError(null);

      try {
        const created = await createClient({
          firstName,
          lastName,
          phone: adhocPhone.trim() || null,
          email: adhocEmail.trim() || null,
          rodoConsent: true,
        });
        log.info("op=adhoc-client-create outcome=ok", { clientId: created.id });
        resolvedClientId = created.id;
      } catch (err) {
        log.error("op=adhoc-client-create outcome=error", { message: String(err) });
        setSubmitError("Nie udało się utworzyć klienta. Spróbuj ponownie.");
        setSubmitting(false);
        return;
      }
    }

    const builtItems: CreateOrderItemRequest[] = items.map((it) => ({
      kind: it.kind,
      description: it.description || null,
      priceCents: plnToCents(it.pricePln),
    }));

    const req: CreateOrderRequest = {
      clientId: resolvedClientId,
      source: "ADMIN",
      ...(description ? { description } : {}),
      ...(plannedPickupAt
        ? { plannedPickupAt: new Date(plannedPickupAt + "T12:00:00").toISOString() }
        : {}),
      ...(assignedCraftsmanId ? { assignedCraftsmanId } : {}),
      ...(builtItems.length > 0 ? { items: builtItems } : {}),
      quotedPriceCents: wycenaCents,
      advancePaidCents: plnToCents(advancePaidPln),
    };

    log.info("op=submit attempt", { clientId: resolvedClientId, itemCount: builtItems.length });
    if (clientMode === "existing") {
      setSubmitting(true);
      setSubmitError(null);
    }

    try {
      const created = await createOrder(req);
      log.info("op=submit outcome=success", { orderId: created.id });
      router.push(`/admin/orders?orderId=${created.id}` as Route);
    } catch (err) {
      log.error("op=submit outcome=error", { message: String(err) });
      setSubmitError("Nie udało się utworzyć zlecenia. Spróbuj ponownie.");
    } finally {
      setSubmitting(false);
    }
  }

  // shared styles
  const inputBase = "flex-1 px-4 py-[13px] bg-transparent border-0 outline-none text-[16px]";
  const fieldInput =
    "border-[1.5px] border-ink shadow-[3px_3px_0_theme(colors.ink)] flex items-stretch transition-all focus-within:shadow-[3px_3px_0_theme(colors.ink),0_0_0_3px_theme(colors.acid)] focus-within:-translate-x-px focus-within:-translate-y-px";

  return (
    <form onSubmit={handleSubmit} noValidate className="w-full">
      {/* ══ TICKET ══════════════════════════════════════════════════════════ */}
      <div className="border-b-[3px] border-ink bg-paper">

        {/* HEAD */}
        <div
          className="grid items-center gap-[22px] px-8 py-[18px] bg-ink text-paper border-b-[2px] border-ink"
          style={{ gridTemplateColumns: "auto 1fr auto" }}
        >
          {/* Order number placeholder */}
          <div className="flex items-baseline gap-2.5 font-display text-[28px] leading-none">
            <span className="text-acid">#</span>
            <span>DR----- AUTO</span>
            <span className="font-mono text-[11px] text-white/45 tracking-[.14em] uppercase ml-2">
              auto-nadane po zapisie
            </span>
          </div>

          {/* Stamp */}
          <div className="flex justify-center">
            <span
              className="inline-flex items-center gap-2 px-3 py-[7px] bg-acid text-ink font-stencil font-black text-[13px] uppercase tracking-[.08em] border-[1.5px] border-ink shadow-[2px_2px_0_theme(colors.ink)]"
              style={{ transform: "rotate(-1.5deg)" }}
            >
              <span className="w-1.5 h-1.5 bg-ink inline-block" />
              Szkic
            </span>
          </div>

          {/* Back button */}
          <button
            type="button"
            onClick={() => router.push("/admin/orders" as Route)}
            className="inline-flex items-center gap-2 px-[14px] py-2 bg-transparent text-paper border-[1.5px] border-white/30 font-mono text-[12px] tracking-[.04em] lowercase hover:bg-white/8 hover:border-paper transition-colors"
          >
            ← wróć do zleceń
          </button>
        </div>

        {/* BODY */}
        <div className="flex flex-col">

          {/* ── 1. KLIENT ──────────────────────────────────────────────── */}
          <section className="grid border-b-[2px] border-ink" style={{ gridTemplateColumns: "280px 1fr" }}>
            {/* Left rail */}
            <div
              className="flex flex-col gap-3.5 px-8 py-7 bg-[var(--paper-2,#efece2)] border-r-[2px] border-ink relative"
            >
              {/* Timeline thread — clipped on top for first section */}
              <div style={{ position: "absolute", left: 53, top: 50, bottom: 0, width: 2, background: "var(--ink)", opacity: 0.18 }} />
              <div className="flex items-center gap-3.5 relative z-10">
                <span className="w-11 h-11 shrink-0 bg-ink text-paper font-display text-[26px] leading-none flex items-center justify-center border-[1.5px] border-ink">
                  1
                </span>
                <h2 className="font-display text-[38px] leading-[.92] uppercase tracking-tight m-0">Klient</h2>
              </div>
              <span className="font-mono text-[12px] text-admin-mute uppercase tracking-[.12em] leading-[1.55]">
                <span className="text-magenta font-bold mr-1">*</span>wymagane
              </span>
            </div>

            {/* Right content */}
            <div className="flex flex-col gap-[18px] px-8 py-7 min-w-0">
              {/* Segmented tab switcher */}
              <div
                className="grid border-[1.5px] border-ink shadow-[3px_3px_0_theme(colors.ink)] bg-paper"
                style={{ gridTemplateColumns: "repeat(2,1fr)" }}
                role="tablist"
                aria-label="Typ klienta"
              >
                {(["adhoc", "existing"] as ClientMode[]).map((mode) => {
                  const active = clientMode === mode;
                  const label = mode === "adhoc" ? "Nowy klient" : "Istniejący klient";
                  const icon =
                    mode === "adhoc" ? (
                      <svg className="w-3.5 h-3.5 relative z-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5 relative z-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" />
                      </svg>
                    );
                  return (
                    <button
                      key={mode}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => switchMode(mode)}
                      disabled={submitting}
                      className={[
                        "relative overflow-hidden flex items-center justify-center gap-2.5 px-[14px] py-4",
                        "font-stencil font-black text-[16px] uppercase tracking-[.06em]",
                        "border-r-[1.5px] border-ink last:border-r-0",
                        "transition-colors duration-150 cursor-pointer",
                        active ? "bg-acid text-ink" : "bg-transparent text-ink hover:bg-acid/20",
                      ].join(" ")}
                    >
                      {icon}
                      <span className="relative z-10">{label}</span>
                      {active && (
                        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-ink rotate-45 inline-block" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Client panels */}
              {clientMode === "existing" ? (
                <div>
                  <ClientPicker
                    value={client}
                    onChange={(c) => { setClient(c); setClientError(false); }}
                    disabled={submitting}
                  />
                  {clientError && (
                    <p className="mt-1 text-xs text-magenta">Wybierz klienta</p>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {/* Name */}
                  <div>
                    <div className="flex items-center font-mono text-[12px] text-admin-mute uppercase tracking-[.14em] mb-1.5">
                      <span className="text-magenta font-bold mr-1">*</span>Imię i nazwisko
                    </div>
                    <div className={fieldInput}>
                      <input
                        type="text"
                        id="adhocName"
                        value={adhocName}
                        disabled={submitting}
                        onChange={(e) => { setAdhocName(e.target.value); setAdhocNameError(null); }}
                        className={inputBase}
                      />
                    </div>
                    {adhocNameError && (
                      <p className="mt-1 text-xs text-magenta">{adhocNameError}</p>
                    )}
                  </div>

                  {/* Phone + Email row */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center font-mono text-[12px] text-admin-mute uppercase tracking-[.14em] mb-1.5">
                        Telefon
                      </div>
                      <div className={fieldInput}>
                        <span className="inline-flex items-center px-[14px] bg-ink text-paper font-mono text-[14px] font-semibold tracking-[.06em] border-r-[1.5px] border-ink shrink-0">
                          +48
                        </span>
                        <input
                          type="tel"
                          id="adhocPhone"
                          value={adhocPhone}
                          disabled={submitting}
                          onChange={(e) => { setAdhocPhone(e.target.value); setAdhocContactError(null); }}
                          className={inputBase}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center font-mono text-[12px] text-admin-mute uppercase tracking-[.14em] mb-1.5">
                        Email
                      </div>
                      <div className={fieldInput}>
                        <input
                          type="email"
                          id="adhocEmail"
                          value={adhocEmail}
                          disabled={submitting}
                          onChange={(e) => { setAdhocEmail(e.target.value); setAdhocContactError(null); }}
                          className={inputBase}
                        />
                      </div>
                    </div>
                  </div>
                  {adhocContactError && (
                    <p className="text-xs text-magenta">{adhocContactError}</p>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* ── 2. OPIS ─────────────────────────────────────────────────── */}
          <section className="grid border-b-[2px] border-ink" style={{ gridTemplateColumns: "280px 1fr" }}>
            {/* Left rail */}
            <div className="flex flex-col gap-3.5 px-8 py-7 bg-[var(--paper-2,#efece2)] border-r-[2px] border-ink relative">
              <div style={{ position: "absolute", left: 53, top: 0, bottom: 0, width: 2, background: "var(--ink)", opacity: 0.18 }} />
              <div className="flex items-center gap-3.5 relative z-10">
                <span className="w-11 h-11 shrink-0 bg-ink text-paper font-display text-[26px] leading-none flex items-center justify-center border-[1.5px] border-ink">
                  2
                </span>
                <h2 className="font-display text-[38px] leading-[.92] uppercase tracking-tight m-0">Opis zlecenia</h2>
              </div>
              <span className="font-mono text-[12px] text-admin-mute uppercase tracking-[.12em] leading-[1.55]">
                co konkretnie zrobić
              </span>
            </div>

            {/* Right content */}
            <div className="flex flex-col gap-[18px] px-8 py-7 min-w-0">
              <div className={fieldInput}>
                <textarea
                  id="description"
                  value={description}
                  disabled={submitting}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="flex-1 px-4 py-[13px] bg-transparent border-0 outline-none text-[16px] resize-y min-h-[100px] leading-[1.45]"
                />
              </div>
            </div>
          </section>

          {/* ── 3. POZYCJE ──────────────────────────────────────────────── */}
          <section className="grid border-b-[2px] border-ink" style={{ gridTemplateColumns: "280px 1fr" }}>
            {/* Left rail */}
            <div className="flex flex-col gap-3.5 px-8 py-7 bg-[var(--paper-2,#efece2)] border-r-[2px] border-ink relative">
              <div style={{ position: "absolute", left: 53, top: 0, bottom: 0, width: 2, background: "var(--ink)", opacity: 0.18 }} />
              <div className="flex items-center gap-3.5 relative z-10">
                <span className="w-11 h-11 shrink-0 bg-ink text-paper font-display text-[26px] leading-none flex items-center justify-center border-[1.5px] border-ink">
                  3
                </span>
                <h2 className="font-display text-[38px] leading-[.92] uppercase tracking-tight m-0">Pozycje zlecenia</h2>
              </div>
              <span className="font-mono text-[12px] text-admin-mute uppercase tracking-[.12em] leading-[1.55]">
                możesz dodać później
              </span>
            </div>

            {/* Right content */}
            <div className="flex flex-col gap-[18px] px-8 py-7 min-w-0">
              <div className="border-[1.5px] border-ink shadow-[3px_3px_0_theme(colors.ink)]">
                {/* Table header */}
                <div
                  className="grid px-4 py-[10px] border-b-[1.5px] border-ink bg-[var(--paper-2,#efece2)] font-mono text-[12px] text-admin-mute uppercase tracking-[.14em]"
                  style={{ gridTemplateColumns: "180px 1fr 130px 44px" }}
                >
                  <span>Typ</span>
                  <span>Opis</span>
                  <span className="text-right pr-3">Cena</span>
                  <span />
                </div>

                {/* Item rows */}
                {items.length === 0 ? (
                  <p className="px-4 py-3 text-[16px] text-admin-mute">
                    Brak pozycji — możesz dodać później w zleceniu.
                  </p>
                ) : (
                  items.map((item, i) => (
                    <NewOrderItemRow
                      key={i}
                      index={i}
                      item={item}
                      onChange={updateItem}
                      onRemove={removeItem}
                    />
                  ))
                )}

                {/* Table footer */}
                <div className="flex items-center justify-between px-[14px] py-[10px] border-t-[1.5px] border-ink bg-paper">
                  <button
                    type="button"
                    onClick={addItem}
                    disabled={submitting}
                    className="inline-flex items-center gap-2 px-[14px] py-[9px] bg-paper text-ink border-[1.5px] border-ink shadow-[2px_2px_0_theme(colors.ink)] font-stencil font-black text-[14px] uppercase tracking-[.06em] hover:-translate-x-px hover:-translate-y-px hover:shadow-[3px_3px_0_theme(colors.ink)] transition-all disabled:opacity-50"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    dodaj pozycję
                  </button>
                  <span className="font-mono text-[13px] text-admin-mute tracking-[.04em]">
                    razem
                    <b className="font-stencil font-black text-[20px] text-ink tracking-[.04em] ml-2">
                      {centsToPlnDisplay(wycenaCents)} zł
                    </b>
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* ── 4. SZCZEGÓŁY ────────────────────────────────────────────── */}
          <section className="grid border-b-[2px] border-ink" style={{ gridTemplateColumns: "280px 1fr" }}>
            {/* Left rail */}
            <div className="flex flex-col gap-3.5 px-8 py-7 bg-[var(--paper-2,#efece2)] border-r-[2px] border-ink relative">
              <div style={{ position: "absolute", left: 53, top: 0, bottom: 0, width: 2, background: "var(--ink)", opacity: 0.18 }} />
              <div className="flex items-center gap-3.5 relative z-10">
                <span className="w-11 h-11 shrink-0 bg-ink text-paper font-display text-[26px] leading-none flex items-center justify-center border-[1.5px] border-ink">
                  4
                </span>
                <h2 className="font-display text-[38px] leading-[.92] uppercase tracking-tight m-0">Szczegóły</h2>
              </div>
              <span className="font-mono text-[12px] text-admin-mute uppercase tracking-[.12em] leading-[1.55]">
                odbiór, wykonawca, zaliczka
              </span>
            </div>

            {/* Right content */}
            <div className="flex flex-col gap-[18px] px-8 py-7 min-w-0">
              <div className="grid grid-cols-2 gap-4">
                {/* Date picker */}
                <div>
                  <div className="flex items-center font-mono text-[12px] text-admin-mute uppercase tracking-[.14em] mb-1.5">
                    Planowany odbiór
                  </div>
                  <div className={fieldInput}>
                    <span className="inline-flex items-center px-[14px] bg-ink text-paper border-r-[1.5px] border-ink shrink-0">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="5" width="18" height="16" rx="0" />
                        <path d="M3 9h18M8 3v4M16 3v4" />
                      </svg>
                    </span>
                    <input
                      type="date"
                      id="plannedPickupAt"
                      value={plannedPickupAt}
                      disabled={submitting}
                      onChange={(e) => { setPlannedPickupAt(e.target.value); setQuickPick(null); }}
                      className="flex-1 px-4 py-[13px] bg-transparent border-0 outline-none font-mono text-[15px] tracking-[.06em]"
                    />
                  </div>
                  {/* Quick-pick buttons */}
                  <div className="flex gap-1.5 mt-1.5">
                    {QUICK_PICKS.map(({ label, days }) => (
                      <button
                        key={days}
                        type="button"
                        disabled={submitting}
                        onClick={() => handleQuickPick(days)}
                        className={[
                          "px-3 py-[6px] border-[1.5px] border-ink font-mono text-[12px] uppercase tracking-[.06em] transition-colors cursor-pointer",
                          quickPick === days
                            ? "bg-ink text-paper"
                            : "bg-paper hover:bg-[var(--paper-2,#efece2)]",
                        ].join(" ")}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Executor select */}
                <div>
                  <div className="flex items-center font-mono text-[12px] text-admin-mute uppercase tracking-[.14em] mb-1.5">
                    Wykonawca
                  </div>
                  <div className={fieldInput}>
                    <select
                      id="assignedCraftsmanId"
                      value={assignedCraftsmanId}
                      disabled={submitting}
                      onChange={(e) => setAssignedCraftsmanId(e.target.value)}
                      className="flex-1 px-4 py-[13px] bg-transparent border-0 outline-none text-[16px] cursor-pointer appearance-none"
                      style={{
                        backgroundImage:
                          "linear-gradient(45deg,transparent 50%,var(--ink) 50%),linear-gradient(135deg,var(--ink) 50%,transparent 50%)",
                        backgroundPosition: "calc(100% - 18px) 50%, calc(100% - 13px) 50%",
                        backgroundSize: "5px 5px",
                        backgroundRepeat: "no-repeat",
                        paddingRight: 32,
                      }}
                    >
                      <option value="">Bez wykonawcy</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>{u.fullName}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ── 5. WYCENA ───────────────────────────────────────────────── */}
          <section className="grid" style={{ gridTemplateColumns: "280px 1fr" }}>
            {/* Left rail */}
            <div className="flex flex-col gap-3.5 px-8 py-7 bg-[var(--paper-2,#efece2)] border-r-[2px] border-ink relative">
              {/* Timeline thread — clipped on bottom for last section */}
              <div style={{ position: "absolute", left: 53, top: 0, bottom: "calc(100% - 72px)", width: 2, background: "var(--ink)", opacity: 0.18 }} />
              <div className="flex items-center gap-3.5 relative z-10">
                <span className="w-11 h-11 shrink-0 bg-ink text-paper font-display text-[26px] leading-none flex items-center justify-center border-[1.5px] border-ink">
                  5
                </span>
                <h2 className="font-display text-[38px] leading-[.92] uppercase tracking-tight m-0">Wycena</h2>
              </div>
              <span className="font-mono text-[12px] text-admin-mute uppercase tracking-[.12em] leading-[1.55]">
                wycena auto · zaliczka opcjonalna
              </span>
            </div>

            {/* Right content */}
            <div className="flex flex-col gap-[18px] px-8 py-7 min-w-0">
              <div
                className="grid border-[1.5px] border-ink bg-paper shadow-[3px_3px_0_theme(colors.ink)]"
                style={{ gridTemplateColumns: "repeat(3,1fr)" }}
              >
                {/* Wycena (auto, read-only) */}
                <div className="px-[18px] py-4 border-r-[1.5px] border-ink">
                  <span className="block font-mono text-[12px] text-admin-mute uppercase tracking-[.14em] mb-1.5">
                    Wycena <em className="not-italic font-mono text-[9px] tracking-[.1em] ml-1">(auto z pozycji)</em>
                  </span>
                  <span className="font-stencil font-black text-[30px] tracking-[.01em] leading-[1.05]">
                    {centsToPlnDisplay(wycenaCents)} zł
                  </span>
                </div>

                {/* Zaliczka (editable) */}
                <div className="px-[18px] py-4 border-r-[1.5px] border-ink focus-within:bg-acid/[0.18] transition-colors">
                  <span className="block font-mono text-[12px] text-admin-mute uppercase tracking-[.14em] mb-1.5">
                    Zaliczka <em className="not-italic font-mono text-[9px] tracking-[.1em] ml-1">jeśli wpłacona</em>
                  </span>
                  <div className="flex items-baseline gap-1">
                    <input
                      type="number"
                      id="advancePaidPln"
                      value={advancePaidPln}
                      disabled={submitting}
                      onChange={(e) => setAdvancePaidPln(e.target.value)}
                      step="0.01"
                      min="0"
                      className="w-full bg-transparent border-0 outline-none font-stencil font-black text-[30px] tracking-[.01em] leading-[1.05] placeholder:text-admin-mute/50"
                    />
                    <span className="font-stencil font-black text-[30px] tracking-[.01em] leading-[1.05] shrink-0">zł</span>
                  </div>
                </div>

                {/* Do zapłaty (dark) */}
                <div className="px-[18px] py-4 bg-ink text-paper">
                  <span className="block font-mono text-[12px] text-white/55 uppercase tracking-[.14em] mb-1.5">
                    Do zapłaty
                  </span>
                  <span className="font-stencil font-black text-[30px] text-acid tracking-[.01em] leading-[1.05]">
                    {centsToPlnDisplay(balanceCents)} zł
                  </span>
                </div>
              </div>
            </div>
          </section>

        </div>

        {/* FOOT */}
        <div
          className="flex items-center justify-between gap-4 px-8 py-6 border-t-[2px] border-dashed border-ink"
          style={{
            background:
              "repeating-linear-gradient(45deg,var(--paper,#f7f5ef) 0 12px,rgba(10,10,10,.04) 12px 13px)",
          }}
        >
          <div className="font-mono text-[13px] text-admin-mute tracking-[.04em] leading-[1.55]">
            {submitError ? (
              <span className="text-magenta font-semibold">{submitError}</span>
            ) : (
              <>zlecenie zostanie <b className="text-ink font-semibold">zapisane po kliknięciu</b></>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => router.push("/admin/orders" as Route)}
              disabled={submitting}
              className="px-[22px] py-[14px] bg-transparent text-ink border-[1.5px] border-ink font-stencil font-black text-[15px] uppercase tracking-[.06em] hover:bg-[var(--paper-2,#efece2)] disabled:opacity-50 transition-colors"
            >
              Anuluj
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="relative overflow-hidden inline-flex items-center gap-3.5 px-[26px] py-4 pl-[22px] bg-acid text-ink border-2 border-ink shadow-[5px_5px_0_theme(colors.ink)] font-display text-[26px] uppercase tracking-[.02em] leading-none hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[7px_7px_0_theme(colors.ink)] active:translate-x-px active:translate-y-px active:shadow-[3px_3px_0_theme(colors.ink)] disabled:opacity-50 transition-all"
            >
              {submitting ? "Tworzenie…" : "Utwórz zlecenie"}
              <span className="w-7 h-7 inline-flex items-center justify-center bg-ink text-acid shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </span>
            </button>
          </div>
        </div>

      </div>
    </form>
  );
}
