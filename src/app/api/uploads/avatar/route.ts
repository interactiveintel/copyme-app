// POST /api/uploads/avatar — upload a user avatar to Vercel Blob (A1).
//
// Body: multipart/form-data with field `file`
// Returns: { ok: true, url: string }
//
// The avatar bytes are sniffed (S-134) and EXIF-stripped (S-133) on the
// function before being written to Blob. We deliberately proxy the bytes
// through the server here (rather than client-direct) so the strip
// guarantee holds — the client never has the chance to upload raw EXIF.

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { uploadAvatar } from "@/lib/blob";
import { prisma } from "@/lib/db";
import { rateLimit, clientIpFromRequest } from "@/lib/rate-limit";
import { reportError } from "@/lib/observability";

export const runtime = "nodejs";
// 2 MB cap — avatars don't need to be big. Server falls back to a hard
// rejection if the multipart frame exceeds this.
export const maxDuration = 15;

export async function POST(req: NextRequest) {
  const auth = authenticateRequest(req.headers.get("authorization"));
  if (!auth) return NextResponse.json({ error: "UNAUTH" }, { status: 401 });

  // Per-user rate limit: 5 avatar uploads / hour. Avatars don't change often.
  const rl = await rateLimit(`avatar:user:${auth.userId}`, 5, 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED", retryAfterMs: rl.retryAfterMs },
      { status: 429 },
    );
  }

  // Per-IP soft cap so a compromised token doesn't burn the whole bucket.
  const ip = clientIpFromRequest(req);
  await rateLimit(`avatar:ip:${ip}`, 20, 60 * 60 * 1000);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "BAD_FORM" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "MISSING_FILE" }, { status: 400 });
  }
  if (file.size > 2 * 1024 * 1024) {
    return NextResponse.json({ error: "TOO_LARGE", maxBytes: 2 * 1024 * 1024 }, { status: 413 });
  }

  try {
    const buf = new Uint8Array(await file.arrayBuffer());
    const result = await uploadAvatar(auth.userId, buf, file.name || "avatar.jpg");
    if (!result.ok) {
      return NextResponse.json({ error: "REJECTED", reason: result.reason }, { status: 400 });
    }

    // Persist on the user row so subsequent /api/users/me responses include it.
    await prisma.user.update({
      where: { id: auth.userId },
      data: { avatarUrl: result.url },
    });

    return NextResponse.json({ ok: true, url: result.url });
  } catch (err) {
    reportError(err, { context: "avatar_upload", userId: auth.userId });
    return NextResponse.json({ error: "UPLOAD_FAILED" }, { status: 502 });
  }
}
