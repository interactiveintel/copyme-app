import { NextRequest, NextResponse } from "next/server";
import { verifyDigestUnsubscribeToken } from "@/lib/mailer";
import { redis } from "@/lib/redis";

// ---------------------------------------------------------------------------
// GET /api/notifications/unsubscribe?t=<token>
//
// One-click opt-out from daily-digest emails. The token is a base64url-encoded
// HMAC payload signed by the mailer (see signDigestUnsubscribeToken). On a
// valid token we set `digest:opt-out:<userId>` in Redis with no TTL so the
// daily-digest cron skips this user from now on. The user can resubscribe in
// Profile → Privacy.
//
// Always returns HTML (200 on success or graceful failure) so a user clicking
// the link from their inbox never sees a JSON blob.
// ---------------------------------------------------------------------------

export const dynamic = "force-dynamic";

const HTML_HEAD =
  `<!doctype html><html><head><meta charset="utf-8"/>` +
  `<meta name="viewport" content="width=device-width,initial-scale=1"/>` +
  `<title>CopyMe digest preferences</title>` +
  `</head>`;

function htmlPage(title: string, body: string, status: number = 200): NextResponse {
  const html =
    HTML_HEAD +
    `<body style="margin:0;padding:0;background:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0F172A;">` +
    `<div style="max-width:480px;margin:48px auto;padding:32px 24px;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:16px;">` +
    `<div style="font-size:14px;font-weight:600;color:#7C3AED;letter-spacing:0.04em;text-transform:uppercase;margin-bottom:8px;">CopyMe</div>` +
    `<h1 style="font-size:22px;font-weight:700;margin:0 0 12px 0;line-height:28px;">${title}</h1>` +
    body +
    `</div>` +
    `</body></html>`;
  return new NextResponse(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("t");
  if (!token) {
    return htmlPage(
      "Missing unsubscribe token",
      `<p style="color:#64748B;font-size:14px;line-height:20px;">` +
        `This link is missing its <code>t</code> parameter. Open the link directly from your latest digest email, ` +
        `or adjust your preferences in <strong>Profile &rarr; Privacy</strong>.` +
        `</p>`,
      400,
    );
  }

  const verified = verifyDigestUnsubscribeToken(token);
  if (!verified) {
    return htmlPage(
      "Link expired or invalid",
      `<p style="color:#64748B;font-size:14px;line-height:20px;">` +
        `This unsubscribe link is no longer valid. You can adjust digest frequency at any time in ` +
        `<strong>Profile &rarr; Privacy</strong> inside the CopyMe app.` +
        `</p>`,
      400,
    );
  }

  try {
    // No TTL — opt-outs persist until the user resubscribes from in-app
    // settings (which deletes this key).
    await redis.set(`digest:opt-out:${verified.userId}`, "1");
  } catch (error) {
    console.error("[notifications/unsubscribe] redis set failed:", error);
    return htmlPage(
      "We couldn't save that just now",
      `<p style="color:#64748B;font-size:14px;line-height:20px;">` +
        `Something went wrong on our end. Please try the link again in a minute, or unsubscribe from inside the app at ` +
        `<strong>Profile &rarr; Privacy</strong>.` +
        `</p>`,
      500,
    );
  }

  return htmlPage(
    "You're unsubscribed",
    `<p style="color:#64748B;font-size:15px;line-height:22px;">` +
      `You won't receive any more daily-digest emails from CopyMe.` +
      `</p>` +
      `<p style="color:#64748B;font-size:14px;line-height:20px;margin-top:16px;">` +
      `Changed your mind? Resubscribe — or pick a different frequency — in ` +
      `<strong>Profile &rarr; Privacy</strong> inside the CopyMe app.` +
      `</p>`,
  );
}
