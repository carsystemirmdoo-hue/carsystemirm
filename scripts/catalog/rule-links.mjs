/**
 * Veze po potvrđenim pravilima vlasnika (2026-10-11) — samo Carsystem i Befar.
 *
 *   node scripts/catalog/rule-links.mjs <sifarnik.json> <portal-artikli.json> <izlaz-folder>
 *
 *   Carsystem: BizniSoft šifra = proizvođačka šifra varijante bez tačke (152.580 → 152580).
 *   Befar:     BizniSoft šifra = proizvođačka šifra varijante dopunjena nulama sleva do 6 cifara.
 * Pravilo potvrđuje IDENTITET, ne zapreminu, sadržaj kesice/kutije ni minimum. Ne dodaje
 * nove ni neaktivne artikle u katalog. Izlaz je PRIVATAN:
 *   - plan-veza.json (format za apply-confirmed-links.mts; pakovanje null = podrazumevano
 *     1 komad za KOM, a merna JM ostaje bez preračuna dok se zapremina ne potvrdi);
 *   - pregled.csv (svi kandidati sa statusom i razlogom).
 * Ništa se ne upisuje.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const [sifPath, portalPath, outDir] = process.argv.slice(2);
if (!sifPath || !portalPath || !outDir) {
  console.error("Upotreba: <sifarnik.json> <portal-artikli.json> <izlaz-folder>");
  process.exit(1);
}
const ROOT = new URL("../../", import.meta.url).pathname;
const read = (f) => JSON.parse(readFileSync(`${ROOT}${f}`, "utf8"));
const list = (d) => (Array.isArray(d) ? d : d.products ?? []);
const removed = new Set(read("data/catalog/removed-from-customer-catalog.json").records.map((r) => r.slug));
const EXCLUDED = /^(3M|SIA|SIAONE|MOLOTOW)\b/i;
const norm = (s) => String(s ?? "").toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

/** Kataloški indeks: BizniSoft-oblik šifre → kandidati. */
const index = new Map();
const legacy = new Map();
const add = (map, key, c) => map.set(key, [...(map.get(key) ?? []), c]);
for (const p of list(read("data/carsystem-catalog-products.generated.json"))) {
  const multi = (p.variants ?? []).length > 1;
  for (const v of p.variants ?? []) {
    const digits = String(v.articleNumber ?? "").replace(/\./g, "");
    if (!/^\d+$/.test(digits)) continue;
    add(index, digits, { brand: "carsystem", slug: p.slug, name: p.name, variant: multi ? v.articleNumber : null, label: v.label, original: v.articleNumber, salesPack: v.salesPack ?? null, removed: removed.has(p.slug) });
  }
  for (const n of p.legacyArticleNumbers ?? []) {
    const digits = String(n).replace(/\./g, "");
    if (/^\d+$/.test(digits)) add(legacy, digits, { slug: p.slug, original: n });
  }
}
for (const p of list(read("data/befar-catalog-products.generated.json"))) {
  const multi = (p.variants ?? []).length > 1;
  for (const v of p.variants ?? []) {
    if (!/^\d+$/.test(String(v.code ?? ""))) continue;
    add(index, String(v.code).padStart(6, "0"), { brand: "befar", slug: p.slug, name: p.name, variant: multi ? v.code : null, label: v.label, original: v.code, salesPack: null, removed: removed.has(p.slug) });
  }
}

