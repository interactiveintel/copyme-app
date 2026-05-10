// E2E key management — browser-side stub (S-141 / S-142).
//
// We don't bundle libsignal-client yet (it's a wasm dep). This is the
// boundary: the server side never sees plaintext, and the client side
// goes through this module for every encrypt/decrypt call. A drop-in
// libsignal implementation will replace `_pretendCrypto` later without
// changing callers.

const DB_NAME = "copyme-e2e";
const STORE = "identity";

async function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function get(key: string): Promise<unknown> {
  if (typeof indexedDB === "undefined") return null;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const r = tx.objectStore(STORE).get(key);
    r.onsuccess = () => resolve(r.result ?? null);
    r.onerror = () => reject(r.error);
  });
}

async function put(key: string, value: unknown): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export interface IdentityKeyPair {
  publicKey: ArrayBuffer;
  privateKey: ArrayBuffer;
  algorithm: "ECDH-P256" | "Curve25519";
  createdAt: string;
}

/** Generate (or load) the user's E2E identity. ECDH P-256 via WebCrypto. */
export async function ensureIdentityKey(): Promise<IdentityKeyPair> {
  const existing = (await get("identity")) as IdentityKeyPair | null;
  if (existing) return existing;

  const kp = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"],
  );
  const pub = await crypto.subtle.exportKey("raw", kp.publicKey);
  const priv = await crypto.subtle.exportKey("pkcs8", kp.privateKey);
  const ident: IdentityKeyPair = {
    publicKey: pub,
    privateKey: priv,
    algorithm: "ECDH-P256",
    createdAt: new Date().toISOString(),
  };
  await put("identity", ident);
  return ident;
}

/** Derive the per-contact "safety number" displayed on the verify screen (S-144). */
export async function safetyNumber(myPub: ArrayBuffer, theirPub: ArrayBuffer): Promise<string> {
  const merged = new Uint8Array(myPub.byteLength + theirPub.byteLength);
  merged.set(new Uint8Array(myPub), 0);
  merged.set(new Uint8Array(theirPub), myPub.byteLength);
  const hash = await crypto.subtle.digest("SHA-256", merged);
  // 60-digit decimal grouped in 5×12: matches Signal's UX.
  const bytes = new Uint8Array(hash);
  let n = BigInt(0);
  const eight = BigInt(8);
  for (let i = 0; i < 30; i++) n = (n << eight) + BigInt(bytes[i]);
  const dec = n.toString().padStart(60, "0").slice(0, 60);
  return dec.match(/.{1,12}/g)!.join(" ");
}
