// POST /api/uploads/message-media — upload up to 7 attachments for a draft message (A1).
//
// Body: multipart/form-data with fields `file_0`..`file_6` (Rule of 7) +
//       a `messageDraftId` opaque client token used as part of the path.
// Returns: { ok: true, urls: string[] }
//
// The client uploads here BEFORE calling /api/messages/send. The returned
// URLs are passed back as `mediaUrls`. This keeps the message-send route
// simple: it only sees URLs, never raw bytes.

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { writeMessageMedia } from "@/lib/blob";
import { rateLimit, clientIpFromRequest } from "@/lib/rate-limit";
import { LIMITS } from "@/lib/ruleOf7";
import { reportError } from "@/lib/observability";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_PER_FILE = 25 * 1024 * 1024; // 25 MB per file (S-134)
const MAX_TOTAL = 7 * MAX_PER_FILE;

export async function POST(req: NextRequest) {
  const auth = authenticateRequest(req.headers.get("authorization"));
  if (!auth) return NextResponse.json({ error: "UNAUTH" }, { status: 401 });

  // 120 media uploads per user per hour (above this is bulk-attachment abuse).
  const rl = await rateLimit(`media:user:${auth.userId}`, 120, 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED", retryAfterMs: rl.retryAfterMs },
      { status: 429 },
    );
  }
  await rateLimit(`media:ip:${clientIpFromRequest(req)}`, 400, 60 * 60 * 1000);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "BAD_FORM" }, { status: 400 });
  }

  const draftId = String(form.get("messageDraftId") ?? "");
  if (!/^[a-zA-Z0-9_-]{8,64}$/.test(draftId)) {
    return NextResponse.json({ error: "BAD_DRAFT_ID" }, { status: 400 });
  }

  // Collect files in declared order (Rule of 7 — max 7).
  const files: File[] = [];
  for (let i = 0; i < LIMITS.BASIC.maxImages; i++) {
    const f = form.get(`file_${i}`);
    if (f instanceof File) files.push(f);
  }
  if (files.length === 0) {
    return NextResponse.json({ error: "NO_FILES" }, { status: 400 });
  }

  const totalBytes = files.reduce((acc, f) => acc + f.size, 0);
  if (totalBytes > MAX_TOTAL) {
    return NextResponse.json({ error: "TOTAL_TOO_LARGE", maxBytes: MAX_TOTAL }, { status: 413 });
  }
  for (const f of files) {
    if (f.size > MAX_PER_FILE) {
      return NextResponse.json(
        { error: "FILE_TOO_LARGE", file: f.name, maxBytes: MAX_PER_FILE },
        { status: 413 },
      );
    }
  }

  try {
    const urls: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const buf = new Uint8Array(await f.arrayBuffer());
      const r = await writeMessageMedia(auth.userId, draftId, i, f.name || `att-${i}`, buf);
      if (!r.ok) {
        return NextResponse.json(
          { error: "REJECTED", index: i, name: f.name, reason: r.reason },
          { status: 400 },
        );
      }
      urls.push(r.url);
    }
    return NextResponse.json({ ok: true, urls });
  } catch (err) {
    reportError(err, { context: "message_media_upload", userId: auth.userId });
    return NextResponse.json({ error: "UPLOAD_FAILED" }, { status: 502 });
  }
}
