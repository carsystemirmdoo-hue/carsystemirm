/**
 * Potvrđena pakovanja (0047): predlog iz BizniSoft naziva i upis POSLE potvrde čoveka.
 *
 *   node scripts/catalog/pack-sizes.mjs predlog <sifarnik.json> <portal-artikli.json> <izlaz.csv>
 *   node scripts/catalog/pack-sizes.mjs primeni <potvrde.csv> --db <url> --potvrdio <email> [--upis]
 *
 * `predlog` ništa ne upisuje: za aktivne artikle sa mernom JM (LIT, KG) čita
 * meru iz naziva („… 5L“, „0,5 L“) kao PREDLOG; nejasno („5/1“, bez mere) ostaje
 * nerešeno. 3M, sia i Molotow se preskaču. Ulaz i izlaz su PRIVATNI.
 *
 * `primeni` čita samo redove sa `potvrda = da`; proverava da artikal postoji i da
 * je JM u bazi ista kao u potvrdi; bez `--upis` samo ispisuje plan. Production
 * baza se ne dira bez posebnog odobrenja vlasnika.
 */
import { readFileSync, writeFileSync } from "node:fs";

const [cmd, ...rest] = process.argv.slice(2);
const MEASURE = ["LIT", "KG"];
const EXCLUDED = /^(3M|SIA|SIAONE|MOLOTOW)\b/i;
const norm = (s) => String(s ?? "").toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

/** Mera iz naziva u JM artikla. Samo jedna jasna mera; „5/1“ i slično → null. */
export function measureFromName(name, unit) {
  const t = norm(name);
  if (/\b\d+\/\d+\b/.test(t)) return null;
  const all = [...t.matchAll(/(\d+(?:[.,]\d+)?)\s*(ML|L|LIT|LT|G|GR|KG)\b/g)];
  if (all.length !== 1) return null;
  const n = Number(all[0][1].replace(",", "."));
  const u = all[0][2];
  if (unit === "LIT") return u === "ML" ? n / 1000 : ["L", "LIT", "LT"].includes(u) ? n : null;
  if (unit === "KG") return ["G", "GR"].includes(u) ? n / 1000 : u === "KG" ? n : null;
  return null;
}

const csvCell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

if (cmd === "predlog") {
  const [sifPath, portalPath, out] = rest;
  const portal = new Map(JSON.parse(readFileSync(portalPath, "utf8")).map((a) => [a.code, a]));
  const rows = [];
  for (const r of JSON.parse(readFileSync(sifPath, "utf8"))) {
    const p = portal.get(r.code);
    if (!p || !(p.kupaca_12m > 0) || p.van_programa || EXCLUDED.test(norm(r.naziv))) continue;
    const unit = String(p.unit ?? r.jm ?? "").toUpperCase();
    if (!MEASURE.includes(unit)) continue;
    const q = measureFromName(r.naziv, unit);
    rows.push({
      sifra: r.code, naziv: r.naziv, jm: unit,
      predlog_kolicina: q ?? "", predlog_oznaka: q ? `${String(q).replace(".", ",")} ${unit === "LIT" ? "L" : "kg"}` : "",
      izvor: q ? "mera iz BizniSoft naziva — PREDLOG, nije potvrda" : "nerešeno: mera nije jasna iz naziva",
      potvrda: "", dokaz: "",
    });
  }
  const cols = ["sifra", "naziv", "jm", "predlog_kolicina", "predlog_oznaka", "izvor", "potvrda", "dokaz"];
  writeFileSync(out, "﻿" + [cols.join(";"), ...rows.map((o) => cols.map((c) => csvCell(o[c])).join(";"))].join("\n"));
  console.log(JSON.stringify({ aktivnih_merna_jm: rows.length, sa_predlogom: rows.filter((r) => r.predlog_kolicina !== "").length, nereseno: rows.filter((r) => r.predlog_kolicina === "").length }));
} else if (cmd === "primeni") {
  const file = rest[0];
  const arg = (k) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : null; };
  const url = arg("--db");
  const by = arg("--potvrdio");
  const write = rest.includes("--upis");
  if (!file || !url || !by) {
    console.error("Upotreba: primeni <potvrde.csv> --db <url> --potvrdio <email> [--upis]");
    process.exit(1);
  }
  const text = readFileSync(file, "utf8").replace(/^﻿/, "");
  const [head, ...lines] = text.split(/\r?\n/).filter(Boolean);
  const cols = head.split(";").map((c) => c.replace(/^"|"$/g, ""));
  const parse = (l) => Object.fromEntries((l.match(/("([^"]|"")*"|[^;]*)(;|$)/g) ?? []).slice(0, cols.length).map((c, i) => [cols[i], c.replace(/;$/, "").replace(/^"|"$/g, "").replace(/""/g, '"')]));
  const rows = lines.map(parse).filter((r) => /^da$/i.test(String(r.potvrda).trim()));
  const { default: postgres } = await import("postgres");
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    const [user] = await sql`SELECT id FROM users WHERE lower(email) = lower(${by}) AND active`;
    if (!user) throw new Error(`Nema aktivnog zaposlenog ${by}.`);
    const plan = [];
    for (const r of rows) {
      const q = Number(String(r.predlog_kolicina).replace(",", "."));
      const [a] = await sql`SELECT id, unit FROM articles WHERE code = ${r.sifra}`;
      const piece = ["KOM", "KT"].includes(String(r.jm).toUpperCase());
      const problem = !a ? "artikal ne postoji" : String(a.unit ?? "").toUpperCase() !== String(r.jm).toUpperCase() ? `JM u bazi ${a.unit} ≠ ${r.jm}` : !(q > 0) ? "količina nije ispravna" : piece && !Number.isInteger(q) ? "JM KOM: količina pakovanja je broj komada (zapremina ide u oznaku)" : !String(r.dokaz).trim() ? "nedostaje dokaz" : null;
      plan.push({ sifra: r.sifra, kolicina: q, jm: r.jm, oznaka: r.predlog_oznaka, problem, id: a?.id, dokaz: r.dokaz });
    }
    const ok = plan.filter((p) => !p.problem);
    console.log(JSON.stringify({ potvrdjenih_redova: rows.length, spremno: ok.length, odbijeno: plan.filter((p) => p.problem).map((p) => `${p.sifra}: ${p.problem}`) }, null, 1));
    if (write && ok.length) {
      await sql.begin(async (tx) => {
        for (const p of ok) {
          await tx`INSERT INTO article_pack_sizes (article_id, pack_quantity, unit, label, evidence, confirmed_by)
                   VALUES (${p.id}, ${p.kolicina}, ${String(p.jm).toUpperCase()}, ${p.oznaka || `${p.kolicina} ${p.jm}`}, ${p.dokaz}, ${user.id})
                   ON CONFLICT (article_id) DO UPDATE SET pack_quantity = EXCLUDED.pack_quantity, unit = EXCLUDED.unit, label = EXCLUDED.label,
                     evidence = EXCLUDED.evidence, confirmed_by = EXCLUDED.confirmed_by, confirmed_at = now()`;
        }
      });
      console.log(`Upisano: ${ok.length}.`);
    } else if (!write) console.log("Samo plan (bez --upis ništa nije upisano).");
  } finally {
    await sql.end();
  }
} else {
  console.error("Komande: predlog | primeni");
  process.exit(1);
}
