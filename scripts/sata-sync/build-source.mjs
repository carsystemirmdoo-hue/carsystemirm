#!/usr/bin/env node
/**
 * SATA sync, korak 4 — IZVORNI MODEL (samo čitanje, bez runtime izmena).
 *
 * SATA vodi asortiman kao Shopware prodavnicu: jedan „parent” (konfigurabilna porodica) i artikli
 * kao njegove konfiguracije. Zato je ovde:
 *
 *   porodica  = Shopware parent (`parentId`), sa javnom stranicom `/…/CF<id>` kada je SATA objavljuje
 *   varijanta = broj artikla + vrednost svake ose (tehnologija, mlaznica, mlaz, digitalna jedinica…)
 *   samostalan artikal = broj artikla bez parenta (rezervni deo, pribor, potrošni materijal)
 *
 * Pripadnost se NIKAD ne izvodi iz naziva: porodicu i artikal vezuje isti `parentId`. Naziv služi
 * jedino za grubu ulogu samostalnih artikala (deo / pribor / potrošni), i ta podela je pomoćna —
 * ne određuje identitet, a sve što pravila ne prepoznaju ostaje `UNCLASSIFIED` i prijavljuje se.
 *
 * Cena se ne čita, ne čuva i ne izvodi.
 */

import { readJson, writeJson } from "../carsystem-sync/lib/http.mjs";
import { PATHS } from "./lib/config.mjs";
import { classifyStandalone, familyScope } from "./lib/classify.mjs";

const families = readJson(PATHS.rawFamilies);
const articles = readJson(PATHS.rawArticles);
const locales = readJson(PATHS.rawLocales);
if (!families || !articles || !locales) throw new Error("Nedostaje raw ulaz — pokreni acquire-families, acquire-articles i acquire-locales.");

const regionOnly = new Map(locales.regionOnly.map((entry) => [entry.articleNumber, entry.publishedIn]));
const byNumber = (a, b) => String(a).localeCompare(String(b), "en", { numeric: true });

/* ── 1. Porodice: jedna po `parentId`; više CF adresa za isti parent = alias, ne nova porodica ── */
const live = families.families.filter((family) => family.officialName);
const dead = families.families.filter((family) => !family.officialName);
const listed = (family) => family.primaryCategory && !family.primaryCategory.startsWith("(");
const familyByParent = new Map();
const aliases = [];
for (const family of [...live].sort((a, b) => Number(listed(b)) - Number(listed(a)) || a.id.localeCompare(b.id))) {
  const key = family.parentId ?? `single:${family.defaultArticle}`;
  const kept = familyByParent.get(key);
  if (kept) aliases.push({ id: family.id, url: family.url, aliasOf: kept.id, reason: "isti Shopware parent" });
  else familyByParent.set(key, family);
}

/* ── 2. Artikli → porodica preko `parentId` ── */
const okArticles = articles.articles.filter((article) => !article.error);
const membersByParent = new Map();
for (const article of okArticles) {
  if (!article.parentId) continue;
  if (!membersByParent.has(article.parentId)) membersByParent.set(article.parentId, []);
  membersByParent.get(article.parentId).push(article);
}

const variantOf = (article) => ({
  articleNumber: article.articleNumber,
  name: article.name,
  // Zvanična kategorija artikla (bez „Home › All products”) — dokaz uloge, ne naziv.
  officialCategory: (article.officialCategory ?? []).filter((entry) => entry !== "Home" && entry !== "All products"),
  selection: article.selection ?? {},
  url: `https://www.sata.com/en/${article.path}`,
  image: article.ogImage ? article.ogImage.split("?")[0] : null,
  imageIsArticleSpecific: Boolean(article.ogImage && new RegExp(`/${article.articleNumber}[_.-]`).test(article.ogImage)),
  technicalDataRows: article.technicalData?.length ?? 0,
  region: regionOnly.has(article.articleNumber) ? "CURRENT_REGION_SPECIFIC" : "CURRENT",
  regionPublishedIn: regionOnly.get(article.articleNumber) ?? undefined,
});

