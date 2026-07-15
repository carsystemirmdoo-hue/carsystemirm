import fs from "node:fs/promises";
import path from "node:path";

export const REVIEW_COLUMNS = [
  "source_status",
  "source_bex_contact_id",
  "source_name",
  "source_address",
  "source_address_2",
  "source_legal_entity",
  "source_pib",
  "normalized_name",
  "normalized_address",
  "city",
  "street_and_number",
  "entity_kind",
  "risk_flags",
  "possible_duplicate_contact_ids",
  "duplicate_class",
  "merge_confidence",
  "proposed_type",
  "address_precision",
  "review_status",
  "duplicate_resolution",
  "merge_target_id",
  "public_location_id",
  "display_name",
  "public_address",
  "public_city",
  "type",
  "verification_status",
  "is_public",
  "geocoding_approved",
  "latitude",
  "longitude",
  "coordinate_status",
  "geocode_importance",
  "geocode_match_name",
  "phone",
  "working_hours",
  "available_brands",
  "public_notes",
  "internal_note",
  "analysis_note",
];

export const MANUAL_REVIEW_COLUMNS = [
  "review_status",
  "duplicate_resolution",
  "merge_target_id",
  "public_location_id",
  "display_name",
  "public_address",
  "public_city",
  "type",
  "verification_status",
  "is_public",
  "geocoding_approved",
  "latitude",
  "longitude",
  "coordinate_status",
  "geocode_importance",
  "geocode_match_name",
  "phone",
  "working_hours",
  "available_brands",
  "public_notes",
  "internal_note",
];

export const PUBLIC_LOCATION_TYPES = new Set([
  "store",
  "service",
  "store_and_service",
  "partner",
  "warehouse",
  "unknown",
]);

export const PUBLIC_LOCATION_KEYS = new Set([
  "id",
  "name",
  "address",
  "city",
  "latitude",
  "longitude",
  "type",
  "verificationStatus",
  "coordinateStatus",
  "isPublic",
  "alternativeNames",
  "phone",
  "workingHours",
  "availableBrands",
  "notes",
]);

const CYRILLIC_TO_LATIN = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  ђ: "dj",
  е: "e",
  ж: "z",
  з: "z",
  и: "i",
  ј: "j",
  к: "k",
  л: "l",
  љ: "lj",
  м: "m",
  н: "n",
  њ: "nj",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  ћ: "c",
  у: "u",
  ф: "f",
  х: "h",
  ц: "c",
  ч: "c",
  џ: "dz",
  ш: "s",
};

const GENERIC_NAME_TOKENS = new Set([
  "auto",
  "autolak",
  "autolimar",
  "autolomar",
  "boja",
  "boje",
  "car",
  "centar",
  "color",
  "kolor",
  "mix",
  "profesional",
  "professional",
  "servis",
]);

const LEGACY_GENERATED_VALUES = {
  coordinate_status: "not_geocoded",
  geocoding_approved: "false",
  is_public: "false",
  review_status: "unreviewed",
  type: "unknown",
  verification_status: "pending",
};

const AUTO_DUPLICATE_RESOLUTIONS = new Set([
  "auto_merged_preview",
  "auto_primary_preview",
]);

function collapseWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}

