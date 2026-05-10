/**
 * RODO consent badge. Server Component.
 * Green pill when rodoConsentAt is present; amber when null.
 * Spec §6.7.
 * ~30 LOC.
 */

interface Props {
  rodoConsentAt: string | null;
}

export function RodoBadge({ rodoConsentAt }: Props) {
  if (rodoConsentAt) {
    const d = new Date(rodoConsentAt);
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const yyyy = d.getUTCFullYear();
    return (
      <span
        data-testid="rodo-badge"
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green bg-opacity-15 text-green border border-green/30"
      >
        zgoda · {mm}.{yyyy}
      </span>
    );
  }

  return (
    <span
      data-testid="rodo-badge"
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-orange bg-opacity-15 text-orange border border-orange/30"
    >
      brak zgody RODO
    </span>
  );
}
