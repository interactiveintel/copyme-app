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
  // eslint-disable-next-line no-console
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
    // eslint-disable-next-line no-console
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
