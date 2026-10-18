import assert from "node:assert/strict";
import test from "node:test";
import { getPublicPartnerStores } from "@/lib/partner-stores";
import { distanceKindLabel, formatDistanceKm, rankStoresByDistance } from "@/lib/store-distance";

const beograd = { lat: 44.8125, lng: 20.4612 };

test("sve javne lokacije ostaju u listi, poređane od najbliže", () => {
  const stores = getPublicPartnerStores();
  const ranked = rankStoresByDistance(stores, beograd);
  assert.equal(ranked.length, stores.length);
  assert.equal(new Set(ranked.map((item) => item.store.id)).size, stores.length);
  const distances = ranked.map((item) => item.distanceKm).filter((km): km is number => km !== null);
  assert.deepEqual(distances, [...distances].sort((a, b) => a - b));
});

test("svaka udaljenost nosi oznaku vazdušne linije, ne putanje", () => {
  const ranked = rankStoresByDistance(getPublicPartnerStores(), beograd);
  assert.ok(ranked.every((item) => item.kind === "air"));
  assert.equal(distanceKindLabel("air"), "vazdušnom linijom");
});

test("format udaljenosti", () => {
  assert.equal(formatDistanceKm(0.4), "< 1 km");
  assert.equal(formatDistanceKm(4.26), "4,3 km");
  assert.equal(formatDistanceKm(23.6), "24 km");
});
