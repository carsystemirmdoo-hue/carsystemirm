import { test } from "node:test";
import assert from "node:assert/strict";
import { getCatalogListingData } from "./catalog-listing";
import { getProductSearchIndex } from "./search/buildSearchIndex";

const { canonical, anchors } = getCatalogListingData();
const byId = (id: string) => canonical.find((entity) => entity.id === id);

test("serija ima karticu za svaku potvrđenu zapreminu, bez opšte kartice među njima", () => {
  for (const [anchor, volumes] of [
    ["family:baslac-line-35", ["0-5-l", "1-l", "3-5-l"]],
    ["family:baslac-line-45", ["0-1-l", "0-5-l", "1-l", "5-l"]],
    ["family:baslac-line-30", ["1-l", "3-5-l"]],
    ["rm-diamont-bazna-boja", ["0-5-l", "1-l", "4-l"]],
    ["rm-diamont-crystal-base", ["125-ml"]],
  ] as const) {
    assert.ok(anchors.some((entity) => entity.id === anchor), `${anchor} je sidro`);
    assert.equal(byId(anchor), undefined, `${anchor} nije dodatna kartica u pregledu`);
    const cards = canonical.filter((entity) => entity.id.startsWith(`${anchor}@`)).map((entity) => entity.id.split("@")[1]);
    assert.deepEqual(cards, volumes, anchor);
  }
});

test("kartica zapremine: istaknuta serija i zapremina, fotografija te zapremine, direktan ulaz", () => {
  const card = byId("rm-diamont-bazna-boja@1-l")!;
  assert.equal(card.name, "R-M DIAMONT — 1 L");
  assert.equal(card.href, "/proizvodi/rm-diamont-bazna-boja?pakovanje=1-l");
  assert.equal(card.presentation.image?.src, "/products/rm/system/rm-diamont-1l.webp");
  assert.match(card.technicalLine, /^1 L · 15 baza$/);
  const baslac = byId("family:baslac-line-35@0-5-l")!;
  assert.equal(baslac.href, "/proizvodi/grupa/baslac-line-35?pakovanje=0-5-l");
  assert.equal(baslac.presentation.image?.src, "/products/baslac/baslac--line-35-0.5l-representative.webp");
});

test("paste bez potvrđene linije ostaju jedna kartica (nisu serija)", () => {
  assert.ok(byId("rm-paste-za-mesanje"));
  assert.equal(canonical.filter((entity) => entity.id.startsWith("rm-paste-za-mesanje@")).length, 0);
});

test("pretraga varijante i dalje radi kroz sidro porodice", () => {
  const records = getProductSearchIndex().records as { id: string; kind: string; href: string }[];
  const variant = records.find((record) => record.kind === "variant" && record.id === "baslac-35-m1140");
  assert.ok(variant, "35-M1140 je u indeksu");
  assert.match(variant!.href, /\/proizvodi\/grupa\/baslac-line-35\?varijanta=35-M1140/);
});
