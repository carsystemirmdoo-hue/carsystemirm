#!/usr/bin/env node
/**
 * Kopija cele baze: snimak → manifest → vraćanje u praznu bazu → šifrovanje.
 *
 *   SOURCE_DATABASE_URL=… node scripts/backup/db-backup.mjs dump --out <fascikla> [--label pilot]
 *   RESTORE_ADMIN_URL=…   node scripts/backup/db-backup.mjs verify --dump <f.dump> --manifest <f.manifest.json> [--keep]
 *                         node scripts/backup/db-backup.mjs encrypt --in <fajl> --recipients <age.pub> [--remove-plain]
 *                         node scripts/backup/db-backup.mjs decrypt-check --in <f.age> --identity <age.key> --expect-sha <sha256>
 *                         node scripts/backup/db-backup.mjs status --manifest <m> --verify <v> --encrypted <f.age>… --out <status.json>
 *   BACKUP_STATUS_URL=…   node scripts/backup/db-backup.mjs record --kind db_verified|offsite_stored --status <status.json> [--detail "…"]
 *   BACKUP_STATUS_URL=…   node scripts/backup/db-backup.mjs record-failure --kind db_verified --detail "…"
 *
 * Pravila:
 *  - adrese baza i ključevi idu ISKLJUČIVO kroz okruženje ili fajl, nikad kao
 *    argument (argumenti se vide u spisku procesa i u logu CI-ja);
 *  - svaki ispis prolazi kroz `redact`;
 *  - `dump` drži transakciju REPEATABLE READ otvorenom dok `pg_dump --snapshot`
 *    ne završi, pa manifest i kopija opisuju isto stanje.
 */
