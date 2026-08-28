/**
 * Generise `CONTENT-ASSET-REGISTER.csv` i `content-asset-manifest.json` iz
 * kanonskih podataka u `lib/content-assets/content-asset-slots.mjs`.
 *
 * Ovde NEMA podataka — samo validacija i transformacija. Dve rucno odrzavane
 * kopije slotova ne smeju postojati.
 *
 * Ovo je content-production manifest, NE runtime dependency. Nijedna runtime
 * komponenta ga ne cita.
 *
 *   node scripts/build-content-asset-register.mjs           # upisuje izlaze
 *   node scripts/build-content-asset-register.mjs --check    # ne pise nista
 *
 * `--check` vraca non-zero kada se commitovani izlazi razlikuju od onoga sto
 * bi generator sada napravio. Zato u versioned fajlovima nema vremena
 * pokretanja: vreme se ispisuje samo u konzoli.
 */
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  CONTENT_ASSET_SLOTS,
  SLOT_COLUMNS,
  sortedSlots,
  validateSlots,
} from "../lib/content-assets/content-asset-slots.mjs";

const ROOT = process.cwd();
const CHECK = process.argv.includes("--check");
const CSV_PATH = path.join(ROOT, "CONTENT-ASSET-REGISTER.csv");
const MD_PATH = path.join(ROOT, "CONTENT-ASSET-REGISTER.md");
const JSON_PATH = path.join(ROOT, "content-asset-manifest.json");

/* ------------------------------------------------------------ validacija */

const problems = validateSlots(CONTENT_ASSET_SLOTS);

/*
 * Referencirani asset koji ne postoji na disku je problem samo kada slot tvrdi
 * da asset postoji. `NEEDS_ASSET` upravo znaci da ga jos nema.
 */
for (const slot of CONTENT_ASSET_SLOTS) {
  if (typeof slot.existingAsset !== "string" || !slot.existingAsset.startsWith("/")) continue;
  if (slot.status === "NEEDS_ASSET") continue;
  if (!existsSync(path.join(ROOT, "public", slot.existingAsset))) {
    problems.push(`${slot.slotId}: referenciran asset ne postoji (${slot.existingAsset})`);
  }
}

