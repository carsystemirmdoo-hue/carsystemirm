/**
 * Read-only pristup STVARNOM runtime katalogu iz Node skripti i testova.
 *
 * Zašto postoji: validatori kataloga su ranije rekonstruisali populaciju
 * proizvoda — `scripts/validate-catalog-taxonomy.mjs` regexom nad
 * `lib/carsystem-data.ts`, `scripts/validate-catalog-listing.mjs` čitanjem samo
 * `data/cosmos-lac-products.generated.json`. Obe rekonstrukcije su tiho
 * odlutale od stvarnosti: nijedna nije videla 163 Baslac zapisa koje generiše
 * `lib/baslac-catalog-products.ts`, pa su validatori prolazili tvrdeći 832
 * proizvoda dok ih je runtime imao 991.
 *
 * Rešenje nije novi broj nego uklanjanje druge implementacije: ovaj modul
 * izvršava iste TypeScript module koje izvršava i javni sajt
 * (`lib/carsystem-data.ts`, `lib/product-families.ts`, `lib/catalog-listing.ts`)
 * i vraća njihov izlaz. Katalog koji se promeni ovde se vidi odmah, bez ijednog
 * ažuriranja očekivane vrednosti.
 *
 * Zašto CommonJS most a ne ESM loader: izvorni moduli uvoze JSON bez import
 * atributa (`import records from "@/data/....json"`). U ESM-u je to greška, u
 * CommonJS-u je običan `require`. Transpajliranje u CommonJS zato radi bez
 * ijedne izmene izvornog koda — a izvorni kod je ovde jedini autoritet.
 *
 * Modul je ISKLJUČIVO za build-time provere. Ne uvoziti ga iz `app/`,
 * `components/` ni `lib/` runtime koda.
 */

import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Ekstenzije koje `@/...` uvoz sme da razreši, redom kojim ih bundler pokušava. */
const RESOLVE_EXTENSIONS = [".ts", ".tsx", ".mjs", ".js", ".json"];

let hooksInstalled = false;

/**
 * Postavlja `@/*` alias i TypeScript transpajler na CommonJS `require`.
 *
 * Idempotentno: više poziva `loadCatalogRuntime()` u istom procesu ne sme da
 * ulanča hook nad hook.
 */
function installHooks() {
  if (hooksInstalled) return;
  hooksInstalled = true;

  const ts = require("typescript");
  const Module = require("node:module");
  const originalResolve = Module._resolveFilename;

  Module._resolveFilename = function resolveWithAlias(request, ...rest) {
    /*
     * `server-only` je marker paket sa `react-server` uslovnim izvozom. Pod
     * običnim `require`-om se bira `index.js`, koji namerno baca „cannot be
     * imported from a Client Component". Validator JESTE serverski kontekst,
     * pa se bira ista prazna grana koju bira i Next server build. Ovo ne
     * uklanja zaštitu iz aplikacije — hook postoji samo u ovom procesu.
     */
    if (request === "server-only") {
      return originalResolve.call(
        this,
        path.join(REPO_ROOT, "node_modules/server-only/empty.js"),
        ...rest,
      );
    }

    // `tsconfig.json` → paths: { "@/*": ["./*"] }
    const mapped = request.startsWith("@/")
      ? path.join(REPO_ROOT, request.slice(2))
      : request;

    try {
      return originalResolve.call(this, mapped, ...rest);
    } catch (error) {
      for (const extension of RESOLVE_EXTENSIONS) {
        if (existsSync(mapped + extension)) return mapped + extension;
      }
      throw error;
    }
  };

  const compile = (module_, filename) => {
    const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
      fileName: filename,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
        resolveJsonModule: true,
        jsx: ts.JsxEmit.React,
      },
    });
    module_._compile(outputText, filename);
  };

  require.extensions[".ts"] = compile;
  require.extensions[".tsx"] = compile;
}

/** @type {ReturnType<typeof build> | undefined} */
let cached;

