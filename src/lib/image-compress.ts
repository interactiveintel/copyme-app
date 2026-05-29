// Client-side image compression for avatar + chat-attachment uploads.
//
// Joze Kralj (Pimdom, Samsung Android — May 18 feedback) couldn't
// upload his profile picture because Samsung front-camera shots blew
// past the avatar endpoint's 2MB cap. This helper resizes + re-encodes
// the image in the browser before we POST it, so a 5–8MB camera shot
// becomes a ~400KB JPEG that the server accepts.
//
// No third-party dependency — Canvas + createImageBitmap are universal
// enough at this point (Safari 15+, Chrome 50+).
//
// Strategy:
//   1. Decode the image to an ImageBitmap (faster than <img> + slower
//      Canvas path on big images; falls back to <img> on older Safari).
//   2. Scale down to fit maxDimension on the longest edge.
//   3. Draw to canvas, export as JPEG with a quality knob.
//   4. If still over targetBytes, drop quality by 10% and retry; bail
//      out after 5 passes (don't loop forever on a pathological input).

const DEFAULT_TARGET_BYTES = 1.8 * 1024 * 1024; // 1.8MB — safely under the avatar 2MB cap
const DEFAULT_MAX_DIMENSION = 1600;            // px on longest edge
const MIN_QUALITY = 0.5;

export interface CompressOptions {
  targetBytes?: number;
  maxDimension?: number;
  /** Initial JPEG quality 0..1. Default 0.85. */
  initialQuality?: number;
  /** Output mime. Default "image/jpeg" (smaller than PNG for photos). */
  mimeType?: "image/jpeg" | "image/webp";
}

/**
 * Compress an image File so the result is at most `targetBytes`. If the
 * input is already small enough we return it unchanged (no needless
 * re-encode).
 *
 * Throws on decode failure (corrupt image, unsupported format) — caller
 * should catch and surface a friendly error.
 */
export async function compressImage(
  file: File,
  options: CompressOptions = {},
): Promise<File> {
  const targetBytes = options.targetBytes ?? DEFAULT_TARGET_BYTES;
  const maxDimension = options.maxDimension ?? DEFAULT_MAX_DIMENSION;
  const mimeType = options.mimeType ?? "image/jpeg";
  let quality = options.initialQuality ?? 0.85;

  // Fast path: already under the cap and not gigantic dimension-wise.
  if (file.size <= targetBytes) return file;

  const bitmap = await decode(file);
  const { width, height } = scaleDownToFit(bitmap.width, bitmap.height, maxDimension);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(bitmap, 0, 0, width, height);
  // Best-effort close on ImageBitmap (Safari may not implement close()).
  if (typeof (bitmap as ImageBitmap).close === "function") {
    (bitmap as ImageBitmap).close();
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const blob = await canvasToBlob(canvas, mimeType, quality);
    if (!blob) throw new Error("Canvas toBlob returned null");
    if (blob.size <= targetBytes || quality <= MIN_QUALITY) {
      // Preserve the original filename + swap the extension to match
      // the output mime so the server's sniffer doesn't get confused.
      const baseName = file.name.replace(/\.[^.]+$/, "");
      const ext = mimeType === "image/webp" ? "webp" : "jpg";
      return new File([blob], `${baseName}.${ext}`, { type: mimeType });
    }
    quality = Math.max(MIN_QUALITY, quality - 0.1);
  }

  // Shouldn't reach here — the loop returns or hits MIN_QUALITY.
  throw new Error("Failed to compress image below target size");
}

// ---- helpers --------------------------------------------------------------

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  // createImageBitmap is faster + works off-main-thread when possible.
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // fall through to <img> path on decode failure (e.g. HEIC on some
      // browsers — caller should ask the user to pick a different format)
    }
  }
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image decode failed"));
    };
    img.src = url;
  });
}

function scaleDownToFit(w: number, h: number, maxDim: number) {
  const longest = Math.max(w, h);
  if (longest <= maxDim) return { width: w, height: h };
  const ratio = maxDim / longest;
  return { width: Math.round(w * ratio), height: Math.round(h * ratio) };
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
}
