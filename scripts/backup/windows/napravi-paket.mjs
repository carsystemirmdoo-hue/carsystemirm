#!/usr/bin/env node
/**
 * Pravi Windows paket kopija: samo skripte za preuzimanje i PDF kopiju, njihove
 * zavisnosti (lib/backup, postgres) i PowerShell omotače. Bez ključeva, tajni i
 * zakazanih zadataka. Izlaz: <fascikla>/carsystem-kopije-<commit>.zip + SHA-256.
 *
 *   node scripts/backup/windows/napravi-paket.mjs --out <fascikla van repoa>
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repo = resolve(new URL("../../..", import.meta.url).pathname);
const outIdx = process.argv.indexOf("--out");
const out = resolve(process.argv[outIdx + 1] ?? ".");
if (out.startsWith(repo)) throw new Error("Paket ne sme nastati u repozitorijumu.");
const commit = execFileSync("git", ["-C", repo, "rev-parse", "--short", "HEAD"]).toString().trim();
const dirty = execFileSync("git", ["-C", repo, "status", "--porcelain", "scripts/backup", "lib/backup"]).toString().trim();
if (dirty) throw new Error("scripts/backup ili lib/backup imaju neusnimljene izmene — paket mora odgovarati commitu.");

const name = `carsystem-kopije-${commit}`;
const stage = join(mkdtempSync(join(tmpdir(), "paket-")), name);
const FILES = [
  "scripts/backup/offsite-pull.mjs",
  "scripts/backup/pdf-backup.mjs",
  "lib/backup/abort.mjs",
  "lib/backup/pdfIndex.mjs",
  "lib/backup/publicStatus.mjs",
  "lib/backup/redact.mjs",
  "lib/backup/retention.mjs",
];
for (const f of FILES) {
  mkdirSync(join(stage, "app", f, ".."), { recursive: true });
  cpSync(join(repo, f), join(stage, "app", f));
}
cpSync(join(repo, "node_modules", "postgres"), join(stage, "app", "node_modules", "postgres"), { recursive: true, dereference: true });
writeFileSync(join(stage, "app", "package.json"), JSON.stringify({ name: "carsystem-kopije", private: true, type: "module" }, null, 1));
mkdirSync(join(stage, "windows"));
for (const f of ["podesi-kopije.ps1", "kopije.ps1", "UPUTSTVO-KOPIJE.md"]) cpSync(join(repo, "scripts/backup/windows", f), join(stage, "windows", f));

// Ništa tajno ni lično u paketu.
const forbidden = [/AGE-SECRET-KEY-1/, /postgres(ql)?:\/\/[^\s"'`]*:[^@\s"'`]+@/, /gh[pousr]_[A-Za-z0-9]{20,}/, /github_pat_/, /@gmail\.com/i, /Register-ScheduledTask|schtasks/i];
for (const f of readdirSync(stage, { recursive: true }).map(String)) {
  const p = join(stage, f);
  if (statSync(p).isDirectory() || /node_modules/.test(f)) continue;
  const text = readFileSync(p, "utf8");
  for (const re of forbidden) if (re.test(text)) throw new Error(`Zabranjen sadržaj u paketu: ${f} (${re})`);
}
mkdirSync(out, { recursive: true });
const zip = join(out, `${name}.zip`);
rmSync(zip, { force: true });
execFileSync("zip", ["-qr", zip, name], { cwd: join(stage, "..") });
const sha = createHash("sha256").update(readFileSync(zip)).digest("hex").toUpperCase();
writeFileSync(`${zip}.sha256`, `${sha}  ${name}.zip\n`);
rmSync(join(stage, ".."), { recursive: true, force: true });
console.log(`${zip}\nSHA-256 ${sha}`);
