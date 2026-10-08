#!/usr/bin/env node
/**
 * Dnevna inkrementalna kopija izvornih PDF-ova (samo čitanje izvora).
 *
 *   node scripts/backup/pdf-backup.mjs run --source <fascikla> --dest <skladište> --state <stanje.json> --recipients <age.pub> [--label kancelarija]
 *   node scripts/backup/pdf-backup.mjs restore --dest <skladište> --index <index.json.age> --identity <age.key> --out <fascikla> [--prefix 2026/]
 *
 * - Izvor se samo čita; ništa se ne pomera ni ne briše.
 * - Skladište je adresirano sadržajem (`objects/ab/<sha256>.pdf.age`): promenjen
 *   fajl dobija nov objekat, stari ostaje; obrisan original se samo beleži.
 *   Ovaj alat NIKAD ne briše objekat iz skladišta.
 * - Stanje (`--state`) je lokalno, na istom računaru gde su PDF-ovi (600).
 *   U skladište ide samo ŠIFROVAN indeks (`index/<vreme>.json.age`), jer
 *   putanje mogu sadržati nazive kupaca.
 * - Opciono upisuje sažetak (samo brojeve) u portal: BACKUP_STATUS_URL.
 */
import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { chmodSync, createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { installAbortHandlers, isAborting, killOnAbort, onAbort } from "../../lib/backup/abort.mjs";
import { applyScan, emptyIndex, markStored, objectPath, planScan } from "../../lib/backup/pdfIndex.mjs";
import { pathToFileURL } from "node:url";
import { makeLogger, redact } from "../../lib/backup/redact.mjs";

const log = makeLogger(undefined, () => [process.env.BACKUP_STATUS_URL].filter(Boolean));
const AGE_BIN = process.env.AGE_BIN ?? "age";

function args() {
  const [cmd, ...rest] = process.argv.slice(2);
  const o = { _: cmd };
  for (let i = 0; i < rest.length; i += 1) {
    const k = rest[i].replace(/^--/, "");
    o[k] = rest[i + 1] && !rest[i + 1].startsWith("--") ? rest[++i] : true;
  }
  return o;
}

function age(argv) {
  return new Promise((ok, fail) => {
    const p = spawn(AGE_BIN, argv, { stdio: ["ignore", "ignore", "pipe"] });
    const off = killOnAbort(p);
    p.on("close", () => off());
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("error", fail);
    p.on("close", (c) => (c === 0 ? ok() : fail(new Error(`age: ${redact(err.trim().slice(-300))}`))));
  });
}

const sha256File = (path) =>
  new Promise((ok, fail) => {
    const h = createHash("sha256");
    createReadStream(path).on("data", (d) => h.update(d)).on("end", () => ok(h.digest("hex"))).on("error", fail);
  });

/** Svi PDF-ovi ispod izvora; putanje relativne, sa „/“ i na Windows-u. */
export function scanPdfs(root) {
  const out = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && /\.pdf$/i.test(e.name)) {
        const st = statSync(p);
        out.push({ path: relative(root, p).split(sep).join("/"), size: st.size, mtimeMs: Math.floor(st.mtimeMs) });
      }
    }
  };
  walk(root);
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Ostaci prekinutog prolaza: nepotpuni šifrovani objekti (`*.tmp`) i otvoren
 * privremeni indeks (`.indeks-*.json`) pored stanja. Stanje se upisuje tek na
 * kraju, pa prekinut prolaz sledeći put samo ponovi posao (objekti koji već
 * postoje se ne prepisuju).
 */
export function cleanupStale(dest, statePath) {
  let removed = 0;
  const objects = join(dest, "objects");
  if (existsSync(objects)) {
    for (const f of readdirSync(objects, { recursive: true })) {
      if (String(f).endsWith(".tmp")) { rmSync(join(objects, String(f)), { force: true }); removed += 1; }
    }
  }
  const stateDir = dirname(resolve(statePath));
  if (existsSync(stateDir)) {
    for (const f of readdirSync(stateDir)) if (/^\.indeks-[0-9a-f]+\.json$/.test(f)) { rmSync(join(stateDir, f), { force: true }); removed += 1; }
  }
  return removed;
}

