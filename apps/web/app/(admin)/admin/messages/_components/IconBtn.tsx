import { type ReactNode, type Ref } from "react";

interface Props {
  label: string;
  onClick?: () => void;
  children: ReactNode;
  variant?: "ghost" | "outline";
  disabled?: boolean;
  /** Forwarded ref — used by TemplatePicker to return focus after dropdown closes. */
  triggerRef?: Ref<HTMLButtonElement>;
  "aria-haspopup"?: "menu" | "listbox" | "tree" | "grid" | "dialog" | boolean;
  "aria-expanded"?: boolean;
}

/**
 * Tiny icon-only button. Radix Tooltip target in production. ~25 LOC.
 */
export function IconBtn({
  label, onClick, children, variant = "ghost", disabled,
  triggerRef, "aria-haspopup": ariaHaspopup, "aria-expanded": ariaExpanded,
}: Props) {
  const cls = variant === "ghost"
    ? "hover:bg-admin-hover text-admin-mute hover:text-ink"
    : "bg-white border border-admin-line hover:bg-admin-hover";
  return (
    <button
      ref={triggerRef}
      type="button"
      title={label}
      aria-label={label}
      aria-haspopup={ariaHaspopup}
      aria-expanded={ariaExpanded}
      onClick={onClick}
      disabled={disabled}
      className={"h-8 w-8 rounded-md inline-flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed " + cls}
    >
      {children}
    </button>
  );
}
