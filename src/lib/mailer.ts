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
  return process.env.MAIL_FROM || `${appName()} <noreply@copyme.app>`;
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

export interface DigestSummary {
  displayName: string;
  unreadFromPeers: Array<{ peerName: string; unreadCount: number; lastPreview: string | null }>;
  totalUnread: number;
  streakDays: number;
  appHref: string;
}

export function digestTemplate(s: DigestSummary) {
  const greeting = s.displayName.trim()
    ? `Hey ${s.displayName.split(/\s+/)[0]},`
    : `Hey,`;
  const unreadLine =
    s.totalUnread === 0
      ? `No unread messages.`
      : `You have ${s.totalUnread} unread message${s.totalUnread === 1 ? "" : "s"}.`;

  const subject = s.totalUnread
    ? `${s.totalUnread} unread on CopyMe`
    : `Your CopyMe daily digest`;

  const peerList = s.unreadFromPeers
    .slice(0, 7) // Rule of 7 everywhere
    .map((p) => `  • ${p.peerName} — ${p.unreadCount} unread${p.lastPreview ? `: ${p.lastPreview}` : ""}`)
    .join("\n");

  const streakLine =
    s.streakDays > 0
      ? `You're on a ${s.streakDays}-day streak. Don't break it.`
      : `Ready to start a streak? Send one message today.`;

  const text = `${greeting}

${unreadLine}
${peerList ? peerList + "\n" : ""}
${streakLine}

Open CopyMe: ${s.appHref}

You're getting this because you have an unread message or a streak to keep
going. You can turn these off in Profile → Settings.`;

  const peerHtml = s.unreadFromPeers
    .slice(0, 7)
    .map(
      (p) =>
        `<tr>
           <td style="padding:8px 0; border-bottom:1px solid #f1f5f9;">
             <strong style="color:#1a1a2e;">${p.peerName}</strong>
             <span style="color:#999; font-size:12px;">— ${p.unreadCount} unread</span>
             ${p.lastPreview ? `<br/><span style="color:#666; font-size:13px;">${escapeHtml(p.lastPreview)}</span>` : ""}
           </td>
         </tr>`,
    )
    .join("");

  const html = wrap(
    greeting.replace(",", ""),
    `<p>${unreadLine}</p>
     ${peerHtml ? `<table style="width:100%; border-collapse: collapse; margin: 16px 0;">${peerHtml}</table>` : ""}
     <p style="margin:24px 0;">
       <a href="${s.appHref}"
          style="display:inline-block; padding:12px 24px; border-radius:999px;
                 background:#7C3AED; color:white; text-decoration:none;
                 font-weight:600;">Open CopyMe</a>
     </p>
     <p style="color:#555; font-size:13px;">${streakLine}</p>
     <p style="font-size:11px; color:#999;">
       You can turn off these digests in Profile → Settings.
     </p>`,
  );

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
