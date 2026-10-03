import assert from "node:assert/strict";
import test from "node:test";
import { dataSufficiency, suggestFromCatalog, suggestFromPeers } from "./crossSell.mjs";

const b = (o) => new Map(Object.entries(o).map(([k, v]) => [k, new Set(v)]));

test("slične firme: jak predlog tek od 3 firme, slab od 2; bez imena firmi", () => {
  const baskets = b({ me: ["A", "B"], p1: ["A", "X", "Y"], p2: ["A", "X", "Y"], p3: ["B", "X"], other: ["Z", "Q"] });
  const r = suggestFromPeers("me", baskets);
  assert.equal(r.peers, 3, "firma bez zajedničkog artikla nije slična");
  assert.deepEqual(r.suggestions.map((s) => [s.articleCode, s.support, s.strength]), [["X", 3, "strong"], ["Y", 2, "weak"]]);
  assert.deepEqual(r.suggestions[0].because, ["A", "B"]);
  assert.doesNotMatch(JSON.stringify(r), /p1|p2|p3/, "imena drugih firmi ne izlaze");
});

test("jedna firma nije signal; već kupljeno se ne predlaže", () => {
  const r = suggestFromPeers("me", b({ me: ["A"], p1: ["A", "X"] }));
  assert.deepEqual(r.suggestions, []);
  assert.deepEqual(suggestFromPeers("me", b({ me: [] , p1: ["A"] })).suggestions, []);
});

test("katalog: kompatibilno sa kupljenim, samo potvrđeno vezani artikli", () => {
  const out = suggestFromCatalog(
    new Set(["LAK"]),
    [{ code: "LAK", slug: "c-2e50" }],
    (slug) => (slug === "c-2e50" ? ["r-2e10", "h-2e20"] : []),
    new Map([["r-2e10", ["RZ"]]]),
  );
  assert.deepEqual(out, [{ articleCode: "RZ", viaCode: "LAK", viaSlug: "c-2e50" }], "h-2e20 nema vezan artikal → ne predlaže se");
});

test("nedostatak podataka se kaže rečima", () => {
  assert.equal(dataSufficiency({ customersWithHistory: 3, peers: 2, myArticles: 2 }).ok, false);
  assert.match(dataSufficiency({ customersWithHistory: 3, peers: 2, myArticles: 2 }).reason, /Premalo firmi .* \(3; potrebno najmanje 5\)/);
  assert.match(dataSufficiency({ customersWithHistory: 9, peers: 1, myArticles: 2 }).reason, /sličnim kupovinama \(1\)/);
  assert.equal(dataSufficiency({ customersWithHistory: 9, peers: 4, myArticles: 2 }).ok, true);
});