if (problems.length > 0) {
  console.error(`Nevalidni kanonski podaci — ${problems.length} problema:`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

/* ---------------------------------------------------------- transformacija */

/** Stabilan redosled po `slotId` — izlaz ne zavisi od redosleda pisanja. */
const SLOTS = sortedSlots(CONTENT_ASSET_SLOTS);

function csvCell(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const csv =
  [
    SLOT_COLUMNS.join(","),
    ...SLOTS.map((slot) => SLOT_COLUMNS.map((c) => csvCell(slot[c])).join(",")),
  ].join("\n") + "\n";

/** Brojaci sa stabilnim redosledom kljuceva — inace zavise od redosleda unosa. */
function tally(key) {
  const out = {};
  for (const v of SLOTS.map((s) => s[key]).sort()) out[v] = (out[v] ?? 0) + 1;
  return out;
}
const byStatus = tally("status");
const byPriority = tally("priority");

const manifest = {
  $comment:
    "Content-production manifest. NIJE runtime dependency — nijedna komponenta ga ne cita. " +
    "Generisano iz lib/content-assets/content-asset-slots.mjs; ne menjati rucno.",
  generator: "scripts/build-content-asset-register.mjs",
  source: "lib/content-assets/content-asset-slots.mjs",
  namingConvention: {
    campaignBanner:
      "{brand}-home-campaign-{campaign-slug}-{desktop|mobile}.webp",
    brandSection: "{brand}-{section-slug}-{subject-slug}-{desktop|mobile}.webp",
    productPackshot:
      "{brand}-{normalized-sku-or-product-slug}-packshot-{front|angle|group}.webp",
    productGallery: "{brand}-{normalized-sku-or-product-slug}-gallery-01.webp",
    note:
      "Projekat je vec imao jasnu konvenciju sa jednom crticom (npr. rm-hero-agilis-performance-desktop.webp), pa je zadrzana umesto dvostruke crtice. Svi nazivi: lowercase, bez razmaka, bez dijakritike, bez 'final'/'copy'/'v2'.",
  },
  totals: { slots: SLOTS.length, byStatus, byPriority },
  slots: SLOTS,
};

const json = JSON.stringify(manifest, null, 2) + "\n";

/* ------------------------------------------------------------- Markdown */

/**
 * Generisani delovi `CONTENT-ASSET-REGISTER.md`.
 *
 * Dokument je pisan rukom, ali su tabele izvod iz istih kanonskih podataka.
 * Da su ostale rucne, bile bi treca kopija istine i tiho bi se razisle. Zato
 * se zamenjuje samo sadrzaj izmedju markera; proza ostaje netaknuta.
 */
const PRIORITY_LABELS = {
  P0: "P0 — blokira javnu stranicu",
  P1: "P1 — glavni vidljivi sadržaj",
  P2: "P2 — product/section completion",
  P3: "P3 — polish",
};

/** Celija markdown tabele: pajp i prelom reda bi razbili red. */
function mdCell(value, { code = false, max = 0 } = {}) {
  if (value === null || value === undefined || value === "") return "—";
  let text = String(value).replace(/\r?\n/g, " ").replace(/\|/g, "\\|").trim();
  if (max > 0 && text.length > max) text = text.slice(0, max) + "…";
  return code ? `\`${text}\`` : text;
}

const MD_PROBLEM_MAX = 130;

function mdTotals() {
  const red = [];
  red.push("| Status | Broj |", "| --- | --- |");
  for (const [k, v] of Object.entries(byStatus)) red.push(`| \`${k}\` | ${v} |`);
  red.push(`| **ukupno slotova** | **${SLOTS.length}** |`, "");
  red.push("| Prioritet | Broj |", "| --- | --- |");
  for (const [k, v] of Object.entries(byPriority)) {
    red.push(`| \`${PRIORITY_LABELS[k] ?? k}\` | ${v} |`);
  }
  return red.join("\n");
}

function mdRegistry() {
  const red = [];
  for (const p of ["P0", "P1", "P2", "P3"]) {
    const grupa = SLOTS.filter((s) => s.priority === p);
    if (grupa.length === 0) continue;
    red.push(`### ${PRIORITY_LABELS[p]}  (${grupa.length})`, "");
    red.push(
      "| slotId | Ruta | Sekcija | Problem | Ocekivani fajl | Ciljna putanja | Status |",
      "| --- | --- | --- | --- | --- | --- | --- |",
    );
    for (const s of grupa) {
      red.push(
        "| " +
          [
            mdCell(s.slotId, { code: true }),
            mdCell(s.route, { code: true }),
            mdCell(s.section),
            mdCell(s.problem, { max: MD_PROBLEM_MAX }),
            mdCell(s.expectedDesktopFilename, { code: true }),
            mdCell(s.targetPath, { code: true }),
            mdCell(s.status, { code: true }),
          ].join(" | ") +
          " |",
      );
    }
    red.push("");
  }
  return red.join("\n").replace(/\n+$/, "");
}

/** Zamenjuje sadrzaj izmedju markera; sve van njih ostaje netaknuto. */
export function applyMarkdownBlocks(md) {
  const blokovi = { totals: mdTotals(), registry: mdRegistry() };
  let out = md;
  for (const [ime, sadrzaj] of Object.entries(blokovi)) {
    const re = new RegExp(
      `(<!-- GENERATED:${ime}[^>]*-->)[\\s\\S]*?(<!-- /GENERATED:${ime} -->)`,
    );
    if (!re.test(out)) {
      console.error(`CONTENT-ASSET-REGISTER.md: nedostaje marker GENERATED:${ime}`);
      process.exit(1);
    }
    out = out.replace(re, `$1\n\n${sadrzaj}\n\n$2`);
  }
  return out;
}

const mdNaDisku = await readFile(MD_PATH, "utf8").catch(() => null);
if (mdNaDisku === null) {
  console.error("Nedostaje CONTENT-ASSET-REGISTER.md");
  process.exit(1);
}
const md = applyMarkdownBlocks(mdNaDisku);

/* ------------------------------------------------------------------ izlaz */

async function procitaj(p) {
  try {
    return await readFile(p, "utf8");
  } catch {
    return null;
  }
}

if (CHECK) {
  const razlike = [];
  for (const [p, ocekivano] of [[CSV_PATH, csv], [JSON_PATH, json], [MD_PATH, md]]) {
    const naDisku = await procitaj(p);
    if (naDisku === null) razlike.push(`${path.relative(ROOT, p)}: fajl ne postoji`);
    else if (naDisku !== ocekivano) razlike.push(`${path.relative(ROOT, p)}: sadrzaj se razlikuje`);
  }
  if (razlike.length > 0) {
    console.error("assets:register:check — commitovani izlazi nisu u koraku sa kanonskim podacima:");
    for (const r of razlike) console.error(`  - ${r}`);
    console.error("Pokrenite: npm run assets:register");
    process.exit(1);
  }
  console.log(`assets:register:check OK — ${SLOTS.length} slotova, izlazi su u koraku.`);
  process.exit(0);
}

await writeFile(CSV_PATH, csv, "utf8");
await writeFile(JSON_PATH, json, "utf8");
await writeFile(MD_PATH, md, "utf8");

// Vreme ide SAMO u konzolu; u versioned fajlu bi obaralo reproducibilnost.
console.log(`generisano ${new Date().toISOString()}`);
console.log(`slots: ${SLOTS.length}`);
console.log("byStatus:", byStatus);
console.log("byPriority:", byPriority);
