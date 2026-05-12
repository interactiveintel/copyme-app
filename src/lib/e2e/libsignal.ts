// Signal Protocol integration via @signalapp/libsignal-client (B1).
//
// This is the real Signal stack — X3DH initial agreement + Double Ratchet
// (with PQXDH/Kyber augmentation, since libsignal 0.94 always wraps the
// initial bundle with a Kyber pre-key). It replaces the stand-in HKDF +
// AES-GCM from `cipher.ts` for the production code path.
//
// CRITICAL RUNTIME CONSTRAINTS
// ----------------------------
// `@signalapp/libsignal-client` ships as a native Node addon — there is
// no wasm build at this lib version (0.94.0). That means:
//
//   1. This module ONLY works in the Node runtime (server-side, Vercel
//      Functions / our long-running socket server). It WILL NOT execute
//      in the Edge runtime, and it WILL NOT execute in the browser.
//   2. Any caller that needs to use these exports must be a Node Server
//      Component, a Server Action, or a Route Handler with
//      `export const runtime = "nodejs"`.
//   3. For the PWA / browser path, the caller should detect
//      `LIBSIGNAL_AVAILABLE === false` and fall back to the WebCrypto
//      stand-in in `cipher.ts` / `keys.ts` (kept for that reason).
//
// We do `await import(...)` of the lib lazily, so this module is safe to
// import from isomorphic code as long as the libsignal exports are not
// called outside the Node runtime. Calling `getLibsignal()` in the
// browser throws a clear error.
//
// The IndexedDB-backed protocol stores live in `./store.ts`. The store
// abstraction supports both IndexedDB (browser; future use when libsignal
// gains a wasm port) and an in-memory backend (Node tests + transient
// server use).

import {
  StoreKeys,
  getKv,
  nextId,
  type Kv,
} from "./store";

// ---------------------------------------------------------------------------
// Typed re-exports without forcing a runtime load of the lib.
//
// We can't `import { IdentityKeyPair } from "@signalapp/libsignal-client"` at
// the top level because Webpack would try to bundle it into the client
// chunk (we mitigate via `serverExternalPackages` in next.config.ts, but the
// browser bundle still must not eagerly evaluate the require). So we
// import only types (erased at compile time) and load the runtime lazily.
// ---------------------------------------------------------------------------

import type {
  IdentityKeyPair as IdentityKeyPairT,
  PreKeyBundle as PreKeyBundleT,
  PreKeyRecord as PreKeyRecordT,
  SignedPreKeyRecord as SignedPreKeyRecordT,
  KyberPreKeyRecord as KyberPreKeyRecordT,
  SessionRecord as SessionRecordT,
  PublicKey as PublicKeyT,
  PrivateKey as PrivateKeyT,
  ProtocolAddress as ProtocolAddressT,
  CiphertextMessage as CiphertextMessageT,
  IdentityKeyStore as IdentityKeyStoreT,
  PreKeyStore as PreKeyStoreT,
  SignedPreKeyStore as SignedPreKeyStoreT,
  KyberPreKeyStore as KyberPreKeyStoreT,
  SessionStore as SessionStoreT,
  IdentityChange as IdentityChangeT,
  Direction as DirectionT,
} from "@signalapp/libsignal-client";

// ---------------------------------------------------------------------------
// Runtime gate. `true` only in a Node process where the native addon loads.
// ---------------------------------------------------------------------------

/**
 * `true` when running in the Node runtime, where the native libsignal
 * addon can dlopen its prebuild. Browser/Edge contexts get `false`.
 *
 * Callers MUST check this and fall back to `cipher.ts` (WebCrypto) when
 * false; otherwise `getLibsignal()` will throw.
 */
export const LIBSIGNAL_AVAILABLE: boolean =
  typeof process !== "undefined" &&
  typeof (process as { versions?: { node?: string } }).versions?.node === "string" &&
  // Edge runtime sets this to "edge"; Node runtime leaves it undefined or "nodejs".
  (typeof (globalThis as { EdgeRuntime?: string }).EdgeRuntime === "undefined");

// Module-level cache so we only `import()` once.
let _libPromise: Promise<typeof import("@signalapp/libsignal-client")> | null = null;

