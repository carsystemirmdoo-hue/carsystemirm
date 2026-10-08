#!/usr/bin/env node
/**
 * Preuzimanje šifrovane kopije baze VAN GitHub-a (firmin računar / oblak).
 *
 *   GH_BACKUP_TOKEN=… BACKUP_REPO=vlasnik/repo node scripts/backup/offsite-pull.mjs --dest <fascikla> [--label kancelarija]
 *   node scripts/backup/offsite-pull.mjs --from-dir <raspakovan artefakt> --dest <fascikla>   (proba, bez mreže)
 *
 * Koraci: poslednji artefakt `carsystem-db-*` → raspakivanje u privremenu
 * fasciklu → provera SHA-256 svakog `.age` fajla prema `status.json` →
 * premeštanje u `<dest>/<datum>/` → politika čuvanja (14 dnevnih, 8 nedeljnih,
 * 12 mesečnih) → upis `offsite_stored` u portal (BACKUP_STATUS_URL, opciono).
 *
 * Privatni ključ NIJE potreban ovde i ne sme biti na ovom računaru: kopija se
 * čuva šifrovana; dešifruje se samo u mesečnoj probi vraćanja.
 * Token: fine-grained, SAMO privatni backup repo, SAMO „Actions: read“.
 */
import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { installAbortHandlers, isAborting, onAbort } from "../../lib/backup/abort.mjs";
import { publicStatusProblems } from "../../lib/backup/publicStatus.mjs";
import { makeLogger } from "../../lib/backup/redact.mjs";
import { planRetention } from "../../lib/backup/retention.mjs";

const log = makeLogger(undefined, () => [process.env.GH_BACKUP_TOKEN, process.env.BACKUP_STATUS_URL].filter(Boolean));

function args() {
  const o = {};
  const a = process.argv.slice(2);
  for (let i = 0; i < a.length; i += 1) {
    const k = a[i].replace(/^--/, "");
    o[k] = a[i + 1] && !a[i + 1].startsWith("--") ? a[++i] : true;
  }
  return o;
}

const sha256File = (p) =>
  new Promise((ok, fail) => {
    const h = createHash("sha256");
    createReadStream(p).on("data", (d) => h.update(d)).on("end", () => ok(h.digest("hex"))).on("error", fail);
  });

