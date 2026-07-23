import assert from "node:assert/strict";
import test from "node:test";
import {
  BOTTOM_REVEAL_PROBABILITY,
  createRevealDirectionBag,
  createRevealDirectionSelector,
  getRevealDirection,
} from "./productRevealDirection.mjs";

test("reveal probability boundary stays exactly at 24 percent", () => {
  assert.equal(BOTTOM_REVEAL_PROBABILITY, 0.24);
  assert.equal(getRevealDirection(0), "bottom");
  assert.equal(getRevealDirection(0.239999), "bottom");
  assert.equal(getRevealDirection(0.24), "top");
  assert.equal(getRevealDirection(1), "top");
});

test("shuffle bag contains six bottom and nineteen top entries", () => {
  const bag = createRevealDirectionBag(() => 0.5);

  assert.equal(bag.length, 25);
  assert.equal(bag.filter((direction) => direction === "bottom").length, 6);
  assert.equal(bag.filter((direction) => direction === "top").length, 19);
});

test("same product bottom cooldown lasts for two new activations", () => {
  const selector = createRevealDirectionSelector({
    bagFactory: () => Array.from({ length: 25 }, () => "bottom"),
  });

  assert.equal(selector.next("product-a"), "bottom");
  assert.equal(selector.next("product-a"), "top");
  assert.equal(selector.next("product-a"), "top");
  assert.equal(selector.next("product-a"), "bottom");
});

test("global selector prevents a third consecutive bottom reveal", () => {
  const selector = createRevealDirectionSelector({
    bagFactory: () => Array.from({ length: 25 }, () => "bottom"),
  });

  assert.equal(selector.next("product-a"), "bottom");
  assert.equal(selector.next("product-b"), "bottom");
  assert.equal(selector.next("product-c"), "top");
  assert.equal(selector.next("product-d"), "bottom");
});
