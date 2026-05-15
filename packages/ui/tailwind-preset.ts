// packages/ui/tailwind-preset.ts
import type { Config } from "tailwindcss";
import { colors, radii, motion } from "./src/tokens";
import { cssVars } from "./src/fonts";

const preset: Partial<Config> = {
  theme: {
    extend: {
      colors: {
        ink:             colors.ink,
        "ink-2":         colors.ink2,
        "ink-3":         colors.ink3,
        paper:           colors.paper,
        "paper-2":       colors.paper2,
        "paper-3":       colors.paper3,
        "admin-bg":      colors.adminBg,
        "admin-surface": colors.adminSurface,
        "admin-line":    colors.adminLine,
        "admin-ink":     colors.adminInk,
        "admin-mute":    colors.adminMute,
        acid:            colors.acid,
        magenta:         colors.magenta,
        pink:            colors.pink,
        blue:            colors.blue,
        orange:          colors.orange,
        green:           colors.green,
        red:             colors.red,
      },
      borderRadius: { xs: radii.xs, sm: radii.sm, md: radii.md, lg: radii.lg },
      fontFamily: {
        display: [cssVars.fontDisplay, "Impact", "sans-serif"],
        stencil: [cssVars.fontStencil, "Impact", "sans-serif"],
        marker:  [cssVars.fontMarker,  "cursive"],
        sans:    [cssVars.fontBody,    "ui-sans-serif", "system-ui"],
        mono:    [cssVars.fontMono,    "ui-monospace", "monospace"],
      },
      boxShadow: {
        "pop":       "5px 5px 0 #0a0a0a",
        "pop-sm":    "3px 3px 0 #0a0a0a",
        "pop-card":  "3px 3px 0 #0a0a0a",
        "pop-pink":  "-6px 6px 0 #ff2e7e, -6px 6px 0 1.5px #0a0a0a",
        "pop-acid":  "-6px 6px 0 #d8ff3a, -6px 6px 0 1.5px #0a0a0a",
        "pop-blue":  "-6px 6px 0 #2b5cff, -6px 6px 0 1.5px #0a0a0a",
      },
      gridTemplateColumns: {
        "admin-msg-3": "320px 1fr 280px",
        "admin-trig":  "1.4fr 1fr",
        "admin-sklep": "1.5fr 1fr",
      },
      aspectRatio: {
        "4-3":   "4 / 3",
        "16-10": "16 / 10",
      },
      transitionTimingFunction: {
        "hover-zoom":  motion.hoverZoom.split(" ").pop()!,
        drawer:        motion.drawer.split(" ").pop()!,
        "status-fade": motion.statusFade.split(" ").pop()!,
      },
    },
  },
};

export default preset;
