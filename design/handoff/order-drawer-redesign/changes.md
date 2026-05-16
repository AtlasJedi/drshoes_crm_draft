# OrderDrawer · redesign — handoff notes

Pięć fixów względem screenshotów z 16.05. Tokeny i klasy bez zmian
względem M9 (`--ink`, `--paper`, status colors, stencil/mono fonts).

## 1 · Info compact

Zamiast pięciu stackowanych pól (klient / opis / czas / wycena / zaliczka /
do zapłaty), pojedynczy block z ink borderem:

- **Wiersz `KLIENT`**: 3 kolumny grid (label-mono · nazwa · telefon-mono).
- **Stats grid 4-kol**: `czas · wycena · zaliczka · do zapłaty`. Separatory
  pionowe 1.5px ink. Stencil values, mono labels. `do zapłaty` w magenta.

Oszczędność ~120px wysokości.

## 2 · Opis bez labelki

Textarea bez osobnego `<label>OPIS</label>` w stacku. W zamian:

- **Placeholder** w polu: „Opis zlecenia — co konkretnie jest do zrobienia,
  materiał, kolor, uwagi klienta…"
- **Mini-taśma „opis"** w prawym górnym rogu (acid bg, rotate -2°) zostawia
  semantyczny hak na wypadek gdyby placeholder zniknął po wpisie.

Field zachowuje istniejący focus ring acid.

## 3 · Status buttons — full-width fancy

Sześć klocków w grid 3×2: `Przyjęte · Realizacja · Czeka / Gotowe · Wydane · Anuluj`.

**Idle:** paper bg · 1.5px ink border · pop-shadow 3px ink · tekst w kolorze statusu (stencil 14px uppercase).

**Hover (animacje):**
1. Paint-fill wjeżdża z dołu w kolorze statusu (`transform: translateY` na pseudo `::before`, 250ms, custom bezier).
2. Diagonal light streak (`::after` skewX -22deg, biały 18%) przelatuje przez button (550ms).
Tekst zmienia się na paper.

**Active:** wypełnienie zostaje, dodatkowo ink-diamond (rotated square) w prawym górnym rogu jako wizualny ślad „wybrane".

**Anuluj:** osobne `::before` z diagonal hatch w `--red` na hover (8px stripes). Sygnalizuje destrukcję — różny od reszty.

**Press:** `translate(1px,1px)` + shadow shrink. Mechaniczny feedback.

## 4 · Historia — 5 ikon stencil

Wszystkie 28×28 px, tile w kolorze typu + paper-stencil symbol, pop-shadow ink:

| Typ            | Tile color    | Symbol                                         |
|----------------|---------------|------------------------------------------------|
| `creation`     | blue          | krzyż „+" stencil                              |
| `status_change`| **kolor docelowego statusu** | dwustronna strzałka            |
| `note`         | acid          | trzy poziome linie (jak liniowany papier)     |
| `message`      | magenta       | koperta (kontur + linie flapu)                 |
| `done` *(new)* | ink           | acid check                                     |

`status_change` zmienia kolor dynamicznie:
- → Realizacja = orange tile, → Gotowe = green tile, → Wydane = ink tile…

`done` to **nowy typ** wpisu — używany przy finalnym wydaniu zlecenia
(domyka thread). Visually distinct od `status_change → Wydane`: ink tile + acid check zamiast strzałek.

## 5 · Photos — klikalny placeholder

Wyrzucony osobny czarny przycisk `Prześlij zdjęcia`. Każdy kafel siatki to
sam w sobie upload-zone:

- **Empty tile:** aspect-ratio 1:1, dashed 2px ink border, stencil „+" 28px + mono-hint „WGRAJ".
- **Hover:** dashed → solid + pop-shadow 3px ink + translate(-1px,-1px).
- **Drag-over** (do podłączenia w komponencie): bg paper-2 + accent ramka acid.
- **Po uploadzie:** kafel zmienia się w thumb z mini-X-em w rogu (ink bg, paper close-icon). Nowy `+`-tile dosypuje się na koniec siatki.

Grid 4-kol desktop / 2-kol mobile, gap 8px.

## Komponenty do podzielenia w repo

```
apps/web/app/(admin)/admin/orders/_components/
├── OrderDrawerHeader.tsx          (istnieje · patch z M10)
├── OrderDrawerInfoBlock.tsx       (NEW · klient + stats)
├── OrderDrawerOpis.tsx            (NEW · textarea bez labelki)
├── OrderDrawerStatusGrid.tsx      (NEW · 6 paint-fill buttonów)
├── OrderDrawerPhotos.tsx          (REWORK · klikalna siatka)
├── OrderDrawerNotes.tsx           (REWORK · nowe ikony)
├── HistoryIcon.tsx                (NEW · 5 wariantów)
└── OrderDrawerNoteComposer.tsx    (istnieje · M10)
```

CSS klasy do podłączenia w `styles.css` (lub `tailwind.config` jeśli idziecie
tailwindem): wszystkie selektory z `index.html` są nazwane semantycznie
(`.status-btn.s-*`, `.hist-icon`, `.photo-add`) — można je przeklepać 1:1.
