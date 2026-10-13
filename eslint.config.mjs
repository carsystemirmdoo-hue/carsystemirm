import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

const eslintConfig = [
  {
    // `.next-verify` je izlaz komande `npm run build:check` (vidi next.config.ts).
    ignores: [
      ".next/**",
      ".next-verify/**",
      ".next-dev/**",
      ".next-pilot/**",
      // Izlaz izolovanog dev servera za search QA (`npm run dev:search`).
      ".next-search-dev/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      // Jednokratni alati provere javnog sajta, sačuvani kao dokaz uz izveštaj
      // (docs/javni-sajt). Nisu deo aplikacije ni build-a.
      "docs/javni-sajt/provera-*/skripte/**",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default eslintConfig;
