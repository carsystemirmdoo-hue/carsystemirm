import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const systems = await readFile(new URL("./baslac-systems.ts", import.meta.url), "utf8");
const pdp = await readFile(
  new URL("../components/baslac-brand/BaslacSystemPdp.tsx", import.meta.url),
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

test("Line 30 1 L nikada ne koristi 3,5 L limenku", () => {
  const chunk = slot("line-30:1l");
  assert.match(chunk, /src: null/);
  assert.doesNotMatch(chunk, /3\.5l/);
  assert.match(chunk, /expectedFilename: "baslac--line-30-1l-family-packshot\.png"/);
});

test("Line 35 0,5 L i 1 L imaju sopstvene slotove bez 3,5 L fallbacka", () => {
  for (const id of ["line-35:0.5l", "line-35:1l"]) {
    const chunk = slot(id);
    assert.match(chunk, /src: null/);
    assert.doesNotMatch(chunk, /3\.5l-family/);
  }
  assert.match(slot("line-35:3.5l"), /baslac--line-35-3\.5l-family-packshot\.webp/);
});

test("Line 45 0,1 L koncentrat ima svoj slot", () => {
  const chunk = slot("line-45:0.1l");
  assert.match(chunk, /src: null/);
  assert.match(chunk, /concentrate/);
});

test("nema fallbacka na drugu zapreminu", () => {
  // Rezolucija slota trazi TACNU zapreminu; nema `?? ASSET_SLOTS[0]` ni slicno.
  assert.match(
    systems,
    /slot\.system === system && slot\.volumeL === volumeL/,
  );
  assert.match(pdp, /baslacAssetSlot\(system, base\.volumeL\)\?\.src \?\? null/);
});

test("oznaka zapremine dolazi iz aktivne varijante", () => {
  assert.match(pdp, /volumeText\(active\?\.volumeL \?\? null\)/);
});

test("promena pigmenta iste zapremine ne menja sliku", () => {
  // Slika zavisi iskljucivo od (system, volumeL) — ne od sifre ili swatcha.
  const fn = pdp.slice(pdp.indexOf("function packshotFor"), pdp.indexOf("function slugFor"));
  assert.doesNotMatch(fn, /base\.code|base\.swatch|base\.name/);
});
