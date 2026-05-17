# Wiadomości — redesign · handoff

Cel: naprawić rozjechany widok skrzynki w panelu admina. Layout ma być
**fixed-viewport** (cała strona = 100vh, brak scrolla strony), a jedynym
przewijalnym obszarem ma być **lista wiadomości w środkowej kolumnie**.
Kompozer (wybór kanału + treść + wyślij) zakotwiczony na dole środkowej kolumny
i **rozszerzalny przez chwyt nad nim** (drag = zmiana podziału między historią
a polem wiadomości).

---

## Co się zmieniło

### 01 · Strona zamknięta w viewporcie (100vh, no body scroll)
Poprzednio strona scrollowała się jako całość, bo content przerastał wysokość.
Teraz:

```css
html, body { height: 100%; overflow: hidden; }
.app       { height: 100vh; display: grid; grid-template-columns: 230px 1fr; }
```

Sidebar i topbar nie mają własnego scrolla; zawartość trzymają w kolumnach
o `min-height: 0` (kluczowe, żeby `grid-template-rows: 1fr` faktycznie się
zaciskał i pozwalał wnukowi `overflow-y: auto` działać).

### 02 · Trzy kolumny środka, każda z osobnym scrollem
```
.three { display: grid;
         grid-template-columns: 340px 1fr 300px;
         min-height: 0; }
```
- **convo-col** (lista) — własny `overflow-y: auto`, filtry na górze są
  `flex-shrink: 0` (zawsze widoczne).
- **thread-col** — patrz niżej, ma własny wewnętrzny grid 4-rzędowy.
- **client-col** — własny `overflow-y: auto`.

### 03 · Środkowa kolumna: 4-rzędowy grid z draggable handle
```
.thread-col { display: grid;
              grid-template-rows: auto 1fr auto var(--composer-h); }
```
Rzędy:
1. `thread-head` — header wątku (kto pisze, akcje). Stała wysokość.
2. `messages` — **jedyny przewijalny obszar** (`overflow-y: auto`).
   Po zmianie wątku trzeba scrollować do dołu (`scrollTop = scrollHeight`).
3. `handle` — chwyt do resize'u, 14px, `cursor: ns-resize`.
4. `composer` — wysokość sterowana przez CSS custom property
   `--composer-h` (domyślnie 240px).

### 04 · Drag-to-resize kompozera
Handle nad kompozerem łapie pointer eventy i przeciąga w pionie:
- **w górę** = większy kompozer, mniejsza historia
- **w dół** = mniejszy kompozer, większa historia
- **double-click** = reset do 240px
- **focus + ↑/↓** = zmiana co 16px (a11y)

Ograniczenia:
- min `composer` = 100px
- max `composer` = `threadCol.height - 200 - handleH` (zostawiamy
  min. 200px na historię)

