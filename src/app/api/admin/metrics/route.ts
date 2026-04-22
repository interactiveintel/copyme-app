import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";

// ---------------------------------------------------------------------------
// GET /api/admin/metrics
//
// Investor-grade top-level dashboard. Numbers are computed directly from
// Postgres so we're not dependent on PostHog uptime to read our own state.
//
// Auth: Bearer token + user UUID in ADMIN_USER_IDS env var.
// ---------------------------------------------------------------------------

function minusMs(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export async function GET(request: NextRequest) {
  const auth = authenticateRequest(request.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Valid access token required" } },
      { status: 401 },
    );
  }
  if (!isAdmin(auth.userId)) {
    return NextResponse.json(
      { success: false, error: { code: "FORBIDDEN", message: "Admin access required" } },
      { status: 403 },
    );
  }

  try {
    const now = new Date();
    const c24h = minusMs(1);
    const c7d = minusMs(7);
    const c30d = minusMs(30);

    // --- Users -------------------------------------------------------------
    const [totalUsers, signups24h, signups7d, signups30d] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: c24h } } }),
      prisma.user.count({ where: { createdAt: { gte: c7d } } }),
      prisma.user.count({ where: { createdAt: { gte: c30d } } }),
    ]);

    // --- Activity (DAU/WAU/MAU) --------------------------------------------
    // Active = "sent at least one message in the window". Cheap enough at
    // small scale; switch to a materialized view once we grow.
    const [activeUsers24h, activeUsers7d, activeUsers30d] = await Promise.all([
      prisma.message.findMany({
        where: { createdAt: { gte: c24h } },
        select: { senderId: true },
        distinct: ["senderId"],
      }),
      prisma.message.findMany({
        where: { createdAt: { gte: c7d } },
        select: { senderId: true },
        distinct: ["senderId"],
      }),
      prisma.message.findMany({
        where: { createdAt: { gte: c30d } },
        select: { senderId: true },
        distinct: ["senderId"],
      }),
    ]);

    // --- Message volume ----------------------------------------------------
    const [messages24h, messages7d, totalMessages] = await Promise.all([
      prisma.message.count({ where: { createdAt: { gte: c24h } } }),
      prisma.message.count({ where: { createdAt: { gte: c7d } } }),
      prisma.message.count(),
    ]);

    // --- Contacts ----------------------------------------------------------
    const [totalContacts, contacts7d] = await Promise.all([
      prisma.contact.count(),
      prisma.contact.count({ where: { createdAt: { gte: c7d } } }),
    ]);

    // --- Funnel: signup → first message -----------------------------------
    // Users who have sent at least one message (distinct senderId count).
    const sendersEver = await prisma.message.findMany({
      select: { senderId: true },
      distinct: ["senderId"],
    });
    const sentFirstMessage = sendersEver.length;
    const conversionPct = totalUsers > 0
      ? Math.round((sentFirstMessage / totalUsers) * 1000) / 10
      : 0;

    // --- Emails verified (quality-of-signup metric) ------------------------
    const emailVerified = await prisma.user.count({
      where: { emailVerifiedAt: { not: null } },
    });

    return NextResponse.json({
      success: true,
      data: {
        asOf: now.toISOString(),
        users: {
          total: totalUsers,
          signupsLast24h: signups24h,
          signupsLast7d: signups7d,
          signupsLast30d: signups30d,
          emailVerified,
        },
        activity: {
          dau: activeUsers24h.length,
          wau: activeUsers7d.length,
          mau: activeUsers30d.length,
        },
        messages: {
          totalLast24h: messages24h,
          totalLast7d: messages7d,
          totalEver: totalMessages,
        },
        contacts: {
          total: totalContacts,
          addedLast7d: contacts7d,
        },
        funnel: {
          signups: totalUsers,
          sentFirstMessage,
          conversionPct,
        },
      },
    });
  } catch (error) {
    console.error("[admin/metrics] error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to compute metrics" } },
      { status: 500 },
    );
  }
}
