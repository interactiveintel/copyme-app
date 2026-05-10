// /.well-known/apple-app-site-association — iOS Universal Links (S-166)
// Served as application/json with no extension.

import { NextResponse } from "next/server";

export const dynamic = "force-static";

export function GET() {
  const teamId = process.env.APPLE_TEAM_ID ?? "TEAMID";
  const bundleId = process.env.APPLE_BUNDLE_ID ?? "com.copyme.app";
  return NextResponse.json(
    {
      applinks: {
        apps: [],
        details: [
          {
            appIDs: [`${teamId}.${bundleId}`],
            paths: ["/app/*", "/thread/*", "/signup", "/recovery/*"],
          },
        ],
      },
    },
    {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=86400",
      },
    },
  );
}
