# Nowy komponent: 4 maile transakcyjne

Potrzebuję maili HTML w naszym języku wizualnym — wszystko inne (marka, paleta, typografia, ton, prototyp) masz już w spec. Trzymaj się.

## Deliverable
1. `email-templates.html` — wszystkie 4 maile stack'iem, do scrollowania i porównania.
2. Dla każdego: **subject** (PL, ≤ 60 znaków) + **HTML body** (table-based, inline CSS) + **plain-text fallback** (≤ 70 kol.).
3. `email-tokens.md` — krótka mapa decyzji (kolory, type scale, spacing) do reuse'u w kolejnych mailach.

## Templaty

Placeholdery jak w Mustache: `{numer_zlecenia}`, `{imie_klienta}`, `{typ_pracy}`, `{data_odbioru}`, `{adres_warsztatu}`, `{godziny_otwarcia}`, `{url_warsztatu}`, `{nazwa_warsztatu}`. Designuj wokół nich, nie hardkoduj.

| # | Klucz | Status color | Cel | Must-show |
|---|---|---|---|---|
| 1 | `ORDER_RECEIVED` | `--blue` | potwierdzenie przyjęcia zlecenia | numer zlecenia (BIG), typ pracy, data odbioru |
| 2 | `READY_FOR_PICKUP` | `--magenta` | „przyjdź odebrać" | numer, adres, godziny, CTA „Zobacz na mapie" → `{url_warsztatu}` |
| 3 | `PICKUP_REMINDER` | `--orange` | nudge dzień przed odbiorem | numer, data + przedział, adres, opcja przesunięcia |
| 4 | `FEEDBACK_REQUEST` | `--green` | prośba o opinię 3 dni po wydaniu | numer (mniejszy), CTA „Wystaw opinię" + fallback „odpisz na tego maila" |

## Komponenty wspólne (zdefiniuj raz, reuse)
- Header strip (wordmark + tagline + accent bar w kolorze statusu)
- Order code block — duży, stencil, mono, jak numer seryjny
- Detail rows — label / value, dwukolumnowa
- Bulletproof CTA — czarne tło, acid (`#e6ff3a`) tekst, uppercase
- Footer — nazwa / adres / kontakt + jednoliniowy stub „Odpisz STOP"

## Twarde constraints email-HTML
- Table layout, `role="presentation"`, **inline CSS** (flex/grid nie istnieje w Outlooku)
- Max 600px, responsywne do 320px
- **Bez webfontów** — system fallback (`Impact, "Arial Black", system-ui` dla stencilu; `-apple-system, Segoe UI, Roboto` dla body; `SF Mono, JetBrains Mono` dla kodów)
- `<meta charset="utf-8">` — polskie znaki muszą przetrwać
- `@media (prefers-color-scheme: dark)` — ink bg + paper tekst, status colors raise contrast
- Preheader `<div style="display:none">` z ludzkim tekstem zamiast „View in browser"
- Bez JS, bez `<form>`, bez SVG layoutowego, bez background-image na content
- Granitowy gest (taśma / stencil / spray) — max 1–2 per mail, restraint

## Out of scope
Sklep / news / SMS templates / inne języki / nagłówki List-Unsubscribe (dev je doda).

Export → `handoff/design/email/`.
