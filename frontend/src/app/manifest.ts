import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Promise",
    short_name: "Promise",
    description: "Wedding red envelopes as soulbound NFTs on NEAR testnet.",
    start_url: "/",
    display: "standalone",
    background_color: "#FFF8F1",
    theme_color: "#FFF8F1",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
