import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Note: do NOT use output: 'standalone' when deploying to Vercel.
  // Vercel manages its own output format — standalone mode is only
  // for self-hosted / Docker deployments and breaks Vercel routing.
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
};

export default nextConfig;
