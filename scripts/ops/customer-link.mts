/**
 * Veza kupaca za talas istorijskih faktura — PLAN i pregledna tabela, bez upisa.
 *
 *   [DATABASE_URL=<pilot, carsystem_app>] npx tsx --tsconfig db/integration/tsconfig.test.json \
 *     scripts/ops/customer-link.mts plan --sifarnik ~/Desktop/Kupci.xlsx \
 *     --talas ~/.carsystem-private/talas-01-2025-01.json --izdavalac CSRM \
 *     [--izlaz ~/.carsystem-private/veze-talas-01.csv]
 *
 * Primena potvrđenih redova NIJE ovde: ide kroz portal (`/portal/kupci/veze`),
 * gde je akter prijavljen korisnik sa svežim drugim faktorom. Komanda ne prima
 * ime naloga i ne upisuje ništa u bazu (uz DATABASE_URL samo čita stanje).
 * Fajlovi sa podacima kupaca idu samo van repozitorijuma.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { readXlsx } from "../../lib/import/xlsx/readXlsx.mjs";
import { planCustomerLinks } from "../../lib/commercial/customerLinkPlan.mjs";
import { REVIEW_COLUMNS, registerFromRows } from "../../lib/commercial/linkReviewFiles.mjs";

const [command, ...rest] = process.argv.slice(2);
const arg = (name: string) => { const i = rest.indexOf(`--${name}`); return i >= 0 ? rest[i + 1] : undefined; };
const expand = (p: string) => p.replace(/^~/, homedir());
const repoRoot = path.resolve(import.meta.dirname, "../..");
const privatePath = (p: string) => {
  const abs = path.resolve(expand(p));
  if (abs.startsWith(repoRoot + path.sep)) throw new Error("Fajl sa podacima kupaca ne sme biti u repozitorijumu.");
  return abs;
};
const need = (name: string) => { const v = arg(name); if (!v) throw new Error(`Nedostaje --${name}.`); return v; };

function loadRegister(file: string) {
  const [sheet] = readXlsx(readFileSync(privatePath(file)));
  return registerFromRows(sheet?.rows ?? []);
}

function loadWavePartners(file: string) {
  const wave = JSON.parse(readFileSync(privatePath(file), "utf8")) as { dokumenti: { sifra_partnera: string; pib: string | null }[] };
  const map = new Map<string, { code: string; pib: string | null; documents: number }>();
  for (const d of wave.dokumenti) {
    const k = `${d.sifra_partnera}|${d.pib}`;
    const cur = map.get(k) ?? { code: d.sifra_partnera, pib: d.pib, documents: 0 };
    cur.documents++;
    map.set(k, cur);
  }
  return [...map.values()];
}

const COLUMNS = REVIEW_COLUMNS;
const csvCell = (v: unknown) => { const s = v === null || v === undefined ? "" : String(v); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const PREDLOG: Record<string, string> = {
  create_customer_and_link: "otvori kupca i poveži šifru",
  link_existing_customer: "poveži šifru sa postojećim kupcem (isti PIB)",
  already_linked: "već povezano — ništa",
};


async function main() {
  const issuerCode = need("izdavalac");
  const register = loadRegister(need("sifarnik"));
  const invoicePartners = loadWavePartners(need("talas"));

  if (command === "plan") {
    const result = process.env.DATABASE_URL
      ? await (await import("../../lib/commercial/customerLinkApply.ts")).planFromDatabase({ issuerCode, register, invoicePartners })
      : planCustomerLinks({ issuerCode, register, invoicePartners, existing: { customersByPib: new Map(), identifiers: new Map() } });
    const out = privatePath(arg("izlaz") ?? "~/.carsystem-private/veze-predlog.csv");
    const rows = result.proposals.map((p) => [p.key, p.invoiceCode, p.registerCode, p.pib, p.name, p.city, p.documents,
      PREDLOG[p.action], p.existingCustomerName ?? "", "", "", ""]);
    writeFileSync(out, "﻿" + [COLUMNS.join(";"), ...rows.map((r) => r.map(csvCell).join(";"))].join("\n") + "\n", { mode: 0o600 });
    const excludedOut = out.replace(/\.csv$/, "-izdvojeno.json");
    writeFileSync(excludedOut, JSON.stringify(result.excluded, null, 1), { mode: 0o600 });
    const tally: Record<string, number> = {};
    for (const p of result.proposals) tally[p.action] = (tally[p.action] ?? 0) + 1;
    const ex: Record<string, number> = {};
    for (const e of result.excluded) ex[e.reason] = (ex[e.reason] ?? 0) + 1;
    console.log(`partnera u talasu: ${invoicePartners.length}; baza: ${process.env.DATABASE_URL ? "pročitana" : "nije zadata (prazno stanje)"}`);
    console.log("predlozi:", JSON.stringify(tally));
    console.log("izdvojeno:", JSON.stringify(ex));
    console.log("Tabela za pregled i izdvojeni slučajevi upisani privatno; putanje se ne ispisuju.");
    return;
  }

  if (command === "apply") {
    throw new Error("Primena se ne radi iz komandne linije: otvorite /portal/kupci/veze (prijava sa drugim faktorom).");
  }

  console.error("Upotreba: customer-link.mts plan … (vidi zaglavlje fajla); primena ide kroz /portal/kupci/veze.");
  process.exit(2);
}

main().catch((error: unknown) => {
  console.error((error as Error).message);
  process.exit(1);
});
