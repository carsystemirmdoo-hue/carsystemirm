#!/usr/bin/env node
/**
 * R-M sync, korak 5 — od RAW izvora do MODELA proizvoda (bez ijedne izmene kataloga).
 *
 * Ključ identiteta je zvanična oznaka proizvoda sa info portala („C 2A64”). Marketinški sajt
 * nema oznaku, pa se njegova stranica vezuje za portal DOSLOVNIM poklapanjem opisa
 * („Advance Series - Clear coat, superior gloss”) ili oznakom u nazivu/slug-u; naziv sam
 * nije dovoljan (CLEAR Harden-R postoji u četiri brzine).
 *
 * Uloga (`role`) dolazi iz tehničke kategorije portala; `kind` razlikuje SISTEM za mešanje
 * (jedna stranica = ceo sistem, toneri se ne objavljuju pojedinačno) od proizvoda i komponente.
 * Učvršćivač / razređivač / aditiv je SAMOSTALAN zapis sa odnosima, nikad varijanta laka.
 *
 * Izlaz: data/rm-sync/source-products.generated.json
 */

import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

import { readJson, writeJson } from "../carsystem-sync/lib/http.mjs";
import { PATHS, REPO_ROOT } from "./lib/config.mjs";
import { normalizeCode, parseTds } from "./lib/tds.mjs";

const info = readJson(PATHS.rawInfo);
const website = readJson(PATHS.rawWebsite);
const tdsIndex = readJson(PATHS.rawDocuments);
if (!info || !website || !tdsIndex) throw new Error("Nedostaje RAW dataset: pokrenuti acquire korake.");

const TEXT_DIR = path.join(REPO_ROOT, ".cache", "rm-sync", "tds-text");
const tdsTextByCode = new Map();
if (existsSync(TEXT_DIR)) for (const file of readdirSync(TEXT_DIR)) { const entry = readJson(path.join(TEXT_DIR, file)); tdsTextByCode.set(entry.code, entry); }

const ROLE_BY_CATEGORY = {
  Cleaner: "cleaner", Bodyfiller: "bodyfiller", Undercoat: "undercoat", "Basecoat/Topcoat": "basecoat-topcoat", Clearcoat: "clearcoat",
  Hardener: "hardener", Thinner: "thinner", "Additives/Others": "additive", "CV Products": "commercial-vehicle",
};
/** Kod CV proizvoda uloga se čita iz slova oznake (isti ključ koji R-M koristi u svim linijama). */
const ROLE_BY_LETTER = { A: "additive", B: "bodyfiller", C: "clearcoat", H: "hardener", P: "undercoat", PM: "undercoat", PK: "cleaner", R: "thinner", RA: "thinner", GV: "thinner", BC: "thinner" };
const COMPONENT_ROLES = new Set(["hardener", "thinner", "additive"]);

function editDistance(a, b) {
  if (Math.abs(a.length - b.length) > 1) return 9;
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j += 1) rows[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) for (let j = 1; j <= b.length; j += 1) rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return rows[a.length][b.length];
}

