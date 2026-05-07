export const colors = {
  ink: "#0c0c0d",
  paper: "#f3efe6",
  paper2: "#e8e2d3",
  adminBg: "#f7f5ef",
  adminSurface: "#ffffff",
  adminLine: "#e3ddcc",
  adminInk: "#1a1a1c",
  adminMute: "#6b6960",
  acid: "#e6ff3a",
  magenta: "#ff2e88",
  blue: "#2a6fdb",
  orange: "#ff6b1a",
  green: "#1f8a5b",
} as const;

export const orderStatusColor = {
  WSTEPNIE_PRZYJETE: colors.adminMute,
  PRZYJETE: colors.blue,
  W_REALIZACJI: colors.acid,
  CZEKA_NA_KLIENTA: colors.orange,
  GOTOWE_DO_ODBIORU: colors.magenta,
  WYDANE: colors.green,
  ANULOWANE: colors.adminMute,
} as const;

export const productStatusColor = {
  DOSTEPNE: colors.green,
  ZAREZERWOWANE: colors.acid,
  SPRZEDANE: colors.adminMute,
} as const;

export const radii = { xs: "2px", sm: "4px", md: "8px", lg: "16px" } as const;

export const spacing = {
  none: 0, xs: 2, sm: 4, md: 8, lg: 12, xl: 16, "2xl": 24, "3xl": 32, "4xl": 48,
} as const;

export const motion = {
  hoverZoom: "300ms ease-out",
  drawer: "240ms ease-out",
  statusFade: "160ms ease-out",
} as const;
