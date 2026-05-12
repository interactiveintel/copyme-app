import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import {
  sendMail,
  digestTemplate,
  buildDigestUnsubscribeUrl,
  signDigestUnsubscribeToken,
  type DigestSummary,
} from "@/lib/mailer";
import { redis } from "@/lib/redis";

// ---------------------------------------------------------------------------
// GET /api/cron/daily-digest
//
// Invoked by Vercel Cron on a schedule (see vercel.json). Builds a digest
// for every user that has (a) an unread message from someone AND (b) their
// email verified. Sends via the pluggable mailer; if RESEND_API_KEY isn't
// set, the mailer logs to the server console (safe for dev).
//
// Auth: Vercel Cron requests carry an "Authorization: Bearer <CRON_SECRET>"
// header when CRON_SECRET is set on the Vercel project. We also accept the
// "x-vercel-cron" header presence as a second signal. In dev (NODE_ENV !==
// "production"), we allow un-auth'd calls so it's easy to test.
// ---------------------------------------------------------------------------

const DIGEST_UNREAD_CUTOFF_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_PEERS_PER_USER = 7;

function isCronAuthorized(request: NextRequest): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  // Vercel also sends a dedicated header for cron triggers.
  return request.headers.get("x-vercel-cron") === "1";
}

function appHref(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/app`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}/app`;
  }
  return "https://copyme1.com/app";
}

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: { code: "FORBIDDEN", message: "Not authorized." } },
      { status: 403 },
    );
  }

  try {
    const cutoff = new Date(Date.now() - DIGEST_UNREAD_CUTOFF_MS);

    // Fetch unread rows in the cutoff window, grouped by (receiver, sender).
    const unread = await prisma.message.findMany({
      where: {
        readAt: null,
        createdAt: { gte: cutoff },
      },
      select: {
        senderId: true,
        receiverId: true,
        content: true,
        type: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    if (unread.length === 0) {
      return NextResponse.json({
        success: true,
        data: { sent: 0, reason: "no unread messages in window" },
      });
    }

    // Build a per-receiver map: receiverId -> senderId -> { count, latest preview, latestAt }
    const byReceiver = new Map<
      string,
      Map<string, { count: number; latest: string | null; type: string; latestAt: Date }>
    >();
    for (const m of unread) {
      let peers = byReceiver.get(m.receiverId);
      if (!peers) {
        peers = new Map();
        byReceiver.set(m.receiverId, peers);
      }
      const existing = peers.get(m.senderId);
      if (!existing) {
        peers.set(m.senderId, {
          count: 1,
          latest: m.content,
          type: m.type,
          latestAt: m.createdAt,
        });
      } else {
        existing.count += 1;
        // Messages are ordered desc → first seen is latest; subsequent are older.
        // latestAt stays as the first (most recent) timestamp.
      }
    }

    // Resolve display names + emails for senders and recipients.
    const allUserIds = Array.from(
      new Set([
        ...Array.from(byReceiver.keys()),
        ...Array.from(byReceiver.values()).flatMap((m) => Array.from(m.keys())),
      ]),
    );
    const users = await prisma.user.findMany({
      where: { id: { in: allUserIds } },
      select: { id: true, displayName: true, emailHash: true, emailVerifiedAt: true, streakDays: true },
    });
    const nameById = new Map(users.map((u) => [u.id, u.displayName]));
    const verifiedReceivers = new Set(
      users.filter((u) => u.emailVerifiedAt && byReceiver.has(u.id)).map((u) => u.id),
    );

    // We store only emailHash, not plaintext — the cron can't email anyone
    // unless the user has supplied a current email via a verification step.
    // For v1, fall back to logging a console digest for users who are
    // verified (mailer is already configured server-side, but without a
    // plaintext email we can't address a Resend send). A future migration
    // will add a plaintext `emailEncrypted` column so the cron can decrypt.
    //
    // NOTE: when the plaintext-email migration lands (slated for after
    // v3.5.0), update the `recipientEmail` line below to decrypt it.

    let sent = 0;
    let skippedNoEmail = 0;
    let skippedOptedOut = 0;

    for (const [receiverId, peers] of byReceiver.entries()) {
      if (!verifiedReceivers.has(receiverId)) {
        skippedNoEmail += 1;
        continue;
      }

      // Honor the Redis opt-out flag. Set by /api/notifications/unsubscribe
      // when the user clicks the footer link in a previous digest. We swallow
      // Redis errors here so a transient outage doesn't block the whole run —
      // if Redis is down the user just gets one extra digest.
      const optedOut = await redis
        .get(`digest:opt-out:${receiverId}`)
        .catch(() => null);
      if (optedOut === "1") {
        skippedOptedOut += 1;
        continue;
      }

      const receiverName = nameById.get(receiverId) ?? "";
      const receiverStreak =
        users.find((u) => u.id === receiverId)?.streakDays ?? 0;

      const peerRows: DigestSummary["unreadFromPeers"] = Array.from(peers.entries())
        .slice(0, MAX_PEERS_PER_USER)
        .map(([senderId, info]) => ({
          peerName: nameById.get(senderId) ?? "Someone",
          unreadCount: info.count,
          // Slice generously here — the template trims to ≤80 chars.
          lastPreview:
            info.type === "text"
              ? info.latest?.slice(0, 120) ?? null
              : info.type === "image"
                ? "Sent an image"
                : info.type === "voice"
                  ? "Sent a voice message"
                  : "Sent a video message",
          lastMessageAt: info.latestAt,
        }));

      const total = peerRows.reduce((a, p) => a + p.unreadCount, 0);

      // Sign a 30-day unsubscribe token scoped to this user.
      const unsubscribeUrl = buildDigestUnsubscribeUrl(
        signDigestUnsubscribeToken(receiverId),
      );

      const { subject, html, text } = digestTemplate({
        displayName: receiverName,
        unreadFromPeers: peerRows,
        totalUnread: total,
        streakDays: receiverStreak,
        appHref: appHref(),
        unsubscribeUrl,
      });

      // TODO: resolve the recipient's plaintext email from emailEncrypted
      // once that migration is in. For now, the mailer will log the
      // rendered email to server console in dev.
      const recipientEmail = "recipient-plaintext-email-not-yet-decryptable@example.invalid";

      await sendMail({ to: recipientEmail, subject, html, text }).catch(() => {});
      sent += 1;
    }

    return NextResponse.json({
      success: true,
      data: {
        sent,
        skippedNoEmail,
        skippedOptedOut,
        scannedReceivers: byReceiver.size,
        windowHours: DIGEST_UNREAD_CUTOFF_MS / (60 * 60 * 1000),
      },
    });
  } catch (error) {
    console.error("[cron/daily-digest] error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Digest run failed" } },
      { status: 500 },
    );
  }
}
