/**
 * Jednostavan list za kancelariju i povratak u pregledanu tabelu.
 *
 *   npx tsx scripts/ops/office-link-sheet.mts napravi --pregled ~/.carsystem-private/veze-talas-01.csv \
 *     --izlaz ~/.carsystem-private/kancelarija-veze-talas-01.csv
 *   npx tsx scripts/ops/office-link-sheet.mts vrati --pregled ~/.carsystem-private/veze-talas-01.csv \
 *     --list <list koji je kancelarija popunila> --izlaz ~/.carsystem-private/veze-talas-01-pregledano.csv
 *
 * List pokazuje samo ono što kancelarija proverava u BizniSoft-u: firmu, PIB,
 * šifru KAKO JE U BIZNISOFT-U, mesto i broj računa u talasu, uz kolone
 * „Potvrđujem (DA/NE)", „Napomena", „Proverio". Poslednja kolona je interna
 * oznaka reda i ne menja se. `vrati` odbija list u kome su firma, PIB ili šifra
 * izmenjeni, ili u kome je „DA" bez imena.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { parseSemicolonCsv, REVIEW_COLUMNS } from "../../lib/commercial/linkReviewFiles.mjs";

const [command, ...rest] = process.argv.slice(2);
const arg = (n: string) => { const i = rest.indexOf(`--${n}`); return i >= 0 ? rest[i + 1] : undefined; };
const repoRoot = path.resolve(import.meta.dirname, "../..");
const priv = (p?: string) => {
  if (!p) throw new Error("Nedostaje putanja.");
  const abs = path.resolve(p.replace(/^~/, homedir()));
  if (abs.startsWith(repoRoot + path.sep)) throw new Error("Fajl sa podacima kupaca ne sme biti u repozitorijumu.");
  return abs;
};
const SHEET = ["Br.", "Firma", "PIB", "Šifra u BizniSoft-u", "Mesto", "Računa u talasu", "Potvrđujem (DA/NE)", "Napomena", "Proverio (ime)", "Oznaka (ne menjati)"];
const cell = (v: unknown) => { const s = String(v ?? ""); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const write = (file: string, rows: unknown[][]) =>
  writeFileSync(file, "﻿" + rows.map((r) => r.map(cell).join(";")).join("\r\n") + "\r\n", { mode: 0o600 });

function readRows(file: string, columns: readonly string[]) {
  const [head, ...rows] = parseSemicolonCsv(readFileSync(file, "utf8"));
  if (!head || columns.some((c, i) => (head[i] ?? "").trim() !== c)) throw new Error("Kolone se razlikuju od očekivanih — zaustavljeno.");
  return rows.map((r) => Object.fromEntries(columns.map((c, i) => [c, (r[i] ?? "").trim()])));
}

function main() {
  const review = readRows(priv(arg("pregled")), REVIEW_COLUMNS);
  if (command === "napravi") {
    const rows = review.map((r, i) => [i + 1, r.naziv_u_sifarniku, r.pib, r.sifra_u_sifarniku, r.mesto, r.dokumenata, "", "", "", r.kljuc]);
    write(priv(arg("izlaz")), [SHEET, ...rows]);
    console.log(`List za kancelariju: ${rows.length} firmi.`);
  } else if (command === "vrati") {
    const sheet = readRows(priv(arg("list")), SHEET);
    const byKey = new Map(sheet.map((r) => [r["Oznaka (ne menjati)"], r]));
    let potvrdi = 0, odbij = 0, prazno = 0;
    const out = review.map((r, i) => {
      const s = byKey.get(r.kljuc);
      if (!s) throw new Error(`Red ${i + 1} nedostaje u listu kancelarije — zaustavljeno.`);
      if (s.Firma !== r.naziv_u_sifarniku || s.PIB !== r.pib || s["Šifra u BizniSoft-u"] !== r.sifra_u_sifarniku) {
        throw new Error(`Red ${s["Br."]}: firma, PIB ili šifra su izmenjeni u listu — zaustavljeno.`);
      }
      const d = s["Potvrđujem (DA/NE)"].toUpperCase();
      if (d && d !== "DA" && d !== "NE") throw new Error(`Red ${s["Br."]}: u koloni „Potvrđujem" sme stajati samo DA ili NE.`);
      if (d === "DA" && s["Proverio (ime)"].length < 3) throw new Error(`Red ${s["Br."]}: „DA" traži ime osobe koja je proverila.`);
      if (d === "DA") potvrdi++; else if (d === "NE") odbij++; else prazno++;
      return REVIEW_COLUMNS.map((c) => (c === "odluka" ? (d === "DA" ? "potvrdi" : d === "NE" ? "odbij" : "")
        : c === "potvrdio" ? s["Proverio (ime)"] : c === "napomena" ? s.Napomena : r[c]));
    });
    write(priv(arg("izlaz")), [[...REVIEW_COLUMNS], ...out]);
    console.log(`Pregledana tabela: potvrđeno ${potvrdi}, odbijeno ${odbij}, bez odluke ${prazno}.`);
  } else {
    console.error("Upotreba: office-link-sheet.mts napravi|vrati …");
    process.exit(2);
  }
}

try {
  main();
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}
