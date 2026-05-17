# Email tokens — Dr Shoes

Pochodne z M9 (`styles.css`), zoptymalizowane pod render w klientach poczty.
Tu zapisuję **tylko decyzje wymuszone przez constraints email-HTML** —
pełna paleta i typografia z M9 zostają.

---

## Paleta

Bez zmian względem M9. Status-color per template:

| Token        | Hex       | Użycie w mailu                                   |
|--------------|-----------|--------------------------------------------------|
| `--ink`      | `#0a0a0a` | Header bg, CTA bg, body text (light)             |
| `--paper`    | `#f4efe6` | Tło treści (light)                               |
| `--paper-2`  | `#ebe4d4` | Tło zewnętrzne i kafel order-code (light)        |
| `--line`     | `#d8d2c0` | Separatory detail-rows i footer                  |
| `--mute`     | `#6b6960` | Labelki, footer text                             |
| `--acid`     | `#d8ff3a` | Tekst na CTA, tagline pod wordmarkiem            |
| `--blue`     | `#2b5cff` | `ORDER_RECEIVED`                                 |
| `--magenta`  | `#ff2e7e` | `READY_FOR_PICKUP`                               |
| `--orange`   | `#ff5a1f` | `PICKUP_REMINDER`                                |
| `--green`    | `#18b06b` | `FEEDBACK_REQUEST`                               |

Status color występuje w **dwóch miejscach**:
1. Pasek akcentu `6px` pod headerem (zawsze).
2. Status-label tape/stamp w prawym górnym rogu headera (opcjonalnie, max 1).

---

## Typografia (system stack — bez webfontów)

| Rola     | Stack                                                            |
|----------|------------------------------------------------------------------|
| Stencil  | `Impact, "Arial Black", "Helvetica Inserat", system-ui, sans-serif` |
| Body     | `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif` |
| Mono     | `"SF Mono", "Menlo", "Consolas", "Liberation Mono", monospace`   |

Akceptujemy: w Outlooku/Windows Impact jest serwowany 1:1 — wygląda jak nasz stencil. Brak Big Shoulders Stencil to świadomy trade-off za niezawodność maila.

### Skala

| Rola         | Desktop          | Mobile (< 480px) |
|--------------|------------------|------------------|
| Wordmark     | 32 / 32 / .02em  | 26 / 26          |
| Headline     | 32 / 34 / -.01em | 24 / 28          |
| Order code   | 48 / 48 / -.02em | 36 / 40          |
| Order code (feedback — mniejszy) | 28 / 30 | 24 / 26   |
| Body         | 16 / 24          | 16 / 24          |
| Sign-off     | 15 / 22          | 15 / 22          |
| Label / mono | 11 / 16 / .14em uppercase | 11 / 16 |
| Tagline mini | 10 / 14 / .18em uppercase | 10 / 14 |
| Footer       | 12 / 18          | 12 / 18          |

---

## Spacing

Baseline `8px`.

- Padding-x sekcji: **`32px` desktop / `20px` mobile**.
- Padding między blokami: `28-36px`.
- Header strip: `24px` y / `32px` x.
- Order-code kafel: `18px 22px`.
- Detail row: `14px 0` (y), separator `1px solid #d8d2c0`.
- Footer: `20px 32px 24px`.
- Wrapper outer padding: `24px 12px` (oddech od krawędzi inboxa).

---

## Komponenty wspólne

### Header strip
- ink bg, 2 kolumny: `<wordmark + tagline>` po lewej, opcjonalny `<status-label>` po prawej.
- Tagline w `--acid` mono 10px tracked.
- Pod headerem zawsze `<td height="6">` w status color (accent bar).

### Order code block
- Karta `paper-2` bg, **2px ink border** (zamiast pop-shadow — niezawodne w Outlooku).
- Wewnątrz: mono label "ZLECENIE" + stencil number 48px.
- W `FEEDBACK_REQUEST` zmniejszony (28px) i bez ramki — kontekst jest już rozluźniony.

### Detail rows
- `<table>` 2-col, label-col fixed `width="160"`, vertical-align top.
- Label: mono 11px uppercase mute. Value: body 16px ink.
- Separator `border-bottom: 1px solid #d8d2c0`. Ostatni wiersz bez separatora.
- **Nie stackują się na mobile** — treść krótka, dwie kolumny zostają.

