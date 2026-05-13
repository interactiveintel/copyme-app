// One-shot script to hard-delete users by id. Used to clean up test
// accounts created during the v4.12.x beta gate verification. The User
// model uses ON DELETE CASCADE for sessions, tokens, messages, etc.,
// so a single delete propagates to the dependent rows.
//
// Usage:
//   vercel env pull .env.production.local --environment=production --yes
//   DATABASE_URL_UNPOOLED="$(grep DATABASE_URL_UNPOOLED .env.production.local | cut -d= -f2- | tr -d '\"')" \
//     node scripts/delete-users.mjs <userId> [<userId>...]

import { PrismaClient } from "@prisma/client/index.js";
import { PrismaPg } from "@prisma/adapter-pg";

const ids = process.argv.slice(2).filter((a) => !a.startsWith("--"));
if (ids.length === 0) {
  console.error("Usage: node scripts/delete-users.mjs <userId> [<userId>...]");
  process.exit(2);
}

const dbUrl = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("ERROR: DATABASE_URL_UNPOOLED or DATABASE_URL must be set.");
  process.exit(2);
}

const prisma = new PrismaClient({ adapter: new PrismaPg(dbUrl) });

let deleted = 0;
let missing = 0;
try {
  for (const id of ids) {
    try {
      const u = await prisma.user.delete({
        where: { id },
        select: { id: true, displayName: true },
      });
      console.log(`deleted ${u.id} (${u.displayName})`);
      deleted += 1;
    } catch (err) {
      if (err?.code === "P2025") {
        console.log(`skip   ${id} (not found)`);
        missing += 1;
        continue;
      }
      throw err;
    }
  }
} finally {
  await prisma.$disconnect();
}

console.error(`# Done — ${deleted} deleted, ${missing} not found.`);