function build() {
  installHooks();

  const carsystemData = require(path.join(REPO_ROOT, "lib/carsystem-data.ts"));
  const productFamilies = require(path.join(REPO_ROOT, "lib/product-families.ts"));
  const catalogListing = require(path.join(REPO_ROOT, "lib/catalog-listing.ts"));
  const variantView = require(
    path.join(REPO_ROOT, "components/product/productVariantView.ts"),
  );

  const products = carsystemData.getAllCarsystemProducts();
  const families = productFamilies.getAllProductFamilies();
  /** Slugovi proizvoda koje je porodica konsolidovala — dakle varijante. */
  const variantSlugs = productFamilies.getConsolidatedVariantSlugs();
  const listing = catalogListing.getCatalogListingData();

  return {
    products,
    families,
    variantSlugs,
    listing,
    brands: carsystemData.getAllCarsystemBrands(),
    /** `getFamilyForProduct` iz istog modula koji koristi sitemap i PDP. */
    getFamilyForProduct: productFamilies.getFamilyForProduct,
    familyPath: productFamilies.familyPath,
    /**
     * Ključ kojim PDP bira varijantu (`?varijanta=`). Uzima se iz stvarnog
     * modula, ne prepisuje — inače bi validator merio svoju formulu umesto
     * one koju korisnik zaista dobije u URL-u.
     */
    productVariantKey: variantView.productVariantKey,
    /**
     * Učitava bilo koji projektni TS/JS modul kroz iste hookove.
     *
     * Postoji da bi test mogao da izvrši STVARNU funkciju (npr.
     * `applyBaslacEnrichment`) umesto da proverava tekst izvornog fajla.
     *
     * @param {string} relativePath putanja od korena repozitorijuma
     */
    requireModule: (relativePath) => require(path.join(REPO_ROOT, relativePath)),
  };
}

/**
 * Stvarni katalog, isti onaj koji renderuje javni sajt.
 *
 * Keširano na nivou procesa jer su i sami moduli keširani — ponovni poziv bi
 * vratio identičan objekat, samo sporije.
 *
 * @returns {{
 *   products: any[],
 *   families: any[],
 *   variantSlugs: Set<string>,
 *   listing: { canonical: any[], variants: any[] },
 *   brands: any[],
 *   getFamilyForProduct: (product: any) => any,
 *   familyPath: (family: any) => string,
 * }}
 */
export function loadCatalogRuntime() {
  cached ??= build();
  return cached;
}

/**
 * Izmereni zbir stvarnog kataloga.
 *
 * Sve vrednosti su IZMERENE, nijedna nije očekivana — namerno, da bi provera
 * bila „da li se brojevi međusobno slažu“, a ne „da li se poklapaju sa
 * snapshotom od pre tri faze“. Poslovni ugovori (minimumi, zaključani izvori)
 * se drže odvojeno, u validatoru koji ih zaista tvrdi.
 *
 * @returns {{
 *   total: number, families: number, variants: number, standalone: number,
 *   byBrand: Record<string, number>, familiesByBrand: Record<string, number>,
 *   familiesByPresentation: Record<string, number>,
 * }}
 */
export function summarizeCatalogRuntime() {
  const { products, families, variantSlugs } = loadCatalogRuntime();

  /** @type {Record<string, number>} */
  const byBrand = {};
  for (const product of products) {
    byBrand[product.brandSlug] = (byBrand[product.brandSlug] ?? 0) + 1;
  }

  /** @type {Record<string, number>} */
  const familiesByBrand = {};
  /** @type {Record<string, number>} */
  const familiesByPresentation = {};
  for (const family of families) {
    familiesByBrand[family.brandSlug] = (familiesByBrand[family.brandSlug] ?? 0) + 1;
    familiesByPresentation[family.presentation] =
      (familiesByPresentation[family.presentation] ?? 0) + 1;
  }

  const variants = products.filter((product) => variantSlugs.has(product.slug)).length;

  return {
    total: products.length,
    families: families.length,
    variants,
    standalone: products.length - variants,
    byBrand: sortedByCountDesc(byBrand),
    familiesByBrand: sortedByCountDesc(familiesByBrand),
    familiesByPresentation: sortedByCountDesc(familiesByPresentation),
  };
}

/** Stabilan, čitljiv redosled izveštaja; ne utiče ni na jednu proveru. */
function sortedByCountDesc(counts) {
  return Object.fromEntries(
    Object.entries(counts).sort(
      ([firstKey, first], [secondKey, second]) =>
        second - first || firstKey.localeCompare(secondKey),
    ),
  );
}
