import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import postgres from "postgres";

/**
 * Prekid usred posla: posle SIGTERM ne sme ostati nijedan otvoren ili
 * nepotpun fajl ni probna baza, a sledeće pokretanje mora da uspe.
 *
 * Traži LOKALNE baze (nikad pilot): BACKUP_TEST_SOURCE_URL (izvor) i
 * BACKUP_TEST_ADMIN_URL (Postgres za probno vraćanje), oba na 127.0.0.1.
 */
const SRC = process.env.BACKUP_TEST_SOURCE_URL;
const ADMIN = process.env.BACKUP_TEST_ADMIN_URL;
const local = (u) => Boolean(u && /@(127\.0\.0\.1|localhost):/.test(u));
const skip = !local(SRC) || !local(ADMIN) ? "nema lokalnih BACKUP_TEST_SOURCE_URL/BACKUP_TEST_ADMIN_URL" : spawnSync("age", ["--version"]).status !== 0 ? "age nije instaliran" : false;
const TOOL = new URL("./db-backup.mjs", import.meta.url).pathname;
const PDF = new URL("./pdf-backup.mjs", import.meta.url).pathname;
const env = { ...process.env, SOURCE_DATABASE_URL: SRC, RESTORE_ADMIN_URL: ADMIN };

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 60000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await fn()) return true; await wait(25); }
  return false;
}
function start(args) {
  const p = spawn(process.execPath, args, { env, stdio: ["ignore", "pipe", "pipe"] });
  const done = new Promise((r) => p.on("close", (code, sig) => r({ code, sig })));
  return { p, done };
}
const files = (dir) => {
  try {
    return existsSync(dir) ? readdirSync(dir, { recursive: true }).map(String) : [];
  } catch {
    return []; // fascikla se menja dok se čita (preimenovanje u toku)
  }
};

test("prekid tokom pg_dump: nema .part ni nepotpune kopije; sledeća kopija uspeva", { skip, timeout: 180000 }, async () => {
  const out = mkdtempSync(join(tmpdir(), "prekid-dump-"));
  try {
    const { p, done } = start([TOOL, "dump", "--out", out, "--label", "prekid"]);
    assert.ok(await until(() => files(out).some((f) => f.endsWith(".dump.part") && statSync(join(out, f)).size > 0)), "pg_dump nije počeo");
    p.kill("SIGTERM");
    const r = await done;
    assert.equal(r.code, 143);
    assert.deepEqual(files(out).filter((f) => /\.dump(\.part)?$/.test(f)), [], "ostala nepotpuna kopija");
    // Ostatak prekida koji je preživeo (simulacija) briše se pri sledećem pokretanju.
    writeFileSync(join(out, "carsystem-prekid-20200101T000000Z.dump.part"), "x");
    const again = start([TOOL, "dump", "--out", out, "--label", "prekid"]);
    assert.equal((await again.done).code, 0);
    assert.equal(files(out).filter((f) => f.endsWith(".dump.part")).length, 0);
    assert.equal(files(out).filter((f) => f.endsWith(".dump")).length, 1);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test("prekid tokom vraćanja: probna baza se briše; prekid dešifrovanja ne ostavlja otvoren fajl", { skip, timeout: 240000 }, async () => {
  const out = mkdtempSync(join(tmpdir(), "prekid-verify-"));
  const admin = postgres(ADMIN, { max: 1, onnotice: () => {} });
  try {
    assert.equal((await start([TOOL, "dump", "--out", out, "--label", "prekid"]).done).code, 0);
    const base = join(out, files(out).find((f) => f.endsWith(".dump")).replace(/\.dump$/, ""));
    const before = new Set((await admin`SELECT datname FROM pg_database WHERE datname LIKE 'restore_check_%'`).map((r) => r.datname));
    const { p, done } = start([TOOL, "verify", "--dump", `${base}.dump`, "--manifest", `${base}.manifest.json`]);
    let created = null;
    assert.ok(await until(async () => {
      const rows = await admin`SELECT datname FROM pg_database WHERE datname LIKE 'restore_check_%'`;
      created = rows.map((r) => r.datname).find((d) => !before.has(d)) ?? null;
      return created !== null;
    }), "vraćanje nije počelo");
    await wait(300);
    p.kill("SIGTERM");
    assert.equal((await done).code, 143);
    const left = await admin`SELECT count(*)::int AS n FROM pg_database WHERE datname = ${created}`;
    assert.equal(left[0].n, 0, "probna baza je ostala posle prekida");

    // Dešifrovanje: privremeni otvoren fajl ne sme ostati.
    const key = join(out, "k.key");
    spawnSync("age-keygen", ["-o", key]);
    writeFileSync(join(out, "k.pub"), spawnSync("age-keygen", ["-y", key]).stdout);
    assert.equal(spawnSync(process.execPath, [TOOL, "encrypt", "--in", `${base}.dump`, "--recipients", join(out, "k.pub")], { env }).status, 0);
    const sha = spawnSync("shasum", ["-a", "256", `${base}.dump`]).stdout.toString().split(" ")[0];
    const d = start([TOOL, "decrypt-check", "--in", `${base}.dump.age`, "--identity", key, "--expect-sha", sha]);
    assert.ok(await until(() => files(out).some((f) => f.startsWith(".provera-"))), "dešifrovanje nije počelo");
    d.p.kill("SIGTERM");
    assert.equal((await d.done).code, 143);
    assert.deepEqual(files(out).filter((f) => f.startsWith(".provera-")), [], "otvoren dešifrovan fajl je ostao");
  } finally {
    await admin.end();
    rmSync(out, { recursive: true, force: true });
  }
});

test("prekid PDF kopije: nema otvorenog indeksa ni nepotpunih objekata; ponovljen prolaz je potpun", { skip, timeout: 180000 }, async () => {
  const root = mkdtempSync(join(tmpdir(), "prekid-pdf-"));
  const src = join(root, "izvor"), dest = join(root, "skladiste"), state = join(root, "stanje.json");
  try {
    mkdirSync(src);
    for (let i = 0; i < 400; i += 1) writeFileSync(join(src, `f${i}.pdf`), `%PDF-${i}-${"x".repeat(2000)}`);
    spawnSync("age-keygen", ["-o", join(root, "k.key")]);
    writeFileSync(join(root, "k.pub"), spawnSync("age-keygen", ["-y", join(root, "k.key")]).stdout);
    const args = [PDF, "run", "--source", src, "--dest", dest, "--state", state, "--recipients", join(root, "k.pub")];
    const { p, done } = start(args);
    assert.ok(await until(() => files(join(dest, "objects")).filter((f) => f.endsWith(".pdf.age")).length >= 20), "kopija nije počela");
    p.kill("SIGTERM");
    assert.equal((await done).code, 143);
    assert.deepEqual(files(root).filter((f) => /\.indeks-|\.tmp$/.test(f)), [], "ostao otvoren indeks ili nepotpun objekat");
    assert.ok(!existsSync(state), "stanje se upisuje tek na kraju prolaza");
    const again = start(args);
    assert.equal((await again.done).code, 0);
    assert.equal(files(join(dest, "objects")).filter((f) => f.endsWith(".pdf.age")).length, 400);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
