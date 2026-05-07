# Design System — Dr Shoes

Tokens and patterns extracted from `design/Dr Shoes Site + CRM.html`. Follow them.

## Palette

| Token | Value | Use |
|---|---|---|
| `--ink` | `#0c0c0d` | Primary background (landing, deep surfaces) |
| `--paper` | `#f3efe6` | Off-white / cream paper background |
| `--paper-2` | `#e8e2d3` | Secondary paper / cards in admin |
| `--admin-bg` | `#f7f5ef` | Admin canvas |
| `--admin-surface` | `#ffffff` | Admin panels, tables |
| `--admin-line` | `#e3ddcc` | Borders, dividers |
| `--admin-ink` | `#1a1a1c` | Admin text |
| `--admin-mute` | `#6b6960` | Secondary text |

### Accents (use like spray cans — sparingly)

| Token | Value | Use |
|---|---|---|
| `--acid` | `#e6ff3a` | Primary accent / CTAs / active state |
| `--magenta` | `#ff2e88` | Secondary accent / urgency / highlights |
| `--blue` | `#2a6fdb` | Tertiary accent / links / info |
| `--orange` | `#ff6b1a` | Warning / "pilne" / "zaległe" |
| `--green` | `#1f8a5b` | Success / "wydane" / "dostępne" |

### Status colors (Sklep)
- `dostępne` → `--green`
- `zarezerwowane` → `--acid` (on dark bg)
- `sprzedane` → `--admin-mute` / desaturated

### Status colors (Zamówienia)
- `przyjęte` → `--blue`
- `w realizacji` → `--acid`
- `czeka na klienta` → `--orange`
- `gotowe do odbioru` → `--magenta`
- `wydane` → `--green`
- `anulowane` → `--admin-mute`

## Typography

- **Display / wordmark:** a heavy stencil or bold display. The prototype uses **Bungee** (Google Fonts) for headlines and **Permanent Marker** for tagged accents. Pick a license-clean equivalent if needed.
- **Body:** clean sans — **Inter** or **IBM Plex Sans**. The prototype defaults to a system stack with Inter as primary; admin uses Inter exclusively.
- **Mono (timestamps, IDs, captions):** **JetBrains Mono** or **IBM Plex Mono**.

Scale (admin):
- Body: 14px / 1.5
- Small: 12px
- H3: 16px / 600
- H2: 20px / 700
- H1: 28px / 800
- Display: 48–96px (landing only)

## Components

### Buttons
- Primary (landing): black bg, acid text, slight rotation on hover, drip pseudo-element.
- Primary (admin): black bg, white text, no flair.
- Secondary: outlined, paper bg.
- Destructive: outlined orange.

### Status badge
Stencil-style: uppercase, mono or bungee, 1px sprayed border, color-coded background fill.

### Filter chip
Taped-paper look on landing (slight rotation + tape strip pseudo). Clean rounded-pill on admin.

### Cards
- Landing news/shop: paper bg, 2px ink border, hover lift + zoom.
- Admin: white surface, 1px line, no shadow at rest, light shadow on hover.

### Tables (admin)
Dense rows, 12px vertical padding, sticky header, zebra optional. Row click opens drawer.

### Drawer
Slides in from right, 720px wide (desktop), full-width on mobile. Backdrop dimmed 40%.

### Form fields
- Admin: 36px height, 1px border, 4px radius, focus ring acid.
- Landing: taller (44px), heavier border (2px ink).

## Motion

- Hover zoom on imagery: scale 1.4–1.8 with 1–3deg rotation, 300ms ease-out.
- Page section reveal: clip-path or paint-drip mask animations on enter.
- Drawer: 240ms ease-out.
- Status change: 160ms color crossfade.
- Avoid bouncy springs in admin. Reserve them for landing.

## Polish microcopy
All UI strings in Polish. Pull verbatim from the prototype where present. Tone: casual, trade-confident, no corporate filler.
