// One-shot script to seed beta invite codes directly via Prisma.
// Bypasses the admin API (no auth chicken-and-egg) — use this for the
// initial cohort before any admin user exists.
//
// Usage:
//   vercel env pull .env.production.local --environment=production --yes
//   DATABASE_URL_UNPOOLED="$(grep DATABASE_URL_UNPOOLED .env.production.local | cut -d= -f2- | tr -d '\"')" \
//     node scripts/seed-invite-codes.mjs --count=70 --note="G2 beta cohort"
//
// Output: prints one code per line to stdout. Pipe to a file:
//   ... > /tmp/codes.txt
// (NEVER commit the codes file — it's secret material.)

import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client/index.js";
import { PrismaPg } from "@prisma/adapter-pg";

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // 32 chars, no 0/O/1/I
const SUFFIX_LEN = 7;
const CODE_PREFIX = "BETA-";

function generateInviteCode() {
  const bytes = randomBytes(SUFFIX_LEN);
  let suffix = "";
  for (let i = 0; i < SUFFIX_LEN; i += 1) {
    suffix += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return `${CODE_PREFIX}${suffix}`;
}

// Args -----------------------------------------------------------------
const args = Object.fromEntries(
  process.argv.slice(2)
    .filter((a) => a.startsWith("--"))
    .map((a) => {
      const [k, ...rest] = a.replace(/^--/, "").split("=");
      return [k, rest.join("=") || "true"];
    }),
);
const count = Math.max(1, parseInt(args.count ?? "10", 10));
const maxUses = Math.max(1, parseInt(args.maxUses ?? "1", 10));
const note = args.note ?? null;
const expiresAt = args.expiresAt ? new Date(args.expiresAt) : null;

const dbUrl =
  process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("ERROR: DATABASE_URL_UNPOOLED or DATABASE_URL must be set.");
  process.exit(2);
}

console.error(`# Minting ${count} codes (maxUses=${maxUses}, note="${note ?? ""}")...`);

const prisma = new PrismaClient({
  adapter: new PrismaPg(dbUrl),
});

let minted = 0;
try {
  for (let i = 0; i < count; i += 1) {
    let attempts = 0;
    let code;
    while (attempts < 5) {
      const candidate = generateInviteCode();
      try {
        const row = await prisma.inviteCode.create({
          data: {
            code: candidate,
            mintedById: null,
            note,
            maxUses,
            expiresAt,
          },
          select: { code: true },
        });
        code = row.code;
        break;
      } catch (err) {
        if (err?.code === "P2002") {
          attempts += 1;
          continue;
        }
        throw err;
      }
    }
    if (!code) throw new Error("INVITE_CODE_MINT_RETRIES_EXHAUSTED");
    process.stdout.write(`${code}\n`);
    minted += 1;
  }
} finally {
  await prisma.$disconnect();
}

console.error(`# Done — ${minted} codes minted.`);