export async function runBackup(o) {
  for (const k of ["source", "dest", "state", "recipients"]) if (!o[k]) throw new Error(`run traži --${k}.`);
  const source = resolve(o.source);
  const dest = resolve(o.dest);
  if (dest.startsWith(source + sep) || dest === source) throw new Error("Skladište ne sme biti unutar izvorne fascikle.");
  mkdirSync(join(dest, "objects"), { recursive: true });
  mkdirSync(join(dest, "index"), { recursive: true });
  cleanupStale(dest, o.state);
  const now = new Date().toISOString();
  let index = existsSync(o.state) ? JSON.parse(readFileSync(o.state, "utf8")) : emptyIndex();

  const scan = scanPdfs(source);
  const plan = planScan(index, scan);
  const hashed = [];
  for (const f of plan.toHash) hashed.push({ ...f, sha256: await sha256File(join(source, f.path)) });
  const applied = applyScan(index, hashed, plan.missing, now);
  index = applied.index;

  let stored = 0;
  for (const sha of applied.newObjects) {
    const target = join(dest, objectPath(sha));
    if (existsSync(target)) {
      index = markStored(index, sha, { storedAt: now, existed: true });
      continue;
    }
    const src = hashed.find((h) => h.sha256 === sha);
    // Sadržaj se ponovo proverava neposredno pre šifrovanja (fajl se mogao promeniti).
    if ((await sha256File(join(source, src.path))) !== sha) {
      log(`preskočeno (menja se tokom prolaza): ${src.path.split("/").length} nivoa`);
      delete index.files[src.path];
      continue;
    }
    mkdirSync(dirname(target), { recursive: true });
    const tmp = `${target}.${randomBytes(4).toString("hex")}.tmp`;
    const offTmp = onAbort(() => rmSync(tmp, { force: true }));
    await age(["--encrypt", "--recipients-file", o.recipients, "--output", tmp, join(source, src.path)]);
    renameSync(tmp, target);
    offTmp();
    index = markStored(index, sha, { storedAt: now });
    stored += 1;
  }

  // Indeks: šifrovan u skladište, otvoren samo lokalno.
  const plainIndex = join(dirname(resolve(o.state)), `.indeks-${randomBytes(4).toString("hex")}.json`);
  const offPlain = onAbort(() => rmSync(plainIndex, { force: true }));
  writeFileSync(plainIndex, JSON.stringify(index), { mode: 0o600 });
  const indexOut = join(dest, "index", `${now.replace(/[-:]/g, "").replace(/\..+/, "Z")}.json.age`);
  const offIdx = onAbort(() => rmSync(indexOut, { force: true }));
  try {
    await age(["--encrypt", "--recipients-file", o.recipients, "--output", indexOut, plainIndex]);
  } finally {
    rmSync(plainIndex, { force: true });
    offPlain();
    offIdx();
  }
  writeFileSync(o.state, JSON.stringify(index, null, 1), { mode: 0o600 });
  chmodSync(o.state, 0o600);

  const summary = {
    pregledano: scan.length,
    hesirano: hashed.length,
    novih: applied.added.length,
    promenjenih: applied.changed.length,
    nestalihUIzvoru: applied.missing.length,
    novihObjekata: stored,
    ukupnoObjekata: Object.keys(index.objects).length,
  };
  log(`PDF kopija: ${JSON.stringify(summary)}`);
  if (process.env.BACKUP_STATUS_URL) {
    const postgres = (await import("postgres")).default;
    const sql = postgres(process.env.BACKUP_STATUS_URL, { max: 1, onnotice: () => {} });
    try {
      await sql`INSERT INTO backup_runs (kind, ok, started_at, finished_at, source_label, files_new, files_changed, files_missing, rows)
        VALUES ('pdf_backup', true, ${now}, now(), ${o.label ?? null}, ${summary.novih}, ${summary.promenjenih}, ${summary.nestalihUIzvoru}, ${summary.ukupnoObjekata})`;
    } finally {
      await sql.end();
    }
  }
  return summary;
}

export async function restorePdfs(o) {
  for (const k of ["dest", "index", "identity", "out"]) if (!o[k]) throw new Error(`restore traži --${k}.`);
  const tmpIndex = join(resolve(o.out), `.indeks-${randomBytes(4).toString("hex")}.json`);
  mkdirSync(resolve(o.out), { recursive: true });
  const offIdx = onAbort(() => rmSync(tmpIndex, { force: true }));
  let index;
  try {
    await age(["--decrypt", "--identity", o.identity, "--output", tmpIndex, o.index]);
    index = JSON.parse(readFileSync(tmpIndex, "utf8"));
  } finally {
    rmSync(tmpIndex, { force: true });
    offIdx();
  }
  let restored = 0;
  const problems = [];
  for (const [path, f] of Object.entries(index.files)) {
    if (o.prefix && !path.startsWith(o.prefix)) continue;
    if (path.split("/").some((part) => part === ".." || part === "")) { problems.push("neispravna putanja u indeksu"); continue; }
    const target = join(resolve(o.out), ...path.split("/"));
    mkdirSync(dirname(target), { recursive: true });
    await age(["--decrypt", "--identity", o.identity, "--output", target, join(resolve(o.dest), objectPath(f.sha256))]);
    if ((await sha256File(target)) !== f.sha256) problems.push(`otisak se ne poklapa: ${path}`);
    else restored += 1;
  }
  log(`vraćeno PDF-ova: ${restored}${problems.length ? `, problema: ${problems.length}` : ""}`);
  if (problems.length) process.exitCode = 1;
  return { restored, problems };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  installAbortHandlers(log);
  const o = args();
  const fn = { run: runBackup, restore: restorePdfs }[o._];
  if (!fn) {
    log("Komande: run, restore");
    process.exit(2);
  }
  fn(o).catch((e) => {
    if (isAborting()) return; // čišćenje posle prekida samo završava proces (130/143)
    log(`GREŠKA: ${e?.message ?? e}`);
    process.exit(1);
  });
}
