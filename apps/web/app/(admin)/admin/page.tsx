import { getMe } from "@/lib/auth/session";

export default async function AdminPage() {
  const me = await getMe();

  return (
    <div>
      <h1 className="font-display text-3xl mb-2">
        Cześć, {me?.fullName ?? "—"}
      </h1>
      <p className="text-admin-mute mb-6">
        Pulpit Dr Shoes (Milestone 0B — szczegółowe widoki w 1).
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          "Zlecenia w realizacji",
          "Gotowe do odbioru",
          "Zaległe",
          "Nowe rezerwacje",
        ].map((label) => (
          <div
            key={label}
            className="bg-admin-surface border border-admin-line rounded-md p-4"
          >
            <div className="text-admin-mute text-xs uppercase">{label}</div>
            <div className="text-3xl font-display mt-1">—</div>
          </div>
        ))}
      </div>
    </div>
  );
}
