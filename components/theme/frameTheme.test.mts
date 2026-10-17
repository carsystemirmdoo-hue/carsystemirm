import assert from "node:assert/strict";
import test from "node:test";
import { resolveFrameTheme } from "./frameTheme";

test("fiksna tamna sekcija menja okvir samo u svetloj temi", () => {
  assert.equal(resolveFrameTheme("dark", "light"), "dark");
  assert.equal(resolveFrameTheme("dark", "dark"), null);
});

test("inverzna sekcija je uvek suprotna izboru korisnika", () => {
  assert.equal(resolveFrameTheme("inverse", "light"), "dark");
  assert.equal(resolveFrameTheme("inverse", "dark"), "light");
});

test("bez aktivne sekcije nema privremene teme", () => {
  assert.equal(resolveFrameTheme(undefined, "light"), null);
  assert.equal(resolveFrameTheme(null, "dark"), null);
});
