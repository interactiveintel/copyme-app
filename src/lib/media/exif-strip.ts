// Server-side EXIF stripping for inbound images (S-133).
//
// Strategy: parse the JPEG/HEIF marker stream and skip the APP1 (EXIF),
// APP2 (FPXR), and Photoshop IRB segments. This avoids pulling in a
// big imaging library while still ridding uploads of GPS / device data.
// PNG metadata (tEXt / iTXt / eXIf) is stripped by re-emitting only
// IHDR, IDAT, and IEND chunks.
//
// For other formats (HEIC/AVIF/WebP) we currently return the bytes
// unchanged — the upload pipeline rejects them at MIME-sniff time
// (S-134) until a richer pipeline lands.

const JPEG_MARKER = 0xff;
const SOI = 0xd8;
const EOI = 0xd9;
const APP1 = 0xe1;
const APP2 = 0xe2;
const APP13 = 0xed;
const SOS = 0xda;

export function stripExif(input: Uint8Array, mime: string): Uint8Array {
  if (mime === "image/jpeg" || mime === "image/jpg") return stripJpeg(input);
  if (mime === "image/png") return stripPng(input);
  return input;
}

function stripJpeg(buf: Uint8Array): Uint8Array {
  if (buf.length < 4 || buf[0] !== JPEG_MARKER || buf[1] !== SOI) return buf;
  const out: number[] = [JPEG_MARKER, SOI];
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== JPEG_MARKER) {
      out.push(buf[i]);
      i++;
      continue;
    }
    // pad bytes (0xFF 0xFF) — keep
    while (i + 1 < buf.length && buf[i + 1] === JPEG_MARKER) {
      out.push(JPEG_MARKER);
      i++;
    }
    if (i + 1 >= buf.length) break;
    const marker = buf[i + 1];
    if (marker === EOI) {
      out.push(JPEG_MARKER, EOI);
      i += 2;
      break;
    }
    if (marker === SOS) {
      // SOS — copy the remainder verbatim (compressed scan).
      for (let j = i; j < buf.length; j++) out.push(buf[j]);
      break;
    }
    // Standalone markers without a length field.
    if (marker >= 0xd0 && marker <= 0xd7) {
      out.push(JPEG_MARKER, marker);
      i += 2;
      continue;
    }
    // Length-prefixed segment.
    const segLen = (buf[i + 2] << 8) | buf[i + 3];
    const segStart = i;
    const segEnd = i + 2 + segLen;
    if (marker === APP1 || marker === APP2 || marker === APP13) {
      // Drop EXIF / XMP / IRB.
      i = segEnd;
      continue;
    }
    // Keep segment.
    for (let j = segStart; j < segEnd; j++) out.push(buf[j]);
    i = segEnd;
  }
  return new Uint8Array(out);
}

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const KEEP_CHUNKS = new Set(["IHDR", "PLTE", "IDAT", "IEND", "tRNS", "gAMA", "cHRM", "sRGB", "iCCP"]);

function stripPng(buf: Uint8Array): Uint8Array {
  for (let i = 0; i < PNG_SIG.length; i++) if (buf[i] !== PNG_SIG[i]) return buf;
  const out: number[] = [...PNG_SIG];
  let i = PNG_SIG.length;
  while (i + 8 <= buf.length) {
    const len = (buf[i] << 24) | (buf[i + 1] << 16) | (buf[i + 2] << 8) | buf[i + 3];
    const type = String.fromCharCode(buf[i + 4], buf[i + 5], buf[i + 6], buf[i + 7]);
    const chunkEnd = i + 8 + len + 4;
    if (chunkEnd > buf.length) break;
    if (KEEP_CHUNKS.has(type)) {
      for (let j = i; j < chunkEnd; j++) out.push(buf[j]);
    }
    i = chunkEnd;
    if (type === "IEND") break;
  }
  return new Uint8Array(out);
}

/** Sanity-check helper for tests. Returns true if the byte sequence "Exif\0\0" is present. */
export function containsExifMarker(buf: Uint8Array): boolean {
  const needle = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00];
  outer: for (let i = 0; i + needle.length <= buf.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (buf[i + j] !== needle[j]) continue outer;
    }
    return true;
  }
  return false;
}
