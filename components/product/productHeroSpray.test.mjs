import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const backdropUrl = new URL("./ProductHeroSprayBackdrop.tsx", import.meta.url);
const svgComponentUrl = new URL("./ProductHeroSpraySvg.tsx", import.meta.url);
const stylesUrl = new URL("./ProductHeroSprayBackdrop.module.css", import.meta.url);
const galleryUrl = new URL("./ProductStickyStage.tsx", import.meta.url);
const motionUrl = new URL("./productMotion.ts", import.meta.url);
const detailStylesUrl = new URL("./ProductDetailExperience.module.css", import.meta.url);
const dataUrl = new URL("../../lib/carsystem-data.ts", import.meta.url);
const cosmosDataUrl = new URL("../../lib/cosmos-lac-data.ts", import.meta.url);
const relatedProductsUrl = new URL("./RelatedProducts.tsx", import.meta.url);
const catalogCardUrl = new URL("../catalog/CatalogProductCard.tsx", import.meta.url);
const assetUrl = new URL(
  "../../public/product-hero-patterns/spray-six-pass.svg",
  import.meta.url,
);
const legacyAssetUrl = new URL(
  "../../public/product-hero-patterns/spray-strokes-01.svg",
  import.meta.url,
);
const legacyStaticAssetUrl = new URL(
  "../../public/product-hero-patterns/spray-strokes-01.static.svg",
  import.meta.url,
);

const approvedCandidateASha256 =
  "67b9d3f7abde665197106fc3aab7b358903e1e178924f05ee02b5170ba38acb1";

test("production asset is the exact approved six-pass Candidate A", async () => {
  const asset = await readFile(assetUrl, "utf8");
  const digest = createHash("sha256").update(asset).digest("hex");

  assert.equal(digest, approvedCandidateASha256);
  assert.match(asset, /viewBox="0 0 1536 1024"/);
  assert.equal(asset.match(/<path\b/g)?.length ?? 0, 42);
  assert.deepEqual(asset.match(/id="spray-pass-0[1-6]"/g), [
    'id="spray-pass-01"',
    'id="spray-pass-02"',
    'id="spray-pass-03"',
    'id="spray-pass-04"',
    'id="spray-pass-05"',
    'id="spray-pass-06"',
  ]);
  assert.match(asset, /fill:\s*currentColor/);
  assert.deepEqual(
    [...asset.matchAll(/opacity:\s*(\.\d+)/g)].map((match) => match[1]),
    [".85", ".22", ".55", ".32", ".17", ".08"],
  );
  assert.doesNotMatch(
    asset,
    /<(?:image|foreignObject|script|filter|rect|clipPath)\b|base64|#[\da-f]{3,8}/i,
  );
});

test("legacy three-part spray assets are removed", async () => {
  await assert.rejects(access(legacyAssetUrl), { code: "ENOENT" });
  await assert.rejects(access(legacyStaticAssetUrl), { code: "ENOENT" });
});

