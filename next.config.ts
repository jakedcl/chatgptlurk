import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: "export",
  poweredByHeader: false,
  turbopack: { root: path.join(__dirname) },
};

export default nextConfig;
