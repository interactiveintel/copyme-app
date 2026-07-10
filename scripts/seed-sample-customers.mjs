// scripts/seed-sample-customers.mjs — v4.16.24
//
// Seeds a realistic beta-test cohort ("sample set of customers") into
// the database: full profiles with location (dial-code country), 7
// interests, mixed tiers, mixed languages, staggered lastActivityAt —
// enough surface for Paul + Joze to exercise search (name / region /
// country / interests), the "Active in" pills, AI match ranking, tier
// retention badges, VAP, and calls against non-empty accounts.
//
// Idempotent: each customer is keyed by a deterministic phone number
// (+1555124xxxx). Re-running skips existing rows.
//
// Usage:
//   npx vercel env pull .env.production.local --environment=production --yes
//   DATABASE_URL_UNPOOLED="$(grep '^DATABASE_URL_UNPOOLED=' .env.production.local | cut -d= -f2- | tr -d '"')" \
//     node scripts/seed-sample-customers.mjs
//   rm .env.production.local
//
// All accounts share the QA password below — beta-only convenience so
// any tester can sign in as any sample customer. Rotate/delete the
// cohort before public launch (delete: scripts/delete-users.mjs).

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";

const QA_PASSWORD = "CopyMeQA-2026!";

// name, globalArea, dialCode, region, city, tier, locale, interests[7]
//
// NOTE: customer #1 of the cohort — Emma Laurent (+15551230001,
// North America/Florida/Miami, 7 interests) — was created by hand
// during the v4.16.17 crash repro and already exists in prod. This
// list seeds the remaining 23 (cohort total: 24).
const CUSTOMERS = [
  ["Liam O'Sullivan",   "North America", "+1",   "Florida",              "Orlando",     "basic",       "en", ["fishing", "grilling", "football", "craft beer", "boating", "podcasts", "history"]],
  ["Sofia Ramirez",     "North America", "+1",   "California",           "San Diego",   "business_3",  "es", ["surfing", "photography", "startups", "spanish literature", "hiking", "tacos", "design"]],
  ["Noah Kim",          "North America", "+1",   "New York",             "Brooklyn",    "basic",       "en", ["jazz", "vinyl records", "coffee", "cycling", "architecture", "cooking", "chess"]],
  ["Ava Thompson",      "North America", "+1",   "Texas",                "Austin",      "business_7",  "en", ["live music", "bbq", "entrepreneurship", "running", "AI", "real estate", "dogs"]],
  ["Lucas Novak",       "Europe",        "+386", "Osrednjeslovenska",    "Ljubljana",   "basic",       "si", ["hiking", "climbing", "photography", "craft beer", "skiing", "chess", "history"]],
  ["Zala Kovač",        "Europe",        "+386", "Gorenjska",            "Bled",        "business_3",  "si", ["rowing", "baking", "travel", "languages", "yoga", "gardening", "painting"]],
  ["Matej Horvat",      "Europe",        "+386", "Podravska",            "Maribor",     "basic",       "si", ["football", "wine", "technology", "cycling", "grilling", "movies", "fishing"]],
  ["Hannah Weber",      "Europe",        "+49",  "Bavaria",              "Munich",      "basic",       "de", ["hiking", "classical music", "engineering", "beer gardens", "reading", "skiing", "baking"]],
  ["Felix Braun",       "Europe",        "+49",  "Berlin",               "Berlin",      "ecommerce",   "de", ["techno", "startups", "cycling", "street art", "coffee", "AI", "photography"]],
  ["Chloé Dubois",      "Europe",        "+33",  "Île-de-France",        "Paris",       "basic",       "fr", ["fashion", "painting", "wine", "philosophy", "cinema", "cooking", "travel"]],
  ["Gabriel Moreau",    "Europe",        "+33",  "Provence",             "Marseille",   "basic",       "fr", ["sailing", "fishing", "pétanque", "cooking", "football", "photography", "music"]],
  ["Isabella Rossi",    "Europe",        "+39",  "Lombardy",             "Milan",       "business_3",  "en", ["fashion design", "espresso", "opera", "travel", "architecture", "cooking", "art"]],
  ["Marco Bianchi",     "Europe",        "+39",  "Tuscany",              "Florence",    "basic",       "en", ["wine making", "cycling", "renaissance art", "cooking", "photography", "hiking", "history"]],
  ["Olivia Bennett",    "Europe",        "+44",  "Greater London",       "London",      "business_7",  "en", ["theatre", "running", "fintech", "gin", "reading", "travel", "tennis"]],
  ["James Clarke",      "Europe",        "+44",  "Manchester",           "Manchester",  "basic",       "en", ["football", "indie music", "gaming", "craft beer", "podcasts", "cycling", "cooking"]],
  ["Mia Van Der Berg",  "Europe",        "+31",  "North Holland",        "Amsterdam",   "basic",       "en", ["cycling", "design", "canals", "photography", "sustainability", "coffee", "art"]],
  ["Ana Kovačević",     "Europe",        "+385", "Zagreb County",        "Zagreb",      "basic",       "en", ["sea kayaking", "travel", "photography", "cooking", "languages", "hiking", "wine"]],
  ["David Gruber",      "Europe",        "+43",  "Vienna",               "Vienna",      "basic",       "de", ["classical music", "skiing", "coffee houses", "chess", "philosophy", "hiking", "wine"]],
  ["Carmen Torres",     "Europe",        "+34",  "Catalonia",            "Barcelona",   "business_3",  "es", ["tapas", "beach volleyball", "architecture", "flamenco", "startups", "travel", "photography"]],
  ["Elena Petrova",     "Europe",        "+34",  "Madrid",               "Madrid",      "basic",       "es", ["painting", "museums", "running", "cooking", "languages", "travel", "music"]],
  ["Ethan Walker",      "North America", "+1",   "California",           "San Francisco","ecommerce",  "en", ["AI", "rock climbing", "sourdough", "cycling", "startups", "photography", "sci-fi"]],
  ["Grace Miller",      "North America", "+1",   "Washington",           "Seattle",     "basic",       "en", ["coffee roasting", "kayaking", "software", "hiking", "reading", "music", "gardening"]],
  ["Tomas Berg",        "Europe",        "+46",  "Stockholm County",     "Stockholm",   "basic",       "en", ["sailing", "design", "saunas", "cross-country skiing", "technology", "photography", "fika"]],
];

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL_UNPOOLED (or DATABASE_URL).");
  process.exit(1);
}
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const passwordHash = await bcrypt.hash(QA_PASSWORD, 10);
let created = 0;
let skipped = 0;

