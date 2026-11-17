import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lead-Suchen laufen synchron bis ~5 Min. (Apify run-sync). Phase 2: Queue + Webhook.
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      ],
    }];
  },
};
export default nextConfig;
