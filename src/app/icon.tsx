// 512×512 PWA icon — required for Chrome installability.
//
// Chrome's PWA install criteria require at least one PNG icon sized
// exactly 192×192 or 512×512. The site previously only had a 180×180
// apple-icon (Apple convention) and an SVG with sizes:"any" — neither
// reliably triggers Chrome's install icon in the address bar. This
// 512×512 PNG closes that gap.
//
// Routed at /icon by Next.js App Router (file-based icon convention).
// Same gradient + wordmark as the apple-icon so both feel like the
// same brand mark.
//
// Runtime is "edge" to match apple-icon.tsx — ImageResponse is built
// for that environment and per-request render time stays well under
// the route's cache headers.

import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(135deg, #4F46E5 0%, #7C3AED 50%, #EC4899 100%)",
          color: "white",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ fontSize: 148, fontWeight: 900, lineHeight: 1, color: "white" }}>
          Copy
        </div>
        <div style={{ fontSize: 170, fontWeight: 900, lineHeight: 1, color: "#FDE68A" }}>
          Me
        </div>
      </div>
    ),
    { ...size },
  );
}
