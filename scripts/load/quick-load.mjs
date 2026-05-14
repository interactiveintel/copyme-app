// Tiny load tester — no k6 / autocannon / external deps. Uses native
// fetch + a fixed-concurrency worker pool. Reports p50 / p95 / p99 / max
// latency, RPS, status-code histogram, and any errors that surface.
//
// Usage:
//   node scripts/load/quick-load.mjs \
//     --url=https://copyme1.com/api/status \
//     --vus=50 --duration=30 --method=GET
//
// VU = a concurrent worker that loops sending requests for the duration.
// So actual req count ≈ vus * (duration / mean_latency_seconds).

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter((a) => a.startsWith("--"))
    .map((a) => {
      const [k, ...rest] = a.replace(/^--/, "").split("=");
      return [k, rest.join("=") || "true"];
    }),
);

const URL_TARGET = args.url || "https://copyme1.com/api/status";
const VUS = parseInt(args.vus || "10", 10);
const DURATION_S = parseInt(args.duration || "10", 10);
const METHOD = (args.method || "GET").toUpperCase();
const BODY = args.body || null;

const deadline = Date.now() + DURATION_S * 1000;
const latencies = [];
const statuses = new Map();
const errors = [];
const nonOkSamples = [];
let totalReqs = 0;

// Optionally bust upstream caches so every request actually hits the
// function + backend services (rather than getting served from Vercel's
// edge cache). Pass --bust=1 to enable.
const BUST_CACHE = args.bust === "1" || args.bust === "true";

async function worker(id) {
  let i = 0;
  while (Date.now() < deadline) {
    const t0 = Date.now();
    try {
      const init = { method: METHOD };
      if (BODY) {
        init.body = BODY;
        init.headers = { "Content-Type": "application/json" };
      }
      const url = BUST_CACHE
        ? `${URL_TARGET}${URL_TARGET.includes("?") ? "&" : "?"}_=${Date.now()}-${id}-${i++}`
        : URL_TARGET;
      const r = await fetch(url, init);
      const ms = Date.now() - t0;
      latencies.push(ms);
      statuses.set(r.status, (statuses.get(r.status) || 0) + 1);
      // Drain body so the connection can be reused. Capture a sample of
      // non-2xx bodies for diagnosis.
      const body = await r.text();
      if (r.status >= 400 && nonOkSamples.length < 5) {
        nonOkSamples.push({ status: r.status, body: body.slice(0, 500) });
      }
    } catch (err) {
      const ms = Date.now() - t0;
      latencies.push(ms);
      errors.push(err.message ?? String(err));
    }
    totalReqs += 1;
  }
}

function pct(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

console.log(`# Target  : ${METHOD} ${URL_TARGET}`);
console.log(`# VUs     : ${VUS}`);
console.log(`# Duration: ${DURATION_S}s`);
console.log(`# Starting...\n`);

const t0 = Date.now();
await Promise.all(Array.from({ length: VUS }, (_, i) => worker(i)));
const elapsedSec = (Date.now() - t0) / 1000;

console.log(`# Done — ${totalReqs} requests in ${elapsedSec.toFixed(1)}s`);
console.log(`# RPS    : ${(totalReqs / elapsedSec).toFixed(1)}`);
console.log(`# Latency: p50=${pct(latencies, 50)}ms · p95=${pct(latencies, 95)}ms · p99=${pct(latencies, 99)}ms · max=${Math.max(...latencies)}ms`);
console.log(`# Status :`);
for (const [code, n] of [...statuses.entries()].sort((a, b) => a[0] - b[0])) {
  const pctOfTotal = ((n / totalReqs) * 100).toFixed(1);
  console.log(`#   ${code}: ${n}  (${pctOfTotal}%)`);
}
if (errors.length > 0) {
  console.log(`# Errors : ${errors.length} (showing first 5)`);
  errors.slice(0, 5).forEach((e) => console.log(`#   - ${e}`));
}
if (nonOkSamples.length > 0) {
  console.log(`# Non-2xx samples (first ${nonOkSamples.length}):`);
  nonOkSamples.forEach((s) => console.log(`#   [${s.status}] ${s.body}`));
}
