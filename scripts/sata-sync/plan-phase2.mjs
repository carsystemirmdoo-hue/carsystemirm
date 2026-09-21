#!/usr/bin/env node
/**
 * SATA sync, faza 2 — PLAN (suvo). Ništa u katalogu se ne menja.
 *
 *   node scripts/sata-sync/plan-phase2.mjs [--write-lock]
 *
 * Ulaz: zaključana particija faze 1 (`reports/scope-reconciliation`), sirovi artikli, odobren model
 * (`phase2-scope.json`), srpski nazivi (`localization/phase2.sr.json`) i plan faze 1 (slugovi porodica).
 * Izlaz: `phase2-plan.generated.json` + mapiranje SVIH brojeva artikala (CSV). Svaki broj završava kao
 * `VISIBLE` ili `INTENTIONALLY_EXCLUDED:<razlog>`; plan pada ako ijedan ostane neklasifikovan ili ako se izmereni
 * brojevi razlikuju od zaključanih (`phase2-scope-lock.json`).
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

import { readJson, writeJson } from "../carsystem-sync/lib/http.mjs";
import { PATHS, PHASE2_SCOPE_NAME } from "./lib/config.mjs";
import { groupPhase2 } from "./lib/phase2-grouping.mjs";
import { AXIS_LABELS, AXIS_ORDER, UNTRANSLATED_MARKERS, translateAttribute } from "./lib/phase2-terms.mjs";

const scope = JSON.parse(readFileSync(PATHS.phase2Scope, "utf8"));
const recon = readJson(PATHS.scopeReport);
const raw = readJson(PATHS.rawArticles).articles;
const plan1 = readJson(PATHS.plan);
const registry = readJson(PATHS.identityRegistry, { products: {} });
const sr = readJson(PATHS.phase2Localization, { stems: {}, compat: {} });
const lock = readJson(PATHS.phase2Lock, null);
const sha = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const flat = (value) => (Array.isArray(value) ? value : Object.values(value));
const planErrors = { unclassified: [], duplicateArticleNumbers: [], slugCollisions: [], untranslatedRowLabel: [], inventedNumber: [], scopeDrift: [], unknownExcluded: [], rowLabelNotUnique: [] };

/* ── 1. Izvor ─────────────────────────────────────────────────────────────────────────────── */
const rawBy = new Map(raw.map((entry) => [entry.articleNumber, entry]));
const sourceArticles = [...flat(recon.phase2), ...flat(recon.standalone).filter((entry) => scope.sourceBuckets.includes(entry?.bucket))]
  .filter((entry, index, list) => list.findIndex((other) => other.articleNumber === entry.articleNumber) === index)
  .map((entry) => ({ articleNumber: entry.articleNumber, name: entry.name, bucket: entry.bucket, tiedFamily: entry.tiedFamily ?? null }));
const families = new Map(plan1.items.map((item) => [item.familyId, item]));
const phase1Articles = new Set(plan1.items.flatMap((item) => item.variants.map((row) => row.articleNumber)));
for (const article of sourceArticles) if (phase1Articles.has(article.articleNumber)) planErrors.duplicateArticleNumbers.push(article.articleNumber);
for (const number of Object.keys(scope.excludedArticles)) if (!sourceArticles.some((article) => article.articleNumber === number)) planErrors.unknownExcluded.push(number);

/* ── 2. Isključenja (odluka, ne izvor): artikal ostaje aktuelan zapis, samo nema karticu ──────────── */
const outside = scope.outsideApprovedRuntimeContext;
const classification = new Map();
for (const article of sourceArticles) {
  const excluded = scope.excludedArticles[article.articleNumber];
  const target = !article.tiedFamily ? outside.targets.find((phrase) => article.name.toLowerCase().includes(`for ${phrase.toLowerCase()}`)) : null;
  if (excluded) classification.set(article.articleNumber, { status: `INTENTIONALLY_EXCLUDED:${excluded.reason}`, note: excluded.note });
  else if (target) classification.set(article.articleNumber, { status: `INTENTIONALLY_EXCLUDED:${outside.reason}`, runtimeStatus: outside.status, note: `Pribor za „${target}” — tog proizvoda nema u odobrenom runtime katalogu.` });
}

