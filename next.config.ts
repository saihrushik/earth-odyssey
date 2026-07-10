import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A stray lockfile exists in the home directory; pin the workspace root.
  turbopack: {
    root: path.join(__dirname),
  },
  // Keep the MongoDB driver out of the bundler; it's server-only.
  serverExternalPackages: ["mongodb"],
};

export default nextConfig;