test("inline SVG builds six independent path masks with no spatial clipping", async () => {
  const component = await readFile(svgComponentUrl, "utf8");

  assert.match(component, /useId\(\)/);
  assert.match(component, /id\.replaceAll\(":", ""\)/);
  assert.equal(component.match(/pass:\s*"0[1-6]"/g)?.length ?? 0, 6);
  assert.equal(component.match(/styles\.revealPath0[1-6]/g)?.length ?? 0, 6);
  assert.match(component, /revealPasses\.map\(\(\{ pass, path \}, index\)/);
  assert.match(component, /data-spray-mask=\{`spray-mask-\$\{pass\}`\}/);
  assert.match(component, /data-reveal-path=\{`reveal-path-\$\{pass\}`\}/);
  assert.match(component, /data-spray-pass=\{`spray-pass-\$\{pass\}`\}/);
  assert.match(component, /pathLength=\{1\}/);
  assert.match(component, /stroke="white"/);
  assert.match(component, /strokeWidth=\{500\}/);
  assert.match(component, /fill="currentColor"/);
  assert.match(
    component,
    /const sprayAssetHref = "\/product-hero-patterns\/spray-six-pass\.svg"/,
  );
  assert.match(
    component,
    /<use href=\{`\$\{sprayAssetHref\}#spray-pass-\$\{pass\}`\}/,
  );
  assert.match(component, /data-spray-candidate="A"/);
  assert.doesNotMatch(
    component,
    /clipPath|<rect|staticArtwork|animatedSegments|scaleX\(|transform=|<image|<foreignObject|<script/,
  );
});

test("reveal geometry preserves RTL and LTR directions with approved width", async () => {
  const component = await readFile(svgComponentUrl, "utf8");
  const pathMatches = [
    ...component.matchAll(/pass:\s*"(\d{2})",\s*path:\s*\n\s*"([^"]+)"/g),
  ];

  assert.equal(pathMatches.length, 6);

  for (const [, pass, path] of pathMatches) {
    const values = [...path.matchAll(/-?\d+(?:\.\d+)?/g)].map((match) =>
      Number(match[0]),
    );
    const startX = values[0];
    const endX = values.at(-2);
    const passNumber = Number(pass);

    if (passNumber % 2 === 1) {
      assert.ok(startX > endX, `Pass ${pass} must run right to left`);
    } else {
      assert.ok(startX < endX, `Pass ${pass} must run left to right`);
    }
  }

  assert.match(component, /strokeWidth=\{500\}/);
});

test("SSR starts idle, waits for the hero image, and runs once with approved timing", async () => {
  const [backdrop, styles] = await Promise.all([
    readFile(backdropUrl, "utf8"),
    readFile(stylesUrl, "utf8"),
  ]);

  assert.match(backdrop, /useState<ProductHeroSprayPhase>\("idle"\)/);
  assert.match(backdrop, /productImage\.complete/);
  assert.match(backdrop, /addEventListener\("load", startOnce/);
  assert.match(backdrop, /addEventListener\("error", startOnce/);
  assert.match(backdrop, /if \(hasStarted\) return/);
  assert.match(backdrop, /initialDelay:\s*300/);
  assert.match(backdrop, /overlap:\s*140/);
  assert.match(
    backdrop,
    /durations:\s*\[480,\s*450,\s*420,\s*390,\s*360,\s*330\]/,
  );
  assert.match(
    backdrop,
    /starts:\s*\[0,\s*340,\s*650,\s*930,\s*1180,\s*1400\]/,
  );
  assert.match(backdrop, /easing:\s*"cubic-bezier\(0\.32, 0\.08, 0\.70, 0\.50\)"/);
  assert.match(backdrop, /setPhase\("running"\)/);
  assert.match(backdrop, /setPhase\("complete"\)/);
  assert.match(styles, /stroke-dasharray:\s*1/);
  assert.match(styles, /stroke-dashoffset:\s*1/);

  const initialDelay = 300;
  const durations = [480, 450, 420, 390, 360, 330];
  const starts = [0, 340, 650, 930, 1180, 1400];
  starts.forEach((start, index) => {
    const pass = String(index + 1).padStart(2, "0");
    assert.match(
      backdrop,
      new RegExp(
        `"--spray-duration-${pass}": \`\\$\\{sprayAnimationConfig\\.durations\\[${index}\\]\\}ms\``,
      ),
    );
    assert.match(
      backdrop,
      new RegExp(
        `"--spray-start-${pass}": \`\\$\\{sprayAnimationConfig\\.starts\\[${index}\\]\\}ms\``,
      ),
    );
    assert.match(
      styles,
      new RegExp(
        `revealPath${pass}\\s*\\{[^}]*var\\(--spray-duration-${pass}\\)[^}]*var\\(--spray-easing\\)[^}]*var\\(--spray-start-${pass}\\) forwards`,
      ),
    );
    if (index < starts.length - 1) {
      assert.equal(starts[index] + durations[index] - starts[index + 1], 140);
    }
  });

  assert.equal(starts.at(-1) + durations.at(-1), 1730);
  assert.equal(initialDelay + starts.at(-1) + durations.at(-1), 2030);
  assert.match(backdrop, /"--spray-easing": sprayAnimationConfig\.easing/);
  assert.doesNotMatch(
    styles,
    /\b(?:300|330|340|360|390|420|450|480|650|930|1180|1400|1730|2030)ms\b/,
  );
  assert.doesNotMatch(styles, /:hover[\s\S]*spray-draw|infinite|animation-iteration/);
});

test("complete and reduced-motion states reveal the same six masked passes", async () => {
  const [backdrop, component, styles, gallery, motion] = await Promise.all([
    readFile(backdropUrl, "utf8"),
    readFile(svgComponentUrl, "utf8"),
    readFile(stylesUrl, "utf8"),
    readFile(galleryUrl, "utf8"),
    readFile(motionUrl, "utf8"),
  ]);

  assert.match(backdrop, /prefers-reduced-motion: reduce/);
  assert.match(backdrop, /setPhase\("static"\)/);
  assert.doesNotMatch(component, /staticArtwork|duplicate/);
  assert.doesNotMatch(styles, /staticArtwork|animatedSegments/);
  assert.match(
    styles,
    /data-phase="complete"[\s\S]*data-phase="static"[\s\S]*stroke-dashoffset:\s*0/,
  );
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(
    styles,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*stroke-dashoffset:\s*0[\s\S]*animation:\s*none/,
  );
  assert.match(styles, /color:\s*var\(--product-visual-background-color\)/);
  assert.match(gallery, /style=\{getProductVisualStyle\(product\)\}/);
  assert.match(
    motion,
    /"--product-visual-background-color": product\.visual\?\.backgroundColor \?\? accent/,
  );
  assert.doesNotMatch(styles, /#[\da-f]{3,8}|oklch\(|rgb\(/i);
});

test("spray is category-gated behind color products and stays out of catalog surfaces", async () => {
  const [
    backdrop,
    styles,
    gallery,
    motion,
    detailStyles,
    data,
    cosmosData,
    relatedProducts,
    catalogCard,
  ] =
    await Promise.all([
      readFile(backdropUrl, "utf8"),
      readFile(stylesUrl, "utf8"),
      readFile(galleryUrl, "utf8"),
      readFile(motionUrl, "utf8"),
      readFile(detailStylesUrl, "utf8"),
      readFile(dataUrl, "utf8"),
      readFile(cosmosDataUrl, "utf8"),
      readFile(relatedProductsUrl, "utf8"),
      readFile(catalogCardUrl, "utf8"),
    ]);

  assert.doesNotMatch(
    `${backdrop}\n${styles}`,
    /leadingEdge|strokeZone|topZone|middleZone|bottomZone|mask-image|clip-path:\s*inset|scaleX\(/,
  );
  assert.match(styles, /--spray-default-scale:\s*1\.06/);
  assert.match(
    styles,
    /--spray-scale:\s*var\(--product-stage-spray-scale, var\(--spray-default-scale\)\)/,
  );
  assert.match(styles, /--spray-opacity:\s*1/);
  assert.match(
    styles,
    /--spray-offset-x:\s*var\(--product-stage-spray-offset-x, 0px\)/,
  );
  assert.match(
    styles,
    /--spray-offset-y:\s*var\(--product-stage-spray-offset-y, 4px\)/,
  );
  assert.match(
    styles,
    /@media \(max-width: 1023px\)[\s\S]*--spray-default-scale:\s*0\.84/,
  );
  assert.match(
    styles,
    /@media \(max-width: 520px\)[\s\S]*--spray-default-scale:\s*0\.94/,
  );
  assert.match(styles, /\.backdrop\s*\{[\s\S]*z-index:\s*1[\s\S]*pointer-events:\s*none/);
  assert.match(styles, /\.backdrop\s*\{[\s\S]*overflow:\s*hidden/);
  assert.match(
    data,
    /export type ProductVisualType =[\s\S]*"spray"[\s\S]*"color"[\s\S]*"abrasive"[\s\S]*"foam"[\s\S]*"filler"[\s\S]*"primer"[\s\S]*"clearcoat"[\s\S]*"neutral"/,
  );
  assert.match(motion, /export function shouldRenderProductHeroSpray/);
  assert.match(
    motion,
    /return productType === "spray" \|\| productType === "color"/,
  );
  assert.match(gallery, /const hasSprayBackdrop = useMemo/);
  assert.match(
    gallery,
    /\{hasSprayBackdrop \? <ProductHeroSprayBackdrop \/> : null\}/,
  );
  assert.match(gallery, /data-product-stage-type=\{visualPreset\.productType\}/);
  assert.match(gallery, /data-product-stage-spray=\{hasSprayBackdrop \? "true" : "false"\}/);
  assert.match(cosmosData, /function getCosmosProductVisualType/);
  assert.match(cosmosData, /record\.technicalCategory === "primer"/);
  assert.match(cosmosData, /return "primer"/);
  assert.match(cosmosData, /cosmosColorCategories\.has\(record\.technicalCategory\)/);
  assert.match(cosmosData, /return "color"/);
  assert.match(
    detailStyles,
    /\.stickyStage\s*\{[\s\S]*--product-stage-image-scale:\s*0\.94/,
  );
  assert.match(
    detailStyles,
    /\.stickyStage\[data-product-stage-spray="true"\][\s\S]*--product-stage-image-scale:\s*0\.92[\s\S]*--product-stage-spray-scale:\s*1\.12/,
  );
  assert.match(
    detailStyles,
    /\.heroProductObject\s*\{[\s\S]*--product-hero-image-scale:\s*var\(--product-stage-image-scale\)[\s\S]*z-index:\s*3[\s\S]*transform:\s*translate3d/,
  );
  assert.match(
    detailStyles,
    /\.heroProductImage\s*\{[\s\S]*transform:\s*scale\(var\(--product-hero-image-scale\)\)[\s\S]*transform-origin:\s*center center/,
  );
  assert.match(
    detailStyles,
    /@media \(max-width: 1023px\)[\s\S]*\.stickyStage\s*\{[\s\S]*--product-stage-image-scale:\s*1/,
  );
  assert.equal(gallery.match(/<ProductHeroSprayBackdrop\b/g)?.length ?? 0, 1);
  assert.doesNotMatch(relatedProducts, /ProductHeroSprayBackdrop|data-product-hero-spray/);
  assert.doesNotMatch(catalogCard, /ProductHeroSprayBackdrop|data-product-hero-spray/);
});
