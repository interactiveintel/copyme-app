import type { MetadataRoute } from "next";

// Trim before stripping slashes — see sitemap.ts: a trailing newline in
// NEXT_PUBLIC_APP_URL corrupted the emitted sitemap/host URLs.
const BASE = (process.env.NEXT_PUBLIC_APP_URL || "https://copyme1.com").trim().replace(/\/+$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/pricing", "/business", "/press", "/privacy", "/terms"],
        // Don't index private surfaces — investor data room, admin tools,
        // password-reset / verify landings (link-token-bearing).
        disallow: ["/app", "/admin", "/pitch", "/business/ads", "/reset", "/verify", "/api"],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
