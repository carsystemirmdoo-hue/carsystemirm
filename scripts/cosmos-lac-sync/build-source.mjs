#!/usr/bin/env node
/**
 * Cosmos Lac sync, korak 2 — IZVORNI MODEL (samo čitanje).
 *
 * Proizvođač vodi tri nivoa, i sva tri se čitaju sa njegovog sajta, ne iz naziva:
 *   LINIJA     — segment adrese /products/{category}/{family}/ + naziv iz breadcrumb-a
 *   PROIZVOD   — zvanični dokument „Product info”: isti PDF dele sve nijanse jednog proizvoda
 *                (`bumper-paint.pdf` → 5 nijansi), pa je dokument dokaz šta je JEDAN proizvod
 *   NIJANSA    — zvanična stranica /{product}/ sa šifrom u nazivu (RAL 1007, FB-100, N01, 260…)
 *
 * Šifra se čita iz zvaničnog naziva (deo ispred „–”, ili broj posle njega kod „Easy Max – 871 …”).
 */

import { readJson, writeJson } from "../carsystem-sync/lib/http.mjs";
import { PATHS } from "./lib/config.mjs";

const raw = readJson(PATHS.rawProducts);
const rawFamilies = readJson(PATHS.rawFamilies);
if (!raw || !rawFamilies) throw new Error("Nedostaje raw — `node scripts/cosmos-lac-sync/acquire-website.mjs`.");

const clean = (name) => String(name).replace(/™/g, "").replace(/\s+/g, " ").trim();

/** Šifre iz zvaničnog naziva: RAL 1007, FB-100 (iz „Fb – 100”), N01, R307, B-901, 260, 01… */
export function codesOf(name) {
  const text = clean(name).replace(/\b(F[bo])\s*[–-]\s*(\d{3,4})\b/gi, "$1-$2");
  const codes = new Set();
  for (const match of text.matchAll(/\bRal\s+(\d{4})\b/gi)) codes.add(`RAL ${match[1]}`);
  for (const match of text.matchAll(/\b([A-Z]{1,2}-?\d{2,4})\b/gi)) if (/\d/.test(match[1]) && /[A-Za-z]/.test(match[1])) codes.add(match[1].toUpperCase());
  for (const match of text.matchAll(/(?<![A-Za-z\d.-])(\d{1,4})(?![\d.]|\s?(?:ml|gr|kg|mm|l)\b)/gi)) codes.add(match[1]);
  return [...codes];
}

const packOf = (product) => (product.packs.length ? product.packs.join(", ") : null);
const products = raw.products.map((product) => {
  const name = clean(product.officialName);
  const [head, ...tail] = name.split(/\s+–\s+/);
  const document = product.documents[0] ?? null;
  return {
    url: product.url,
    slug: product.slug,
    category: product.category,
    family: product.family,
    officialName: name,
    codes: codesOf(name),
    // Šifra iz ADRESE: kada se naslov i adresa ne slažu (RAL 9003 pod naslovom „Ral 9002”), adresa je stabilniji ključ.
    slugCodes: codesOf(product.slug.replace(/-/g, " ").replace(/\b(f[bo]) (\d{3,4})\b/g, "$1-$2").replace(/\b([a-z]) (\d{3})\b/g, "$1-$2")),
    nameSlugConflict: (() => { const inName = /\b(?:ral\s+)?(\d{4})\b/i.exec(name)?.[1]; const inSlug = /ral-(\d{4})/.exec(product.slug)?.[1]; return Boolean(inName && inSlug && inName !== inSlug); })(),
    shade: tail.join(" – ") || null,
    nameHead: head,
    packs: product.packs,
    pack: packOf(product),
    isContainer: /container/i.test(name),
    document,
    // Isti dokument = isti zvanični proizvod; bez dokumenta proizvod je svoj sopstveni.
    productKey: document ? decodeURIComponent(document.split("/").pop()).replace(/\.pdf$/i, "").replace(/[-_](?:V\d+)?_?tds$/i, "").toLowerCase() : `name:${head.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
    image: product.images[0] ?? null,
    images: product.images.length,
    hasDescription: product.description.length > 0,
    featureCount: product.features.length,
    dateModified: product.dateModified,
  };
});

const families = rawFamilies.families.map((family) => {
  const members = products.filter((product) => `${product.category}/${product.family}` === family.key);
  const types = new Map();
  for (const member of members) types.set(member.productKey, [...(types.get(member.productKey) ?? []), member.slug]);
  return {
    key: family.key,
    officialCategory: family.officialCategory,
    officialName: family.officialName,
    shades: members.length,
    officialProducts: [...types].map(([key, slugs]) => ({ key, document: members.find((member) => member.productKey === key)?.document ?? null, shades: slugs.length })),
    packs: [...new Set(members.map((member) => member.pack).filter(Boolean))],
  };
});

// Ista stranica pod dve linije (npr. Flame Booster pod /color-lines/flame/): alias, ne drugi proizvod.
const bySlug = new Map();
for (const product of products) bySlug.set(product.slug, [...(bySlug.get(product.slug) ?? []), product.url]);
const sameSlug = [...bySlug].filter(([, urls]) => urls.length > 1).map(([slug, urls]) => ({ slug, urls }));
const byName = new Map();
for (const product of products) byName.set(product.officialName.toLowerCase(), [...(byName.get(product.officialName.toLowerCase()) ?? []), product.url]);
const sameName = [...byName].filter(([, urls]) => urls.length > 1).map(([name, urls]) => ({ name, urls }));

writeJson(PATHS.source, {
  meta: {
    source: "https://cosmoslac.com/ (engleski; referentni jezik)",
    families: families.length,
    officialProducts: families.reduce((sum, family) => sum + family.officialProducts.length, 0),
    shadePages: products.length,
    withCode: products.filter((product) => product.codes.length).length,
    withDocument: products.filter((product) => product.document).length,
    distinctDocuments: new Set(products.map((product) => product.document).filter(Boolean)).size,
    withImage: products.filter((product) => product.image).length,
    containerProducts: products.filter((product) => product.isContainer).length,
    sameSlugInTwoFamilies: sameSlug.length,
    sameOfficialNameTwice: sameName.length,
    nameSlugConflicts: products.filter((product) => product.nameSlugConflict).map((product) => ({ url: product.url, officialName: product.officialName })),
  },
  families,
  products,
  sameSlug,
  sameName,
});
console.log(JSON.stringify(readJson(PATHS.source).meta, null, 1));
