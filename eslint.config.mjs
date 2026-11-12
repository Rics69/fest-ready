import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    // Дефолтные исключения eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Cloudflare / OpenNext:
    ".open-next/**",
    ".wrangler/**",
    "cloudflare-env.d.ts",
    // Скопированные сборки tesseract.js (scripts/copy-tesseract.mjs):
    "public/vendor/**",
  ]),
]);

export default eslintConfig;
