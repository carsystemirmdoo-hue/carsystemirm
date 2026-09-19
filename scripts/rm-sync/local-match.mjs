#!/usr/bin/env node
/**
 * R-M sync — poklapanje POSTOJEĆIH lokalnih R-M zapisa sa zvaničnim modelom (samo izveštaj).
 *
 * Lestvica dokaza: 1) zvanična oznaka proizvoda doslovno prisutna u lokalnom izvoru
 * (`productCode` uvoza iz dostavljene arhive, ili oznaka u ručno pisanom nazivu);
 * 2) linija + uloga sa jedinim kandidatom; 3) naziv — samo kao pomoć, nikad za spajanje.
 * Dokaz se čita iz IZVORA (generated JSON / lib/carsystem-data.ts), ne iz runtime-a.
 */

import { readJson, writeJson } from "../carsystem-sync/lib/http.mjs";
import { PATHS } from "./lib/config.mjs";
import { matchLocalProducts } from "./lib/local-match.mjs";

const source = readJson(PATHS.source);
const registry = readJson(PATHS.identityRegistry, { products: {} });
const { matches } = matchLocalProducts(source, new Set(Object.keys(registry.products)));

const localCodes = new Set(matches.filter((match) => match.classification === "EXACT_MATCH").flatMap((match) => match.officialCodes));
const count = (label) => matches.filter((match) => match.classification === label).length;
writeJson(PATHS.localAudit, {
  summary: {
    LOCAL_RM_PRODUCTS: matches.length,
    GENERATED_PRODUCTS: matches.filter((match) => match.origin.startsWith("generated")).length,
    MANUAL_PRODUCTS: matches.filter((match) => match.origin.startsWith("manual")).length,
    PLACEHOLDER_SKUS: matches.filter((match) => match.placeholderSku).length,
    EXACT_MATCH: count("EXACT_MATCH"),
    HIGH_CONFIDENCE_MATCH: count("HIGH_CONFIDENCE_MATCH"),
    PROBABLE_MATCH: count("PROBABLE_MATCH"),
    LEGACY_LOCAL_ONLY: count("LEGACY_LOCAL_ONLY"),
    officialProducts: source.products.length,
    officialAlreadyLocal: localCodes.size,
    officialMissingLocally: source.products.filter((product) => !localCodes.has(product.code)).length,
    duplicateLocalForOneCode: [...localCodes].filter((code) => matches.filter((match) => match.officialCodes.includes(code) && match.classification === "EXACT_MATCH").length > 1),
  },
  matches,
  officialMissingLocally: source.products.filter((product) => !localCodes.has(product.code)).map((product) => ({ code: product.code, name: product.officialName, kind: product.kind, role: product.role, series: product.series, hasImage: Boolean(product.image), hasTds: Boolean(product.tds) })),
});
console.log(JSON.stringify(readJson(PATHS.localAudit).summary, null, 1));
for (const match of matches.filter((entry) => entry.classification !== "EXACT_MATCH")) console.log(`${match.classification} · ${match.slug} · ${match.evidence}`);