/**
 * Lazy loader for the libsignal native addon. Throws in non-Node contexts
 * with a clear error so the caller can fall back gracefully.
 */
export async function getLibsignal(): Promise<
  typeof import("@signalapp/libsignal-client")
> {
  if (!LIBSIGNAL_AVAILABLE) {
    throw new Error(
      "libsignal: not available in this runtime (browser or Edge). " +
        "Use the WebCrypto fallback in cipher.ts, or move this code path to " +
        "the Node runtime.",
    );
  }
  if (!_libPromise) {
    _libPromise = import("@signalapp/libsignal-client");
  }
  return _libPromise;
}

// ---------------------------------------------------------------------------
// Store adapter classes.
//
// These extend the abstract base classes from libsignal-client, which the
// lib invokes during encrypt/decrypt. Each delegates to a `Kv` backend
// (IndexedDB or in-memory). We deliberately do NOT extend the abstract
// classes at module top level (would force eager load); instead we build
// a class factory called once per session.
// ---------------------------------------------------------------------------

interface ProtocolStores {
  identity: IdentityKeyStoreT;
  preKey: PreKeyStoreT;
  signedPreKey: SignedPreKeyStoreT;
  kyberPreKey: KyberPreKeyStoreT;
  session: SessionStoreT;
}

let _storesCache: ProtocolStores | null = null;
let _kvForCache: Kv | null = null;

