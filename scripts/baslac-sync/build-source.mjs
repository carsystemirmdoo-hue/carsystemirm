#!/usr/bin/env node
/**
 * baslac sync, korak 3 — od RAW izvora do MODELA. Ne menja katalog.
 *
 * Pravila (dogovorena u auditu i reconciliation-u):
 *   1. CURRENT je šifra koju potvrđuje stranica kategorije ILI indeks tehničkih listova.
 *      Fajl koji postoji samo u otvorenom direktorijumu nije dokaz.
 *   2. Jedna zvanična šifra = jedan zapis. Pakovanje nije deo identiteta.
 *   3. Mixing clear/binder (30-S00, 30-S01, 35-M00, 45-W00) su UGNJEŽDENE komponente
 *      sistema, ne kartice — imaju TDS, ali ih sajt ne navodi kao proizvode.
 *   4. `11-40` ima uredan TDS i poznat identitet, ali nema potvrdu sa aktuelnog sajta:
 *      UNCERTAIN_NOT_CUSTOMER_FACING, izvan pokrivenosti.
 *   5. Toneri se zvanično ne objavljuju pojedinačno → 0 javnih toner šifara.
 *
 * Uloga se čita iz prefiksa šifre — isti ključ koji baslac koristi u celom asortimanu.
 */

import { readJson, writeJson } from "../carsystem-sync/lib/http.mjs";
import { PATHS, PROMOTED_FROM_LINE, SYSTEMS, UNCERTAIN_CODES } from "./lib/config.mjs";

const website = readJson(PATHS.rawWebsite);
const techinfo = readJson(PATHS.rawTechinfo);
const tds = readJson(PATHS.tdsFacts, { facts: {} }).facts;
if (!website || !techinfo) throw new Error("Nedostaje RAW dataset — pokrenuti `npm run baslac:sync:acquire`.");
if (!Object.keys(tds).length) throw new Error("Nedostaju činjenice iz tehničkih listova — `npm run baslac:sync:acquire`.");

const ROLE_BY_PREFIX = [
  [/^(11|12)-/, "bodyfiller"],
  [/^(20|21|25|27)-/, "undercoat"],
  [/^40-/, "clearcoat"],
  [/^(50|51|55|56)-/, "hardener"],
  [/^(60|65)-/, "reducer"],
  [/^45-R/, "reducer"],
  [/^(57|80|81)-/, "additive"],
  [/^45-W1/, "additive"],
  [/^70-/, "cleaner"],
];
const roleOf = (code) => ROLE_BY_PREFIX.find(([pattern]) => pattern.test(code))?.[1] ?? "other";
const COMPONENT_ROLES = new Set(["hardener", "reducer", "additive"]);
const stripCode = (text) => String(text ?? "").replace(/^(?:\s*(?:\d{2}-[A-Z]?\d{2,3}|\/?\s*-\d{2,3})\s*,?)+/, "").trim();

const MIXING_COMPONENTS = new Set(SYSTEMS.flatMap((system) => system.components));
const websiteByCode = new Map(website.products.map((product) => [product.code, product]));
const docByCode = new Map(techinfo.documents.filter((document) => document.code).map((document) => [document.code, document]));
const variantsByCode = new Map();
for (const document of techinfo.documents.filter((entry) => entry.kind === "variant")) {
  const owner = /^(\d{2}-[A-Z]?\d{2,3})/.exec(document.file)?.[1];
  if (owner) variantsByCode.set(owner, [...(variantsByCode.get(owner) ?? []), document]);
}

/**
 * Kombinacije iz DVA zvanična traga:
 *   1. naziv varijantnog lista: `40-40_variant_80-10` → 40-40 koristi 80-10;
 *   2. osobina na kartici sajta koja imenuje šifru komponente: „Hardener 55-10 EP",
 *      „60-20/-30 Normal/Slow" na kartici 25-30.
 * Uzima se samo kombinacija premaz → komponenta; obrnut smer se izvodi kao `usedBy`.
 */
