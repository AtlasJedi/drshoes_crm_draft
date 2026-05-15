"use client";

import { useState } from "react";
import { createLogger } from "@/lib/log";
import { AdminCard, I } from "@repo/ui";
import { addOrderItem, updateOrderItem, removeOrderItem, getOrder } from "@/lib/orders/api";
import type { OrderDto, OrderItemDto, OrderItemKind } from "@/lib/orders/types";
import { ItemEditRow, type ItemEditState } from "./ItemEditRow";
import { OrderItemRow } from "./OrderItemRow";

const log = createLogger("order-items");
const BLANK: ItemEditState = { kind: "NAPRAWA", description: "", pricePln: "" };
const toCents = (pln: string) => { const v = parseFloat(pln.replace(",", ".")); return isFinite(v) ? Math.round(v * 100) : 0; };
const toState = (item: OrderItemDto): ItemEditState => ({ kind: item.kind as OrderItemKind, description: item.description ?? "", pricePln: (item.priceCents / 100).toFixed(2) });

interface Props { order: OrderDto; onOrderUpdated: (u: OrderDto) => void; }

/** Orchestrates item CRUD: renders list, inline add/edit form, remove confirm. */
export function OrderDrawerItems({ order, onOrderUpdated }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<ItemEditState>(BLANK);
  const [addOpen, setAddOpen] = useState(false);
  const [addState, setAddState] = useState<ItemEditState>(BLANK);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);

  async function refresh() { onOrderUpdated(await getOrder(order.id)); }

  async function run(op: () => Promise<void>, label: string, id?: string) {
    setBusy(true); setConflict(false);
    try {
      await op();
      log.info(`op=${label} outcome=ok`, { orderId: order.id, ...(id ? { itemId: id } : {}) });
      await refresh();
    } catch (err: unknown) {
      if ((err as { status?: number })?.status === 409) {
        log.warn(`op=${label} outcome=conflict`, { orderId: order.id });
        setConflict(true);
      } else {
        log.error(`op=${label} outcome=error`, { orderId: order.id });
      }
    } finally { setBusy(false); }
  }

  async function handleAdd() {
    await run(async () => {
      await addOrderItem(order.id, { kind: addState.kind, description: addState.description || null, priceCents: toCents(addState.pricePln) });
      setAddOpen(false); setAddState(BLANK);
    }, "addItem");
  }

  async function handleEdit(itemId: string) {
    await run(async () => {
      await updateOrderItem(order.id, itemId, { kind: editState.kind, description: editState.description || null, priceCents: toCents(editState.pricePln) });
      setEditingId(null);
    }, "editItem", itemId);
  }

  async function handleRemove(itemId: string) {
    await run(async () => { await removeOrderItem(order.id, itemId); setRemoveId(null); }, "removeItem", itemId);
  }

  const total = order.items.length;

  return (
    <div className="px-5 py-4 border-t border-admin-line">
      <AdminCard padding={14}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div className="t-stencil" style={{ fontSize: 14, letterSpacing: ".1em" }}>
            Item · {total === 0 ? "0/0" : `1/${total}`}
          </div>
          <button
            type="button"
            className="btn-clean"
            style={{ fontSize: 11, padding: "4px 10px", display: "flex", alignItems: "center", gap: 4 }}
            onClick={() => { setAddOpen(true); setAddState(BLANK); setConflict(false); }}
          >
            {I.plus} dodaj item
          </button>
        </div>
        <div className="space-y-3">
          {order.items.map((item) =>
            editingId === item.id
              ? <ItemEditRow key={item.id} value={editState} onChange={setEditState} onSave={() => handleEdit(item.id)} onCancel={() => setEditingId(null)} busy={busy} />
              : <OrderItemRow key={item.id} item={item} removeId={removeId}
                  onEdit={() => { setEditingId(item.id); setEditState(toState(item)); setConflict(false); }}
                  onRemove={() => setRemoveId(item.id)}
                  onRemoveConfirm={() => handleRemove(item.id)}
                  onRemoveCancel={() => setRemoveId(null)}
                  busy={busy} />
          )}
          {addOpen && (
            <ItemEditRow value={addState} onChange={setAddState} onSave={handleAdd} onCancel={() => { setAddOpen(false); setAddState(BLANK); }} busy={busy} />
          )}
          {conflict && <p role="alert" aria-live="assertive" className="text-xs text-red-600">Konflikt — odśwież</p>}
        </div>
      </AdminCard>
    </div>
  );
}
