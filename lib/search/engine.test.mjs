import assert from "node:assert/strict";
import test from "node:test";

import { buildSearchIndex, searchIndex } from "./engine.mjs";
import { createSearchFixture } from "./fixture.mjs";
import { groupSearchHits } from "./grouping.mjs";

const records = createSearchFixture(3500);
const index = buildSearchIndex(records);

const names = (hits) => hits.map((hit) => hit.record.name);
const first = (query, options) => searchIndex(index, query, { limit: 5, ...options })[0];

test("fixture pokriva ciljanu veličinu i sve tri vrste zapisa", () => {
  assert.ok(records.length >= 3500, `fixture ima samo ${records.length} zapisa`);
  for (const kind of ["family", "standalone", "variant"]) {
    assert.ok(
      records.some((record) => record.kind === kind),
      `fixture nema nijedan zapis vrste ${kind}`,
    );
  }
});

/* -- Šifre ----------------------------------------------------------------- */

test("tačan SKU pobeđuje među stotinama sličnih naziva", () => {
  const hit = first("C 2E50");
  assert.equal(hit.record.name, "C 2E50 Clear coat");
});

test("SKU bez razmaka nalazi isti zapis", () => {
  assert.equal(first("c2e50").record.name, "C 2E50 Clear coat");
  assert.equal(first("C-2E50").record.name, "C 2E50 Clear coat");
});

test("SKU ne gubi od slabog fuzzy pogotka po nazivu", () => {
  /*
   * Varijanta sa „Chrome" u nazivu: upit „chrome <šifra>" nalazi baš nju, iako
   * u skupu postoje stotine drugih „Chrome" varijanti i desetine drugih zapisa
   * sa istom šifrom. Ovo je tačka na kojoj bi fuzzy po nazivu mogao da pretekne
   * šifru — pa se proverava da je ne pretekne.
   */
  const target = records.find(
    (record) => record.kind === "variant" && record.name.includes("Chrome"),
  );
  const hits = searchIndex(index, `chrome ${target.productCode}`, { limit: 20 });

  assert.equal(hits[0].record.id, target.id);

  /*
   * Izjednačenja su dozvoljena, ali samo među zapisima koji su STVARNO jednako
   * dobri: svaki rezultat mora imati i naziv i šifru iz upita. Stotine „Chrome"
   * varijanti sa drugom šifrom ne smeju ni da uđu u rezultat, a kamoli da ga
   * predvode.
   */
  for (const hit of hits) {
    assert.match(hit.record.name, /Chrome/);
    assert.equal(hit.record.productCode, target.productCode);
  }
  assert.ok(
    records.filter(
      (record) => record.name.includes("Chrome") && record.productCode !== target.productCode,
    ).length > 50,
    "test ne dokazuje ništa bez mnoštva zapisa koji se poklapaju samo po nazivu",
  );
});

test("delimičan SKU i dalje nalazi zapis", () => {
  const hits = searchIndex(index, "2e23", { limit: 5 });
  assert.ok(names(hits).some((name) => name.startsWith("P 2E23")));
});

/* -- Tokeni i redosled ----------------------------------------------------- */

test("dva tokena u obrnutom redosledu daju isti skup rezultata", () => {
  const forward = searchIndex(index, "carmine red", { limit: 50 }).map((hit) => hit.record.id);
  const backward = searchIndex(index, "red carmine", { limit: 50 }).map((hit) => hit.record.id);
  assert.deepEqual(new Set(backward), new Set(forward));
});

test("svi tokeni pobeđuju nad samo jednim tokenom", () => {
  const hits = searchIndex(index, "molotow chrome", { limit: 20 });
  const best = hits[0];
  assert.match(best.record.name, /Molotow/);
  assert.match(best.record.name, /Chrome/);
});

test("AND ide pre OR: zajednički + razlikovni token sužava rezultat", () => {
  const both = searchIndex(index, "antichip carmine", { limit: 500 });
  assert.ok(both.length > 0);
  for (const hit of both) {
    const haystack = `${hit.record.name} ${hit.record.familyName ?? ""}`.toLowerCase();
    assert.ok(
      haystack.includes("antichip") && haystack.includes("carmine"),
      `„${hit.record.name}" ne sadrži obe reči`,
    );
  }
});

