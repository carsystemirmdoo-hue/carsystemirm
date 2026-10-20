import { test } from "node:test";
import assert from "node:assert/strict";
import mixingBases from "../data/rm-sync/mixing-bases.json" with { type: "json" };
import baseSwatches from "../data/rm-sync/base-swatches.json" with { type: "json" };
import { rmBaseSwatch, rmMixingBaseSection, RM_SWATCH_NOTE } from "./rm-mixing-bases";

const cards = (mixingBases as { cards: Record<string, { code: string }[]> }).cards;
const codesFor = (slug: string) => cards[slug].map((row) => row.code);
const covered = (slug: string) => codesFor(slug).filter((code) => rmBaseSwatch(slug, code).swatch);

test("pokrivenost uzoraka: DIAMONT 34/35, CRYSTAL BASE 17/17, paste 0/20", () => {
  assert.equal(covered("rm-diamont-bazna-boja").length, 34);
  assert.equal(codesFor("rm-diamont-bazna-boja").length, 35);
  assert.equal(covered("rm-diamont-crystal-base").length, 17);
  assert.equal(codesFor("rm-diamont-crystal-base").length, 17);
  assert.equal(covered("rm-paste-za-mesanje").length, 0);
});

test("šifra bez podatka i kartica bez potvrđene linije dobijaju neutralan prikaz, ne nasumičnu boju", () => {
  assert.deepEqual(rmBaseSwatch("rm-diamont-bazna-boja", "BC 101"), { swatchFinish: "neutral" });
  for (const code of codesFor("rm-paste-za-mesanje")) {
    assert.deepEqual(rmBaseSwatch("rm-paste-za-mesanje", code), { swatchFinish: "neutral" });
  }
  assert.deepEqual(rmBaseSwatch("rm-diamont-bazna-boja", "NEPOSTOJECA"), { swatchFinish: "neutral" });
});

test("svaka pokrivena šifra je u tabeli izvora i boja dolazi iz palete porodice", () => {
  const data = baseSwatches as unknown as {
    palette: Record<string, string>;
    codes: Record<string, { family: string | null; finish: string; page?: number }>;
  };
  for (const slug of ["rm-diamont-bazna-boja", "rm-diamont-crystal-base"]) {
    for (const code of covered(slug)) {
      const entry = data.codes[code];
      assert.ok(entry, code);
      assert.equal(rmBaseSwatch(slug, code).swatch, data.palette[entry.family as string], code);
    }
  }
  assert.ok(codesFor("rm-diamont-crystal-base").some((code) => rmBaseSwatch("rm-diamont-crystal-base", code).swatchFinish === "crystal"));
});

test("redovi sekcije nose uzorak, opis nosi napomenu o orijentacionom prikazu", () => {
  const section = rmMixingBaseSection("rm-diamont-bazna-boja");
  assert.ok(section);
  assert.ok(section.rows.every((row) => row.swatchFinish));
  assert.ok(JSON.stringify(section).includes(RM_SWATCH_NOTE));
  assert.match(RM_SWATCH_NOTE, /orijentacioni prikaz/);
  assert.match(RM_SWATCH_NOTE, /ne garantovana završna nijansa/);
});