const familyRecords = [];
const claimedParents = new Set();
for (const family of familyByParent.values()) {
  const members = family.parentId ? membersByParent.get(family.parentId) ?? [] : [];
  if (family.parentId) claimedParents.add(family.parentId);
  const defaultArticle = okArticles.find((article) => article.articleNumber === family.defaultArticle);
  const variants = (members.length ? members : defaultArticle ? [defaultArticle] : []).map(variantOf).sort((a, b) => byNumber(a.articleNumber, b.articleNumber));
  const europe = variants.filter((variant) => variant.region === "CURRENT");
  const axes = {};
  for (const variant of variants) for (const [axis, value] of Object.entries(variant.selection)) if (value) (axes[axis] ??= new Set()).add(value);
  const axisValues = Object.fromEntries(Object.entries(axes).map(([axis, values]) => [axis, [...values].sort(byNumber)]));
  familyRecords.push({
    id: family.id,
    parentId: family.parentId ?? null,
    officialName: family.officialName,
    url: family.url,
    primaryCategory: family.primaryCategory,
    scope: familyScope({ officialName: family.officialName, primaryCategory: family.primaryCategory, axes: axisValues }),
    listedInCategory: listed(family),
    defaultArticle: family.defaultArticle,
    axes: axisValues,
    variantCount: variants.length,
    variantCountEurope: europe.length,
    region: europe.length ? "CURRENT" : variants.length ? "CURRENT_REGION_SPECIFIC" : "UNCERTAIN",
    downloads: (family.downloads ?? []).map((href) => href.split("?")[0]),
    image: family.images?.og ? family.images.og.split("?")[0] : null,
    // Slika pripada artiklu samo kada fajl nosi NJEGOV broj; inače je to slika srodnog artikla.
    variantsWithOwnImage: variants.filter((variant) => variant.imageIsArticleSpecific).length,
    variants,
  });
}

/* ── 3. Parent bez javne CF stranice: porodica postoji u prodavnici, ali je SATA ne izlaže ── */
const unlistedFamilies = [];
for (const [parentId, members] of membersByParent) {
  if (claimedParents.has(parentId)) continue;
  const variants = members.map(variantOf).sort((a, b) => byNumber(a.articleNumber, b.articleNumber));
  const names = members.map((member) => member.name ?? "");
  let prefix = names[0] ?? "";
  for (const name of names) while (prefix && !name.startsWith(prefix)) prefix = prefix.slice(0, -1);
  unlistedFamilies.push({
    parentId,
    commonNamePrefix: prefix.trim(),
    role: classifyStandalone(names[0] ?? ""),
    variantCount: variants.length,
    variantCountEurope: variants.filter((variant) => variant.region === "CURRENT").length,
    axes: [...new Set(members.flatMap((member) => Object.keys(member.selection ?? {})))],
    variants,
  });
}
unlistedFamilies.sort((a, b) => b.variantCount - a.variantCount || a.parentId.localeCompare(b.parentId));

/* ── 4. Samostalni artikli ── */
const standalone = okArticles
  .filter((article) => !article.parentId && ![...familyByParent.values()].some((family) => !family.parentId && family.defaultArticle === article.articleNumber))
  .map((article) => ({ ...variantOf(article), role: classifyStandalone(article.name ?? "") }))
  .sort((a, b) => byNumber(a.articleNumber, b.articleNumber));

writeJson(PATHS.source, {
  meta: {
    reference: "https://www.sata.com/en/ (međunarodni katalog, nadskup evropskih lokala)",
    families: familyRecords.length,
    familyAliases: aliases.length,
    deadFamilyRefs: dead.map((family) => ({ id: family.id, error: family.error })),
    unlistedFamilies: unlistedFamilies.length,
    articles: okArticles.length,
    articlesFailed: articles.articles.length - okArticles.length,
    articlesInListedFamilies: familyRecords.reduce((sum, family) => sum + family.variantCount, 0),
    articlesInUnlistedFamilies: unlistedFamilies.reduce((sum, family) => sum + family.variantCount, 0),
    standaloneArticles: standalone.length,
    regionOnlyArticles: okArticles.filter((article) => regionOnly.has(article.articleNumber)).length,
    note: "Pripadnost porodici = isti Shopware parentId. Cena se ne čita.",
  },
  families: familyRecords.sort((a, b) => a.id.localeCompare(b.id)),
  familyAliases: aliases,
  unlistedFamilies,
  standalone,
});
console.log(JSON.stringify(readJson(PATHS.source).meta, null, 1));