const BRAND_OF_NAME = (name) => {
  const w = norm(name).split(/\s+/)[0];
  if (["CS", "CARSYSTEM", "RUPES"].includes(w)) return "carsystem";
  if (["BEFAR", "LEO"].includes(w)) return "befar";
  return null;
};
const portal = new Map(JSON.parse(readFileSync(portalPath, "utf8")).map((a) => [a.code, a]));
const sif = JSON.parse(readFileSync(sifPath, "utf8"));
const out = [];
const plan = [];
const planKp = [];
const byTarget = new Map();
for (const r of sif) {
  const hits = index.get(r.code) ?? [];
  const old = legacy.get(r.code) ?? [];
  if (!hits.length && !old.length) continue;
  const p = portal.get(r.code);
  const nameBrand = BRAND_OF_NAME(r.naziv);
  const row = { sifra: r.code, naziv: r.naziv, jm: p?.unit ?? r.jm, u_portalu: Boolean(p), prodato_12m: p?.kupaca_12m ?? 0, kandidati: hits.map((h) => `${h.name} — ${h.label ?? ""} (${h.original}; ${h.slug})`).join(" | "), stari_broj: old.map((o) => `${o.slug} (${o.original})`).join(" | ") };
  let status, why;
  if (EXCLUDED.test(norm(r.naziv)) || p?.van_programa) [status, why] = ["izostavljeno", "van programa (3M/sia/Molotow ili odluka)"];
  else if (!hits.length) [status, why] = ["predlog — stari broj", "poklapa se samo sa starim kataloškim brojem; pravilo važi za važeću šifru"];
  else if (hits.length > 1) [status, why] = ["sukob — višestruko poklapanje", "ista šifra kod više kataloških varijanti"];
  else if (hits[0].removed) [status, why] = ["izostavljeno", "kartica je uklonjena iz kataloga za kupce"];
  else if (nameBrand && nameBrand !== hits[0].brand) [status, why] = ["sukob — brend", `naziv ukazuje na ${nameBrand}, šifra na ${hits[0].brand}`];
  else if (!nameBrand) [status, why] = ["provera — naziv bez brenda", "šifra se poklapa, ali naziv ne nosi oznaku brenda (CS/BEFAR…): uporediti naziv i kataloški proizvod (slučajno ista šifra je moguća)"];
  else if (!p) [status, why] = ["nije u portalu", "artikal postoji samo u šifarniku (nema ga u portalu) — ne dodaje se"];
  else if (!(p.kupaca_12m > 0)) [status, why] = ["bez prodaje poslednjih 12 meseci", "veza po pravilu postoji; izostavljeno iz prvog upisa (ne uklanja se iz kataloga)"];
  else {
    const piece = ["KOM", "KT"].includes(String(p.unit).toUpperCase());
    const sp = Number(hits[0].salesPack);
    const entry = { sifra: r.code, slug: hits[0].slug, varijanta: hits[0].variant, jm: p.unit, pakovanje: null, izvor: `Pravilo vlasnika 2026-10-11 (${hits[0].brand}: šifra = ${hits[0].original})` };
    if (piece && sp > 1) {
      // Katalog: prodajna jedinica sadrži više komada (KP). Da li je 1 KOM u BizniSoftu jedan komad ili cela
      // jedinica od KP komada nije potvrđeno — veza po pravilu da, upis tek uz potvrdu prodajne jedinice.
      [status, why] = ["veza da — prodajna jedinica nepotvrđena", `KOM; katalog KP=${hits[0].salesPack}: potvrditi da li je 1 KOM = 1 komad ili jedinica od ${hits[0].salesPack}`];
      planKp.push(entry);
      out.push({ ...row, status, razlog: why });
      continue;
    }
    [status, why] = ["spremno — pravilo", piece ? "KOM: 1 pakovanje = 1 komad" : `merna JM ${p.unit}: veza da, zapremina nije potvrđena — do potvrde upit`];
    plan.push({ sifra: r.code, slug: hits[0].slug, varijanta: hits[0].variant, jm: p.unit, pakovanje: null, izvor: `Pravilo vlasnika 2026-10-11 (${hits[0].brand}: šifra = ${hits[0].original})` });
    const t = `${hits[0].slug}|${hits[0].variant ?? ""}`;
    byTarget.set(t, [...(byTarget.get(t) ?? []), r.code]);
  }
  out.push({ ...row, status, razlog: why });
}
// Više BizniSoft artikala na istoj varijanti: dozvoljeno (npr. dva pakovanja), ali se izdvaja za pregled.
for (const o of out) {
  if (!o.status.startsWith("spremno")) continue;
  const t = plan.find((x) => x.sifra === o.sifra);
  if (!t) continue;
  const others = byTarget.get(`${t.slug}|${t.varijanta ?? ""}`).filter((c) => c !== o.sifra);
  if (others.length) o.razlog += `; ista varijanta i za: ${others.join(", ")}`;
}
mkdirSync(outDir, { recursive: true });
writeFileSync(`${outDir}/plan-veza.json`, JSON.stringify({ izvor: "Pravilo vlasnika 2026-10-11", veze: plan }, null, 1));
writeFileSync(`${outDir}/plan-veza-kp-ceka.json`, JSON.stringify({ izvor: "Pravilo vlasnika 2026-10-11 — ČEKA potvrdu prodajne jedinice (KP>1)", veze: planKp }, null, 1));
const cols = ["sifra", "naziv", "jm", "u_portalu", "prodato_12m", "status", "razlog", "kandidati", "stari_broj"];
writeFileSync(`${outDir}/pregled.csv`, "﻿" + [cols.join(";"), ...out.map((o) => cols.map((c) => `"${String(o[c] ?? "").replace(/"/g, '""')}"`).join(";"))].join("\n"));
const count = {};
for (const o of out) count[o.status] = (count[o.status] ?? 0) + 1;
console.log(JSON.stringify({ kandidata: out.length, ...count, isti_cilj_vise_artikala: [...byTarget.values()].filter((v) => v.length > 1).length }, null, 1));
