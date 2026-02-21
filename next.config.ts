import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // All pages are dynamic (require auth / runtime data)
  // This prevents build-time errors from missing env vars during prerender
  output: 'standalone',
};

export default nextConfig;
