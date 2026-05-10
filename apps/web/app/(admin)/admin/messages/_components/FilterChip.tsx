interface Props {
  active?: boolean;
  label: string;
  count?: number;
  onClick: () => void;
}

/**
 * Filter chip with optional count badge. ~25 LOC.
 */
export function FilterChip({ active, label, count, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "h-8 px-3 inline-flex items-center gap-1.5 rounded-md text-[13px] font-medium border transition-colors " +
        (active
          ? "bg-ink text-paper border-ink"
          : "bg-white text-ink border-admin-line hover:bg-admin-hover")
      }
    >
      {label}
      {typeof count === "number" && (
        <span
          className={
            "inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold " +
            (active ? "bg-acid text-ink" : "bg-admin-line text-admin-mute")
          }
        >
          {count}
        </span>
      )}
    </button>
  );
}
