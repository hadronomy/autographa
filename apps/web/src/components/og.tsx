import { ImageResponse } from "@takumi-rs/image-response";

import { CommandIcon } from "lucide-react";

const Crosshair = ({ top, left }: { top: number; left: number }) => (
  <div
    style={{
      position: "absolute",
      top: top - 40,
      left: left - 40,
      display: "flex",
      width: 80,
      height: 80,
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <svg width="40" height="40" viewBox="0 0 100 100" fill="none">
      <path d="M 50 42 Q 50 50 58 50 Q 50 50 50 58 Q 50 50 42 50 Q 50 50 50 42 Z" fill="#C0BCB6" />
    </svg>
  </div>
);

const Kbd = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#E5E3DF",
      color: "#8E8A86",
      padding: "2px 6px",
      borderRadius: 0,
      fontSize: 10,
      fontWeight: 500,
      marginLeft: 8,
      fontFamily: "monospace",
    }}
  >
    {children}
  </div>
);

export async function createOgResponse() {
  const response = new ImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        backgroundColor: "#FCFCFB", // ivory white
        color: "#2A2624", // deep sepia charcoal
        fontFamily: "monospace",
        position: "relative",
        flexDirection: "column",
      }}
    >
      {/* Subtle Grid Background */}
      <svg
        width="1200"
        height="630"
        style={{ position: "absolute", top: 0, left: 0, opacity: 0.04 }}
      >
        <defs>
          <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#2A2624" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="1200" height="630" fill="url(#grid)" />
      </svg>

      {/* Full-bleed overlapping brutalist lines */}
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 100,
          width: 1,
          backgroundColor: "#E5E3DF",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 1100,
          width: 1,
          backgroundColor: "#E5E3DF",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 120,
          left: 0,
          right: 0,
          height: 1,
          backgroundColor: "#E5E3DF",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 510,
          left: 0,
          right: 0,
          height: 1,
          backgroundColor: "#E5E3DF",
        }}
      />

      {/* Crosshairs at intersections */}
      <Crosshair top={120} left={100} />
      <Crosshair top={120} left={1100} />
      <Crosshair top={510} left={100} />
      <Crosshair top={510} left={1100} />

      {/* Main Content Box */}
      <div
        style={{
          position: "absolute",
          top: 120,
          left: 100,
          width: 1000,
          height: 390,
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#FCFCFB",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            height: 110,
            borderBottom: "1px solid #E5E3DF",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 40px",
            backgroundColor: "#F7F6F4",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span
              style={{
                fontSize: 36,
                fontWeight: "bold",
                letterSpacing: "-0.04em",
                color: "#2A2624",
              }}
            >
              autographa.
            </span>
            <span style={{ fontSize: 16, color: "#8E8A86" }}>
              Create beautiful handwritten signatures
            </span>
          </div>
        </div>

        {/* Canvas Area */}
        <div
          style={{
            display: "flex",
            flex: 1,
            position: "relative",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Blueprint corner markers inside the canvas */}
          <div
            style={{
              position: "absolute",
              top: 24,
              left: 24,
              width: 12,
              height: 12,
              borderLeft: "2px solid #C0BCB6",
              borderTop: "2px solid #C0BCB6",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 24,
              right: 24,
              width: 12,
              height: 12,
              borderRight: "2px solid #C0BCB6",
              borderTop: "2px solid #C0BCB6",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: 24,
              left: 24,
              width: 12,
              height: 12,
              borderLeft: "2px solid #C0BCB6",
              borderBottom: "2px solid #C0BCB6",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: 24,
              right: 24,
              width: 12,
              height: 12,
              borderRight: "2px solid #C0BCB6",
              borderBottom: "2px solid #C0BCB6",
            }}
          />

          {/* Signature Graphic */}
          <svg
            width="600"
            height="160"
            viewBox="0 0 600 160"
            fill="none"
            stroke="#2A2624"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ opacity: 0.9 }}
          >
            {/* Elegant organic signature path */}
            <path d="M 50,110 C 70,60 110,40 130,80 C 150,120 160,140 180,90 C 200,40 220,30 230,70 Q 240,110 250,120 C 280,150 290,120 310,90 Q 340,30 380,40 T 410,80 C 440,110 470,100 520,70" />
          </svg>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            height: 90,
            borderTop: "1px solid #E5E3DF",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 40px",
            backgroundColor: "#F7F6F4",
          }}
        >
          <div style={{ display: "flex", gap: 32 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span
                style={{
                  fontSize: 12,
                  color: "#8E8A86",
                  textTransform: "uppercase",
                  letterSpacing: "0.15em",
                }}
              >
                File
              </span>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  border: "1px solid #E5E3DF",
                  backgroundColor: "#FCFCFB",
                  padding: "8px 16px",
                  fontSize: 14,
                  color: "#2A2624",
                }}
              >
                signature.svg
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 16 }}>
            {/* Button Mockups */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                border: "1px solid #E5E3DF",
                padding: "8px 16px",
                backgroundColor: "#FCFCFB",
                fontSize: 12,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: "#2A2624",
              }}
            >
              <svg
                style={{ marginRight: 8 }}
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
              </svg>
              Copy SVG
              <Kbd>
                <CommandIcon
                  style={{
                    height: "50%",
                  }}
                />
                C
              </Kbd>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                border: "1px solid #2A2624",
                padding: "8px 16px",
                backgroundColor: "#2A2624",
                fontSize: 12,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: "#FCFCFB",
              }}
            >
              <svg
                style={{ marginRight: 8 }}
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" x2="12" y1="15" y2="3" />
              </svg>
              Download
              <Kbd>
                <CommandIcon
                  style={{
                    height: "50%",
                  }}
                />
                S
              </Kbd>
            </div>
          </div>
        </div>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      format: "png",
      quality: 100,
    },
  );

  response.headers.set("Content-Type", "image/png");
  response.headers.set("Cache-Control", "public, max-age=86400");
  return response;
}
