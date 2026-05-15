import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "path";

const nm = (p: string) => path.resolve(__dirname, "node_modules", p);

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  resolve: {
    // Allow packages/ui tests (which live two levels above apps/web but run
    // in apps/web's vitest context) to resolve React + testing-library.
    // String aliases match exact bare specifiers; sub-path aliases are explicit.
    alias: [
      { find: "react/jsx-dev-runtime", replacement: nm("react/jsx-dev-runtime") },
      { find: "react/jsx-runtime", replacement: nm("react/jsx-runtime") },
      { find: "react-dom/client", replacement: nm("react-dom/client") },
      { find: "react-dom/server", replacement: nm("react-dom/server") },
      { find: "react-dom", replacement: nm("react-dom") },
      { find: "react", replacement: nm("react") },
      { find: "@testing-library/react", replacement: nm("@testing-library/react") },
      { find: "@testing-library/jest-dom", replacement: nm("@testing-library/jest-dom") },
      { find: "@testing-library/user-event", replacement: nm("@testing-library/user-event") },
    ],
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
