import assert from "node:assert/strict";
import test from "node:test";
import { getPublicPartnerStores, type PartnerStore } from "@/lib/partner-stores";
import {
  distanceKindLabel,
  formatDistanceKm,
  navigationHref,
  rankStoresByDistance,
  splitRankedStores,
} from "@/lib/store-distance";

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

const sample = (id: string, name: string, coords: [number, number] | null, type: PartnerStore["type"] = "store"): PartnerStore => ({
  id,
  name,
  address: `${name} 1`,
  city: name,
  type,
  verificationStatus: "reviewed",
  coordinateStatus: coords ? "verified" : "unavailable",
  isPublic: true,
  ...(coords ? { latitude: coords[0], longitude: coords[1] } : {}),
});

test("lokacije bez koordinata idu u posebnu grupu na kraju, bez udaljenosti", () => {
  const stores = [
    sample("bez", "Bez koordinata", null),
    sample("nis", "Niš", [43.3209, 21.8958]),
    sample("ns", "Novi Sad", [45.2671, 19.8335]),
  ];
  const ranked = rankStoresByDistance(stores, { lat: 45.25, lng: 19.85 });
  assert.deepEqual(ranked.map((item) => item.store.id), ["ns", "nis", "bez"]);
  const { withDistance, withoutDistance } = splitRankedStores(ranked);
  assert.deepEqual(withDistance.map((item) => item.store.id), ["ns", "nis"]);
  assert.deepEqual(withoutDistance.map((item) => [item.store.id, item.distanceKm]), [["bez", null]]);
});

test("jednake udaljenosti imaju stabilan redosled po nazivu", () => {
  const point: [number, number] = [44.8, 20.4];
  const ranked = rankStoresByDistance(
    [sample("b", "Beta", point), sample("a", "Alfa", point)],
    { lat: 44.9, lng: 20.4 },
  );
  assert.deepEqual(ranked.map((item) => item.store.id), ["a", "b"]);
});

test("malo mesto bez partnera i dalje dobija sve javne lokacije, od najbliže", () => {
  // Crna Trava (jug Srbije) nema partnersku lokaciju.
  const crnaTrava = { lat: 42.8106, lng: 22.2994 };
  const stores = getPublicPartnerStores();
  const ranked = rankStoresByDistance(stores, crnaTrava);
  assert.equal(ranked.length, stores.length);
  assert.ok((ranked[0].distanceKm ?? 0) > 10);
  assert.equal(ranked[0].store.city, "Leskovac");
});

test("navigacija: uputstva od izabranog mesta, bez veze za lokaciju bez koordinata", () => {
  const store = sample("ns", "Novi Sad", [45.2671, 19.8335]);
  assert.match(navigationHref(store, { lat: 44.8125, lng: 20.4612 }) ?? "", /directions\?engine=fossgis_osrm_car&route=44\.81250%2C20\.46120%3B45\.2671%2C19\.8335$/);
  assert.match(navigationHref(store) ?? "", /mlat=45\.2671&mlon=19\.8335/);
  assert.equal(navigationHref(sample("x", "X", null)), null);
});
