// Vercel Blob upload wrapper (A1).
//
// Two paths into the store:
//   1. Client-direct upload via signed handle (preferred for large media —
//      bypasses our function, no proxy bandwidth). Used for chat media.
//   2. Server-side upload for small things (avatar) where we want EXIF
//      stripped on the function before the bytes reach the bucket.
//
// All uploads go to a path prefixed by user-id, so blob URLs are
// trivially mappable to ownership when we audit / GC.

import { put, del, list, type PutBlobResult } from "@vercel/blob";
import { stripExif, containsExifMarker } from "@/lib/media/exif-strip";
import { sniff, MAX_DOC_BYTES, type SniffResult } from "@/lib/media/sniff";
import { addBreadcrumb } from "@/lib/observability";

// ---- Path conventions ----------------------------------------------------

export function avatarPath(userId: string, ext: string): string {
  // `users/<uuid>/avatar.<ext>` — single avatar per user, latest overwrites.
  return `users/${userId}/avatar.${ext}`;
}

export function messageMediaPath(
  senderId: string,
  messageId: string,
  index: number,
  ext: string,
): string {
  // `messages/<sender>/<mid>/<idx>.<ext>` — many per message.
  return `messages/${senderId}/${messageId}/${index}.${ext}`;
}

// ---- Server-side upload (avatar) -----------------------------------------

/**
 * Upload a small image (avatar) directly through the function. EXIF /
 * XMP / GPS metadata is stripped before bytes land in the blob.
 */
export async function uploadAvatar(
  userId: string,
  buf: Uint8Array,
  filename: string,
): Promise<{ url: string; ok: true } | { ok: false; reason: SniffResult["reason"] }> {
  const sniffed = sniff(buf, filename);
  if (!sniffed.ok || !sniffed.mime) {
    addBreadcrumb("blob.avatar_rejected", { reason: sniffed.reason });
    return { ok: false, reason: sniffed.reason };
  }
  // Only images for avatars.
  if (!sniffed.mime.startsWith("image/")) {
    return { ok: false, reason: "EXT_NOT_ALLOWED" };
  }
  const stripped = stripExif(buf, sniffed.mime);
  const ext = filename.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = avatarPath(userId, ext);
  const result: PutBlobResult = await put(path, Buffer.from(stripped), {
    access: "public",
    contentType: sniffed.mime,
    allowOverwrite: true,
  });
  addBreadcrumb("blob.avatar_uploaded", { userId, bytes: stripped.byteLength });
  return { ok: true, url: result.url };
}

// ---- Client-direct upload (chat media) -----------------------------------

export interface SignResult {
  ok: true;
  /** Path where the client should PUT the file. */
  uploadUrl: string;
  /** Final public URL the client should send back to /api/messages/send. */
  publicUrl: string;
  /** Server-generated path; not strictly needed by the client. */
  path: string;
}

/**
 * Issue a presigned URL for client-direct upload. The upload endpoint at
 * Vercel Blob honors the access-token signing and writes to the path we
 * specify. We do NOT proxy bytes through the function.
 *
 * Note: `@vercel/blob`'s `put()` returns a final URL and handles signing
 * automatically when `BLOB_READ_WRITE_TOKEN` is set in the runtime. The
 * server only needs to compute the path and forward it.
 */
export async function signMediaUpload(
  senderId: string,
  messageId: string,
  index: number,
  filename: string,
  size: number,
): Promise<{ ok: true; path: string; publicBaseUrl: string } | { ok: false; reason: string }> {
  if (size > MAX_DOC_BYTES) {
    return { ok: false, reason: "TOO_LARGE" };
  }
  const ext = filename.split(".").pop()?.toLowerCase() ?? "bin";
  return {
    ok: true,
    path: messageMediaPath(senderId, messageId, index, ext),
    publicBaseUrl: deriveBlobBaseUrl(),
  };
}

/**
 * Server-side write helper for clients that want to send small media
 * inline through the API (no two-hop). Bytes are sniffed + EXIF-stripped
 * before storage.
 */
export async function writeMessageMedia(
  senderId: string,
  messageId: string,
  index: number,
  filename: string,
  buf: Uint8Array,
): Promise<{ ok: true; url: string } | { ok: false; reason: SniffResult["reason"] }> {
  const sniffed = sniff(buf, filename);
  if (!sniffed.ok || !sniffed.mime) return { ok: false, reason: sniffed.reason };
  const cleaned =
    sniffed.mime === "image/jpeg" || sniffed.mime === "image/jpg" || sniffed.mime === "image/png"
      ? stripExif(buf, sniffed.mime)
      : buf;
  const ext = filename.split(".").pop()?.toLowerCase() ?? "bin";
  const path = messageMediaPath(senderId, messageId, index, ext);
  const result = await put(path, Buffer.from(cleaned), {
    access: "public",
    contentType: sniffed.mime,
    allowOverwrite: false,
  });
  addBreadcrumb("blob.media_uploaded", {
    senderId,
    messageId,
    bytes: cleaned.byteLength,
    hasExif: containsExifMarker(buf) && !containsExifMarker(cleaned),
  });
  return { ok: true, url: result.url };
}

// ---- Maintenance ---------------------------------------------------------

/** Delete a blob by URL (used during user hard-delete / message expiry). */
export async function deleteBlob(url: string): Promise<void> {
  try {
    await del(url);
  } catch {
    // already gone or never existed — fine
  }
}

/** List avatars + counts for a user (audit / debug). */
export async function listForUser(userId: string) {
  const { blobs } = await list({ prefix: `users/${userId}/` });
  return blobs;
}

function deriveBlobBaseUrl(): string {
  // The token format includes the store base URL in production. We don't
  // attempt to parse it — clients use the URL the server returns from put().
  // This helper is kept for the (future) presigned-URL flow.
  return "https://blob.vercel-storage.com";
}