async function buildStores(kv: Kv): Promise<ProtocolStores> {
  const lib = await getLibsignal();

  class IdentityStore extends lib.IdentityKeyStore {
    async getIdentityKey(): Promise<PrivateKeyT> {
      const ikp = await ensureIdentity(kv);
      return ikp.privateKey;
    }
    async getLocalRegistrationId(): Promise<number> {
      let regId = (await kv.get("identity", StoreKeys.registrationId)) as
        | number
        | null;
      if (regId == null) {
        // 14-bit registration ID per the Signal spec (0..16383).
        regId = Math.floor(Math.random() * 16383) + 1;
        await kv.put("identity", StoreKeys.registrationId, regId);
      }
      return regId;
    }
    async saveIdentity(
      address: ProtocolAddressT,
      key: PublicKeyT,
    ): Promise<IdentityChangeT> {
      const k = StoreKeys.trustedIdentity(address.toString());
      const existing = (await kv.get("identity", k)) as Uint8Array | null;
      const fresh = key.serialize();
      await kv.put("identity", k, fresh);
      if (!existing) return lib.IdentityChange.NewOrUnchanged;
      // Constant-ish equality is fine here — both are local memory.
      if (existing.length === fresh.length) {
        let same = true;
        for (let i = 0; i < existing.length; i++) {
          if (existing[i] !== fresh[i]) {
            same = false;
            break;
          }
        }
        if (same) return lib.IdentityChange.NewOrUnchanged;
      }
      return lib.IdentityChange.ReplacedExisting;
    }
    async isTrustedIdentity(
      address: ProtocolAddressT,
      key: PublicKeyT,
      _direction: DirectionT,
    ): Promise<boolean> {
      const k = StoreKeys.trustedIdentity(address.toString());
      const stored = (await kv.get("identity", k)) as Uint8Array | null;
      if (!stored) return true; // TOFU on first contact, like Signal.
      const fresh = key.serialize();
      if (stored.length !== fresh.length) return false;
      for (let i = 0; i < stored.length; i++) {
        if (stored[i] !== fresh[i]) return false;
      }
      return true;
    }
    async getIdentity(address: ProtocolAddressT): Promise<PublicKeyT | null> {
      const k = StoreKeys.trustedIdentity(address.toString());
      const stored = (await kv.get("identity", k)) as Uint8Array | null;
      if (!stored) return null;
      return lib.PublicKey.deserialize(stored as Uint8Array<ArrayBuffer>);
    }
  }

  class PreKeyStoreImpl extends lib.PreKeyStore {
    async savePreKey(id: number, record: PreKeyRecordT): Promise<void> {
      await kv.put("prekeys", id, record.serialize());
    }
    async getPreKey(id: number): Promise<PreKeyRecordT> {
      const buf = (await kv.get("prekeys", id)) as Uint8Array | null;
      if (!buf) throw new Error(`PreKey ${id} not found`);
      return lib.PreKeyRecord.deserialize(buf as Uint8Array<ArrayBuffer>);
    }
    async removePreKey(id: number): Promise<void> {
      await kv.delete("prekeys", id);
    }
  }

  class SignedPreKeyStoreImpl extends lib.SignedPreKeyStore {
    async saveSignedPreKey(
      id: number,
      record: SignedPreKeyRecordT,
    ): Promise<void> {
      await kv.put("signedPreKeys", id, record.serialize());
    }
    async getSignedPreKey(id: number): Promise<SignedPreKeyRecordT> {
      const buf = (await kv.get("signedPreKeys", id)) as Uint8Array | null;
      if (!buf) throw new Error(`SignedPreKey ${id} not found`);
      return lib.SignedPreKeyRecord.deserialize(buf as Uint8Array<ArrayBuffer>);
    }
  }

  class KyberPreKeyStoreImpl extends lib.KyberPreKeyStore {
    async saveKyberPreKey(
      id: number,
      record: KyberPreKeyRecordT,
    ): Promise<void> {
      await kv.put("kyberPreKeys", id, record.serialize());
    }
    async getKyberPreKey(id: number): Promise<KyberPreKeyRecordT> {
      const buf = (await kv.get("kyberPreKeys", id)) as Uint8Array | null;
      if (!buf) throw new Error(`KyberPreKey ${id} not found`);
      return lib.KyberPreKeyRecord.deserialize(buf as Uint8Array<ArrayBuffer>);
    }
    async markKyberPreKeyUsed(
      _id: number,
      _signedPreKeyId: number,
      _baseKey: PublicKeyT,
    ): Promise<void> {
      // Last-resort PQ pre-keys are reusable; one-time PQ pre-keys would
      // be deleted here. Our bundle uses the last-resort pattern (single
      // reusable Kyber pre-key + a regenerated EC signed pre-key on a
      // schedule), so this is a no-op. This matches what the Signal
      // server does until the one-time Kyber pre-key path is wired.
    }
  }

  class SessionStoreImpl extends lib.SessionStore {
    async saveSession(
      address: ProtocolAddressT,
      record: SessionRecordT,
    ): Promise<void> {
      await kv.put("sessions", address.toString(), record.serialize());
    }
    async getSession(address: ProtocolAddressT): Promise<SessionRecordT | null> {
      const buf = (await kv.get("sessions", address.toString())) as
        | Uint8Array
        | null;
      if (!buf) return null;
      return lib.SessionRecord.deserialize(buf as Uint8Array<ArrayBuffer>);
    }
    async getExistingSessions(
      addresses: ProtocolAddressT[],
    ): Promise<SessionRecordT[]> {
      const out: SessionRecordT[] = [];
      for (const a of addresses) {
        const s = await this.getSession(a);
        if (!s) throw new Error(`Session not found for ${a.toString()}`);
        out.push(s);
      }
      return out;
    }
  }

  return {
    identity: new IdentityStore(),
    preKey: new PreKeyStoreImpl(),
    signedPreKey: new SignedPreKeyStoreImpl(),
    kyberPreKey: new KyberPreKeyStoreImpl(),
    session: new SessionStoreImpl(),
  };
}

/** Returns the protocol stores bound to the active KV backend. */
export async function getStores(kv: Kv = getKv()): Promise<ProtocolStores> {
  if (_storesCache && _kvForCache === kv) return _storesCache;
  _storesCache = await buildStores(kv);
  _kvForCache = kv;
  return _storesCache;
}

/** Test-only: drop cached stores so a fresh KV gets fresh adapters. */
export function _resetStoresCacheForTesting(): void {
  _storesCache = null;
  _kvForCache = null;
}

// ---------------------------------------------------------------------------
// Identity & pre-key bundle.
// ---------------------------------------------------------------------------

/**
 * Generate (or load) the user's long-term identity key pair. X25519 via
 * libsignal — replaces the ECDH-P256 + WebCrypto stub from `keys.ts`.
 */
