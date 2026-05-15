import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    environmentOptions: {
      jsdom: { resources: "usable" },
    },
    include: [
      "**/__tests__/**/*.{ts,tsx}",
      "**/*.{spec,test}.{ts,tsx}",
      "../../packages/ui/src/**/__tests__/**/*.{ts,tsx}",
      "../../packages/ui/src/**/*.{spec,test}.{ts,tsx}",
    ],
    exclude: ["**/node_modules/**", "**/dist/**", "e2e/**"],
  },
});
