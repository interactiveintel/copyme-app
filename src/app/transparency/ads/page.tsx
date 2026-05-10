// Public ad-transparency archive (S-238) — required by EU DSA.
// Lists all running and historical ads with their advertiser, body, run window.

import { prisma } from "@/lib/db";

export const revalidate = 600; // 10min cache

export const metadata = {
  title: "Ad transparency · CopyMe",
  description: "Every ad ever served on CopyMe — searchable archive per EU DSA.",
};

export default async function AdTransparencyPage() {
  const ads = await prisma.businessAd.findMany({
    where: { status: { in: ["approved", "expired", "paused"] } },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      brand: true,
      title: true,
      tagline: true,
      body: true,
      ctaUrl: true,
      category: true,
      targetGlobalArea: true,
      targetRegion: true,
      activatedAt: true,
      expiresAt: true,
      status: true,
      impressions: true,
      clicks: true,
    },
  });

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-16">
        <h1 className="text-2xl font-bold text-slate-900">Ad transparency archive</h1>
        <p className="mt-2 text-sm text-slate-500">
          Every ad ever served on CopyMe, in compliance with the EU Digital
          Services Act. Includes who paid, where it ran, and how often it was
          shown.{" "}
          <a href="/api/transparency/ads.csv" className="text-purple-600 hover:underline">
            Download CSV
          </a>
        </p>

        <div className="mt-8 space-y-4">
          {ads.map((ad) => (
            <div key={ad.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-900">{ad.brand}</div>
                <span className="text-[11px] uppercase font-semibold tracking-wide text-slate-400">
                  {ad.status}
                </span>
              </div>
              <div className="mt-1 text-sm font-medium text-slate-700">{ad.title}</div>
              {ad.tagline && (
                <div className="text-xs text-slate-500">{ad.tagline}</div>
              )}
              <p className="mt-2 text-sm text-slate-600">{ad.body}</p>
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-500">
                <Cell label="Region" value={ad.targetRegion ?? ad.targetGlobalArea ?? "any"} />
                <Cell label="Category" value={ad.category} />
                <Cell label="Impressions" value={String(ad.impressions)} />
                <Cell label="Clicks" value={String(ad.clicks)} />
              </div>
              {ad.activatedAt && (
                <div className="mt-2 text-[11px] text-slate-400">
                  Active {new Date(ad.activatedAt).toLocaleDateString()} →{" "}
                  {ad.expiresAt ? new Date(ad.expiresAt).toLocaleDateString() : "ongoing"}
                </div>
              )}
            </div>
          ))}
          {ads.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-12">No ads in the archive yet.</p>
          )}
        </div>
      </div>
    </main>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-semibold text-slate-400 uppercase tracking-wide">{label}</div>
      <div className="text-slate-700">{value}</div>
    </div>
  );
}