const norm = (text) => String(text ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function seriesOf(product, tds) {
  const text = `${product.introduction.join(" ")} ${tds?.application ?? ""} ${tds?.subtitle ?? ""}`;
  if (/Pioneer Series/i.test(text)) return "Pioneer Series";
  if (/Advance Series/i.test(text)) return "Advance Series";
  if (/Element Series/i.test(text)) return "Element Series";
  if (/GRAPHITE HD|\bGHD\b/i.test(`${product.title} ${text}`)) return "GRAPHITE HD";
  return null;
}
function lineOf(product) {
  const text = `${product.title} ${product.introduction.join(" ")}`;
  for (const [line, pattern] of [["AGILIS", /AGILIS/i], ["ONYX HD", /ONYX/i], ["DIAMONT", /DIAMONT/i], ["UNO HD", /UNO HD/i], ["GRAPHITE HD", /GRAPHITE HD|\bGHD\b/i]]) if (pattern.test(text)) return line;
  return null;
}

const products = info.products.map((product) => {
  const raw = tdsTextByCode.get(product.code);
  const tds = raw?.pages?.length ? parseTds(raw.pages) : null;
  const letters = /^([A-Z]{1,2}) /.exec(product.code)?.[1] ?? null;
  const category = product.categories[0] ?? null;
  const role = category === "CV Products" ? ROLE_BY_LETTER[letters] ?? "basecoat-topcoat" : ROLE_BY_CATEGORY[category] ?? null;
  // SISTEM: portal ga vodi pod imenom linije (oznaka nije R-M šifra), a TDS kaže „mixing system / mixing formulas”.
  const isSystem = !letters && /mixing system|mixing formulas|basecoat line|basecoats? for|topcoat/i.test(`${product.introduction.join(" ")} ${tds?.application ?? ""}`);
  const kind = isSystem ? "system" : COMPONENT_ROLES.has(role) ? "component" : "product";
  const tdsDoc = tdsIndex.documents.find((document) => document.code === product.code) ?? null;
  return {
    code: product.code,
    sourceKey: norm(product.code).replace(/ /g, "-"),
    officialName: product.title,
    name: product.title.replace(new RegExp(`^${product.code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+`), "") || product.title,
    kind,
    role,
    portalCategory: category,
    series: seriesOf(product, tds),
    line: lineOf(product),
    introduction: product.introduction,
    image: product.image,
    sources: { infoPortal: product.sourceUrl, website: null },
    tds: tdsDoc ? { url: tdsDoc.url, bytes: tdsDoc.bytes, lastModified: tdsDoc.lastModified, httpStatus: tdsDoc.httpStatus, ...(tds ?? {}) } : null,
  };
});

/* -- Marketinški sajt → oznaka ------------------------------------------------------------ */

const byCode = new Map(products.map((product) => [product.code, product]));
// Portal vodi gotove UNO HD boje kao „SC T2A203”, a TDS ih pominje kao „T 2A203” — ista oznaka.
for (const product of products) if (/^SC T/.test(product.code)) byCode.set(normalizeCode(product.code.replace(/^SC /, "")), product);
const byIntro = new Map();
for (const product of products) for (const line of product.introduction) byIntro.set(norm(line), [...(byIntro.get(norm(line)) ?? []), product]);

const websiteLinks = website.products.map((page) => {
  const evidence = [];
  let match = null;
  const codeInPage = [...`${page.name ?? ""} ${page.slug.replace(/-/g, " ")}`.toUpperCase().matchAll(/\b([A-Z]{1,2}) ?(\d[A-Z0-9]{2,4}[A-Z]?)\b/g)].map((found) => normalizeCode(`${found[1]} ${found[2]}`)).find((code) => byCode.has(code));
  if (codeInPage) { match = byCode.get(codeInPage); evidence.push(`oznaka „${codeInPage}” u nazivu/adresi stranice`); }
  if (!match) {
    const candidates = page.description.flatMap((line) => byIntro.get(norm(line)) ?? []);
    const named = candidates.filter((candidate) => norm(candidate.officialName).includes(norm(page.name)));
    if (named.length === 1) { match = named[0]; evidence.push("doslovno isti opis + naziv na info portalu"); }
    else if (candidates.length === 1) { match = candidates[0]; evidence.push("doslovno isti opis na info portalu"); }
  }
  if (!match) {
    const named = products.filter((product) => norm(product.name) === norm(page.name) || norm(product.officialName) === norm(page.name));
    if (named.length === 1) { match = named[0]; evidence.push("jedinstven isti naziv na info portalu"); }
  }
  let conflict = null;
  if (!match) {
    // Slovna greška na sajtu („UV BLEMDING Thinn-R”): jedno slovo razlike i JEDAN jedini kandidat na portalu.
    const close = products.filter((product) => editDistance(norm(product.name), norm(page.name)) === 1);
    if (close.length === 1) { match = close[0]; evidence.push(`naziv se od portalnog „${close[0].name}” razlikuje za jedno slovo (slovna greška sajta)`); conflict = "WEBSITE_NAME_TYPO"; }
  }
  if (match) match.sources.website = [...(match.sources.website ?? []), page.sourceUrl];
  return { slug: page.slug, sourceUrl: page.sourceUrl, lastmod: page.lastmod, httpStatus: page.httpStatus, name: page.name, series: page.series, productType: page.productType, description: page.description, code: match?.code ?? null, evidence, conflict, status: match ? "LINKED" : "UNLINKED" };
});
for (const product of products) {
  const page = website.products.find((candidate) => product.sources.website?.includes(candidate.sourceUrl));
  if (page?.series && !product.series) product.series = /Pioneer/.test(page.series) ? "Pioneer Series" : /Advance/.test(page.series) ? "Advance Series" : product.series;
  product.websiteImage = page?.image ?? null;
  product.technologyTags = page?.series ? page.series.split(",").map((tag) => tag.trim()).filter((tag) => !/Series/.test(tag)) : [];
}

/* -- Sistemski odnosi i status ------------------------------------------------------------- */

const referencedOnly = new Map();
for (const product of products) {
  const tds = product.tds ?? {};
  const related = (codes) => (codes ?? []).filter((code) => code !== product.code);
  const canonical = (codes) => [...new Set(codes.filter((code) => byCode.has(code)).map((code) => byCode.get(code).code))].filter((code) => code !== product.code);
  product.relations = {
    hardeners: canonical(related(tds.hardeners)),
    thinners: canonical(related(tds.thinners)),
    otherMentioned: canonical(related(tds.mentionedCodes).filter((code) => !tds.hardeners?.includes(code) && !tds.thinners?.includes(code))),
  };
  for (const code of related(tds.mentionedCodes).filter((code) => !byCode.has(code))) referencedOnly.set(code, [...(referencedOnly.get(code) ?? []), product.code]);
}
for (const product of products) {
  product.usedBy = products.filter((other) => other.relations.hardeners.includes(product.code) || other.relations.thinners.includes(product.code) || other.relations.otherMentioned.includes(product.code)).map((other) => other.code);
  const currentTds = product.tds?.publisher === "Surventis" && /^202[56]/.test(product.tds?.revision ?? "");
  // Portalna stranica je sama dokaz tekuće ponude; TDS koji nedostaje ili je nestandardan je PRAZNINA u dokumentaciji, ne razlog za izostavljanje.
  product.status = product.kind === "system" ? "CURRENT_ACTIVE_SYSTEM" : "CURRENT_ACTIVE";
  product.documentationGap = !product.tds ? "zvanični TDS nije pronađen na portalu" : !product.tds.revision ? "TDS nestandardnog formata (bez zaglavlja i revizije); tehničke činjenice se ne čitaju" : null;
  product.currentEvidence = [
    "naveden na info.rmpaint.com/products",
    product.sources.website ? "ima stranicu na rmpaint.com/en-int" : null,
    currentTds ? `TDS revizija ${product.tds.revision}, izdavač ${product.tds.publisher}` : null,
  ].filter(Boolean);
}

/* -- Komponente sistema bez sopstvene kartice, website-only sistemi, siročad sajta -------- */

const systems = products.filter((product) => product.kind === "system");
const unlinkedPages = websiteLinks.filter((link) => !link.code);
const codeOfPage = (link) => [...`${link.name ?? ""}`.toUpperCase().matchAll(/\b(HB) ?(\d{3}[A-Z]{0,2})\b/g)].map((found) => normalizeCode(`${found[1]} ${found[2]}`))[0] ?? null;
const systemComponents = [...referencedOnly.entries()]
  .filter(([code]) => /^HB /.test(code))
  .sort()
  .map(([code, mentionedBy]) => {
    const owners = systems.filter((system) => mentionedBy.includes(system.code)).map((system) => system.code);
    const page = unlinkedPages.find((link) => codeOfPage(link) === code) ?? null;
    return { code, role: "mixing clear / adjusting base", systems: owners, mentionedBy: [...new Set(mentionedBy)], websitePage: page?.sourceUrl ?? null, status: "SYSTEM_COMPONENT_WITHOUT_CARD" };
  });
for (const system of systems) system.systemComponents = systemComponents.filter((component) => component.systems.includes(system.code)).map((component) => component.code);
for (const component of systemComponents) if (component.websitePage) for (const owner of component.systems) { const system = byCode.get(owner); system.sources.secondaryMarketing = [...(system.sources.secondaryMarketing ?? []), component.websitePage]; }

const componentPages = new Set(systemComponents.map((component) => component.websitePage).filter(Boolean));
const websiteOnlySystems = unlinkedPages
  .filter((link) => !componentPages.has(link.sourceUrl) && link.httpStatus === 200 && /Basecoat\/Topcoat/.test(link.productType ?? "") && products.some((product) => product.line === link.name))
  .map((link) => ({ sourceKey: norm(link.name).replace(/ /g, "-"), name: link.name, officialName: link.name, kind: "system", status: "CURRENT_WEBSITE_ONLY_SYSTEM", code: null, sourceUrl: link.sourceUrl, lastmod: link.lastmod, description: link.description, image: website.products.find((page) => page.sourceUrl === link.sourceUrl)?.image ?? null, lineProducts: products.filter((product) => product.line === link.name).map((product) => product.code) }));
const websiteOrphans = unlinkedPages
  .filter((link) => !componentPages.has(link.sourceUrl) && !websiteOnlySystems.some((system) => system.sourceUrl === link.sourceUrl))
  .map((link) => ({ slug: link.slug, name: link.name, sourceUrl: link.sourceUrl, status: "WEBSITE_ORPHAN_REVIEW", reason: "stranica sajta bez pouzdanog identiteta na info portalu" }));

const count = (list, key) => Object.fromEntries([...new Set(list.map(key))].sort().map((value) => [value ?? "—", list.filter((item) => key(item) === value).length]));
writeJson(PATHS.source, {
  meta: {
    rule: "identitet = zvanična oznaka sa info.rmpaint.com; rmpaint.com/en-int = dokaz ponude i serija; TDS (techinfo.rmpaint.com) = tehničke činjenice i sistemski odnosi",
    infoPortalCrawledAt: info.meta.crawledAt,
    websiteCrawledAt: website.meta.crawledAt,
    catalogue: null,
    catalogueNote: "zvanični R-M/Surventis katalog ili product guide (PDF) nije pronađen ni na jednom zvaničnom izvoru",
    articleNumbers: "8-cifreni brojevi artikala i pakovanja NISU javno objavljeni ni na jednom zvaničnom izvoru; zvanična javna šifra je oznaka proizvoda",
    sds: "nema linkova po proizvodu; rmpaint.com/en-int/sds upućuje na lokalnog predstavnika",
  },
  summary: {
    products: products.length,
    byKind: count(products, (product) => product.kind),
    byRole: count(products, (product) => product.role),
    bySeries: count(products, (product) => product.series),
    byLine: count(products, (product) => product.line),
    byStatus: count(products, (product) => product.status),
    withImage: products.filter((product) => product.image).length,
    withWebsitePage: products.filter((product) => product.sources.website).length,
    withTds: products.filter((product) => product.tds).length,
    websitePages: websiteLinks.length,
    websitePagesLinked: websiteLinks.filter((link) => link.code).length,
    websitePagesUnlinked: websiteLinks.filter((link) => !link.code).map((link) => link.slug),
    SYSTEM_COMPONENTS_WITHOUT_CARDS: systemComponents.length,
    WEBSITE_ONLY_SYSTEMS: websiteOnlySystems.map((system) => system.name),
    WEBSITE_ORPHANS: websiteOrphans.map((orphan) => orphan.slug),
    DOCUMENTATION_GAPS: products.filter((product) => product.documentationGap).map((product) => product.code),
    websiteTypos: websiteLinks.filter((link) => link.conflict).map((link) => `${link.slug} → ${link.code}`),
    referencedOnlyCodes: referencedOnly.size,
  },
  websiteLinks,
  systemComponents,
  websiteOnlySystems,
  websiteOrphans,
  referencedOnly: [...referencedOnly.entries()].sort().map(([code, by]) => ({ code, mentionedBy: [...new Set(by)] })),
  products,
});
console.log(JSON.stringify(readJson(PATHS.source).summary, null, 1));