function sh(cmd, argv) {
  return new Promise((ok, fail) => {
    const p = spawn(cmd, argv, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("error", fail);
    p.on("close", (c) => (c === 0 ? ok() : fail(new Error(`${cmd}: ${err.slice(-300)}`))));
  });
}

async function downloadLatest(work) {
  const token = process.env.GH_BACKUP_TOKEN;
  const repo = process.env.BACKUP_REPO;
  if (!token || !repo) throw new Error("Potrebni su GH_BACKUP_TOKEN i BACKUP_REPO (ili --from-dir za probu).");
  const h = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
  const list = await (await fetch(`https://api.github.com/repos/${repo}/actions/artifacts?per_page=20`, { headers: h })).json();
  const art = (list.artifacts ?? []).filter((a) => a.name.startsWith("carsystem-db-") && !a.expired).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  if (!art) throw new Error("Nema dostupnog artefakta kopije.");
  const res = await fetch(art.archive_download_url, { headers: h, redirect: "follow" });
  if (!res.ok) throw new Error(`Preuzimanje artefakta nije uspelo (${res.status}).`);
  const zip = join(work, "artefakt.zip");
  writeFileSync(zip, Buffer.from(await res.arrayBuffer()), { mode: 0o600 });
  // tar (bsdtar) raspakuje zip i na macOS-u i na Windows 10+.
  await sh("tar", ["-xf", zip, "-C", work]);
  rmSync(zip);
  return { dir: work, artifact: art.name };
}

export async function pull(o) {
  if (!o.dest) throw new Error("--dest je obavezan.");
  const dest = resolve(o.dest);
  mkdirSync(dest, { recursive: true });
  // Nedovršene fascikle prethodnog prekida se brišu (kopija u njima nije proverena do kraja).
  for (const d of readdirSync(dest).filter((d) => d.endsWith(".delimicno"))) rmSync(join(dest, d), { recursive: true, force: true });
  const work = join(tmpdir(), `kopija-${randomBytes(4).toString("hex")}`);
  mkdirSync(work, { mode: 0o700 });
  const offWork = onAbort(() => rmSync(work, { recursive: true, force: true }));
  try {
    const src = o["from-dir"] ? { dir: resolve(o["from-dir"]), artifact: "lokalno" } : await downloadLatest(work);
    const statusFile = readdirSync(src.dir).find((f) => f.endsWith(".status.json"));
    if (!statusFile) throw new Error("U artefaktu nema status.json.");
    const status = JSON.parse(readFileSync(join(src.dir, statusFile), "utf8"));
    const problems = publicStatusProblems(status);
    if (problems.length) throw new Error(`Status artefakta nije ispravan: ${problems.join("; ")}`);
    if (!status.verified) throw new Error("Artefakt nije označen kao proveren — ne čuva se kao važeća kopija.");
    const day = status.createdAt.slice(0, 10);
    const target = join(dest, `${status.createdAt.replace(/[-:]/g, "").replace(/\..+/, "Z")}`);
    if (existsSync(target)) {
      log(`kopija ${day} je već sačuvana`);
    } else {
      const stage = `${target}.delimicno`;
      mkdirSync(stage, { recursive: true, mode: 0o700 });
      const offStage = onAbort(() => rmSync(stage, { recursive: true, force: true }));
      for (const f of status.encrypted) {
        const from = join(src.dir, f.name);
        if (!existsSync(from)) throw new Error(`U artefaktu nedostaje ${f.name}.`);
        if ((await sha256File(from)) !== f.sha256) throw new Error(`Otisak ${f.name} se ne poklapa — kopija nije sačuvana.`);
        writeFileSync(join(stage, f.name), readFileSync(from), { mode: 0o600 });
      }
      for (const extra of readdirSync(src.dir).filter((f) => f.endsWith(".manifest.json.age") || f === statusFile)) {
        writeFileSync(join(stage, extra), readFileSync(join(src.dir, extra)), { mode: 0o600 });
      }
      renameSync(stage, target);
      offStage();
      log(`sačuvano van GitHub-a: ${status.encrypted.map((f) => f.name).join(", ")}`);
    }

    // Politika čuvanja nad fasciklama kopija.
    const copies = readdirSync(dest)
      .filter((d) => /^\d{8}T\d{6}Z$/.test(d))
      .map((d) => ({ id: d, createdAt: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T${d.slice(9, 11)}:${d.slice(11, 13)}:${d.slice(13, 15)}Z` }));
    const plan = planRetention(copies);
    for (const id of plan.remove) rmSync(join(dest, id), { recursive: true, force: true });
    log(`čuva se ${plan.keep.length} kopija, uklonjeno po politici ${plan.remove.length}`);

    if (process.env.BACKUP_STATUS_URL) {
      const postgres = (await import("postgres")).default;
      const sql = postgres(process.env.BACKUP_STATUS_URL, { max: 1, onnotice: () => {} });
      try {
        await sql`INSERT INTO backup_runs (kind, ok, started_at, finished_at, source_label, dump_sha256, encrypted_sha256, bytes, migrations, tables, rows, detail)
          VALUES ('offsite_stored', true, ${status.createdAt}, now(), ${o.label ?? null}, ${status.dumpSha256 ?? null}, ${status.encrypted[0]?.sha256 ?? null},
                  ${status.encrypted[0]?.bytes ?? null}, ${status.summary?.migrations ?? null}, ${status.summary?.tables ?? null}, ${status.summary?.rows ?? null},
                  ${`kopija od ${day}; čuva se ${plan.keep.length}`})`;
      } finally {
        await sql.end();
      }
      log("upisano u portal: offsite_stored");
    }
    return { target, keep: plan.keep.length, removed: plan.remove.length };
  } finally {
    rmSync(work, { recursive: true, force: true });
    offWork();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  installAbortHandlers(log);
  pull(args()).catch((e) => {
    if (isAborting()) return; // čišćenje posle prekida samo završava proces (130/143)
    log(`GREŠKA: ${e?.message ?? e}`);
    process.exit(1);
  });
}
