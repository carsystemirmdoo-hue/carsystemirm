import assert from "node:assert/strict";
import { generateKeyPairSync, verify as cryptoVerify } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

/**
 * prijavi-kopiju (0.3.12): potvrda rezervne kopije potpisom uređaja umesto
 * lozinke baze. Iz izgrađenog paketa (dist), isti kod koji ide na računar.
 */
const SHA = "c".repeat(64);
const IZVESTAJ = { vrsta: "offsite_stored", githubRunId: "37900905867", sifrovanSha256: SHA, bajtova: 13961448, kopijaOd: "2026-10-09T07:46:54.083Z", cuvaSe: 1 };

async function okruzenje() {
  const folder = await mkdtemp(join(tmpdir(), "cs-kopija-"));
  const p = { folder, baza: join(folder, "queue.db"), kljuc: join(folder, "device-key.bin"), log: join(folder, "log"), konfiguracija: join(folder, "config.json") };
  await writeFile(p.konfiguracija, JSON.stringify({
    serverOrigin: "https://carsystemirm.invalid", deviceCode: "KANC-01", keyId: "k1", sourceSystem: "biznisoft", issuerCode: "CSRM", izvorniFolder: folder,
  }));
  const par = generateKeyPairSync("ed25519");
  const { sacuvaj } = await import(new URL("../dist/connector/src/keystore/test-insecure.mjs", import.meta.url).href);
  await sacuvaj({ putanja: p.kljuc, privateKeyPkcs8Der: new Uint8Array(par.privateKey.export({ format: "der", type: "pkcs8" })) });
  return { p, folder, javni: par.publicKey };
}

async function uhvatiIspis(fn) {
  const pisanje = process.stdout.write;
  const ispis = [];
  process.stdout.write = (x) => (ispis.push(String(x)), true);
  try {
    return { kod: await fn(), ispis: ispis.join("") };
  } finally {
    process.stdout.write = pisanje;
  }
}

test("prijavi-kopiju: potpisan zahtev na /api/sync/backup sa tačno proverenim izveštajem; red se ne otvara", async () => {
  const { prijaviKopiju } = await import(new URL("../dist/connector/src/cli.mjs", import.meta.url).href);
  const { signingString, HEADERS, PROTOCOL_VERSION, bodyHash } = await import(new URL("../dist/lib/sync/device/signing.mjs", import.meta.url).href);
  const { p, folder, javni } = await okruzenje();
  const fajl = join(folder, "izvestaj.json");
  await writeFile(fajl, JSON.stringify(IZVESTAJ));
  const prethodno = process.env.CS_CONNECTOR_INSECURE_KEYSTORE;
  process.env.CS_CONNECTOR_INSECURE_KEYSTORE = "1";
  try {
    const zahtevi = [];
    const server = async (url, init) => {
      const h = new Headers(init.headers);
      const telo = new Uint8Array(await new Response(init.body).arrayBuffer());
      const niz = signingString({
        version: PROTOCOL_VERSION, deviceId: h.get(HEADERS.device), keyId: h.get(HEADERS.key), method: "POST",
        path: new URL(url).pathname, timestamp: h.get(HEADERS.timestamp), nonce: h.get(HEADERS.nonce), bodyHash: bodyHash(telo),
      });
      const potpisOk = cryptoVerify(null, Buffer.from(niz, "utf8"), javni, Buffer.from(h.get(HEADERS.signature), "base64"));
      zahtevi.push({ url: String(url), potpisOk, telo: JSON.parse(new TextDecoder().decode(telo)) });
      return new Response(JSON.stringify({ ok: true, code: "backup_recorded", requestId: "r" }), { status: 200, headers: { "content-type": "application/json" } });
    };
    const r = await uhvatiIspis(() => prijaviKopiju(p, ["--izvestaj", fajl], { fetchImpl: server }));
    assert.equal(r.kod, 0);
    assert.equal(zahtevi.length, 1);
    assert.equal(zahtevi[0].url, "https://carsystemirm.invalid/api/sync/backup");
    assert.equal(zahtevi[0].potpisOk, true);
    assert.deepEqual(zahtevi[0].telo, IZVESTAJ);
    assert.match(r.ispis, /"status": "potvrdjeno"/);
    assert.doesNotMatch(r.ispis, /izvestaj\.json|cs-kopija-/, "ispis bez putanja");

    // Server odbija (GitHub nije proverio taj otisak): izlaz 1.
    const odbij = async () => new Response(JSON.stringify({ ok: false, code: "backup_unknown", requestId: "r" }), { status: 409, headers: { "content-type": "application/json" } });
    assert.equal((await uhvatiIspis(() => prijaviKopiju(p, ["--izvestaj", fajl], { fetchImpl: odbij }))).kod, 1);

    // Izveštaj sa putanjom se ne šalje uopšte.
    await writeFile(fajl, JSON.stringify({ ...IZVESTAJ, putanja: "C:/Kopije" }));
    let poslato = 0;
    const brojac = async () => (poslato += 1, new Response("{}", { status: 200 }));
    const los = await uhvatiIspis(() => prijaviKopiju(p, ["--izvestaj", fajl], { fetchImpl: brojac }));
    assert.equal(los.kod, 2);
    assert.equal(poslato, 0);
    assert.match(los.ispis, /report_fields/);
    // Bez --izvestaj: greška, bez mreže.
    assert.equal((await uhvatiIspis(() => prijaviKopiju(p, [], { fetchImpl: brojac }))).kod, 2);
    assert.equal(poslato, 0);
    // Red faktura nije ni otvoren.
    const { existsSync } = await import("node:fs");
    assert.equal(existsSync(p.baza), false);
  } finally {
    if (prethodno === undefined) delete process.env.CS_CONNECTOR_INSECURE_KEYSTORE;
    else process.env.CS_CONNECTOR_INSECURE_KEYSTORE = prethodno;
    await rm(folder, { recursive: true, force: true });
  }
});
