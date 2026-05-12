// GET /api/avatars/[seed] — deterministic gradient avatar (A1).
//
// Returns an SVG seeded by the user's display name (or any short token).
// Used as the fallback when `User.avatarUrl` is null. Edge-cached for 1
// week so the same seed always produces the same payload.

import { NextResponse } from "next/server";

export const runtime = "edge";
export const revalidate = 604800; // 7 days

// Brand-coherent palette pairs (matching the gradient text + button colors
// used across the app). Picked deterministically from the seed.
const PAIRS: Array<[string, string]> = [
  ["#4F46E5", "#EC4899"], // indigo → pink (primary brand)
  ["#7C3AED", "#06B6D4"], // purple → cyan
  ["#EC4899", "#F59E0B"], // pink → amber
  ["#10B981", "#06B6D4"], // emerald → cyan
  ["#7C3AED", "#EC4899"], // purple → pink
  ["#4F46E5", "#06B6D4"], // indigo → cyan
  ["#F59E0B", "#EC4899"], // amber → pink
];

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function initialsFromSeed(seed: string): string {
  // If the seed looks like a hex token (default route shape), don't render
  // initials — the gradient alone is the avatar.
  if (/^[a-f0-9]+$/i.test(seed)) return "";
  const parts = seed.split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
}

export async function GET(_req: Request, ctx: { params: Promise<{ seed: string }> }) {
  const { seed } = await ctx.params;
  const cleanSeed = seed.replace(/\.svg$/i, "");
  const n = hashSeed(cleanSeed);
  const [a, b] = PAIRS[n % PAIRS.length];
  const initials = initialsFromSeed(cleanSeed);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${a}"/>
      <stop offset="100%" stop-color="${b}"/>
    </linearGradient>
  </defs>
  <rect width="160" height="160" rx="80" fill="url(#g)"/>
  ${
    initials
      ? `<text x="80" y="95" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" font-weight="700" font-size="64" fill="white">${escapeXml(initials)}</text>`
      : ""
  }
</svg>`;

  return new NextResponse(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=604800, immutable",
    },
  });
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "&": return "&amp;";
      case "'": return "&apos;";
      case '"': return "&quot;";
      default: return c;
    }
  });
}
