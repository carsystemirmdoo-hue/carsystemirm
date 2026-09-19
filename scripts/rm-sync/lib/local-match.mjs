/**
 * Poklapanje POSTOJEĆIH lokalnih R-M zapisa sa zvaničnim modelom.
 *
 * Lestvica dokaza: 1) zvanična oznaka doslovno u lokalnom IZVORU (`productCode` uvoza iz
 * dostavljene arhive ili oznaka u ručno pisanom nazivu); 2) linija + uloga sa jedinim
 * zvaničnim SISTEMOM; 3) naziv — samo pomoć, nikad spajanje. Dokaz se čita iz izvora
 * (generated JSON / lib/carsystem-data.ts), NE iz runtime-a posle obogaćivanja — inače bi
 * drugi prolaz video obogaćen zapis i klasifikovao ga drugačije (zamka idempotentnosti).
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { readJson } from "../../carsystem-sync/lib/http.mjs";
import { loadCatalogRuntime } from "../../lib/catalog-runtime.mjs";
import { REPO_ROOT } from "./config.mjs";
import { normalizeCode } from "./tds.mjs";

export function matchLocalProducts(source, syncSlugs = new Set()) {
  const imported = readJson(path.join(REPO_ROOT, "data/rm-imported-products.generated.json"));
  const handWritten = readFileSync(path.join(REPO_ROOT, "lib/carsystem-data.ts"), "utf8");
  const byCode = new Map(source.products.map((product) => [product.code, product]));
  const referencedOnly = new Set(source.referencedOnly.map((entry) => entry.code));
  const allProducts = loadCatalogRuntime().products;
  const runtime = allProducts.filter((product) => product.brandSlug === "rm" && !syncSlugs.has(product.slug));
  const importedBySlug = new Map(imported.products.map((entry) => [entry.slug, entry]));

  const LINES = [["AGILIS", /agilis/i], ["ONYX HD", /onyx/i], ["DIAMONT", /diamont/i], ["UNO HD", /uno hd/i], ["GRAPHITE HD", /graphite|\bghd\b/i]];
  const ROLE_WORDS = [["basecoat-topcoat", /bazn|basecoat/i], ["clearcoat", /bezbojni lak|clear/i], ["bodyfiller", /body filler|kit\b|git\b/i], ["undercoat", /prajmer|filer|primer|filler/i]];

  const matches = runtime.map((product) => {
    const entry = importedBySlug.get(product.slug);
    const origin = entry ? "generated:rm-imported-products" : "manual:lib/carsystem-data.ts";
    // Ručni zapis: naziv iz izvornog fajla (runtime ume da ga promeni obogaćivanjem).
    const block = entry ? "" : handWritten.slice(handWritten.indexOf(`slug: "${product.slug}"`), handWritten.indexOf(`slug: "${product.slug}"`) + 600);
    const writtenName = entry ? entry.canonicalName : /name: "([^"]+)"/.exec(block)?.[1] ?? product.name;
    const literalCodes = entry?.productCode ? [normalizeCode(entry.productCode)] : [...writtenName.toUpperCase().matchAll(/\b([A-Z]{1,2}) ?(\d[A-Z]\d{2,3}[A-Z]{0,2}|\d{3,4}[A-Z]?)\b/g)].map((found) => normalizeCode(`${found[1]} ${found[2]}`));
    const onPortal = literalCodes.filter((code) => byCode.has(code));

    let classification; let officialCodes = []; let evidence;
    if (onPortal.length === 1) {
      const official = byCode.get(onPortal[0]);
      classification = "EXACT_MATCH";
      officialCodes = [official.code];
      evidence = `zvanična oznaka „${official.code}” doslovno u lokalnom izvoru; portal: ${official.officialName}`;
    } else if (literalCodes.length && literalCodes.every((code) => referencedOnly.has(code))) {
      classification = "LEGACY_LOCAL_ONLY";
      evidence = `oznaka „${literalCodes.join(", ")}” postoji samo kao pomen u tuđem TDS-u; nema svoju stranicu ni TDS na zvaničnim izvorima`;
    } else if (literalCodes.length) {
      classification = "LEGACY_LOCAL_ONLY";
      evidence = `oznaka „${literalCodes.join(", ")}” nije na info.rmpaint.com ni na rmpaint.com/en-int`;
    } else {
      const line = LINES.find(([, pattern]) => pattern.test(writtenName))?.[0] ?? null;
      const role = ROLE_WORDS.find(([, pattern]) => pattern.test(writtenName))?.[0] ?? null;
      const candidates = source.products.filter((official) => line && official.line === line && (!role || official.role === role) && !/ var CV$/.test(official.code));
      const systems = candidates.filter((official) => official.kind === "system");
      if (line && role && systems.length === 1) {
        classification = "HIGH_CONFIDENCE_MATCH";
        officialCodes = [systems[0].code];
        evidence = `linija ${line} + uloga ${role} imaju jedan jedini zvanični SISTEM („${systems[0].officialName}”); lokalni zapis nema oznaku`;
      } else if (candidates.length) {
        classification = "PROBABLE_MATCH";
        officialCodes = candidates.map((official) => official.code);
        evidence = `linija ${line}${role ? ` + uloga ${role}` : ""}: ${candidates.length} kandidata, bez oznake se ne može odlučiti`;
      } else {
        classification = "LEGACY_LOCAL_ONLY";
        evidence = line ? `linija ${line} postoji, ali nijedan zvanični proizvod te uloge (${role ?? "nepoznata"})` : "bez oznake i bez linije; nema zvaničnog proizvoda tog naziva";
      }
    }
    const docs = (product.documents ?? []).filter((document) => document.status === "available");
    return {
      slug: product.slug,
      name: writtenName,
      origin,
      sku: product.sku ?? null,
      placeholderSku: /^RM-/.test(product.sku ?? ""),
      image: product.productImage?.src ?? null,
      localDocuments: docs.length,
      classification,
      officialCodes,
      officialStatus: officialCodes.map((code) => byCode.get(code)?.status),
      evidence,
    };
  });
  return { matches, allSlugs: new Set(allProducts.map((product) => product.slug)) };
}
