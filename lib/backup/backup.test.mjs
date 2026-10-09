import assert from "node:assert/strict";
import test from "node:test";
import { compareManifests, publicSummary, tableChecksumSql } from "./manifest.mjs";
import { applyScan, emptyIndex, objectPath, planScan } from "./pdfIndex.mjs";
import { makeLogger, redact } from "./redact.mjs";
import { planRetention } from "./retention.mjs";
import { classifyBackup } from "./status.mjs";

const manifest = (over = {}) => ({
  version: 1,
  createdAt: "2026-10-07T20:00:00.000Z",
  serverVersion: "17.6",
  migrations: { count: 36, lastHash: "abc" },
  tables: [
    { schema: "public", name: "invoices", rows: 10, md5: "m1" },
    { schema: "drizzle", name: "__drizzle_migrations", rows: 36, md5: "m2" },
  ],
  sequences: [{ schema: "public", name: "audit_log_id_seq", lastValue: "5" }],
  grants: [{ grantee: "carsystem_app", schema: "public", name: "invoices", privileges: "DELETE,INSERT,SELECT,UPDATE" }],
  sales: [{ year: 2026, invoices: 3, lines: 9, net: "100.00" }],
  totals: { tables: 2, rows: 46, invoices: 3, lines: 9, net: 100 },
  ...over,
});

test("isti manifest: nema razlika; vrednost sekvence se ne poredi (nije transakciona)", () => {
  const b = manifest({ sequences: [{ schema: "public", name: "audit_log_id_seq", lastValue: "9" }], createdAt: "drugo" });
  assert.deepEqual(compareManifests(manifest(), b), []);
});

test("razlika u redovima, sadržaju, migracijama, dozvolama i zbirovima se prijavljuje", () => {
  const b = manifest({
    tables: [{ schema: "public", name: "invoices", rows: 9, md5: "m1" }, { schema: "drizzle", name: "__drizzle_migrations", rows: 36, md5: "x" }],
    migrations: { count: 35, lastHash: "abc" },
    grants: [],
    sales: [{ year: 2026, invoices: 3, lines: 9, net: "99.00" }],
    sequences: [],
  });
  const d = compareManifests(manifest(), b);
  assert.ok(d.some((x) => x.includes("public.invoices: redova 10 → 9")));
  assert.ok(d.some((x) => x.includes("drizzle.__drizzle_migrations: sadržaj")));
  assert.ok(d.some((x) => x.startsWith("migracije")));
  assert.ok(d.some((x) => x.includes("dozvole")));
  assert.ok(d.some((x) => x.includes("zbirovi prodaje")));
  assert.ok(d.some((x) => x.includes("sekvenca public.audit_log_id_seq nedostaje")));
});

test("javni sažetak ne nosi poslovne iznose", () => {
  const s = JSON.stringify(publicSummary(manifest()));
  assert.ok(!s.includes("100.00") && !s.includes("net") && !s.includes("sales"));
  assert.match(s, /"tables":2/);
});

test("ime tabele u upitu za kontrolni zbir je citirano", () => {
  assert.match(tableChecksumSql("public", 'a"b'), /"public"\."a""b"/);
});

test("politika čuvanja: 14 dnevnih, 8 nedeljnih, 12 mesečnih; najnovija uvek ostaje", () => {
  const backups = [];
  for (let i = 0; i < 400; i += 1) {
    const d = new Date(Date.UTC(2026, 9, 7) - i * 86400000);
    backups.push({ id: `k${i}`, createdAt: d.toISOString() });
  }
  const r = planRetention(backups);
  assert.ok(r.keep.includes("k0"));
  for (let i = 0; i < 14; i += 1) assert.ok(r.keep.includes(`k${i}`), `dnevna k${i}`);
  assert.ok(r.keep.length <= 14 + 8 + 12);
  assert.ok(r.keep.length >= 25);
  assert.equal(r.keep.length + r.remove.length, 400);
  assert.ok(r.remove.includes("k399"));
  // Dve kopije istog dana: zadržava se novija.
  const same = planRetention([{ id: "a", createdAt: "2026-10-07T01:00:00Z" }, { id: "b", createdAt: "2026-10-07T18:00:00Z" }]);
  assert.deepEqual(same.keep, ["b"]);
  assert.deepEqual(same.remove, ["a"]);
});

