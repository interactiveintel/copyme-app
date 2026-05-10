// MIME-sniffing for uploaded media (S-134 AC: "MIME sniffing on server;
// reject mismatched extensions"). We only allow what the message API
// supports; everything else hard-rejects.

const SIGS: Array<{ mime: string; bytes: number[] | null; ext: string[] }> = [
  // images
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff], ext: ["jpg", "jpeg"] },
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], ext: ["png"] },
  { mime: "image/gif", bytes: [0x47, 0x49, 0x46, 0x38], ext: ["gif"] },
  { mime: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46], ext: ["webp"] }, // RIFF
  // audio / video — webm/mp4 share variable headers; we keep the check loose.
  { mime: "video/webm", bytes: [0x1a, 0x45, 0xdf, 0xa3], ext: ["webm"] },
  { mime: "audio/webm", bytes: [0x1a, 0x45, 0xdf, 0xa3], ext: ["webm"] },
  { mime: "video/mp4", bytes: null, ext: ["mp4", "m4v", "m4a", "mov"] }, // ftyp at offset 4
  { mime: "audio/mp4", bytes: null, ext: ["m4a"] },
  // documents
  { mime: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46], ext: ["pdf"] },
];

export const ALLOWED_EXT = new Set(SIGS.flatMap((s) => s.ext));
export const MAX_DOC_BYTES = 25 * 1024 * 1024; // 25MB per S-134 AC

export interface SniffResult {
  ok: boolean;
  mime?: string;
  reason?: "TOO_LARGE" | "EXT_NOT_ALLOWED" | "SIG_MISMATCH" | "UNKNOWN";
}

export function sniff(buf: Uint8Array, filename: string): SniffResult {
  if (buf.byteLength > MAX_DOC_BYTES) return { ok: false, reason: "TOO_LARGE" };
  const ext = (filename.split(".").pop() || "").toLowerCase();
  if (!ALLOWED_EXT.has(ext)) return { ok: false, reason: "EXT_NOT_ALLOWED" };

  for (const s of SIGS) {
    if (!s.ext.includes(ext)) continue;
    if (s.bytes === null) {
      // mp4-style: check 'ftyp' at offset 4.
      if (buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) {
        return { ok: true, mime: s.mime };
      }
      continue;
    }
    let matches = true;
    for (let i = 0; i < s.bytes.length; i++) {
      if (buf[i] !== s.bytes[i]) {
        matches = false;
        break;
      }
    }
    if (matches) return { ok: true, mime: s.mime };
  }
  return { ok: false, reason: "SIG_MISMATCH" };
}
