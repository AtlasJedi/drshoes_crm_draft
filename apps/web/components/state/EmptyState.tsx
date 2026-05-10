/**
 * Inline empty state — centered text + optional sub-label.
 * Visual: t-mono text-admin-mute text-sm, no icon.
 * ~30 LOC.
 */

interface Props {
  message: string;
  sub?: string;
  className?: string;
}

export function EmptyState({ message, sub, className = "" }: Props) {
  return (
    <div className={`flex flex-col items-center justify-center gap-1.5 py-8 ${className}`}>
      <span className="t-mono text-[13px] text-admin-mute">{message}</span>
      {sub && (
        <span className="t-mono text-[11px] text-admin-mute opacity-70">{sub}</span>
      )}
    </div>
  );
}
