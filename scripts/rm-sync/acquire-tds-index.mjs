#!/usr/bin/env node
/**
 * R-M sync, korak 3 — indeks TDS dokumenata (BEZ preuzimanja svih PDF-ova).
 *
 * Za svaki TDS link sa info portala meri se HEAD: status, veličina, Last-Modified, ETag.
 * Cilj je odluka „referenca ili lokalno hostovanje”: stabilan URL = direktan, bez sesije,
 * bez preusmeravanja na login, isti ETag u dva prolaza.
 *
 * Izlaz: data/rm-sync/raw/tds-index.generated.json
 */

import { mapLimit, readJson, writeJson } from "../carsystem-sync/lib/http.mjs";
import { PATHS, USER_AGENT } from "./lib/config.mjs";

const info = readJson(PATHS.rawInfo);
if (!info) throw new Error("Nedostaje RAW info portala: prvo acquire-info-portal.mjs.");
const previous = new Map((readJson(PATHS.rawDocuments, { documents: [] }).documents ?? []).map((document) => [document.url, document]));

const links = info.products.flatMap((product) => product.documents.map((document) => ({ code: product.code, ...document })));
const documents = await mapLimit(links, 6, async (link) => {
  try {
    const response = await fetch(link.url, { method: "HEAD", redirect: "manual", headers: { "User-Agent": USER_AGENT } });
    const etag = response.headers.get("etag");
    return {
      code: link.code,
      kind: link.kind,
      label: link.label,
      url: link.url,
      language: /\/unicorn\/([a-z-]+)\//i.exec(link.url)?.[1] ?? null,
      httpStatus: response.status,
      redirectedTo: response.headers.get("location"),
      contentType: response.headers.get("content-type"),
      bytes: Number(response.headers.get("content-length") ?? 0) || null,
      lastModified: response.headers.get("last-modified"),
      etag,
      etagStableSincePreviousRun: previous.has(link.url) ? previous.get(link.url).etag === etag : null,
      hasSessionToken: /[?&](token|sid|session|expires|signature)=/i.test(link.url),
    };
  } catch (error) {
    return { code: link.code, kind: link.kind, label: link.label, url: link.url, httpStatus: 0, error: String(error.message) };
  }
});

const ok = documents.filter((document) => document.httpStatus === 200);
writeJson(PATHS.rawDocuments, {
  meta: {
    source: "techinfo.rmpaint.com (linkovi sa info.rmpaint.com)",
    documents: documents.length,
    ok: ok.length,
    notOk: documents.filter((document) => document.httpStatus !== 200).map((document) => ({ code: document.code, status: document.httpStatus, url: document.url })),
    totalBytes: ok.reduce((sum, document) => sum + (document.bytes ?? 0), 0),
    pdfContentType: ok.filter((document) => /pdf/i.test(document.contentType ?? "")).length,
    withSessionToken: documents.filter((document) => document.hasSessionToken).length,
    redirects: documents.filter((document) => document.redirectedTo).length,
    lastModifiedRange: [ok.map((document) => new Date(document.lastModified).toISOString()).sort()[0], ok.map((document) => new Date(document.lastModified).toISOString()).sort().at(-1)],
    languages: [...new Set(documents.map((document) => document.language))],
  },
  documents: documents.sort((a, b) => a.url.localeCompare(b.url)),
});
console.log(JSON.stringify(readJson(PATHS.rawDocuments).meta, null, 1));