import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { chmodSync, createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import postgres from "postgres";
import { buildManifest, compareManifests, OWNED_SEQUENCES_SQL, publicSummary, sequenceCoverageSql } from "../../lib/backup/manifest.mjs";
import { pathToFileURL } from "node:url";
import { installAbortHandlers, isAborting, killOnAbort, onAbort } from "../../lib/backup/abort.mjs";
import { LABEL_RE, publicShaLineOk, publicStatusProblems } from "../../lib/backup/publicStatus.mjs";
import { makeLogger, redact } from "../../lib/backup/redact.mjs";

const SECRET_ENVS = ["SOURCE_DATABASE_URL", "RESTORE_ADMIN_URL", "BACKUP_STATUS_URL"];
const log = makeLogger(undefined, () => SECRET_ENVS.map((k) => process.env[k]).filter(Boolean));
const PG_BIN = process.env.PG_BIN ?? "";
const AGE_BIN = process.env.AGE_BIN ?? "age";
const bin = (name) => (PG_BIN ? join(PG_BIN, name) : name);

function args() {
  const [cmd, ...rest] = process.argv.slice(2);
  const o = { _: cmd, encrypted: [] };
  for (let i = 0; i < rest.length; i += 1) {
    const k = rest[i].replace(/^--/, "");
    const v = rest[i + 1] && !rest[i + 1].startsWith("--") ? rest[++i] : true;
    if (k === "encrypted") o.encrypted.push(v);
    else o[k] = v;
  }
  return o;
}

function need(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Nedostaje promenljiva okruženja ${name}.`);
  return v;
}

/** Postgres adresa → PG* promenljive za alate (lozinka nikad u argumentu). */
export function pgEnv(url) {
  const u = new URL(url);
  const env = {
    PGHOST: u.hostname,
    PGPORT: u.port || "5432",
    PGUSER: decodeURIComponent(u.username),
    PGDATABASE: decodeURIComponent(u.pathname.replace(/^\//, "")),
  };
  if (u.password) env.PGPASSWORD = decodeURIComponent(u.password);
  const ssl = u.searchParams.get("sslmode");
  if (ssl) env.PGSSLMODE = ssl;
  return env;
}

function run(cmd, argv, { env = {}, stdinFile = null } = {}) {
  return new Promise((ok, fail) => {
    const p = spawn(cmd, argv, { env: { ...process.env, ...env }, stdio: [stdinFile ? "pipe" : "ignore", "pipe", "pipe"] });
    const off = killOnAbort(p);
    p.on("close", () => off());
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.stdout.on("data", () => {});
    if (stdinFile) createReadStream(stdinFile).pipe(p.stdin);
    p.on("error", fail);
    p.on("close", (code) => (code === 0 ? ok() : fail(new Error(`${basename(cmd)} je završio sa ${code}: ${redact(err.trim().slice(-800))}`))));
  });
}

export function sha256File(path) {
  return new Promise((ok, fail) => {
    const h = createHash("sha256");
    createReadStream(path).on("data", (d) => h.update(d)).on("end", () => ok(h.digest("hex"))).on("error", fail);
  });
}

const queryFn = (sql) => (text) => sql.unsafe(text);

async function dump(o) {
  const url = need("SOURCE_DATABASE_URL");
  const label = o.label ?? "db";
  if (!LABEL_RE.test(label)) throw new Error("Oznaka (--label) sme da sadrži samo mala slova, cifre i crtu.");
  const out = resolve(o.out ?? ".");
  mkdirSync(out, { recursive: true, mode: 0o700 });
  // Ostaci prethodnog prekida (nepotpune kopije) se brišu pre novog posla.
  for (const f of readdirSync(out).filter((f) => f.endsWith(".dump.part"))) rmSync(join(out, f), { force: true });
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "Z");
  const base = join(out, `carsystem-${label}-${stamp}`);
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  const conn = await sql.reserve();
  try {
    await conn.unsafe("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const [{ snapshot }] = await conn.unsafe("SELECT pg_export_snapshot() AS snapshot");
    log(`snimak izvezen; pravim manifest u istom snimku`);
    const manifest = await buildManifest(queryFn(conn), { snapshot: "exported" });
    log(`manifest: ${manifest.totals.tables} tabela, ${manifest.totals.rows} redova, migracija ${manifest.migrations.count}`);
    // Bez --no-privileges: dozvole se vraćaju i proveravaju.
    // Kopija se piše kao .part i dobija pravo ime tek kada je cela; prekid je briše.
    const part = `${base}.dump.part`;
    const offPart = onAbort(() => rmSync(part, { force: true }));
    await run(bin("pg_dump"), ["--format=custom", "--no-owner", `--snapshot=${snapshot}`, `--file=${part}`], { env: pgEnv(url) });
    manifest.dumpSha256 = await sha256File(part);
    manifest.dumpBytes = statSync(part).size;
    writeFileSync(`${base}.manifest.json`, JSON.stringify(manifest, null, 1), { mode: 0o600 });
    renameSync(part, `${base}.dump`);
    offPart();
    await conn.unsafe("COMMIT");
    log(`kopija: ${basename(base)}.dump (${manifest.dumpBytes} B), sha256 ${manifest.dumpSha256}`);
    return base;
  } catch (e) {
    await conn.unsafe("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    conn.release();
    await sql.end();
  }
}

async function verify(o) {
  const admin = need("RESTORE_ADMIN_URL");
  const manifest = JSON.parse(readFileSync(o.manifest, "utf8"));
  const started = Date.now();
  const sha = await sha256File(o.dump);
  if (sha !== manifest.dumpSha256) throw new Error("Otisak kopije se ne poklapa sa manifestom — kopija je promenjena ili oštećena.");
  const dbName = `restore_check_${Date.now()}_${randomBytes(3).toString("hex")}`;
  const adminSql = postgres(admin, { max: 1, onnotice: () => {} });
  const report = { ok: false, restoredDb: dbName, diffs: [], sequenceProblems: [], startedAt: new Date(started).toISOString() };
  const offDb = onAbort(async () => {
    const s2 = postgres(admin, { max: 1, onnotice: () => {} });
    await s2.unsafe(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`).catch(() => {});
    await s2.end();
  });
  try {
    await adminSql.unsafe(`CREATE DATABASE "${dbName}"`);
    // Uloge iz dozvola moraju postojati da bi se GRANT vratio; prave se bez prijave.
    for (const role of [...new Set(manifest.grants.map((g) => g.grantee))]) {
      await adminSql.unsafe(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ${quoteLit(role)}) THEN CREATE ROLE "${role.replace(/"/g, '""')}" NOLOGIN; END IF; END $$`);
    }
    const target = new URL(admin);
    target.pathname = `/${dbName}`;
    await run(bin("pg_restore"), ["--no-owner", "--exit-on-error", `--dbname=${dbName}`, o.dump], { env: pgEnv(target.toString()) });
    const rs = postgres(target.toString(), { max: 1, onnotice: () => {} });
    try {
      const restored = await rs.begin("ISOLATION LEVEL REPEATABLE READ READ ONLY", (tx) => buildManifest(queryFn(tx)));
      report.diffs = compareManifests(manifest, restored);
      for (const seq of await rs.unsafe(OWNED_SEQUENCES_SQL)) {
        const [c] = await rs.unsafe(sequenceCoverageSql(seq));
        if (BigInt(c.last_value) < BigInt(c.max_value)) report.sequenceProblems.push(`${seq.seq_schema}.${seq.seq_name}: ${c.last_value} < max ${c.max_value}`);
      }
      report.restored = publicSummary(restored);
    } finally {
      await rs.end();
    }
    report.ok = report.diffs.length === 0 && report.sequenceProblems.length === 0;
  } finally {
    if (!o.keep) await adminSql.unsafe(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`).catch(() => {});
    await adminSql.end();
    offDb();
  }
  report.durationMs = Date.now() - started;
  report.kept = Boolean(o.keep);
  const out = o.out ?? o.manifest.replace(/\.manifest\.json$/, ".verify.json");
  writeFileSync(out, JSON.stringify(report, null, 1), { mode: 0o600 });
  log(report.ok ? `VRAĆANJE PROVERENO: ${report.restored.tables} tabela, ${report.restored.rows} redova, ${Math.round(report.durationMs / 1000)} s` : `VRAĆANJE NIJE PROŠLO: ${[...report.diffs, ...report.sequenceProblems].join("; ")}`);
  if (!report.ok) process.exitCode = 1;
  return report;
}

const quoteLit = (s) => `'${String(s).replace(/'/g, "''")}'`;

