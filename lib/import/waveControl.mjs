/**
 * Kontrole talasa istorijskih faktura — čista pravila, bez baze i fajlova.
 *
 * Komanda (`scripts/ops/wave-control.mts`) skuplja činjenice (otisci fajlova,
 * stanje baze), a ovde se samo poredi. Svaka provera vraća `ok` i kratko
 * objašnjenje bez poslovnih podataka; iznosi se porede, ne ispisuju.
 */

const cents = (n) => Math.round(Number(n) * 100);

/** Procena prostora po izmerenom modelu (docs/b2b/34 §4). */
export const BYTES_PER_DOCUMENT = 1175;
export const BYTES_PER_LINE = 792;
export const STORAGE_LIMIT_BYTES = 512 * 1024 * 1024; // radna granica 0,5 GB (docs/b2b/40)

/**
 * @param {{
 *   manifest: { dokumenti: { sha256: string, stavki: number, parser: string, sifra_partnera: string }[] },
 *   files: { sha256: string, present: boolean, actualSha: string | null }[],
 *   repoParserVersion: string,
 *   db: { demoMarker: boolean, sizeBytes: number, alreadyImported: number,
 *         unmappedPartnerCodes: string[], pendingReview: number },
 * }} f
 */
export function preImportChecks(f) {
  const docs = f.manifest.dokumenti;
  const lines = docs.reduce((s, d) => s + d.stavki, 0);
  const projected = f.db.sizeBytes + docs.length * BYTES_PER_DOCUMENT + lines * BYTES_PER_LINE;
  const missing = f.files.filter((x) => !x.present).length;
  const changed = f.files.filter((x) => x.present && x.actualSha !== x.sha256).length;
  return [
    check("fajlovi talasa postoje i nepromenjeni", missing === 0 && changed === 0, `nedostaje ${missing}, promenjeno ${changed}`),
    check("verzija parsera = verzija iz manifesta", docs.every((d) => d.parser === f.repoParserVersion), f.repoParserVersion),
    check("baza nije demo", !f.db.demoMarker, f.db.demoMarker ? "dataset.kind = demo" : "bez demo oznake"),
    check("nijedan dokument talasa još nije uvezen", f.db.alreadyImported === 0, `već uvezeno: ${f.db.alreadyImported}`),
    check("svi partneri talasa povezani (šifra sa fakture, izdavalac)", f.db.unmappedPartnerCodes.length === 0, `nepovezano: ${f.db.unmappedPartnerCodes.length}`),
    check("nema dokumenata na ručnom pregledu za izdavaoca", f.db.pendingReview === 0, `na pregledu: ${f.db.pendingReview}`),
    check("procena posle talasa ispod radne granice 0,5 GB (rezerva 20 %)", projected < STORAGE_LIMIT_BYTES * 0.8,
      `sada ${(f.db.sizeBytes / 1048576).toFixed(1)} MB, posle ≈ ${(projected / 1048576).toFixed(1)} MB`),
  ];
}

/**
 * @param {{
 *   manifest: { kontrola: { dokumenata: number, stavki: number, neto: number, bruto: number },
 *               dokumenti: { sha256: string }[] },
 *   db: { documents: { sha256: string, valid: boolean, invoiceId: string | null, manualReview: string, revisionStatus: string }[],
 *         invoices: { count: number, lines: number, net: number, gross: number },
 *         invoicesInPeriodForIssuer: number, sizeBytesBefore: number | null, sizeBytesAfter: number },
 *   bizniSoft?: { broj: number, neto: number, pdv: number, bruto: number } | null,
 * }} f
 */
export function postImportChecks(f) {
  const want = new Set(f.manifest.dokumenti.map((d) => d.sha256));
  const found = f.db.documents.filter((d) => want.has(d.sha256));
  const k = f.manifest.kontrola;
  const out = [
    check("svaki dokument talasa je u bazi", found.length === want.size, `${found.length}/${want.size}`),
    check("svaki je ispravan i knjižen kao faktura", found.every((d) => d.valid && d.invoiceId), `neknjiženo: ${found.filter((d) => !(d.valid && d.invoiceId)).length}`),
    check("nijedan na ručnom pregledu ni u sukobu revizije", found.every((d) => d.manualReview !== "pending" && d.revisionStatus === "original"), ""),
    check("broj faktura = manifest", f.db.invoices.count === k.dokumenata, ""),
    check("broj stavki = manifest", f.db.invoices.lines === k.stavki, ""),
    check("neto = manifest (na paru)", cents(f.db.invoices.net) === cents(k.neto), ""),
    check("bruto = manifest (na paru)", cents(f.db.invoices.gross) === cents(k.bruto), ""),
    check("u periodu za izdavaoca nema faktura van talasa", f.db.invoicesInPeriodForIssuer === k.dokumenata, `u periodu: ${f.db.invoicesInPeriodForIssuer}`),
  ];
  if (f.bizniSoft) {
    // Nezavisna potvrda: BizniSoft, ne PDF arhiva.
    out.push(
      check("BizniSoft broj računa = baza", f.bizniSoft.broj === f.db.invoices.count, ""),
      check("BizniSoft neto = baza (na paru)", cents(f.bizniSoft.neto) === cents(f.db.invoices.net), ""),
      check("BizniSoft bruto = baza (na paru)", cents(f.bizniSoft.bruto) === cents(f.db.invoices.gross), ""),
      check("BizniSoft neto + PDV = bruto", Math.abs(cents(f.bizniSoft.neto) + cents(f.bizniSoft.pdv) - cents(f.bizniSoft.bruto)) <= 1, ""),
    );
  } else {
    out.push(check("BizniSoft kontrolni zbir", false, "nije dostavljen — talas se ne prihvata bez njega"));
  }
  const delta = f.db.sizeBytesBefore === null ? null : f.db.sizeBytesAfter - f.db.sizeBytesBefore;
  out.push(check("veličina baze ispod radne granice 0,5 GB", f.db.sizeBytesAfter < STORAGE_LIMIT_BYTES,
    `${(f.db.sizeBytesAfter / 1048576).toFixed(1)} MB${delta === null ? "" : `, promena ${(delta / 1048576).toFixed(1)} MB`}`));
  return out;
}

function check(name, ok, detail) {
  return { name, ok: Boolean(ok), detail };
}