test("PDF: nov, promenjen i obrisan fajl; brisanje originala ne briše objekat", () => {
  const sha = (c) => c.repeat(64);
  let idx = emptyIndex();
  let p = planScan(idx, [{ path: "2026/a.pdf", size: 10, mtimeMs: 1 }, { path: "2026/b.pdf", size: 20, mtimeMs: 1 }]);
  assert.equal(p.toHash.length, 2);
  let r = applyScan(idx, p.toHash.map((f, i) => ({ ...f, sha256: sha(i ? "b" : "a") })), p.missing, "2026-10-07T10:00:00Z");
  assert.deepEqual(r.newObjects, [sha("a"), sha("b")]);
  idx = r.index;
  for (const s of r.newObjects) idx.objects[s] = { storedAt: "x" };

  // Drugi dan: a nepromenjen (ne hešira se), b promenjen, c nov.
  p = planScan(idx, [{ path: "2026/a.pdf", size: 10, mtimeMs: 1 }, { path: "2026/b.pdf", size: 21, mtimeMs: 2 }, { path: "2026/c.pdf", size: 5, mtimeMs: 2 }]);
  assert.deepEqual(p.toHash.map((f) => f.path), ["2026/b.pdf", "2026/c.pdf"]);
  r = applyScan(idx, [{ ...p.toHash[0], sha256: sha("d") }, { ...p.toHash[1], sha256: sha("e") }], p.missing, "2026-10-08T10:00:00Z");
  assert.deepEqual(r.changed, ["2026/b.pdf"]);
  assert.deepEqual(r.added, ["2026/c.pdf"]);
  assert.deepEqual(r.index.files["2026/b.pdf"].versions, [sha("b"), sha("d")]);
  idx = r.index;
  for (const s of r.newObjects) idx.objects[s] = { storedAt: "y" };

  // Treći dan: a obrisan u izvoru.
  p = planScan(idx, [{ path: "2026/b.pdf", size: 21, mtimeMs: 2 }, { path: "2026/c.pdf", size: 5, mtimeMs: 2 }]);
  assert.deepEqual(p.missing, ["2026/a.pdf"]);
  r = applyScan(idx, [], p.missing, "2026-10-09T10:00:00Z");
  assert.equal(r.index.files["2026/a.pdf"].missingSince, "2026-10-09T10:00:00Z");
  assert.ok(r.index.objects[sha("a")], "objekat obrisanog originala ostaje");
  assert.ok(r.index.objects[sha("b")], "prethodna verzija promenjenog fajla ostaje");
  // Isti sadržaj na dva mesta = jedan objekat.
  const dup = applyScan(emptyIndex(), [{ path: "x.pdf", size: 1, mtimeMs: 1, sha256: sha("f") }, { path: "y.pdf", size: 1, mtimeMs: 1, sha256: sha("f") }], [], "t");
  assert.deepEqual(dup.newObjects, [sha("f")]);
  assert.equal(objectPath(sha("a")), `objects/aa/${sha("a")}.pdf.age`);
  assert.throws(() => objectPath("../x"));
});

test("stanje kopija: tri odvojene tvrdnje i pragovi", () => {
  const now = new Date("2026-10-08T12:00:00Z");
  const at = (h) => new Date(now.getTime() - h * 3600000).toISOString();
  assert.equal(classifyBackup("db_verified", null, null, now).state, "nikad");
  assert.equal(classifyBackup("db_verified", { finishedAt: at(10), ok: true }, { finishedAt: at(10), ok: true }, now).tone, "success");
  assert.equal(classifyBackup("db_verified", { finishedAt: at(31), ok: true }, null, now).state, "kasni");
  assert.equal(classifyBackup("db_verified", { finishedAt: at(60), ok: true }, null, now).tone, "danger");
  assert.equal(classifyBackup("offsite_stored", { finishedAt: at(33), ok: true }, null, now).tone, "success");
  const f = classifyBackup("db_verified", { finishedAt: at(10), ok: true }, { finishedAt: at(2), ok: false, detail: "manifest se razlikuje" }, now);
  assert.equal(f.state, "poslednji_neuspeo");
  assert.match(f.message, /manifest se razlikuje/);
});

test("logovi ne nose tajne", () => {
  const url = "postgres://vlasnik:SuperTajna123@ep-x.eu-central-1.aws.neon.tech/neondb?sslmode=require";
  const out = [];
  const log = makeLogger((l) => out.push(l), () => ["DodatnaTajna99"]);
  log("greška:", url, "AGE-SECRET-KEY-1QQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQ", "ghp_abcdefghijklmnop1234", "x DodatnaTajna99 y", "password=abc123");
  const s = out.join("\n");
  for (const secret of ["SuperTajna123", "AGE-SECRET-KEY-1Q", "ghp_abcdefghijklmnop1234", "DodatnaTajna99", "abc123"]) assert.ok(!s.includes(secret), secret);
  assert.match(redact(url), /postgres:\/\/\*\*\*@ep-x/);
});

test("dok automatika nije uključena: „nije podešen“, nikad zeleno, zapisi se zanemaruju", async () => {
  const { classifyBackup: c, enabledBackupKinds } = await import("./status.mjs");
  assert.deepEqual(enabledBackupKinds({}), []);
  assert.deepEqual(enabledBackupKinds({ BACKUP_AUTOMATION: "db_verified, nepoznato ,pdf_backup" }), ["db_verified", "pdf_backup"]);
  const now = new Date("2026-10-08T12:00:00Z");
  const r = c("db_verified", { finishedAt: "2026-10-08T11:00:00Z", ok: true }, null, now, { enabled: false });
  assert.equal(r.state, "nije_podesen");
  assert.notEqual(r.tone, "success");
  assert.match(r.message, /Nije podešeno/);
});

