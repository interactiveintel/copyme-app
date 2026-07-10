// k6 capacity test — the REAL binding constraint, distributed.
//
// Simulates N concurrent "active users" each running the production poll
// mix (calls/incoming every 3s + inbox every 10s) against auth'd
// endpoints. Read-only: no writes, no Twilio, no AI cost. This is the
// dominant steady-state load for the app.
//
// WHY THIS EXISTS: a single-machine probe (scratchpad) measured a FLOOR
// of ~1,200 req/s at flat p95 — but it was bounded by one client + one
// IP (Vercel edge protection blocks single-IP floods). To find the true
// ceiling AND exercise held-SSE-connection concurrency you need many
// IPs → run this on k6 Cloud from multiple regions:
//
//   k6 cloud scripts/load/k6-capacity.js
//
// or locally at modest scale:
//
//   BASE=https://copyme1.com QA_PASSWORD=... k6 run scripts/load/k6-capacity.js
//
// NOTE: the sibling k6-signup.js hammers the WRITE/OTP path — it burns
// real Twilio Verify SMS and pollutes the DB. Do NOT run it against
// prod. This capacity test is the safe one.

import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate } from "k6/metrics";

const BASE = __ENV.BASE || "https://copyme1.com";
const QA_PASSWORD = __ENV.QA_PASSWORD || "CopyMeQA-2026!";

const pollLatency = new Trend("poll_latency_ms", true);
const pollErrors = new Rate("poll_errors");

// Ramp toward the true ceiling. Each VU ≈ one concurrent active user.
export const options = {
  scenarios: {
    active_users: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1m", target: 500 },
        { duration: "2m", target: 2000 },
        { duration: "2m", target: 5000 },
        { duration: "3m", target: 10000 },
        { duration: "1m", target: 0 },
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    // The app is "safe" at a load level if p95 stays under 800ms and
    // fewer than 1% of polls error. k6 flags the first breaching stage.
    poll_latency_ms: ["p(95)<800"],
    poll_errors: ["rate<0.01"],
    http_req_failed: ["rate<0.02"],
  },
};

// QA cohort phones — Emma + 23 seeded. Spread auth across them so a
// single account's activity counters aren't the thing under test.
const PHONES = ["+15551230001"];
for (let i = 0; i < 23; i++) PHONES.push("+1555124" + String(i).padStart(4, "0"));

// Each VU logs in once at init, then loops the poll mix.
export function setup() {
  // Warm one token to fail fast if creds/base are wrong.
  const r = http.post(
    `${BASE}/api/auth/login`,
    JSON.stringify({ phone: PHONES[0], password: QA_PASSWORD }),
    { headers: { "Content-Type": "application/json" } },
  );
  check(r, { "setup login ok": (res) => res.status === 200 });
  return {};
}

export default function () {
  // Per-VU login, cached across iterations via a module-scope map keyed
  // by VU id would be ideal, but k6 VUs are isolated; log in on first
  // iteration using __ITER.
  const phone = PHONES[(__VU - 1) % PHONES.length];
  const login = http.post(
    `${BASE}/api/auth/login`,
    JSON.stringify({ phone, password: QA_PASSWORD }),
    { headers: { "Content-Type": "application/json" }, tags: { name: "login" } },
  );
  const token = login.json("data.accessToken");
  if (!token) {
    pollErrors.add(1);
    sleep(3);
    return;
  }
  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  // Steady-state poll cadence for ~30s, mirroring an open app:
  //   calls/incoming every 3s, inbox every ~9s.
  for (let tick = 0; tick < 10; tick++) {
    const incoming = http.get(`${BASE}/api/calls/incoming`, {
      ...authHeaders,
      tags: { name: "calls_incoming" },
    });
    pollLatency.add(incoming.timings.duration);
    pollErrors.add(incoming.status >= 400);
    check(incoming, { "incoming 2xx": (r) => r.status < 400 });

    if (tick % 3 === 0) {
      const inbox = http.get(`${BASE}/api/messages/inbox`, {
        ...authHeaders,
        tags: { name: "inbox" },
      });
      pollLatency.add(inbox.timings.duration);
      pollErrors.add(inbox.status >= 400);
    }
    sleep(3);
  }
}
