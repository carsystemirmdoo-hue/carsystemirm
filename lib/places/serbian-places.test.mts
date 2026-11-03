import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  createSettlementIndex,
  cyrillicToLatin,
  foldPlaceText,
  resolvePlaceName,
  searchSettlements,
  settlementLabel,
  type SettlementDataset,
} from "@/lib/places/serbian-places";
import { getPublicPartnerStores, hasPartnerCoordinates } from "@/lib/partner-stores";

const dataset = JSON.parse(
  readFileSync(new URL("../../public/podaci/naselja-srbije.json", import.meta.url), "utf8"),
) as SettlementDataset;
const index = createSettlementIndex(dataset);

test("ćirilica u latinicu, sa dvoslovima", () => {
  assert.equal(cyrillicToLatin("Чачак"), "Čačak");
  assert.equal(cyrillicToLatin("Љиг"), "Ljig");
  assert.equal(cyrillicToLatin("Његошева"), "Njegoševa");
  assert.equal(cyrillicToLatin("Џеп"), "Džep");
  assert.equal(cyrillicToLatin("Ђурђево"), "Đurđevo");
});

test("isti ključ za latinicu, ćirilicu i unos bez dijakritike", () => {
  const key = foldPlaceText("Čačak");
  for (const input of ["Cacak", "Чачак", "ČAČAK", "  cacak ", "čačak"]) {
    assert.equal(foldPlaceText(input), key, input);
  }
  assert.equal(foldPlaceText("Đurđevo"), foldPlaceText("Djurdjevo"));
  assert.equal(foldPlaceText("Đurđevo"), foldPlaceText("Durdevo"));
  assert.equal(foldPlaceText("Ђурђево"), foldPlaceText("Durdevo"));
});

test("pokrivenost: sva naselja iz izvora, jedinstveni matični brojevi i oznake", () => {
  assert.ok(dataset.places.length >= 4700, `${dataset.places.length}`);
  assert.equal(dataset.source.license, "ODbL-1.0");
  assert.equal(new Set(dataset.places.map((row) => row[0])).size, dataset.places.length);
  const labels = index.settlements.map((item) => item.label);
  assert.equal(new Set(labels).size, labels.length);
  for (const item of index.settlements) {
    assert.ok(item.municipality, `${item.name} nema opštinu`);
    assert.ok(item.lat > 41.8 && item.lat < 46.2 && item.lng > 18.8 && item.lng < 23.1, `${item.name} van Srbije`);
  }
});

test("Čačak se nalazi u sva tri pisma, prvi u rezultatima", () => {
  for (const input of ["Cacak", "Чачак", "Čačak", "čač"]) {
    const [first] = searchSettlements(index, input);
    assert.equal(first?.name, "Čačak", input);
  }
});

test("istoimena mesta se razlikuju opštinom", () => {
  const lipovice = searchSettlements(index, "Lipovica").filter((item) => item.name === "Lipovica");
  assert.ok(lipovice.length >= 3, `${lipovice.length}`);
  assert.equal(new Set(lipovice.map((item) => item.municipality)).size, lipovice.length);
  const labels = lipovice.map((item) => settlementLabel(item));
  assert.ok(labels.every((label) => label.startsWith("Lipovica, ")), labels.join(" | "));

  const grabovci = searchSettlements(index, "Grabovac").filter((item) => item.name === "Grabovac");
  assert.ok(grabovci.length >= 3, `${grabovci.length}`);
  assert.equal(new Set(grabovci.map((item) => settlementLabel(item))).size, grabovci.length);

  // Naziv i opština zajedno sužavaju izbor na jedno mesto.
  const [leskovacka] = searchSettlements(index, "lipovica leskovac");
  assert.equal(leskovacka?.name, "Lipovica");
  assert.equal(leskovacka?.municipality, "Leskovac");
});

test("delovi grada: Zemun i Beograd", () => {
  assert.ok(searchSettlements(index, "Zemun").some((item) => item.name === "Beograd (Zemun)"));
  const beograd = searchSettlements(index, "Beograd");
  assert.ok(beograd.slice(0, 5).every((item) => item.name.startsWith("Beograd")));
});

test("prazan i nepostojeći unos ne daje rezultate", () => {
  assert.deepEqual(searchSettlements(index, ""), []);
  assert.deepEqual(searchSettlements(index, "   "), []);
  assert.deepEqual(searchSettlements(index, "xqzvw"), []);
});

test("rezultat je ograničen i stabilan", () => {
  const first = searchSettlements(index, "Dol", 10).map((item) => item.ref);
  const second = searchSettlements(index, "Dol", 10).map((item) => item.ref);
  assert.equal(first.length, 10);
  assert.deepEqual(first, second);
});

test("grad svake javne lokacije ima naselje u blizini lokacije", () => {
  for (const store of getPublicPartnerStores()) {
    const near = hasPartnerCoordinates(store) ? { lat: store.latitude, lng: store.longitude } : null;
    const place = resolvePlaceName(index, store.city, near);
    assert.ok(place, `${store.city} (${store.id}) nema naselje`);
    if (near && place) {
      const km = Math.hypot(place.lat - near.lat, (place.lng - near.lng) * Math.cos((near.lat * Math.PI) / 180)) * 111;
      assert.ok(km < 25, `${store.city} → ${place.name}, ${place.municipality}: ${km.toFixed(1)} km`);
    }
  }
});
