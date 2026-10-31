/**
 * Build rubrike „Saveti i vodiči“.
 *
 *   npm run saveti:build          generiše data/saveti/clanci.generated.json + izveštaje
 *   npm run saveti:check          proverava da je generisani skup ažuran i ispravan (CI)
 *
 * Ulaz: content/saveti/clanci/*.md (YAML frontmatter + Markdown telo).
 * Izlaz koji čita sajt: data/saveti/clanci.generated.json — sadrži SVE zapise,
 * i nenapisane i neodobrene; šta je javno odlučuje kapija u trenutku
 * generisanja stranice (lib/saveti/objava.mjs), nikada ovaj korak.
 *
 * Svaka greška obara build. Upozorenja se ispisuju i čuvaju u izveštaju.
 */

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import {
  blockTexts,
  collectInline,
  parseArticleMarkdown,
  wordCount,
} from "../../lib/saveti/markdown.mjs";
import { checkSerbianText, technicalValues } from "../../lib/saveti/jezik.mjs";
import {
  MIN_RECI_PO_TIPU,
  SAVETI_KATEGORIJA_SLUGS,
  SAVETI_REZERVISANI_SLUGOVI,
  SAVETI_TIPOVI,
} from "../../lib/saveti/kategorije.mjs";
import { instantFrom } from "../../lib/saveti/vreme.mjs";
import {
  getAllCarsystemBrands,
  getAllCarsystemProducts,
  getAllPublicProgramGroups,
} from "../../lib/carsystem-data";
import { getAllProductFamilies, getConsolidatedVariantSlugs } from "../../lib/product-families";
import { seoCategoryLandings } from "../../lib/seo/category-landings";
import { documentKeyOf, fileOf } from "../sata-sync/lib/documents.mjs";

// Ulaz su YAML frontmatter i generisani JSON neproverenog oblika; svako polje se proverava eksplicitno.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;

const ROOT = path.resolve(import.meta.dirname, "../..");
const CONTENT_DIR = path.join(ROOT, "content/saveti/clanci");
const OUTPUT = path.join(ROOT, "data/saveti/clanci.generated.json");
const REPORT = path.join(ROOT, "docs/saveti/PROVERA_SADRZAJA.md");
const INVENTORY = path.join(ROOT, "docs/saveti/INVENTAR.md");
const STATUS = path.join(ROOT, "data/saveti/status.generated.json");
const EXPERT = path.join(ROOT, "docs/saveti/STRUCNA_POTVRDA.md");
const SCHEDULE_FILE = path.join(ROOT, "content/saveti/raspored.json");
const CHECK = process.argv.includes("--check");

const ID_PATTERN = /^SV-\d{4}$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/*
 * SATA menja adrese fajlova (`/media/<heš>/…?ts=`), pa stara adresa vraća 404. Izvor koji pokazuje na
 * SATA fajl dobija adresu iz zajedničkog registra dokumenata (`npm run sata:sync:documents`), po imenu
 * fajla; adresa u članku je samo ključ. SATA fajl van registra se ne prepisuje, ali se prijavljuje.
 */
type SataRegistryEntry = { key: string; status: string; href?: string };
const SATA_DOCUMENTS = new Map(
  Object.values(JSON.parse(readFileSync(path.join(ROOT, "data/sata-sync/documents.generated.json"), "utf8")).documents as Record<string, SataRegistryEntry>)
    .filter((entry) => entry.status === "DIRECT_PDF" && entry.href)
    .map((entry) => [entry.key, entry.href as string]),
);
const SATA_MEDIA = /^https:\/\/www\.sata\.com\/media\//;
const SOURCE_TYPES = new Set([
  "tehnicki-list",
  "bezbednosni-list",
  "katalog-proizvodjaca",
  "sajt-proizvodjaca",
  "vest-proizvodjaca",
  "edukacija-proizvodjaca",
  "uputstvo-proizvodjaca",
  "propis",
  "smernica",
  "strucni-izvor",
  "javna-diskusija",
  "interni-podatak",
]);
const WORKFLOW = {
  istrazivanje: new Set(["nije-pocelo", "u-toku", "zavrseno"]),
  pisanje: new Set(["nije-pocelo", "nacrt", "napisano"]),
  tehnickaProvera: new Set(["nije-provereno", "ispravke-potrebne", "provereno"]),
  jezickaProvera: new Set(["nije-provereno", "ispravke-potrebne", "provereno"]),
};

