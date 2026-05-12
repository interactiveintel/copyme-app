import { ImageResponse } from "next/og";

// Default Open Graph image for the landing route. Next.js renders this on
// build into a static PNG and exposes it at /opengraph-image. Other routes
// can declare their own opengraph-image.tsx for per-page social previews.

export const runtime = "edge";
export const alt = "CopyMe — Communication That Matters · Your World's chart of Communication";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
          background:
            "linear-gradient(135deg, #1A1A2E 0%, #2D1B69 50%, #5B2A86 100%)",
          color: "white",
        }}
      >
        {/* Wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 44, fontWeight: 800, color: "white" }}>Copy</span>
          <span
            style={{
              fontSize: 44,
              fontWeight: 800,
              background: "linear-gradient(90deg, #A78BFA, #F472B6)",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            Me
          </span>
        </div>

        {/* Headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              alignSelf: "flex-start",
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 18px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.18)",
              fontSize: 18,
              color: "rgba(255,255,255,0.85)",
              fontWeight: 600,
              letterSpacing: 2,
            }}
          >
            ✨ THE FUTURE OF COMMUNICATION
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 88, fontWeight: 800, lineHeight: 1.02, display: "flex", gap: 22, flexWrap: "wrap" }}>
              <span>Communication That</span>
              <span
                style={{
                  background: "linear-gradient(90deg, #A78BFA, #F472B6)",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                Matters
              </span>
            </div>
            <div
              style={{
                fontSize: 36,
                fontWeight: 600,
                color: "rgba(255,255,255,0.85)",
                lineHeight: 1.2,
              }}
            >
              {"Your World’s chart of Communication."}
            </div>
          </div>
          <div
            style={{
              fontSize: 24,
              color: "rgba(255,255,255,0.65)",
              lineHeight: 1.4,
              maxWidth: 900,
            }}
          >
            Rule of 7 — a revolutionary constraint system that replaces noise with meaning.
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            color: "rgba(255,255,255,0.5)",
            fontSize: 22,
          }}
        >
          <div>copyme1.com</div>
          <div style={{ display: "flex", gap: 24 }}>
            <span>📱 Free</span>
            <span>🔒 End-to-end encrypted</span>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
