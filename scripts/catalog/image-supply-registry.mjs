/**
 * Pravila registra dostavljenih slika (`supplied-images.json`) i metapodataka lock-a
 * (`manifest-lock.json`). Čista logika bez čitanja diska — koristi je
 * `scripts/catalog/image-supply-manifests.mjs`, a testira `image-supply-registry.test.mjs`.
 */

/** Šta zapis sa zvaničnog portala dobavljača mora da nosi da bi poreklo bilo proverljivo. */
export const PORTAL_SOURCE_DETAIL = Object.freeze([
  "portal",
  "portalUrl",
  "assetId",
  "assetTitle",
  "originalFile",
  "downloadedOn",
  "downloadMethod",
  "identityEvidence",
  "processingMethod",
  "ownerPermission",
]);

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * @param {{provenanceModel: Record<string, Record<string, string>>, images: Record<string, any>[]}} registry
 * @returns {string[]}
 */
export function validateSuppliedRegistry(registry) {
  const errors = [];
  for (const image of registry.images) {
    const at = `supplied-images.json: ${image.imageId}`;
    for (const field of ["sourceBasis", "processing", "rightsBasis"]) {
      if (!Object.hasOwn(registry.provenanceModel?.[field] ?? {}, image[field])) errors.push(`${at} — ${field} „${image[field]}” nije u provenanceModel.${field}`);
    }
    if ("alt" in image && (typeof image.alt !== "string" || !image.alt.trim())) errors.push(`${at} — alt mora biti neprazan tekst`);
    if (image.sourceBasis !== "SUPPLIER_BRAND_PORTAL") continue;

    const detail = image.sourceDetail ?? {};
    for (const field of PORTAL_SOURCE_DETAIL) if (detail[field] == null || detail[field] === "") errors.push(`${at} — sourceDetail.${field} nedostaje`);
    if (detail.originalFile && detail.originalFile !== image.sourceFile) errors.push(`${at} — sourceDetail.originalFile ≠ sourceFile`);
    if (detail.downloadedOn && !DATE.test(detail.downloadedOn)) errors.push(`${at} — downloadedOn nije YYYY-MM-DD`);
    if (!Number.isInteger(detail.assetId)) errors.push(`${at} — assetId mora biti broj asseta na portalu`);
    if (!image.batch) errors.push(`${at} — slika sa portala mora imati sopstveni batch`);
  }
  return errors;
}

export const LOCK_METADATA_NOTE =
  "generatedOn = datum kada je generator zapisao ovaj sadržaj. approvedAt i approvedBy upisuje čovek tek posle pregleda; generator ih ne popunjava (null = nije odobreno). Metapodaci nisu deo identiteta manifesta.";

/** Stari oblik (pre podele): `{ approvedAt, note }`, gde je `approvedAt` upisao generator. */
export function isLegacyLockMetadata(metadata) {
  return Boolean(metadata) && !("generatedOn" in metadata);
}

/**
 * Trag prethodnog sadržaja. Stari `approvedAt` je upisao generator, pa se čuva pod imenom koje
 * to i kaže — nikad kao ljudsko odobrenje. Lanac se ne ugnježđava (istorija je u Gitu).
 */
function previousTrace(previous) {
  const metadata = previous.metadata;
  if (isLegacyLockMetadata(metadata)) {
    return {
      legacyGeneratorDate: metadata.approvedAt ?? null,
      legacyNote: metadata.note ?? null,
      interpretation: "Stari oblik lock-a: datum je upisao generator; nije dokaz ljudskog odobrenja.",
      createdFromMainSha: previous.createdFromMainSha ?? null,
    };
  }
  return {
    generatedOn: metadata.generatedOn ?? null,
    approvedAt: metadata.approvedAt ?? null,
    approvedBy: metadata.approvedBy ?? null,
    createdFromMainSha: previous.createdFromMainSha ?? null,
  };
}

/**
 * Metapodaci novog lock-a. Nepromenjen sadržaj čuva postojeće metapodatke bajt-identično (i stari
 * oblik); promenjen sadržaj dobija samo datum generisanja, a odobrenje ostaje prazno.
 *
 * @param {{previous: {metadata?: any, createdFromMainSha?: string}|null, unchanged: boolean, today: string}} input
 */
export function nextLockMetadata({ previous, unchanged, today }) {
  if (unchanged && previous?.metadata) return previous.metadata;
  return {
    generatedOn: today,
    approvedAt: null,
    approvedBy: null,
    ...(previous?.metadata ? { previousLockMetadata: previousTrace(previous) } : {}),
    note: LOCK_METADATA_NOTE,
  };
}

/** Provera metapodataka: stari oblik je dozvoljen; u novom odobrenje mora biti potpuno. */
export function lockMetadataErrors(metadata) {
  if (!metadata || isLegacyLockMetadata(metadata)) return [];
  const errors = [];
  if (!metadata.generatedOn || !DATE.test(metadata.generatedOn)) errors.push("manifest-lock.json: generatedOn nije YYYY-MM-DD");
  if (Boolean(metadata.approvedAt) !== Boolean(metadata.approvedBy)) errors.push("manifest-lock.json: approvedAt i approvedBy se upisuju zajedno — odobrenje mora imati i datum i ko je odobrio");
  if (metadata.approvedAt && !DATE.test(metadata.approvedAt)) errors.push("manifest-lock.json: approvedAt nije YYYY-MM-DD");
  return errors;
}
