import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
import postcss from "postcss";

const require = createRequire(import.meta.url);
const legacyBrowserFallbacks = require("./legacy-browser-fallbacks.cjs");

async function run(css, from = "fixture.module.css") {
  const result = await postcss([legacyBrowserFallbacks]).process(css, { from });
  return result.css;
}

test("oklch u običnom svojstvu dobija hex rezervu ispred originala", async () => {
  const css = await run(".a { color: oklch(0.5 0.1 20); }");
  assert.match(css, /color: #[0-9a-f]{6};\s*color: oklch\(0\.5 0\.1 20\)/);
});

test("promenljiva dobija hex, a original ide u @supports kopiju istog selektora", async () => {
  const css = await run(":global(html.dark) .panel[data-x=\"y\"] { --surface: oklch(0.145 0.008 255); }");
  assert.match(css, /:global\(html\.dark\) \.panel\[data-x="y"\] \{ --surface: #[0-9a-f]{6}; \}/);
  assert.match(
    css,
    /@supports \(color: oklch\(0% 0 0\)\) and \(color: color-mix\(in srgb, red, red\)\)\s*\{\s*:global\(html\.dark\) \.panel\[data-x="y"\] \{ --surface: oklch\(0\.145 0\.008 255\); \}\s*\}/,
  );
});

test("color-mix sa var(): u pravilu ostaje dominantna boja, original ide u @supports", async () => {
  const css = await run(
    ".cta { background: color-mix(in oklab, var(--accent), black 8%); color: #fff; } .tint { background: color-mix(in oklch, var(--fg), transparent 94%); }",
  );
  // Vrednost sa var() se prihvata pri parsiranju, pa rezerva NE sme da stoji
  // ispred originala u istom pravilu — original bi je pregazio i pao na unset.
  assert.match(css, /\.cta \{ background: var\(--accent\); color: #fff; \}/);
  assert.match(css, /@supports [^{]+\{\s*\.cta \{ background: color-mix\(in oklab, var\(--accent\), black 8%\); \}/);
  assert.match(css, /\.tint \{ background: transparent; \}/);
});

test("border ide u @supports da ga minifikator ne spoji sa rezervom", async () => {
  const css = await run(".a { border: 1px solid color-mix(in oklch, var(--border), transparent 25%); border-radius: 2px; }");
  assert.match(css, /\.a \{ border: 1px solid var\(--border\); border-radius: 2px; \}/);
  assert.match(css, /@supports [^{]+\{\s*\.a \{ border: 1px solid color-mix/);
});

test("kasnije deklaracije iste porodice idu u kopiju posle originala (redosled ostaje isti)", async () => {
  const css = await run(".a { border: 1px solid oklch(0.5 0 0); border-top-color: red; color: blue; }");
  assert.match(css, /\.a \{ border: 1px solid #[0-9a-f]{6}; border-top-color: red; color: blue; \}/);
  assert.match(css, /@supports [^{]+\{\s*\.a \{ border: 1px solid oklch\(0\.5 0 0\); border-top-color: red; \}/);
});

test("mask-image dobija -webkit- par; postojeća rezerva i @supports blokovi se ne diraju", async () => {
  const css = await run(
    ".m { mask-image: linear-gradient(red, transparent); } .f { color: #fff; color: oklch(0.9 0 0); } @supports (color: color-mix(in lab, red, red)) { .t { color: color-mix(in oklab, var(--a) 50%, transparent); } }",
  );
  assert.match(css, /-webkit-mask-image: linear-gradient\(red, transparent\);\s*mask-image/);
  assert.equal((css.match(/color: #fff/g) || []).length, 1);
  assert.doesNotMatch(css, /\.t \{ color: var/);
});

test("fajl bez modernih boja ostaje netaknut", async () => {
  const source = ".a { color: #111; composes: b from \"./c.css\"; }\n:global(.x) .y { margin: 0; }";
  assert.equal(await run(source), source);
});

test("border sa autorovom rezervom: rezerva ostaje u pravilu, original ide u @supports (minifikator ih inače spaja)", async () => {
  const css = await run(".b { border: 1px solid var(--line); border-left: 4px solid #d79628; border-left: 4px solid oklch(0.72 0.14 75); border-radius: 8px; }");
  assert.match(css, /\.b \{ border: 1px solid var\(--line\); border-left: 4px solid #d79628; border-radius: 8px; \}/);
  assert.match(css, /@supports [^{]+\{\s*\.b \{ border-left: 4px solid oklch\(0\.72 0\.14 75\); border-radius: 8px; \}/);
});