// Dokaz izvora koji se čuva i kada artikal NEMA karticu: isti zvanični naziv objavljen pod više brojeva artikala.
const numbersByName = sourceArticles.reduce((acc, article) => acc.set(article.name, [...(acc.get(article.name) ?? []), article.articleNumber]), new Map());
for (const article of sourceArticles) {
  const entry = classification.get(article.articleNumber);
  const twins = numbersByName.get(article.name).filter((number) => number !== article.articleNumber);
  if (entry && twins.length) Object.assign(entry, { sameOfficialNameAs: twins, provenance: scope.duplicateOfficialNames.provenance });
}

/* ── 3. Grupisanje vidljivih ──────────────────────────────────────────────────────────────── */
const groups = groupPhase2(sourceArticles.filter((article) => !classification.has(article.articleNumber)));
const slugify = (text) => text.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/ø/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const cut = (slug, max) => (slug.length <= max ? slug : slug.slice(0, max).replace(/-[^-]*$/, ""));
const lockedSlugByArticle = new Map(Object.entries(registry.phase2 ?? {}).flatMap(([slug, entry]) => entry.articleNumbers.map((number) => [number, slug])));
const takenSlugs = new Set([...Object.keys(registry.products ?? {}), ...Object.keys(registry.enriched ?? {})]);
const taxonomyOf = (group) => {
  const decision = group.rows.map((row) => scope.standaloneDecisions[row.articleNumber]).find(Boolean);
  if (decision?.taxonomyFromFamily) return families.get(decision.relatedFamily).taxonomy;
  return scope.taxonomy.byFunctionalClass[group.rows[0].functionalClass] ?? scope.taxonomy.default;
};
const PRODUCT_TYPE = { HOSE: "Crevo", COUPLING_NIPPLE_ADAPTER: "Spojnica, nipla ili adapter", CLEANING_CARE: "Čišćenje i održavanje pištolja", GUN_HOLDER: "Držač pištolja", PROBE_WAND_EXTENSION: "Sonda ili nastavak", TEST_MEASUREMENT: "Kontrola i merenje", PROTECTIVE_CLOTHING: "Zaštitno odelo za lakirere", RESPIRATOR_AIR_SUPPLY: "Pribor za zaštitu disanja", AIR_CAP_QMR_PROTECTION: "Pribor za pištolj", OTHER: "Pribor" };
// Klauzula koja imenuje SATA proizvod ostaje doslovna; prevode se samo vezne reči i opisni dodaci.
const COMPAT_WORDS = [[/, function exclusively with SATA BVD pressurized cup/gi, ", radi isključivo uz SATA BVD čašu pod pritiskom"], [/, preferably with BVD pressurized cup/gi, ", preporučeno uz BVD čašu pod pritiskom"], [/ with 2\. spray gun outlet/gi, " sa 2. izlazom za pištolj"], [/ lateral cup guns/gi, " pištolje sa bočnom čašom"], [/ without QCC/gi, " bez QCC"], [/\ball SATA filter series, except (\d+)/gi, (_, p1) => `sve SATA filter serije, osim ${p1}`], [/ series\b/gi, " serije"], [/ and /g, " i "]];
const compatSr = (row) => (row.compat ? `za ${sr.compat[row.compat] ?? COMPAT_WORDS.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), row.compat)}` : null);

