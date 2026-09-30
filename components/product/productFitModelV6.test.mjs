/**
 * V6A (fit po subjektu) + V6B (tačno jedna senka) — regresioni ugovor.
 *
 * Testovi čitaju STVARNE artefakte (generisani manifest, generisani CSS, ručno
 * pisani CSS) i stvarni modul sa pravilom aktivacije. Ništa se ne rekonstruiše.
 *
 * Pokreće se sa: npm run test:product-motion
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  OFFICIAL_SHADOW_VALUES,
  V6_FIT_EXCLUDED_SLUGS,
  isSaneSubjectMetrics,
  resolveOfficialShadowV6,
} from "../../lib/productFitModel.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (relative) => readFileSync(path.join(ROOT, relative), "utf8");

const manifest = JSON.parse(read("data/product-image-metrics.generated.json")).images;
const fitCss = read("components/product/ProductImageFit.generated.module.css");
const surfaceCss = read("components/product/ProductVisualSurface.module.css");
const pdpCss = read("components/product/ProductDetailExperience.module.css");

const V6_KEYS = ["fitModelVersion", "subjectBox", "subjectAspect", "subjectCenter", "officialShadow"];
/**
 * Carsystem originali + njihovi pregledani derivati za prikaz (`public/remastered`,
 * tamna tema): površine crtaju derivat, pa se i V6 meri na njemu.
 */
const CARSYSTEM_PREFIXES = ["/products/carsystem/", "/remastered/products/carsystem/"];
const isCarsystem = (href) => CARSYSTEM_PREFIXES.some((prefix) => href.startsWith(prefix));
const entries = Object.entries(manifest);
const carsystem = entries.filter(([href]) => isCarsystem(href));
const others = entries.filter(([href]) => !isCarsystem(href));
const withSubject = carsystem.filter(([, m]) => m.subjectBox);

/** Isti format broja kao `number()` u generatoru. */
const num = (value) => value.toFixed(4).replace(/0+$/, "").replace(/\.$/, "") || "0";
const near = (actual, expected, message) =>
  assert.ok(Math.abs(actual - expected) <= 1.0001e-4, `${message}: ${actual} vs ${expected}`);

/** Telo prvog pravila čiji selektor SADRŽI sve tražene fragmente. */
function ruleBodies(css, fragments) {
  const bodies = [];
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = match[1].replace(/\/\*[\s\S]*?\*\//g, "").trim();
    if (fragments.every((fragment) => selector.includes(fragment))) bodies.push({ selector, body: match[2] });
  }
  return bodies;
}

const V6_CSS_MARKER = "V6 subject fit - Carsystem only";
const legacyCss = fitCss.split(V6_CSS_MARKER)[0];
const v6Css = fitCss.includes(V6_CSS_MARKER) ? fitCss.slice(fitCss.indexOf(V6_CSS_MARKER)) : "";

test("1. drugi brendovi: nijedno V6 polje u manifestu i nijedno V6 pravilo u CSS-u", () => {
  assert.ok(others.length > 500, "manifest mora sadržati i druge brendove");
  for (const [href, metrics] of others) {
    for (const key of V6_KEYS) assert.equal(key in metrics, false, `${href} ne sme imati ${key}`);
  }
  for (const match of v6Css.matchAll(/data-product-fit="([^"]+)"/g)) {
    assert.ok(isCarsystem(match[1]), `V6 pravilo van Carsystem-a: ${match[1]}`);
  }
});

test("1b. legacy blok CSS-a je čista funkcija legacy polja (zato ostaje bajt-identičan)", () => {
  const expected = entries
    .map(
      ([href, m]) =>
        `\n.fit[data-product-fit="${href}"] {\n` +
        `  --product-canvas-aspect: ${num(m.w / m.h)};\n` +
        `  --product-content-aspect: ${num(m.aspect)};\n` +
        `  --product-content-fill-x: ${num(m.fx)};\n` +
        `  --product-content-fill-y: ${num(m.fy)};\n` +
        `  --product-content-offset-x: ${num(m.ox)};\n` +
        `  --product-content-offset-y: ${num(m.oy)};\n}\n`,
    )
    .join("");
  const start = legacyCss.indexOf('\n.fit[data-product-fit="');
  const end = legacyCss.lastIndexOf("}\n") + 2;
  // `--product-image-dark-*` (samo neprovidni fajlovi) je prezentacija tamne teme
  // (`dark_matte` u generatoru); V6 je ne čita i ne menja.
  const legacyOnly = legacyCss
    .slice(start, end)
    .split("\n")
    .filter((line) => !line.startsWith("  --product-image-dark-"))
    .join("\n");
  assert.equal(legacyOnly, expected);
});