async function encrypt(o) {
  if (!o.in || !o.recipients) throw new Error("encrypt traži --in i --recipients (fajl sa javnim ključem).");
  const out = `${o.in}.age`;
  const offOut = onAbort(() => rmSync(out, { force: true }));
  await run(AGE_BIN, ["--encrypt", "--recipients-file", o.recipients, "--output", out, o.in]);
  offOut();
  chmodSync(out, 0o600);
  const sha = await sha256File(out);
  writeFileSync(`${out}.sha256`, `${sha}  ${basename(out)}\n`, { mode: 0o600 });
  if (o["remove-plain"]) rmSync(o.in);
  log(`šifrovano: ${basename(out)} sha256 ${sha}${o["remove-plain"] ? " (otvoren fajl obrisan)" : ""}`);
  return { out, sha };
}

async function decryptCheck(o) {
  if (!o.in || !o.identity || !o["expect-sha"]) throw new Error("decrypt-check traži --in, --identity i --expect-sha.");
  const tmp = join(dirname(resolve(o.in)), `.provera-${randomBytes(4).toString("hex")}`);
  const offTmp = onAbort(() => rmSync(tmp, { force: true }));
  try {
    await run(AGE_BIN, ["--decrypt", "--identity", o.identity, "--output", tmp, o.in]);
    const sha = await sha256File(tmp);
    if (sha !== o["expect-sha"]) throw new Error("Dešifrovan sadržaj se ne poklapa sa očekivanim otiskom.");
    if (o.out) {
      writeFileSync(o.out, readFileSync(tmp), { mode: 0o600 });
    }
    log(`dešifrovanje provereno: ${basename(o.in)} → sha256 ${sha}`);
  } finally {
    if (existsSync(tmp)) rmSync(tmp);
    offTmp();
  }
}

