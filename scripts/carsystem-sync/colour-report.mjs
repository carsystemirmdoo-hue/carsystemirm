#!/usr/bin/env node
/**
 * Carsystem sync · revizija boja — izveštaj o proizvodima čiji je materijal
 * vidljiv na zvaničnoj slici (`packshotShade`), a nemaju potvrđenu boju serije,
 * pa kartica koristi boju brenda. NE menja nijednu boju.
 *
 * Preporuka po proizvodu:
 *   USE_EXISTING_FAMILY_COLOR  ista zvanična serija već ima potvrđenu boju
 *   KEEP_BRAND                 na slici dominira crvena Carsystem ambalaža
 *   NEEDS_MANUAL_REVIEW        uzorak je neodlučan (višebojan ili < 30 %)
 *
 * Izlaz: data/carsystem-sync/reports/colour-warnings.generated.json + .md
 */

import { writeFileSync } from "node:fs";
import path from "node:path";

import { PATHS } from "./lib/config.mjs";
import { readJson, writeJson } from "./lib/http.mjs";
import { seriesCodes } from "./lib/match.mjs";
import { PRODUCT_NAMED_COLORS } from "../../lib/productNamedColors.mjs";

const dataset = readJson(PATHS.siteDataset);
const plan = readJson(PATHS.plan);
const published = readJson(path.join(path.dirname(PATHS.imageManifest), "published-images.generated.json")).images;
const BRAND = "#E30613";

const expectShade = new Set(plan.items.filter((item) => item.action === "IMPORT" && item.taxonomy.packshotShade).map((item) => item.slug));
const hueDistance = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

/** Potvrđene boje po kodu serije: uvezeni proizvodi + ručna tabela sajta. */
const known = [
  ...dataset.products.filter((product) => product.shade).map((product) => ({ slug: product.slug, name: product.officialName, color: product.shade.color, codes: seriesCodes(product.officialName) })),
  ...Object.entries(PRODUCT_NAMED_COLORS).filter(([slug, entry]) => slug.startsWith("carsystem-") && entry.color).map(([slug, entry]) => ({ slug, name: entry.series ?? slug, color: entry.color, codes: seriesCodes(entry.series ?? "") })),
];

const rows = dataset.products
  .filter((product) => expectShade.has(product.slug) && !product.shade)
  .map((product) => {
    const meta = published[product.image.src] ?? {};
    const sample = meta.sample ?? {};
    const codes = seriesCodes(product.officialName);
    const family = known.find(
      (candidate) =>
        candidate.slug !== product.slug &&
        ((codes.length && candidate.codes.some((code) => codes.includes(code)) && /ceramic/i.test(candidate.name) === /ceramic/i.test(product.officialName)) ||
          candidate.name.toLowerCase() === product.officialName.toLowerCase()),
    );
    const packagingRed = sample.dominantHue !== undefined && hueDistance(sample.dominantHue, 0) <= 20 && (sample.dominantShare ?? 0) >= 0.3;
    const reason = packagingRed
      ? `dominira crvena (${Math.round(sample.dominantShare * 100)} % površine, hue ${sample.dominantHue}°), a zvanični opis ne navodi crvenu → tretirano kao ambalaža`
      : sample.dominantShare !== undefined
        ? `neodlučan uzorak: dominantna boja ${sample.dominantHex} pokriva ${Math.round(sample.dominantShare * 100)} % (< 30 %), zasićeno ${Math.round((sample.saturatedShare ?? 0) * 100)} % (≥ 15 %, pa nije ni neutralan)`
        : `nema dominantne zasićene boje; zasićeno ${Math.round((sample.saturatedShare ?? 0) * 100)} %`;
    return {
      slug: product.slug,
      product: product.name,
      officialImage: meta.sourceUrl ?? null,
      localImage: product.image.src,
      currentBackgroundSource: "boja brenda (lib/brand-card-colors.ts) — proizvod nema `manufacturerColor`",
      currentColor: BRAND,
      sample: { dominantHex: sample.dominantHex ?? null, dominantShare: sample.dominantShare ?? null, dominantHue: sample.dominantHue ?? null, saturatedShare: sample.saturatedShare ?? null, medianHex: sample.medianHex ?? null },
      reason,
      recommendation: family ? "USE_EXISTING_FAMILY_COLOR" : packagingRed ? "KEEP_BRAND" : "NEEDS_MANUAL_REVIEW",
      familyCandidate: family ? { slug: family.slug, name: family.name, color: family.color } : null,
    };
  });

const counts = rows.reduce((map, row) => ({ ...map, [row.recommendation]: (map[row.recommendation] ?? 0) + 1 }), {});
writeJson(path.join(path.dirname(PATHS.plan), "colour-warnings.generated.json"), { total: rows.length, counts, rows });

const md = [
  "# Carsystem sync — proizvodi na boji brenda iako im je materijal vidljiv na slici",
  "",
  `Ukupno ${rows.length}. Nijedna boja nije menjana; ovo je spisak za ručnu odluku.`,
  "",
  `| Preporuka | Broj |`, `|---|---:|`, ...Object.entries(counts).map(([key, value]) => `| ${key} | ${value} |`),
  "",
  "| Proizvod | Uzorak sa packshota | Razlog | Preporuka | Kandidat serije |",
  "|---|---|---|---|---|",
  ...rows.map((row) => `| [${row.product}](${row.officialImage}) | ${row.sample.dominantHex ?? "—"} · ${row.sample.dominantShare !== null ? Math.round(row.sample.dominantShare * 100) + " %" : "—"} | ${row.reason} | **${row.recommendation}** | ${row.familyCandidate ? `\`${row.familyCandidate.slug}\` ${row.familyCandidate.color}` : "—"} |`),
  "",
];
writeFileSync(path.join(path.dirname(PATHS.plan), "COLOUR_WARNINGS.md"), md.join("\n"));
console.log(JSON.stringify({ total: rows.length, counts, familyCandidates: rows.filter((row) => row.familyCandidate).map((row) => `${row.slug} ← ${row.familyCandidate.slug} ${row.familyCandidate.color}`) }, null, 2));
