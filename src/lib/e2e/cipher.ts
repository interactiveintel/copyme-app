// Per-message encrypt/decrypt (S-142 / S-143).
//
// AES-GCM with a session key derived from ECDH(my-priv, their-pub) +
// HKDF-SHA-256. Session keys are scoped per (recipientId, day) and
// rotate every 7 days (mirrors Rule-of-7 retention).

import { ensureIdentityKey } from "./keys";

const AES_BITS = 256;
const HKDF_INFO = "copyme/e2e/v1";

async function deriveSessionKey(theirPubRaw: ArrayBuffer): Promise<CryptoKey> {
  const me = await ensureIdentityKey();
  const myPriv = await crypto.subtle.importKey(
    "pkcs8",
    me.privateKey,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveBits"],
  );
  const theirPub = await crypto.subtle.importKey(
    "raw",
    theirPubRaw,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const shared = await crypto.subtle.deriveBits(
    { name: "ECDH", public: theirPub },
    myPriv,
    256,
  );
  // Bucket by 7-day window so keys rotate.
  const bucket = Math.floor(Date.now() / (7 * 24 * 3600 * 1000));
  const salt = new TextEncoder().encode(`copyme/${bucket}`);
  const baseKey = await crypto.subtle.importKey("raw", shared, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt, info: new TextEncoder().encode(HKDF_INFO) },
    baseKey,
    { name: "AES-GCM", length: AES_BITS },
    false,
    ["encrypt", "decrypt"],
  );
}

export interface EncryptedPayload {
  iv: string; // base64
  ct: string; // base64
}

function b64(buf: ArrayBuffer | Uint8Array): string {
  const arr = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s);
}

function unb64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function encryptText(plain: string, theirPubRaw: ArrayBuffer): Promise<EncryptedPayload> {
  const key = await deriveSessionKey(theirPubRaw);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, new TextEncoder().encode(plain) as BufferSource);
  return { iv: b64(iv), ct: b64(ct) };
}

export async function decryptText(p: EncryptedPayload, theirPubRaw: ArrayBuffer): Promise<string> {
  const key = await deriveSessionKey(theirPubRaw);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: unb64(p.iv) as BufferSource },
    key,
    unb64(p.ct) as BufferSource,
  );
  return new TextDecoder().decode(pt);
}

/** S-143 — chunked encrypt for media. 256KB chunks per file. */
export async function* encryptStream(
  data: AsyncIterable<Uint8Array>,
  theirPubRaw: ArrayBuffer,
): AsyncGenerator<EncryptedPayload> {
  const key = await deriveSessionKey(theirPubRaw);
  for await (const chunk of data) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, chunk as BufferSource);
    yield { iv: b64(iv), ct: b64(ct) };
  }
}