export function latinize(value) {
  const cyrillicMapped = value
    .toLocaleLowerCase("sr-Latn")
    .split("")
    .map((character) => CYRILLIC_TO_LATIN[character] ?? character)
    .join("")
    .replaceAll("đ", "dj");

  return cyrillicMapped
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function normalizeName(value) {
  const punctuationRemoved = latinize(value)
    .replaceAll("&", " i ")
    .replace(/[^a-z0-9]+/g, " ");

  return collapseWhitespace(
    punctuationRemoved.replace(
      /\bd\s*o\s*o\b|\bo\s*d\b|\bp\s*r\b|\bs\s*t\s*r\b|\bpreduzetnik\b/g,
      " ",
    ),
  );
}

export function parseAddress(value, address2 = "") {
  const original = collapseWhitespace([value, address2].filter(Boolean).join(" "));
  const separatorIndex = original.indexOf(".");
  const city = collapseWhitespace(
    separatorIndex >= 0 ? original.slice(0, separatorIndex) : "",
  );
  const streetAndNumber = collapseWhitespace(
    separatorIndex >= 0 ? original.slice(separatorIndex + 1) : original,
  );

  return { city, original, streetAndNumber };
}

export function normalizeAddress(value, address2 = "") {
  const { original } = parseAddress(value, address2);

  return collapseWhitespace(
    latinize(original)
      .replace(/\((\d+)\.?\)/g, " $1 ")
      .replace(/\b0\s*\/\s*bb\b|\bbb\b|\b0\b/g, " bb ")
      .replace(/[^a-z0-9]+/g, " "),
  );
}

export function getAddressPrecision(value, address2 = "") {
  const { city, streetAndNumber } = parseAddress(value, address2);
  const normalizedStreet = latinize(streetAndNumber);
  const hasPlaceholderNumber = /(?:^|\s)(?:bb|0(?:\s*\/\s*bb)?)(?:$|\s|,)/i.test(
    normalizedStreet,
  );
  const hasUsableNumber = /\b(?!0\b)\d+[a-z]?(?:\/[a-z0-9]+)?\b/i.test(
    normalizedStreet,
  );

  if (!city || !streetAndNumber) return "incomplete";
  if (hasPlaceholderNumber || !hasUsableNumber) return "imprecise";
  return "usable_for_review";
}

export function isPlaceholderPib(value) {
  const normalized = value.trim();
  return !normalized || normalized === "0" || /^0+$/.test(normalized);
}

function levenshteinDistance(left, right) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current.push(
        Math.min(
          current[rightIndex - 1] + 1,
          previous[rightIndex] + 1,
          previous[rightIndex - 1] +
            (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
        ),
      );
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[right.length];
}

export function nameSimilarity(left, right) {
  if (!left && !right) return 1;
  const length = Math.max(left.length, right.length, 1);
  return 1 - levenshteinDistance(left, right) / length;
}

function hasDistinctiveTokenOverlap(left, right) {
  const leftTokens = new Set(
    left.split(" ").filter((token) => token.length >= 4 && !GENERIC_NAME_TOKENS.has(token)),
  );
  const rightTokens = new Set(
    right.split(" ").filter((token) => token.length >= 4 && !GENERIC_NAME_TOKENS.has(token)),
  );

  return [...leftTokens].some((token) => rightTokens.has(token));
}

function distinctiveNameSignature(value) {
  return value
    .split(" ")
    .filter(
      (token) =>
        token.length >= 3 &&
        !GENERIC_NAME_TOKENS.has(token) &&
        !/^\d+$/.test(token),
    )
    .sort((left, right) => left.localeCompare(right, "sr-Latn"))
    .join(" ");
}

function hasSameDistinctiveSignature(left, right) {
  const leftSignature = distinctiveNameSignature(left);
  const rightSignature = distinctiveNameSignature(right);
  return Boolean(leftSignature) && leftSignature === rightSignature;
}

export function findDuplicateCandidates(records) {
  const results = new Map(
    records.map((record) => [
      record.source_bex_contact_id,
      { candidates: [], duplicateClass: "none", mergeConfidence: "none" },
    ]),
  );
  const pairs = [];

  for (let leftIndex = 0; leftIndex < records.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < records.length; rightIndex += 1) {
      const left = records[leftIndex];
      const right = records[rightIndex];
      const sameAddress =
        Boolean(left.normalized_address) &&
        left.normalized_address === right.normalized_address;
      const sameName =
        Boolean(left.normalized_name) && left.normalized_name === right.normalized_name;
      const similarity = nameSimilarity(left.normalized_name, right.normalized_name);
      const sameDistinctiveSignature = hasSameDistinctiveSignature(
        left.normalized_name,
        right.normalized_name,
      );
      const similarName =
        !sameName &&
        (similarity >= 0.88 ||
          (similarity >= 0.75 &&
            hasDistinctiveTokenOverlap(left.normalized_name, right.normalized_name)));

      if (!sameAddress && !sameName && !similarName) continue;

      let duplicateClass = "similar_name_different_address";
      let mergeConfidence = "low";
      if (sameAddress && (sameName || similarName || sameDistinctiveSignature)) {
        duplicateClass = "probable_duplicate";
        mergeConfidence = "high";
      } else if (sameAddress) {
        duplicateClass = "same_address_uncertain";
        mergeConfidence = "medium";
      } else if (sameName) {
        duplicateClass = "same_name_different_address";
        mergeConfidence = "medium";
      }

      pairs.push({
        duplicateClass,
        leftId: left.source_bex_contact_id,
        mergeConfidence,
        rightId: right.source_bex_contact_id,
        sameAddress,
        sameDistinctiveSignature,
        sameName,
        similarity,
      });

      for (const [record, candidate] of [
        [left, right],
        [right, left],
      ]) {
        const result = results.get(record.source_bex_contact_id);
        result.candidates.push(candidate.source_bex_contact_id);

        const priority = { none: 0, low: 1, medium: 2, high: 3 };
        if (priority[mergeConfidence] > priority[result.mergeConfidence]) {
          result.duplicateClass = duplicateClass;
          result.mergeConfidence = mergeConfidence;
        }
      }
    }
  }

  for (const result of results.values()) {
    result.candidates = [...new Set(result.candidates)].sort();
  }

  return { pairs, results };
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        value += character;
      }
      continue;
    }

    if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(value);
      value = "";
    } else if (character === "\n") {
      row.push(value.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }

  if (quoted) throw new Error("CSV contains an unclosed quoted field.");
  if (value || row.length > 0) {
    row.push(value.replace(/\r$/, ""));
    rows.push(row);
  }

  return rows;
}

