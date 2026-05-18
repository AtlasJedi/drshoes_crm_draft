import { MusicClient } from "./MusicClient";

export const metadata = {
  title: "Muzyka",
};

export default function MuzykaPage() {
  return (
    <div className="p-6 flex flex-col gap-4">
      <h1 className="t-stencil text-2xl tracking-wider">MUZYKA</h1>
      <p className="text-sm opacity-70">
        Wpisz tytuł utworu albo artystę. Wybrany utwór odtwarza się tutaj —
        po opuszczeniu strony muzyka się zatrzymuje.
      </p>
      <MusicClient />
    </div>
  );
}
