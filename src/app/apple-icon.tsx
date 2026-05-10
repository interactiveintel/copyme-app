import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
        <div style={{ fontSize: 52, fontWeight: 900, lineHeight: 1, color: "white" }}>
          Copy
        </div>
        <div style={{ fontSize: 60, fontWeight: 900, lineHeight: 1, color: "#FDE68A" }}>
          Me
        </div>
      </div>
    ),
    { ...size },
  );
}
