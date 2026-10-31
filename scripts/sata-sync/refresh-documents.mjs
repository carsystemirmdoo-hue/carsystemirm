#!/usr/bin/env node
/**
 * SATA sync — OSVEŽAVANJE DOKUMENATA (mreža). Piše `data/sata-sync/documents.generated.json`,
 * registar JEDINSTVENIH dokumenata; `apply.mjs` iz njega gradi dataset kataloga.
 *
 * Reference (porodica → dokument) dolaze iz plana; ovde se za svaki jedinstveni dokument
 * (`documentKey` = ime fajla bez heša i `?ts=`) traži AKTUELNA adresa na zvaničnim stranicama
 * porodica koje ga navode, pa se fajl preuzima GET zahtevom i proverava:
 *   - HTTP 200, `content-type: application/pdf`, telo počinje sa `%PDF-`;
 *   - PDF se otvara (unpdf/pdf.js), ima bar jednu stranu i čitljiv tekst;
 *   - tekst imenuje model porodice, potvrđuje vrstu (uputstvo/izjava) i jezik.
 * Dokument koji ne prođe ostaje `MANUFACTURER_PAGE`: sajt tada nudi samo „Dokumentacija na
 * sajtu proizvođača“ (stranica porodice), nikad nepotvrđen fajl.
 *
 * Fajlovi se keširaju u `.cache/sata-sync/documents/` (van gita). `--offline` koristi samo keš.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { extractText, getDocumentProxy } from "unpdf";

import { readJson, sha256, writeJson } from "../carsystem-sync/lib/http.mjs";
import { PATHS, REPO_ROOT, USER_AGENT } from "./lib/config.mjs";
import { detectLanguages, documentKeyOf, fileOf, kindEvidenceOf, languageLabelOf, modelEvidenceOf, pdfLinksOf } from "./lib/documents.mjs";

const CACHE = path.join(REPO_ROOT, ".cache", "sata-sync", "documents");
mkdirSync(CACHE, { recursive: true });
const offline = process.argv.includes("--offline");

const plan = readJson(PATHS.plan);
if (!plan) throw new Error("Nedostaje plan — `npm run sata:sync:plan`.");
const previous = readJson(PATHS.documentRegistry, { documents: {} });

/** Jedinstveni dokumenti i porodice koje ih navode (redosled: ključ dokumenta). */
const unique = new Map();
for (const item of plan.items) {
  for (const document of item.documents) {
    const key = documentKeyOf(document.file);
    const entry = unique.get(key) ?? { key, kind: document.kind, title: document.title, file: document.file, recordedHref: document.href, recordedLanguage: document.language, families: [] };
    entry.families.push({ familyId: item.familyId, slug: item.slug, officialName: item.officialName, sourceUrl: item.sourceUrl });
    unique.set(key, entry);
  }
}

async function fetchWithRetry(url, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetch(url, { headers: { "user-agent": USER_AGENT }, redirect: "follow" });
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
    }
  }
  throw lastError;
}

const pageCache = new Map();
async function pageLinks(url) {
  if (pageCache.has(url)) return pageCache.get(url);
  const file = path.join(CACHE, `page-${sha256(url).slice(0, 16)}.html`);
  let html = null;
  let status = null;
  if (offline && existsSync(file)) {
    html = readFileSync(file, "utf8");
    status = 200;
  } else if (!offline) {
    const response = await fetchWithRetry(url);
    status = response.status;
    if (response.ok) {
      html = await response.text();
      writeFileSync(file, html);
    }
  }
  const result = { status, links: html ? pdfLinksOf(html) : [] };
  pageCache.set(url, result);
  return result;
}

async function download(href) {
  const file = path.join(CACHE, `${sha256(href).slice(0, 24)}.pdf`);
  // Sa mrežom se fajl UVEK preuzima ponovo (dokaz je ovaj GET); keš služi samo `--offline`.
  if (offline) return existsSync(file) ? { status: 200, contentType: "application/pdf", body: readFileSync(file) } : { status: null, contentType: null, body: null };
  const response = await fetchWithRetry(href);
  const contentType = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  const body = response.ok ? Buffer.from(await response.arrayBuffer()) : null;
  if (body && contentType === "application/pdf" && body.subarray(0, 5).toString("latin1") === "%PDF-") writeFileSync(file, body);
  return { status: response.status, contentType, body };
}

async function readPdf(body) {
  const pdf = await getDocumentProxy(new Uint8Array(body));
  const { text } = await extractText(pdf, { mergePages: true });
  return { pages: pdf.numPages, text };
}

