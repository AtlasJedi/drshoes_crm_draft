// packages/ui/src/components/Pill.tsx
// Order-status pill badge. Colour driven by CSS class (.pill-* in globals.css).
// Polish labels are canonical human-readable names per design spec.
// < 50 LOC per granulate directive.

import React from "react";

export type OrderStatus =
  | "WSTEPNIE_PRZYJETE"
  | "PRZYJETE"
  | "W_REALIZACJI"
  | "CZEKA_NA_KLIENTA"
  | "GOTOWE_DO_ODBIORU"
  | "WYDANE"
  | "ANULOWANE";

const STATUS_META: Record<OrderStatus, { cls: string; label: string }> = {
  WSTEPNIE_PRZYJETE: { cls: "pill-wstepne",   label: "wstępnie przyjęte" },
  PRZYJETE:          { cls: "pill-przyjete",   label: "przyjęte" },
  W_REALIZACJI:      { cls: "pill-realizacja", label: "w realizacji" },
  CZEKA_NA_KLIENTA:  { cls: "pill-czeka",      label: "czeka na klienta" },
  GOTOWE_DO_ODBIORU: { cls: "pill-gotowe",     label: "gotowe do odbioru" },
  WYDANE:            { cls: "pill-wydane",     label: "wydane" },
  ANULOWANE:         { cls: "pill-anulowane",  label: "anulowane" },
};

export interface PillProps {
  status: OrderStatus;
  className?: string;
}

export function Pill({ status, className = "" }: PillProps) {
  const { cls, label } = STATUS_META[status] ?? { cls: "pill-wstepne", label: status };
  return (
    <span className={`pill ${cls} ${className}`.trim()}>
      {label}
    </span>
  );
}
