// scripts/stripe-setup.mjs — one-command Stripe product/price setup.
//
// Turns ~20 dashboard clicks into a single run. Creates the two products
// and four recurring prices the checkout route expects, then prints the
// exact env-var lines to paste into Vercel (Production).
//
// YOUR SECRET KEY STAYS ON YOUR MACHINE — it is read from the env and
// never written anywhere. Run:
//
//   STRIPE_SECRET_KEY=sk_live_xxx  node scripts/stripe-setup.mjs
//   # or sk_test_xxx to set up test mode first (recommended for the
//   # first end-to-end $1 dry run).
//
// Idempotency: re-running creates NEW prices (Stripe prices are
// immutable). Run once; if you need to change amounts, edit below and
// archive the old ones in the dashboard.

const KEY = process.env.STRIPE_SECRET_KEY;
if (!KEY || !/^sk_(test|live)_/.test(KEY)) {
  console.error("Set STRIPE_SECRET_KEY=sk_test_... (or sk_live_...) in the env and re-run.");
  process.exit(1);
}
const MODE = KEY.startsWith("sk_live_") ? "LIVE" : "TEST";

// ---- EDIT THESE AMOUNTS to your real pricing (in cents) --------------
const PLANS = {
  "pro:monthly":      { product: "CopyMe Pro",      nickname: "Pro Monthly",      amount: 999,   interval: "month" },
  "pro:annual":       { product: "CopyMe Pro",      nickname: "Pro Annual",       amount: 9900,  interval: "year"  },
  "business:monthly": { product: "CopyMe Business", nickname: "Business Monthly", amount: 4999,  interval: "month" },
  "business:annual":  { product: "CopyMe Business", nickname: "Business Annual",  amount: 49900, interval: "year"  },
};
const CURRENCY = "usd";
// ----------------------------------------------------------------------

const ENV_VAR = {
  "pro:monthly":      "STRIPE_PRICE_PRO_MONTHLY",
  "pro:annual":       "STRIPE_PRICE_PRO_ANNUAL",
  "business:monthly": "STRIPE_PRICE_BUSINESS_MONTHLY",
  "business:annual":  "STRIPE_PRICE_BUSINESS_ANNUAL",
};

async function stripe(path, form) {
  const body = new URLSearchParams(form).toString();
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${path}: ${json.error?.message ?? res.status}`);
  return json;
}

(async () => {
  console.log(`Stripe ${MODE} mode — creating products + prices...\n`);

  // Reuse one product per name.
  const productIds = {};
  for (const name of [...new Set(Object.values(PLANS).map((p) => p.product))]) {
    const p = await stripe("products", { name });
    productIds[name] = p.id;
    console.log(`  product  ${name.padEnd(16)} ${p.id}`);
  }

  const priceIds = {};
  for (const [plan, cfg] of Object.entries(PLANS)) {
    const price = await stripe("prices", {
      product: productIds[cfg.product],
      unit_amount: String(cfg.amount),
      currency: CURRENCY,
      "recurring[interval]": cfg.interval,
      nickname: cfg.nickname,
    });
    priceIds[plan] = price.id;
    console.log(`  price    ${plan.padEnd(16)} ${price.id}  ($${(cfg.amount / 100).toFixed(2)}/${cfg.interval})`);
  }

  console.log(`\n=== Paste these into Vercel → copyme-app → Settings → Environment Variables (Production) ===\n`);
  for (const [plan, envName] of Object.entries(ENV_VAR)) {
    console.log(`${envName}=${priceIds[plan]}`);
  }
  console.log(`STRIPE_SECRET_KEY=<the ${MODE.toLowerCase()} key you just used>`);
  console.log(`STRIPE_WEBHOOK_SECRET=<see note below>`);
  console.log(`
NOTE on STRIPE_WEBHOOK_SECRET:
  The app has no /api/billing/webhook route — account upgrades run via
  /api/billing/verify-session on the post-checkout redirect. If that's
  the confirmed design (the Stripe audit will say), you may still set a
  placeholder here, OR add a webhook for reliability. Either way the 4
  price vars + STRIPE_SECRET_KEY above are what make checkout WORK.

After pasting: redeploy, then do a $1 TEST-mode payment end-to-end and
confirm the account tier flips. Only switch to sk_live_ once that passes.`);
})().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
