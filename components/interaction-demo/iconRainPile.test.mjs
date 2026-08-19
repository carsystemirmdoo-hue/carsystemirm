import assert from "node:assert/strict";
import test from "node:test";
import {
  RAIN_TIMING,
  RAIN_VARIANTS,
  buildPileSlots,
  createRandom,
  planIconRain,
  totalDuration,
} from "./iconRainPile.mjs";

const GLYPHS = ["disc", "spray-can", "spatula", "droplet"];

const plan = (variant, seed = 12345) =>
  planIconRain({ seed, variant, glyphIds: GLYPHS });

test("the plan is deterministic — the same seed always gives the same scene", () => {
  // This is the whole reason the geometry lives in a pure module: the server
  // and the browser render the same markup, so there is nothing to reconcile.
  for (const variant of Object.keys(RAIN_VARIANTS)) {
    assert.deepEqual(plan(variant, 987654), plan(variant, 987654));
  }
});

test("different seeds give different scenes", () => {
  assert.notDeepEqual(plan("precise", 1), plan("precise", 2));
});

test("every variant uses 24–40 glyphs, as the animation budget requires", () => {
  for (const [name, variant] of Object.entries(RAIN_VARIANTS)) {
    assert.ok(
      variant.count >= 24 && variant.count <= 40,
      `${name} plans ${variant.count} glyphs`,
    );
    assert.equal(plan(name).length, variant.count);
  }
});

test("the whole sequence fits the 700–1100 ms budget", () => {
  assert.ok(totalDuration() >= 700 && totalDuration() <= 1100, `${totalDuration()}ms`);

  for (const name of Object.keys(RAIN_VARIANTS)) {
    for (const glyph of plan(name)) {
      assert.ok(
        glyph.delay + glyph.duration <= 1100,
        `${name}: glyph finishes at ${glyph.delay + glyph.duration}ms`,
      );
      assert.ok(glyph.delay >= 0 && glyph.delay <= RAIN_TIMING.maxStagger);
    }
  }
});

test("glyphs are released above the frame and come to rest inside it", () => {
  for (const name of Object.keys(RAIN_VARIANTS)) {
    for (const glyph of plan(name)) {
      assert.ok(glyph.release.y < 0, `${name}: released at y=${glyph.release.y}`);
      assert.ok(
        glyph.rest.y > 60 && glyph.rest.y < 100,
        `${name}: rests at y=${glyph.rest.y}`,
      );
      assert.ok(
        glyph.rest.x > -12 && glyph.rest.x < 112,
        `${name}: rests at x=${glyph.rest.x}`,
      );
    }
  }
});

test("the path really moves: release, contact, bounce and rest are distinct", () => {
  for (const name of Object.keys(RAIN_VARIANTS)) {
    for (const glyph of plan(name)) {
      // A fall of at least 60 units, then a contact that overshoots the resting
      // line and a rebound above it — this is what separates an animation from
      // two static frames.
      assert.ok(glyph.contact.y - glyph.release.y > 60, `${name}: fall too short`);
      assert.ok(
        glyph.contact.y > glyph.rest.y,
        `${name}: contact ${glyph.contact.y} does not overshoot rest ${glyph.rest.y}`,
      );
      assert.ok(
        glyph.bounce.y < glyph.rest.y,
        `${name}: bounce ${glyph.bounce.y} does not rebound above rest ${glyph.rest.y}`,
      );
    }
  }
});

test("the pile fills from the floor up and narrows as it rises", () => {
  const variant = RAIN_VARIANTS.precise;
  const slots = buildPileSlots(variant, 88);
  assert.equal(slots.length, variant.count);
  assert.equal(slots[0].row, 0);
  assert.ok(slots[0].y >= slots[slots.length - 1].y, "later slots must sit higher");

  const perRow = new Map();
  for (const slot of slots) perRow.set(slot.row, (perRow.get(slot.row) ?? 0) + 1);
  const rows = [...perRow.keys()].sort((a, b) => a - b);
  for (let index = 1; index < rows.length; index += 1) {
    assert.ok(
      perRow.get(rows[index]) <= perRow.get(rows[index - 1]),
      "a row cannot be wider than the row below it",
    );
  }
});

test("bottom rows are released first — nothing lands on a piece that has not arrived", () => {
  for (const name of Object.keys(RAIN_VARIANTS)) {
    const glyphs = plan(name);
    // Rest heights must trend upward across the release order.
    const firstThird = glyphs.slice(0, Math.floor(glyphs.length / 3));
    const lastThird = glyphs.slice(-Math.floor(glyphs.length / 3));
    const mean = (list) => list.reduce((sum, g) => sum + g.rest.y, 0) / list.length;
    assert.ok(
      mean(firstThird) > mean(lastThird),
      `${name}: early glyphs (${mean(firstThird)}) should rest lower than late ones (${mean(lastThird)})`,
    );
  }
});

test("only the spill variant leaves pieces outside the heap", () => {
  assert.equal(plan("precise").filter((glyph) => glyph.stray).length, 0);
  assert.equal(plan("cascade").filter((glyph) => glyph.stray).length, 0);
  assert.equal(
    plan("spill").filter((glyph) => glyph.stray).length,
    RAIN_VARIANTS.spill.strays,
  );
});

test("the cascade variant releases through discrete columns", () => {
  const columns = new Set(plan("cascade").map((glyph) => Math.round(glyph.release.x / 6)));
  assert.ok(
    columns.size <= RAIN_VARIANTS.cascade.columns + 2,
    `expected a handful of release bands, saw ${columns.size}`,
  );
});

test("glyphs are drawn only from the set the caller passed in", () => {
  for (const name of Object.keys(RAIN_VARIANTS)) {
    for (const glyph of plan(name)) {
      assert.ok(GLYPHS.includes(glyph.glyphId));
    }
  }
});

test("createRandom stays in [0, 1)", () => {
  const random = createRandom(42);
  for (let index = 0; index < 500; index += 1) {
    const value = random();
    assert.ok(value >= 0 && value < 1);
  }
});