export async function ensureIdentity(
  kv: Kv = getKv(),
): Promise<IdentityKeyPairT> {
  const lib = await getLibsignal();
  const stored = (await kv.get("identity", StoreKeys.selfIdentity)) as
    | Uint8Array
    | null;
  if (stored) {
    return lib.IdentityKeyPair.deserialize(stored as Uint8Array<ArrayBuffer>);
  }
  const ikp = lib.IdentityKeyPair.generate();
  await kv.put("identity", StoreKeys.selfIdentity, ikp.serialize());
  return ikp;
}

/**
 * Serialized form of a pre-key bundle, ready to upload to the server.
 *
 * Field names match libsignal's PreKeyBundle accessors so the wire format
 * is regular and obviously round-trippable. All `Uint8Array` fields are
 * base64-encoded for JSON transport.
 */
export interface SerializedPreKeyBundle {
  registrationId: number;
  deviceId: number;
  preKeyId: number;
  preKeyPublic: string; // base64
  signedPreKeyId: number;
  signedPreKeyPublic: string; // base64
  signedPreKeySignature: string; // base64
  kyberPreKeyId: number;
  kyberPreKeyPublic: string; // base64
  kyberPreKeySignature: string; // base64
  identityKey: string; // base64
}

const DEFAULT_DEVICE_ID = 1;

/**
 * Build a fresh pre-key bundle: one one-time EC pre-key, one signed EC
 * pre-key, one signed Kyber pre-key (PQXDH). Caller uploads this to the
 * server so new contacts can fetch it and start a session.
 *
 * Replenishment policy lives at the call site (the architecture doc says
 * to refill when the server's stash drops below 10) — this function just
 * makes one bundle.
 */
export async function getPreKeyBundle(
  kv: Kv = getKv(),
): Promise<SerializedPreKeyBundle> {
  const lib = await getLibsignal();
  const stores = await getStores(kv);
  const ikp = await ensureIdentity(kv);
  const registrationId = await stores.identity.getLocalRegistrationId();

  // One-time EC pre-key.
  const preKeyId = await nextId(StoreKeys.nextPreKeyId, kv);
  const prePriv = lib.PrivateKey.generate();
  const prePub = prePriv.getPublicKey();
  const preKeyRecord = lib.PreKeyRecord.new(preKeyId, prePub, prePriv);
  await stores.preKey.savePreKey(preKeyId, preKeyRecord);

  // Signed EC pre-key (rotated on a schedule by the caller).
  const signedPreKeyId = await nextId(StoreKeys.nextSignedPreKeyId, kv);
  const signedPriv = lib.PrivateKey.generate();
  const signedPub = signedPriv.getPublicKey();
  const signedSig = ikp.privateKey.sign(signedPub.serialize());
  const signedRecord = lib.SignedPreKeyRecord.new(
    signedPreKeyId,
    Date.now(),
    signedPub,
    signedPriv,
    signedSig,
  );
  await stores.signedPreKey.saveSignedPreKey(signedPreKeyId, signedRecord);

  // Signed Kyber pre-key (PQXDH leg of X3DH).
  const kyberId = await nextId(StoreKeys.nextKyberPreKeyId, kv);
  const kemPair = lib.KEMKeyPair.generate();
  const kemPub = kemPair.getPublicKey();
  const kemSig = ikp.privateKey.sign(kemPub.serialize());
  const kyberRecord = lib.KyberPreKeyRecord.new(
    kyberId,
    Date.now(),
    kemPair,
    kemSig,
  );
  await stores.kyberPreKey.saveKyberPreKey(kyberId, kyberRecord);

  return {
    registrationId,
    deviceId: DEFAULT_DEVICE_ID,
    preKeyId,
    preKeyPublic: b64(prePub.serialize()),
    signedPreKeyId,
    signedPreKeyPublic: b64(signedPub.serialize()),
    signedPreKeySignature: b64(signedSig),
    kyberPreKeyId: kyberId,
    kyberPreKeyPublic: b64(kemPub.serialize()),
    kyberPreKeySignature: b64(kemSig),
    identityKey: b64(ikp.publicKey.serialize()),
  };
}

