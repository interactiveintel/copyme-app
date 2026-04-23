// Local-only test helper. Don't use in production.
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
require("dotenv").config({ path: ".env.local" });

const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL) });

(async () => {
  const adId = process.argv[2];
  if (!adId) { console.error("usage: node scripts/approve-test-ad.cjs <adId>"); process.exit(1); }
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const ad = await prisma.businessAd.update({
    where: { id: adId },
    data: { status: "approved", activatedAt: now, expiresAt, reviewedAt: now },
  });
  console.log(JSON.stringify({ id: ad.id, status: ad.status, activatedAt: ad.activatedAt }));
  process.exit(0);
})();
