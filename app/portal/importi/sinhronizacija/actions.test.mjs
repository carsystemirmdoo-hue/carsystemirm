import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

/**
 * Šta server akcije sinhronizacije SMEJU da prime.
 *
 * Provera je nad izvorom, namerno: puna provera kroz sesiju traži bazu i
 * kolačiće, a ono što ovde treba dokazati je strukturno — koja kapija stoji na
 * kojoj akciji i šta akcija čita iz forme. Matrica sposobnosti se dokazuje u
 * `lib/authz/permissions.test.mjs`, a stvarni HTTP put u
 * `db/integration/syncOperations.integration.test.mts`.
 */

const ROOT = new URL("../../../../", import.meta.url).pathname;
const izvor = await readFile(`${ROOT}app/portal/importi/sinhronizacija/actions.ts`, "utf8");
/** Bez komentara: reč „devices:manage“ u objašnjenju nije kapija. */
const kod = izvor.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

function telo(ime) {
  const start = kod.indexOf(`export async function ${ime}`);
  assert.ok(start !== -1, `nema akcije ${ime}`);
  const sledeca = kod.indexOf("export async function", start + 10);
  return kod.slice(start, sledeca === -1 ? undefined : sledeca);
}

const OCEKIVANO = {
  triggerSyncAction: "sync:trigger",
  registerDeviceAction: "devices:manage",
  activateDeviceAction: "devices:manage",
  revokeDeviceAction: "devices:manage",
};

test("svaka akcija traži TAČNO svoju sposobnost", () => {
  for (const [ime, sposobnost] of Object.entries(OCEKIVANO)) {
    const t = telo(ime);
    assert.match(
      t,
      new RegExp(`requireCapability\\(\\s*"${sposobnost.replace(":", ":")}"`),
      `${ime} ne traži ${sposobnost}`,
    );
    /*
     * Sakriveno dugme NIJE autorizacija: akcija se može pozvati i bez ekrana,
     * pa kapija mora biti u njoj — i mora biti prva stvar koju uradi.
     */
    // Od prve vitičaste zagrade: ime same funkcije nije posao koji radi.
    const posao = t.slice(t.indexOf("{"), t.indexOf("requireCapability"));
    for (const poziv of [
      "getDb(", "zakaziKomandu(", "registerDevice(", "activateDevice(",
      "revokeDevice(", "revalidatePath(",
    ]) {
      assert.ok(!posao.includes(poziv), `${ime} zove ${poziv} pre kapije`);
    }
  }
});

test("registracija i pokretanje uređaja nisu ista kapija", () => {
  /*
   * Kancelarija sme da pokrene sinhronizaciju, ali ne i da uvede nov uređaj.
   * Da su iste, jedan ekran bi tiho proširio ko sme da veže ključ.
   */
  assert.notEqual(OCEKIVANO.triggerSyncAction, OCEKIVANO.registerDeviceAction);
  assert.match(telo("triggerSyncAction"), /isSyncOperationsEnabled\(\)/);
});

test("nijedna akcija ne čita opseg, putanju ni otisak iz forme", () => {
  for (const ime of Object.keys(OCEKIVANO)) {
    const t = telo(ime);
    for (const polje of ["tenant", "izvorniFolder", "serverOrigin", "path", "scope"]) {
      assert.ok(
        !t.includes(`formData.get("${polje}")`),
        `${ime} čita „${polje}“ iz forme`,
      );
    }
  }
  /*
   * Opseg komande dolazi sa UREĐAJA, ne iz forme: skriveni input ne bira firmu.
   * Jedino što `triggerSyncAction` uzima jeste ID uređaja.
   */
  const polja = [...telo("triggerSyncAction").matchAll(/formData\.get\("(\w+)"\)/g)].map(
    (m) => m[1],
  );
  assert.deepEqual(polja, ["deviceId"]);
});

test("otisak ključa računa server, a registracija prima samo javni deo", () => {
  const reg = telo("registerDeviceAction");
  // Otisak iz forme bi značio da se potvrđuje nešto što niko nije proverio.
  assert.ok(!reg.includes('formData.get("fingerprint")'));
  assert.ok(!reg.includes('formData.get("expectedFingerprint")'));
  /*
   * Privatni ključ nema polje u koje bi stao — nastaje i ostaje na uređaju.
   */
  for (const tajna of ["privateKey", "privateKeySpki", "secret", "password"]) {
    assert.ok(!reg.includes(tajna), `registracija dodiruje „${tajna}“`);
  }

  // Aktivacija TRAŽI ručno potvrđen otisak; bez toga bi bila puko klikanje.
  assert.match(telo("activateDeviceAction"), /expectedFingerprint/);
});

test("greška baze se ne prosleđuje na ekran", () => {
  /*
   * Naziv ograničenja odaje šemu, a poruka drajvera ume da nosi deo upita.
   * Zato se sve mapira kroz stabilne kodove.
   */
  assert.ok(!/error\.message/.test(kod), "sirova poruka greške ide na ekran");
  assert.match(kod, /function porukaZa\(/);
});