test("aktivne vrste: BACKUP_AUTOMATION ako je zadat, inače samo zapisi dokazivog porekla", async () => {
  const { activeBackupKinds } = await import("./status.mjs");
  const ev = { db_verified: true, offsite_stored: false, pdf_backup: true };
  assert.deepEqual(activeBackupKinds({}, ev), ["db_verified", "pdf_backup"]);
  assert.deepEqual(activeBackupKinds({ BACKUP_AUTOMATION: "  " }, ev), ["db_verified", "pdf_backup"]);
  assert.deepEqual(activeBackupKinds({}, {}), []);
  // Zadat spisak važi tačno — i za isključenje.
  assert.deepEqual(activeBackupKinds({ BACKUP_AUTOMATION: "offsite_stored" }, ev), ["offsite_stored"]);
});

test("izveštaj uređaja o kopiji: bela lista polja, bez putanja i imena", async () => {
  const { checkDeviceBackupReport, parseDeviceBackupReport } = await import("./deviceReport.mjs");
  const sha = "b".repeat(64);
  const off = { vrsta: "offsite_stored", githubRunId: "37900905867", sifrovanSha256: sha, bajtova: 13961448, kopijaOd: "2026-10-09T07:46:54.083Z", cuvaSe: 1 };
  const pdf = { vrsta: "pdf_backup", pocetak: "2026-10-09T08:00:00Z", novih: 3, promenjenih: 0, nestalih: 0, ukupnoObjekata: 94 };
  assert.equal(checkDeviceBackupReport(off).ok, true);
  assert.equal(checkDeviceBackupReport(pdf).ok, true);
  const bad = (v) => checkDeviceBackupReport(v).ok;
  assert.equal(bad({ ...off, putanja: "C:/Kopije" }), false, "dodatno polje");
  assert.equal(bad({ ...off, vrsta: "db_verified" }), false, "uređaj ne potvrđuje proveru baze");
  assert.equal(bad({ ...off, sifrovanSha256: "x" }), false);
  assert.equal(bad({ ...off, githubRunId: 1 }), false);
  assert.equal(bad({ ...pdf, novih: -1 }), false);
  assert.equal(bad({ ...pdf, novih: 1.5 }), false);
  const { cuvaSe, ...nepotpun } = off;
  assert.equal(bad(nepotpun), false, `nedostaje cuvaSe (${cuvaSe})`);
  assert.deepEqual(parseDeviceBackupReport(new TextEncoder().encode("{nije json")), { ok: false, code: "report_not_json" });
  assert.equal(parseDeviceBackupReport(new TextEncoder().encode(JSON.stringify(pdf))).ok, true);
});

test("nešifrovan status: bela lista, bez adresa, e-pošte, putanja i PDF naziva", async () => {
  const { publicStatusProblems, publicShaLineOk } = await import("./publicStatus.mjs");
  const sha = "a".repeat(64);
  const good = {
    kind: "db_verified", createdAt: "2026-10-08T01:17:00.000Z",
    summary: { version: 1, createdAt: "2026-10-08T01:17:00.000Z", serverVersion: "17.11 (fcae950)", migrations: 37, tables: 55, rows: 233770, sequences: 19 },
    dumpSha256: sha, dumpBytes: 10, verified: true, verifyDurationMs: 2000,
    encrypted: [{ name: "carsystem-pilot-20261008T011700Z.dump.age", bytes: 11, sha256: sha }], githubRunId: "123",
  };
  assert.deepEqual(publicStatusProblems(good), []);
  const bad = (patch) => publicStatusProblems({ ...good, ...patch });
  assert.ok(bad({ kupac: "Firma DOO" }).some((p) => p.includes("nedozvoljeno polje")));
  assert.ok(bad({ encrypted: [{ name: "26-RN021001455.pdf.age", bytes: 1, sha256: sha }] }).length > 0);
  assert.ok(bad({ encrypted: [{ name: "carsystem-pilot-20261008T011700Z.dump", bytes: 1, sha256: sha }] }).length > 0, "otvorena kopija");
  assert.ok(bad({ summary: { ...good.summary, serverVersion: "postgres://u:p@host/db" } }).length > 0);
  assert.ok(bad({ summary: { ...good.summary, net: 1000 } }).length > 0, "iznosi ne smeju u status");
  assert.ok(publicShaLineOk(`${sha}  carsystem-pilot-20261008T011700Z.dump.age`));
  assert.ok(!publicShaLineOk(`${sha}  /home/runner/k/kupac.pdf`));
});

test("uloge iz šeme kopije: dozvole i podrazumevane dozvole (Neon), bez pseudo-uloga", async () => {
  const { rolesFromDdl } = await import("../../scripts/backup/db-backup.mjs");
  const ddl = [
    "ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO neon_superuser WITH GRANT OPTION;",
    "GRANT SELECT,INSERT ON TABLE public.audit_log TO carsystem_app;",
    "REVOKE ALL ON SCHEMA public FROM PUBLIC;",
    'GRANT pg_read_all_data TO "carsystem_backup_reader";',
  ].join("\n");
  assert.deepEqual(rolesFromDdl(ddl).sort(), ["carsystem_app", "carsystem_backup_reader", "cloud_admin", "neon_superuser"]);
});
