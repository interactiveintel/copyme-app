// Public status page at /status.
//
// Server-rendered: ships zero client JS, uses a meta-refresh header for
// auto-refresh every 30s. The intent is "give the team a URL they can
// share when something feels off" — not a full incident-history product.
// For deeper analytics, the JSON twin at /api/status is the integration
// point for external monitors.
//
// Deliberately not gated by auth — visibility into platform health is
// the whole feature. We never include user-identifying info in the
// response (see snapshot() in lib/health.ts).

import type { Metadata } from "next";
import Link from "next/link";
import { snapshot, type HealthSnapshot, type ServiceCheck, type ServiceStatus } from "@/lib/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Status · CopyMe",
  description: "Live operational status for CopyMe.",
  robots: { index: false }, // No reason to surface this in search results.
};

function statusLabel(s: ServiceStatus): string {
  switch (s) {
    case "ok":
      return "Operational";
    case "degraded":
      return "Degraded";
    case "down":
      return "Down";
  }
}

function statusColor(s: ServiceStatus): { dot: string; chip: string; text: string } {
  switch (s) {
    case "ok":
      return { dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700 border-emerald-200", text: "text-emerald-700" };
    case "degraded":
      return { dot: "bg-amber-500", chip: "bg-amber-50 text-amber-700 border-amber-200", text: "text-amber-700" };
    case "down":
      return { dot: "bg-rose-500", chip: "bg-rose-50 text-rose-700 border-rose-200", text: "text-rose-700" };
  }
}

function ServiceRow({ name, check }: { name: string; check: ServiceCheck }) {
  const c = statusColor(check.status);
  return (
    <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 last:border-b-0">
      <div className="flex items-center gap-3">
        <span className={`inline-block w-2.5 h-2.5 rounded-full ${c.dot}`} aria-hidden="true" />
        <div>
          <div className="text-sm font-semibold text-slate-900">{name}</div>
          {check.error && (
            <div className="text-xs text-rose-500 mt-0.5">{check.error}</div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 text-right">
        <span className="text-xs text-slate-400 tabular-nums">{check.latencyMs} ms</span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${c.chip}`}>
          {statusLabel(check.status)}
        </span>
      </div>
    </div>
  );
}

export default async function StatusPage() {
  let snap: HealthSnapshot;
  try {
    snap = await snapshot();
  } catch {
    // If even gathering the snapshot threw (network gone), render a
    // hard-coded "everything down" state rather than 500.
    snap = {
      status: "down",
      timestamp: new Date().toISOString(),
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "dev",
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown",
      services: {
        database: { status: "down", latencyMs: 0, error: "snapshot failed" },
        redis: { status: "down", latencyMs: 0, error: "snapshot failed" },
        blob: { status: "down", latencyMs: 0, error: "snapshot failed" },
      },
    };
  }

  const overall = statusColor(snap.status);
  const headlineByStatus: Record<ServiceStatus, string> = {
    ok: "All systems operational",
    degraded: "Some services degraded",
    down: "We're experiencing problems",
  };

  return (
    <>
      {/* 30s meta-refresh so the page self-updates without JS. */}
      <meta httpEquiv="refresh" content="30" />
      <main className="min-h-screen bg-slate-50 px-4 py-16">
        <div className="mx-auto max-w-2xl">
          <header className="mb-8">
            <Link href="/" className="inline-flex items-center gap-0.5 mb-6 text-2xl font-bold">
              <span className="text-slate-900">Copy</span>
              <span className="bg-gradient-to-r from-[#7C3AED] to-[#EC4899] bg-clip-text text-transparent">
                Me
              </span>
            </Link>
            <div className="flex items-center gap-3">
              <span className={`inline-block w-3 h-3 rounded-full ${overall.dot}`} aria-hidden="true" />
              <h1 className={`text-2xl font-bold ${overall.text}`}>
                {headlineByStatus[snap.status]}
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Last checked {new Date(snap.timestamp).toUTCString()} · build {snap.version} · {snap.environment}
            </p>
          </header>

          <section className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
            <ServiceRow name="Database (Postgres)" check={snap.services.database} />
            <ServiceRow name="Cache + realtime (Redis)" check={snap.services.redis} />
            <ServiceRow name="Media storage (Blob)" check={snap.services.blob} />
          </section>

          <footer className="mt-8 text-center">
            <p className="text-xs text-slate-400">
              JSON twin at <Link href="/api/status" className="text-purple-600 hover:underline">/api/status</Link> ·
              {" "}auto-refreshes every 30 seconds
            </p>
          </footer>
        </div>
      </main>
    </>
  );
}
