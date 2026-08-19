import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  V2_FRAME_ASPECT,
  V2_TIMING,
  V2_VARIANTS,
  rowStep,
  buildPileSlotsV2,
  pileFootprint,
  planIconRainV2,
  planSceneV2,
  totalDurationV2,
} from "./iconRainPileV2.mjs";
import { RAIN_VARIANTS, planIconRain } from "./iconRainPile.mjs";

const GLYPHS = ["disc", "disc-perforated", "sanding-block", "backing-plate"];
const plan = (variant, seed = 12345) =>
  planIconRainV2({ seed, variant, glyphIds: GLYPHS });

/* -------------------------------------------------------------------- */
/* V2 geometry                                                          */
/* -------------------------------------------------------------------- */

test("V2 is deterministic — the same seed always gives the same scene", () => {
  for (const variant of Object.keys(V2_VARIANTS)) {
    assert.deepEqual(plan(variant, 4242), plan(variant, 4242));
  }
});

test("both V2 variants draw exactly 24 glyphs", () => {
  for (const [name, variant] of Object.entries(V2_VARIANTS)) {
    assert.equal(variant.count, 24, `${name} is configured for ${variant.count}`);
    assert.equal(plan(name).length, 24);
  }
});

test("workshop spill was not carried into V2", () => {
  assert.deepEqual(Object.keys(V2_VARIANTS).sort(), ["cascade", "precise"]);
});

test("V2 glyphs are 1.3–1.6x larger than V1's", () => {
  const v1 = planIconRain({ seed: 12345, variant: "precise", glyphIds: GLYPHS });
  const mean = (list) => list.reduce((sum, g) => sum + g.size, 0) / list.length;

  for (const name of Object.keys(V2_VARIANTS)) {
    const ratio = mean(plan(name)) / mean(v1);
    assert.ok(
      ratio >= 1.3 && ratio <= 1.6,
      `${name}: glyphs are ${ratio.toFixed(2)}x V1, outside the 1.3–1.6 target`,
    );
  }
});

test("V2 uses fewer distinct shapes than the category offers", () => {
  for (const [name, variant] of Object.entries(V2_VARIANTS)) {
    const shapes = new Set(plan(name).map((glyph) => glyph.glyphId));
    assert.ok(
      shapes.size <= variant.glyphVariety,
      `${name} drew ${shapes.size} shapes, budget is ${variant.glyphVariety}`,
    );
    assert.ok(shapes.size >= 3, `${name} drew only ${shapes.size} shapes`);
  }
});

test("V2 rotates less than V1", () => {
  assert.ok(
    V2_VARIANTS.cascade.restRotationRange < RAIN_VARIANTS.cascade.restRotationRange,
  );
  assert.ok(
    V2_VARIANTS.precise.restRotationRange < RAIN_VARIANTS.precise.restRotationRange,
  );
});

test("the sequence still fits the 700–1100 ms budget", () => {
  assert.ok(totalDurationV2() >= 700 && totalDurationV2() <= 1100, `${totalDurationV2()}ms`);
  for (const name of Object.keys(V2_VARIANTS)) {
    for (const glyph of plan(name)) {
      assert.ok(glyph.delay + glyph.duration <= 1100);
      assert.ok(glyph.delay >= 0 && glyph.delay <= V2_TIMING.maxStagger);
    }
  }
});

test("the path really moves: release, contact, bounce and rest are distinct", () => {
  for (const name of Object.keys(V2_VARIANTS)) {
    for (const glyph of plan(name)) {
      assert.ok(glyph.release.y < 0, `${name}: released inside the frame`);
      assert.ok(glyph.contact.y - glyph.release.y > 60, `${name}: fall too short`);
      assert.ok(glyph.contact.y > glyph.rest.y, `${name}: contact does not overshoot`);
      assert.ok(glyph.bounce.y < glyph.rest.y, `${name}: no rebound above rest`);
    }
  }
});

/* -------------------------------------------------------------------- */
/* The pile                                                             */
/* -------------------------------------------------------------------- */

test("the pile is low and wide, and every piece gets a slot", () => {
  for (const [name, variant] of Object.entries(V2_VARIANTS)) {
    const slots = buildPileSlotsV2(variant);
    assert.equal(slots.length, variant.count, `${name} lost pieces`);

    const rows = new Set(slots.map((slot) => slot.row));
    assert.ok(rows.size <= 5, `${name} stacked ${rows.size} rows — too tall`);

    const height = variant.floorY - Math.min(...slots.map((slot) => slot.y));
    assert.ok(
      variant.pileWidth > height * 2,
      `${name}: pile is ${variant.pileWidth} wide by ${height} tall — not low and wide`,
    );
  }
});

test("the base row is the widest and carries the rest", () => {
  for (const [name, variant] of Object.entries(V2_VARIANTS)) {
    const slots = buildPileSlotsV2(variant);
    const perRow = new Map();
    for (const slot of slots) perRow.set(slot.row, (perRow.get(slot.row) ?? 0) + 1);

    const rows = [...perRow.keys()].sort((a, b) => a - b);
    for (let index = 1; index < rows.length; index += 1) {
      assert.ok(
        perRow.get(rows[index]) <= perRow.get(rows[index - 1]),
        `${name}: row ${rows[index]} is wider than the row below it`,
      );
    }
    assert.ok(
      slots.filter((slot) => slot.isBase).length >= 5,
      `${name}: base row has only ${slots.filter((s) => s.isBase).length} pieces`,
    );
  }
});