const documents = {};
const failures = [];
for (const entry of [...unique.values()].sort((a, b) => a.key.localeCompare(b.key))) {
  const result = { key: entry.key, kind: entry.kind, title: entry.title, file: entry.file, families: entry.families.map((family) => family.familyId).sort() };
  // 1. Aktuelna adresa istog fajla na bilo kojoj zvaničnoj stranici porodice koja ga navodi.
  let href = null;
  let listedOn = null;
  const pageStatuses = {};
  for (const family of entry.families) {
    const page = await pageLinks(family.sourceUrl);
    pageStatuses[family.familyId] = page.status;
    const match = page.links.find((link) => documentKeyOf(fileOf(link)) === entry.key);
    if (match) {
      href = match;
      listedOn = family;
      break;
    }
  }
  if (!href) {
    documents[entry.key] = { ...result, status: "MANUFACTURER_PAGE", reason: "NOT_LISTED_ON_PRODUCT_PAGE", language: entry.recordedLanguage, pageStatuses };
    failures.push({ key: entry.key, reason: "NOT_LISTED_ON_PRODUCT_PAGE" });
    continue;
  }

  // 2. GET: stvarni PDF, ne HTML stranica i ne samo status 200.
  const response = await download(href);
  const isPdf = response.status === 200 && response.contentType === "application/pdf" && response.body?.subarray(0, 5).toString("latin1") === "%PDF-";
  if (!isPdf) {
    documents[entry.key] = { ...result, status: "MANUFACTURER_PAGE", reason: "NOT_A_PDF", language: entry.recordedLanguage, http: { status: response.status, contentType: response.contentType } };
    failures.push({ key: entry.key, reason: "NOT_A_PDF", href });
    continue;
  }

  // 3. Čitljiv sadržaj, tačan model, vrsta i jezik.
  let parsed;
  try {
    parsed = await readPdf(response.body);
  } catch (error) {
    documents[entry.key] = { ...result, status: "MANUFACTURER_PAGE", reason: "PDF_UNREADABLE", language: entry.recordedLanguage, error: String(error?.message ?? error) };
    failures.push({ key: entry.key, reason: "PDF_UNREADABLE" });
    continue;
  }
  const textChars = parsed.text.replace(/\s+/g, "").length;
  const languages = detectLanguages(parsed.text);
  const language = languageLabelOf(languages);
  const modelEvidence = Object.fromEntries(entry.families.map((family) => [family.familyId, modelEvidenceOf({ officialName: family.officialName, file: entry.file }, parsed.text)]));
  const kindConfirmed = kindEvidenceOf(entry.kind, parsed.text);
  const languageOk = entry.kind !== "brochure" || language === "en" || language === "multilingual" || languages.includes("en");
  const problems = [
    parsed.pages < 1 || textChars < 200 ? "PDF_NO_READABLE_TEXT" : null,
    Object.values(modelEvidence).some((value) => !value) ? "MODEL_NOT_CONFIRMED" : null,
    !kindConfirmed ? "KIND_NOT_CONFIRMED" : null,
    !languageOk ? "LANGUAGE_NOT_ACCEPTED" : null,
  ].filter(Boolean);

  documents[entry.key] = {
    ...result,
    status: problems.length ? "MANUFACTURER_PAGE" : "DIRECT_PDF",
    ...(problems.length ? { reason: problems.join(",") } : {}),
    href: problems.length ? null : href,
    language,
    languagesDetected: languages,
    listedOn: listedOn.familyId,
    verified: {
      date: offline ? previous.documents?.[entry.key]?.verified?.date ?? null : new Date().toISOString().slice(0, 10),
      httpStatus: response.status,
      contentType: response.contentType,
      bytes: response.body.length,
      sha256: sha256(response.body),
      pages: parsed.pages,
      textChars,
      modelEvidence,
      kindConfirmed,
    },
  };
  if (problems.length) failures.push({ key: entry.key, reason: problems.join(","), href, modelEvidence, languages });
}

const values = Object.values(documents);
const registry = {
  meta: {
    generator: "scripts/sata-sync/refresh-documents.mjs",
    note: "Jedinstveni SATA dokumenti. Ključ = ime fajla bez heša i ?ts= (SATA menja adrese fajlova). DIRECT_PDF = adresa proverena GET zahtevom kao čitljiv PDF tačnog modela, vrste i jezika; MANUFACTURER_PAGE = sajt vodi na stranicu porodice kod SATA.",
    references: plan.items.reduce((sum, item) => sum + item.documents.length, 0),
    documents: values.length,
    DIRECT_PDF: values.filter((document) => document.status === "DIRECT_PDF").length,
    MANUFACTURER_PAGE: values.filter((document) => document.status === "MANUFACTURER_PAGE").length,
  },
  documents,
};
writeJson(PATHS.documentRegistry, registry);
console.log(JSON.stringify({ ...registry.meta, failures }, null, 1));
