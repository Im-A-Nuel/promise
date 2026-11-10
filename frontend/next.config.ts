import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Dev and production builds write to different folders. Running `next build` while `next dev` is up used
  // to overwrite the dev files and leave the dev server without its stylesheet.
  distDir: process.env.NODE_ENV === "production" ? ".next" : ".next-dev",
  // The round dev badge sits on top of the phone tab bar, and it is not part of the product.
  devIndicators: false,
  // Nothing here needs to be framed, sniffed or given device access. The CSP only covers what a page can
  // be embedded by and where forms post, so it cannot break Next's own scripts.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default config;
