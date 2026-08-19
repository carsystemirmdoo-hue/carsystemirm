/**
 * Kadar takeovera: završno stanje mora biti terminalno i puno.
 *
 * Regresija koju ovi testovi hvataju je konkretna: prozor `outro`
 * ([0.80, 0.96]) je posle odigrane animacije gasio potez
 * (`--hero-global-opacity` → 0), obarao tekst na 0.55 i podlogu na 0.22, pa se
 * scena "sama zatamnjivala" dok korisnik nastavlja kroz sekciju.
 *
 * Prozori se čitaju iz `paintTakeoverMotionConfig.ts` — jedinog izvora
 * tajminga — pa test vozi stvarne brojeve kroz stvarni resolver.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  clamp,
  easeBrushStroke,
  mapProgress,
  resolveTakeoverScene,
  toTimeline,
} from "./paintTakeoverScene.mjs";

const configUrl = new URL("./paintTakeoverMotionConfig.ts", import.meta.url);

function windowFor(source, name) {
  const match = source.match(
    new RegExp(`${name}: \\[\\s*([0-9.]+),\\s*([0-9.]+)\\s*\\]`),
  );
  assert.ok(match, `prozor ${name} nije pronađen u konfiguraciji`);
  return [Number(match[1]), Number(match[2])];
}

async function readWindows() {
  const source = await readFile(configUrl, "utf8");
  return {
    source,
    windows: {
      surface: windowFor(source, "surface"),
      background: windowFor(source, "background"),
      content: windowFor(source, "content"),
      contentMobile: windowFor(source, "contentMobile"),
      contrast: windowFor(source, "contrast"),
      chapter: windowFor(source, "chapter"),
      strokes: windowFor(source, "strokes"),
      hold: windowFor(source, "hold"),
    },
  };
}

/** Vrednosti koje smeju samo da rastu kroz timeline — nikad da se povuku. */
const MONOTONIC_KEYS = [
  "surface",
  "backgroundOpacity",
  "contentOpacity",
  "heroOpacity",
  "lineworkProgress",
  "colorWashOpacity",
];

test("timeline je monoton i završava se na 1", () => {
  // `maxProgress` u hook-u je monoton: jednom dostignuto stanje se ne vraća.
  let maxProgress = 0;
  const values = [];
  for (const raw of [0, 0.2, 0.6, 0.9, 1, 0.7, 0.95, 1, 0.4]) {
    maxProgress = Math.max(maxProgress, raw);
    values.push(toTimeline(1, maxProgress, 0.645));
  }

  for (let index = 1; index < values.length; index += 1) {
    assert.ok(
      values[index] >= values[index - 1] - 1e-9,
      `timeline se vratio unazad: ${values[index - 1]} → ${values[index]}`,
    );
  }
  assert.equal(values.at(-1), 1);
});

test("završno stanje je puno: potezi, tekst i podloga ostaju vidljivi", async () => {
  const { windows } = await readWindows();
  const scene = resolveTakeoverScene({ timeline: 1, windows });

  assert.equal(scene.heroOpacity, 1, "potezi moraju ostati vidljivi na kraju");
  assert.equal(scene.contentOpacity, 1, "tekst ne sme da bledi na kraju");
  assert.equal(scene.backgroundOpacity, 1, "podloga ne sme da tamni na kraju");
  assert.equal(scene.lineworkProgress, 1, "sve linije moraju biti dovučene");
  assert.equal(scene.colorWashOpacity, 1);
  assert.ok(scene.contrastOpacity > 0.9);
});

test("nema exit faze: nijedan sloj ne opada posle vrhunca", async () => {
  const { windows } = await readWindows();

  let previous = resolveTakeoverScene({ timeline: 0, windows });
  for (let step = 1; step <= 400; step += 1) {
    const timeline = step / 400;
    const scene = resolveTakeoverScene({ timeline, windows });

    for (const key of MONOTONIC_KEYS) {
      assert.ok(
        scene[key] >= previous[key] - 1e-9,
        `${key} opada na timeline ${timeline.toFixed(3)}: ${previous[key]} → ${scene[key]}`,
      );
    }
    previous = scene;
  }
});

test("linije koje su dovučene ostaju dovučene do kraja sekcije", async () => {
  const { windows } = await readWindows();
  // Poslednji potez se zatvara na kraju `strokes` prozora; posle toga svaki
  // dalji timeline mora da ga drži na 1.
  const afterStrokes = [windows.strokes[1], 0.9, 0.96, 0.99, 1];
  for (const timeline of afterStrokes) {
    const scene = resolveTakeoverScene({ timeline, windows });
    const lastLine = easeBrushStroke(
      clamp((scene.lineworkProgress - 0.52) / (0.86 - 0.52)),
    );
    assert.ok(
      lastLine > 0.999,
      `poslednji potez nije pun na timeline ${timeline}: ${lastLine}`,
    );
    assert.equal(scene.heroOpacity, 1);
  }
});

test("konfiguracija više ne sme da nosi outro prozor", async () => {
  const { source } = await readWindows();
  assert.doesNotMatch(
    source,
    /^\s*outro:/m,
    "outro prozor je vraćen u TIMELINE — to je bila exit faza koja gasi scenu",
  );
});

test("reduced motion odmah daje kompletno završno stanje", async () => {
  const { windows } = await readWindows();

  for (const timeline of [0, 0.25, 0.5, 1]) {
    const scene = resolveTakeoverScene({
      timeline,
      windows,
      reducedMotion: true,
    });
    assert.equal(scene.surface, 1, "wipe mora biti završen");
    assert.equal(scene.backgroundOpacity, 1);
    assert.equal(scene.contentOpacity, 1);
    assert.equal(scene.heroOpacity, 1);
    assert.equal(scene.lineworkProgress, 1, "sve linije moraju biti vidljive");
    assert.equal(scene.colorWashOpacity, 1);
    assert.equal(scene.holdDrift, 0, "bez drifta u reduced-motion režimu");
    assert.equal(scene.backgroundXVw, 0);
    assert.equal(scene.backgroundYPx, 0);
  }
});

test("mobilni prozor teksta počinje ranije, ali se takođe završava na 1", async () => {
  const { windows } = await readWindows();
  const midpoint = windows.contentMobile[0] + 0.02;

  const mobile = resolveTakeoverScene({ timeline: midpoint, windows, mobile: true });
  const desktop = resolveTakeoverScene({ timeline: midpoint, windows });
  assert.ok(mobile.contentOpacity > desktop.contentOpacity);

  assert.equal(
    resolveTakeoverScene({ timeline: 1, windows, mobile: true }).contentOpacity,
    1,
  );
});

test("washDisabled gasi samo wash i kontrast, ne i scenu", async () => {
  const { windows } = await readWindows();
  const scene = resolveTakeoverScene({ timeline: 1, windows, washDisabled: true });

  assert.equal(scene.colorWashOpacity, 0);
  assert.equal(scene.contrastOpacity, 0);
  assert.equal(scene.heroOpacity, 1);
  assert.equal(scene.contentOpacity, 1);
});

test("mapProgress je smoothstep na normalizovanom prozoru", () => {
  assert.equal(mapProgress(0, 0.2, 0.8), 0);
  assert.equal(mapProgress(1, 0.2, 0.8), 1);
  assert.ok(Math.abs(mapProgress(0.5, 0.2, 0.8) - 0.5) < 1e-9);
});
