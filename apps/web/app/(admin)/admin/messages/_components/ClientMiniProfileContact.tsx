// ClientMiniProfileContact — key/value rows: phone, email, preferred channel.
// < 40 LOC per granulate directive.
import type { ClientDto } from "@/lib/clients/types";

function MiniRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between" style={{ fontSize: 12 }}>
      <span className="t-mono opacity-55">{k}</span>
      <span className="font-semibold">{v}</span>
    </div>
  );
}

interface Props {
  client: ClientDto;
}

export function ClientMiniProfileContact({ client }: Props) {
  return (
    <div className="px-4 py-4 border-b border-admin-line space-y-2.5">
      {client.phone && <MiniRow k="Telefon" v={client.phone} />}
      {client.email && <MiniRow k="Email" v={client.email} />}
      {client.preferredChannel && <MiniRow k="Preferowany kanał" v={client.preferredChannel} />}
    </div>
  );
}
