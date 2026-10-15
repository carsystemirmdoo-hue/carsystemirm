/**
 * Predlozi veza BizniSoft artikal → kataloški proizvod/varijanta (dok. 61, K1).
 *
 *   node scripts/catalog/biznisoft-catalog-proposals.mjs <sifarnik.json> <portal-artikli.json> <izlaz-folder>
 *
 * Ulazi su PRIVATNI (izvoz šifarnika i read-only snimak artikala portala); izlaz
 * ide u privatni folder. Ništa se ne upisuje u bazu i ništa se ne potvrđuje:
 * svaki red je „predlog“ ili „nerešeno“, potvrdu daje čovek (ekran Mapiranja
 * artikala).
 *
 * Dokazi, od najjačeg:
 *   E1  BizniSoft šifra = kod varijante u katalogu (isti brend) — npr. Befar —
 *       ili kataloški broj proizvođača bez tačke (Carsystem 152.580 = 152580).
 *   E2  kod proizvođača iz kataloga stoji kao CELA reč u BizniSoft nazivu
 *       (isti brend) — npr. „NORBIN LAK N15-V20 VOC 4L“ ↔ Norbin N15-V20.
 *   E3  samo sličan naziv u istom brendu — SLAB dokaz, nikad sam ne odlučuje.
 * Zapremina/masa iz naziva se poredi sa varijantom; razlika se upisuje.
 * „Kataloški broj“ iz izvoza se NE koristi kao broj proizvođača (uglavnom
 * ponavlja internu šifru).
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";

const [sifarnikPath, portalPath, outDir] = process.argv.slice(2);
if (!sifarnikPath || !portalPath || !outDir) {
  console.error("Upotreba: <sifarnik.json> <portal-artikli.json> <izlaz-folder>");
  process.exit(1);
}
const ROOT = new URL("../../", import.meta.url).pathname;

/** Prva reč BizniSoft naziva → katalog (fajl). Nepoznat prefiks = bez brenda. */
const PREFIX = {
  CS: "carsystem", CARSYSTEM: "carsystem", RM: "rm", "R-M": "rm", BASLAC: "baslac", CF: "carfit",
  "COS.SPREJ": "cosmos-lac", COSMOS: "cosmos-lac", BEFAR: "befar", LEO: "befar", NORBIN: "norbin",
  SATA: "sata", SATAJET: "sata", SATAMINIJET: "sata",
};
/** Van programa — nikad aktivno (odluka vlasnika). */
const EXCLUDED = /^(3M|SIA|SIAONE|MOLOTOW)\b/i;

