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

const log = createLogger("new-order-form");

type ClientMode = "existing" | "adhoc";

interface Props {
  users: UserStubDto[];
}

function makeFreshItem(): ItemRowState {
  return { kind: "NAPRAWA", description: "", pricePln: "" };
}

export function NewOrderForm({ users }: Props) {
  const router = useRouter();

  // --- client mode ---
  const [clientMode, setClientMode] = useState<ClientMode>("existing");

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
  const [assignedCraftsmanId, setAssignedCraftsmanId] = useState("");
  const [advancePaidPln, setAdvancePaidPln] = useState("");
  const [items, setItems] = useState<ItemRowState[]>(() => [makeFreshItem()]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const wycenaCents = useMemo(
    () => items.reduce((sum, it) => sum + plnToCents(it.pricePln), 0),
    [items],
  );

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
    // clear errors when switching
    setClientError(false);
    setAdhocNameError(null);
    setAdhocContactError(null);
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
      // ad-hoc validation
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

      // split full name: first token → firstName, rest → lastName
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

  const inputCls =
    "w-full h-10 px-3 border border-admin-line rounded-sm focus:outline-none focus:ring-2 focus:ring-acid text-sm";
  const labelCls = "block text-sm font-medium text-admin-ink mb-1";

  const advancePaidCents = plnToCents(advancePaidPln);
  const balanceCents = Math.max(0, wycenaCents - advancePaidCents);

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6 max-w-2xl">
      {/* Client mode switcher */}
      <div>
        <p className={labelCls}>Klient <span className="text-magenta">*</span></p>
        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={() => switchMode("existing")}
            disabled={submitting}
            className={`px-4 py-1.5 rounded-sm border text-sm font-medium transition-colors ${
              clientMode === "existing"
                ? "bg-acid text-ink border-acid"
                : "bg-white text-admin-ink border-admin-line hover:bg-acid/10"
            }`}
          >
            Istniejący klient
          </button>
          <button
            type="button"
            onClick={() => switchMode("adhoc")}
            disabled={submitting}
            className={`px-4 py-1.5 rounded-sm border text-sm font-medium transition-colors ${
              clientMode === "adhoc"
                ? "bg-acid text-ink border-acid"
                : "bg-white text-admin-ink border-admin-line hover:bg-acid/10"
            }`}
          >
            Nowy klient
          </button>
        </div>

        {clientMode === "existing" ? (
          <>
            <ClientPicker
              value={client}
              onChange={(c) => { setClient(c); setClientError(false); }}
              disabled={submitting}
            />
            {clientError && (
              <p className="mt-1 text-xs text-magenta">Wybierz klienta</p>
            )}
          </>
        ) : (
          <div className="space-y-3">
            <div>
              <label htmlFor="adhocName" className={labelCls}>
                Imię i nazwisko <span className="text-magenta">*</span>
              </label>
              <input
                id="adhocName"
                type="text"
                value={adhocName}
                disabled={submitting}
                onChange={(e) => { setAdhocName(e.target.value); setAdhocNameError(null); }}
                placeholder="Jan Kowalski"
                className={inputCls}
              />
              {adhocNameError && (
                <p className="mt-1 text-xs text-magenta">{adhocNameError}</p>
              )}
            </div>
            <div>
              <label htmlFor="adhocPhone" className={labelCls}>Telefon</label>
              <input
                id="adhocPhone"
                type="tel"
                value={adhocPhone}
                disabled={submitting}
                onChange={(e) => { setAdhocPhone(e.target.value); setAdhocContactError(null); }}
                placeholder="+48 600 000 000"
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="adhocEmail" className={labelCls}>Email</label>
              <input
                id="adhocEmail"
                type="email"
                value={adhocEmail}
                disabled={submitting}
                onChange={(e) => { setAdhocEmail(e.target.value); setAdhocContactError(null); }}
                placeholder="jan@kowalski.pl"
                className={inputCls}
              />
            </div>
            {adhocContactError && (
              <p className="text-xs text-magenta">{adhocContactError}</p>
            )}
          </div>
        )}
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className={labelCls}>Opis zlecenia</label>
        <textarea
          id="description"
          value={description}
          disabled={submitting}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-admin-line rounded-sm focus:outline-none focus:ring-2 focus:ring-acid text-sm resize-none"
          placeholder="Dodatkowe uwagi (opcjonalnie)"
        />
      </div>

      {/* Planned pickup */}
      <div>
        <label htmlFor="plannedPickupAt" className={labelCls}>Planowany odbiór</label>
        <input
          id="plannedPickupAt"
          type="date"
          value={plannedPickupAt}
          disabled={submitting}
          onChange={(e) => setPlannedPickupAt(e.target.value)}
          className={inputCls + " w-48"}
        />
      </div>

      {/* Assignee */}
      <div>
        <label htmlFor="assignedCraftsmanId" className={labelCls}>Wykonawca</label>
        <select
          id="assignedCraftsmanId"
          value={assignedCraftsmanId}
          disabled={submitting}
          onChange={(e) => setAssignedCraftsmanId(e.target.value)}
          className={inputCls + " bg-white"}
        >
          <option value="">Bez wykonawcy</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.fullName}</option>
          ))}
        </select>
      </div>

      {/* Wycena (derived) + Zaliczka */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className={labelCls}>Wycena (zł)</p>
          <div
            aria-label="Wycena"
            className="w-full h-10 px-3 border border-admin-line rounded-sm text-sm flex items-center bg-admin-line/30 text-admin-mute select-none"
          >
            {centsToPlnDisplay(wycenaCents)}
          </div>
          <p className="mt-1 text-xs text-admin-mute">Suma z pozycji zlecenia (poniżej)</p>
        </div>
        <div>
          <label htmlFor="advancePaidPln" className={labelCls}>
            Zaliczka (zł)
          </label>
          <input
            id="advancePaidPln"
            type="text"
            inputMode="decimal"
            value={advancePaidPln}
            disabled={submitting}
            onChange={(e) => setAdvancePaidPln(e.target.value)}
            placeholder="0,00"
            className={inputCls}
          />
          <p className="mt-1 text-xs text-admin-mute">Pozostawiamy puste, jeśli klient nie wpłacił zaliczki</p>
          {wycenaCents > 0 && (
            <p className={`mt-1 text-xs font-medium ${balanceCents > 0 ? "text-magenta" : "text-green"}`}>
              Do zapłaty: {centsToPlnDisplay(balanceCents)}
            </p>
          )}
        </div>
      </div>

      {/* Items */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className={labelCls + " mb-0"}>Pozycje zlecenia</span>
          <button
            type="button"
            onClick={addItem}
            disabled={submitting}
            className="text-xs px-3 py-1 rounded border border-admin-line text-admin-ink hover:bg-acid/10 disabled:opacity-50 transition-colors"
          >
            + Dodaj pozycję
          </button>
        </div>
        {items.length === 0 ? (
          <p className="text-sm text-admin-mute">Brak pozycji — możesz dodać później w zleceniu.</p>
        ) : (
          <div className="space-y-2">
            {items.map((item, i) => (
              <NewOrderItemRow
                key={i}
                index={i}
                item={item}
                onChange={updateItem}
                onRemove={removeItem}
              />
            ))}
          </div>
        )}
      </div>

      {/* Submit error */}
      {submitError && (
        <p className="text-sm text-magenta">{submitError}</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="px-5 py-2 rounded bg-acid text-ink font-medium text-sm hover:bg-acid/80 disabled:opacity-50 transition-colors"
        >
          {submitting ? "Tworzenie…" : "Utwórz zlecenie"}
        </button>
      </div>
    </form>
  );
}
