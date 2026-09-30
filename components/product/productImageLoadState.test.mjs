/**
 * V6 kartica crta CSS senku tek kada je slika učitana. Ovde se proverava sama
 * odluka (`watchProductImageLoad`) na lažnom `<img>`, i to da je veza u
 * `ProductVisualSurface` ograničena na V6 — legacy kartice i drugi brendovi ne
 * dobijaju ni atribut ni slušaoce.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { watchProductImageLoad } from "./productImageLoadState.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (relative) => readFileSync(path.join(ROOT, relative), "utf8");
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

let sourceSequence = 0;

function fakeImage({ complete = false, naturalWidth = 0, decode, currentSrc } = {}) {
  const listeners = { load: new Set(), error: new Set() };
  const img = {
    complete,
    naturalWidth,
    // Podrazumevano svaka lažna slika ima svoju adresu, da testovi ne dele keš.
    currentSrc: currentSrc ?? `/_next/image?url=test-${++sourceSequence}`,
    addEventListener: (type, handler) => listeners[type].add(handler),
    removeEventListener: (type, handler) => listeners[type].delete(handler),
    emit: (type) => [...listeners[type]].forEach((handler) => handler()),
    listenerCount: () => listeners.load.size + listeners.error.size,
  };
  if (decode !== null) img.decode = decode ?? (() => Promise.resolve());
  return img;
}

function watch(img) {
  const states = [];
  const stop = watchProductImageLoad(img, (state) => states.push(state));
  return { states, stop };
}

test("loading → loaded: senka čeka `load` I `decode()`", async () => {
  let finishDecode;
  const img = fakeImage({ decode: () => new Promise((resolve) => (finishDecode = resolve)) });
  const { states } = watch(img);
  await flush();
  assert.deepEqual(states, [], "pre `load` nema ishoda");

  img.complete = true;
  img.naturalWidth = 660;
  img.emit("load");
  await flush();
  assert.deepEqual(states, [], "`load` bez završenog dekodiranja još nije `loaded`");

  finishDecode();
  await flush();
  assert.deepEqual(states, ["loaded"]);
});

test("keš: slika je `complete` pre nego što se slušalac zakači", async () => {
  const { states } = watch(fakeImage({ complete: true, naturalWidth: 660 }));
  await flush();
  assert.deepEqual(states, ["loaded"]);
});

test("keš, prvi put u sesiji: i dalje čeka `decode()` (ne sme senka pre piksela)", () => {
  const { states } = watch(fakeImage({ complete: true, naturalWidth: 660 }));
  assert.deepEqual(states, [], "sinhrono još nema ishoda");
});

test("ponovno montiranje već dekodirane slike → loaded SINHRONO (bez frejma bez senke)", async () => {
  const currentSrc = "/_next/image?url=remount";
  const first = watch(fakeImage({ complete: true, naturalWidth: 660, currentSrc }));
  await flush();
  assert.deepEqual(first.states, ["loaded"]);

  const second = watch(fakeImage({ complete: true, naturalWidth: 660, currentSrc }));
  assert.deepEqual(second.states, ["loaded"], "ishod stiže pre kraja layout efekta");
});

test("poznata adresa NE daje senku unapred ako slika nije stvarno tu", async () => {
  const currentSrc = "/_next/image?url=evicted";
  await (async () => { watch(fakeImage({ complete: true, naturalWidth: 660, currentSrc })); await flush(); })();

  const refetching = watch(fakeImage({ complete: false, naturalWidth: 0, currentSrc }));
  await flush();
  assert.deepEqual(refetching.states, [], "izbačena iz keša pa se ponovo preuzima → loading");

  const broken = watch(fakeImage({ complete: true, naturalWidth: 0, currentSrc }));
  assert.deepEqual(broken.states, ["failed"]);
});

test("`complete` bez adrese (preuzimanje nije ni počelo) nije greška → loading", async () => {
  const img = fakeImage({ complete: true, naturalWidth: 0, currentSrc: "" });
  const { states } = watch(img);
  await flush();
  assert.deepEqual(states, []);
  img.naturalWidth = 660;
  img.emit("load");
  await flush();
  assert.deepEqual(states, ["loaded"]);
});

test("ponovni pokušaj: posle `failed` novi `load` istog elementa → loaded", async () => {
  const img = fakeImage();
  const { states } = watch(img);
  img.emit("error");
  img.naturalWidth = 660;
  img.emit("load");
  await flush();
  assert.deepEqual(states, ["failed", "loaded"]);
});

test("zastareli `load` prethodne slike ne prepisuje ishod nove (odjava + generacija)", async () => {
  let finishOld;
  const img = fakeImage({ naturalWidth: 660, decode: () => new Promise((resolve) => (finishOld = resolve)) });
  const first = watch(img);
  img.emit("load");
  first.stop();
  img.decode = () => Promise.resolve();
  img.currentSrc = "/_next/image?url=novi";
  img.naturalWidth = 0;
  const second = watch(img);
  img.emit("error");
  finishOld();
  await flush();
  assert.deepEqual(first.states, []);
  assert.deepEqual(second.states, ["failed"]);
});

test("greška posle montiranja → failed", async () => {
  const img = fakeImage();
  const { states } = watch(img);
  img.emit("error");
  await flush();
  assert.deepEqual(states, ["failed"]);
});

test("greška PRE hidracije: `complete` uz `naturalWidth` 0 → failed, bez čekanja događaja", async () => {
  const { states } = watch(fakeImage({ complete: true, naturalWidth: 0 }));
  await flush();
  assert.deepEqual(states, ["failed"]);
});

test("`decode()` koji odbije ispravnu sliku i dalje daje loaded", async () => {
  const img = fakeImage({ complete: true, naturalWidth: 660, decode: () => Promise.reject(new Error("EncodingError")) });
  const { states } = watch(img);
  await flush();
  assert.deepEqual(states, ["loaded"]);
});

test("pregledač bez `decode()` → loaded odmah posle `load`", async () => {
  const img = fakeImage({ decode: null });
  const { states } = watch(img);
  img.naturalWidth = 660;
  img.emit("load");
  await flush();
  assert.deepEqual(states, ["loaded"]);
});

test("greška koja stigne dok se prethodni `load` još dekodira pobeđuje", async () => {
  let finishDecode;
  const img = fakeImage({ naturalWidth: 660, decode: () => new Promise((resolve) => (finishDecode = resolve)) });
  const { states } = watch(img);
  img.emit("load");
  img.emit("error");
  finishDecode();
  await flush();
  assert.deepEqual(states, ["failed"], "zakasneli `decode()` ne sme vratiti senku slici koja je pala");
});

test("odjava: nema ishoda posle unmount-a i slušaoci su skinuti", async () => {
  let finishDecode;
  const img = fakeImage({ naturalWidth: 660, decode: () => new Promise((resolve) => (finishDecode = resolve)) });
  const { states, stop } = watch(img);
  img.emit("load");
  stop();
  finishDecode();
  img.emit("error");
  await flush();
  assert.deepEqual(states, []);
  assert.equal(img.listenerCount(), 0);
});

/* ---------------- veza u komponenti i CSS-u ---------------- */

