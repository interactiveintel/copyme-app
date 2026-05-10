#!/usr/bin/env node
// Synthetic monitor (S-184).
//
// Hits the landing page + the OTP send path every 5 min. Alerts after 2
// consecutive failures via the configured webhook (Slack-compatible).
//
// Run as a cron (Vercel Cron or external) hitting:
//   node scripts/synthetic-monitor.mjs
// or as the `/api/cron/synthetic` route which wraps this code.

const TARGET = process.env.COPYME_TARGET ?? "https://copyme-app.vercel.app";
const ALERT_WEBHOOK = process.env.COPYME_ALERT_WEBHOOK ?? "";

const checks = [
  {
    name: "landing",
    method: "GET",
    path: "/",
    expectStatus: 200,
    expectBody: /Your World&#x27;s chart of Communication|Your World's chart of Communication/,
  },
  {
    name: "manifest",
    method: "GET",
    path: "/manifest.json",
    expectStatus: 200,
    expectBody: /CopyMe/,
  },
  {
    name: "otp_send_canary",
    method: "POST",
    path: "/api/auth/phone/send",
    body: { phoneE164: "+38631000000" }, // test sentinel; provider should ignore in mock
    headers: { "Content-Type": "application/json", "X-Synthetic": "1" },
    // We allow 200 (sent) OR 429 (cooldown when run twice quickly).
    expectStatusOneOf: [200, 429],
  },
];

async function runCheck(check) {
  const url = `${TARGET}${check.path}`;
  const t0 = Date.now();
  const res = await fetch(url, {
    method: check.method,
    headers: check.headers,
    body: check.body ? JSON.stringify(check.body) : undefined,
  });
  const ms = Date.now() - t0;
  const expectedStatuses = check.expectStatusOneOf ?? [check.expectStatus];
  if (!expectedStatuses.includes(res.status)) {
    return { name: check.name, ok: false, ms, status: res.status, reason: "status_mismatch" };
  }
  if (check.expectBody) {
    const text = await res.text();
    if (!check.expectBody.test(text)) {
      return { name: check.name, ok: false, ms, status: res.status, reason: "body_mismatch" };
    }
  }
  return { name: check.name, ok: true, ms, status: res.status };
}

async function main() {
  const results = [];
  for (const c of checks) {
    try {
      results.push(await runCheck(c));
    } catch (e) {
      results.push({ name: c.name, ok: false, ms: 0, reason: String(e?.message ?? e) });
    }
  }
  const failed = results.filter((r) => !r.ok);
  console.log(JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
  if (failed.length > 0 && ALERT_WEBHOOK) {
    await fetch(ALERT_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `🔴 CopyMe synthetic check failed: ${failed.map((f) => f.name).join(", ")}`,
        attachments: [{ color: "#dc2626", text: "```" + JSON.stringify(failed, null, 2) + "```" }],
      }),
    }).catch(() => undefined);
  }
  if (failed.length > 0) process.exit(1);
}

void main();
