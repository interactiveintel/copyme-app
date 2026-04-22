// ---------------------------------------------------------------------------
// Web Push sender (VAPID, no SDK dependency).
//
// We sign a VAPID JWT and encrypt the payload with RFC 8291 aes128gcm, then
// POST to the browser's push endpoint. Works on Vercel serverless because
// each send is a single fetch (no persistent connection).
//
// Env vars (set in Vercel → Environment Variables → Production):
//   VAPID_PUBLIC_KEY        base64url-encoded P-256 public key (also
//                           exposed to the browser as
//                           NEXT_PUBLIC_VAPID_PUBLIC_KEY for subscription)
//   VAPID_PRIVATE_KEY       base64url-encoded P-256 private key
//   VAPID_SUBJECT           mailto:... contact for the push services
//                           (required by the VAPID spec)
//
// Generate a keypair once with:
//   npx web-push generate-vapid-keys
// ...and put the outputs in .env.local + Vercel env vars.
// ---------------------------------------------------------------------------

import {
  createPrivateKey,
  createSign,
  createECDH,
  randomBytes,
  createHmac,
  createHash,
  createCipheriv,
} from "crypto";

export interface PushSubscriptionLike {
  endpoint: string;
  p256dh: string; // base64url
  auth: string;   // base64url
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;            // open this when the user clicks the notification
  icon?: string;           // icon URL
  badge?: string;          // Android-style status bar badge
  tag?: string;            // dedupes repeated notifications
  data?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------

function vapidConfigured(): boolean {
  return !!(
    process.env.VAPID_PUBLIC_KEY &&
    process.env.VAPID_PRIVATE_KEY &&
    process.env.VAPID_SUBJECT
  );
}

// ---------------------------------------------------------------------------
// base64url helpers
// ---------------------------------------------------------------------------

function b64urlToBuffer(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}
function bufferToB64url(b: Buffer): string {
  return b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// ---------------------------------------------------------------------------
// VAPID JWT signing (ES256)
// ---------------------------------------------------------------------------

function vapidJwt(audience: string): string {
  const privateKeyB64 = process.env.VAPID_PRIVATE_KEY!;
  const publicKeyB64 = process.env.VAPID_PUBLIC_KEY!;
  const subject = process.env.VAPID_SUBJECT!;

  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { aud: audience, exp: now + 12 * 60 * 60, sub: subject };
  const segments = [header, payload].map((p) =>
    bufferToB64url(Buffer.from(JSON.stringify(p), "utf8")),
  );
  const signingInput = segments.join(".");

  // Load the P-256 private key from a JWK. Node supports this natively —
  // much more reliable than hand-rolling PKCS#8 DER.
  const pubBytes = b64urlToBuffer(publicKeyB64);
  if (pubBytes.length !== 65 || pubBytes[0] !== 0x04) {
    throw new Error("VAPID_PUBLIC_KEY must be a 65-byte uncompressed P-256 point (base64url)");
  }
  const xB64 = bufferToB64url(pubBytes.subarray(1, 33));
  const yB64 = bufferToB64url(pubBytes.subarray(33, 65));

  const keyObject = createPrivateKey({
    key: { kty: "EC", crv: "P-256", d: privateKeyB64, x: xB64, y: yB64 },
    format: "jwk",
  });

  // Sign with ES256 (P-256 + SHA-256). Node produces DER-encoded ECDSA;
  // JWS needs the raw r||s concatenation.
  const sign = createSign("SHA256");
  sign.update(signingInput);
  sign.end();
  const derSig = sign.sign(keyObject);
  const rawSig = derSigToJoseRS(derSig);

  return `${signingInput}.${bufferToB64url(rawSig)}`;
}

/** Convert a Node ECDSA DER signature (SEQUENCE{INTEGER r, INTEGER s}) to
 *  the 64-byte raw r||s format required by JWS ES256. */
function derSigToJoseRS(der: Buffer): Buffer {
  // der = 30 LL 02 Lr R... 02 Ls S...
  let offset = 2;
  if (der[offset] !== 0x02) throw new Error("bad ECDSA DER signature");
  const rLen = der[offset + 1]!;
  const rStart = offset + 2;
  const r = der.subarray(rStart, rStart + rLen);
  offset = rStart + rLen;
  if (der[offset] !== 0x02) throw new Error("bad ECDSA DER signature");
  const sLen = der[offset + 1]!;
  const sStart = offset + 2;
  const s = der.subarray(sStart, sStart + sLen);

  const pad = (n: Buffer): Buffer => {
    if (n.length === 32) return n;
    if (n.length > 32) return n.subarray(n.length - 32);
    return Buffer.concat([Buffer.alloc(32 - n.length, 0), n]);
  };
  return Buffer.concat([pad(r), pad(s)]);
}

// ---------------------------------------------------------------------------
// RFC 8291 aes128gcm payload encryption
// ---------------------------------------------------------------------------

function hkdf(salt: Buffer, ikm: Buffer, info: Buffer, length: number): Buffer {
  const prk = createHmac("sha256", salt).update(ikm).digest();
  const out: Buffer[] = [];
  let t = Buffer.alloc(0);
  for (let i = 1; out.reduce((a, b) => a + b.length, 0) < length; i++) {
    t = createHmac("sha256", prk)
      .update(Buffer.concat([t, info, Buffer.from([i])]))
      .digest();
    out.push(t);
  }
  return Buffer.concat(out).subarray(0, length);
}

function encryptAes128Gcm(
  plaintext: Buffer,
  uaPublicKey: Buffer, // 65-byte uncompressed P-256 public key from browser
  authSecret: Buffer,  // 16-byte random from browser
): Buffer {
  // Generate an ephemeral ECDH keypair on P-256 for this send.
  const ecdh = createECDH("prime256v1");
  const asPublicKey = ecdh.generateKeys(null as unknown as undefined, "uncompressed");
  const sharedSecret = ecdh.computeSecret(uaPublicKey);

  const salt = randomBytes(16);

  // See RFC 8291 §3.3. Derive the IKM, then the content encryption key + nonce.
  const keyInfo = Buffer.concat([
    Buffer.from("WebPush: info\0", "utf8"),
    uaPublicKey,
    asPublicKey,
  ]);
  const ikm = hkdf(authSecret, sharedSecret, keyInfo, 32);

  const cekInfo = Buffer.from("Content-Encoding: aes128gcm\0", "utf8");
  const cek = hkdf(salt, ikm, cekInfo, 16);

  const nonceInfo = Buffer.from("Content-Encoding: nonce\0", "utf8");
  const nonce = hkdf(salt, ikm, nonceInfo, 12);

  // Pad with 0x02 delimiter then zeros; we use minimum padding.
  const padded = Buffer.concat([plaintext, Buffer.from([0x02])]);

  const cipher = createCipheriv("aes-128-gcm", cek, nonce);
  const ct = Buffer.concat([cipher.update(padded), cipher.final()]);
  const tag = cipher.getAuthTag();

  // aes128gcm content-coding header: salt(16) || rs(4) || idlen(1) || keyid
  const rs = Buffer.alloc(4);
  rs.writeUInt32BE(4096, 0);
  const idlen = Buffer.from([asPublicKey.length]);
  const header = Buffer.concat([salt, rs, idlen, asPublicKey]);

  return Buffer.concat([header, ct, tag]);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface SendPushResult {
  ok: boolean;
  status: number;
  expired: boolean; // 404 or 410 — caller should remove the subscription
  error?: string;
}

/**
 * Send one web push to one subscription. Never throws; returns a result
 * object. In production, callers should delete the subscription row when
 * `expired` is true.
 */
export async function sendPush(
  sub: PushSubscriptionLike,
  payload: PushPayload,
): Promise<SendPushResult> {
  if (!vapidConfigured()) {
    return { ok: false, status: 0, expired: false, error: "VAPID not configured" };
  }

  try {
    const body = JSON.stringify(payload);
    const encrypted = encryptAes128Gcm(
      Buffer.from(body, "utf8"),
      b64urlToBuffer(sub.p256dh),
      b64urlToBuffer(sub.auth),
    );

    const aud = new URL(sub.endpoint).origin;
    const jwt = vapidJwt(aud);

    const res = await fetch(sub.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        TTL: "2419200", // 4 weeks
        Authorization: `vapid t=${jwt}, k=${process.env.VAPID_PUBLIC_KEY}`,
      },
      body: encrypted,
    });

    const expired = res.status === 404 || res.status === 410;
    return {
      ok: res.ok,
      status: res.status,
      expired,
      error: res.ok ? undefined : await res.text().catch(() => undefined),
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      expired: false,
      error: err instanceof Error ? err.message : "send failed",
    };
  }
}

// Re-export a tiny hash so callers can verify payload integrity in logs
// without exposing the crypto internals.
export function payloadDigest(payload: PushPayload): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 12);
}
