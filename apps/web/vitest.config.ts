import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "path";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  resolve: {
    // Allow packages/ui tests (which run in apps/web's vitest context but live
    // two levels up) to resolve react, @testing-library/*, etc. that only
    // live in apps/web/node_modules.
    alias: {
      react: path.resolve(__dirname, "node_modules/react"),
      "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
      "@testing-library/react": path.resolve(
        __dirname,
        "node_modules/@testing-library/react"
      ),
      "@testing-library/jest-dom": path.resolve(
        __dirname,
        "node_modules/@testing-library/jest-dom"
      ),
    },
  },
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
