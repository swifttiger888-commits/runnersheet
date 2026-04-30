import type { NextConfig } from "next";
import path from "node:path";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(process.cwd()),
  },
  /** Tree-shake icon imports from lucide-react (smaller bundles on app routes). */
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  async headers() {
    // Cache-first feel with background refresh for static assets.
    // This improves perceived performance in weak signal areas after first load.
    const staleWhileRevalidate = "public, max-age=0, s-maxage=31536000, stale-while-revalidate=604800";
    return [
      {
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
      },
      {
        source: "/_next/static/:path*",
        headers: [{ key: "Cache-Control", value: staleWhileRevalidate }],
      },
      {
        source: "/icons/:path*",
        headers: [{ key: "Cache-Control", value: staleWhileRevalidate }],
      },
      {
        source: "/apple-touch-icon.png",
        headers: [{ key: "Cache-Control", value: staleWhileRevalidate }],
      },
      {
        source: "/manifest.webmanifest",
        headers: [{ key: "Cache-Control", value: staleWhileRevalidate }],
      },
      {
        source: "/og.png",
        headers: [{ key: "Cache-Control", value: staleWhileRevalidate }],
      },
      {
        source: "/favicon.ico",
        headers: [{ key: "Cache-Control", value: staleWhileRevalidate }],
      },
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value:
              "accelerometer=(), autoplay=(), camera=(), geolocation=(self), gyroscope=(), magnetometer=(), microphone=(self), payment=(), usb=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
