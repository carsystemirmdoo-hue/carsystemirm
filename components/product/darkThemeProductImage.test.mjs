import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../..");
const read = (relative) => readFileSync(join(here, relative), "utf8");
const ruleBody = (css, selector) => {
  const start = css.indexOf(`${selector} {`);
  assert.notEqual(start, -1, `nema pravila ${selector}`);
  return css.slice(start, css.indexOf("}", start));
};

test("tamna tema: proizvod na PDP sceni nema svetao obris, samo tamnu senku", () => {
  const css = read("./ProductDetailExperience.module.css");
  const body = ruleBody(css, ":global(.dark) .heroProductImage");
  // Svetli 1 px drop-shadow je od svakog isečka pravio „nalepnicu".
  assert.doesNotMatch(body, /drop-shadow\(0 0 1px/);
  assert.match(body, /var\(--dk-shadow-color\)/);
});

test("tamna tema: senka kartice nije bojena sa --foreground (beli oreol)", () => {
  const css = read("./ProductVisualSurface.module.css");
  const body = ruleBody(css, ":global(.dark) .productImage");
  assert.doesNotMatch(body, /--foreground/);
  assert.match(body, /var\(--product-image-dark-filter, drop-shadow\([^)]*var\(--dk-shadow-color\)\)\)/);
  assert.match(ruleBody(css, ":global(.dark) .contactShadow"), /--product-image-dark-contact/);
});

test("tamna tema: light box i fotografija su vezani za izmereni režim slike", () => {
  const css = read("./ProductDetailExperience.module.css");
  assert.match(
    css,
    /:global\(\.dark\) \.stage\[data-product-image-matte="backdrop"\] \.stagePlate \{\s*background: var\(--product-image-backdrop/,
  );
  // Fotografija se nikad ne seče: cela staje u scenu (cover je odsecao proizvod na 248/375 slika).
  assert.match(css, /:global\(\.dark\) \.stage\[data-product-image-matte="photo"\] \.heroProductImage \{\s*object-fit: contain;/);
  assert.doesNotMatch(css, /matte="photo"\][^{]*\{[^}]*object-fit: cover/);
  const stage = read("./ProductStickyStage.tsx");
  // Slika koja ne uspe da se učita ne sme da ostavi praznu ploču ni slomljenu ikonu.
  assert.match(stage, /const shownImage = imageState === "error" \? null : activeImage;/);
  assert.match(stage, /data-product-image-matte=\{shownImage\?\.matte\}/);
});

test("derivati za prikaz: svaki ima pregledan plan i postojeći fajl, original se ne menja", () => {
  const plan = JSON.parse(readFileSync(join(root, "data/catalog/image-remaster/plan.json"), "utf8"));
  const map = JSON.parse(readFileSync(join(root, "data/catalog/image-remaster/display-map.json"), "utf8"));
  const planned = new Map(plan.images.map((entry) => [entry.src, entry]));
  for (const [src, derivative] of Object.entries(map.images)) {
    const entry = planned.get(src);
    assert.ok(entry, `${src} nema pregledan unos u plan.json`);
    assert.ok(entry.reason && entry.operations.length > 0, `${src} nema razlog ili operaciju`);
    assert.equal(derivative, `/remastered${src}`);
    assert.ok(existsSync(join(root, "public", derivative)), `${derivative} ne postoji`);
    assert.ok(existsSync(join(root, "public", src)), `original ${src} ne postoji`);
  }
});
