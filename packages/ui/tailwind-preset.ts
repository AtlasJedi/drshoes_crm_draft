import type { Config } from "tailwindcss";
import { colors, radii, motion } from "./src/tokens";
import { cssVars } from "./src/fonts";

const preset: Partial<Config> = {
  theme: {
    extend: {
      colors: {
        ink: colors.ink,
        paper: colors.paper,
        "paper-2": colors.paper2,
        "admin-bg": colors.adminBg,
        "admin-surface": colors.adminSurface,
        "admin-line": colors.adminLine,
        "admin-ink": colors.adminInk,
        "admin-mute": colors.adminMute,
        acid: colors.acid,
        magenta: colors.magenta,
        blue: colors.blue,
        orange: colors.orange,
        green: colors.green,
      },
      borderRadius: { xs: radii.xs, sm: radii.sm, md: radii.md, lg: radii.lg },
      fontFamily: {
        display: [cssVars.fontDisplay, "ui-sans-serif", "system-ui"],
        marker:  [cssVars.fontMarker,  "cursive"],
        sans:    [cssVars.fontBody,    "ui-sans-serif", "system-ui"],
        mono:    [cssVars.fontMono,    "ui-monospace", "monospace"],
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