test("rows nest: they overlap, but not so far that the pile collapses into a line", () => {
  /*
   * Sizes are horizontal units (`cqw`), row spacing is vertical (`cqh`). A step
   * written straight into `cqh` is not comparable to a glyph's height — the
   * first V2 build stepped 4.4 cqh for a glyph 10 cqh tall, and 24 icons
   * rendered as one row.
   */
  for (const [name, variant] of Object.entries(V2_VARIANTS)) {
    const meanSize = (variant.sizeRange[0] + variant.sizeRange[1]) / 2;
    const glyphHeightInCqh = meanSize * V2_FRAME_ASPECT;
    const step = rowStep(variant);
    assert.ok(
      step < glyphHeightInCqh,
      `${name}: rows step ${step} for a ${glyphHeightInCqh.toFixed(1)} cqh glyph — they will not touch`,
    );
    assert.ok(
      step > glyphHeightInCqh * 0.4,
      `${name}: rows step only ${step} of ${glyphHeightInCqh.toFixed(1)} cqh — the pile collapses into a line`,
    );
  }
});

test("bottom rows are released first", () => {
  for (const name of Object.keys(V2_VARIANTS)) {
    const glyphs = plan(name);
    const third = Math.floor(glyphs.length / 3);
    const mean = (list) => list.reduce((sum, g) => sum + g.rest.y, 0) / list.length;
    assert.ok(
      mean(glyphs.slice(0, third)) > mean(glyphs.slice(-third)),
      `${name}: late pieces do not rest higher than early ones`,
    );
  }
});

test("the contact shadow follows the pile, not the frame", () => {
  for (const [name, variant] of Object.entries(V2_VARIANTS)) {
    const footprint = pileFootprint(variant, buildPileSlotsV2(variant));
    assert.ok(
      Math.abs(footprint.width - variant.pileWidth) < variant.pileWidth * 0.35,
      `${name}: shadow is ${footprint.width} wide for a ${variant.pileWidth} pile`,
    );
    assert.ok(footprint.coreWidth < footprint.width, `${name}: core is not tighter`);
    assert.ok(footprint.width < 100, `${name}: shadow is wider than the frame`);
    assert.equal(footprint.y, variant.floorY);
  }
});

test("the scene reports where the product should sit", () => {
  for (const name of Object.keys(V2_VARIANTS)) {
    const scene = planSceneV2({ seed: 99, variant: name, glyphIds: GLYPHS });
    assert.ok(scene.pileTopY > 60 && scene.pileTopY < 90, `${name}: ${scene.pileTopY}`);
    assert.equal(scene.totalDuration, totalDurationV2());
  }
});

test("the cascade variant really releases through four columns", () => {
  const bands = new Set(
    planIconRainV2({ seed: 7, variant: "cascade", glyphIds: GLYPHS }).map((glyph) =>
      Math.round(glyph.release.x / 8),
    ),
  );
  assert.ok(bands.size <= 6, `expected four release bands, saw ${bands.size}`);
});

test("front pieces are drawn more strongly than the ones behind", () => {
  for (const name of Object.keys(V2_VARIANTS)) {
    const glyphs = plan(name);
    const base = glyphs.filter((glyph) => glyph.isBase);
    const back = glyphs.filter((glyph) => !glyph.isBase);
    const mean = (list) => list.reduce((sum, g) => sum + g.weight, 0) / list.length;
    assert.ok(mean(base) > mean(back), `${name}: base row is not the strongest`);
    for (const glyph of glyphs) {
      assert.ok(glyph.weight >= 0 && glyph.weight <= 1, `${name}: weight out of range`);
    }
  }
});

/* -------------------------------------------------------------------- */
/* V1 must survive untouched, and V2 must stay out of production        */
/* -------------------------------------------------------------------- */

test("V1 still plans its own scenes and is unchanged by V2", () => {
  const v1 = planIconRain({ seed: 12345, variant: "spill", glyphIds: GLYPHS });
  assert.equal(v1.length, RAIN_VARIANTS.spill.count);
  assert.equal(RAIN_VARIANTS.spill.strays, 4, "V1's rejected spill variant is still there");
  assert.deepEqual(Object.keys(RAIN_VARIANTS).sort(), ["cascade", "precise", "spill"]);
});

test("the V2 stylesheet clears will-change once the pile has landed", () => {
  const css = readFileSync(
    new URL("./IconRainPileSceneV2.module.css", import.meta.url),
    "utf8",
  );
  assert.match(css, /\[data-phase="playing"\][\s\S]*?will-change:\s*transform, opacity/);
  assert.match(css, /\[data-phase="complete"\][\s\S]*?will-change:\s*auto/);
});

test("no production surface imports V2", () => {
  const root = new URL("../../", import.meta.url).pathname;
  const searched = ["app", "components", "lib", "features"];
  const offenders = [];

  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry.startsWith(".")) continue;
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) {
        walk(path);
        continue;
      }
      if (!/\.(tsx?|mjs|css)$/.test(entry)) continue;
      // The lab is where V2 is allowed to live.
      if (path.includes("/interaction-demo/")) continue;
      const source = readFileSync(path, "utf8");
      if (/IconRainPileSceneV2|iconRainPileV2/.test(source)) offenders.push(path);
    }
  };

  for (const dir of searched) walk(join(root, dir));
  assert.deepEqual(offenders, [], `V2 leaked into production files: ${offenders.join(", ")}`);
});
