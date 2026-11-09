import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Dev and production builds write to different folders. Running `next build` while `next dev` is up used
  // to overwrite the dev files and leave the dev server without its stylesheet.
  distDir: process.env.NODE_ENV === "production" ? ".next" : ".next-dev",
  // The round dev badge sits on top of the phone tab bar, and it is not part of the product.
  devIndicators: false,
};

export default config;
