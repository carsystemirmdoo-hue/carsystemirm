/**
 * Šta sme da bude NEŠIFROVANO u GitHub artefaktu i u `backup_runs`.
 *
 * Bela lista: samo vreme, brojevi, otisci i ime šifrovanog fajla u tačno
 * propisanom obliku. Sve drugo (adrese, e-pošta, putanje, nazivi PDF-ova,
 * kupci, iznosi) je razlog da se posao zaustavi pre otpremanja. Pun manifest
 * (tabele, zbirovi prodaje) ide isključivo u šifrovan `.manifest.json.age`.
 */

export const LABEL_RE = /^[a-z0-9][a-z0-9-]{0,29}$/;
const FILE_RE = /^carsystem-[a-z0-9][a-z0-9-]{0,29}-\d{8}T\d{6}Z\.(dump|manifest\.json)\.age$/;
const SHA_RE = /^[0-9a-f]{64}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

const ALLOWED = {
  kind: (v) => v === "db_verified",
  createdAt: (v) => ISO_RE.test(v),
  summary: (v) =>
    v && typeof v === "object" &&
    Object.keys(v).every((k) => ["version", "createdAt", "serverVersion", "migrations", "tables", "rows", "sequences"].includes(k)) &&
    ISO_RE.test(v.createdAt) && /^[0-9.]+( \([A-Za-z0-9 ._-]{1,40}\))?$/.test(String(v.serverVersion)) &&
    ["version", "migrations", "tables", "rows", "sequences"].every((k) => Number.isInteger(v[k]) && v[k] >= 0),
  dumpSha256: (v) => SHA_RE.test(v),
  dumpBytes: (v) => Number.isInteger(v) && v >= 0,
  verified: (v) => typeof v === "boolean",
  verifyDurationMs: (v) => v === null || (Number.isInteger(v) && v >= 0),
  encrypted: (v) =>
    Array.isArray(v) && v.length > 0 &&
    v.every((f) => f && Object.keys(f).every((k) => ["name", "bytes", "sha256"].includes(k)) && FILE_RE.test(f.name) && SHA_RE.test(f.sha256) && Number.isInteger(f.bytes)),
  githubRunId: (v) => v === null || /^[0-9]{1,20}$/.test(String(v)),
};

/** Spisak problema; prazan = status sme nešifrovan. */
export function publicStatusProblems(status) {
  const problems = [];
  if (!status || typeof status !== "object") return ["status nije objekat"];
  for (const k of Object.keys(status)) if (!(k in ALLOWED)) problems.push(`nedozvoljeno polje: ${k}`);
  for (const [k, ok] of Object.entries(ALLOWED)) if (!ok(status[k])) problems.push(`neispravno polje: ${k}`);
  const text = JSON.stringify(status);
  if (/@|:\/\/|\\|[A-Za-z]:\//.test(text)) problems.push("status sadrži adresu, e-poštu ili putanju");
  if (/\.pdf\b/i.test(text)) problems.push("status pominje PDF fajl");
  return problems;
}

/** Red `.sha256` fajla: tačno heš, dva razmaka i ime šifrovanog fajla. */
export function publicShaLineOk(line) {
  const m = String(line).trim().match(/^([0-9a-f]{64}) {2}(.+)$/);
  return Boolean(m && FILE_RE.test(m[2]));
}
