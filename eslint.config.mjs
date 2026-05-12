import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // A4: lint should never see generated/vendor/legacy files. The Next.js
  // build emits .d.ts and route validators under .next/types — those are
  // mechanical, not source. Prisma client output goes under node_modules.
  // Scripts/*.cjs are intentionally CommonJS one-shots.
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "next-env.d.ts",
      "scripts/**/*.cjs",
      "prisma.config.ts", // top-level CJS-ish config Prisma loads; not editable
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default eslintConfig;
