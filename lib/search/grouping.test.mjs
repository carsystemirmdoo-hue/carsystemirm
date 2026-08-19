import assert from "node:assert/strict";
import test from "node:test";

import { DIRECT_HIT_SCORE, groupSearchHits } from "./grouping.mjs";

/**
 * Grupisanje se testira nad ručno sastavljenim rezultatima, ne nad izlazom
 * engine-a: pravila prikaza moraju važiti za BILO koji rangirani niz, pa test
 * ne sme da zavisi od trenutnih težina rangiranja.
 */
const family = { id: "family:antichip", kind: "family", name: "Antichip", familySlug: "antichip", href: "/proizvodi/grupa/antichip" };
const variants = ["white", "black", "grey", "beige", "blue"].map((color, position) => ({
  id: `antichip-${color}`,
  kind: "variant",
  name: `Antichip ${color}`,
  familySlug: "antichip",
  href: `/proizvodi/antichip-${color}`,
  position,
}));
const standalone = { id: "c-2e50", kind: "standalone", name: "C 2E50", href: "/proizvodi/c-2e50" };

const records = [family, ...variants, standalone];
const familyIndexBySlug = new Map([["antichip", 0]]);
const hit = (record, score) => ({ record, score, index: records.indexOf(record) });

test("varijante iste porodice ulaze u jednu stavku", () => {
  const groups = groupSearchHits(
    [family, ...variants].map((record, position) => hit(record, 900 - position)),
    { familyIndexBySlug, maxMembers: 3 },
  );

  assert.equal(groups.length, 1);
  assert.equal(groups[0].type, "family");
  assert.equal(groups[0].headerIndex, 0);
  assert.equal(groups[0].memberIndices.length, 3, "prikazano je više od tri varijante");
  assert.equal(groups[0].memberTotal, 5, "ukupan broj varijanti nije sačuvan");
});

test("porodica nosi naslov i kada se sama nije poklopila", () => {
  const groups = groupSearchHits(
    variants.map((record, position) => hit(record, 500 - position)),
    { familyIndexBySlug, maxMembers: 2 },
  );

  assert.equal(groups.length, 1);
  assert.equal(groups[0].headerIndex, 0, "naslov nije zapis porodice");
  assert.equal(groups[0].headerMatched, false);
  assert.equal(groups[0].memberTotal, 5);
});

test("tačan pogodak varijante se prikazuje direktno", () => {
  const groups = groupSearchHits([hit(variants[0], DIRECT_HIT_SCORE + 10)], {
    familyIndexBySlug,
  });

  assert.equal(groups[0].type, "record");
  assert.equal(groups[0].headerIndex, records.indexOf(variants[0]));
});

test("isti zapis ne može biti i samostalna stavka i član grupe", () => {
  const groups = groupSearchHits(
    [hit(family, DIRECT_HIT_SCORE + 50), hit(variants[0], DIRECT_HIT_SCORE + 10)],
    { familyIndexBySlug },
  );

  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].memberIndices, [records.indexOf(variants[0])]);
});

test("samostalni proizvod je uvek sopstvena stavka", () => {
  const groups = groupSearchHits([hit(standalone, 900)], { familyIndexBySlug });
  assert.equal(groups.length, 1);
  assert.equal(groups[0].type, "record");
  assert.equal(groups[0].memberTotal, 0);
});

test("broj grupa je ograničen, a redosled očuvan", () => {
  const many = Array.from({ length: 20 }, (_, position) => ({
    record: { id: `p-${position}`, kind: "standalone", name: `P ${position}`, href: `/proizvodi/p-${position}` },
    score: 1000 - position,
    index: position,
  }));

  const groups = groupSearchHits(many, { maxGroups: 8 });
  assert.equal(groups.length, 8);
  assert.deepEqual(
    groups.map((group) => group.headerIndex),
    [0, 1, 2, 3, 4, 5, 6, 7],
  );
});
