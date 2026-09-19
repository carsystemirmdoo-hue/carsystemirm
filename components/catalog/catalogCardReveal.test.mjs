import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/*
 * Regresija: roletna na /katalog kartici.
 *
 * Nađeno 2026-09-10: kartice sa `visualMode: "neutral"` (klarlak, abraziv, kit,
 * proizvodi bez slike) nisu imale obojeni sloj — `colorReveal` je za neutral
 * `display: none`, pa je pri hoveru ostajao samo bledi wash i tanka ivica, dok
 * je susedna farba dobijala punu roletnu. Kartica bez slike je uz to imala
 * 93 % neprozirnu pločicu preko cele površine, pa se boja videla samo kao ivica.
 */
const card = readFileSync(new URL("./CatalogProductCard.tsx", import.meta.url), "utf8");
const surface = readFileSync(
  new URL("../product/ProductVisualSurface.tsx", import.meta.url),
  "utf8",
);
const surfaceStyles = readFileSync(
  new URL("../product/ProductVisualSurface.module.css", import.meta.url),
  "utf8",
);
const catalogStyles = readFileSync(new URL("./CatalogPage.module.css", import.meta.url), "utf8");

test("neutral visualMode i dalje gasi colorReveal van kataloga (PDP, brend stranice)", () => {
  assert.match(
    surfaceStyles,
    /\.surface\[data-product-visual-mode="neutral"\] \.colorReveal \{\s*display: none;/,
  );
});

test("/katalog kartica uvek traži reveal, nezavisno od tipa proizvoda", () => {
  const override = card.slice(card.indexOf("const presentation = catalogSystem"));
  assert.match(override, /visualMode: "color-on-hover"/);
  // Boja: nijansa proizvoda pre boje brenda; reveal nije uslovan.
  assert.match(card, /listing\.presentation\.shade \?\? getBrandCardColor\(brand\)/);
  assert.match(override, /style: cardColor\s*\?/);
});

test("pločica bez slike propušta roletnu samo na /katalog", () => {
  assert.match(surface, /data-product-visual-placeholder/);
  assert.match(
    catalogStyles,
    /\.productCard\[data-card-system="b"\] \[data-product-visual-placeholder\] \{[^}]*transparent/,
  );
  // Van kataloga pločica ostaje kakva je bila.
  assert.doesNotMatch(surfaceStyles, /data-product-visual-placeholder/);
});

test("roletna ostaje iza proizvoda: nema blend/filter režima koji prebojava sliku", () => {
  // Ranije multiply rešenje (2026-09-10) je bojilo etikete i poklopce u boju
  // roletne. Fotografije bez alfe se rešavaju cut-out assetom, ne blendom.
  assert.doesNotMatch(surfaceStyles, /mix-blend-mode:\s*(multiply|darken|screen|overlay|color|hue|luminosity)/);
  assert.doesNotMatch(surface, /data-product-image-opaque|hasOpaqueAsset|scope=/);
  assert.doesNotMatch(card, /scope=\{catalogSystem/);
});

test("kataloške slike proizvoda nemaju neprovidnu belu pozadinu (JPEG bez alfe)", () => {
  const data = readFileSync(new URL("../../lib/carsystem-data.ts", import.meta.url), "utf8");
  // Samo glavni packshot kartice (`productImage`); galerijske `-detail` slike su
  // PDP fotografije i ne ulaze u karticu.
  const packshots = [...data.matchAll(/productImage:\s*productAsset\(\s*"([^"]+)"/g)].map((m) => m[1]);
  const jpgs = packshots.filter((src) => /\.jpe?g$/i.test(src));
  assert.deepEqual(jpgs, [], `JPEG bez alfe kao packshot kartice: ${jpgs.join(", ")}`);
  const metrics = JSON.parse(
    readFileSync(new URL("../../data/product-image-metrics.generated.json", import.meta.url), "utf8"),
  );
  const opaque = packshots.filter((src) => metrics.images[src]?.boxSource === "opaque-border");
  assert.deepEqual(opaque, [], `Slike sa neprovidnom pozadinom u katalogu: ${opaque.join(", ")}`);
});