function escapeCsvValue(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function serializeCsv(rows, columns = REVIEW_COLUMNS) {
  return [
    columns.map(escapeCsvValue).join(","),
    ...rows.map((row) => columns.map((column) => escapeCsvValue(row[column])).join(",")),
  ].join("\r\n");
}

export function csvRowsToObjects(rows) {
  if (rows.length === 0) return [];
  const headers = rows[0].map((value) => value.trim());

  return rows.slice(1).filter((row) => row.some((value) => value.trim())).map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])),
  );
}

export async function readCsvObjects(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  return csvRowsToObjects(parseCsv(text.replace(/^\uFEFF/, "")));
}

export async function writeFileAtomic(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp`;
  await fs.writeFile(temporaryPath, content, "utf8");
  await fs.rename(temporaryPath, filePath);
}

export function parseBexExport(text) {
  const rows = parseCsv(text.replace(/^\uFEFF/, ""));
  const headerIndex = rows.findIndex((row) => {
    const normalized = row.map((value) => value.trim().toLocaleLowerCase("sr-Latn"));
    return normalized.includes("klijent") && normalized.includes("adresa") && normalized.includes("sifra");
  });

  if (headerIndex < 0) {
    throw new Error("BEX CSV header was not found. Expected Klijent, Adresa and Sifra columns.");
  }

  const header = rows[headerIndex].map((value) => value.trim());
  const indexOf = (name) => header.findIndex((value) => value === name);
  const indexes = {
    address: indexOf("Adresa"),
    address2: indexOf("Adresa 2"),
    bexId: indexOf("Sifra"),
    legalEntity: indexOf("Pravno lice"),
    name: indexOf("Klijent"),
    pib: indexOf("PIB."),
  };

  if (Object.values(indexes).some((index) => index < 0)) {
    throw new Error(`BEX CSV is missing a required column: ${JSON.stringify(indexes)}`);
  }

  const invalidRows = [];
  const records = [];
  let blankRowsAfterHeader = 0;

  rows.slice(headerIndex + 1).forEach((row, offset) => {
    if (!row.some((value) => value.trim())) {
      blankRowsAfterHeader += 1;
      return;
    }

    const sourceName = row[indexes.name]?.trim() ?? "";
    const sourceAddress = row[indexes.address]?.trim() ?? "";
    const sourceAddress2 = row[indexes.address2]?.trim() ?? "";
    const sourceBexContactId = row[indexes.bexId]?.trim() ?? "";

    if (!sourceName || !sourceAddress || !sourceBexContactId) {
      invalidRows.push({
        line: headerIndex + offset + 2,
        reason: "missing name, address or BEX contact ID",
      });
      return;
    }

    const parsedAddress = parseAddress(sourceAddress, sourceAddress2);
    records.push({
      source_status: "active",
      source_bex_contact_id: sourceBexContactId,
      source_name: sourceName,
      source_address: sourceAddress,
      source_address_2: sourceAddress2,
      source_legal_entity: row[indexes.legalEntity]?.trim() ?? "",
      source_pib: row[indexes.pib]?.trim() ?? "",
      normalized_name: normalizeName(sourceName),
      normalized_address: normalizeAddress(sourceAddress, sourceAddress2),
      city: parsedAddress.city,
      street_and_number: parsedAddress.streetAndNumber,
    });
  });

  const ids = records.map((record) => record.source_bex_contact_id);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicateIds.length > 0) {
    throw new Error(`Duplicate BEX contact IDs found: ${[...new Set(duplicateIds)].join(", ")}`);
  }

  return {
    blankRows: rows.filter((row) => !row.some((value) => value.trim())).length,
    blankRowsAfterHeader,
    dataRows: records.length,
    header,
    headerIndex,
    invalidRows,
    physicalRows: rows.length,
    records,
    titleRows: headerIndex,
  };
}

function entityKind(record) {
  const value = record.source_legal_entity.toLocaleLowerCase("sr-Latn");
  if (["true", "da", "yes", "1", "pravno lice"].includes(value)) {
    return "legal_entity";
  }
  if (["false", "ne", "no", "0", "fizicko lice", "fizičko lice"].includes(value)) {
    return "physical_person";
  }
  return "unknown";
}

function suggestedType(record) {
  if (entityKind(record) === "legal_entity") return "partner";
  if (/\b(servis|autolimar|autolomar|autolak)\b/.test(record.normalized_name)) {
    return "service";
  }
  return "unknown";
}

function slugify(value) {
  return latinize(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function shortStableHash(value) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).slice(0, 6);
}

function publicAddress(record) {
  return collapseWhitespace(
    [record.source_address, record.source_address_2].filter(Boolean).join(" "),
  );
}

function canonicalNameScore(record) {
  const tokenCount = record.normalized_name.split(" ").filter(Boolean).length;
  return tokenCount * 1000 + record.source_name.length;
}

function chooseCanonicalRecord(records, previousById) {
  const manualPrimary = records.find((record) => {
    const previous = previousById.get(record.source_bex_contact_id);
    return (
      previous?.duplicate_resolution === "manual_primary" ||
      (previous?.review_status === "approved" &&
        previous?.is_public?.toLocaleLowerCase("sr-Latn") === "true")
    );
  });
  if (manualPrimary) return manualPrimary;

  return [...records].sort(
    (left, right) =>
      canonicalNameScore(right) - canonicalNameScore(left) ||
      left.source_bex_contact_id.localeCompare(right.source_bex_contact_id),
  )[0];
}

function createAutomaticMergePlan(records, duplicatePairs, previousById) {
  const legalRecords = records.filter((record) => entityKind(record) === "legal_entity");
  const legalIds = new Set(legalRecords.map((record) => record.source_bex_contact_id));
  const parents = new Map(legalRecords.map((record) => [record.source_bex_contact_id, record.source_bex_contact_id]));

  function find(id) {
    const parent = parents.get(id);
    if (!parent || parent === id) return id;
    const root = find(parent);
    parents.set(id, root);
    return root;
  }

  function union(leftId, rightId) {
    const leftRoot = find(leftId);
    const rightRoot = find(rightId);
    if (leftRoot !== rightRoot) parents.set(rightRoot, leftRoot);
  }

  duplicatePairs
    .filter(
      (pair) =>
        pair.sameAddress &&
        pair.mergeConfidence === "high" &&
        legalIds.has(pair.leftId) &&
        legalIds.has(pair.rightId) &&
        previousById.get(pair.leftId)?.duplicate_resolution !== "keep_separate" &&
        previousById.get(pair.rightId)?.duplicate_resolution !== "keep_separate",
    )
    .forEach((pair) => union(pair.leftId, pair.rightId));

  const groups = new Map();
  for (const record of legalRecords) {
    const root = find(record.source_bex_contact_id);
    const group = groups.get(root) ?? [];
    group.push(record);
    groups.set(root, group);
  }

  const plan = new Map();
  const usedPublicIds = new Set();
  for (const group of groups.values()) {
    const canonical = chooseCanonicalRecord(group, previousById);
    const previousPublicId = previousById.get(canonical.source_bex_contact_id)?.public_location_id?.trim();
    const baseId = `preview-${slugify(canonical.source_name) || "partnerska-lokacija"}-${slugify(canonical.city) || "srbija"}`;
    let publicLocationId = previousPublicId || baseId;
    if (usedPublicIds.has(publicLocationId)) {
      publicLocationId = `${baseId}-${shortStableHash(canonical.normalized_address)}`;
    }
    usedPublicIds.add(publicLocationId);

    for (const record of group) {
      plan.set(record.source_bex_contact_id, {
        canonical,
        groupSize: group.length,
        isPrimary: record.source_bex_contact_id === canonical.source_bex_contact_id,
        publicLocationId,
      });
    }
  }

  return plan;
}

function shouldPreservePreviousValue(previous, column, value) {
  if (value === undefined || value === "") return false;

  if (
    previous.review_status === "unreviewed" &&
    LEGACY_GENERATED_VALUES[column] === value
  ) {
    return false;
  }

  if (
    AUTO_DUPLICATE_RESOLUTIONS.has(previous.duplicate_resolution) &&
    [
      "duplicate_resolution",
      "geocoding_approved",
      "is_public",
      "merge_target_id",
      "public_location_id",
      "review_status",
    ].includes(column)
  ) {
    return false;
  }

  return true;
}

export function createReview(records, previousRows = []) {
  const previousById = new Map(
    previousRows
      .filter((row) => row.source_bex_contact_id)
      .map((row) => [row.source_bex_contact_id, row]),
  );
  const { pairs, results } = findDuplicateCandidates(records);
  const mergePlan = createAutomaticMergePlan(records, pairs, previousById);

  const reviewRows = records.map((record) => {
    const previous = previousById.get(record.source_bex_contact_id) ?? {};
    const duplicate = results.get(record.source_bex_contact_id);
    const kind = entityKind(record);
    const addressPrecision = getAddressPrecision(
      record.source_address,
      record.source_address_2,
    );
    const riskFlags = ["unverified_bex_contact"];
    if (kind === "physical_person") riskFlags.push("physical_person");
    if (kind === "unknown") riskFlags.push("unknown_entity_kind");
    if (addressPrecision !== "usable_for_review") riskFlags.push("address_imprecise");
    if (isPlaceholderPib(record.source_pib)) riskFlags.push("pib_placeholder");

    const plan = mergePlan.get(record.source_bex_contact_id);
    const isPreviewPrimary = kind === "legal_entity" && plan?.isPrimary;
    const isAutoMerged = kind === "legal_entity" && plan && !plan.isPrimary;
    const row = {
      ...Object.fromEntries(REVIEW_COLUMNS.map((column) => [column, ""])),
      ...record,
      entity_kind: kind,
      risk_flags: riskFlags.join("|"),
      possible_duplicate_contact_ids: duplicate.candidates.join("|"),
      duplicate_class: duplicate.duplicateClass,
      merge_confidence: duplicate.mergeConfidence,
      proposed_type: suggestedType(record),
      address_precision: addressPrecision,
      review_status: isPreviewPrimary
        ? "preview_approved"
        : isAutoMerged
          ? "merged"
          : "manual_confirmation_required",
      duplicate_resolution:
        plan?.groupSize > 1
          ? plan.isPrimary
            ? "auto_primary_preview"
            : "auto_merged_preview"
          : "",
      merge_target_id: isAutoMerged ? plan.publicLocationId : "",
      public_location_id: isPreviewPrimary ? plan.publicLocationId : "",
      display_name: isPreviewPrimary ? plan.canonical.source_name : "",
      public_address: isPreviewPrimary ? publicAddress(plan.canonical) : "",
      public_city: isPreviewPrimary ? plan.canonical.city : "",
      type: kind === "legal_entity" ? "partner" : "unknown",
      verification_status: "pending",
      is_public: isPreviewPrimary ? "true" : "false",
      geocoding_approved: isPreviewPrimary ? "true" : "false",
      coordinate_status: "not_geocoded",
      analysis_note:
        kind === "physical_person"
          ? "Fizičko lice: potrebna je ručna potvrda pre bilo kakvog prikaza."
          : isAutoMerged
            ? `Preview duplikat je povezan sa markerom ${plan.publicLocationId}.`
            : "Preview import zasnovan na poslovnom BEX kontaktu za isporuku.",
    };

    for (const column of MANUAL_REVIEW_COLUMNS) {
      if (shouldPreservePreviousValue(previous, column, previous[column])) {
        row[column] = previous[column];
      }
    }

    const hasManualDuplicateDecision =
      previous.review_status === "approved" ||
      ["keep_separate", "manual_primary", "manual_merged"].includes(
        previous.duplicate_resolution,
      );
    if (isAutoMerged && !hasManualDuplicateDecision) {
      row.review_status = "merged";
      row.duplicate_resolution = "auto_merged_preview";
      row.merge_target_id = plan.publicLocationId;
      row.public_location_id = "";
      row.is_public = "false";
      row.geocoding_approved = "false";
    } else if (
      isPreviewPrimary &&
      plan.groupSize > 1 &&
      !hasManualDuplicateDecision
    ) {
      row.duplicate_resolution = "auto_primary_preview";
      row.merge_target_id = "";
    }

    previousById.delete(record.source_bex_contact_id);
    return row;
  });

  for (const previous of previousById.values()) {
    reviewRows.push({
      ...Object.fromEntries(REVIEW_COLUMNS.map((column) => [column, ""])),
      ...previous,
      source_status: "missing_from_latest_import",
      analysis_note: "Zapis ne postoji u poslednjem BEX izvozu; ručne odluke su sačuvane.",
    });
  }

  return { duplicatePairs: pairs, reviewRows };
}

function groupCount(records, key) {
  const groups = new Map();
  for (const record of records) {
    const value = record[key];
    if (!value) continue;
    const group = groups.get(value) ?? [];
    group.push(record);
    groups.set(value, group);
  }
  return [...groups.values()].filter((group) => group.length > 1);
}

export function createImportSummary(parsed, reviewRows, duplicatePairs) {
  const activeRows = reviewRows.filter((row) => row.source_status === "active");
  const addressGroups = groupCount(activeRows, "normalized_address");
  const nameGroups = groupCount(activeRows, "normalized_name");
  const approvedRows = activeRows.filter(
    (row) =>
      row.review_status === "approved" &&
      row.verification_status === "verified" &&
      row.is_public.toLocaleLowerCase("sr-Latn") === "true",
  );
  const previewRows = activeRows.filter(
    (row) =>
      row.review_status === "preview_approved" &&
      row.verification_status === "pending" &&
      row.is_public.toLocaleLowerCase("sr-Latn") === "true",
  );
  const autoMergedRows = activeRows.filter(
    (row) => row.duplicate_resolution === "auto_merged_preview",
  );

  return {
    generatedAt: new Date().toISOString(),
    source: {
      columns: parsed.header.filter(Boolean),
      dataRows: parsed.dataRows,
      invalidRows: parsed.invalidRows.length,
      blankRows: parsed.blankRows,
      physicalRows: parsed.physicalRows,
      titleRowsBeforeHeader: parsed.titleRows,
    },
    entities: {
      legalEntities: activeRows.filter((row) => row.entity_kind === "legal_entity").length,
      physicalPersons: activeRows.filter((row) => row.entity_kind === "physical_person").length,
      unknown: activeRows.filter((row) => row.entity_kind === "unknown").length,
    },
    privacy: {
      automaticallyPublic: previewRows.length,
      pendingManualReview: activeRows.filter(
        (row) => row.review_status === "manual_confirmation_required",
      ).length,
      pendingFinalReview: previewRows.length,
      approvedFromBexReview: approvedRows.length,
      riskRecords: activeRows.length,
    },
    quality: {
      autoMergedRows: autoMergedRows.length,
      placeholderPibRows: activeRows.filter((row) =>
        row.risk_flags.split("|").includes("pib_placeholder"),
      ).length,
      impreciseAddressRows: activeRows.filter((row) =>
        row.risk_flags.split("|").includes("address_imprecise"),
      ).length,
      exactAddressDuplicateGroups: addressGroups.length,
      exactAddressDuplicateRows: addressGroups.reduce(
        (total, group) => total + group.length,
        0,
      ),
      sameAddressMultipleNames: addressGroups.filter(
        (group) => new Set(group.map((row) => row.normalized_name)).size > 1,
      ).length,
      exactNormalizedNameGroups: nameGroups.length,
      exactNormalizedNameRows: nameGroups.reduce((total, group) => total + group.length, 0),
      sameNameMultipleAddresses: nameGroups.filter(
        (group) => new Set(group.map((row) => row.normalized_address)).size > 1,
      ).length,
      duplicateCandidatePairs: duplicatePairs.length,
      fuzzyNameDifferentAddressPairs: duplicatePairs.filter(
        (pair) => pair.duplicateClass === "similar_name_different_address",
      ).length,
    },
  };
}

function assertString(value, field, id) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Public location ${id || "<unknown>"} is missing ${field}.`);
  }
}

