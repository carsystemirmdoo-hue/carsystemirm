/**
 * Očekivani model search indeksa, iz TRENUTNIH izvora.
 *
 * Validator (`scripts/validate-catalog-search-index.mjs`) je plain Node skript i
 * ne može da uveze TypeScript modele kataloga. Ranije je zato model
 * rekonstruisao iz Cosmos JSON-a, pa nije poznavao Baslac porodice ni
 * `?varijanta=` rute. Ovaj skript se pokreće kroz `tsx` i štampa sažetak koji
 * validator poredi sa serviranim indeksom — ista implementacija
 * (`getProductSearchIndex`) koju koristi ruta, ali iz izvora, ne iz build-a.
 *
 * Usage: node --conditions=react-server node_modules/tsx/dist/cli.mjs --tsconfig tsconfig.json scripts/qa/print-search-model.mts
 */
import { getProductSearchIndex } from "../../lib/search/buildSearchIndex";
import { getCatalogListingData } from "../../lib/catalog-listing";

const index = getProductSearchIndex();
const listing = getCatalogListingData();

process.stdout.write(
  JSON.stringify({
    schemaVersion: index.schemaVersion,
    counts: index.counts,
    canonicalHrefs: Object.fromEntries(listing.canonical.map((entity) => [entity.id, entity.href])),
    records: index.records.map((record) => ({
      id: record.id,
      kind: record.kind,
      href: record.href,
      familySlug: record.familySlug ?? null,
    })),
  }),
);