const surfaceTsx = read("components/product/ProductVisualSurface.tsx");
const surfaceCss = read("components/product/ProductVisualSurface.module.css");

test("jedna implementacija: React dobija stanje samo kroz `useProductImageLoadState` → `watchProductImageLoad`", () => {
  const hook = read("components/product/useProductImageLoadState.ts");
  assert.match(hook, /from "@\/components\/product\/productImageLoadState\.mjs"/);
  assert.match(hook, /useLayoutEffect\(\(\) => \{[\s\S]*?return watchProductImageLoad\(node,/, "layout efekat: ishod pre prvog crtanja");
  // Hook nema svoje slušaoce, `decode()` ni keš — sve je u jezgru.
  assert.equal(/addEventListener|decode\(|new Set/.test(hook), false);
  for (const file of [
    "components/product/ProductVisualSurface.tsx",
    "components/product/ProductStickyStage.tsx",
  ]) {
    const source = read(file);
    assert.match(source, /useProductImageLoadState\(/, file);
    assert.equal(/watchProductImageLoad|addEventListener\("load"|\.decode\(/.test(source), false, `${file}: bez drugog izvora istine`);
    assert.equal(/=== "error"/.test(source), false, `${file}: stanje se zove "failed"`);
  }
});

test("atribut stanja postoji SAMO za V6 (legacy i drugi brendovi netaknuti) i čita ISTO stanje", () => {
  assert.match(surfaceTsx, /data-product-image-state=\{v6Shadow \? imageState : undefined\}/);
  assert.match(surfaceTsx, /const \{ ref: imageRef, state: imageState \} = useProductImageLoadState\(/);
  assert.match(surfaceTsx, /const hasProductAsset = hasRealImage && imageState !== "failed";/);
  // `failed` zadržava V6 atribute, pa CSS gasi senku i ispod „Vizuel u pripremi".
  assert.match(surfaceTsx, /const v6Shadow =\s*hasRealImage && !image \? \(resolved\.officialShadow \?\? null\) : null;/);
  // `onError` na next/image radi `img.src = img.src` na svakoj kartici — zato
  // se stanje prati spolja, a sam <Image> ostaje bez novih handlera.
  const imageElement = /<Image\b[\s\S]*?\/>/.exec(surfaceTsx)[0];
  assert.equal(/onLoad|onError|onLoadingComplete/.test(imageElement), false);
});

test("ishod je vezan za `src`: druga slika na istoj instanci kreće od `loading`", () => {
  const hook = read("components/product/useProductImageLoadState.ts");
  assert.match(hook, /entry\.src === \(src \?\? null\) \? entry\.state : "loading"/);
  assert.match(hook, /\}, \[node, src\]\);/, "nova slika ili novi element → novi posmatrač, stari se odjavljuje");
});

test("CSS: V6 senka je skrivena u svakom stanju osim `loaded`, i samo u V6 modelu", () => {
  const rules = [...surfaceCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .map((match) => ({ selector: match[1].replace(/\/\*[\s\S]*?\*\//g, "").trim(), body: match[2] }))
    .filter((rule) => rule.selector.includes("data-product-image-state"));
  assert.equal(rules.length, 1);
  assert.equal(
    rules[0].selector,
    '.surface[data-product-shadow-model="v6"]:not([data-product-image-state="loaded"]) .contactShadow',
  );
  assert.equal(rules[0].body.replace(/\s+/g, " ").trim(), "visibility: hidden;");
});

test("CSS: pravilo ne uvodi tranziciju ni opacity — hover i reduced-motion ostaju isti", () => {
  const block = surfaceCss.slice(surfaceCss.indexOf('data-product-image-state="loaded"'));
  const body = /\{([^{}]*)\}/.exec(block)[1];
  assert.equal(/transition|opacity|animation/.test(body), false);
});
