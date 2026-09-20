/**
 * PRICE GATE — SATA sajt objavljuje cene, a crawler čita isti `dataLayer` koji ih nosi
 * (`window.ga4Product`). Ovaj modul dokazuje da u commitovanom opsegu synca nema NIJEDNOG
 * novčanog polja ni iznosa: ni ključa (`price`, `currency`, `taxRate`…), ni vrednosti (broj uz oznaku valute).
 *
 * Reč „price” u ZVANIČNOM NAZIVU artikla („… net price per meter”) nije novčani podatak — to je
 * tekst naziva bez iznosa. Takvi nazivi se broje zasebno (`namesMentioningPriceWord`), ne obaraju gate.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const MONETARY_KEY = /"(?:[a-z_]*price[a-z_]*|currency(?:Id|Code|Iso)?|vat|tax(?:Rate|es|Id)?|net|gross|amount|cost|msrp|uvp|rrp|discount|rebate|list_?price|real_?price|item_start_?price)"\s*:/gi;
const MONETARY_VALUE = /(?:€|£|\$|\b(?:EUR|USD|CHF|GBP|RSD)\b)\s?\d[\d.,]*|\d[\d.,]*\s?(?:€|£|\b(?:EUR|USD|CHF|GBP|RSD)\b)/g;

function walk(target) {
  if (!statSync(target).isDirectory()) return [target];
  return readdirSync(target).flatMap((name) => walk(path.join(target, name)));
}

/** @param {string[]} targets fajlovi ili direktorijumi */
export function scanForMonetaryData(targets, { root = process.cwd(), exclude = [] } = {}) {
  const findings = [];
  let namesMentioningPriceWord = 0;
  let files = 0;
  for (const file of targets.flatMap(walk).filter((candidate) => !exclude.includes(candidate)).sort()) {
    const text = readFileSync(file, "utf8");
    const relative = path.relative(root, file);
    files += 1;
    const isData = /\.json$/.test(file);
    if (isData) for (const match of text.matchAll(MONETARY_KEY)) findings.push({ file: relative, kind: "MONETARY_KEY", match: match[0] });
    // Skripte i testovi smeju da IMENUJU polja koja ne čitaju; iznos ne sme da stoji nigde.
    for (const match of text.matchAll(MONETARY_VALUE)) findings.push({ file: relative, kind: "MONETARY_VALUE", match: match[0] });
    if (isData) namesMentioningPriceWord += (text.match(/"(?:name|officialName)":\s*"[^"]*\bprice\b[^"]*"/gi) ?? []).length;
  }
  return { files, findings, namesMentioningPriceWord };
}
