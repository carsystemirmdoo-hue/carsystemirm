import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * `vercel.json` je deo izdanja (2026-10-01):
 * - funkcije u Frankfurtu (`fra1`), blizu EU baze — podrazumevano je `iad1` (SAD);
 *   Hobby dozvoljava jedan region;
 * - grane `integration/**` ne pokreću automatski deployment na push. Kontrolisan
 *   test ide namerno: posebna grana koja se ne poklapa sa obrascem, ili
 *   `vercel deploy` člana firminog tima.
 * `main` (produkcija) nije pogođen.
 */
const config = JSON.parse(readFileSync(new URL("../../vercel.json", import.meta.url), "utf8"));

test("funkcije rade u jednom regionu, Frankfurt", () => {
  assert.deepEqual(config.regions, ["fra1"]);
});

test("integracione grane se ne objavljuju same, main ostaje uključen", () => {
  const rules = config.git?.deploymentEnabled;
  assert.equal(typeof rules, "object");
  assert.equal(rules["integration/**"], false);
  assert.notEqual(rules.main, false);
  assert.notEqual(config.git.deploymentEnabled, false, "ne gasiti sve deploymente");
  for (const [pattern, enabled] of Object.entries(rules)) {
    if (enabled === false) assert.doesNotMatch("main", new RegExp(`^${pattern.replace(/\*+/g, ".*")}$`));
  }
});
