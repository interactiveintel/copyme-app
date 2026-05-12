// IndexedDB-backed Signal Protocol stores (B1 / S-141 follow-up).
//
// libsignal-client's stores are abstract async classes — the lib calls
// `getXxx`/`saveXxx` on them and trusts us to persist the byte buffers.
// Browser persistence layer is IndexedDB (database `copyme-signal`); we
// also support a process-local in-memory backend for Node test contexts
// (see `MemoryKv`).
//
// The libsignal protocol APIs are all `async`, so a real network-backed
// KV would also slot in here without changing call sites. Today we don't
// import libsignal types at module-eval time — that file is server-only
// (native Node addon) and would fail to load in the browser. Instead the
// store classes accept `unknown` for the lib's record types and cast at
// call sites in `libsignal.ts`. The runtime structural shape that matters
// is `serialize() => Uint8Array` and `static deserialize(buf) => Self`,
// which all of libsignal's record types provide.
//
// Schema (object stores):
//   - identity:     { key: "self", value: Uint8Array (IdentityKeyPair.serialize()) }
//                   { key: "registrationId", value: number }
//                   { key: "trust:<address>", value: Uint8Array (PublicKey bytes) }
//   - prekeys:      { key: number (preKeyId), value: Uint8Array (PreKeyRecord) }
//   - signedPreKeys:{ key: number (signedPreKeyId), value: Uint8Array }
//   - kyberPreKeys: { key: number (kyberPreKeyId), value: Uint8Array }
//   - sessions:     { key: string (address.toString()), value: Uint8Array }
//   - meta:         { key: string, value: unknown } — small bookkeeping
//
// All records are `Uint8Array` so the IndexedDB structured-clone path is
// trivial. The libsignal-side adapter does the deserialize round-trip.

const DB_NAME = "copyme-signal";
const DB_VERSION = 1;

const STORES = [
  "identity",
  "prekeys",
  "signedPreKeys",
  "kyberPreKeys",
  "sessions",
  "meta",
] as const;
type StoreName = (typeof STORES)[number];

// ---------------------------------------------------------------------------
// Backend: IndexedDB in the browser, in-memory in Node.
// ---------------------------------------------------------------------------

export interface Kv {
  get(store: StoreName, key: IDBValidKey): Promise<unknown>;
  put(store: StoreName, key: IDBValidKey, value: unknown): Promise<void>;
  delete(store: StoreName, key: IDBValidKey): Promise<void>;
  /** Returns all values in a store (used to enumerate sessions for testing). */
  values(store: StoreName): Promise<unknown[]>;
}

class IdbKv implements Kv {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private open(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const s of STORES) {
          if (!db.objectStoreNames.contains(s)) db.createObjectStore(s);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return this.dbPromise;
  }

  async get(store: StoreName, key: IDBValidKey): Promise<unknown> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, "readonly");
      const r = tx.objectStore(store).get(key);
      r.onsuccess = () => resolve(r.result ?? null);
      r.onerror = () => reject(r.error);
    });
  }

  async put(store: StoreName, key: IDBValidKey, value: unknown): Promise<void> {
    const db = await this.open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(store, "readwrite");
      tx.objectStore(store).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async delete(store: StoreName, key: IDBValidKey): Promise<void> {
    const db = await this.open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(store, "readwrite");
      tx.objectStore(store).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async values(store: StoreName): Promise<unknown[]> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, "readonly");
      const out: unknown[] = [];
      const cursor = tx.objectStore(store).openCursor();
      cursor.onsuccess = () => {
        const c = cursor.result;
        if (!c) {
          resolve(out);
          return;
        }
        out.push(c.value);
        c.continue();
      };
      cursor.onerror = () => reject(cursor.error);
    });
  }
}

class MemoryKv implements Kv {
  private data: Map<StoreName, Map<string, unknown>> = new Map();

  private bucket(store: StoreName): Map<string, unknown> {
    let b = this.data.get(store);
    if (!b) {
      b = new Map();
      this.data.set(store, b);
    }
    return b;
  }

  // IDBValidKey can be a number or string; collapse to a string for the
  // in-memory map.
  private keyOf(k: IDBValidKey): string {
    return typeof k === "string" ? `s:${k}` : `n:${String(k)}`;
  }

  async get(store: StoreName, key: IDBValidKey): Promise<unknown> {
    return this.bucket(store).get(this.keyOf(key)) ?? null;
  }

  async put(store: StoreName, key: IDBValidKey, value: unknown): Promise<void> {
    this.bucket(store).set(this.keyOf(key), value);
  }

  async delete(store: StoreName, key: IDBValidKey): Promise<void> {
    this.bucket(store).delete(this.keyOf(key));
  }

  async values(store: StoreName): Promise<unknown[]> {
    return Array.from(this.bucket(store).values());
  }
}

let _kv: Kv | null = null;

/** Returns the active KV backend (lazy-init: IDB in browser, memory in Node). */
export function getKv(): Kv {
  if (_kv) return _kv;
  if (typeof indexedDB !== "undefined") {
    _kv = new IdbKv();
  } else {
    _kv = new MemoryKv();
  }
  return _kv;
}

/** Test-only: swap the backend (e.g. fresh MemoryKv per case). */
export function setKvForTesting(kv: Kv): void {
  _kv = kv;
}

/** Test-only: build an isolated in-memory store. */
export function createMemoryKv(): Kv {
  return new MemoryKv();
}

// ---------------------------------------------------------------------------
// Typed conveniences.
//
// libsignal-client's stores are abstract classes we extend in libsignal.ts.
// To keep this file free of any libsignal *runtime* import (so it can be
// tree-shaken for the browser bundle), we only deal in `Uint8Array` blobs
// and primitive keys here, then the libsignal layer wraps these calls in
// the lib's expected `XxxRecord` deserialize/serialize round-trip.
// ---------------------------------------------------------------------------

export const StoreKeys = {
  // identity store
  selfIdentity: "self" as IDBValidKey,
  registrationId: "registrationId" as IDBValidKey,
  trustedIdentity: (address: string): IDBValidKey => `trust:${address}`,
  // meta
  nextPreKeyId: "nextPreKeyId" as IDBValidKey,
  nextSignedPreKeyId: "nextSignedPreKeyId" as IDBValidKey,
  nextKyberPreKeyId: "nextKyberPreKeyId" as IDBValidKey,
};

/** Counter helper for assigning monotonically-increasing key IDs. */
export async function nextId(metaKey: IDBValidKey, kv: Kv = getKv()): Promise<number> {
  const cur = (await kv.get("meta", metaKey)) as number | null;
  const next = (cur ?? 0) + 1;
  await kv.put("meta", metaKey, next);
  return next;
}
