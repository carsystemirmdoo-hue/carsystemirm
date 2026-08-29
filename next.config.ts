import type { NextConfig } from "next";
import {
  noStoreHeaders,
  NO_STORE_PATHS,
  securityHeaders,
} from "./lib/security/http-headers.mjs";

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  poweredByHeader: false,
  // `next build` i `next dev` dele isti izlazni folder. Ako se provera builda
  // pokrene dok dev server radi, produkcijski build prepiše dev artefakte i
  // dev server ostane sa 404 na CSS chunk-u — stranica se onda prikaže bez
  // stilova. Zato `npm run build:check` gradi u zaseban folder.
  // Vercel ne postavlja ovu promenljivu i i dalje koristi `.next`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  /*
   * `unpdf` se ne pakuje u bundle, nego se učitava iz `node_modules`.
   *
   * Unutra je pdf.js, koji koristi `import.meta` na način koji webpack ume
   * samo da upozori i ostavi. Upozorenje je bezbedno, ali stoji na svakom
   * buildu i sakriva sledeće koje neće biti. Biblioteka se ionako izvršava
   * isključivo na serveru.
   */
  serverExternalPackages: ["unpdf"],
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
        /*
         * Bezbednosna zaglavlja za sve rute.
         *
         * Politika je podeljena na deo koji je na snazi i deo koji samo
         * prijavljuje prekršaje — vidi `lib/security/http-headers.mjs` za
         * razlog. Ništa ovde ne zahteva dinamičko renderovanje, pa statička
         * generacija ostaje netaknuta.
         */
        source: "/:path*",
        headers: securityHeaders({
          VERCEL_ENV: process.env.VERCEL_ENV,
          NODE_ENV: process.env.NODE_ENV,
        }),
      },
      /*
       * Osetljive rute nikad u keš.
       *
       * Ide POSLE opšteg pravila da bi se `Cache-Control` primenio na te
       * putanje; Next spaja zaglavlja iz svih pravila koja se poklope.
       */
      ...NO_STORE_PATHS.map((source) => ({
        source,
        headers: noStoreHeaders(),
      })),
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
      // Traženi oblik `/proizvodi/baslac-line-35?varijanta=35-M214` vodi na
      // postojeću canonical family rutu; query se prenosi.
      {
        source: "/proizvodi/baslac-line-:system(30|35|45)",
        destination: "/proizvodi/grupa/baslac-line-:system",
        permanent: false,
      },
      {
        source: "/proizvodi/clear-harden-r-h-2p15",
        destination: "/proizvodi/h-2p15-clear-harden-r",
        permanent: true,
      },
      /*
       * Baslac legacy slug, isti obrazac kao red iznad.
       *
       * `baslac-35-m331-pasta` je bio drugi zapis za `35-M331 Red Xirallic
       * 0,5 L`; canonical je sada generisani `baslac-35-m331`. Odredište je
       * namerno canonical PDP ruta, a ne family URL sa `?varijanta=` — tu
       * adresu razrešava `variantRedirectTarget()` u istom zahtevu, pa se
       * znanje o porodici ne duplira u konfiguraciji.
       *
       * Izvor istine je `BASLAC_LEGACY_SLUGS` u `lib/baslac-catalog-products.ts`;
       * test `lib/catalog/baslacDuplicates.test.mjs` obara build ako se ovaj
       * unos i ta mapa raziđu.
       */
      {
        source: "/proizvodi/baslac-35-m331-pasta",
        destination: "/proizvodi/baslac-35-m331",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
