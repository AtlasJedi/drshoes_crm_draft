/**
 * Generic shimmer skeleton placeholder.
 * Visual rules: bg-admin-line rows + animate-pulse + rounded-sm.
 * ~28 LOC.
 */

interface Props {
  className?: string;
  /** Tailwind height class, e.g. "h-6". Defaults to "h-4". */
  height?: string;
  /** Number of stacked rows. Defaults to 1. */
  rows?: number;
}

export function Skeleton({ className = "", height = "h-4", rows = 1 }: Props) {
  return (
    <div className={`flex flex-col gap-2 ${className}`} aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className={`${height} w-full rounded-sm bg-admin-line animate-pulse`}
        />
      ))}
    </div>
  );
}