const codesInText = (text) => {
  const out = [];
  let prefix = null;
  for (const match of String(text).matchAll(/(?:\b(\d{2})-([A-Z]?\d{2,3})\b|\/\s*-(\d{2,3})\b)/g)) {
    if (match[1]) {
      prefix = match[1];
      out.push(`${match[1]}-${match[2]}`);
    } else if (prefix) out.push(`${prefix}-${match[3]}`);
  }
  return [...new Set(out)];
};
const relationOf = (code) => {
  const fromDocuments = (variantsByCode.get(code) ?? []).flatMap((document) =>
    [...document.file.slice(0, -4).matchAll(/_variant_(\d{2}-\d{2,3})/g)].map((match) => match[1]),
  );
  const page = websiteByCode.get(code);
  const fromFeatures = COMPONENT_ROLES.has(roleOf(code))
    ? []
    : (page?.features ?? []).flatMap((feature) => codesInText(feature)).filter((partner) => COMPONENT_ROLES.has(roleOf(partner)));
  return [...new Set([...fromDocuments, ...fromFeatures])].filter((partner) => partner !== code);
};

const products = [];
for (const [code, document] of [...docByCode].sort()) {
  const page = websiteByCode.get(code) ?? null;
  const onWebsite = Boolean(page);
  const inIndex = document.linkedFromWebsiteIndex;
  const uncertain = UNCERTAIN_CODES.includes(code);
  const mixing = MIXING_COMPONENTS.has(code);
  const status = uncertain ? "UNCERTAIN_NOT_CUSTOMER_FACING" : mixing ? "CURRENT_MIXING_COMPONENT" : onWebsite || inIndex ? "CURRENT_ACTIVE" : "DIRECTORY_ONLY";
  const sheet = tds[code] ?? {};
  const partners = [...new Set([...relationOf(code), ...(COMPONENT_ROLES.has(roleOf(code)) ? [] : sheet.relatedCodes ?? [])])].filter((partner) => partner !== code);
  const role = roleOf(code);
  products.push({
    code,
    sourceKey: code.toLowerCase(),
    officialName: document.title ?? (page?.name ? `${code} ${page.name}` : sheet.officialName ? `${code} ${sheet.officialName}` : null),
    displayName: stripCode(document.title) || page?.name || stripCode(sheet.officialName) || null,
    websiteName: page?.name ?? null,
    websiteSubtitle: page?.subtitle ?? null,
    features: page?.features ?? [],
    officialImages: page?.images ?? [],
    role,
    status,
    system: SYSTEMS.find((system) => system.components.includes(code))?.key ?? null,
    promotedFromLine: PROMOTED_FROM_LINE.includes(code),
    evidence: [onWebsite ? `stranica kategorije: ${page.page}` : null, inIndex ? "indeks tehničkih listova" : null, "tehnički list u direktorijumu"].filter(Boolean),
    tds: {
      url: document.url,
      file: document.file,
      localPath: document.localPath,
      bytes: document.bytes,
      linkedFromWebsiteIndex: inIndex,
      officialName: sheet.officialName ?? null,
      revision: sheet.revision ?? null,
      // Zvanične činjenice iz lista — doslovno, bez računanja.
      facts: sheet.facts ?? {},
      drying: sheet.drying ?? [],
      voc: sheet.voc ?? null,
      introduction: sheet.intro ?? [],
      mixing: sheet.mixing ?? [],
    },
    variantDocuments: (variantsByCode.get(code) ?? []).map((entry) => entry.file),
    relations: {
      hardeners: partners.filter((partner) => roleOf(partner) === "hardener"),
      reducers: partners.filter((partner) => roleOf(partner) === "reducer"),
      additives: partners.filter((partner) => roleOf(partner) === "additive"),
    },
  });
}

