import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

/*
 * Stariji pregledači (npr. Chrome 109, poslednji za Windows 7/8.1) ne poznaju
 * oklch() ni color-mix(). Token sa takvom vrednošću postaje nevažeći, pa tekst,
 * pozadine i okviri ostaju bez boje. Svaka oklch vrednost zato ima hex/rgba
 * rezervu: obična deklaracija neposredno ispred, a token (--x) unutar
 * `@supports (color: oklch(0 0 0))`.
 */
const root = new URL("../../", import.meta.url);
const read = (p) => readFile(new URL(p, root), "utf8");
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/@supports \(color: oklch\(0 0 0\)\) \{[\s\S]*?\n\}\n/g, " ");

for (const file of ["app/portal/portal.css", "app/globals.css"]) {
  test(`${file}: oklch samo uz rezervu`, async () => {
    const body = strip(await read(file));
    assert.deepEqual(body.match(/--[\w-]+:\s*oklch[^;]*/g) ?? [], [], "token sa oklch van @supports");
    const missing = [];
    for (const m of body.matchAll(/(?<![\w-])([a-z][a-z-]*)\s*:\s*([^;{}]*oklch\([^;{}]*);/g)) {
      const before = body.slice(Math.max(0, m.index - 400), m.index);
      if (!new RegExp(`${m[1]}\\s*:\\s*[^;{}]*;\\s*$`).test(before)) missing.push(m[0].slice(0, 80));
    }
    assert.deepEqual(missing, []);
  });
}

test("panel.css: bez oklch i color-mix", async () => {
  const css = (await read("app/portal/panel.css")).replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(css, /oklch\(|color-mix\(/);
});