test("nepostojeći drugi token pada na OR fallback umesto na prazno", () => {
  const hits = searchIndex(index, "antichip qqqqzzz", { limit: 10 });
  assert.ok(hits.length > 0, "fallback nije vratio nijedan rezultat");
  assert.match(hits[0].record.name, /Antichip/);
});

/* -- Greške u kucanju ------------------------------------------------------ */

test("greška u dugoj reči i dalje nalazi porodicu", () => {
  const hits = searchIndex(index, "antichp", { limit: 5 });
  assert.match(hits[0].record.name, /Antichip/);
});

test("transponovana slova se tretiraju kao jedna greška", () => {
  const hits = searchIndex(index, "antihcip", { limit: 5 });
  assert.match(hits[0].record.name, /Antichip/);
});

test("dva znaka pokrivaju prefiks, bez fuzzy eksplozije", () => {
  /*
   * Dva znaka su najkraći upit koji uopšte radi (vidi „jednoslovni upit ne
   * pokreće pretragu"). Na toj dužini smeju samo exact i prefiks — svaki
   * rezultat mora imati token koji stvarno počinje na otkucane znakove.
   */
  const hits = searchIndex(index, "an", { limit: 5000 });
  assert.ok(hits.length > 0, "dvoslovni upit mora nešto da vrati");
  assert.ok(
    hits.every((hit) => {
      const haystack = [
        hit.record.name,
        hit.record.productCode ?? "",
        hit.record.brandName ?? "",
        hit.record.familyName ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.split(/[^a-z0-9]+/).some((token) => token.startsWith("an"));
    }),
    "dvoslovni upit je vratio zapis bez ijednog tokena koji počinje na „an“",
  );
});

test("kratak dvoslovni upit radi bez fuzzy širenja", () => {
  const hits = searchIndex(index, "ch", { limit: 200 });
  assert.ok(
    hits.every((hit) =>
      `${hit.record.name} ${hit.record.brandName ?? ""} ${hit.record.productCode ?? ""}`
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .some((token) => token.startsWith("ch")),
    ),
    "dvoslovni upit je uveo zapis bez prefiks poklapanja",
  );
});

/* -- Jedinice i brojevi ---------------------------------------------------- */

test("`1l` i `1 l` daju isti skup rezultata", () => {
  const joined = searchIndex(index, "1l", { limit: 500 }).map((hit) => hit.record.id);
  const spaced = searchIndex(index, "1 l", { limit: 500 }).map((hit) => hit.record.id);
  assert.deepEqual(new Set(joined), new Set(spaced));
});

test("`3,5` i `3.5` daju isti skup rezultata", () => {
  const comma = searchIndex(index, "3,5 l", { limit: 500 }).map((hit) => hit.record.id);
  const dot = searchIndex(index, "3.5 l", { limit: 500 }).map((hit) => hit.record.id);
  assert.deepEqual(new Set(comma), new Set(dot));
  assert.ok(comma.length > 0);
});

test("`1l` ne povlači svaki proizvod koji se meri u litrima", () => {
  const litre = searchIndex(index, "1l", { limit: 5000 });
  for (const hit of litre) {
    assert.match(
      `${hit.record.technicalLine ?? ""} ${hit.record.quantityLabel ?? ""}`,
      /1 l|1l/,
      `„${hit.record.name}" nije pakovanje od 1 l`,
    );
  }
});

test("naziv + volumen sužava na to pakovanje", () => {
  const hits = searchIndex(index, "molotow chrome 600 ml", { limit: 20 });
  assert.ok(hits.length > 0);
  assert.match(hits[0].record.name, /600 ml/);
});

/* -- Dijakritika ----------------------------------------------------------- */

test("upit sa i bez dijakritike daje identičan rezultat", () => {
  const withDiacritics = searchIndex(index, "Razređivač", { limit: 50 }).map((hit) => hit.record.id);
  const without = searchIndex(index, "razredjivac", { limit: 50 }).map((hit) => hit.record.id);
  assert.deepEqual(without, withDiacritics);
  assert.ok(withDiacritics.length > 0);
});

/* -- Alias ----------------------------------------------------------------- */

test("kontrolisani sinonim nalazi proizvod, ali sa nižim rangom", () => {
  const alias = searchIndex(index, "clearcoat", { limit: 20 });
  assert.ok(alias.length > 0, "sinonim nije vratio nijedan rezultat");

  const direct = searchIndex(index, "lak", { limit: 20 });
  assert.ok(
    direct[0].score > alias[0].score,
    "direktan pogodak mora biti iznad alias pogotka",
  );
});

/* -- Isti naziv, različiti brendovi ---------------------------------------- */

test("isti naziv kod različitih brendova ostaje razdvojen brendom u upitu", () => {
  const shared = "Bezbojni lak Premium";
  const brands = new Set(
    records
      .filter((record) => record.kind === "family" && record.name.includes(shared))
      .map((record) => record.brandSlug),
  );
  assert.ok(brands.size > 1, "fixture nema isti naziv kod više brendova");

  for (const brandSlug of brands) {
    const brandName = records.find((record) => record.brandSlug === brandSlug).brandName;
    const hit = first(`${brandName} ${shared}`);
    assert.equal(hit.record.brandSlug, brandSlug, `upit sa brendom ${brandName} promašio brend`);
  }
});

/* -- Regresije iz delta audita --------------------------------------------- */

test("mera se ne sklapa iz šifre i jedinice u različitim poljima", () => {
  /*
   * Regresija: `Cosmos Lac Flame Blue FB 600` je pakovanje od 400 ml sa šifrom
   * 600, i pojavljivao se kao rezultat za „600 ml" jer je `600` poklapao šifru,
   * a `ml` tehničku liniju. Mera se traži isključivo kao spojen token.
   */
  const decoy = {
    id: "decoy-fb-600",
    kind: "variant",
    href: "/proizvodi/decoy-fb-600",
    name: "Decoy Flame Blue FB 600 Riviera Light",
    familySlug: "decoy-flame-blue",
    familyName: "Decoy Flame Blue",
    productCode: "600",
    brandSlug: "cosmos-lac",
    brandName: "Cosmos Lac",
    technicalLine: "400 ml",
    quantityLabel: "400 ml",
  };
  const decoyIndex = buildSearchIndex([...records, decoy]);

  const hits = searchIndex(decoyIndex, "600 ml", { limit: 500 });
  assert.ok(
    !hits.some((hit) => hit.record.id === decoy.id),
    "pakovanje od 400 ml sa šifrom 600 se i dalje vraća za upit „600 ml“",
  );
  assert.ok(
    searchIndex(decoyIndex, "600", { limit: 500 }).some((hit) => hit.record.id === decoy.id),
    "šifra 600 se više ne nalazi ni kao šifra",
  );
});

test("svaki rezultat za meru stvarno ima to pakovanje", () => {
  for (const query of ["600 ml", "1 l", "3,5 l"]) {
    for (const { record } of searchIndex(index, query, { limit: 2000 })) {
      const packaging = `${record.technicalLine ?? ""} ${record.quantityLabel ?? ""}`;
      const normalizedPackaging = packaging.toLowerCase().replace(/,/g, ".").replace(/\s/g, "");
      const wanted = query.toLowerCase().replace(/,/g, ".").replace(/\s/g, "");
      assert.ok(
        normalizedPackaging.includes(wanted),
        `upit „${query}“ vraća ${record.id} sa pakovanjem „${packaging.trim()}“`,
      );
    }
  }
});

test("reč se ne nalazi kao substring druge reči", () => {
  /*
   * Regresija: stari `includes()` predicate je za upit „ral" vraćao „coRAL
   * blush", „grey neutRAL" i „natuRAL" — 14 od 140 rezultata na stvarnim
   * podacima bilo je ovakvo slučajno poklapanje.
   */
  const decoys = ["Decoy Coral Blush", "Decoy Grey Neutral", "Decoy Natural Putty"].map(
    (name, position) => ({
      id: `decoy-substring-${position}`,
      kind: "standalone",
      href: `/proizvodi/decoy-substring-${position}`,
      name,
      brandSlug: "cosmos-lac",
      brandName: "Cosmos Lac",
    }),
  );
  const decoyIndex = buildSearchIndex([...records, ...decoys]);
  const hits = searchIndex(decoyIndex, "ral", { limit: 2000 });

  for (const decoy of decoys) {
    assert.ok(
      !hits.some((hit) => hit.record.id === decoy.id),
      `„${decoy.name}“ se vraća za upit „ral“`,
    );
  }
});

test("jednoslovni upit ne pokreće pretragu", () => {
  for (const query of ["c", "a", "č", " c ", "1"]) {
    assert.deepEqual(
      searchIndex(index, query, { limit: 5000 }),
      [],
      `upit „${query}“ je pokrenuo pretragu`,
    );
  }
  assert.ok(
    searchIndex(index, "ch", { limit: 10 }).length > 0,
    "dva znaka moraju i dalje da rade",
  );
});

/* -- Determinizam ---------------------------------------------------------- */

test("isti upit uvek daje isti redosled", () => {
  for (const query of ["ral", "chrome 400", "antichip", "c2e50", "a"]) {
    const runs = Array.from({ length: 3 }, () =>
      searchIndex(index, query, { limit: 100 }).map((hit) => `${hit.record.id}:${hit.score}`),
    );
    assert.deepEqual(runs[1], runs[0], `upit „${query}" nije determinističan`);
    assert.deepEqual(runs[2], runs[0], `upit „${query}" nije determinističan`);
  }
});

test("nova gradnja indeksa daje identičan rezultat", () => {
  const rebuilt = buildSearchIndex(createSearchFixture(3500));
  const fromFirst = searchIndex(index, "molotow chrome", { limit: 50 }).map((hit) => hit.record.id);
  const fromSecond = searchIndex(rebuilt, "molotow chrome", { limit: 50 }).map((hit) => hit.record.id);
  assert.deepEqual(fromSecond, fromFirst);
});

/* -- Ispravnost izlaza ----------------------------------------------------- */

test("svaki rezultat ima ispravan href", () => {
  const hits = searchIndex(index, "chrome", { limit: 500 });
  assert.ok(hits.length > 0);
  for (const { record } of hits) {
    if (record.kind === "family") {
      assert.equal(record.href, `/proizvodi/grupa/${record.familySlug}`);
    } else {
      assert.equal(record.href, `/proizvodi/${record.id}`);
    }
  }
});

test("prazan upit vraća prazan rezultat, ne ceo katalog", () => {
  assert.deepEqual(searchIndex(index, ""), []);
  assert.deepEqual(searchIndex(index, "   "), []);
  assert.deepEqual(searchIndex(index, "-- .. //"), []);
});

/* -- Debug scorer ---------------------------------------------------------- */

test("debug scorer objašnjava zašto je rezultat rangiran", () => {
  const [hit] = searchIndex(index, "antichip carmine", { limit: 1, debug: true });
  assert.ok(hit.explain, "debug nije vratio objašnjenje");
  assert.ok(Array.isArray(hit.explain.parts) && hit.explain.parts.length > 0);
  assert.equal(hit.explain.coveredWords, 2);
  assert.ok(
    searchIndex(index, "antichip", { limit: 1 })[0].explain === undefined,
    "objašnjenje curi i kada debug nije tražen",
  );
});

/* -- Grupisanje ------------------------------------------------------------ */

test("grupisanje sklapa varijante iste porodice u jednu stavku", () => {
  const familyIndexBySlug = new Map(
    records.flatMap((record, position) =>
      record.kind === "family" && record.familySlug ? [[record.familySlug, position]] : [],
    ),
  );
  const hits = searchIndex(index, "molotow chrome", { limit: 60 });
  const groups = groupSearchHits(hits, { familyIndexBySlug, maxGroups: 8, maxMembers: 3 });

  assert.ok(groups.length <= 8);
  for (const group of groups) {
    assert.ok(group.memberIndices.length <= 3, "grupa prikazuje više od tri varijante");
  }

  const variantHits = hits.filter((hit) => hit.record.kind === "variant").length;
  assert.ok(
    variantHits > groups.length,
    "test ne dokazuje ništa ako varijanti nema više nego grupa",
  );
});

test("grupisanje ne menja rezultat engine-a, samo njegov prikaz", () => {
  const hits = searchIndex(index, "chrome", { limit: 60 });
  const before = hits.map((hit) => hit.record.id);
  groupSearchHits(hits, { maxGroups: 8, maxMembers: 3 });
  assert.deepEqual(
    hits.map((hit) => hit.record.id),
    before,
  );
});

test("tačan pogodak varijante se prikazuje direktno, ne uvučen", () => {
  const variant = records.find((record) => record.kind === "variant");
  const hits = searchIndex(index, variant.id, { limit: 20 });
  const groups = groupSearchHits(hits, { maxGroups: 8, maxMembers: 3 });
  assert.equal(hits[0].record.id, variant.id);
  assert.equal(groups[0].type, "record");
});
