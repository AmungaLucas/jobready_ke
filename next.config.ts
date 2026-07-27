import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,

  // Keep pdfjs-dist out of the webpack bundle so its internal
  // dynamic import of pdf.worker.mjs doesn't get rewritten to a
  // non-existent Vercel path.  The library is loaded at runtime via
  // dynamic import(); we set workerSrc to a CDN URL so no local
  // worker file is needed.
  serverExternalPackages: ["pdfjs-dist"],
};

export default nextConfig;
