/**
 * Veza kupaca za talas istorijskih faktura: predlog → pregled → potvrda.
 *
 *   npx tsx --tsconfig db/integration/tsconfig.test.json scripts/ops/customer-link.mts plan \
 *     --sifarnik ~/Desktop/Kupci.xlsx --talas ~/.carsystem-private/talas-01-2025-01.json \
 *     --izdavalac <oznaka kao pri uploadu> [--izlaz ~/.carsystem-private/veze-talas-01.csv]
 *
 *   DATABASE_URL=… npx tsx … customer-link.mts apply --sifarnik … --talas … --izdavalac … \
 *     --pregled ~/.carsystem-private/veze-talas-01.csv --nalog <e-adresa kancelarije> [--upisi]
 *
 * `plan` bez DATABASE_URL radi nad praznom bazom (samo čitanje fajlova). `apply`
 * je probni prolaz dok se ne doda `--upisi`; primenjuje SAMO redove sa
 * „odluka = potvrdi" i upisanim imenom u „potvrdio", i samo ako se otisak
 * predloga poklapa sa stanjem baze u tom trenutku. Nalozi za prijavu se ne prave.
 * Fajlovi sa podacima kupaca idu samo van repozitorijuma.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { readXlsx } from "../../lib/import/xlsx/readXlsx.mjs";
import { planCustomerLinks } from "../../lib/commercial/customerLinkPlan.mjs";

const [command, ...rest] = process.argv.slice(2);
const arg = (name: string) => { const i = rest.indexOf(`--${name}`); return i >= 0 ? rest[i + 1] : undefined; };
const flag = (name: string) => rest.includes(`--${name}`);
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
  const [head, ...rows] = sheet.rows;
  const col = (label: string) => { const i = head.indexOf(label); if (i < 0) throw new Error(`Šifarnik nema kolonu „${label}".`); return i; };
  const [iC, iP, iN, iM, iB] = [col("Šifra"), col("PIB / JMBG"), col("Naziv partnera"), col("Mesto"), col("Blokiran")];
  return rows.filter((r) => r[iC]).map((r) => ({
    code: String(r[iC]).trim(), pib: r[iP]?.trim() || null, name: r[iN]?.trim() || null, city: r[iM]?.trim() || null, blocked: r[iB] === "True",
  }));
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

const COLUMNS = ["kljuc", "sifra_na_fakturi", "sifra_u_sifarniku", "pib", "naziv_u_sifarniku", "mesto", "dokumenata",
  "predlog", "postojeci_kupac", "odluka", "potvrdio", "napomena"] as const;
const csvCell = (v: unknown) => { const s = v === null || v === undefined ? "" : String(v); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const PREDLOG: Record<string, string> = {
  create_customer_and_link: "otvori kupca i poveži šifru",
  link_existing_customer: "poveži šifru sa postojećim kupcem (isti PIB)",
  already_linked: "već povezano — ništa",
};

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter(Boolean);
  const split = (line: string) => {
    const out: string[] = []; let cur = ""; let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
      else if (c === '"') q = true; else if (c === ";") { out.push(cur); cur = ""; } else cur += c;
    }
    out.push(cur); return out;
  };
  const head = split(lines[0]);
  return lines.slice(1).map((l) => Object.fromEntries(split(l).map((v, i) => [head[i], v])));
}

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
    if (!process.env.DATABASE_URL) throw new Error("apply traži DATABASE_URL ciljne (pilot) baze.");
    const write = flag("upisi");
    const email = need("nalog").trim().toLowerCase();
    const { getDb } = await import("../../db/client.ts");
    const { sql } = await import("drizzle-orm");
    const db = getDb();
    const [user] = (await db.execute(sql`SELECT id, name, role, active FROM users WHERE lower(email) = ${email}`)) as unknown as
      { id: string; name: string; role: string; active: boolean }[];
    if (!user || !user.active || !["gazda", "kancelarija"].includes(user.role)) {
      throw new Error("Nalog nije aktivan nalog Vlasnika ili kancelarije.");
    }
    // Stvarni PIB-ovi ne smeju u bazu označenu kao demo.
    const [demo] = (await db.execute(sql`SELECT 1 AS d FROM system_settings WHERE key = 'dataset.kind' AND value->>'kind' = 'demo'`)) as unknown as { d: number }[];
    if (demo && invoicePartners.some((p) => (p.pib ?? "") >= "010000000")) {
      throw new Error("Ciljna baza je DEMO, a talas ima stvarne PIB-ove — odbijeno.");
    }
    const reviewed = parseCsv(readFileSync(privatePath(need("pregled")), "utf8"));
    const decisions = reviewed.map((r) => ({
      key: r.kljuc, decision: (r.odluka?.trim().toLowerCase() === "potvrdi" ? "potvrdi" : r.odluka?.trim().toLowerCase() === "odbij" ? "odbij" : "") as "potvrdi" | "odbij" | "",
      confirmedBy: r.potvrdio ?? "",
    }));
    const { applyConfirmedLinks } = await import("../../lib/commercial/customerLinkApply.ts");
    const outcomes = await applyConfirmedLinks({ issuerCode, register, invoicePartners, decisions, dryRun: !write },
      { id: user.id, name: user.name, role: user.role });
    const tally: Record<string, number> = {};
    for (const o of outcomes) tally[o.result] = (tally[o.result] ?? 0) + 1;
    console.log(write ? "UPISANO:" : "PROBNI PROLAZ (ništa nije upisano; dodajte --upisi):", JSON.stringify(tally));
    const { closeDb } = await import("../../db/client.ts");
    await closeDb();
    return;
  }

  console.error("Upotreba: customer-link.mts plan|apply … (vidi zaglavlje fajla)");
  process.exit(2);
}

main().catch((error: unknown) => {
  console.error((error as Error).message);
  process.exit(1);
});
