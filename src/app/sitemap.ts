import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://copyme-app.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${BASE}/`,         lastModified: now, changeFrequency: "weekly",  priority: 1.0 },
    { url: `${BASE}/pricing`,  lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE}/business`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/press`,    lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/privacy`,  lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
    { url: `${BASE}/terms`,    lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
  ];
}
