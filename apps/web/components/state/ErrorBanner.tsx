"use client";

/**
 * Inline error banner — left border var(--red), single-line, optional retry link.
 * Visual: border-l-4 border-[var(--red)], no alarming background fill.
 * ~35 LOC.
 */

interface Props {
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorBanner({
  message = "Nie udało się załadować danych.",
  onRetry,
  className = "",
}: Props) {
  return (
    <div
      role="alert"
      className={`flex items-center gap-3 px-4 py-3 border-l-4 border-[var(--red)] text-sm ${className}`}
    >
      <span className="flex-1 text-[13px]">{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="t-mono text-[11px] uppercase shrink-0 underline underline-offset-2"
        >
          Spróbuj ponownie
        </button>
      )}
    </div>
  );
}
