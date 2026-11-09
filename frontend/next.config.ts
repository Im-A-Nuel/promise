import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The round dev badge sits on top of the phone tab bar, and it is not part of the product.
  devIndicators: false,
};

export default config;
