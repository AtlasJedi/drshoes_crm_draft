import { type ReactNode } from "react";

interface Props {
  label: string;
  onClick?: () => void;
  children: ReactNode;
  variant?: "ghost" | "outline";
  disabled?: boolean;
}

/**
 * Tiny icon-only button. Radix Tooltip target in production. ~20 LOC.
 */
export function IconBtn({ label, onClick, children, variant = "ghost", disabled }: Props) {
  const cls = variant === "ghost"
    ? "hover:bg-admin-hover text-admin-mute hover:text-ink"
    : "bg-white border border-admin-line hover:bg-admin-hover";
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={"h-8 w-8 rounded-md inline-flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed " + cls}
    >
      {children}
    </button>
  );
}
