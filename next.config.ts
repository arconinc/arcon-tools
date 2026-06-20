import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import { defineFlags } from 'flags';

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
};

export const flags = defineFlags({
  'expense-reports': {
    description: 'Enable expense report feature',
  },
});

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  widenClientFileUpload: true,

  // Proxy Sentry requests through /monitoring to bypass ad-blockers
  tunnelRoute: "/monitoring",

  silent: !process.env.CI,
});
