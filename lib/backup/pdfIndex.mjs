/**
 * Inkrementalna kopija izvornih PDF-ova — čista pravila.
 *
 * Skladište je adresirano sadržajem: svaki jedinstven sadržaj je jedan objekat
 * `objects/<sha256[0..2]>/<sha256>.pdf.age`. Zato:
 *  - nov fajl → nov objekat;
 *  - PROMENJEN fajl (isti put, drugi sadržaj) → nov objekat, a stari ostaje kao
 *    prethodna verzija;
 *  - obrisan original → u indeksu se beleži `missingSince`; objekat se NE briše.
 * Nijedan korak ovog toka ne briše objekat. Brisanje iz skladišta je ručna
 * odluka, van automatike.
 *
 * Heš se računa samo za fajlove kojima su se promenili veličina ili vreme
 * izmene, da dnevni prolaz preko hiljada PDF-ova ostane brz.
 */

export const INDEX_VERSION = 1;

/** Prazno stanje. */
export function emptyIndex() {
  return { version: INDEX_VERSION, files: {}, objects: {} };
}

/**
 * Šta treba heširati u ovom prolazu.
 * @param {ReturnType<typeof emptyIndex>} index
 * @param {{ path: string, size: number, mtimeMs: number }[]} scan
 */
export function planScan(index, scan) {
  const seen = new Set();
  const toHash = [];
  for (const f of scan) {
    seen.add(f.path);
    const prev = index.files[f.path];
    if (!prev || prev.size !== f.size || prev.mtimeMs !== f.mtimeMs || prev.missingSince) toHash.push(f);
  }
  const missing = Object.keys(index.files).filter((p) => !seen.has(p) && !index.files[p].missingSince);
  return { toHash, missing };
}

/**
 * Primena rezultata prolaza na indeks (vraća NOV indeks; ulaz se ne menja).
 * @param {ReturnType<typeof emptyIndex>} index
 * @param {{ path: string, size: number, mtimeMs: number, sha256: string }[]} hashed
 * @param {string[]} missing
 * @param {string} now ISO vreme prolaza
 */
export function applyScan(index, hashed, missing, now) {
  const next = structuredClone(index);
  const newObjects = [];
  const changed = [];
  const added = [];
  for (const f of hashed) {
    const prev = next.files[f.path];
    if (!next.objects[f.sha256] && !newObjects.includes(f.sha256)) newObjects.push(f.sha256);
    if (!prev) {
      added.push(f.path);
      next.files[f.path] = { size: f.size, mtimeMs: f.mtimeMs, sha256: f.sha256, firstSeen: now, lastSeen: now, versions: [f.sha256] };
      continue;
    }
    const versions = prev.versions ?? [prev.sha256];
    if (prev.sha256 !== f.sha256) changed.push(f.path);
    next.files[f.path] = {
      ...prev,
      size: f.size,
      mtimeMs: f.mtimeMs,
      sha256: f.sha256,
      lastSeen: now,
      versions: versions.includes(f.sha256) ? versions : [...versions, f.sha256],
    };
    delete next.files[f.path].missingSince;
  }
  for (const p of Object.keys(next.files)) {
    if (!next.files[p].missingSince && !missing.includes(p) && !hashed.some((h) => h.path === p)) next.files[p].lastSeen = now;
  }
  for (const p of missing) next.files[p] = { ...next.files[p], missingSince: now };
  return { index: next, newObjects, added, changed, missing };
}

/** Objekat je sačuvan tek kada je zapisan i proveren; tada se upisuje u indeks. */
export function markStored(index, sha256, info) {
  return { ...index, objects: { ...index.objects, [sha256]: info } };
}

export function objectPath(sha256) {
  if (!/^[0-9a-f]{64}$/.test(sha256)) throw new Error("Neispravan SHA-256.");
  return `objects/${sha256.slice(0, 2)}/${sha256}.pdf.age`;
}
