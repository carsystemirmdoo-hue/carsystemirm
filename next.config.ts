import type { NextConfig } from "next";
import removedFromCustomerCatalog from "./data/catalog/removed-from-customer-catalog.json";
import cosmosLacSync from "./data/cosmos-lac-catalog-products.generated.json";
import {
  noStoreHeaders,
  NO_STORE_PATHS,
  securityHeaders,
} from "./lib/security/http-headers.mjs";

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  /*
   * Ugovor je OBIČAN FAJL i mora otputovati sa buildom.
   *
   * `lib/sync/contract/validate.mjs` ga čita sa diska, namerno — da bi ostao
   * čitljiv i van ovog projekta (konektor, tuđi alat, ručna provera), a ne
   * artefakt bundlera. Bez ovog traga bi lokalni build prošao, a `/api/sync/*`
   * u produkciji pao na prvom zahtevu: fajla tamo ne bi bilo.
   */
  outputFileTracingIncludes: {
    "/api/sync/ingest": ["./contracts/invoice-ingest/v1/schema.json"],
    /*
     * Rute komandi ne citaju ugovor, ali dele modul koji ga ucitava pri
     * ucitavanju (`lib/sync/contract/validate.mjs`). Bez traga bi lokalni build
     * prosao, a produkcija pala na prvom zahtevu.
     */
    "/api/sync/commands/poll": ["./contracts/invoice-ingest/v1/schema.json"],
    "/api/sync/commands/update": ["./contracts/invoice-ingest/v1/schema.json"],
  },
  /*
   * `public/` se NE pakuje u serverless funkciju.
   *
   * Brend stranice (`components/*-brand/*Media.server.ts`) proveravaju da li je
   * opcioni medij isporučen: `existsSync(join(process.cwd(), "public", src))`.
   * Putanja je dinamička, pa file tracing ne zna koji fajl se čita i u funkciju
   * `brendovi/[slug]` povuče CEO `public/` (~250 MB). Vercel je zato odbio
   * deployment čim je katalog slika prešao granicu od 250 MB po funkciji.
   *
   * Provera se izvršava pri prerenderu (build), gde `public/` postoji; u
   * produkciji te fajlove služi CDN, ne funkcija. `npm run build:trace-check`
   * čuva ovo pravilo za sve rute.
   */
  outputFileTracingExcludes: {
    "/brendovi/*": ["./public/**/*"],
  },
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
      /*
       * Tehnička dokumentacija proizvoda se ne indeksira.
       *
       * Pravilo je ranije pokrivalo samo R-M, jer je R-M bio jedini brend sa
       * dokumentima. Posle sinhronizacije kataloga pod `/documents/products/`
       * stoje i baslac i Carsystem tehnički listovi — ista klasa dokumenta, pa
       * i ista politika. Listovi ponavljaju sadržaj PDP-a i ne treba da se
       * takmiče s njim u rezultatima; `follow` čuva prenos linkova.
       */
      {
        source: "/documents/products/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, follow",
          },
        ],
      },
      /*
       * Brošure su prateći marketinški materijal za proizvode koji već imaju
       * svoju stranicu (Polish X serija, brusni blokovi, CC.26, Multi Changer).
       * Kao samostalan rezultat pretrage su tanke i dupliraju PDP.
       *
       * Katalozi (`/documents/:brand/catalogs/`) namerno OSTAJU indeksabilni:
       * to su obimni zvanični dokumenti (42–110 strana) čiji sadržaj ne postoji
       * na sajtu i koji odgovaraju stvarnoj nameri pretrage „katalog".
       */
      {
        source: "/documents/:brand/brochures/:path*",
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
      /*
       * Zapisi uklonjeni iz customer-facing kataloga (`data/catalog/removed-from-customer-catalog.json`).
       *
       * Isti fajl koji filtrira runtime daje i odredišta, pa adresa ne može da ostane bez
       * preusmerenja niti da pokaže na nešto što nije odobreno. Trajno (308) — proizvod se više
       * ne nudi, a odredište je brend program osim gde postoji dokazan naslednik.
       */
      ...removedFromCustomerCatalog.records.map((record) => ({
        source: `/proizvodi/${record.slug}`,
        destination: record.redirect,
        permanent: true,
      })),
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
      /*
       * Cosmos Lac: porodične adrese kartica koje je sync podelio po zvaničnom proizvodu
       * (`npm run cosmos-lac:sync`). Izvor istine je `redirects` u generisanom datasetu — pravila sa
       * `?varijanta=` vode na tu varijantu, a gola adresa na katalog sa naslednicima. Test
       * `scripts/cosmos-lac-sync/cosmos-lac-sync.test.mjs` čuva da nijedna stara adresa ne ostane bez odredišta.
       */
      ...(cosmosLacSync.redirects as {
        source: string;
        destination: string;
        permanent: boolean;
        has?: { type: "query"; key: string; value: string }[];
      }[]),
    ];
  },
};

export default nextConfig;
