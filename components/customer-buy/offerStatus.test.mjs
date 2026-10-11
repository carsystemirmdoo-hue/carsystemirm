import assert from "node:assert/strict";
import test from "node:test";
import { customerStatusLabel, offersForView } from "./offerStatus.mjs";

const o = (slug, variantKey, state) => ({ slug, variantKey, state });
const offers = [o("filler", "152.580", "orderable"), o("filler", "152.416", "no_price"), o("antisil", null, "orderable")];

test("ponude prate izabranu varijantu; veza bez varijante važi za ceo proizvod", () => {
  assert.deepEqual(offersForView(offers, "filler", ["152.580"]).map((x) => x.variantKey), ["152.580"]);
  assert.deepEqual(offersForView(offers, "filler", ["152.417"]), []);
  assert.equal(offersForView(offers, "antisil", []).length, 1);
  assert.equal(offersForView(offers, "filler", ["152.580".toUpperCase()]).length, 1);
});

test("status ne protivreči ceni kupca, a bez potvrđene ponude ostaje javni", () => {
  const label = (keys, enabled = true) => customerStatusLabel(offersForView(offers, "filler", keys), enabled, "Na upit");
  assert.equal(label(["152.580"]), "Vaša cena potvrđena");
  assert.equal(label(["152.416"]), "Cena na upit");
  assert.equal(label(["152.417"]), "Na upit", "nepovezana varijanta: javni status");
  assert.equal(label(["152.580"], false), "Na upit", "poručivanje nije uključeno");
  assert.equal(customerStatusLabel(null, true, "Na upit"), "Na upit", "neprijavljen");
});
