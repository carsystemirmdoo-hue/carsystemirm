#!/usr/bin/env node
/**
 * Norbin sync, korak 2 — od RAW izvora do MODELA. Ne menja katalog.
 *
 * Pravila (utvrđena u auditu):
 *   1. CURRENT je šifra koju AKTUELNA stranica opsega LINKUJE. Zakomentarisan link je
 *      proizvođačeva odluka da proizvod ne objavi → `unlinked-in-source`, nikad ponuda.
 *   2. Referentni region je `en` (EMEA). Turski i kazahstanski nazivi se koriste samo kada
 *      engleskog nema, i tada se region beleži uz naziv.
 *   3. Zvanična šifra (`N15-020`) je identitet proizvoda. Brojeva artikala nema nigde na
 *      izvoru — pakovanje je varijanta, ne identitet.
 *   4. Proizvod bez tehničkog lista NIJE izostavljen: pet učvršćivača/razređivača EMEA
 *      programa ima samo bezbednosni list, i to je njihovo stvarno stanje.
 *   5. Činjenice i odnosi se čitaju iz COMMITOVANOG izvlačenja tehničkih listova
 *      (`data/knowledge/norbin-tds-claims.generated.json`) — PDF-ovi su van repozitorijuma
 *      (`assets/manufacturer/` je gitignore-ovan), pa je taj fajl jedini deterministički ulaz.
 */

import { readJson, writeJson } from "../carsystem-sync/lib/http.mjs";
import { FAMILY_BY_PREFIX, PATHS, REFERENCE_REGION } from "./lib/config.mjs";

const website = readJson(PATHS.rawWebsite);
const claims = readJson(PATHS.knowledgeClaims, { records: [] });
if (!website) throw new Error("Nedostaje RAW sajt — `node scripts/norbin-sync/acquire-website.mjs`.");

const roleOf = (code) => FAMILY_BY_PREFIX.find(([pattern]) => pattern.test(code))?.[1] ?? "other";

/**
 * Higijena tvrdnji iz avgustovskog izvlačenja.
 *
 * Dve greške tog koraka se ovde ne prenose dalje: odsečen fragment koji počinje interpunkcijom
 * („, good hardness, fast drying.") i podrazumevana jedinica `s` koja se ne pojavljuje u samoj
 * vrednosti. Tvrdnja se ne „popravlja" — ili je upotrebljiva doslovno, ili se izostavlja.
 */
const DESCRIPTIVE_FIELDS = new Set(["intendedUse", "keyFeatures", "substrate", "note", "sandability", "otherSpecification"]);
function usableClaim(claim) {
  const value = String(claim.value ?? "").trim();
  if (value.length < 2 || !/^[\p{L}\p{N}]/u.test(value)) return false;
  // Merna tvrdnja bez ijednog broja je odsečen fragment („humidity and hardener type.").
  return DESCRIPTIVE_FIELDS.has(claim.field) || /\d/.test(value);
}
/** Jedinica važi samo ako u vrednosti stvarno stoji UZ broj; inače je podrazumevana greška. */
const usableUnit = (claim) => {
  const unit = claim.unit ? String(claim.unit) : null;
  if (!unit) return null;
  const pattern = new RegExp(`\\d\\s*${unit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}])`, "iu");
  return pattern.test(String(claim.value ?? "")) ? unit : null;
};

/** Tvrdnje i odnosi po šifri; engleski list ima prednost nad regionalnim prevodom. */
const claimsByCode = new Map();
for (const record of claims.records) {
  if (!record.code) continue;
  const english = !/TDS__TR__|_RUS/.test(record.documentFileName);
  const existing = claimsByCode.get(record.code);
  if (!existing || (english && !existing.english) || (english === existing.english && record.claims.length > existing.record.claims.length)) {
    claimsByCode.set(record.code, { english, record });
  }
}
const relationsByCode = new Map();
for (const record of claims.records) {
  for (const relation of record.relationships ?? []) {
    const owner = record.code;
    if (!owner || !relation.partnerCode || relation.partnerCode === owner) continue;
    const list = relationsByCode.get(owner) ?? new Map();
    // Ista veza dolazi i iz engleskog i iz turskog lista — pamti se jednom, sa odnosom.
    if (!list.has(relation.partnerCode) || (!list.get(relation.partnerCode).ratio && relation.ratio)) {
      list.set(relation.partnerCode, { partnerCode: relation.partnerCode, ratio: relation.ratio ?? null, evidenceFile: record.documentFileName });
    }
    relationsByCode.set(owner, list);
  }
}

const known = new Set(website.products.map((product) => product.code));

