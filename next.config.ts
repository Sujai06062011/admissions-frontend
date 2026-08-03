import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ACS UI library ships mixed CJS/ESM — transpile for the Next bundler.
  transpilePackages: [
    "@azure/communication-react",
    "@azure/communication-calling",
    "@azure/communication-common",
  ],
};

export default nextConfig;
