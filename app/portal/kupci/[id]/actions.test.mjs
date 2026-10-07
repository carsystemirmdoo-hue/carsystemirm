import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../../../../", import.meta.url).pathname;
const izvor = await readFile(`${ROOT}app/portal/kupci/[id]/actions.ts`, "utf8");
const kod = izvor.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

function telo(ime) {
  const i = kod.indexOf(`export async function ${ime}(`);
  assert.ok(i >= 0, `${ime} ne postoji`);
  const j = kod.indexOf("\nexport async function ", i + 1);
  return kod.slice(i, j < 0 ? undefined : j);
}

test("status kupca: ovlašćenje se proverava u akciji, pre bilo čega", () => {
  const t = telo("setCustomerStatusAction");
  const prvi = t.indexOf("requireCapability(");
  assert.ok(prvi > 0 && t.indexOf('"mappings:manage"') > prvi, "akcija ne traži mappings:manage");
  assert.ok(prvi < t.indexOf("setCustomerActive("), "ovlašćenje mora pre izmene");
  // Kupac se ne bira iz sesije nego iz forme — ali samo kao UUID, uz razlog.
  assert.match(t, /customerId: z\.string\(\)\.uuid\(\)|statusSchema/);
});
