import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [
      {
        source: "/documents/products/rm/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, follow",
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/proizvodi/clear-harden-r-h-2p15",
        destination: "/proizvodi/h-2p15-clear-harden-r",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
