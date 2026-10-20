import { test } from "node:test";
import assert from "node:assert/strict";
import { isLacquer, orderPaintCategory } from "./paint-priority.mjs";

test("ključni sistemi idu na početak, lakovi pre ostalog, ostalo zadržava redosled", () => {
  const input = [
    { id: "baslac-50-15-2k-hardener-fast", name: "baslac 50-15 2K Hardener Fast" },
    { id: "c-2a46-ultratop", name: "C 2A46 UltraTOP", rmMetadata: { category: "clearcoat" } },
    { id: "family:baslac-line-35", name: "baslac Basecoat 35" },
    { id: "rm-uno-hd", slug: "rm-uno-hd", name: "R-M UNO HD" },
    { id: "rm-diamont-crystal-base", slug: "rm-diamont-crystal-base", name: "R-M DIAMONT CRYSTAL BASE" },
    { id: "carsystem-acryl-thinner", name: "Carsystem Acryl Thinner" },
    { id: "rm-onyx-hd", slug: "rm-onyx-hd", name: "R-M ONYX HD" },
    { id: "baslac-40-40-2k-universal-clear", name: "baslac 40-40 2K Universal Clear" },
    { id: "rm-diamont", slug: "rm-diamont", name: "R-M DIAMONT var CV" },
    { id: "rm-paste-za-mesanje", slug: "rm-paste-za-mesanje", name: "R-M paste za mešanje" },
    { id: "rm-diamont-bazna-boja", slug: "rm-diamont-bazna-boja", name: "R-M DIAMONT bazna boja" },
  ];
  assert.deepEqual(
    orderPaintCategory(input).map((e) => e.slug ?? e.id),
    [
      "rm-diamont-bazna-boja",
      "rm-onyx-hd",
      "rm-uno-hd",
      "rm-diamont-crystal-base",
      "rm-paste-za-mesanje",
      "rm-diamont",
      "family:baslac-line-35",
      "c-2a46-ultratop",
      "baslac-40-40-2k-universal-clear",
      "baslac-50-15-2k-hardener-fast",
      "carsystem-acryl-thinner",
    ],
  );
});

test("učvršćivač i razređivač za lak nisu lak", () => {
  assert.equal(isLacquer({ name: "baslac 50-415 2K Clear Hardener Fast VOC" }), false);
  assert.equal(isLacquer({ name: "R 2P15 CLEAR Thinn-R" }), false);
  assert.equal(isLacquer({ name: "Carsystem 2K Clear VOC 420" }), true);
});

test("lični redosled: sistemi boja ostaju na početku, ostalo zadržava lični redosled", async () => {
  const { pinPaintSystems } = await import("./paint-priority.mjs");
  const personal = [
    { id: "baslac-70-10" },
    { id: "rm-uno-hd", slug: "rm-uno-hd" },
    { id: "carsystem-filler" },
    { id: "family:baslac-line-35" },
    { id: "rm-diamont-bazna-boja", slug: "rm-diamont-bazna-boja" },
  ];
  assert.deepEqual(pinPaintSystems(personal).map((e) => e.slug ?? e.id), [
    "rm-diamont-bazna-boja",
    "rm-uno-hd",
    "family:baslac-line-35",
    "baslac-70-10",
    "carsystem-filler",
  ]);
});