### Bulletproof CTA
- `<a>` w `<td bgcolor="#0a0a0a">`. ink bg, acid text, 2px ink border.
- Stencil 16px uppercase, padding `16px 28px`.
- Min hit target ≥ 44px wysokości.
- W dark mode CTA zachowuje ink bg + acid text (kontrast zostaje).

### Status-label (max 1 per mail)
- **Tape**: skewed rect (rotate ±2°), bg w status color, paper text. Stencil 13px uppercase.
- **Stamp**: 2px ink border, paper bg, status color text, brak rotacji. Stencil 13px.
- Spec per template patrz "Per-template decisions" niżej.

### Footer
- `paper-2` bg, top divider 1px line.
- 3 linie: pogrubiona nazwa / adres + godziny / stub STOP.
- Footer-text mute 12px.

---

## Dark mode

Selektywne nadpisanie via `@media (prefers-color-scheme: dark)`:

| Element           | Light       | Dark        |
|-------------------|-------------|-------------|
| body bg           | `#ebe4d4`   | `#0a0a0a`   |
| stage bg          | `#f4efe6`   | `#161616`   |
| ink text          | `#0a0a0a`   | `#f4efe6`   |
| mute text         | `#6b6960`   | `#b8b3a5`   |
| line              | `#d8d2c0`   | `#2a2a2a`   |
| order-code card   | `#ebe4d4`   | `#0a0a0a`   |
| footer bg         | `#ebe4d4`   | `#161616`   |
| accent bar        | status      | status raised brightness (+12%) |
| CTA               | ink/acid    | ink/acid (bez zmian)       |

Status colors **nie inwertujemy** — są wystarczająco saturated. Tylko delikatne podbicie jasności w dark.

---

## Mobile

`@media only screen and (max-width: 480px)`:
- Padding-x → `20px`.
- Order code → 36px.
- Headline → 24px / 28px.
- Header right-cell ze status-labelem — nie wraps; jeśli zabraknie miejsca, label opcjonalnie znika (`mso-hide:all` + `display:none` na mobile).

---

## Granitowe gesty (max 1–2 / mail)

Pasek akcentu jest **zawsze** = 1 gest. Drugi gest jest opcjonalny i status-zależny:

| Template            | Gesty                                                |
|---------------------|------------------------------------------------------|
| `ORDER_RECEIVED`    | accent bar (blue) + tape "PRZYJĘTE" (header right)  |
| `READY_FOR_PICKUP`  | accent bar (magenta) + stamp "ODBIERZ" (header right)|
| `PICKUP_REMINDER`   | accent bar (orange) + tape "JUTRO" (header right)   |
| `FEEDBACK_REQUEST`  | accent bar (green) — tylko jeden gest, świadome powściągnięcie |

---

## Constraints decisions

- **Brak `border-radius` w ogóle.** Graffiti = hard edges. Outlook też się cieszy.
- **Brak `box-shadow`.** Pop-shadow z M9 zastąpiony przez `border: 2px solid #0a0a0a` na karcie order-code — wizualnie równowartość, niezawodne.
- **Brak SVG layoutowego.** Wordmark to czysty tekst Impact. Akcent bar to `<td height="6">`.
- **Brak background-image.** Wszystkie kolory przez `bgcolor` + `background` inline.
- **Brak JS / `<form>`.** CTA to plain `<a href>`.
- **Preheader** `<div style="display:none">` z dopiskiem `&zwnj;&nbsp;` × 8 — wypycha klienta-pocztowy default ("View in browser") z preview-line.
- **Polskie znaki**: `<meta charset="utf-8">` + plain UTF-8 we wszystkich plikach (.html i .txt).
- **Hit-area mobile**: CTA min 44×44 — gwarantowane przez `padding: 16px 28px` + stencil 16px → effective height ≥ 48px.

---

## Pliki

```
handoff/design/email/
├── email-tokens.md                       ← ten plik
├── email-templates.html                  ← stack do review (rendered z sample data)
└── templates/
    ├── 01-order-received.html
    ├── 01-order-received.txt
    ├── 02-ready-for-pickup.html
    ├── 02-ready-for-pickup.txt
    ├── 03-pickup-reminder.html
    ├── 03-pickup-reminder.txt
    ├── 04-feedback-request.html
    └── 04-feedback-request.txt
```

Każdy `.html` ma na górze komentarz z subject + preheader. Placeholdery w `{mustache_style}` — nazwy 1:1 z briefu.