test("2. postojeći box / aspect / fx / fy / ox / oy su i dalje izvedeni iz ISTOG legacy boxa", () => {
  for (const [href, m] of entries) {
    const [x, y, w, h] = m.box;
    // Python i JS zaokružuju polovine različito, pa se poredi na 4. decimali ± 1.
    near(m.fx, w / m.w, `${href} fx`);
    near(m.fy, h / m.h, `${href} fy`);
    near(m.ox, x / m.w, `${href} ox`);
    near(m.oy, y / m.h, `${href} oy`);
    near(m.aspect, h ? w / h : 1, `${href} aspect`);
  }
});

test("3. samo Carsystem dobija nova polja; svako je potpuno i unutar legacy boxa", () => {
  assert.ok(withSubject.length > 400, `očekivano >400 Carsystem slika sa subjectBox, dobijeno ${withSubject.length}`);
  for (const [href, m] of withSubject) {
    assert.equal(m.boxSource, "alpha", `${href}: V6 samo za alfa-izveden box`);
    assert.equal(isSaneSubjectMetrics(m), true, `${href}: metrika mora proći sanity`);
    assert.ok(OFFICIAL_SHADOW_VALUES.includes(m.officialShadow), `${href}: officialShadow`);
  }
  // Neprovidni fajlovi (JPG galerija, glass-fibre-fleece) ostaju na legacy fitu.
  for (const [href, m] of carsystem.filter(([, metrics]) => metrics.boxSource !== "alpha")) {
    assert.equal("subjectBox" in m, false, `${href}: neprovidan fajl ne sme dobiti subjectBox`);
  }
  assert.equal(
    manifest["/products/carsystem/catalog/carsystem-glass-fibre-reinforced-putty.webp"].officialShadow,
    "unknown",
  );
});

