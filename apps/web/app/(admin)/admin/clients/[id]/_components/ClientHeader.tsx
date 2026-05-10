/**
 * Client detail header. Server Component.
 * Renders: large name, phone, email, channel pill, RodoBadge, "Edytuj" island.
 * The EditClientModal (task 7-15, Slice D) is imported from the shared _components.
 * Until 7-15 lands this references a stub CC that is replaced in-place.
 * Spec §6.3.
 * ~65 LOC.
 */
import type { ClientDto } from "@/lib/clients/types";
import { RodoBadge } from "../../_components/RodoBadge";
import { EditClientIsland } from "./EditClientIsland";

const CHANNEL_LABELS: Record<string, string> = {
  EMAIL:    "Email",
  SMS:      "SMS",
  WHATSAPP: "WhatsApp",
  NONE:     "Brak",
};

const CHANNEL_PILL_CLS: Record<string, string> = {
  EMAIL:    "bg-blue/10 text-blue border-blue/20",
  SMS:      "bg-violet-50 text-violet-700 border-violet-200",
  WHATSAPP: "bg-green/10 text-green border-green/20",
  NONE:     "bg-admin-line text-admin-mute border-admin-line",
};

interface Props {
  client: ClientDto;
}

export function ClientHeader({ client }: Props) {
  const channel = client.preferredChannel ?? "NONE";
  const channelLabel = CHANNEL_LABELS[channel] ?? channel;
  const channelCls = CHANNEL_PILL_CLS[channel] ?? CHANNEL_PILL_CLS["NONE"];

  return (
    <div className="admin-card p-6 mb-6 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-3xl leading-tight text-admin-ink mb-3">
          {client.firstName} {client.lastName ?? ""}
        </h1>

        <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-admin-mute">
          {client.phone && (
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">Telefon</dt>
              <dd className="font-mono">{client.phone}</dd>
            </div>
          )}
          {client.email && (
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">E-mail</dt>
              <dd>{client.email}</dd>
            </div>
          )}
        </dl>

        <div className="flex flex-wrap items-center gap-2 mt-3">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${channelCls}`}>
            {channelLabel}
          </span>
          <RodoBadge rodoConsentAt={client.rodoConsentAt ?? null} />
        </div>
      </div>

      <EditClientIsland client={client} />
    </div>
  );
}