const products = website.products.map((product) => {
  const liveDocuments = product.documents.filter((document) => document.availability === "live");
  const tds = liveDocuments.filter((document) => document.kind === "tds");
  const sds = liveDocuments.filter((document) => document.kind === "sds");
  const preferred = (list) => list.find((document) => document.region === REFERENCE_REGION) ?? list[0] ?? null;

  const nameRegion = [REFERENCE_REGION, ...product.regions.filter((region) => region !== REFERENCE_REGION)].find(
    (region) => product.names[region] || product.namesFromSds[region],
  );
  const officialName = nameRegion ? product.names[nameRegion] ?? product.namesFromSds[nameRegion] : null;

  const role = roleOf(product.code);
  const fromClaims = claimsByCode.get(product.code)?.record ?? null;
  const relations = [...(relationsByCode.get(product.code)?.values() ?? [])].map((relation) => ({
    ...relation,
    partnerRole: roleOf(relation.partnerCode),
    partnerKnownOnSite: known.has(relation.partnerCode),
  }));
  const usedBy = [...relationsByCode.entries()]
    .filter(([, list]) => list.has(product.code))
    .map(([owner, list]) => ({ code: owner, ratio: list.get(product.code).ratio ?? null, knownOnSite: known.has(owner) }));

  const status = !product.liveRegions.length
    ? "UNLINKED_IN_SOURCE"
    : product.liveRegions.includes(REFERENCE_REGION)
      ? "CURRENT_EMEA"
      : "CURRENT_OTHER_REGION";

  return {
    code: product.code,
    sourceKey: product.code.toLowerCase(),
    officialName,
    officialNameRegion: nameRegion ?? null,
    officialNameSource: nameRegion ? (product.names[nameRegion] ? "tds-link" : "sds-link") : null,
    role,
    status,
    regions: product.regions,
    liveRegions: product.liveRegions,
    packs: product.packs,
    documents: {
      tds: preferred(tds) ? { href: preferred(tds).href, file: preferred(tds).file, region: preferred(tds).region, tokenizedUrl: Boolean(preferred(tds).tokenizedUrl) } : null,
      tdsAllRegions: tds.map((document) => ({ region: document.region, file: document.file })),
      sds: sds.map((document) => ({ region: document.region, pack: document.pack, href: document.href })),
      unlinked: product.documents.filter((document) => document.availability !== "live").map((document) => ({ kind: document.kind, file: document.file })),
    },
    technical: fromClaims
      ? {
          documentFileName: fromClaims.documentFileName,
          documentSha256: fromClaims.documentSha256,
          documentSourceUrl: fromClaims.documentSourceUrl,
          count: fromClaims.claims.length,
          fields: [...new Set(fromClaims.claims.map((claim) => claim.field))].sort(),
          /*
           * Same tvrdnje, doslovno kako su izvučene: polje, vrednost, jedinica, uslov,
           * vezanost za opremu i strana. To je jedini dozvoljeni ulaz za SR tekst.
           */
          claims: fromClaims.claims
            .filter(usableClaim)
            .map((claim) => ({
            field: claim.field,
            sourceLabel: claim.sourceLabel ?? null,
            value: claim.value,
            unit: usableUnit(claim),
            condition: claim.condition ?? null,
            equipment: claim.equipment ?? null,
            page: claim.page ?? null,
          })),
        }
      : null,
    relations,
    usedBy,
    officialImage: null,
  };
});

const count = (predicate) => products.filter(predicate).length;
const emea = products.filter((product) => product.status === "CURRENT_EMEA");
writeJson(PATHS.source, {
  meta: {
    rule: "CURRENT = link na aktuelnoj stranici opsega; zakomentarisan link nije ponuda",
    referenceRegion: REFERENCE_REGION,
    crawledAt: website.meta.crawledAt,
    branding: "BASF Coatings GmbH (izvor nije prešao na Surventis)",
    note: "Brojeva artikala nema na izvoru; pakovanje je varijanta, ne identitet. Slika proizvoda izvor nema.",
  },
  summary: {
    TOTAL_CODES: products.length,
    CURRENT_EMEA: emea.length,
    CURRENT_OTHER_REGION: count((product) => product.status === "CURRENT_OTHER_REGION"),
    UNLINKED_IN_SOURCE: count((product) => product.status === "UNLINKED_IN_SOURCE"),
    byRole: Object.fromEntries([...new Set(emea.map((product) => product.role))].sort().map((role) => [role, emea.filter((product) => product.role === role).length])),
    emeaWithTds: emea.filter((product) => product.documents.tds).length,
    emeaWithoutTds: emea.filter((product) => !product.documents.tds).length,
    emeaWithClaims: emea.filter((product) => product.technical).length,
    emeaClaims: emea.reduce((sum, product) => sum + (product.technical?.count ?? 0), 0),
    emeaPackVariants: emea.reduce((sum, product) => sum + product.packs.length, 0),
    relations: products.reduce((sum, product) => sum + product.relations.length, 0),
    relationsToUnlistedCode: products.flatMap((product) => product.relations.filter((relation) => !relation.partnerKnownOnSite).map((relation) => `${product.code}→${relation.partnerCode}`)),
    officialImages: 0,
  },
  products,
});
console.log(JSON.stringify(readJson(PATHS.source).summary, null, 1));
