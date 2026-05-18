import { MusicClient } from "./MusicClient";

export const metadata = {
  title: "Muzyka",
};

export default function MuzykaPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
      <MusicClient />
    </div>
  );
}
