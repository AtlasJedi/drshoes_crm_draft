# Designer prompt — /admin/muzyka v2 (persistent playback + shared playlists)

Wysłany do Claude.ai designera 2026-05-18.
Eksport: `design/handoff/muzyka.zip`.

---

ROZSZERZENIE EKRANU /admin/muzyka + nowy element w chrome adminu

ZMIANA ZACHOWANIA: muzyka leci CAŁY CZAS w panelu (nie tylko na /admin/muzyka).
Wymaga to (1) mini-playera w chrome adminu i (2) przebudowy strony /admin/muzyka
jako "command center" bez iframe'a (iframe siedzi w chrome).

Plus nowy feature: SHARED PLAYLISTS — wspólne dla całej pracowni, pełny CRUD.

═══════════════════════════════════════════════════════════
3 POWIERZCHNIE DO ZAPROJEKTOWANIA
═══════════════════════════════════════════════════════════

POWIERZCHNIA 1 — MINI-PLAYER W CHROME ADMINU
Widoczny na KAŻDYM route'cie /admin/* gdy coś gra. Stały (sticky), nie zajmuje miejsca w głównym contentcie.
Ty wybierasz placement: bottom-bar sticky (Spotify-like) lub top-floating prawy róg. Decyzja Twoja.

Kompaktowo pokazuje:
- mała miniaturka (~40×30)
- tytuł utworu (truncate 1 linia) + nazwa kanału (mniejsza, wyblakła)
- przycisk ▶/⏸
- ⏭ następny (disabled gdy pusto)
- bardzo cienki pasek progressu (lub %)
- ikonka 🔊 z hover-popoutem slidera głośności
- mały link "→ /admin/muzyka" żeby skoczyć do pełnego widoku

Pusty stan: NIE renderuj nic. (Bar pojawia się tylko gdy current track istnieje.)

═══════════════════════════════════════════════════════════

POWIERZCHNIA 2 — /admin/muzyka v2 (BEZ iframe'a — jest w chrome)

Trzy strefy obok siebie (desktop, 3-kolumnowy layout):

LEWA KOLUMNA — Playlisty (~280px wide)
- nagłówek "PLAYLISTY" (stencil) + przycisk "+ Nowa"
- lista zapisanych playlist, każdy wiersz = nazwa + ilość utworów + ikonka kosza
- klik wiersza = pokaż utwory tej playlisty w środkowej kolumnie
- klik "Załaduj do kolejki" na playliście = jej utwory wjeżdżają do current queue

ŚRODKOWA KOLUMNA — Wyszukiwarka + wyniki (flex-1)
- pole tekstowe "Wpisz tytuł utworu albo artystę" (jak teraz)
- lista wyników YT (do 20), każdy wiersz = miniaturka + tytuł + kanał + DROPDOWN "+"
- dropdown "+": po kliknięciu pokazuje listę istniejących playlist do wyboru + "+ Nowa playlista" na dole

PRAWA KOLUMNA — Bieżąca kolejka (~280px wide)
- nagłówek "TERAZ GRA" + tytuł current + ikonka "+" dodaj do playlisty
- niżej "KOLEJKA" — wiersze jak dziś (mini + tytuł + × usuń + drag handle do reorder?)
- przycisk "Zapisz kolejkę jako playlistę" pod listą

═══════════════════════════════════════════════════════════

POWIERZCHNIA 3 — Modal "Nowa playlista"
Otwiera się z "+" lub z "Zapisz kolejkę". Pojedyncze pole "Nazwa playlisty" + Anuluj/Zapisz.

═══════════════════════════════════════════════════════════

STANY DO POKAZANIA W EKSPORCIE:
A. Mini-player visible, route = /admin (dashboard) — pokazuje że gra w tle
B. /admin/muzyka v2 pusty (brak playlist, brak current, brak kolejki, brak wyszukiwania)
C. /admin/muzyka v2 z 4 playlistami, gra utwór, 3 w kolejce, lista wyników po wyszukaniu
D. Dropdown "+ zapisz do playlisty" otwarty nad jednym z wyników
E. Modal "Nowa playlista" otwarty

TONACJA: ten sam graffiti/stencil/papier+tusz co reszta adminu. Sekcja "PRZERWA" w sidebarze już istnieje — Muzyka jest tam.
