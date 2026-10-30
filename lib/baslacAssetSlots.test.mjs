import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const systems = await readFile(new URL("./baslac-systems.ts", import.meta.url), "utf8");
const adapter = await readFile(
  new URL("../components/baslac-brand/BaslacSystemPdp.tsx", import.meta.url),
  "utf8",
);
const picker = await readFile(
  new URL("../components/product/family/FamilyBasePdp.tsx", import.meta.url),
  "utf8",
);

function slot(id) {
  const chunk = systems.split("{ slotId: ").find((c) => c.startsWith(`"${id}"`));
  assert.ok(chunk, `slot ${id} ne postoji`);
  return chunk.slice(0, chunk.indexOf("}"));
}

test("Line 30 3,5 L koristi 3,5 L sliku", () => {
  assert.match(slot("line-30:3.5l"), /src: "\/products\/baslac\/baslac--line-30-3\.5l-family-packshot\.webp"/);
});

/*
 * 2026-10-21: prazni slotovi su popunjeni zvaničnim Surventis fotografijama TAČNE zapremine.
 * Portal ima samo fotografije sa šifrom jedne baze; od 2026-10-30 su retuširane na oznaku
 * serije (kao 3,5 L limenka), pa slot nosi samo id izvora, bez `shownCode`.
 */
test("Line 30 1 L ima svoju 1 L fotografiju, nikada 3,5 L limenku", () => {
  const chunk = slot("line-30:1l");
  assert.match(chunk, /src: "\/products\/baslac\/baslac--line-30-1l-representative\.webp"/);
  assert.doesNotMatch(chunk, /3\.5l/);
  // 2026-10-30: etiketa retuširana na oznaku serije; slot ne nosi šifru baze.
  assert.doesNotMatch(chunk, /shownCode/);
  assert.match(chunk, /portalAssetId: 12114/);
});

test("Line 35 0,5 L i 1 L imaju sopstvene fotografije bez 3,5 L fallbacka", () => {
  for (const [id, file] of [["line-35:0.5l", "line-35-0.5l"], ["line-35:1l", "line-35-1l"]]) {
    const chunk = slot(id);
    assert.match(chunk, new RegExp(`src: "/products/baslac/baslac--${file.replace(".", "\\.")}-representative\\.webp"`));
    assert.doesNotMatch(chunk, /3\.5l-family/);
    assert.doesNotMatch(chunk, /shownCode/);
  }
  assert.match(slot("line-35:3.5l"), /baslac--line-35-3\.5l-family-packshot\.webp/);
});

test("Line 45 0,1 L koncentrat ima svoj slot i svoju fotografiju", () => {
  const chunk = slot("line-45:0.1l");
  assert.match(chunk, /baslac--line-45-0\.1l-representative\.webp/);
  assert.match(chunk, /concentrate/);
});

test("nema fallbacka na drugu zapreminu", () => {
  // Rezolucija slota trazi TACNU zapreminu; nema `?? ASSET_SLOTS[0]` ni slicno.
  assert.match(systems, /slot\.system === system && slot\.volumeL === volumeL/);
  // Fotografija se bira po zapremini AKTIVNE baze; bez slike te zapremine samo primer linije uz natpis.
  assert.match(picker, /packshots\[active\.volumeKey\] \?\? null/);
  assert.match(adapter, /Primer ambalaže linije — ne prikazuje izabranu nijansu ni zapreminu\./);
});

test("oznaka zapremine dolazi iz aktivne varijante", () => {
  assert.match(picker, /<span className=\{styles\.volumeMark\}>\{active\?\.volumeLabel\}<\/span>/);
});

test("promena pigmenta iste zapremine ne menja sliku", () => {
  // Slika zavisi iskljucivo od (system, volumeL) — ne od sifre ili swatcha.
  const fn = adapter.slice(adapter.indexOf("function packshotsFor"), adapter.indexOf("export function BaslacSystemPdp"));
  assert.doesNotMatch(fn, /base\.code|base\.swatch|base\.name/);
  assert.match(fn, /shownCode/);
});
