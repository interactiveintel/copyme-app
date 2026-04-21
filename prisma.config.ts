import { defineConfig } from "prisma/config";

// Vercel injects env vars at build time. Locally, load .env.local so
// `npm run vercel-build` works outside of Vercel.
if (!process.env.DATABASE_URL_UNPOOLED && !process.env.DATABASE_URL) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("fs");
    const path = require("path");
    for (const name of [".env.local", ".env"]) {
      const file = path.resolve(process.cwd(), name);
      if (!fs.existsSync(file)) continue;
      const body = fs.readFileSync(file, "utf8") as string;
      for (const line of body.split("\n")) {
        const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|(.*))\s*$/);
        if (!m) continue;
        const key = m[1]!;
        const value = m[2] ?? m[3] ?? m[4] ?? "";
        if (!process.env[key]) process.env[key] = value;
      }
    }
  } catch {
    // ignore — env will be validated in migrationUrl()
  }
}

// ---------------------------------------------------------------------------
// Prisma 7 configuration file.
//
// `prisma migrate deploy` and `prisma migrate dev` read the datasource URL
// from this file (not from schema.prisma, which no longer accepts a `url`
// in Prisma 7). The runtime PrismaClient in src/lib/db.ts is still wired
// with its own PrismaPg adapter.
//
// Neon pooled connections can't run DDL — migrations must use the UNPOOLED
// URL. Both URLs are provided by Vercel (and .env.local locally).
// ---------------------------------------------------------------------------

function migrationUrl(): string {
  const url =
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.DIRECT_DATABASE_URL ||
    process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "Prisma migrations require DATABASE_URL_UNPOOLED (or DATABASE_URL) to be set.",
    );
  }
  return url;
}

export default defineConfig({
  schema: "./prisma/schema.prisma",
  migrations: {
    path: "./prisma/migrations",
  },
  datasource: {
    url: migrationUrl(),
  },
});
