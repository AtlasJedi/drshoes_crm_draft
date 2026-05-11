/**
 * PlaceholderCard — centered informational card for stub pages.
 * Used by /admin/sklep and /admin/aktualnosci.
 */
interface PlaceholderCardProps {
  title: string;
  body: string;
  note?: string;
}

export function PlaceholderCard({ title, body, note }: PlaceholderCardProps) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="max-w-md w-full bg-admin-surface border border-admin-line rounded-2xl p-8 text-center">
        <h1 className="font-display text-2xl mb-3 text-admin-ink">{title}</h1>
        <p className="text-admin-mute text-base mb-2">{body}</p>
        {note && (
          <p className="text-admin-mute text-sm mt-3 italic">{note}</p>
        )}
      </div>
    </div>
  );
}
