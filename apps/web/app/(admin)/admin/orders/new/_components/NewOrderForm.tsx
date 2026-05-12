"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { createLogger } from "@/lib/log";
import { createOrder } from "@/lib/orders/api";
import type { CreateOrderRequest, CreateOrderItemRequest } from "@/lib/orders/types";
import type { ClientDto } from "@/lib/clients/types";
import type { UserStubDto } from "@/lib/users/types";
import { ClientPicker } from "@/components/clients/ClientPicker";
import { NewOrderItemRow, type ItemRowState } from "./NewOrderItemRow";
import { plnToCents } from "@/lib/orders/money";

const log = createLogger("new-order-form");

interface Props {
  users: UserStubDto[];
}

function makeFreshItem(): ItemRowState {
  return { kind: "NAPRAWA", description: "", pricePln: "" };
}

export function NewOrderForm({ users }: Props) {
  const router = useRouter();

  const [client, setClient] = useState<ClientDto | null>(null);
  const [clientError, setClientError] = useState(false);
  const [description, setDescription] = useState("");
  const [plannedPickupAt, setPlannedPickupAt] = useState("");
  const [assignedCraftsmanId, setAssignedCraftsmanId] = useState("");
  const [quotedPricePln, setQuotedPricePln] = useState("");
  const [advancePaidPln, setAdvancePaidPln] = useState("");
  const [items, setItems] = useState<ItemRowState[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function addItem() {
    setItems((prev) => [...prev, makeFreshItem()]);
  }

  function updateItem(index: number, next: ItemRowState) {
    setItems((prev) => prev.map((it, i) => (i === index ? next : it)));
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!client) {
      setClientError(true);
      log.warn("op=submit outcome=validation_failed reason=no_client");
      return;
    }
    setClientError(false);

    const builtItems: CreateOrderItemRequest[] = items.map((it) => ({
      kind: it.kind,
      description: it.description || null,
      priceCents: plnToCents(it.pricePln),
    }));

    const req: CreateOrderRequest = {
      clientId: client.id,
      source: "ADMIN",
      ...(description ? { description } : {}),
      ...(plannedPickupAt
        ? { plannedPickupAt: new Date(plannedPickupAt + "T12:00:00").toISOString() }
        : {}),
      ...(assignedCraftsmanId ? { assignedCraftsmanId } : {}),
      ...(builtItems.length > 0 ? { items: builtItems } : {}),
      quotedPriceCents: plnToCents(quotedPricePln),
      advancePaidCents: plnToCents(advancePaidPln),
    };

    log.info("op=submit attempt", { clientId: client.id, itemCount: builtItems.length });
    setSubmitting(true);
    setSubmitError(null);

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

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6 max-w-2xl">
      {/* Client */}
      <div>
        <label className={labelCls}>
          Klient <span className="text-magenta">*</span>
        </label>
        <ClientPicker
          value={client}
          onChange={(c) => { setClient(c); setClientError(false); }}
          disabled={submitting}
        />
        {clientError && (
          <p className="mt-1 text-xs text-magenta">Wybierz klienta</p>
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

      {/* Wycena + Zaliczka */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="quotedPricePln" className={labelCls}>
            Wycena (zł)
          </label>
          <input
            id="quotedPricePln"
            type="text"
            inputMode="decimal"
            value={quotedPricePln}
            disabled={submitting}
            onChange={(e) => setQuotedPricePln(e.target.value)}
            placeholder="0,00"
            className={inputCls}
          />
          <p className="mt-1 text-xs text-admin-mute">Łączna kwota za zlecenie</p>
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
        </div>
      </div>

      {/* Do zapłaty przy odbiorze */}
      {(() => {
        const quoted = plnToCents(quotedPricePln);
        const advance = plnToCents(advancePaidPln);
        const balance = Math.max(0, quoted - advance);
        const hasQuote = quotedPricePln.trim() !== "";
        if (!hasQuote) return null;
        const balancePln = (balance / 100).toLocaleString("pl-PL", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        const colorCls = balance > 0 ? "text-magenta" : "text-green";
        return (
          <p className={`text-sm font-medium ${colorCls}`}>
            Do zapłaty przy odbiorze: {balancePln} zł
          </p>
        );
      })()}

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
