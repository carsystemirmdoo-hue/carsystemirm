#!/usr/bin/env node
/**
 * Početni uvoz rubrike „Saveti i vodiči“ iz repozitorijuma u bazu (posle migracije 0058).
 *
 *   DATABASE_URL=… node scripts/saveti/uvezi-u-bazu.mjs            # proba: samo izveštaj
 *   DATABASE_URL=… node scripts/saveti/uvezi-u-bazu.mjs --upisi    # upis
 *
 * Svaki tekst iz content/saveti/clanci/*.md postaje članak sa verzijom 1 (poreklo
 * „uvoz-repozitorijum“). NIŠTA se ne odobrava, ne zakazuje ni ne objavljuje:
 *  - tekst sa završenom tehničkom i jezičkom (uredničkom, AI-asistiranom) proverom → „Za pregled“;
 *  - tekst koji čeka stručnu potvrdu → „Nacrt“, označen kao tekst koji traži stručnu potvrdu
 *    (`strucna_potvrda_potrebna`, razlog iz repozitorijuma); ne može biti odobren dok potvrda
 *    stručnjaka ne bude upisana u panelu.
 * Napomene urednika (napomenaProvere, prioritet, poreklo pitanja) idu u interne napomene i nikad
 * u javni tekst. Ponovno pokretanje preskače članke koji već postoje (po oznaci SV-…).
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import postgres from "postgres";
import { parseArticleMarkdown } from "../../lib/saveti/markdown.mjs";
import { blokoviUMarkdown } from "../../lib/saveti/urednik/format.mjs";
import { otisakSadrzaja } from "../../lib/saveti/urednik/stanje.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DIR = path.join(ROOT, "content/saveti/clanci");
const upisi = process.argv.includes("--upisi");
const AKTER = "Uvoz iz repozitorijuma";

const datum = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : typeof v === "string" ? v : undefined);

function citaj(file) {
  const raw = readFileSync(path.join(DIR, file), "utf8");
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(raw.replace(/\r\n/g, "\n"));
  if (!m) throw new Error(`${file}: nema frontmatter-a`);
  const f = yaml.load(m[1]);
  return { f, telo: m[2].trim() };
}

function izvori(list) {
  return (Array.isArray(list) ? list : []).map((s) => {
    const out = { id: s.id, naziv: s.naziv, pristupljeno: datum(s.pristupljeno), tip: s.tip ?? "stranica" };
    for (const key of ["url", "dokument", "verzija", "napomena"]) if (s[key]) out[key] = String(s[key]);
    if (s.datumIzvora) out.datumIzvora = datum(s.datumIzvora);
    return out;
  });
}

function interne(f) {
  const delovi = [];
  if (f.napomenaProvere) delovi.push(`Provera (urednička, AI-asistirana — nije provera tehničkog tima): ${f.napomenaProvere}`);
  if (f.status) delovi.push(`Stanje iz repozitorijuma: istraživanje ${f.status.istrazivanje}, pisanje ${f.status.pisanje}, tehnička provera ${f.status.tehnickaProvera}, jezička provera ${f.status.jezickaProvera}.`);
  if (f.razlogPrioriteta) delovi.push(`Prioritet ${f.prioritet}: ${f.razlogPrioriteta}`);
  if (f.poreklopitanja?.napomena) delovi.push(`Poreklo pitanja: ${f.poreklopitanja.napomena}`);
  return delovi.join("\n\n");
}

const files = readdirSync(DIR).filter((f) => f.endsWith(".md")).sort();
const plan = [];
for (const file of files) {
  const { f, telo: izvorno } = citaj(file);
  const { blocks, errors } = parseArticleMarkdown(izvorno, file);
  if (errors.length) throw new Error(`${file}: ${errors[0]}`);
  const telo = blokoviUMarkdown(blocks);
  const podaci = {
    podtema: f.podtema ?? "",
    publika: f.publika ?? [],
    glavnoPitanje: f.glavnoPitanje ?? "",
    dodatnaPitanja: f.dodatnaPitanja ?? [],
    brendovi: f.brendovi ?? [],
    proizvodi: f.proizvodi ?? [],
    povezani: f.povezani ?? [],
    prioritet: f.prioritet ?? 0,
    ...(f.datumDogadjaja ? { datumDogadjaja: datum(f.datumDogadjaja) } : {}),
    ...(f.datumObjaveIzvora ? { datumObjaveIzvora: datum(f.datumObjaveIzvora) } : {}),
    ...(f.trziste ? { trziste: f.trziste } : {}),
    ...(f.dostupnostUSrbiji ? { dostupnostUSrbiji: f.dostupnostUSrbiji } : {}),
    ...(typeof f.istorijska === "boolean" ? { istorijska: f.istorijska } : {}),
    ...(f.proveraVaziDo ? { proveraVaziDo: datum(f.proveraVaziDo) } : {}),
    ...(f.poslednjaProvera ? { poslednjaProvera: datum(f.poslednjaProvera) } : {}),
  };
  const sadrzaj = { naslov: f.naslov, metaNaslov: f.metaNaslov ?? "", opis: f.opis, telo, izvori: izvori(f.izvori), podaci, slikaId: null, slikaAlt: "" };
  const potvrda = f.strucnaPotvrda?.potrebna === true && f.strucnaPotvrda?.status !== "potvrdjeno";
  const provereno = f.status?.tehnickaProvera === "provereno" && f.status?.jezickaProvera === "provereno" && !potvrda;
  plan.push({
    id: f.id,
    slug: f.slug,
    tip: f.tip,
    kategorija: f.kategorija,
    sadrzaj,
    otisak: otisakSadrzaja(sadrzaj),
    interneNapomene: interne(f),
    nepotvrdjeno: potvrda ? `Čeka stručnu potvrdu: ${f.strucnaPotvrda.razlog ?? ""}`.trim() : "",
    strucnaPotvrda: potvrda,
    strucnaRazlog: potvrda ? String(f.strucnaPotvrda.razlog ?? "").trim() : "",
    naPregled: provereno,
  });
}

const zaPregled = plan.filter((p) => p.naPregled).length;
console.log(`Tekstova: ${plan.length} · za pregled: ${zaPregled} · nacrt (čeka stručnu potvrdu ili proveru): ${plan.length - zaPregled} · traži stručnu potvrdu: ${plan.filter((p) => p.strucnaPotvrda).length}`);
if (!upisi) {
  console.log("Proba — ništa nije upisano. Za upis dodajte --upisi.");
  process.exit(0);
}

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL nije podešen.");
const sql = postgres(url, { max: 1, prepare: false });
let novo = 0;
let postoji = 0;
try {
  await sql.begin(async (tx) => {
    for (const p of plan) {
      const [c] = await tx`SELECT id FROM saveti_clanci WHERE id = ${p.id}`;
      if (c) {
        postoji += 1;
        continue;
      }
      await tx`INSERT INTO saveti_clanci (id, slug, tip, kategorija, strucna_potvrda_potrebna, strucna_potvrda_razlog) VALUES (${p.id}, ${p.slug}, ${p.tip}, ${p.kategorija}, ${p.strucnaPotvrda}, ${p.strucnaRazlog})`;
      const s = p.sadrzaj;
      const [v] = await tx`
        INSERT INTO saveti_verzije (clanak_id, broj, naslov, meta_naslov, opis, telo, izvori, podaci, interne_napomene, nepotvrdjeno, otisak, poreklo)
        VALUES (${p.id}, 1, ${s.naslov}, ${s.metaNaslov}, ${s.opis}, ${s.telo}, ${tx.json(s.izvori)}, ${tx.json(s.podaci)}, ${p.interneNapomene}, ${p.nepotvrdjeno}, ${p.otisak}, 'uvoz-repozitorijum')
        RETURNING id`;
      await tx`INSERT INTO saveti_dogadjaji (clanak_id, verzija_id, radnja, korisnik_ime, detalji) VALUES (${p.id}, ${v.id}, 'uvezeno', ${AKTER}, ${tx.json({ izvor: `content/saveti/clanci/${p.slug}.md` })})`;
      if (p.naPregled) {
        await tx`INSERT INTO saveti_dogadjaji (clanak_id, verzija_id, radnja, korisnik_ime, detalji) VALUES (${p.id}, ${v.id}, 'poslato_na_pregled', ${AKTER}, ${tx.json({ napomena: "tehnička i jezička provera završene u repozitorijumu (urednička, AI-asistirana)" })})`;
      }
      novo += 1;
    }
  });
} finally {
  await sql.end();
}
console.log(`Upisano: ${novo} · već postoji: ${postoji}`);
