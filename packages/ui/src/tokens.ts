// packages/ui/src/tokens.ts
// Design token source of truth for Dr Shoes.
// Values mirror handoff/design/styles.css verbatim — do not tweak.

export const colors = {
  ink:           "#0a0a0a",
  ink2:          "#1a1a1a",
  ink3:          "#2a2a2a",
  paper:         "#f4efe6",
  paper2:        "#ebe4d4",
  paper3:        "#ddd3bd",
  adminBg:       "#f7f5ef",
  adminSurface:  "#ffffff",
  adminLine:     "#e3ddcc",
  adminInk:      "#1a1a1c",
  adminMute:     "#6b6960",
  acid:          "#d8ff3a",
  magenta:       "#ff2e7e",
  pink:          "#ff2e7e",   // alias — same hex, used in design JSX as both "magenta" and "pink"
  blue:          "#2b5cff",
  orange:        "#ff5a1f",
  green:         "#18b06b",
  red:           "#e1342b",
  line:          "rgba(10,10,10,0.18)",
  line2:         "rgba(10,10,10,0.08)",
} as const;

// BREAKING vs M7: GOTOWE_DO_ODBIORU was magenta — design spec says green.
// BREAKING vs M7: W_REALIZACJI was acid — design spec says orange.
// BREAKING vs M7: WYDANE was green — design spec says ink3 (muted).
// BREAKING vs M7: ANULOWANE was adminMute — design spec says red.
// Update every <Pill> call-site during task 9-5 (Pill primitive).
export const orderStatusColor = {
  WSTEPNIE_PRZYJETE: colors.adminMute,
  PRZYJETE:          colors.blue,
  W_REALIZACJI:      colors.orange,
  CZEKA_NA_KLIENTA:  "#a17a00",   // dark yellow per design pill-czeka class
  GOTOWE_DO_ODBIORU: colors.green,
  WYDANE:            colors.ink3,
  ANULOWANE:         colors.red,
} as const;

export const productStatusColor = {
  DOSTEPNE:      colors.green,
  ZAREZERWOWANE: colors.magenta,
  SPRZEDANE:     colors.adminMute,
} as const;

export const radii = { xs: "2px", sm: "4px", md: "8px", lg: "16px" } as const;

export const spacing = {
  none: 0, xs: 2, sm: 4, md: 8, lg: 12, xl: 16, "2xl": 24, "3xl": 32, "4xl": 48,
} as const;

export const motion = {
  hoverZoom:  "300ms ease-out",
  drawer:     "240ms ease-out",
  statusFade: "160ms ease-out",
} as const;