const norm = (s) => String(s ?? "").toUpperCase().replace(/Đ/g, "DJ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
const tokens = (s) => new Set(norm(s).split(/[^A-Z0-9.,-]+/).filter((t) => t.length > 1));

/** Zapremina/masa u ml ili g. */
function amount(text) {
  // „1,000 g“ (katalog, hiljade) ≠ „0,5L“ (BizniSoft, decimala): zarez ispred tačno 3 cifre + jedinica = hiljade.
  const t = norm(text).replace(/(\d),(\d{3})\s*(ML|G|GR)\b/g, "$1$2 $3").replace(/,/g, ".");
  const m = t.match(/(\d+(?:\.\d+)?)\s*(ML|L|LIT|LT|GR|G|KG)\b/);
  if (!m) return null;
  const n = Number(m[1]);
  const u = m[2];
  if (u === "ML") return { v: n, u: "ml" };
  if (u === "L" || u === "LIT" || u === "LT") return { v: Math.round(n * 1000), u: "ml" };
  if (u === "KG") return { v: Math.round(n * 1000), u: "g" };
  return { v: n, u: "g" };
}
const sameAmount = (a, b) => a && b && a.u === b.u && Math.abs(a.v - b.v) < 0.5;
const fmtAmount = (a) => (a ? (a.u === "ml" ? (a.v >= 1000 ? `${a.v / 1000} L` : `${a.v} ml`) : a.v >= 1000 ? `${a.v / 1000} kg` : `${a.v} g`) : "");

function wordIn(code, name) {
  const c = norm(code);
  if (c.length < 3) return false;
  const esc = c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s*");
  return new RegExp(`(^|[^A-Z0-9])${esc}([^A-Z0-9]|$)`).test(norm(name));
}

// Katalog: proizvodi i varijante po brendu.
const catalog = {};
for (const f of readdirSync(`${ROOT}data`).filter((f) => f.endsWith("-catalog-products.generated.json"))) {
  const brand = f.replace("-catalog-products.generated.json", "");
  const d = JSON.parse(readFileSync(`${ROOT}data/${f}`, "utf8"));
  const items = Array.isArray(d) ? d : d.products ?? [];
  catalog[brand] = items.map((p) => ({
    slug: p.slug,
    name: p.name ?? p.officialName ?? p.slug,
    code: p.code ?? null,
    variants: (p.variants ?? []).map((v, i) => ({
      id: v.code ?? v.articleNumber ?? v.label ?? String(i),
      label: [v.label, v.size].filter(Boolean).join(" · "),
      code: v.code ?? null,
      articleNumber: v.articleNumber ?? null,
      amount: amount(`${v.label ?? ""} ${v.size ?? ""}`),
      // Odvojeno: prodajno pakovanje i broj iz kolone dobavljača. Taj broj NIJE potvrđen
      // broj komada u kutiji: Carsystem ga zove „VE“ (sajt) i „MOQ“ (katalog — minimalna
      // količina porudžbine), Befar „BOX QUANTITY“ bez objašnjenja. Samo informacija za
      // pregled; „komada u kutiji“ ostaje „nije potvrđeno“ dok dobavljač ne potvrdi.
      salesPack: v.salesPack ?? null,
      supplierQty: v.packagingUnit ?? v.boxQuantity ?? v.pcsPerPack ?? null,
      supplierQtyColumn: v.packagingUnit != null ? "Carsystem VE (sajt) / MOQ (katalog)" : v.boxQuantity != null ? "Befar BOX QUANTITY (katalog)" : v.pcsPerPack != null ? "pcsPerPack" : null,
    })),
  }));
}

const sifarnik = JSON.parse(readFileSync(sifarnikPath, "utf8"));
const portal = new Map(JSON.parse(readFileSync(portalPath, "utf8")).map((a) => [a.code, a]));

const out = [];
for (const r of sifarnik) {
  const p = portal.get(r.code);
  const first = norm(r.naziv).split(" ")[0] ?? "";
  const brand = PREFIX[first] ?? null;
  const excluded = EXCLUDED.test(norm(r.naziv)) || Boolean(p?.van_programa);
  const active = Boolean(p && p.kupaca_12m > 0 && !excluded);
  const amt = amount(r.naziv);
  const base = {
    sifra: r.code, naziv: r.naziv, jm: r.jm, aktivan: active, van_programa: excluded,
    prodato_kupcima_12m: p?.kupaca_12m ?? 0, poslednja_prodaja: p?.poslednja_prodaja ?? null,
    osnovna_cena_portal: p?.osnovna ?? null, zapremina_iz_naziva: fmtAmount(amt), brend: brand,
  };
  if (excluded || !brand || !catalog[brand]) {
    out.push({ ...base, status: "nerešeno", dokaz: excluded ? "van programa" : "brend nije u katalogu", proizvod: null, varijanta: null, razlike: "" });
    continue;
  }
  let best = null;
  for (const prod of catalog[brand]) {
    // E1: šifra = kod varijante
    for (const v of prod.variants) {
      if (v.code && /^\d+$/.test(v.code) && v.code.padStart(6, "0") === r.code) {
        best = { e: "E1", prod, v, why: `BizniSoft šifra ${r.code} = kod varijante ${v.code}` };
      }
      // Carsystem i sl.: kataloški broj proizvođača bez tačaka/crtica = BizniSoft šifra (npr. 152.580 → 152580).
      const digits = String(v.articleNumber ?? "").replace(/[.\s-]/g, "");
      if (!best && /^\d{4,6}$/.test(digits) && digits.padStart(6, "0") === r.code) {
        best = { e: "E1", prod, v, why: `BizniSoft šifra ${r.code} = kataloški broj ${v.articleNumber} (bez tačke)` };
      }
    }
    if (best?.e === "E1") break;
    // E2: kod proizvođača u nazivu (varijanta ili proizvod)
    for (const v of prod.variants) {
      if (v.articleNumber && wordIn(v.articleNumber, r.naziv)) best ??= { e: "E2", prod, v, why: `kataloški broj ${v.articleNumber} u nazivu` };
    }
    if (!best && prod.code && wordIn(prod.code, r.naziv)) {
      const v = prod.variants.find((x) => sameAmount(x.amount, amt)) ?? null;
      best = { e: "E2", prod, v, why: `kod proizvođača ${prod.code} u nazivu` };
    }
  }
  if (!best) {
    // E3: najsličniji naziv u brendu (Jaccard nad rečima) — samo predlog za čoveka.
    const a = tokens(r.naziv);
    let top = null;
    for (const prod of catalog[brand]) {
      const b = tokens(`${prod.name} ${prod.code ?? ""}`);
      const inter = [...a].filter((t) => b.has(t)).length;
      const score = inter / (a.size + b.size - inter || 1);
      if (!top || score > top.score) top = { prod, score };
    }
    if (top && top.score >= 0.25) {
      const v = top.prod.variants.find((x) => sameAmount(x.amount, amt)) ?? null;
      best = { e: "E3", prod: top.prod, v, why: `sličan naziv (${top.score.toFixed(2)}) — SLAB dokaz` };
    }
  }
  if (!best) {
    out.push({ ...base, status: "nerešeno", dokaz: "nema kandidata", proizvod: null, varijanta: null, razlike: "" });
    continue;
  }
  const diffs = [];
  if (best.v && amt && best.v.amount && !sameAmount(best.v.amount, amt)) diffs.push(`zapremina: naziv ${fmtAmount(amt)} ≠ varijanta ${fmtAmount(best.v.amount)}`);
  if (best.prod.variants.length && !best.v) diffs.push("varijanta nije određena");
  if (!amt && ["LIT"].includes(r.jm)) diffs.push("zapremina nije u nazivu");
  out.push({
    ...base, status: "predlog", nivo_dokaza: best.e, dokaz: best.why,
    proizvod: best.prod.slug, naziv_u_katalogu: best.prod.name,
    varijanta: best.v ? best.v.id : null, varijanta_opis: best.v?.label ?? "",
    prodajno_pakovanje_katalog: best.v?.salesPack ?? "",
    kolicina_dobavljaca: best.v?.supplierQty ?? "", kolona_dobavljaca: best.v?.supplierQtyColumn ?? "",
    komada_u_kutiji: "nije potvrđeno",
    razlike: diffs.join("; "),
  });
}

mkdirSync(outDir, { recursive: true });
writeFileSync(`${outDir}/predlozi-veza.json`, JSON.stringify(out, null, 1));
const cols = ["sifra", "naziv", "jm", "aktivan", "prodato_kupcima_12m", "brend", "status", "nivo_dokaza", "dokaz", "proizvod", "naziv_u_katalogu", "varijanta", "varijanta_opis", "zapremina_iz_naziva", "prodajno_pakovanje_katalog", "kolicina_dobavljaca", "kolona_dobavljaca", "komada_u_kutiji", "razlike"];
const csv = [cols.join(";"), ...out.map((o) => cols.map((c) => `"${String(o[c] ?? "").replace(/"/g, '""')}"`).join(";"))].join("\n");
writeFileSync(`${outDir}/predlozi-veza.csv`, "\uFEFF" + csv);
const count = (f) => out.filter(f).length;
console.log(JSON.stringify({
  ukupno: out.length,
  aktivnih: count((o) => o.aktivan),
  aktivni_E1: count((o) => o.aktivan && o.nivo_dokaza === "E1"),
  aktivni_E2: count((o) => o.aktivan && o.nivo_dokaza === "E2"),
  aktivni_E3: count((o) => o.aktivan && o.nivo_dokaza === "E3"),
  aktivni_nereseno: count((o) => o.aktivan && o.status === "nerešeno"),
  van_programa: count((o) => o.van_programa),
}, null, 1));
