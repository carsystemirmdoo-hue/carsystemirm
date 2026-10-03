import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after, before } from "node:test";

const D = (p) => new URL(`../dist/connector/src/${p}`, import.meta.url).href;
const naMacu = process.platform === "darwin";
let dir;
let kc;

/*
 * Samo nad PRIVREMENIM keychain-om (CS_CONNECTOR_KEYCHAIN) — korisnikov
 * keychain se u testu nikad ne dira.
 */
before(async () => {
  if (!naMacu) return;
  dir = await mkdtemp(join(tmpdir(), "cs-kc-"));
  kc = join(dir, "test.keychain-db");
  execFileSync("security", ["create-keychain", "-p", "cs-test", kc]);
  execFileSync("security", ["unlock-keychain", "-p", "cs-test", kc]);
  process.env.CS_CONNECTOR_KEYCHAIN = kc;
});

after(async () => {
  if (!naMacu) return;
  try { execFileSync("security", ["delete-keychain", kc]); } catch { /* već obrisan */ }
  delete process.env.CS_CONNECTOR_KEYCHAIN;
  await rm(dir, { recursive: true, force: true });
});

test("macOS Keychain se bira samo izričito", { skip: !naMacu && "samo na macOS-u" }, async () => {
  const { izaberiAdapter } = await import(D("keystore/index.mjs"));
  assert.equal(izaberiAdapter({ CS_CONNECTOR_MACOS_KEYCHAIN: "1" }).ime, "macos-keychain");
  assert.throws(() => izaberiAdapter({}), (e) => e.code === "no_secure_keystore");
  // Izričit test režim i dalje ima prednost u razvoju, a paket ga odbija.
  assert.equal(izaberiAdapter({ CS_CONNECTOR_INSECURE_KEYSTORE: "1", CS_CONNECTOR_MACOS_KEYCHAIN: "1" }).ime, "test-insecure");
});

test("ključ ide u keychain; u fajlu stanja je samo oznaka", { skip: !naMacu && "samo na macOS-u" }, async () => {
  const adapter = await import(D("keystore/macos-keychain.mjs"));
  const { privateKey } = generateKeyPairSync("ed25519");
  const der = new Uint8Array(privateKey.export({ type: "pkcs8", format: "der" }));
  const putanja = join(dir, "stanje", "kljuc.bin");
  await adapter.sacuvaj({ putanja, privateKeyPkcs8Der: der });

  const sadrzaj = await readFile(putanja, "utf8");
  assert.match(sadrzaj, /^macos-keychain-v1\n[0-9a-f]{32}\n$/);
  assert.equal(sadrzaj.includes(Buffer.from(der).toString("base64")), false, "ključ je u fajlu");
  assert.equal((await stat(putanja)).mode & 0o777, 0o600);
  assert.deepEqual(Buffer.from(await adapter.ucitaj({ putanja })), Buffer.from(der));
  assert.equal((await adapter.proveri()).ok, true);
});

test("pogrešan fajl stanja se ne tumači kao ključ", { skip: !naMacu && "samo na macOS-u" }, async () => {
  const adapter = await import(D("keystore/macos-keychain.mjs"));
  const putanja = join(dir, "los.bin");
  await writeFile(putanja, "test-insecure-v1\nAAAA\n");
  await assert.rejects(adapter.ucitaj({ putanja }), /keychain obliku/);
});