type Source = {
  id: string;
  naziv: string;
  url?: string;
  dokument?: string;
  verzija?: string;
  datumIzvora?: string;
  pristupljeno: string;
  tip: string;
  napomena?: string;
};

type Front = Record<string, Loose>;

const errors: string[] = [];
const warnings: string[] = [];
const err = (file: string, message: string) => errors.push(`${file}: ${message}`);
const warn = (file: string, message: string) => warnings.push(`${file}: ${message}`);

/* ---------- Katalog: šta sme biti link ---------- */

const consolidated = getConsolidatedVariantSlugs();
const productSlugs = new Set(
  getAllCarsystemProducts()
    .filter((product) => !consolidated.has(product.slug))
    .map((product) => product.slug),
);
const productNames = new Map(getAllCarsystemProducts().map((product) => [product.slug, product.name]));
const familySlugs = new Set(getAllProductFamilies().map((family) => family.slug));
const brandSlugs = new Set(getAllCarsystemBrands().map((brand) => brand.slug));
const programSlugs = new Set(getAllPublicProgramGroups().map((program) => program.slug));
const categoryLandingSlugs = new Set(seoCategoryLandings.map((category) => category.slug));
const STATIC_ROUTES = new Set(["/", "/katalog", "/katalozi", "/brendovi", "/program", "/prodavnice", "/kontakt", "/vodici", "/vodici/novosti"]);

/* ---------- Učitavanje ---------- */

function splitFrontmatter(raw: string, file: string) {
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(raw.replace(/\r\n/g, "\n"));
  if (!match) {
    err(file, "nedostaje YAML frontmatter (--- … ---)");
    return { front: {} as Front, body: "" };
  }
  let front: Front = {};
  try {
    front = (yaml.load(match[1], { schema: yaml.JSON_SCHEMA }) as Front) ?? {};
  } catch (error) {
    err(file, `YAML: ${(error as Error).message.split("\n")[0]}`);
  }
  return { front, body: match[2] };
}

function asDateString(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return typeof value === "string" ? value : undefined;
}

