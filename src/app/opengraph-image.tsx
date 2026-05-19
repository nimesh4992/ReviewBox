import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "ReviewBox â€” App Review Intelligence";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    <div
      style={{
        background: "#0d0f14",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
      }}
    >
      {/* Logo mark */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div
          style={{
            width: 72,
            height: 72,
            background: "#5B5BD6",
            borderRadius: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 36,
            fontWeight: 700,
            color: "white",
          }}
        >
          R
        </div>
        <span
          style={{
            fontSize: 52,
            fontWeight: 700,
            color: "white",
            letterSpacing: -2,
          }}
        >
          ReviewBox
        </span>
      </div>
      <p
        style={{
          fontSize: 26,
          color: "rgba(255,255,255,0.5)",
          margin: 0,
          textAlign: "center",
          maxWidth: 700,
        }}
      >
        AI-powered app store review management
      </p>
      <div style={{ display: "flex", gap: 24, marginTop: 8 }}>
        {["Google Play", "App Store", "AI Replies", "Crash Detection"].map(
          (tag) => (
            <div
              key={tag}
              style={{
                padding: "8px 18px",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 100,
                color: "rgba(255,255,255,0.4)",
                fontSize: 16,
              }}
            >
              {tag}
            </div>
          ),
        )}
      </div>
    </div>,
    { ...size },
  );
}
