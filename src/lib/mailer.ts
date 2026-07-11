// ---------------------------------------------------------------------------
// Pluggable mail sender.
//
// Default dev behavior: log to console. In production, if RESEND_API_KEY is
// set, send via Resend (https://resend.com). No SDK is needed — we call the
// HTTP API directly so we don't take on another dependency just for an MVP.
//
// The "from" address comes from MAIL_FROM; the app name and base URL used in
// templates come from MAIL_APP_NAME and NEXT_PUBLIC_APP_URL respectively.
// ---------------------------------------------------------------------------

import { createHmac, timingSafeEqual } from "crypto";

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  /** Plain-text fallback. Recommended for deliverability. */
  text?: string;
}

export interface MailerResult {
  ok: boolean;
  /** Provider message id, if available. */
  id?: string;
  /** Present only when ok === false. */
  error?: string;
}

function appName(): string {
  return process.env.MAIL_APP_NAME || "CopyMe";
}

function appUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

function fromAddress(): string {
  // v4.16.34: default to the verified product domain (copyme1.com), not
  // the stale copyme.app. Resend would 403 a send from an unverified
  // domain — MAIL_FROM is set in prod, but the fallback must be a real
  // verified sender too.
  return process.env.MAIL_FROM || `${appName()} <noreply@copyme1.com>`;
}

// ---------------------------------------------------------------------------
// Transport implementations
// ---------------------------------------------------------------------------

async function sendViaResend(msg: MailMessage): Promise<MailerResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY not set" };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress(),
        to: [msg.to],
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
      }),
    });

    const data = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;

    if (!res.ok) {
      return { ok: false, error: data?.message || `Resend returned ${res.status}` };
    }
    return { ok: true, id: data?.id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown Resend error",
    };
  }
}