export function validatePublicLocations(locations) {
  if (!Array.isArray(locations)) throw new Error("Public locations must be an array.");

  const ids = new Set();
  const coordinateKeyCounts = new Map();
  let markerCount = 0;

  for (const location of locations) {
    const keys = Object.keys(location);
    const unexpectedKeys = keys.filter((key) => !PUBLIC_LOCATION_KEYS.has(key));
    if (unexpectedKeys.length > 0) {
      throw new Error(
        `Public location ${location.id ?? "<unknown>"} contains forbidden fields: ${unexpectedKeys.join(", ")}`,
      );
    }

    assertString(location.id, "id", location.id);
    assertString(location.name, "name", location.id);
    assertString(location.address, "address", location.id);
    assertString(location.city, "city", location.id);

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(location.id)) {
      throw new Error(`Public location ID must be a lowercase slug: ${location.id}`);
    }
    if (ids.has(location.id)) throw new Error(`Duplicate public location ID: ${location.id}`);
    ids.add(location.id);

    const hasLatitude = Number.isFinite(location.latitude);
    const hasLongitude = Number.isFinite(location.longitude);
    if (hasLatitude !== hasLongitude) {
      throw new Error(`Public location ${location.id} has incomplete coordinates.`);
    }
    if (hasLatitude && hasLongitude) {
      if (
        location.latitude < 41 ||
        location.latitude > 47 ||
        location.longitude < 18 ||
        location.longitude > 24
      ) {
        throw new Error(
          `Public location ${location.id} has coordinates outside the Serbia review bounds.`,
        );
      }

      const coordinateKey = `${location.latitude.toFixed(6)},${location.longitude.toFixed(6)}`;
      coordinateKeyCounts.set(
        coordinateKey,
        (coordinateKeyCounts.get(coordinateKey) ?? 0) + 1,
      );
      markerCount += 1;
    }

    if (!PUBLIC_LOCATION_TYPES.has(location.type)) {
      throw new Error(`Public location ${location.id} has an invalid type: ${location.type}`);
    }
    if (!new Set(["verified", "pending"]).has(location.verificationStatus)) {
      throw new Error(`Public location ${location.id} has an invalid verification status.`);
    }
    if (location.isPublic !== true) {
      throw new Error(`Public location ${location.id} is not public.`);
    }
    if (
      !new Set(["verified", "geocoded_preview", "approximate", "unavailable"]).has(
        location.coordinateStatus,
      )
    ) {
      throw new Error(`Public location ${location.id} has an invalid coordinate status.`);
    }
    if (location.coordinateStatus === "unavailable" && (hasLatitude || hasLongitude)) {
      throw new Error(`Unavailable location ${location.id} must not contain coordinates.`);
    }
    if (location.coordinateStatus !== "unavailable" && (!hasLatitude || !hasLongitude)) {
      throw new Error(`Mappable location ${location.id} is missing coordinates.`);
    }
    if (
      location.alternativeNames !== undefined &&
      (!Array.isArray(location.alternativeNames) ||
        location.alternativeNames.some(
          (name) => typeof name !== "string" || !name.trim(),
        ))
    ) {
      throw new Error(`Public location ${location.id} has invalid alternative names.`);
    }
    if (location.notes && /\b(?:pib|bex|sifra|šifra)\b/i.test(location.notes)) {
      throw new Error(`Public notes for ${location.id} contain an internal-data keyword.`);
    }
  }

  return {
    duplicateCoordinateGroups: [...coordinateKeyCounts.values()].filter(
      (count) => count > 1,
    ).length,
    listOnlyCount: locations.length - markerCount,
    locationCount: locations.length,
    markerCount,
  };
}
