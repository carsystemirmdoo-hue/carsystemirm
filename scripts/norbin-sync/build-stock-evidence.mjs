#!/usr/bin/env node
/**
 * Norbin — DOKAZ O AKTIVNOSTI ARTIKLA, izveden iz commitovane dokumentacije.
 *
 * Izvorni izveštaj (`lager 23.7.26.pdf`) namerno NIJE u repozitorijumu jer sadrži cene i
 * količine. Njegov Norbin deo je već pregledan i prepisan u `docs/NORBIN_PRODUCT_INVENTORY.md`
 * §11, pa se fixture generiše IZ TE TABELE — dakle iz commitovanog ulaza, bez mreže, keša i
 * fajlova van repozitorijuma.
 *
 * Fixture sadrži isključivo ono što je potrebno za identitet i lokalnu dostupnost:
 * šifra proizvođača, naš ERP broj artikla, pakovanje i status aktivnosti. Bez cena, marži,
 * količina, kupaca i prometa. Status NIJE tvrdnja o dostupnosti danas.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { writeJson } from "../carsystem-sync/lib/http.mjs";
import { REPO_ROOT } from "./lib/config.mjs";

const EVIDENCE_FILE = path.join("docs", "NORBIN_PRODUCT_INVENTORY.md");
const OUT = path.join(REPO_ROOT, "data", "knowledge", "norbin-stock-evidence.generated.json");

const markdown = readFileSync(path.join(REPO_ROOT, EVIDENCE_FILE), "utf8");
const section = markdown.slice(markdown.indexOf("## 11. Commercial reconciliation table"), markdown.indexOf("### 11.1"));

const STATUS = /(RECENT_STOCK_EVIDENCE|RECENT_ZERO_STOCK)/;
const articles = [];
for (const line of section.split("\n")) {
  if (!line.startsWith("|")) continue;
  const cells = line.split("|").map((cell) => cell.trim());
  const code = /`(N\d{2}-[A-Z]?\d{2,3})`/.exec(cells[1] ?? "")?.[1];
  const articleId = /\*\*(\d{6})\*\*/.exec(cells[3] ?? "")?.[1];
  const status = STATUS.exec(cells[7] ?? "")?.[1];
  if (!code || !articleId || !status) continue;
  // Zvanično pakovanje se piše zarezom kao decimalnim znakom, kao i svuda na sajtu.
  const pack = (cells[5] ?? "").replace(/\./g, ",").replace(/\s+/g, " ").trim() || null;
  articles.push({ articleId, manufacturerCode: code, pack, status });
}
articles.sort((a, b) => a.manufacturerCode.localeCompare(b.manufacturerCode) || a.articleId.localeCompare(b.articleId));

const codes = [...new Set(articles.map((article) => article.manufacturerCode))].sort();
writeJson(OUT, {
  $comment:
    "Generisano skriptom scripts/norbin-sync/build-stock-evidence.mjs iz docs/NORBIN_PRODUCT_INVENTORY.md §11. " +
    "Sadrži isključivo dokaz o aktivnosti artikla — bez cena, marži, količina, kupaca i prometa. " +
    "Status NIJE tvrdnja o dostupnosti danas.",
  source: {
    label: "lager 23.7.26.pdf",
    printedOn: "2026-07-23",
    kind: "carsystem-stock-report",
    note: "Izveštaj nije u repozitorijumu jer sadrži cene i količine.",
    evidence: { file: EVIDENCE_FILE, section: "§11", sha256: createHash("sha256").update(markdown).digest("hex") },
  },
  counts: {
    articles: articles.length,
    distinctCodes: codes.length,
    recentStockEvidence: articles.filter((article) => article.status === "RECENT_STOCK_EVIDENCE").length,
    recentZeroStock: articles.filter((article) => article.status === "RECENT_ZERO_STOCK").length,
  },
  codes,
  articles,
});
console.log(JSON.stringify({ articles: articles.length, codes: codes.length, codesList: codes }, null, 1));
