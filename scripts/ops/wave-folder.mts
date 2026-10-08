/**
 * Fascikla talasa za konektor: tačno fajlovi iz manifesta, kao KOPIJE.
 *
 *   npx tsx scripts/ops/wave-folder.mts --talas ~/.carsystem-private/talas-01-2025-01.json \
 *     --fascikla ~/.carsystem-private/talasi/2025-01
 *
 * Konektor čita jednu fasciklu, bez podfascikli i bez simboličkih veza; talas
 * je izbor fajlova (manifest), ne cela godišnja fascikla. Originali se samo
 * čitaju — ne menjaju se, ne premeštaju, ne brišu. Svaka kopija se proverava
 * otiskom iz manifesta; postojeća kopija istog otiska se preskače, a fajl
 * koji nije iz manifesta ili ima drugi otisak zaustavlja rad.
 */
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { copyFile, mkdir, readdir, readFile, chmod } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

const rest = process.argv.slice(2);
const arg = (n: string) => { const i = rest.indexOf(`--${n}`); return i >= 0 ? rest[i + 1] : undefined; };
const expand = (p: string) => path.resolve(p.replace(/^~/, homedir()));
const repoRoot = path.resolve(import.meta.dirname, "../..");
const sha = async (p: string) => createHash("sha256").update(await readFile(p)).digest("hex");

async function main() {
  const manifestPath = expand(arg("talas") ?? "");
  const folder = expand(arg("fascikla") ?? "");
  if (!arg("talas") || !arg("fascikla")) throw new Error("Upotreba: --talas <manifest.json> --fascikla <privatna fascikla>");
  if (folder.startsWith(repoRoot + path.sep)) throw new Error("Fascikla talasa ne sme biti u repozitorijumu.");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as { dokumenti: { fajl: string; sha256: string }[] };
  await mkdir(folder, { recursive: true, mode: 0o700 });
  await chmod(folder, 0o700);

  const want = new Map(manifest.dokumenti.map((d) => [d.sha256, d]));
  // Šta već postoji u fascikli talasa: sve mora biti iz manifesta.
  const present = new Set<string>();
  for (const name of await readdir(folder)) {
    const h = await sha(path.join(folder, name));
    if (!want.has(h)) throw new Error("U fascikli talasa postoji fajl koji nije iz manifesta — zaustavljeno.");
    present.add(h);
  }
  let copied = 0;
  let skipped = 0;
  for (const [i, d] of manifest.dokumenti.entries()) {
    if (present.has(d.sha256)) { skipped++; continue; }
    if ((await sha(d.fajl)) !== d.sha256) throw new Error(`Original se promenio posle pravljenja manifesta (stavka ${i + 1}) — zaustavljeno.`);
    // Ime kopije ne nosi ime originala (ono ume da sadrži naziv kupca).
    const target = path.join(folder, `${String(i + 1).padStart(4, "0")}-${d.sha256.slice(0, 12)}.pdf`);
    await copyFile(d.fajl, target, constants.COPYFILE_EXCL);
    await chmod(target, 0o600);
    if ((await sha(target)) !== d.sha256) throw new Error("Kopija se ne poklapa sa otiskom — zaustavljeno.");
    copied++;
  }
  console.log(`Talas: ${manifest.dokumenti.length} dokumenata; kopirano ${copied}, već postoji ${skipped}. Originali nisu menjani.`);
}

main().catch((e: unknown) => { console.error((e as Error).message); process.exit(1); });