/** Recreates a libsignal `PreKeyBundle` from its serialized form. */
async function deserializePreKeyBundle(
  s: SerializedPreKeyBundle,
): Promise<PreKeyBundleT> {
  const lib = await getLibsignal();
  return lib.PreKeyBundle.new(
    s.registrationId,
    s.deviceId,
    s.preKeyId,
    lib.PublicKey.deserialize(unb64(s.preKeyPublic) as Uint8Array<ArrayBuffer>),
    s.signedPreKeyId,
    lib.PublicKey.deserialize(unb64(s.signedPreKeyPublic) as Uint8Array<ArrayBuffer>),
    unb64(s.signedPreKeySignature) as Uint8Array<ArrayBuffer>,
    lib.PublicKey.deserialize(unb64(s.identityKey) as Uint8Array<ArrayBuffer>),
    s.kyberPreKeyId,
    lib.KEMPublicKey.deserialize(unb64(s.kyberPreKeyPublic) as Uint8Array<ArrayBuffer>),
    unb64(s.kyberPreKeySignature) as Uint8Array<ArrayBuffer>,
  );
}

// ---------------------------------------------------------------------------
// Encrypt / decrypt.
// ---------------------------------------------------------------------------

/**
 * Wire-encoded ciphertext. `type` distinguishes a Whisper (post-handshake
 * Double Ratchet) message from a PreKey (first message in a session) — the
 * recipient uses this to pick the right decrypt path.
 */
export interface EncryptedEnvelope {
  type: number; // CiphertextMessageType: 2 = Whisper, 3 = PreKey
  body: string; // base64-encoded serialized CiphertextMessage
  senderRegistrationId?: number;
}

const LOCAL_ADDRESS_DEFAULT_NAME = "self";
const LOCAL_DEVICE_ID = 1;

async function localAddress(): Promise<ProtocolAddressT> {
  const lib = await getLibsignal();
  return lib.ProtocolAddress.new(LOCAL_ADDRESS_DEFAULT_NAME, LOCAL_DEVICE_ID);
}

async function recipientAddress(recipientId: string): Promise<ProtocolAddressT> {
  const lib = await getLibsignal();
  return lib.ProtocolAddress.new(recipientId, DEFAULT_DEVICE_ID);
}

/**
 * Encrypt `plaintext` for `recipientId`.
 *
 * If we don't yet have a session with the recipient, `bundle` MUST be
 * provided so X3DH can run. After the first message, `bundle` may be
 * `null` and the Double Ratchet takes over.
 */
export async function encryptForRecipient(
  recipientId: string,
  bundle: SerializedPreKeyBundle | null,
  plaintext: Uint8Array | string,
  kv: Kv = getKv(),
): Promise<EncryptedEnvelope> {
  const lib = await getLibsignal();
  const stores = await getStores(kv);
  const remote = await recipientAddress(recipientId);
  const local = await localAddress();

  const existing = await stores.session.getSession(remote);
  if (!existing && !bundle) {
    throw new Error(
      `No session for ${recipientId} and no PreKeyBundle supplied — ` +
        `caller must pass a bundle for the first message.`,
    );
  }
  if (bundle && !existing) {
    const pkb = await deserializePreKeyBundle(bundle);
    await lib.processPreKeyBundle(
      pkb,
      remote,
      local,
      stores.session,
      stores.identity,
    );
  }

  const pt =
    typeof plaintext === "string"
      ? new TextEncoder().encode(plaintext)
      : plaintext;
  const cipher = await lib.signalEncrypt(
    pt as Uint8Array<ArrayBuffer>,
    remote,
    local,
    stores.session,
    stores.identity,
  );

  const out: EncryptedEnvelope = {
    type: cipher.type(),
    body: b64(cipher.serialize()),
  };
  // Surface the registration ID for sealed-sender / display purposes.
  const ikp = await ensureIdentity(kv);
  void ikp; // currently unused — placeholder for sealed-sender wrapping later
  return out;
}

/**
 * Decrypt an envelope from `senderId`. Inspects the `type` field to pick
 * the PreKey vs Whisper path.
 */
