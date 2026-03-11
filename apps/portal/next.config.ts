import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  transpilePackages: ["@or/shared", "@or/eol-import"]
};

export default nextConfig;
