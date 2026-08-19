import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  poweredByHeader: false,
  // `next build` i `next dev` dele isti izlazni folder. Ako se provera builda
  // pokrene dok dev server radi, produkcijski build prepiše dev artefakte i
  // dev server ostane sa 404 na CSS chunk-u — stranica se onda prikaže bez
  // stilova. Zato `npm run build:check` gradi u zaseban folder.
  // Vercel ne postavlja ovu promenljivu i i dalje koristi `.next`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  experimental: {
    // Omogućava `forbidden()` iz next/navigation, da zabranjena ruta portala
    // vrati pravi 403 status umesto preusmeravanja na stranicu sa porukom.
    authInterrupts: true,
  },
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
