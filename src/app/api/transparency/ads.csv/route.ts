// GET /api/transparency/ads.csv — downloadable archive (S-238).

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const revalidate = 600;

export async function GET() {
  const ads = await prisma.businessAd.findMany({
    where: { status: { in: ["approved", "expired", "paused"] } },
    orderBy: { createdAt: "desc" },
    take: 5000,
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
      priceMicroUsd: true,
    },
  });

  const headers = [
    "id", "brand", "title", "tagline", "body", "cta_url", "category",
    "target_global_area", "target_region",
    "activated_at", "expires_at", "status",
    "impressions", "clicks", "price_usd",
  ];
  const lines = [headers.join(",")];
  for (const a of ads) {
    const row = [
      a.id,
      esc(a.brand),
      esc(a.title),
      esc(a.tagline ?? ""),
      esc(a.body),
      esc(a.ctaUrl),
      esc(a.category),
      esc(a.targetGlobalArea ?? ""),
      esc(a.targetRegion ?? ""),
      a.activatedAt?.toISOString() ?? "",
      a.expiresAt?.toISOString() ?? "",
      a.status,
      String(a.impressions),
      String(a.clicks),
      (a.priceMicroUsd / 1_000_000).toFixed(2),
    ];
    lines.push(row.join(","));
  }
  const csv = lines.join("\n");
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="copyme-ads-archive.csv"`,
      "Cache-Control": "public, max-age=600",
    },
  });
}

function esc(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