test("3b. V6 CSS pravilo postoji tačno tamo gde se subjectBox razlikuje od legacy boxa", () => {
  const ruled = new Set([...v6Css.matchAll(/data-product-fit="([^"]+)"\]\[data-product-fit-model="v6"\]/g)].map((m) => m[1]));
  // Isti prag kao SUBJECT_RULE_MIN_DELTA u generatoru: ispod 0,5 % platna dva fita su vizuelno ista.
  const delta = (m) =>
    Math.max(
      Math.abs(m.subjectBox[0] - m.box[0]) / m.w,
      Math.abs(m.subjectBox[2] - m.box[2]) / m.w,
      Math.abs(m.subjectBox[1] - m.box[1]) / m.h,
      Math.abs(m.subjectBox[3] - m.box[3]) / m.h,
    );
  const expected = withSubject.filter(([, m]) => delta(m) > 0.005).map(([href]) => href);
  assert.ok(expected.length > 100 && expected.length < 200, `neočekivan broj V6 pravila: ${expected.length}`);
  assert.deepEqual([...ruled].sort(), expected.sort());
  for (const href of expected) {
    const m = manifest[href];
    const [x, y, w, h] = m.subjectBox;
    const [{ body }] = ruleBodies(v6Css, [`data-product-fit="${href}"`]);
    const value = (property) => Number(new RegExp(`${property}: ([0-9.]+);`).exec(body)[1]);
    near(value("--product-content-aspect"), w / h, `${href} aspect`);
    near(value("--product-content-fill-x"), w / m.w, `${href} fill-x`);
    near(value("--product-content-fill-y"), h / m.h, `${href} fill-y`);
    near(value("--product-content-offset-x"), x / m.w, `${href} offset-x`);
    near(value("--product-content-offset-y"), y / m.h, `${href} offset-y`);
    assert.equal(body.includes("--product-canvas-aspect"), false, `${href}: platno se ne menja`);
  }
});

test("4. lista izuzetaka: tri sluga ostaju legacy iako im je metrika ispravna", () => {
  assert.deepEqual([...V6_FIT_EXCLUDED_SLUGS].sort(), [
    "carsystem-h2o-cleaner",
    "carsystem-multi-flow",
    "carsystem-paint-system-cps-3-0",
  ]);
  for (const slug of V6_FIT_EXCLUDED_SLUGS) {
    const metrics = manifest[`/products/carsystem/catalog/${slug}.webp`];
    assert.equal(isSaneSubjectMetrics(metrics), true, `${slug}: metrika postoji i ispravna je`);
    assert.equal(resolveOfficialShadowV6({ slug, brandSlug: "carsystem" }, metrics), null);
  }
  const sample = manifest["/products/carsystem/catalog/carsystem-anti-rust-putty.webp"];
  assert.equal(resolveOfficialShadowV6({ slug: "carsystem-anti-rust-putty", brandSlug: "carsystem" }, sample), "strong");
  assert.equal(resolveOfficialShadowV6({ slug: "carsystem-anti-rust-putty", brandSlug: "rm" }, sample), null, "drugi brend");
});

test("9. nevažeća metrika → fallback na legacy (null)", () => {
  const good = manifest["/products/carsystem/catalog/carsystem-anti-rust-putty.webp"];
  const product = { slug: "carsystem-anti-rust-putty", brandSlug: "carsystem" };
  const broken = [
    null,
    {},
    { ...good, fitModelVersion: 2 },
    { ...good, officialShadow: "maybe" },
    { ...good, subjectBox: undefined },
    { ...good, subjectBox: [0, 0, 4, 4] },
    { ...good, subjectBox: [good.box[0] - 5, good.box[1], good.subjectBox[2], good.subjectBox[3]] },
    { ...good, subjectBox: [good.subjectBox[0], good.subjectBox[1], Number.NaN, good.subjectBox[3]] },
    { ...good, subjectBox: [good.box[0], good.box[1], Math.round(good.box[2] / 3), Math.round(good.box[3] / 3)] },
    { ...good, subjectAspect: good.subjectAspect * 2 },
  ];
  for (const metrics of broken) assert.equal(resolveOfficialShadowV6(product, metrics), null);
  assert.equal(resolveOfficialShadowV6(product, good), "strong");
});

/* ---------------- V6B: broj i boja CSS senki ---------------- */

const V6 = '[data-product-shadow-model="v6"]';
const declaration = (body, property) => new RegExp(`(?:^|;|\\n)\\s*${property}\\s*:\\s*([^;]+);`).exec(body)?.[1].trim();
const oklchLightness = (value) => [...value.matchAll(/oklch\(\s*([0-9.]+)/g)].map((m) => Number(m[1]));

function cardShadowLayers(officialShadow) {
  const image = ruleBodies(surfaceCss, [`.surface${V6}`, ".productImage"]);
  assert.equal(image.length, 1);
  assert.equal(declaration(image[0].body, "filter"), "none", "V6: slika nema drop-shadow");
  const contact = ruleBodies(surfaceCss, [`.surface${V6}`, ".contactShadow"]);
  const base = contact.find((rule) => !rule.selector.includes("data-product-official-shadow") && !rule.selector.includes("data-product-size-class"));
  const specific = contact.filter((rule) => rule.selector.includes(`data-product-official-shadow="${officialShadow}"`));
  const merged = [base, ...specific].map((rule) => rule.body).join("\n");
  const hidden = specific.some((rule) => declaration(rule.body, "display") === "none");
  const opacity = Number([...merged.matchAll(/opacity\s*:\s*([0-9.]+)/g)].pop()[1]);
  return { layers: hidden ? 0 : 1, opacity, base: base.body };
}

test("5. strong → 0 CSS senki na kartici i na PDP-u", () => {
  assert.equal(cardShadowLayers("strong").layers, 0);
  const pdp = ruleBodies(pdpCss, [`.stage${V6}`, 'data-product-official-shadow="strong"', ".heroProductImage"]);
  assert.equal(pdp.length, 1);
  assert.equal(declaration(pdp[0].body, "filter"), "none");
  assert.ok(pdp[0].selector.includes(":global(.dark)"), "strong gasi senku i u tamnoj temi");
});

test("6. none → tačno 1 CSS senka", () => {
  const card = cardShadowLayers("none");
  assert.equal(card.layers, 1);
  assert.equal(card.opacity, 0.55);
  // PDP: za `none` NEMA V6 pravila — ostaje zatečena jedna tamna senka.
  assert.equal(ruleBodies(pdpCss, [`.stage${V6}`, 'data-product-official-shadow="none"']).length, 0);
});

test("7. thin / unknown → tačno 1 SLABIJA CSS senka", () => {
  for (const kind of ["thin", "unknown"]) {
    const card = cardShadowLayers(kind);
    assert.equal(card.layers, 1, kind);
    assert.ok(card.opacity < cardShadowLayers("none").opacity, `${kind}: slabija od none`);
    const pdp = ruleBodies(pdpCss, [`.stage${V6}`, `data-product-official-shadow="${kind}"`, ".heroProductImage"]);
    assert.equal(pdp.length, 2, `${kind}: light + dark pravilo`);
    for (const rule of pdp) {
      const offset = [...rule.body.matchAll(/drop-shadow\(0 18px 2[46]px oklch\([^)]*\/\s*([0-9.]+)\)\)/g)];
      assert.equal(offset.length, 1, `${kind}: tačno jedna pomerena senka`);
      // Tamna tema: zatečena senka je `--dk-shadow-color` (alfa 0.62), bez svetlog obrisa.
      assert.equal(/drop-shadow\(0 0 1px/.test(rule.body), false, `${kind}: bez svetlog obrisa`);
      const legacyAlpha = rule.selector.includes(":global(.dark)") ? 0.62 : 0.24;
      assert.ok(Number(offset[0][1]) < legacyAlpha, `${kind}: slabija od zatečene`);
    }
  }
});

test("8. tamna tema nikad ne daje SVETLU CSS senku u V6 modelu", () => {
  const { base } = cardShadowLayers("none");
  const background = declaration(base, "background");
  assert.equal(background.includes("--foreground"), false, "V6 senka ne sme čitati --foreground");
  assert.equal(background.includes("var("), false, "boja senke je literal, ista u obe teme");
  assert.ok(oklchLightness(background).every((lightness) => lightness <= 0.2), background);
  assert.equal(ruleBodies(surfaceCss, [":global(.dark)", V6]).length, 0, "nema posebne (svetlije) V6 boje za tamnu temu");
  for (const rule of ruleBodies(pdpCss, [`.stage${V6}`, ".heroProductImage"])) {
    for (const match of rule.body.matchAll(/drop-shadow\(0 18px 2[46]px (oklch\([^)]*\))\)/g)) {
      assert.ok(oklchLightness(match[1])[0] <= 0.2, `${rule.selector}: pomerena senka mora biti tamna`);
    }
  }
});

test("8b. V6 senka je usidrena za dno subjekta, ne za dno površine", () => {
  const { base } = cardShadowLayers("none");
  assert.equal(declaration(base, "bottom"), "auto");
  const top = declaration(base, "top");
  assert.ok(top.includes("--product-fit-w") && top.includes("--product-content-aspect"), top);
  assert.ok(declaration(base, "width").includes("--product-fit-w"));
});

test("8c. lestvica veličina za V6 senku je ista kao lestvica `.objectWrap`", () => {
  for (const size of ["S", "M", "L", "XL"]) {
    const wrap = ruleBodies(surfaceCss, [`data-product-size-class="${size}"`, ".objectWrap"]).find((r) => !r.selector.includes(V6));
    const shadow = ruleBodies(surfaceCss, [V6, `data-product-size-class="${size}"`, ".contactShadow"])[0];
    for (const property of ["--product-envelope-w", "--product-envelope-h"]) {
      assert.equal(declaration(shadow.body, property), declaration(wrap.body, property), `${size} ${property}`);
    }
  }
});

test("V6 senka ne dira sam asset: nema opacity / mix-blend / brightness na slici", () => {
  const [image] = ruleBodies(surfaceCss, [`.surface${V6}`, ".productImage"]);
  assert.deepEqual(image.body.replace(/\s+/g, " ").trim(), "filter: none;");
  for (const rule of ruleBodies(pdpCss, [`.stage${V6}`, ".heroProductImage"])) {
    assert.equal(/opacity|mix-blend-mode|brightness|contrast\(/.test(rule.body), false, rule.selector);
  }
});

test("V6C nije implementiran: nema pool-a, well-a ni gradijenta u V6 pravilima", () => {
  for (const css of [surfaceCss, pdpCss]) {
    for (const rule of ruleBodies(css, [V6])) {
      assert.equal(/gradient|stagePlate|background-image/.test(rule.selector + rule.body), false, rule.selector);
    }
  }
});

/* ---------------- PDP format i clipping ---------------- */

test("10. format PDP stage-a i dalje čita legacy `aspect`", () => {
  const source = read("components/product/productStageImages.ts");
  const resolver = source.slice(source.indexOf("export function resolveStageFormat"), source.indexOf("const PLACEHOLDER_MARKER"));
  assert.ok(resolver.includes("metrics.aspect"));
  assert.equal(/subject/i.test(resolver), false, "format ne sme zavisiti od subject polja");
});

test("11. subjekt nikad nije odsečen ni na kartici ni na PDP-u, ni za jednu klasu veličine", () => {
  const card = { aspect: 1.1, optical: 0.49, env: { S: [0.58, 0.72], M: [0.66, 0.78], L: [0.74, 0.84], XL: [0.82, 0.9] } };
  const pdpEnv = { S: [0.58, 0.74], M: [0.66, 0.8], L: [0.74, 0.86], XL: [0.82, 0.92] };
  const stages = [card, ...[5 / 6, 1, 4 / 3].map((aspect) => ({ aspect, optical: 0.48, env: pdpEnv }))];
  for (const [href, m] of withSubject) {
    const [, , w, h] = m.subjectBox;
    for (const stage of stages) {
      const surfaceH = 1 / stage.aspect;
      for (const [envW, envH] of Object.values(stage.env)) {
        const fitW = Math.min(envW, envH * surfaceH * (w / h));
        const fitH = fitW / (w / h);
        const top = stage.optical * surfaceH - fitH / 2;
        const bottom = stage.optical * surfaceH + fitH / 2;
        assert.ok(fitW <= 1 && top >= 0 && bottom <= surfaceH, `${href} izlazi iz površine`);
      }
    }
  }
});
