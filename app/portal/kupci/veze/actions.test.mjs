import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

/**
 * Primena veza kupaca: ko je akter i šta se sme pročitati iz forme.
 *
 * Provera je nad izvorom (kao za sinhronizaciju): sesija traži bazu i
 * kolačiće, a ovde se dokazuje struktura — koje kapije stoje pred upisom i da
 * se akter nikad ne uzima iz forme ni iz tabele. Sam servis i ponovno
 * pokretanje dokazuje `db/integration/customerLink.integration.test.mts`.
 */
const ROOT = new URL("../../../../", import.meta.url).pathname;
const izvor = await readFile(`${ROOT}app/portal/kupci/veze/actions.ts`, "utf8");
const kod = izvor.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
const cli = (await readFile(`${ROOT}scripts/ops/customer-link.mts`, "utf8")).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

test("svaki poziv traži mappings:manage; primena i svež drugi faktor istog korisnika", () => {
  assert.match(kod, /requireCapability\("mappings:manage"/);
  const primena = kod.slice(kod.indexOf('if (mode === "primena") {'));
  assert.match(primena, /requireRecentMfa\(\)/);
  assert.match(primena, /fresh\.id !== actor\.id/);
  assert.match(primena, /isPartnerRegistryUploadEnabled\(\)/);
  assert.match(primena, /formData\.get\("potvrda"\) !== "da"/);
});

test("akter je samo korisnik sesije — forma ne nosi nalog ni ime aktera", () => {
  const polja = [...kod.matchAll(/formData\.get\("([^"]+)"\)/g)].map((m) => m[1]).sort();
  assert.deepEqual(polja, ["issuerCode", "mode", "potvrda", "pregled", "sifarnik"]);
  assert.match(kod, /applyConfirmedLinks\([\s\S]*\{ id: actor\.id, name: actor\.name, role: actor\.role \}/);
});

test("bez izričite primene radi se samo provera (dryRun)", () => {
  assert.match(kod, /dryRun: mode !== "primena"/);
  assert.match(kod, /formData\.get\("mode"\) === "primena" \? "primena" : "provera"/);
});

test("komandna linija više ne primenjuje veze i ne prima ime naloga", () => {
  assert.doesNotMatch(cli, /applyConfirmedLinks/);
  assert.doesNotMatch(cli, /--nalog|"nalog"/);
  assert.match(cli, /Primena se ne radi iz komandne linije/);
});
