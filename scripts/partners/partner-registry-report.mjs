#!/usr/bin/env node
/**
 * Izveštaj o registru BizniSoft partnera — SAMO ČITANJE.
 *
 *   node scripts/partners/partner-registry-report.mjs --file "Kupci_BizniSoft_priprema.xlsx"
 *   node scripts/partners/partner-registry-report.mjs --file izvoz.xlsx --previous stari.xlsx
 *
 * Ne otvara vezu ka bazi, ne šalje ništa na mrežu i ne menja ulazni fajl.
 * Izlaz ide u `_incoming/partners/<datum>/` (van Gita — `.gitignore`), jer
 * radne liste sadrže adrese e-pošte i telefone iz izvora.
 *
 * Fajlovi:
 *   sazetak.json                  brojke i vrste nalaza, bez ličnih podataka
 *   nalazi.csv                    šta treba pogledati, po šifri partnera
 *   radna-lista-kontakata.csv     jedan red po partneru; kolone za potvrdu popunjava čovek
 *   pomocna-lista-predlozi.csv    veze pomoćne liste (jak identifikator ili samo napomena)
 *   promene.csv                   (uz --previous) razlike između dva izvoza
 */

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { readXlsx } from "../../lib/import/xlsx/readXlsx.mjs";
import {
  analyzePartners,
  CONTACT_WORKLIST_HEADERS,
  contactWorklist,
  diffPartnerSnapshots,
  matchAuxiliary,
  parsePartnerWorkbook,
  summarizePartners,
  toCsv,
} from "../../lib/partners/partnerRegistry.mjs";

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const file = arg("file");
if (!file) {
  console.error("Upotreba: --file <izvoz.xlsx> [--previous <raniji.xlsx>] [--out <folder>]");
  process.exit(2);
}

const bytes = readFileSync(resolve(file));
const parsed = parsePartnerWorkbook(readXlsx(bytes));
const findings = analyzePartners(parsed.partners);
const summary = summarizePartners(parsed.partners, parsed.aux);
const links = matchAuxiliary(parsed.aux, parsed.partners);

const day = new Date().toISOString().slice(0, 10);
const out = resolve(arg("out") ?? join("_incoming", "partners", day));
mkdirSync(out, { recursive: true });

/** @param {readonly {kind: string}[]} items */
const countKinds = (items) =>
  items.reduce((acc, f) => ({ ...acc, [f.kind]: (acc[f.kind] ?? 0) + 1 }), /** @type {Record<string, number>} */ ({}));

const report = {
  file: basename(file),
  sha256: createHash("sha256").update(bytes).digest("hex"),
  profile: parsed.profile,
  summary,
  sheetMismatches: parsed.sheetMismatches.length,
  findings: countKinds(findings),
  blocking: findings.filter((f) => f.severity === "blocking").length,
  auxiliaryLinks: {
    strong: links.filter((l) => l.strength === "strong").length,
    hintOnly: links.filter((l) => l.strength === "hint_only").length,
    auxWithoutAnyLink: parsed.aux.filter((a) => !links.some((l) => l.auxId === a.auxId)).length,
  },
  note:
    "Kandidat = kartica ima šifru komercijaliste. Nije dokaz kupovine. E-mail sa kartice nije ovlašćen kontakt.",
};

const names = new Map(parsed.partners.map((p) => [p.partnerCode, p.name]));
writeFileSync(join(out, "sazetak.json"), `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(
  join(out, "nalazi.csv"),
  toCsv(
    ["Vrsta", "Ozbiljnost", "Šifre partnera", "Nazivi", "Objašnjenje"],
    findings.map((f) => [
      f.kind,
      f.severity,
      f.partnerCodes.join(", "),
      f.partnerCodes.map((c) => names.get(c) ?? "").join(" | "),
      f.detail,
    ]),
  ),
);
writeFileSync(
  join(out, "radna-lista-kontakata.csv"),
  toCsv(CONTACT_WORKLIST_HEADERS, contactWorklist(parsed.partners, findings)),
);
writeFileSync(
  join(out, "pomocna-lista-predlozi.csv"),
  toCsv(
    ["ID pomoćne liste", "Naziv (pomoćna)", "BizniSoft šifra", "Naziv (BizniSoft)", "Osnov", "Snaga", "Odluka (upisuje čovek)"],
    links.map((l) => [l.auxId, l.auxName, l.partnerCode, l.partnerName, l.basis, l.strength, ""]),
  ),
);

const previous = arg("previous");
if (previous) {
  const prev = parsePartnerWorkbook(readXlsx(readFileSync(resolve(previous))));
  const changes = diffPartnerSnapshots(prev.partners, parsed.partners);
  writeFileSync(
    join(out, "promene.csv"),
    toCsv(
      ["Šifra", "Promena", "Ozbiljnost", "Pre", "Posle"],
      changes.map((c) => [c.partnerCode, c.change, c.severity, JSON.stringify(c.before), JSON.stringify(c.after)]),
    ),
  );
  report.changes = countKinds(changes.map((c) => ({ kind: c.change })));
  writeFileSync(join(out, "sazetak.json"), `${JSON.stringify(report, null, 2)}\n`);
}

console.log(JSON.stringify({ ...report, out }, null, 2));
if (report.blocking > 0) process.exitCode = 1;