/*
 * Komponenta u SVOM listu navodi proizvode u kojima se koristi („This product is used in
 * baslac 2K Primerfiller, … and Clears 40-10, -40."). To je zvanična izjava proizvođača i
 * jedini izvor odnosa za 16 učvršćivača i 7 razređivača, čiji listovi nemaju tabelu.
 */
const known = new Set(products.map((product) => product.code));
const BUCKET_BY_ROLE = { hardener: "hardeners", reducer: "reducers", additive: "additives" };
for (const component of products.filter((product) => COMPONENT_ROLES.has(product.role))) {
  const bucket = BUCKET_BY_ROLE[component.role];
  const declared = component.tds.introduction.flatMap((line) => codesInText(line)).filter((code) => code !== component.code && known.has(code));
  component.declaredUsedIn = [...new Set(declared)];
  for (const code of component.declaredUsedIn) {
    const coating = products.find((product) => product.code === code);
    if (!coating || COMPONENT_ROLES.has(coating.role)) continue;
    if (!coating.relations[bucket].includes(component.code)) coating.relations[bucket].push(component.code);
  }
}
for (const coating of products) for (const bucket of Object.keys(coating.relations)) coating.relations[bucket].sort();

for (const product of products) {
  product.usedBy = products.filter((other) => Object.values(other.relations).some((codes) => codes.includes(product.code))).map((other) => other.code);
}

const systems = SYSTEMS.map((system) => ({
  ...system,
  sourceKey: system.key,
  status: "CURRENT_SYSTEM",
  lineDocument: techinfo.documents.find((document) => document.file === system.lineDoc) ?? null,
  componentDetail: system.components.map((code) => {
    const component = products.find((entry) => entry.code === code);
    return { code, officialName: component?.officialName ?? null, tds: component?.tds?.url ?? null, status: component?.status ?? "MISSING_LOCAL_RECORD" };
  }),
}));

const current = products.filter((product) => product.status === "CURRENT_ACTIVE");
const count = (list, key) => Object.fromEntries([...new Set(list.map(key))].sort().map((value) => [value ?? "—", list.filter((item) => key(item) === value).length]));
writeJson(PATHS.source, {
  meta: {
    rule: "CURRENT = stranica kategorije ILI indeks tehničkih listova; otvoreni direktorijum sam nije dokaz",
    websiteCrawledAt: website.meta.crawledAt,
    directoryFiles: techinfo.meta.files,
    note: "toneri se zvanično ne objavljuju pojedinačno — 0 javnih toner šifara",
  },
  summary: {
    CURRENT_OFFICIAL_CODES: current.length,
    CURRENT_SYSTEMS: systems.length,
    CURRENT_MIXING_COMPONENTS: products.filter((product) => product.status === "CURRENT_MIXING_COMPONENT").map((product) => product.code),
    UNCERTAIN_NOT_CUSTOMER_FACING: products.filter((product) => product.status === "UNCERTAIN_NOT_CUSTOMER_FACING").map((product) => product.code),
    DIRECTORY_ONLY: products.filter((product) => product.status === "DIRECTORY_ONLY").map((product) => product.code),
    CURRENT_PUBLIC_TONERS: 0,
    byRole: count(current, (product) => product.role),
    withTdsFacts: current.filter((product) => Object.keys(product.tds.facts).length || product.tds.voc || product.tds.drying.length).length,
    withTdsIntroduction: current.filter((product) => product.tds.introduction.length).length,
    withOfficialImage: current.filter((product) => product.officialImages.length).length,
    withoutOfficialImage: current.filter((product) => !product.officialImages.length).length,
    onWebsitePage: current.filter((product) => product.websiteName).length,
    PDF_ONLY_PRODUCTS: current.filter((product) => !product.websiteName).length,
    withRelations: current.filter((product) => Object.values(product.relations).some((codes) => codes.length)).length,
    promotedFromLine: products.filter((product) => product.promotedFromLine).map((product) => product.code),
  },
  systems,
  products,
});
const summary = readJson(PATHS.source).summary;
console.log(JSON.stringify(summary, null, 1));
