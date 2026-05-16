// ClientMiniProfileIdentity — avatar + name + joined date + sticker row.
// < 40 LOC per granulate directive.
import { Sticker } from "@drshoes/ui";

interface Props {
  ini: string;
  fullName: string;
  joined: string;
  isRegular: boolean;
}

export function ClientMiniProfileIdentity({ ini, fullName, joined, isRegular }: Props) {
  return (
    <div className="px-4 py-5 border-b border-admin-line flex flex-col items-center text-center">
      <div
        className="flex items-center justify-center rounded-full border-2 border-ink t-display"
        style={{ width: 64, height: 64, background: "var(--acid)", fontSize: 26 }}
      >
        {ini}
      </div>
      <div className="t-display mt-2.5" style={{ fontSize: 22, lineHeight: 1 }}>{fullName}</div>
      <div className="t-mono mt-1 opacity-60" style={{ fontSize: 11 }}>klient od {joined}</div>
      {isRegular && (
        <div className="flex gap-1.5 mt-2">
          <Sticker angle={-2} style={{ fontSize: 10, padding: "4px 10px" }}>stały klient</Sticker>
        </div>
      )}
    </div>
  );
}
