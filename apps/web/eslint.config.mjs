import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/** @type {import("eslint").Linter.Config[]} */
const config = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "next-env.d.ts",
      "tsconfig.tsbuildinfo",
      "public/**",
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // The standard React data-fetching pattern (useEffect + setState-on-resolve)
      // trips this rule. Codebase-wide migration to SWR / React Query / use() API
      // is its own initiative; revisit when adopting React Compiler.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    // Photo previews use <img> for arbitrary user-uploaded R2 URLs without known
    // dimensions. Migration to next/image with `fill` is tracked as photo polish.
    files: [
      "app/(admin)/admin/orders/_components/PhotoCard.tsx",
      "app/(admin)/admin/orders/_components/PhotoLightbox.tsx",
    ],
    rules: {
      "@next/next/no-img-element": "off",
    },
  },
];

export default config;
