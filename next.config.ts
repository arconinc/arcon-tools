import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Note: do NOT use output: 'standalone' when deploying to Vercel.
  // Vercel manages its own output format — standalone mode is only
  // for self-hosted / Docker deployments and breaks Vercel routing.
};

export default nextConfig;