const cards = groups.map((group) => {
  const rows = group.rows;
  const multi = rows.length > 1;
  const tiedIds = [...new Set([...rows.map((row) => row.tiedFamily), ...rows.map((row) => scope.standaloneDecisions[row.articleNumber]?.relatedFamily)].filter(Boolean))];
  const stemKey = group.tier === 1 && group.compatKey && families.has(group.compatKey) ? `${group.stem}@${group.compatKey}` : group.stem;
  const local = sr.stems[stemKey] ?? sr.stems[group.stem] ?? null;
  const axes = AXIS_ORDER.filter((axis) => group.axes.includes(axis));
  const labelOf = (row) => {
    const parts = axes.map((axis) => (axis === "compatibility" ? compatSr(row) : (row.attrs[axis] ?? []).map(translateAttribute).join(" + "))).filter(Boolean);
    return parts.length ? parts.join(" · ") : `Broj artikla ${row.articleNumber}`;
  };
  // Kartica sa jednim artiklom nosi svoje atribute u nazivu; grupa ih nosi u redovima.
  const singleAttrs = multi ? [] : AXIS_ORDER.filter((axis) => axis !== "compatibility" && axis !== "notice").flatMap((axis) => (rows[0].attrs[axis] ?? []).map(translateAttribute));
  // Kompatibilnost ulazi u NAZIV samo kada je ista za celu karticu; kada se razlikuje po redovima, ona je osa reda.
  const uniformCompat = new Set(rows.map((row) => (row.compat ?? "").toLowerCase())).size === 1 && rows[0].compat;
  const singleTied = new Set(rows.map((row) => row.tiedFamily)).size === 1 && rows[0].tiedFamily ? rows[0].tiedFamily : null;
  /*
   * Kartica vezana za JEDNU porodicu faze 1 ne nosi naziv te porodice u svom NAZIVU: pretraga po nazivu porodice mora
   * prvo da vrati porodicu, a ne njen pribor (isti broj pogodaka u polju naziva → abecedni tie-break). Veza se vidi kroz
   * tip proizvoda („Pribor za …”), odeljak „Koristi se zajedno sa” i pojmove pretrage. Sufiks ostaje samo kada bi bez
   * njega dve kartice imale isti naziv (nastavci za SATAjet 1000 B / 1000 K) — vidi drugi prolaz ispod.
   */
  const familySuffix = singleTied ? ` za ${families.get(singleTied).officialName}` : "";
  const tiedName = local?.omitCompat || singleTied ? "" : uniformCompat ? ` ${compatSr(rows[0])}` : "";
  const name = local ? `${local.name}${singleAttrs.length ? `, ${singleAttrs.join(", ")}` : ""}${tiedName}` : multi ? rows[0].name.replace(/\s*\(.*$/, "").split(",")[0] : rows[0].name.replace(/,?\s*(?:net\s+)?price\s+(?:net\s+)?per\s+met(?:er|re)/gi, "").replace(/\s*(?:Please observe|Important):.*$/i, "");
  const lockedSlug = rows.map((row) => lockedSlugByArticle.get(row.articleNumber)).find(Boolean);
  const tiedSuffix = singleTied ? `-${families.get(singleTied).slug.replace(/^sata-?/, "")}` : "";
  let slug = lockedSlug ?? `${cut(`sata-${slugify(group.stem.replace(/^sata\s+/, ""))}`, 56)}${tiedSuffix}`;
  if (!lockedSlug && takenSlugs.has(slug)) slug = `${slug}-${rows[0].articleNumber}`;
  if (takenSlugs.has(slug) && !lockedSlug) planErrors.slugCollisions.push(slug);
  takenSlugs.add(slug);
  const variants = rows.map((row) => {
    const label = labelOf(row);
    if (UNTRANSLATED_MARKERS.test(label.replace(/za .*$/, ""))) planErrors.untranslatedRowLabel.push({ articleNumber: row.articleNumber, label });
    // Anti-invention: svaki broj u oznaci reda mora doslovno stajati u zvaničnom nazivu.
    for (const number of label.replace(/za .*$/, "").match(/\d+(?:[.,]\d+)?/g) ?? []) if (!row.name.replace(/(\d)\s*x\s*(\d)/g, (_, a, b) => `${a} x ${b}`).includes(number) && number !== row.articleNumber) planErrors.inventedNumber.push({ articleNumber: row.articleNumber, number, label });
    return { articleNumber: row.articleNumber, label, officialName: row.name, bucket: row.bucket, tiedFamily: row.tiedFamily, compat: row.compat, values: Object.fromEntries(axes.map((axis) => [axis, axis === "compatibility" ? (compatSr(row) ?? "—") : (row.attrs[axis] ?? []).map(translateAttribute).join(" + ") || "—"])), soldByMeter: Boolean(row.attrs.priceNote), notice: (row.attrs.notice ?? []).map(translateAttribute)[0] ?? null, officialImage: rawBy.get(row.articleNumber).galleryImages > 0 };
  });
  if (multi && new Set(variants.map((row) => row.label)).size !== variants.length && !group.duplicateRowLabels) planErrors.rowLabelNotUnique.push(slug);
  const classificationName = rows.some((row) => scope.standaloneDecisions[row.articleNumber]) ? "STANDALONE_CARD" : multi ? "LOCAL_FAMILY_WITH_VARIANTS" : tiedIds.length ? "SEPARATE_ACCESSORY_CARD" : "STANDALONE_CARD";
  for (const row of rows) classification.set(row.articleNumber, { status: "VISIBLE", card: slug });
  const card = {
    slug, name, nameSource: local ? "LOCALIZED" : "OFFICIAL_NAME_FALLBACK", officialName: multi ? null : rows[0].name,
    grouping: multi ? "LOCAL_CATALOG_GROUPING" : "SINGLE_OFFICIAL_ARTICLE", groupingTier: multi ? group.tier ?? 1 : null, classification: classificationName,
    duplicateOfficialNames: group.duplicateRowLabels ? scope.duplicateOfficialNames.provenance : null,
    stem: group.stem, functionalClass: rows[0].functionalClass, familySuffix,
    // 63974 je izvedba same pumpe, ne pribor: tip proizvoda nasleđuje od svoje porodice.
    productType: rows.some((row) => scope.standaloneDecisions[row.articleNumber]) ? families.get(singleTied).content.productType : singleTied ? `Pribor za ${families.get(singleTied).officialName}` : local?.productType ?? PRODUCT_TYPE[rows[0].functionalClass],
    taxonomy: taxonomyOf(group), axes: axes.map((axis) => ({ key: axis, label: AXIS_LABELS[axis] })),
    relatedFamilies: tiedIds.map((id) => ({ familyId: id, slug: families.get(id).slug, name: families.get(id).name })),
    variants,
    imageStatus: variants.some((row) => row.officialImage) ? "OFFICIAL_IMAGE_AVAILABLE_NOT_APPROVED_FOR_RUNTIME" : "OFFICIAL_IMAGE_NOT_PUBLISHED",
  };
  card.sourceHash = sha([card.stem, card.variants.map((row) => [row.articleNumber, row.officialName])]);
  return card;
}).sort((a, b) => a.slug.localeCompare(b.slug));
// Drugi prolaz: naziv mora biti jednoznačan među karticama faze 2; tek tada se vraća sufiks porodice.
const nameCount = cards.reduce((acc, card) => acc.set(card.name, (acc.get(card.name) ?? 0) + 1), new Map());
for (const card of cards) { if (nameCount.get(card.name) > 1 && card.familySuffix) card.name = `${card.name}${card.familySuffix}`; delete card.familySuffix; }
for (const [name, total] of cards.reduce((acc, card) => acc.set(card.name, (acc.get(card.name) ?? 0) + 1), new Map())) if (total > 1) planErrors.rowLabelNotUnique.push(`DUPLICATE_CARD_NAME: ${name}`);

/* ── 4. Potpunost i zaključavanje ─────────────────────────────────────────────────────────────── */
for (const article of sourceArticles) if (!classification.has(article.articleNumber)) planErrors.unclassified.push(article.articleNumber);
const count = (list, key) => list.reduce((acc, item) => ({ ...acc, [key(item)]: (acc[key(item)] ?? 0) + 1 }), {});
const excludedByReason = count([...classification.values()].filter((entry) => entry.status !== "VISIBLE"), (entry) => entry.status.split(":")[1]);
const measured = {
  sourceArticles: sourceArticles.length,
  sourceByBucket: count(sourceArticles, (article) => article.bucket),
  visibleArticles: [...classification.values()].filter((entry) => entry.status === "VISIBLE").length,
  excludedArticles: Object.values(excludedByReason).reduce((sum, value) => sum + value, 0),
  excludedByReason,
  cards: cards.length,
  localFamilies: cards.filter((card) => card.variants.length > 1).length,
  singleArticleCards: cards.filter((card) => card.variants.length === 1).length,
  variantRows: cards.filter((card) => card.variants.length > 1).reduce((sum, card) => sum + card.variants.length, 0),
};
const sourceFingerprint = sha(sourceArticles.map((article) => [article.articleNumber, article.name, article.bucket, article.tiedFamily]));
if (lock && JSON.stringify(lock.measured) !== JSON.stringify(measured)) planErrors.scopeDrift.push(lock.sourceFingerprint === sourceFingerprint ? "SCOPE_DRIFT_WITHOUT_SOURCE_CHANGE" : "SCOPE_CHANGED_WITH_SOURCE", { locked: lock.measured, measured });
if (process.argv.includes("--write-lock")) writeJson(PATHS.phase2Lock, { _comment: ["Izmereno iz izvornog modela i ODOBRENO (korisnik, 2026-09-21). Brojevi nisu upisani rukom — piše ih `plan-phase2.mjs --write-lock`; svaka kasnija razlika obara plan."], approvedOn: scope.approvedOn, sourceFingerprint, measured });

/* Veze ka porodicama faze 1: postojeći odeljak „Koristi se zajedno sa”. */
const links = {};
for (const card of cards) for (const family of card.relatedFamilies) (links[family.slug] ??= []).push(card.slug);
for (const list of Object.values(links)) list.sort();

writeJson(PATHS.phase2Plan, {
  meta: { scope: PHASE2_SCOPE_NAME, sourceFingerprint, locked: Boolean(lock), model: "LOCAL_CATALOG_GROUPING — gramatičko grupisanje po zvaničnom nazivu (nivo 1 + nivo 2); nije zvanična SATA porodica" },
  summary: { measured, classification: count(cards, (card) => card.classification), byFunctionalClass: count(cards, (card) => card.functionalClass), byCategory: count(cards, (card) => card.taxonomy.category), nameSource: count(cards, (card) => card.nameSource), duplicateOfficialNameCards: cards.filter((card) => card.duplicateOfficialNames).map((card) => card.slug), images: { articlesWithOfficialImage: sourceArticles.filter((article) => rawBy.get(article.articleNumber).galleryImages > 0).length, articles: sourceArticles.length, APPROVED_RUNTIME_IMAGES: 0 }, documents: sourceArticles.filter((article) => rawBy.get(article.articleNumber).downloads.length).length, linkedPhase1Families: Object.keys(links).length, planErrors },
  articles: Object.fromEntries(sourceArticles.map((article) => [article.articleNumber, { officialName: article.name, bucket: article.bucket, tiedFamily: article.tiedFamily, ...classification.get(article.articleNumber) }])),
  cards, links,
});
const cell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
const cardOf = new Map(cards.flatMap((card) => card.variants.map((row) => [row.articleNumber, [card, row]])));
writeFileSync(PATHS.phase2Mapping, `${["article_number,status,card_slug,grouping,row_label,bucket,tied_family,official_image_published,official_name", ...sourceArticles.map((article) => { const entry = classification.get(article.articleNumber) ?? { status: "UNCLASSIFIED" }; const [card, row] = cardOf.get(article.articleNumber) ?? []; return [article.articleNumber, entry.status, card?.slug, card?.grouping, row?.label, article.bucket, article.tiedFamily, rawBy.get(article.articleNumber).galleryImages > 0, article.name].map(cell).join(","); })].join("\n")}\n`);

console.log(JSON.stringify({ measured, classification: count(cards, (card) => card.classification), nameSource: count(cards, (card) => card.nameSource), locked: Boolean(lock), planErrors: Object.fromEntries(Object.entries(planErrors).map(([key, list]) => [key, list.length])) }, null, 1));
if (Object.values(planErrors).some((list) => list.length)) { console.error(JSON.stringify(planErrors, null, 1).slice(0, 2500)); process.exitCode = 1; }
