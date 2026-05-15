// packages/ui/src/fonts.ts
// Font descriptors consumed by apps/web/app/layout.tsx via next/font/google.
// CSS variable names must stay stable — consumed by tailwind-preset.ts and globals.css.

export const fontDescriptors = {
  display: {
    name: "Anton",
    weights: [400],
    subsets: ["latin", "latin-ext"],
  },
  stencil: {
    name: "Big Shoulders Stencil",
    weights: [700, 800],
    subsets: ["latin", "latin-ext"],
  },
  marker: {
    name: "Permanent Marker",
    weights: [400],
    subsets: ["latin", "latin-ext"],
  },
  body: {
    name: "Inter Tight",
    weights: [300, 400, 500, 600, 700, 800],
    subsets: ["latin", "latin-ext"],
  },
  mono: {
    name: "JetBrains Mono",
    weights: [400, 500, 700],
    subsets: ["latin", "latin-ext"],
  },
} as const;

export const cssVars = {
  fontDisplay: "var(--font-display)",
  fontStencil: "var(--font-stencil)",
  fontMarker:  "var(--font-marker)",
  fontBody:    "var(--font-body)",
  fontMono:    "var(--font-mono)",
} as const;
