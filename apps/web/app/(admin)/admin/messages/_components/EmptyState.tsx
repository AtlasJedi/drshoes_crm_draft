import { type ReactNode } from "react";

type Variant = "cold-start" | "no-selection" | "no-unread" | "send-error";

interface Props {
  variant: Variant;
  onNewMessage?: () => void;
}

const CONFIGS: Record<Variant, { icon: ReactNode; title: string; body: string }> = {
  "cold-start": {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="m2 7 10 6 10-6" />
      </svg>
    ),
    title: "Brak wiadomości",
    body: "Gdy klient odpowie na maila lub SMS-a, wątek pojawi się tutaj.",
  },
  "no-selection": {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
    title: "Wybierz wątek z listy",
    body: "Klik w wątek po lewej stronie otworzy historię konwersacji i composer.",
  },
  "no-unread": {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    ),
    title: "Brak nieprzeczytanych",
    body: 'Wszystkie wątki zostały przeczytane. Sprawdź filtr „Wszystkie" by zobaczyć całą historię.',
  },
  "send-error": {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4M12 16h.01" />
      </svg>
    ),
    title: "Błąd wysyłki",
    body: "Nie udało się wysłać wiadomości. Spróbuj ponownie.",
  },
};

/**
 * Parameterized empty state for four cases: cold-start, no-selection, no-unread, send-error.
 * ~45 LOC.
 */
export function EmptyState({ variant, onNewMessage }: Props) {
  const cfg = CONFIGS[variant];
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-16 flex-1">
      <div className="w-12 h-12 rounded-full bg-paper border border-admin-line flex items-center justify-center text-admin-mute mb-3">
        {cfg.icon}
      </div>
      <div className="text-[14px] font-semibold">{cfg.title}</div>
      <div className="text-[13px] text-admin-mute mt-1 max-w-[280px] leading-relaxed">{cfg.body}</div>
      {variant === "cold-start" && onNewMessage && (
        <button
          onClick={onNewMessage}
          className="mt-3 h-8 px-3 rounded-md bg-ink text-paper text-[12.5px] font-semibold"
        >
          Wyślij pierwszą wiadomość
        </button>
      )}
    </div>
  );
}
