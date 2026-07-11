import type { NextConfig } from "next";
import path from "path";

const monorepoRoot = path.join(__dirname, "../../");

const nextConfig: NextConfig = {
  outputFileTracingRoot: monorepoRoot,
  turbopack: {
    root: monorepoRoot,
  },
};

export default nextConfig;