async function status(o) {
  const manifest = JSON.parse(readFileSync(o.manifest, "utf8"));
  const verifyReport = o.verify ? JSON.parse(readFileSync(o.verify, "utf8")) : null;
  // Neproverena kopija ne sme da dobije status — posao mora da stane ranije.
  if (!verifyReport?.ok && !o["allow-unverified"]) throw new Error("Vraćanje nije provereno — status se ne pravi.");
  const files = [];
  for (const f of o.encrypted) files.push({ name: basename(f), bytes: statSync(f).size, sha256: await sha256File(f) });
  const s = {
    kind: "db_verified",
    createdAt: manifest.createdAt,
    summary: publicSummary(manifest),
    dumpSha256: manifest.dumpSha256,
    dumpBytes: manifest.dumpBytes,
    verified: Boolean(verifyReport?.ok),
    verifyDurationMs: verifyReport?.durationMs ?? null,
    encrypted: files,
    githubRunId: process.env.GITHUB_RUN_ID ?? null,
  };
  // Status je NEŠIFROVAN u artefaktu: sme samo ono što propušta bela lista.
  const problems = publicStatusProblems(s);
  if (problems.length) throw new Error(`Status bi otkrio nedozvoljen sadržaj: ${problems.join("; ")}`);
  writeFileSync(o.out, JSON.stringify(s, null, 1), { mode: 0o600 });
  log(`status: proverena=${s.verified}, šifrovanih fajlova ${files.length}`);
}

async function record(o) {
  const url = need("BACKUP_STATUS_URL");
  const s = JSON.parse(readFileSync(o.status, "utf8"));
  const kind = o.kind ?? s.kind;
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await sql`INSERT INTO backup_runs (kind, ok, started_at, finished_at, source_label, dump_sha256, encrypted_sha256, bytes, migrations, tables, rows, detail, github_run_id)
      VALUES (${kind}, ${s.verified !== false}, ${s.createdAt}, now(), ${o.label ?? null}, ${s.dumpSha256 ?? null},
              ${s.encrypted?.[0]?.sha256 ?? null}, ${s.dumpBytes ?? null}, ${s.summary?.migrations ?? null}, ${s.summary?.tables ?? null},
              ${s.summary?.rows ?? null}, ${typeof o.detail === "string" ? o.detail.slice(0, 300) : null}, ${s.githubRunId})`;
    log(`upisano u portal: ${kind}`);
  } finally {
    await sql.end();
  }
}

/** Fascikla artefakta sme da sadrži SAMO šifrovane fajlove, javni status i otiske. */
async function checkArtifact(o) {
  const dir = resolve(o.dir);
  const problems = [];
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (f.endsWith(".age")) continue;
    if (f.endsWith(".status.json")) {
      problems.push(...publicStatusProblems(JSON.parse(readFileSync(p, "utf8"))).map((x) => `${f}: ${x}`));
      continue;
    }
    if (f.endsWith(".sha256")) {
      if (!readFileSync(p, "utf8").trim().split("\n").every(publicShaLineOk)) problems.push(`${f}: neispravan red otiska`);
      continue;
    }
    problems.push(`nedozvoljen fajl: ${f}`);
  }
  if (problems.length) throw new Error(`Artefakt nije čist: ${problems.join("; ")}`);
  log(`artefakt proveren: ${readdirSync(dir).length} fajlova, samo šifrovano, status i otisci`);
}

/** Neuspeh posla se takođe beleži, da portal ne prikaže staru zelenu kopiju kao jedinu istinu. */
async function recordFailure(o) {
  const url = need("BACKUP_STATUS_URL");
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await sql`INSERT INTO backup_runs (kind, ok, finished_at, source_label, detail, github_run_id)
      VALUES (${o.kind ?? "db_verified"}, false, now(), ${o.label ?? null}, ${typeof o.detail === "string" ? o.detail.slice(0, 300) : "posao kopije nije uspeo"}, ${process.env.GITHUB_RUN_ID ?? null})`;
    log("upisan neuspeh u portal");
  } finally {
    await sql.end();
  }
}

const COMMANDS = { dump, verify, encrypt, "decrypt-check": decryptCheck, status, record, "record-failure": recordFailure, "check-artifact": checkArtifact };

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  installAbortHandlers(log);
  const o = args();
  const fn = COMMANDS[o._];
  if (!fn) {
    log(`Komande: ${Object.keys(COMMANDS).join(", ")}`);
    process.exit(2);
  }
  fn(o).catch((e) => {
    if (isAborting()) return; // čišćenje posle prekida samo završava proces (130/143)
    log(`GREŠKA: ${e?.message ?? e}`);
    process.exit(1);
  });
}
