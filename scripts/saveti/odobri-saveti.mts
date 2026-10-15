/**
 * Odobrenje članka za objavu — radnja IMENOVANE OSOBE iz firme.
 *
 *   npm run saveti:odobri -- --id=SV-0012 --odobrio="Ime Prezime" --uloga="tehnički recenzent"
 *   npm run saveti:odobri -- --id=SV-0012,SV-0013 --odobrio="…" --uloga="…"
 *   npm run saveti:odobri -- --povuci --id=SV-0012 --razlog="…"      (povlačenje objavljenog)
 *
 * Odobrenje zapisuje ko je odobrio, kada i OTISAK tačno tog teksta. Ako se
 * tekst posle toga izmeni, otisak se više ne poklapa, build pada, a kapija
 * članak ne objavljuje dok ga neko ponovo ne odobri. Tako se objavljuje samo
 * ono što je čovek stvarno pročitao.
 *
 * Skripta ne odobrava članak koji nije napisan i nije prošao tehničku i
 * jezičku proveru, niti članak koji čeka stručnu potvrdu.
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { formatZonedIso } from "../../lib/saveti/vreme.mjs";
import { schedulingBlockers } from "../../lib/saveti/planer.mjs";

// Ulaz su YAML frontmatter i generisani JSON neproverenog oblika; svako polje se proverava eksplicitno.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;

const ROOT = path.resolve(import.meta.dirname, "../..");
const ARTICLES = path.join(ROOT, "data/saveti/clanci.generated.json");
const CONTENT = path.join(ROOT, "content/saveti/clanci");

const arg = (name: string) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const ids = (arg("id") ?? "").split(",").map((value) => value.trim()).filter(Boolean);
const withdraw = process.argv.includes("--povuci");
const person = arg("odobrio")?.trim();
const role = arg("uloga")?.trim();
const reason = arg("razlog")?.trim();

if (!ids.length) {
  console.error("Navedite --id=SV-0000 (ili više, razdvojeno zarezom).");
  process.exit(1);
}
if (!withdraw && (!person || !role)) {
  console.error("Odobrenje traži --odobrio=\"Ime Prezime\" i --uloga=\"…\" (stvarna osoba i njena uloga).");
  process.exit(1);
}
if (withdraw && !reason) {
  console.error("Povlačenje traži --razlog=\"…\".");
  process.exit(1);
}

const { clanci } = JSON.parse(readFileSync(ARTICLES, "utf8"));
const byId = new Map(clanci.map((article: Loose) => [article.id, article]));
const stamp = formatZonedIso(new Date());

let failed = false;
for (const id of ids) {
  const article: Loose = byId.get(id);
  if (!article) {
    console.error(`✗ ${id}: ne postoji (pokrenite prvo npm run saveti:build)`);
    failed = true;
    continue;
  }
  const file = path.join(CONTENT, `${article.slug}.md`);
  const raw = readFileSync(file, "utf8");
  const end = raw.indexOf("\n---", 4);
  let front = raw.slice(0, end);
  const rest = raw.slice(end);

  if (withdraw) {
    front = front.replace(/\npovucen:[\s\S]*?(?=\n[a-zA-Z]|$)/, "");
    front += `\npovucen:\n  datum: "${stamp}"\n  razlog: ${JSON.stringify(reason)}`;
  } else {
    const blockers = schedulingBlockers(article);
    if (blockers.length) {
      console.error(`✗ ${id}: ne može se odobriti — ${blockers.join("; ")}`);
      failed = true;
      continue;
    }
    front = front.replace(/\nodobrenje:[\s\S]*?(?=\n[a-zA-Z]|$)/, "");
    front += `\nodobrenje:\n  odobrio: ${JSON.stringify(person)}\n  uloga: ${JSON.stringify(role)}\n  datum: "${stamp}"\n  otisak: "${article.otisak}"`;
  }
  writeFileSync(file, `${front}${rest}`);
  console.log(`✔ ${id} ${withdraw ? "povučen" : `odobren (otisak ${article.otisak})`}`);
}

console.log("Sledeće: npm run saveti:build && npm run saveti:plan, pa commit.");
process.exit(failed ? 1 : 0);
