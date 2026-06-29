import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // potrace and jimp are native CJS modules that use instanceof checks internally.
  // Bundling them via webpack breaks those checks, so we tell Next.js to leave them external.
  serverExternalPackages: ['potrace', 'jimp'],

  // Note: do NOT use output: 'standalone' when deploying to Vercel.
  // Vercel manages its own output format — standalone mode is only
  // for self-hosted / Docker deployments and breaks Vercel routing.
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
  async redirects() {
    return [
      { source: '/marketing/customers/:path*', destination: '/sales/customers/:path*', permanent: true },
      { source: '/marketing/contacts/:path*', destination: '/sales/contacts/:path*', permanent: true },
      { source: '/marketing/opportunities/:path*', destination: '/sales/opportunities/:path*', permanent: true },
      { source: '/marketing/vendors/:path*', destination: '/sales/suppliers/:path*', permanent: true },
      { source: '/marketing/tasks/:path*', destination: '/sales/tasks/:path*', permanent: true },
    ]
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  widenClientFileUpload: true,

  // Proxy Sentry requests through /monitoring to bypass ad-blockers
  tunnelRoute: "/monitoring",

  silent: !process.env.CI,
});
