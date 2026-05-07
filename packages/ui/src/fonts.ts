// Re-exported by apps/web via next/font for CSS variable wiring.
export const fontDescriptors = {
  display: { name: "Bungee", weights: [400], subsets: ["latin", "latin-ext"] },
  marker:  { name: "Permanent Marker", weights: [400], subsets: ["latin", "latin-ext"] },
  body:    { name: "Inter", weights: [300, 400, 500, 600, 700, 800], subsets: ["latin", "latin-ext"] },
  mono:    { name: "JetBrains Mono", weights: [400, 500, 700], subsets: ["latin", "latin-ext"] },
} as const;

export const cssVars = {
  fontDisplay: "var(--font-display)",
  fontMarker:  "var(--font-marker)",
  fontBody:    "var(--font-body)",
  fontMono:    "var(--font-mono)",
} as const;