for (let i = 0; i < CUSTOMERS.length; i++) {
  const [name, globalArea, dial, region, city, tier, locale, interests] = CUSTOMERS[i];
  const phone = `+1555124${String(i).padStart(4, "0")}`;
  const phoneHash = createHash("sha256").update(phone).digest("hex");

  const existing = await prisma.user.findUnique({ where: { phoneHash }, select: { id: true } });
  if (existing) {
    skipped++;
    continue;
  }

  // Staggered activity: 0-40 days ago so every "Active in" pill has members.
  const daysAgo = (i * 7) % 41;
  const lastActivityAt = new Date(Date.now() - daysAgo * 86_400_000);

  await prisma.user.create({
    data: {
      displayName: name,
      phoneHash,
      passwordHash,
      accountTier: tier,
      preferredLocale: locale,
      preferredCurrency: dial === "+1" ? "USD" : "EUR",
      lastActivityAt,
      location: {
        create: { globalArea, countryPhoneCode: dial, region, cityZip: city, locationVisible: true },
      },
      interests: {
        create: interests.map((text, slot) => ({ slotNumber: slot + 1, interestText: text })),
      },
    },
  });
  created++;
  console.log(`created  ${name.padEnd(20)} ${phone}  ${globalArea}/${region}/${city}  tier=${tier} locale=${locale}`);
}

console.log(`\nDone. created=${created} skipped(existing)=${skipped} total-cohort=${CUSTOMERS.length}`);
console.log(`QA password for every sample customer: ${QA_PASSWORD}`);
await prisma.$disconnect();
