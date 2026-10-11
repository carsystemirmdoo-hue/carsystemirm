import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { abrasiveBackingTerms } from "./abrasive-backing.mjs";

test("podloga se čita iz zvaničnog podnaslova, ne iz toga što je proizvod brusni disk", () => {
  assert.deepEqual(abrasiveBackingTerms("Paper abrasive - 150 mm - 25 holes"), ["papir", "papirni"]);
  assert.deepEqual(abrasiveBackingTerms("Film abrasive - 150 mm - 25 holes"), ["film", "filmski"]);
  assert.deepEqual(abrasiveBackingTerms("Net abrasive - 150 mm"), ["mreza", "mrezasti"]);
  assert.deepEqual(abrasiveBackingTerms("Net sanding strips 70 x 400 mm"), ["mreza", "mrezasti"]);
  assert.deepEqual(abrasiveBackingTerms("Foam abrasive - 150 mm"), ["sundjer"]);
  assert.deepEqual(abrasiveBackingTerms("Sanding Fleece - Disc"), ["flis"]);
  // Pribor bez abrazivne podloge ne dobija nijedan pojam.
  for (const subtitle of ["Interface pad - 150 mm", "Back pad - 150 mm", "Hand sanding block - Velcro®", "Raw cleaning disc", null]) {
    assert.deepEqual(abrasiveBackingTerms(subtitle), [], String(subtitle));
  }
});

test("svaki Carsystem abraziv sa „Paper abrasive” dobija papir, a nijedan film/mreža/sunđer ga ne dobija", async () => {
  const data = JSON.parse(
    await readFile(new URL("../../data/carsystem-catalog-products.generated.json", import.meta.url), "utf8"),
  );
  const entries = Object.values(data.products);
  const paper = entries.filter((entry) => /^paper abrasive/i.test(entry.officialSubtitle ?? ""));
  assert.ok(paper.length >= 4, `očekivani papirni abrazivi, nađeno ${paper.length}`);
  for (const entry of entries) {
    const isPaper = abrasiveBackingTerms(entry.officialSubtitle).includes("papir");
    assert.equal(isPaper, paper.includes(entry), entry.slug);
  }
});