Live wartość pokazywana po prawej stronie handle (np. „312 px"). Wartość
warto zapisać w `localStorage` po stronie produkcyjnej.

### 05 · EMAIL renderowany jako *letter card*, nie jako gołe ASCII
Poprzednio body maila wypełniało całą szerokość kolumny i przepełniało układ
(„==== R.SHOES — warsztat..."). Teraz każda wiadomość email = osobna karta:

```
┌ EMAIL · Subject · wysłane ──────────┐
│ Do: foo@bar  ·  Od: warsztat@…       │
├──────────────────────────────────────┤
│ [opcjonalny "receipt" block — pre]   │
│ Body — normalne paragrafy 14px       │
│ ── signature                         │
└──────────────────────────────────────┘
```
- `.letter` ma `max-width: 720px` + `width: fit-content`, więc krótkie
  maile NIE rozciągają się na pełną szerokość — to też wizualnie odróżnia
  reply'e od długich wiadomości.
- Tytuł i kierunek (`wysłane` / `odebrane`) w headerze karty.
- Out-going (z lewej DR.SHOES) wyrównane do prawej; in-coming do lewej —
  ten sam ruch co bubble'e na czacie, ale prostokątne karty czytają się
  jak mail, nie chat.
- **„receipt"** to opcjonalny preformatted block (mono, czarne tło, acid
  akcenty) — używany TYLKO dla systemowych szablonów (potwierdzenie zlecenia
  itp.). Renderuj go w `<pre>` z `overflow-x: auto`, żeby nigdy nie psuł
  layoutu.
- SMS/WhatsApp/IG — używaj `.bubble` zamiast `.letter` (zwykłe dymki czatu).

### 06 · Kompozer: kanały jako taby, pola adaptują się do kanału
- Cztery taby: EMAIL · SMS · WhatsApp · IG DM. Pod każdym kolorowy
  swatch (mapowanie kanał → kolor: EMAIL=ink, SMS=blue, WhatsApp=green, IG=pink).
- Po prawej: „do: <kontakt>" — wartość zmienia się przy zmianie tabu.
- Tylko dla EMAIL pokazujemy pasek pól `Temat` + `Szablon` (gdy aktywny inny
  kanał — pasek jest ukrywany, oszczędzamy pionową przestrzeń).
- Stopka: załącz · obrazek · powiąż zlecenie · skrót klawiszowy · WYŚLIJ.

---

## Stan komponentów

| element                       | nazwa w kodzie         | typ          |
| ----------------------------- | ---------------------- | ------------ |
| layout root                   | `.app`                 | grid 2-col   |
| sidebar nawigacji             | `.sidebar`             | flex column  |
| topbar (tytuł + szukaj)       | `.topbar`              | flex row     |
| 3-kolumnowy content           | `.three`               | grid 3-col   |
| lista wątków                  | `.convo-col`           | flex column  |
| pojedynczy wątek              | `.convo-item`          | grid 2-col   |
| panel wątku                   | `.thread-col`          | grid 4-row   |
| nagłówek wątku                | `.thread-head`         | grid         |
| historia wiadomości           | `.messages`            | flex column  |
| pojedynczy email              | `.letter`              | block        |
| pojedynczy SMS/WhatsApp/IG    | `.bubble`              | block        |
| chwyt resize                  | `.handle` `#handle`    | block        |
| kompozer                      | `.composer` `#composer`| grid 3-row   |
| panel klienta                 | `.client-col`          | flex column  |

CSS custom properties do podmiany na produkcji:
- `--composer-h` — live, zmieniana z JS przez `app.style.setProperty(...)`
- `--side-w`, `--convo-w`, `--client-w` — szerokości kolumn
- `--topbar-h` — wysokość topbara
- `--handle-h` — wysokość chwytu

---

## Zachowania do zaimplementowania w produkcji

1. **Resize persistance** — zapisz `--composer-h` w `localStorage`
   (klucz: `dr.messaging.composerHeight`), wczytuj przy montażu wątku.
2. **Klamra min/max** — recalc przy zmianie viewportu (mamy `resize` listener,
   ale w prod warto debounce).
3. **`scrollIntoView` na ostatnią wiadomość** — po dodaniu nowej wiadomości,
   po przełączeniu wątku. Używaj `messages.scrollTop = messages.scrollHeight`
   (nie `.scrollIntoView()` — psuje rodzicielski scroll).
4. **Kanały** — `EMAIL`, `SMS`, `WhatsApp`, `IG`. Mapuj kontakt z profilu
   klienta (jak w `CONTACTS` w mocku). Dla SMS/WhatsApp używaj telefonu,
   dla IG — handle z profilu.
5. **Szablony** — dropdown wstawia treść do textarei (event `change`).
6. **⌘/Ctrl + Enter** — wyślij (placeholder zostawiony, listener do dorobienia).
7. **Drag&drop załączników** — drop na `.composer-body` → upload do zlecenia
   powiązanego z wątkiem.
8. **Wątki nieprzeczytane** — `.convo-item.unread` + kropka po nazwie.
   Trzeba też pulsować topbarowy badge.
9. **Stan pusty** — gdy żaden wątek nie wybrany: pokaż w środku informację
   „Wybierz rozmowę z listy" (TODO, w mocku zawsze coś jest zaznaczone).

---

## Czego NIE robić

- Nie ustawiać `overflow: auto` na `body`, `.app`, `.main` ani
  `.thread-col` — popsuje to całą logikę zaciskania kolumn.
- Nie używać `height: 100%` w `<pre>` ani w `.receipt` — niech ma własną
  wysokość, scroll poziomy w razie potrzeby (`overflow-x: auto`).
- Nie rozciągać `.letter` na pełną szerokość — krótkie maile mają być wąskie
  (`width: fit-content; max-width: 720px`).
- Nie wstrzykiwać surowego HTML maila bez sanitizera — body w `.letter-body`
  powinno być przepuszczone przez DOMPurify / odpowiednik na backendzie.

---

## Pliki w paczce

- `index.html` — kompletny mockup, samowystarczalny (Google Fonts via CDN,
  jeden inline `<script>` na drag + tabs). Bez zależności.
- `changes.md` — ten plik.