function logToConsole(msg: MailMessage): MailerResult {
   
  console.log(
    `\n[mailer:dev] ─────────────────────────────────────────\n` +
    `  to:      ${msg.to}\n` +
    `  from:    ${fromAddress()}\n` +
    `  subject: ${msg.subject}\n\n` +
    `${msg.text ?? msg.html}\n` +
    `─────────────────────────────────────────────────────\n`,
  );
  return { ok: true, id: "dev-console" };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function sendMail(msg: MailMessage): Promise<MailerResult> {
  // In production we require a real transport. In dev, use the console.
  if (process.env.NODE_ENV === "production") {
    if (process.env.RESEND_API_KEY) {
      return sendViaResend(msg);
    }
    // No provider configured in prod — log + signal failure so the caller
    // can decide (e.g. still return 200 to avoid user enumeration).
     
    console.error("[mailer] production RESEND_API_KEY missing; email NOT sent:", msg.subject);
    return { ok: false, error: "Mail transport not configured" };
  }

  // Dev / preview: log + return ok so flows are testable.
  if (process.env.RESEND_API_KEY) {
    // Allow real Resend in dev too if explicitly opted in.
    return sendViaResend(msg);
  }
  return logToConsole(msg);
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

function wrap(title: string, bodyHtml: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                max-width: 560px; margin: 0 auto; padding: 32px 16px; color: #1a1a2e;">
      <h1 style="font-size: 20px; font-weight: 700; margin-bottom: 16px;">${title}</h1>
      ${bodyHtml}
      <p style="color:#999; font-size:12px; margin-top:32px;">
        You received this email because someone used this address on ${appName()}.
        If that was not you, you can ignore this message.
      </p>
    </div>
  `.trim();
}

export function passwordResetTemplate(resetUrl: string) {
  const subject = `Reset your ${appName()} password`;
  const text =
    `Someone asked to reset your ${appName()} password.\n\n` +
    `Open this link within 60 minutes to choose a new one:\n${resetUrl}\n\n` +
    `If you didn't request this, ignore this email.`;
  const html = wrap(
    `Reset your ${appName()} password`,
    `<p>Someone asked to reset your password.</p>
     <p style="margin:24px 0;">
       <a href="${resetUrl}"
          style="display:inline-block; padding:12px 24px; border-radius:999px;
                 background:#7C3AED; color:white; text-decoration:none;
                 font-weight:600;">Reset password</a>
     </p>
     <p style="font-size:12px; color:#666;">
       Or copy this link: <br/><a href="${resetUrl}">${resetUrl}</a>
     </p>
     <p style="font-size:12px; color:#666;">Expires in 60 minutes.</p>`,
  );
  return { subject, text, html };
}

export interface DigestPeer {
  peerName: string;
  unreadCount: number;
  lastPreview: string | null;
  /** Time of the most recent unread message from this peer. */
  lastMessageAt?: Date;
}

export interface DigestSummary {
  displayName: string;
  unreadFromPeers: DigestPeer[];
  totalUnread: number;
  streakDays: number;
  /** Base /app URL — UTM tags are added by the template. */
  appHref: string;
  /**
   * One-time unsubscribe link for this user. Generate with
   * `buildDigestUnsubscribeUrl(token)`. Optional so existing callers that
   * predate unsubscribe links still compile (they get a generic profile link).
   */
  unsubscribeUrl?: string;
}

/**
 * Format a Date as a short relative time string (e.g. "2h ago", "Just now").
 * Cap at "7d ago" — anything older just shows "1w+".
 */
function relativeTime(d: Date | undefined, now: Date = new Date()): string {
  if (!d) return "";
  const ms = now.getTime() - d.getTime();
  if (ms < 0) return "Just now";
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return "Just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return `1w+ ago`;
}

/** Trim a preview to ≤80 chars with an ellipsis if truncated. */
function trimPreview(s: string | null | undefined, max = 80): string {
  if (!s) return "";
  const trimmed = s.trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max - 1).trimEnd() + "…";
}

/** Append UTM tags to a URL without disturbing existing query params. */
function withUtm(href: string, campaign: string): string {
  try {
    const u = new URL(href);
    u.searchParams.set("utm_source", "email");
    u.searchParams.set("utm_medium", "digest");
    u.searchParams.set("utm_campaign", campaign);
    return u.toString();
  } catch {
    // href wasn't absolute — fall back to naive append.
    const sep = href.includes("?") ? "&" : "?";
    return `${href}${sep}utm_source=email&utm_medium=digest&utm_campaign=${encodeURIComponent(campaign)}`;
  }
}

// Brand color palette — kept as constants so the template stays consistent.
const BRAND_INDIGO = "#4F46E5";
const BRAND_PURPLE = "#7C3AED";
const BRAND_PINK = "#EC4899";
const SLATE_900 = "#0F172A";
const SLATE_500 = "#64748B";
const SLATE_200 = "#E2E8F0";
const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

/**
 * Render the brand wordmark as inline SVG. Embedding inline avoids the
 * "load remote images?" prompt some clients show, and degrades to alt text
 * in clients that strip SVG (Gmail). We pair it with a hosted PNG fallback.
 */
function brandWordmarkSvg(): string {
  // Single-letter "C" in a rounded square, then the wordmark next to it.
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="32" viewBox="0 0 160 32" role="img" aria-label="CopyMe">` +
    `<rect width="32" height="32" rx="8" fill="#FFFFFF" fill-opacity="0.18"/>` +
    `<text x="16" y="22" font-family="${FONT_STACK}" font-size="18" font-weight="800" fill="#FFFFFF" text-anchor="middle">C</text>` +
    `<text x="42" y="22" font-family="${FONT_STACK}" font-size="18" font-weight="700" fill="#FFFFFF">CopyMe</text>` +
    `</svg>`
  );
}

export function digestTemplate(s: DigestSummary) {
  const firstName = s.displayName.trim().split(/\s+/)[0];
  const greeting = firstName ? `Hey ${firstName},` : `Hey,`;
  const unreadLine =
    s.totalUnread === 0
      ? `No unread messages.`
      : `You have ${s.totalUnread} unread message${s.totalUnread === 1 ? "" : "s"}.`;

  const subject = s.totalUnread
    ? `${s.totalUnread} unread on CopyMe`
    : `Your CopyMe daily digest`;

  // Cap peers at 7 (Rule of 7) and pre-compute display fields.
  const peers = s.unreadFromPeers.slice(0, 7).map((p) => ({
    name: p.peerName || "Someone",
    count: p.unreadCount,
    preview: trimPreview(p.lastPreview, 80),
    when: relativeTime(p.lastMessageAt),
  }));

  const streakLine =
    s.streakDays > 0
      ? `${s.streakDays}-day streak — keep it going.`
      : `Start a streak today — one message is all it takes.`;
  const streakBadge =
    s.streakDays > 0 ? `🔥 ${s.streakDays}-day streak` : "";

  // CTA URL with UTM tags.
  const ctaHref = withUtm(s.appHref, "daily");

  // Unsubscribe URL: fall back to the in-app settings page if a token wasn't
  // supplied (older callers). The footer still mentions Profile → Privacy.
  const unsubHref =
    s.unsubscribeUrl ??
    `${appUrl().replace(/\/$/, "")}/profile?section=privacy`;

  // ---------- Plain-text fallback ----------
  const peerListText = peers
    .map((p) => {
      const whenSuffix = p.when ? ` (${p.when})` : "";
      const previewSuffix = p.preview ? `: ${p.preview}` : "";
      return `  • ${p.name} — ${p.count} unread${whenSuffix}${previewSuffix}`;
    })
    .join("\n");

  const text =
    `${greeting}\n\n` +
    `${unreadLine}\n` +
    (peerListText ? `${peerListText}\n` : "") +
    (streakBadge ? `\n${streakBadge}\n` : "") +
    `\n${streakLine}\n\n` +
    `Open CopyMe: ${ctaHref}\n\n` +
    `Don't want these? Unsubscribe: ${unsubHref}\n` +
    `You can also adjust frequency in Profile → Privacy.`;

  // ---------- HTML ----------
  // Tables-for-layout. Inline CSS only. No web fonts. Single-column,
  // max-width 480px, generous padding for thumb-tap CTAs.
  const peerRowsHtml = peers
    .map((p) => {
      const initials = (p.name || "?")
        .split(/\s+/)
        .map((part) => part[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase();
      const whenCell = p.when
        ? `<td align="right" valign="top" style="padding:14px 16px 14px 0;font-family:${FONT_STACK};font-size:12px;color:${SLATE_500};white-space:nowrap;">${escapeHtml(p.when)}</td>`
        : `<td style="padding:0;"></td>`;
      const previewLine = p.preview
        ? `<div style="margin-top:4px;font-family:${FONT_STACK};font-size:13px;line-height:18px;color:${SLATE_500};">${escapeHtml(p.preview)}</div>`
        : "";
      const countLabel =
        p.count > 1
          ? `<span style="display:inline-block;margin-left:6px;padding:1px 6px;border-radius:999px;background:${BRAND_PINK};color:#fff;font-size:11px;font-weight:600;line-height:16px;">${p.count}</span>`
          : "";
      return (
        `<tr>` +
        `<td valign="top" style="padding:14px 12px 14px 16px;width:44px;">` +
        `<div style="width:36px;height:36px;border-radius:50%;background:${BRAND_INDIGO};color:#fff;font-family:${FONT_STACK};font-size:14px;font-weight:700;line-height:36px;text-align:center;">${escapeHtml(initials)}</div>` +
        `</td>` +
        `<td valign="top" style="padding:14px 8px 14px 0;font-family:${FONT_STACK};">` +
        `<div style="font-size:15px;font-weight:600;color:${SLATE_900};line-height:20px;">${escapeHtml(p.name)}${countLabel}</div>` +
        previewLine +
        `</td>` +
        whenCell +
        `</tr>` +
        // Divider row — using a 1px-tall td keeps it consistent across clients.
        `<tr><td colspan="3" style="padding:0;border-bottom:1px solid ${SLATE_200};line-height:0;font-size:0;">&nbsp;</td></tr>`
      );
    })
    .join("");

  const previewText = s.totalUnread
    ? `${s.totalUnread} unread on CopyMe — open to catch up.`
    : `Your CopyMe digest is here.`;

  const html =
    `<!doctype html><html><head><meta charset="utf-8"/>` +
    `<meta name="viewport" content="width=device-width,initial-scale=1"/>` +
    `<title>${escapeHtml(subject)}</title></head>` +
    // Preheader: hidden snippet that previews in the inbox list.
    `<body style="margin:0;padding:0;background:#F8FAFC;">` +
    `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(previewText)}</div>` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F8FAFC;">` +
    `<tr><td align="center" style="padding:24px 12px;">` +
    `<table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:480px;background:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid ${SLATE_200};">` +
    // Gradient header with wordmark.
    `<tr><td style="background:linear-gradient(135deg,${BRAND_INDIGO} 0%,${BRAND_PURPLE} 50%,${BRAND_PINK} 100%);background-color:${BRAND_PURPLE};padding:24px 24px 28px 24px;" align="left">` +
    brandWordmarkSvg() +
    `<div style="margin-top:14px;font-family:${FONT_STACK};font-size:22px;font-weight:700;color:#FFFFFF;line-height:28px;">${escapeHtml(greeting)}</div>` +
    `<div style="margin-top:4px;font-family:${FONT_STACK};font-size:14px;color:rgba(255,255,255,0.86);line-height:20px;">${escapeHtml(unreadLine)}</div>` +
    `</td></tr>` +
    // Streak chip (optional).
    (streakBadge
      ? `<tr><td style="padding:16px 16px 0 16px;">` +
        `<span style="display:inline-block;padding:6px 12px;border-radius:999px;background:#FEF3C7;color:#92400E;font-family:${FONT_STACK};font-size:13px;font-weight:600;">${escapeHtml(streakBadge)}</span>` +
        `</td></tr>`
      : "") +
    // Peer rows table.
    (peerRowsHtml
      ? `<tr><td style="padding:8px 0 0 0;">` +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">` +
        peerRowsHtml +
        `</table></td></tr>`
      : `<tr><td style="padding:24px 24px 8px 24px;font-family:${FONT_STACK};font-size:14px;color:${SLATE_500};">Nothing new in the last 24 hours. Send a message to keep the conversation alive.</td></tr>`) +
    // CTA button.
    `<tr><td align="center" style="padding:24px 24px 8px 24px;">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="${BRAND_PURPLE}" style="border-radius:999px;background:${BRAND_PURPLE};">` +
    `<a href="${ctaHref}" style="display:inline-block;padding:14px 32px;font-family:${FONT_STACK};font-size:16px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:999px;min-width:160px;text-align:center;">Open CopyMe</a>` +
    `</td></tr></table>` +
    `</td></tr>` +
    // Streak / nudge line.
    `<tr><td align="center" style="padding:8px 24px 24px 24px;font-family:${FONT_STACK};font-size:13px;color:${SLATE_500};line-height:18px;">${escapeHtml(streakLine)}</td></tr>` +
    // Divider.
    `<tr><td style="padding:0 24px;"><div style="border-top:1px solid ${SLATE_200};height:1px;line-height:1px;font-size:1px;">&nbsp;</div></td></tr>` +
    // Footer / unsubscribe.
    `<tr><td style="padding:16px 24px 24px 24px;font-family:${FONT_STACK};font-size:12px;color:${SLATE_500};line-height:18px;">` +
    `You're receiving this daily digest because you have unread messages on CopyMe. ` +
    `<a href="${unsubHref}" style="color:${BRAND_INDIGO};text-decoration:underline;">Unsubscribe</a> ` +
    `from daily digests, or adjust frequency anytime in <strong style="color:${SLATE_900};font-weight:600;">Profile &rarr; Privacy</strong>.` +
    `</td></tr>` +
    `</table>` +
    `<div style="margin-top:12px;font-family:${FONT_STACK};font-size:11px;color:${SLATE_500};">CopyMe &middot; phone-first messaging with end-to-end encryption</div>` +
    `</td></tr></table></body></html>`;

  return { subject, text, html };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function welcomeTemplate(displayName: string, appHref: string) {
  const greeting = displayName.trim() ? `Welcome, ${displayName.split(/\s+/)[0]}!` : `Welcome!`;
  const subject = `${greeting} Let's start communicating with meaning.`;
  const text =
    `${greeting}\n\n` +
    `CopyMe is built on the Rule of 7 — a constraint system that replaces noise with meaning.\n\n` +
    `A quick tour:\n` +
    `  • Every message is capped at 70 words — choose your words carefully.\n` +
    `  • You can hold up to 7 active contacts on the free tier.\n` +
    `  • Your last 7 messages per contact are retained — older ones cycle out.\n` +
    `  • Yogi, your personal AI companion, learns from how you communicate.\n\n` +
    `Ready when you are: ${appHref}\n\n` +
    `— The CopyMe team`;

  const html = wrap(
    `${greeting}`,
    `<p>CopyMe is built on the <strong>Rule of 7</strong> — a constraint system that
      replaces noise with meaning. A quick tour:</p>
     <ul style="padding-left:20px; margin:16px 0;">
       <li>Every message is capped at <strong>70 words</strong> — choose carefully.</li>
       <li>You can hold up to <strong>7 active contacts</strong> on the free tier.</li>
       <li>Your last 7 messages per contact are retained — older ones cycle out.</li>
       <li><strong>Yogi</strong>, your personal AI companion, learns from how you communicate.</li>
     </ul>
     <p style="margin:24px 0;">
       <a href="${appHref}"
          style="display:inline-block; padding:12px 24px; border-radius:999px;
                 background:#7C3AED; color:white; text-decoration:none;
                 font-weight:600;">Open CopyMe</a>
     </p>
     <p style="font-size:12px; color:#666;">
       Not you? Ignore this message — no account was created without the phone + password you chose.
     </p>`,
  );

  return { subject, text, html };
}

export function emailVerificationTemplate(verifyUrl: string) {
  const subject = `Verify your ${appName()} email`;
  const text =
    `Welcome to ${appName()}!\n\n` +
    `Please verify your email by opening this link:\n${verifyUrl}\n\n` +
    `This link expires in 24 hours.`;
  const html = wrap(
    `Welcome to ${appName()}`,
    `<p>Thanks for signing up! Please verify your email to finish setup.</p>
     <p style="margin:24px 0;">
       <a href="${verifyUrl}"
          style="display:inline-block; padding:12px 24px; border-radius:999px;
                 background:#7C3AED; color:white; text-decoration:none;
                 font-weight:600;">Verify email</a>
     </p>
     <p style="font-size:12px; color:#666;">
       Or copy this link: <br/><a href="${verifyUrl}">${verifyUrl}</a>
     </p>
     <p style="font-size:12px; color:#666;">Expires in 24 hours.</p>`,
  );
  return { subject, text, html };
}

// ---------------------------------------------------------------------------
// URL builders — ensures we never hardcode a host
// ---------------------------------------------------------------------------

export function buildPasswordResetUrl(token: string): string {
  const base = appUrl().replace(/\/$/, "");
  return `${base}/reset?token=${encodeURIComponent(token)}`;
}

export function buildEmailVerificationUrl(token: string): string {
  const base = appUrl().replace(/\/$/, "");
  return `${base}/verify?token=${encodeURIComponent(token)}`;
}

// ---------------------------------------------------------------------------
// Daily-digest unsubscribe tokens
//
// Format: base64url(`${userId}.${expiresAtMs}.${hmac}`)
//   - userId, expiresAtMs are encoded into the body
//   - hmac = HMAC-SHA256(`${userId}|${expiresAtMs}`, JWT_SECRET)
// We deliberately don't pull in the auth.ts JWT helpers — those are tied to
// jsonwebtoken — to keep this self-contained and edge-friendly.
// ---------------------------------------------------------------------------

const DIGEST_UNSUB_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function digestSecret(): string {
  const env = process.env.JWT_SECRET;
  if (env && env.length >= 16) return env;
  // Mirror the auth.ts dev fallback so dev/test runs without a .env still work.
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be set in production for digest unsubscribe tokens.");
  }
  return "copyme-dev-secret-not-for-production-use-32ch";
}

function b64urlEncode(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export function signDigestUnsubscribeToken(
  userId: string,
  expiresAtMs: number = Date.now() + DIGEST_UNSUB_TTL_MS,
): string {
  const payload = `${userId}|${expiresAtMs}`;
  const mac = createHmac("sha256", digestSecret()).update(payload).digest();
  return b64urlEncode(Buffer.from(`${payload}|${b64urlEncode(mac)}`, "utf8"));
}

export interface VerifiedUnsubscribeToken {
  userId: string;
  expiresAt: Date;
}

export function verifyDigestUnsubscribeToken(
  token: string,
): VerifiedUnsubscribeToken | null {
  if (!token || typeof token !== "string") return null;
  let decoded: string;
  try {
    decoded = b64urlDecode(token).toString("utf8");
  } catch {
    return null;
  }
  const parts = decoded.split("|");
  if (parts.length !== 3) return null;
  const [userId, expiresAtStr, providedMacB64] = parts;
  const expiresAtMs = Number(expiresAtStr);
  if (!userId || !Number.isFinite(expiresAtMs)) return null;
  if (Date.now() > expiresAtMs) return null;

  const expectedMac = createHmac("sha256", digestSecret())
    .update(`${userId}|${expiresAtMs}`)
    .digest();
  let providedMac: Buffer;
  try {
    providedMac = b64urlDecode(providedMacB64);
  } catch {
    return null;
  }
  if (providedMac.length !== expectedMac.length) return null;
  if (!timingSafeEqual(providedMac, expectedMac)) return null;
  return { userId, expiresAt: new Date(expiresAtMs) };
}

export function buildDigestUnsubscribeUrl(token: string): string {
  const base = appUrl().replace(/\/$/, "");
  return `${base}/api/notifications/unsubscribe?t=${encodeURIComponent(token)}`;
}

export function buildDigestAppUrl(): string {
  const base = appUrl().replace(/\/$/, "");
  return `${base}/app`;
}

// ---------------------------------------------------------------------------
// Optional preview: COPYME_PREVIEW_DIGEST=1 logs a sample digest to stdout
// once at module load. Useful for "tell me what the email looks like" without
// hitting Resend or the cron path.
// ---------------------------------------------------------------------------
if (process.env.COPYME_PREVIEW_DIGEST === "1") {
  const sample = digestTemplate({
    displayName: "Alex Rivera",
    streakDays: 7,
    totalUnread: 12,
    appHref: buildDigestAppUrl(),
    unsubscribeUrl: buildDigestUnsubscribeUrl(
      signDigestUnsubscribeToken("preview-user-id"),
    ),
    unreadFromPeers: [
      { peerName: "Sam Chen", unreadCount: 4, lastPreview: "are we still on for tomorrow at 3?", lastMessageAt: new Date(Date.now() - 12 * 60 * 1000) },
      { peerName: "Jordan Lee", unreadCount: 2, lastPreview: "sent you the doc — let me know what you think", lastMessageAt: new Date(Date.now() - 90 * 60 * 1000) },
      { peerName: "Mom", unreadCount: 3, lastPreview: "call me when you get a chance", lastMessageAt: new Date(Date.now() - 4 * 60 * 60 * 1000) },
      { peerName: "Riya", unreadCount: 1, lastPreview: "Sent a voice message", lastMessageAt: new Date(Date.now() - 8 * 60 * 60 * 1000) },
      { peerName: "Devon", unreadCount: 1, lastPreview: "🎉🎉🎉", lastMessageAt: new Date(Date.now() - 23 * 60 * 60 * 1000) },
      { peerName: "Casey", unreadCount: 1, lastPreview: "Sent an image", lastMessageAt: new Date(Date.now() - 26 * 60 * 60 * 1000) },
      { peerName: "Pat", unreadCount: 0, lastPreview: null, lastMessageAt: new Date(Date.now() - 50 * 60 * 60 * 1000) },
    ],
  });

  console.log("\n[mailer:preview] subject:", sample.subject);

  console.log("[mailer:preview] text:\n" + sample.text);

  console.log("[mailer:preview] html:\n" + sample.html);
}