function requireString(file: string, front: Front, key: string, { min = 1, max = 400 } = {}) {
  const value = front[key];
  if (typeof value !== "string" || !value.trim()) {
    err(file, `polje „${key}“ je obavezno`);
    return "";
  }
  const length = [...value.trim()].length;
  if (length < min) err(file, `„${key}“ ima ${length} znakova, minimum ${min}`);
  if (length > max) err(file, `„${key}“ ima ${length} znakova, maksimum ${max}`);
  return value.trim();
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson((value as Loose)[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

/* ---------- Provera jednog članka ---------- */

const files = existsSync(CONTENT_DIR)
  ? readdirSync(CONTENT_DIR).filter((name) => name.endsWith(".md")).sort()
  : [];

const records: Loose[] = [];

for (const name of files) {
  const file = `content/saveti/clanci/${name}`;
  const raw = readFileSync(path.join(CONTENT_DIR, name), "utf8");
  const { front, body } = splitFrontmatter(raw, file);

  const id = String(front.id ?? "");
  if (!ID_PATTERN.test(id)) err(file, `id „${id}“ nije u obliku SV-0000`);
  const slug = String(front.slug ?? "");
  if (!SLUG_PATTERN.test(slug)) err(file, `slug „${slug}“ nije ispravan`);
  if (`${slug}.md` !== name) err(file, `ime fajla mora biti ${slug}.md`);
  if (SAVETI_REZERVISANI_SLUGOVI.has(slug)) err(file, `slug „${slug}“ je rezervisan`);
  if (slug.length > 70) warn(file, `slug ima ${slug.length} znakova — kraći je čitljiviji`);

  const tip = String(front.tip ?? "");
  if (!(tip in SAVETI_TIPOVI)) err(file, `tip „${tip}“ nije poznat`);
  const kategorija = String(front.kategorija ?? "");
  if (!SAVETI_KATEGORIJA_SLUGS.includes(kategorija)) err(file, `kategorija „${kategorija}“ nije poznata`);
  if ((tip === "novost") !== (kategorija === "novosti")) err(file, "novost mora biti u kategoriji „novosti“ i obrnuto");

  const status = (front.status ?? {}) as Record<string, string>;
  for (const [key, allowed] of Object.entries(WORKFLOW)) {
    if (!allowed.has(status[key])) err(file, `status.${key} „${status[key]}“ nije dozvoljen`);
  }

  const hasBody = body.trim().length > 0;
  const written = status.pisanje === "napisano";
  if (written && !hasBody) err(file, "status kaže „napisano“, a telo je prazno");

  const naslov = requireString(file, front, "naslov", { min: 15, max: 110 });
  const glavnoPitanje = requireString(file, front, "glavnoPitanje", { min: 10, max: 200 });
  requireString(file, front, "namera", { min: 3, max: 200 });
  requireString(file, front, "podtema", { min: 2, max: 80 });
  requireString(file, front, "razlogPrioriteta", { min: 5, max: 400 });
  const metaNaslov = written ? requireString(file, front, "metaNaslov", { min: 20, max: 62 }) : String(front.metaNaslov ?? "");
  const opis = written ? requireString(file, front, "opis", { min: 70, max: 160 }) : String(front.opis ?? "");

  for (const key of ["publika", "brendovi", "proizvodi", "povezani", "dodatnaPitanja"]) {
    if (front[key] !== undefined && !Array.isArray(front[key])) err(file, `„${key}“ mora biti lista`);
  }
  const publika = (front.publika ?? []) as string[];
  if (!publika.length) err(file, "„publika“ je obavezna");
  const brendovi = (front.brendovi ?? []) as string[];
  for (const brand of brendovi) if (!brandSlugs.has(brand)) err(file, `brend „${brand}“ nije u katalogu`);

  const proizvodi = (front.proizvodi ?? []) as string[];
  for (const reference of proizvodi) {
    const [kind, value] = reference.startsWith("grupa:") ? ["grupa", reference.slice(6)] : ["proizvod", reference];
    if (kind === "grupa" ? !familySlugs.has(value) : !productSlugs.has(value)) {
      err(file, `proizvod „${reference}“ ne postoji ili nije kanonski (konsolidovana varijanta?)`);
    }
  }

  /* Izvori */
  const izvori = (front.izvori ?? []) as Source[];
  if (!Array.isArray(izvori)) err(file, "„izvori“ mora biti lista");
  const sourceIds = new Set<string>();
  for (const source of izvori) {
    if (!source || typeof source !== "object") {
      err(file, "neispravan zapis izvora");
      continue;
    }
    if (!/^[a-z0-9][a-z0-9-]*$/.test(source.id ?? "")) err(file, `izvor id „${source.id}“ nije ispravan`);
    if (sourceIds.has(source.id)) err(file, `izvor „${source.id}“ je naveden dvaput`);
    sourceIds.add(source.id);
    if (!source.naziv) err(file, `izvor „${source.id}“ nema naziv`);
    if (!source.url && !source.dokument) err(file, `izvor „${source.id}“ nema url ni dokument`);
    if (source.url && !/^https:\/\//.test(source.url)) err(file, `izvor „${source.id}“: url mora biti https`);
    if (source.url && SATA_MEDIA.test(source.url)) {
      const current = SATA_DOCUMENTS.get(documentKeyOf(fileOf(source.url)));
      if (current) source.url = current;
      else warn(file, `izvor „${source.id}“: SATA fajl nije u registru dokumenata (${fileOf(source.url)})`);
    }
    if (source.dokument) {
      const local = path.join(ROOT, "public", source.dokument);
      if (!source.dokument.startsWith("/documents/") || !existsSync(local)) {
        err(file, `izvor „${source.id}“: lokalni dokument ${source.dokument} ne postoji`);
      }
    }
    const accessed = asDateString(source.pristupljeno);
    if (!accessed || !DATE_PATTERN.test(accessed)) err(file, `izvor „${source.id}“: „pristupljeno“ mora biti GGGG-MM-DD`);
    source.pristupljeno = accessed ?? "";
    if (source.datumIzvora !== undefined) source.datumIzvora = asDateString(source.datumIzvora);
    if (!SOURCE_TYPES.has(source.tip)) err(file, `izvor „${source.id}“: tip „${source.tip}“ nije poznat`);
  }
  if (written && !izvori.length) err(file, "napisan članak mora imati bar jedan izvor");
  if (written && tip !== "novost") {
    const origin = front.poreklopitanja;
    if (!origin || !["pronadjeno-u-izvoru", "urednicka-procena"].includes(origin.tip)) {
      err(file, "poreklopitanja.tip mora biti pronadjeno-u-izvoru ili urednicka-procena");
    } else if (origin.tip === "pronadjeno-u-izvoru" && !(origin.izvori ?? []).length) {
      err(file, "pitanje „pronađeno u izvoru“ mora navesti bar jedan URL izvora");
    }
  }
  if (written && izvori.length && izvori.every((source) => source.tip === "javna-diskusija")) {
    err(file, "javne diskusije služe za pitanje, ne za odgovor — potreban je stručni ili proizvođački izvor");
  }

  /* Novosti */
  const datumDogadjaja = asDateString(front.datumDogadjaja);
  const proveraVaziDo = asDateString(front.proveraVaziDo);
  if (tip === "novost") {
    if (!datumDogadjaja || !DATE_PATTERN.test(datumDogadjaja)) err(file, "novost mora imati datumDogadjaja (GGGG-MM-DD)");
    if (!proveraVaziDo || !DATE_PATTERN.test(proveraVaziDo)) err(file, "novost mora imati proveraVaziDo (GGGG-MM-DD)");
    if (!["potvrdjena", "nije-potvrdjena"].includes(front.dostupnostUSrbiji)) {
      err(file, "novost mora navesti dostupnostUSrbiji: potvrdjena | nije-potvrdjena");
    }
    if (typeof front.istorijska !== "boolean") err(file, "novost mora navesti istorijska: true | false");
    if (!front.trziste) err(file, "novost mora navesti tržište na koje se odnosi");
  }

  const strucnaPotvrda = front.strucnaPotvrda ?? { potrebna: false, status: "nije-potrebno" };
  if (typeof strucnaPotvrda.potrebna !== "boolean") err(file, "strucnaPotvrda.potrebna mora biti true/false");
  if (strucnaPotvrda.potrebna && !strucnaPotvrda.razlog) err(file, "strucnaPotvrda: navedite razlog");

  const poslednjaProvera = asDateString(front.poslednjaProvera);
  const ponovniPregled = asDateString(front.ponovniPregled);
  if (written) {
    if (!poslednjaProvera || !DATE_PATTERN.test(poslednjaProvera)) err(file, "poslednjaProvera je obavezna za napisan članak");
    if (!ponovniPregled || !DATE_PATTERN.test(ponovniPregled)) err(file, "ponovniPregled je obavezan za napisan članak");
  }

  /* Telo */
  const parsed = parseArticleMarkdown(body, file);
  parsed.errors.forEach((message) => errors.push(message));
  const blocks = parsed.blocks;
  const words = wordCount(blocks);

  if (hasBody) {
    if (blocks[0]?.t !== "p") err(file, "telo mora početi kratkim neposrednim odgovorom (pasus pre prvog ##)");
    const minimum = (MIN_RECI_PO_TIPU as Record<string, number>)[tip] ?? 300;
    if (words < minimum) err(file, `telo ima ${words} reči, minimum za tip „${tip}“ je ${minimum}`);
    const headingLevels = blocks.filter((block) => block.t === "h").map((block) => block.level);
    if (headingLevels[0] === 3) err(file, "prvi podnaslov mora biti ## (H2), ne ###");

    const cites = collectInline(blocks, "cite");
    for (const cite of cites) if (!sourceIds.has(cite.id)) err(file, `citat [^${cite.id}] nema izvor u frontmatter-u`);
    const used = new Set(cites.map((cite) => cite.id));
    for (const source of izvori) if (!used.has(source.id)) warn(file, `izvor „${source.id}“ nije citiran u tekstu`);

    // Tehnička vrednost sa jedinicom mora imati citat u istom bloku.
    for (const { text, nodes, block } of blockTexts(blocks)) {
      if (block.t === "h") continue;
      const values = technicalValues(text);
      if (!values.length) continue;
      const blockCites =
        block.t === "table"
          ? collectInline([block], "cite").length
          : collectInline([{ t: "p", c: nodes }], "cite").length;
      if (!blockCites) err(file, `tehnički podatak bez izvora u istom bloku: ${values.slice(0, 3).join(", ")} — „${text.slice(0, 80)}…“`);
    }

    for (const link of collectInline(blocks, "link")) {
      const href: string = link.href;
      if (/^https?:\/\//.test(href)) {
        if (!href.startsWith("https://")) err(file, `spoljni link mora biti https: ${href}`);
        continue;
      }
      const [pathname] = href.split(/[?#]/);
      const query = new URLSearchParams(href.includes("?") ? href.split("?")[1].split("#")[0] : "");
      if (pathname === "/katalog" && query.has("brend") && !brandSlugs.has(query.get("brend") ?? "")) {
        err(file, `interni link ka nepostojećem brendu: ${href}`);
      }
      const parts = pathname.split("/").filter(Boolean);
      const ok =
        STATIC_ROUTES.has(pathname) ||
        (parts[0] === "proizvodi" && parts[1] === "grupa" && familySlugs.has(parts[2])) ||
        (parts[0] === "proizvodi" && parts.length === 2 && productSlugs.has(parts[1])) ||
        (parts[0] === "brendovi" && parts.length === 2 && brandSlugs.has(parts[1])) ||
        (parts[0] === "program" && parts.length === 2 && programSlugs.has(parts[1])) ||
        (parts[0] === "kategorije" && parts.length === 2 && categoryLandingSlugs.has(parts[1])) ||
        (parts[0] === "vodici" && parts[1] === "kategorije" && SAVETI_KATEGORIJA_SLUGS.includes(parts[2])) ||
        (parts[0] === "vodici" && parts.length === 2);
      if (!ok) err(file, `interni link ne vodi na postojeću stranu: ${href}`);
    }
  }

  /* Jezik: javni tekst (naslovi, opis, telo, pitanja, nazivi izvora se ne menjaju) */
  const protectedTerms = [
    ...proizvodi.map((reference) => productNames.get(reference.replace(/^grupa:/, "")) ?? ""),
    ...((front.zasticeniNazivi ?? []) as string[]),
  ];
  const publicTexts = [
    ["naslov", naslov],
    ["metaNaslov", metaNaslov],
    ["opis", opis],
    ["glavnoPitanje", glavnoPitanje],
    ...((front.dodatnaPitanja ?? []) as string[]).map((question) => ["dodatnoPitanje", question]),
    ...blockTexts(blocks).map(({ text }) => ["telo", text]),
  ];
  for (const [where, text] of publicTexts) {
    if (!text) continue;
    const { errors: languageErrors, warnings: languageWarnings } = checkSerbianText(text, { protectedTerms });
    for (const message of languageErrors) err(file, `jezik (${where}): ${message}`);
    for (const message of languageWarnings) warn(file, `jezik (${where}): ${message}`);
  }

  /* Odobrenje se proverava prema otisku ispod. */
  const odobrenje = front.odobrenje ?? null;
  const povucen = front.povucen ?? null;
  const revizije = ((front.revizije ?? []) as Loose[]).map((revision) => ({
    datum: typeof revision.datum === "string" ? revision.datum : asDateString(revision.datum),
    opis: revision.opis,
  }));
  for (const revision of revizije) {
    try {
      instantFrom(revision.datum);
    } catch {
      err(file, `revizija sa neispravnim datumom „${revision.datum}“`);
    }
    if (!revision.opis) err(file, "revizija mora imati opis izmene");
  }

  const rendered = {
    slug,
    naslov,
    metaNaslov,
    opis,
    kategorija,
    tip,
    glavnoPitanje,
    proizvodi,
    povezani: front.povezani ?? [],
    izvori,
    datumDogadjaja: datumDogadjaja ?? null,
    datumObjaveIzvora: asDateString(front.datumObjaveIzvora) ?? null,
    trziste: front.trziste ?? null,
    dostupnostUSrbiji: front.dostupnostUSrbiji ?? null,
    istorijska: front.istorijska ?? null,
    body: body.trim(),
  };
  // Odobrenje važi za tekst, ne za trenutnu adresu SATA fajla: u otisku SATA izvor nosi ključ dokumenta.
  const fingerprinted = {
    ...rendered,
    izvori: izvori.map((source) =>
      source.url && SATA_MEDIA.test(source.url) ? { ...source, url: `sata-dokument:${documentKeyOf(fileOf(source.url))}` } : source,
    ),
  };
  const otisak = createHash("sha256").update(canonicalJson(fingerprinted)).digest("hex").slice(0, 20);

  if (odobrenje) {
    if (!odobrenje.odobrio || !odobrenje.datum || !odobrenje.otisak) {
      err(file, "odobrenje mora imati odobrio, datum i otisak");
    } else if (odobrenje.otisak !== otisak) {
      err(file, `odobreni tekst je izmenjen posle odobrenja (otisak ${odobrenje.otisak} ≠ ${otisak}) — potrebno je novo odobrenje`);
    }
    if (!(written && status.tehnickaProvera === "provereno" && status.jezickaProvera === "provereno")) {
      err(file, "odobren članak mora biti napisan i proći tehničku i jezičku proveru");
    }
  }

  records.push({
    id,
    slug,
    naslov,
    metaNaslov,
    opis,
    kategorija,
    podtema: front.podtema,
    tip,
    publika,
    glavnoPitanje,
    namera: front.namera,
    dodatnaPitanja: front.dodatnaPitanja ?? [],
    poreklopitanja: front.poreklopitanja ?? null,
    brendovi,
    proizvodi,
    povezani: front.povezani ?? [],
    izvori,
    datumDogadjaja: datumDogadjaja ?? null,
    datumObjaveIzvora: asDateString(front.datumObjaveIzvora) ?? null,
    trziste: front.trziste ?? null,
    dostupnostUSrbiji: front.dostupnostUSrbiji ?? null,
    istorijska: front.istorijska ?? null,
    prioritet: front.prioritet ?? 9999,
    razlogPrioriteta: front.razlogPrioriteta,
    status,
    strucnaPotvrda,
    poslednjaProvera: poslednjaProvera ?? null,
    ponovniPregled: ponovniPregled ?? null,
    proveraVaziDo: proveraVaziDo ?? null,
    odobrenje: odobrenje
      ? { ...odobrenje, datum: typeof odobrenje.datum === "string" ? odobrenje.datum : new Date(odobrenje.datum).toISOString() }
      : null,
    povucen,
    revizije,
    imaTekst: hasBody,
    reci: words,
    otisak,
    blocks,
  });
}

/* ---------- Provere preko celog skupa ---------- */

const byId = new Map<string, Loose>();
const bySlug = new Map<string, Loose>();
for (const record of records) {
  if (byId.has(record.id)) errors.push(`dupli id ${record.id}: ${record.slug} i ${byId.get(record.id).slug}`);
  byId.set(record.id, record);
  if (bySlug.has(record.slug)) errors.push(`dupli slug ${record.slug}`);
  bySlug.set(record.slug, record);
}
for (const record of records) {
  for (const related of record.povezani as string[]) {
    if (!byId.has(related)) errors.push(`${record.slug}: povezani članak ${related} ne postoji`);
    if (related === record.id) errors.push(`${record.slug}: članak ne može biti povezan sam sa sobom`);
  }
  for (const link of collectInline(record.blocks, "link")) {
    const match = /^\/vodici\/([a-z0-9-]+)(?:#.*)?$/.exec(link.href);
    if (match && !["novosti"].includes(match[1]) && !bySlug.has(match[1])) {
      errors.push(`${record.slug}: link na nepostojeći članak /vodici/${match[1]}`);
    }
  }
}

// Isto glavno pitanje = isti cilj pretrage. Spojiti ili razgraničiti.
function normalizeQuestion(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !["kako", "koji", "koja", "koje", "kada", "zasto", "sta", "pre", "posle", "kod", "bez", "ili", "the"].includes(word));
}
function jaccard(a: string[], b: string[]) {
  const sa = new Set(a);
  const sb = new Set(b);
  const inter = [...sa].filter((word) => sb.has(word)).length;
  return inter / (sa.size + sb.size - inter || 1);
}
const questions = records.map((record) => ({ record, tokens: normalizeQuestion(`${record.glavnoPitanje}`) }));
for (let i = 0; i < questions.length; i += 1) {
  for (let j = i + 1; j < questions.length; j += 1) {
    const similarity = jaccard(questions[i].tokens, questions[j].tokens);
    if (similarity >= 0.8) {
      errors.push(`gotovo isto glavno pitanje: ${questions[i].record.id} i ${questions[j].record.id} (${similarity.toFixed(2)}) — spojiti ili razgraničiti`);
    } else if (similarity >= 0.6) {
      warnings.push(`slično glavno pitanje: ${questions[i].record.id} i ${questions[j].record.id} (${similarity.toFixed(2)}) — proveriti razliku`);
    }
  }
}

// Preklapanje teksta (5-gram reči) između napisanih članaka.
function shingles(record: Loose) {
  const words = blockTexts(record.blocks)
    .map(({ text }) => text)
    .join(" ")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  const set = new Set<string>();
  for (let k = 0; k + 5 <= words.length; k += 1) set.add(words.slice(k, k + 5).join(" "));
  return set;
}
const written = records.filter((record) => record.imaTekst).map((record) => ({ record, set: shingles(record) }));
for (let i = 0; i < written.length; i += 1) {
  for (let j = i + 1; j < written.length; j += 1) {
    const a = written[i].set;
    const b = written[j].set;
    if (!a.size || !b.size) continue;
    let inter = 0;
    for (const shingle of a) if (b.has(shingle)) inter += 1;
    const overlap = inter / Math.min(a.size, b.size);
    if (overlap >= 0.25) {
      errors.push(`preklapanje teksta ${(overlap * 100).toFixed(0)} %: ${written[i].record.id} i ${written[j].record.id}`);
    } else if (overlap >= 0.12) {
      warnings.push(`preklapanje teksta ${(overlap * 100).toFixed(0)} %: ${written[i].record.id} i ${written[j].record.id}`);
    }
  }
}

// Meta naslovi i opisi moraju biti jedinstveni.
for (const key of ["metaNaslov", "opis", "naslov"]) {
  const seen = new Map<string, string>();
  for (const record of records) {
    const value = String(record[key] ?? "").trim().toLowerCase();
    if (!value) continue;
    if (seen.has(value)) errors.push(`isti ${key}: ${seen.get(value)} i ${record.id}`);
    seen.set(value, record.id);
  }
}

/* ---------- Izlaz ---------- */

records.sort((a, b) => a.id.localeCompare(b.id));
const output = `${JSON.stringify({ verzija: 1, clanci: records }, null, 1)}\n`;

const counts = {
  teme: records.length,
  napisano: records.filter((record) => record.status.pisanje === "napisano").length,
  tehnickiProvereno: records.filter((record) => record.status.tehnickaProvera === "provereno").length,
  jezickiProvereno: records.filter((record) => record.status.jezickaProvera === "provereno").length,
  cekaStrucnuPotvrdu: records.filter((record) => record.strucnaPotvrda?.potrebna && record.strucnaPotvrda.status !== "potvrdjeno").length,
  odobreno: records.filter((record) => record.odobrenje).length,
  novosti: records.filter((record) => record.tip === "novost").length,
};

const report = [
  "# Provera sadržaja — Saveti i vodiči",
  "",
  "Generiše `npm run saveti:build`. Ne menjati ručno.",
  "",
  "| Pokazatelj | Broj |",
  "| --- | ---: |",
  `| Teme u inventaru | ${counts.teme} |`,
  `| Napisano | ${counts.napisano} |`,
  `| Tehnička provera prošla | ${counts.tehnickiProvereno} |`,
  `| Jezička provera prošla | ${counts.jezickiProvereno} |`,
  `| Čeka stručnu potvrdu | ${counts.cekaStrucnuPotvrdu} |`,
  `| Odobreno za objavu (imenovana osoba) | ${counts.odobreno} |`,
  `| Od toga novosti | ${counts.novosti} |`,
  "",
  `## Greške (${errors.length})`,
  "",
  ...(errors.length ? errors.map((message) => `- ${message}`) : ["Nema."]),
  "",
  `## Upozorenja (${warnings.length})`,
  "",
  ...(warnings.length ? warnings.map((message) => `- ${message}`) : ["Nema."]),
  "",
].join("\n");

const TYPE_LABEL: Record<string, string> = SAVETI_TIPOVI as Record<string, string>;
const yesNo = (value: unknown) => (value ? "da" : "ne");
const inventory = [
  "# Inventar tema — Saveti i vodiči",
  "",
  "Generiše `npm run saveti:build` iz frontmatter-a u `content/saveti/clanci/*.md`. Ne menjati ručno.",
  "Spisak tema nije isto što i gotov sadržaj: kolone pokazuju stanje svake teme posebno.",
  "",
  "| Pokazatelj | Broj |",
  "| --- | ---: |",
  `| Teme | ${counts.teme} |`,
  `| Napisano | ${counts.napisano} |`,
  `| Tehnički provereno | ${counts.tehnickiProvereno} |`,
  `| Jezički provereno | ${counts.jezickiProvereno} |`,
  `| Čeka stručnu potvrdu | ${counts.cekaStrucnuPotvrdu} |`,
  `| Odobreno (imenovana osoba) | ${counts.odobreno} |`,
  `| Novosti / trajni vodiči | ${counts.novosti} / ${counts.teme - counts.novosti} |`,
  "",
  "| ID | Naslov | Kategorija | Tip | Publika | Pitanje (poreklo) | Izvora | Pisanje | Tehn. | Jezik | Stručna potvrda | Odobreno | Poslednja provera | Ponovni pregled |",
  "| --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- |",
  ...records.map((record) => {
    const origin = record.poreklopitanja?.tip === "pronadjeno-u-izvoru" ? "pronađeno" : record.poreklopitanja?.tip === "urednicka-procena" ? "urednička procena" : "—";
    const expert = record.strucnaPotvrda?.potrebna ? `potrebna (${record.strucnaPotvrda.status ?? "—"})` : "nije potrebna";
    return `| ${record.id} | ${String(record.naslov).replace(/\|/g, "\\|")} | ${record.kategorija} | ${TYPE_LABEL[record.tip] ?? record.tip} | ${(record.publika ?? []).join(", ")} | ${origin} | ${record.izvori.length} | ${record.status.pisanje} | ${record.status.tehnickaProvera} | ${record.status.jezickaProvera} | ${expert} | ${yesNo(record.odobrenje)} | ${record.poslednjaProvera ?? "—"} | ${record.ponovniPregled ?? "—"} |`;
  }),
  "",
].join("\n");

const expertPending = records.filter((record) => record.strucnaPotvrda?.potrebna && record.strucnaPotvrda.status !== "potvrdjeno");
const expertReport = [
  "# Tekstovi koji čekaju stručnu potvrdu",
  "",
  "Generiše `npm run saveti:build`. Ovi tekstovi su napisani i jezički provereni, ali za suštinu odgovora nije pronađen pouzdan izvor ili su izvori protivrečni. Ne ulaze u raspored dok ih stručna osoba iz firme ne potvrdi.",
  "",
  "Postupak: stručna osoba pročita tekst i razlog. Ako potvrdi, u frontmatter-u postavlja `strucnaPotvrda.status: potvrdjeno` (uz ime i datum u `strucnaPotvrda.potvrdio` / `strucnaPotvrda.datum`), po potrebi ispravlja tekst, a zatim recenzent postavlja `tehnickaProvera: provereno`. Posle toga tekst može da se odobri i zakaže.",
  "",
  `Ukupno: ${expertPending.length}`,
  "",
  "| ID | Naslov | Kategorija | Razlog |",
  "| --- | --- | --- | --- |",
  ...expertPending.map((record) => `| ${record.id} | ${String(record.naslov).replace(/\|/g, "\\|")} | ${record.kategorija} | ${String(record.strucnaPotvrda.razlog ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ")} |`),
  "",
].join("\n");

const scheduleConfig = JSON.parse(readFileSync(SCHEDULE_FILE, "utf8")).podesavanja;
const statusOutput = `${JSON.stringify({ rasporedAktivan: Boolean(scheduleConfig.aktivan) }, null, 1)}\n`;

if (CHECK) {
  const current = existsSync(OUTPUT) ? readFileSync(OUTPUT, "utf8") : "";
  if (current !== output) errors.push("data/saveti/clanci.generated.json nije ažuran — pokrenite npm run saveti:build");
  const currentStatus = existsSync(STATUS) ? readFileSync(STATUS, "utf8") : "";
  if (currentStatus !== statusOutput) errors.push("data/saveti/status.generated.json nije ažuran — pokrenite npm run saveti:build");
} else {
  writeFileSync(STATUS, statusOutput);
  mkdirSync(path.dirname(OUTPUT), { recursive: true });
  mkdirSync(path.dirname(REPORT), { recursive: true });
  writeFileSync(OUTPUT, output);
  writeFileSync(REPORT, report);
  writeFileSync(INVENTORY, inventory);
  writeFileSync(EXPERT, expertReport);
}

console.log(JSON.stringify(counts));
if (warnings.length) console.log(`upozorenja: ${warnings.length} (docs/saveti/PROVERA_SADRZAJA.md)`);
if (errors.length) {
  console.error(`greške: ${errors.length}`);
  for (const message of errors.slice(0, 60)) console.error(`  ✗ ${message}`);
  process.exit(1);
}
console.log(CHECK ? "saveti:check ✔" : "saveti:build ✔");