export async function decryptFromSender(
  senderId: string,
  envelope: EncryptedEnvelope,
  kv: Kv = getKv(),
): Promise<Uint8Array> {
  const lib = await getLibsignal();
  const stores = await getStores(kv);
  const remote = await recipientAddress(senderId);
  const local = await localAddress();
  const body = unb64(envelope.body) as Uint8Array<ArrayBuffer>;

  if (envelope.type === lib.CiphertextMessageType.PreKey) {
    const msg = lib.PreKeySignalMessage.deserialize(body);
    const pt = await lib.signalDecryptPreKey(
      msg,
      remote,
      local,
      stores.session,
      stores.identity,
      stores.preKey,
      stores.signedPreKey,
      stores.kyberPreKey,
    );
    return pt;
  }
  if (envelope.type === lib.CiphertextMessageType.Whisper) {
    const msg = lib.SignalMessage.deserialize(body);
    const pt = await lib.signalDecrypt(
      msg,
      remote,
      local,
      stores.session,
      stores.identity,
    );
    return pt;
  }
  throw new Error(`Unsupported ciphertext type ${envelope.type}`);
}

/** Convenience wrapper that returns text. */
export async function decryptTextFromSender(
  senderId: string,
  envelope: EncryptedEnvelope,
  kv: Kv = getKv(),
): Promise<string> {
  const bytes = await decryptFromSender(senderId, envelope, kv);
  return new TextDecoder().decode(bytes);
}

// ---------------------------------------------------------------------------
// Safety number (S-144).
// ---------------------------------------------------------------------------

/**
 * Signal-style displayable safety number. Both sides of the conversation
 * compute this independently and compare — when it matches, no MITM has
 * swapped identity keys.
 *
 * `myIdent` and `theirIdent` are the *identity* `PublicKey`s, not pre-keys.
 * Provide a stable `myStableId` / `theirStableId` (e.g. ACI UUIDs) so both
 * sides hash the same `localIdentifier` / `remoteIdentifier`.
 */
export async function safetyNumber(
  myIdent: PublicKeyT | Uint8Array,
  myStableId: string,
  theirIdent: PublicKeyT | Uint8Array,
  theirStableId: string,
): Promise<string> {
  const lib = await getLibsignal();

  const mePub =
    myIdent instanceof Uint8Array
      ? lib.PublicKey.deserialize(myIdent as Uint8Array<ArrayBuffer>)
      : myIdent;
  const themPub =
    theirIdent instanceof Uint8Array
      ? lib.PublicKey.deserialize(theirIdent as Uint8Array<ArrayBuffer>)
      : theirIdent;

  // Signal uses ~5200 iterations for the displayable fingerprint; lower
  // values are also valid as long as both sides agree. We pick 5200 to
  // match upstream (so external Signal-compatible debugging tools work).
  const ITERATIONS = 5200;
  const FINGERPRINT_VERSION = 2; // PQ-aware version, matches libsignal default

  const fp = lib.Fingerprint.new(
    ITERATIONS,
    FINGERPRINT_VERSION,
    new TextEncoder().encode(myStableId) as Uint8Array<ArrayBuffer>,
    mePub,
    new TextEncoder().encode(theirStableId) as Uint8Array<ArrayBuffer>,
    themPub,
  );

  return fp.displayableFingerprint().toString();
}

// ---------------------------------------------------------------------------
// Helpers.
// ---------------------------------------------------------------------------

function b64(buf: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(buf).toString("base64");
  }
  let s = "";
  for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i]);
  return btoa(s);
}

function unb64(s: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(s, "base64"));
  }
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ---------------------------------------------------------------------------
// One-line unified surface for callers that don't want to plumb the
// runtime gate themselves.
// ---------------------------------------------------------------------------

/**
 * Single check the caller does at the top of the hot path. When `false`,
 * skip libsignal entirely and use the WebCrypto fallback in `cipher.ts`.
 */
export function libsignalAvailable(): boolean {
  return LIBSIGNAL_AVAILABLE;
}

/* eslint-disable @typescript-eslint/no-unused-vars */
// Re-export type aliases the rest of the app may want to refer to without
// importing the lib directly. The `T` suffix is preserved internally to
// avoid name clashes; consumers get the clean names.
export type IdentityKeyPair = IdentityKeyPairT;
export type PreKeyBundle = PreKeyBundleT;
export type CiphertextMessage = CiphertextMessageT;
export type ProtocolAddress = ProtocolAddressT;
/* eslint-enable @typescript-eslint/no-unused-vars */
