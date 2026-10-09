import assert from "node:assert/strict";
import test from "node:test";
import { checkAccess, GitHubAccessError, listBackupArtifacts } from "./offsite-pull.mjs";

/**
 * Pristup GitHub-u sa kancelarijskog računara: odbijen token, nedovoljne
 * dozvole, nedostupan repo i stvarno prazna lista su RAZLIČITE poruke.
 * Ranije je svaki od njih izgledao kao „Nema dostupnog artefakta kopije“.
 */
const TOKEN = "github_pat_PROBNI_TOKEN_KOJI_NE_SME_U_PORUKU_0123456789";
const REPO = "carsystemirmdoo-hue/carsystem-backup";
const odgovor = (status, telo, zaglavlja = {}) => async () =>
  new Response(JSON.stringify(telo), { status, headers: { "content-type": "application/json", ...zaglavlja } });
const art = (name, expired = false, created_at = "2026-10-09T08:40:25Z") => ({ name, expired, created_at, expires_at: "2026-10-16T08:38:55Z", archive_download_url: "https://api.github.com/x" });

async function kod(fetchImpl) {
  try {
    await listBackupArtifacts({ token: TOKEN, repo: REPO, fetchImpl });
    return "ok";
  } catch (e) {
    assert.ok(e instanceof GitHubAccessError, String(e));
    assert.ok(!e.message.includes(TOKEN) && !e.message.includes("PROBNI"), "token u poruci");
    return e.code;
  }
}

test("401 → token_odbijen; 403 → nema_dozvole; 403 uz iscrpljen limit → ogranicenje; 404 → repo_nedostupan", async () => {
  assert.equal(await kod(odgovor(401, { message: "Bad credentials" })), "token_odbijen");
  assert.equal(await kod(odgovor(403, { message: "Resource not accessible by personal access token" })), "nema_dozvole");
  assert.equal(await kod(odgovor(403, { message: "rate limit" }, { "x-ratelimit-remaining": "0" })), "ogranicenje");
  assert.equal(await kod(odgovor(404, { message: "Not Found" })), "repo_nedostupan");
  assert.equal(await kod(odgovor(500, {})), "github_greska");
  assert.equal(await kod(async () => { throw new TypeError("fetch failed"); }), "mreza");
});

test("prazna lista i samo istekli artefakti su različiti slučajevi; tuđi artefakti se ne računaju", async () => {
  assert.equal(await kod(odgovor(200, { total_count: 0, artifacts: [] })), "nema_artefakta");
  assert.equal(await kod(odgovor(200, { artifacts: [art("drugo-ime")] })), "nema_artefakta");
  assert.equal(await kod(odgovor(200, { artifacts: [art("carsystem-db-1", true)] })), "svi_istekli");
  assert.equal(await kod(odgovor(200, { neocekivano: true })), "github_greska");
});

test("uspeh: najnoviji važeći artefakt prvi; token se šalje tačno jednom, očišćen od razmaka", async () => {
  let auth = null;
  const f = async (url, init) => {
    auth = init.headers.Authorization;
    return new Response(JSON.stringify({ artifacts: [art("carsystem-db-1", false, "2026-10-08T01:17:00Z"), art("carsystem-db-2", false, "2026-10-09T01:17:00Z"), art("carsystem-db-0", true, "2026-10-10T01:17:00Z")] }), { status: 200 });
  };
  const r = await listBackupArtifacts({ token: `  ${TOKEN}\r\n`, repo: REPO, fetchImpl: f });
  assert.deepEqual(r.artifacts.map((a) => a.name), ["carsystem-db-2", "carsystem-db-1"]);
  assert.equal(auth, `Bearer ${TOKEN}`);
  process.env.GH_BACKUP_TOKEN = TOKEN;
  process.env.BACKUP_REPO = REPO;
  try {
    assert.equal((await checkAccess(f)).newest, "carsystem-db-2");
  } finally {
    delete process.env.GH_BACKUP_TOKEN;
    delete process.env.BACKUP_REPO;
  }
});

test("neispravno ime repoa se odbija pre mreže", async () => {
  let pozvano = false;
  await assert.rejects(listBackupArtifacts({ token: TOKEN, repo: "nije repo", fetchImpl: async () => ((pozvano = true), new Response("{}")) }), (e) => e.code === "repo_neispravan");
  assert.equal(pozvano, false);
});
