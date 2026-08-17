import type { NextConfig } from "next";

// When deploying to GitHub Pages, set basePath to your repo name.
// This is ignored in local dev (NEXT_PUBLIC_BASE_PATH is undefined).
const isProd = process.env.NODE_ENV === "production";
const repoName = "ES-Tools"; // Must match your GitHub repository name

const nextConfig: NextConfig = {
  output: "export",          // Enable static HTML export for GitHub Pages
  basePath: isProd ? `/${repoName}` : "",
  assetPrefix: isProd ? `/${repoName}/` : "",
  trailingSlash: true,       // Required for GitHub Pages routing
  images: {
    unoptimized: true,       // next/image optimization requires a server
  },
  async headers() {
    // Note: Custom headers only apply in local dev / Node server mode.
    // GitHub Pages (static host) does NOT support custom HTTP headers.
    // If SharedArrayBuffer / Web Workers are required in production,
    // use Vercel or another server-based host instead.
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "require-corp",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
