// /.well-known/assetlinks.json — Android App Links (S-166)

import { NextResponse } from "next/server";

export const dynamic = "force-static";

export function GET() {
  const packageName = process.env.ANDROID_PACKAGE_NAME ?? "com.copyme.app";
  const sha256 = process.env.ANDROID_CERT_SHA256 ?? "";
  return NextResponse.json(
    [
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: packageName,
          sha256_cert_fingerprints: sha256 ? [sha256] : [],
        },
      },
    ],
    {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=86400",
      },
    },
  );
}
