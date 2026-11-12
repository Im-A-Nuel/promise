import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "Promise: every gift is a promise to give back";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The social preview card shown when a link is shared on X and other apps.
export default async function OpenGraphImage() {
  const icon = await readFile(join(process.cwd(), "public", "art", "og-pao.png"));
  const src = `data:image/png;base64,${icon.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          padding: "0 96px",
          background: "linear-gradient(135deg, #FFE2D6 0%, #FFF8F1 55%, #FFEFD6 100%)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", flex: 1, paddingRight: 48 }}>
          <div style={{ display: "flex", fontSize: 34, fontWeight: 700, color: "#7A1414" }}>Promise</div>
          <div style={{ display: "flex", marginTop: 24, fontSize: 72, lineHeight: 1.08, fontWeight: 800, color: "#3A2A1A" }}>
            Every gift is a promise to give back.
          </div>
          <div style={{ display: "flex", marginTop: 28, fontSize: 30, color: "#6B5A48" }}>
            Wedding red envelopes as soulbound NFTs on NEAR testnet
          </div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={420} height={338} alt="" />
      </div>
    ),
    size,
  );
}
