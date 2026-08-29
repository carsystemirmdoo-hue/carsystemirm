import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  CUSTOMER_SCOPES,
  evaluatePricing,
  isEffectiveOn,
  netPriceFrom,
  PRECEDENCE_LEVELS,
  precedenceLevelFor,
  PRODUCT_SCOPES,
  rejectRuleShape,
  ruleApplies,
  scopeKeyFor,
} from "./precedence.mjs";

const KUPAC = "kupac-1";
const GRUPA = "grupa-1";
const ARTIKAL = "artikal-1";
const DANAS = "2026-06-15";

const CONTEXT = {
  customerId: KUPAC,
  customerGroupIds: [GRUPA],
  articleId: ARTIKAL,
  productGroup: "BAZE",
  brand: "R-M",
  onDate: DANAS,
};

let seq = 0;

/** Pravilo za datu klasu prvenstva, sa popunjenim opsegom te klase. */
function ruleForLevel(level, overrides = {}) {
  const spec = PRECEDENCE_LEVELS.find((entry) => entry.level === level);
  assert.ok(spec, `nepoznata klasa ${level}`);

  return {
    id: `pravilo-${level}-${++seq}`,
    customerScope: spec.customerScope,
    productScope: spec.productScope,
    customerId: spec.customerScope === "customer" ? KUPAC : null,
    customerGroupId: spec.customerScope === "group" ? GRUPA : null,
    articleId: spec.productScope === "article" ? ARTIKAL : null,
    productGroup: spec.productScope === "product_group" ? "BAZE" : null,
    brand: spec.productScope === "brand" ? "R-M" : null,
    valueKind: "discount_percent",
    discountPercent: level, // vrednost = klasa, da se pobednik prepozna
    netPrice: null,
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    ...overrides,
  };
}

/* -------------------------------------------------------------------------
 * Svih dvanaest klasa
 * ---------------------------------------------------------------------- */

test("matrica prvenstva ima tacno dvanaest klasa, bez rupa i bez duplikata", () => {
  assert.equal(PRECEDENCE_LEVELS.length, 12);
  const levels = PRECEDENCE_LEVELS.map((entry) => entry.level);
  assert.deepEqual(levels, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

  // Svaka kombinacija opsega postoji tačno jednom.
  const combos = new Set(
    PRECEDENCE_LEVELS.map((e) => `${e.customerScope}|${e.productScope}`),
  );
  assert.equal(combos.size, 12);
  assert.equal(CUSTOMER_SCOPES.length * PRODUCT_SCOPES.length, 12);
});

test("svaka klasa se razresava na svoj broj", () => {
  for (const spec of PRECEDENCE_LEVELS) {
    assert.equal(
      precedenceLevelFor({
        customerScope: spec.customerScope,
        productScope: spec.productScope,
      }),
      spec.level,
    );
  }
});

test("svaka klasa pojedinacno pokriva par kupac/artikal", () => {
  for (const spec of PRECEDENCE_LEVELS) {
    const rule = ruleForLevel(spec.level);
    assert.equal(
      ruleApplies(rule, CONTEXT),
      true,
      `klasa ${spec.level} (${spec.label}) ne pokriva par`,
    );
  }
});

test("uzi opseg pobedjuje siri — svih 12 nivoa, redom", () => {
  /*
   * Skup kreće sa svih dvanaest pravila i skida se po jedno, počev od
   * najužeg. Posle svakog skidanja pobednik mora biti tačno sledeća klasa.
   * Time se dokazuje ceo lanac, a ne samo prvi i poslednji korak.
   */
  let rules = PRECEDENCE_LEVELS.map((spec) => ruleForLevel(spec.level));

  for (let expected = 1; expected <= 12; expected += 1) {
    const decision = evaluatePricing(rules, CONTEXT);
    assert.equal(decision.conflict.length, 0, `nezeljeni konflikt na klasi ${expected}`);
    assert.ok(decision.winner, `nema pobednika kad je najuza klasa ${expected}`);
    assert.equal(
      decision.level,
      expected,
      `ocekivana klasa ${expected}, pobedila ${decision.level}`,
    );
    assert.equal(Number(decision.winner.discountPercent), expected);
    assert.equal(decision.considered.length, 13 - expected);
    assert.match(decision.reason, new RegExp(`klase ${expected}`));

    rules = rules.filter((rule) => precedenceLevelFor(rule) !== expected);
  }

  // Skinuta su sva pravila.
  const prazno = evaluatePricing(rules, CONTEXT);
  assert.equal(prazno.winner, null);
  assert.match(prazno.reason, /Nijedno pravilo/);
});

/* -------------------------------------------------------------------------
 * Konflikt iste klase
 * ---------------------------------------------------------------------- */

test("dva pravila iste klase i istog opsega su konflikt, ne izbor", () => {
  const stariji = ruleForLevel(1, { id: "stariji", createdAt: "2026-01-01" });
  const noviji = ruleForLevel(1, { id: "noviji", createdAt: "2026-06-01", discountPercent: 40 });

  const decision = evaluatePricing([stariji, noviji], CONTEXT);
  assert.equal(decision.winner, null, "sistem je izabrao pobednika umesto konflikta");
  assert.equal(decision.conflict.length, 2);
  assert.equal(decision.level, 1);
  assert.match(decision.reason, /Konflikt/);
  assert.match(decision.reason, /ne bira/);
});

test("konflikt se ne razresava po created_at ni u jednom smeru", () => {
  const a = ruleForLevel(6, { id: "a", createdAt: "2020-01-01" });
  const b = ruleForLevel(6, { id: "b", createdAt: "2026-08-01" });

  for (const rules of [[a, b], [b, a]]) {
    const decision = evaluatePricing(rules, CONTEXT);
    assert.equal(decision.winner, null);
    assert.equal(decision.conflict.length, 2);
  }
});

test("modul nigde ne sortira po created_at", async () => {
  const source = await readFile(new URL("./precedence.mjs", import.meta.url), "utf8");
  const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  for (const forbidden of ["createdAt", "created_at"]) {
    assert.ok(
      !code.includes(forbidden),
      `modul cita ${forbidden} — konflikt bi se tiho razresio`,
    );
  }
});

test("konflikt na nizoj klasi ne smeta kad postoji visa", () => {
  const decision = evaluatePricing(
    [ruleForLevel(1), ruleForLevel(8, { id: "x" }), ruleForLevel(8, { id: "y" })],
    CONTEXT,
  );
  // Klasa 1 je jednoznačna i pobeđuje; sudar na klasi 8 je nadjačan.
  assert.equal(decision.level, 1);
  assert.equal(decision.conflict.length, 0);
});

/* -------------------------------------------------------------------------
 * Opseg i datumi
 * ---------------------------------------------------------------------- */

test("pravilo drugog kupca ne pokriva ovog kupca", () => {
  const rule = ruleForLevel(1, { customerId: "drugi-kupac" });
  assert.equal(ruleApplies(rule, CONTEXT), false);
});

test("pravilo grupe vazi samo za clana grupe", () => {
  const rule = ruleForLevel(5);
  assert.equal(ruleApplies(rule, CONTEXT), true);
  assert.equal(
    ruleApplies(rule, { ...CONTEXT, customerGroupIds: [] }),
    false,
    "pravilo grupe je pokrilo kupca koji nije clan",
  );
});

test("grupa proizvoda i brend se poklapaju tacno, bez normalizacije", () => {
  const grupno = ruleForLevel(2);
  assert.equal(ruleApplies(grupno, { ...CONTEXT, productGroup: "baze" }), false);
  assert.equal(ruleApplies(grupno, { ...CONTEXT, productGroup: null }), false);

  const brendovno = ruleForLevel(3);
  assert.equal(ruleApplies(brendovno, { ...CONTEXT, brand: "r-m" }), false);
  assert.equal(ruleApplies(brendovno, { ...CONTEXT, brand: null }), false);
});

test("granice vazenja su ukljucene na oba kraja", () => {
  const rule = { effectiveFrom: "2026-06-01", effectiveTo: "2026-06-30" };
  assert.equal(isEffectiveOn(rule, "2026-05-31"), false);
  assert.equal(isEffectiveOn(rule, "2026-06-01"), true, "prvi dan mora vaziti");
  assert.equal(isEffectiveOn(rule, "2026-06-30"), true, "poslednji dan mora vaziti");
  assert.equal(isEffectiveOn(rule, "2026-07-01"), false);
});

test("dva pravila iste klase koja se NE preklapaju po datumu nisu konflikt", () => {
  const prvo = ruleForLevel(1, { effectiveFrom: "2026-01-01", effectiveTo: "2026-05-31" });
  const drugo = ruleForLevel(1, { effectiveFrom: "2026-06-01", discountPercent: 25 });

  const decision = evaluatePricing([prvo, drugo], CONTEXT);
  assert.equal(decision.conflict.length, 0);
  assert.equal(Number(decision.winner.discountPercent), 25);
});

test("kljuc opsega razlikuje dva kupca i dva artikla", () => {
  assert.notEqual(
    scopeKeyFor(ruleForLevel(1)),
    scopeKeyFor(ruleForLevel(1, { customerId: "drugi" })),
  );
  assert.equal(scopeKeyFor(ruleForLevel(12)), "all|all");
});

/* -------------------------------------------------------------------------
 * Oblik pravila
 * ---------------------------------------------------------------------- */

test("pravilo ne sme imati i rabat i fiksnu cenu", () => {
  const reason = rejectRuleShape(
    ruleForLevel(1, { valueKind: "net_price", discountPercent: 10, netPrice: 500 }),
  );
  assert.match(reason, /ne sme istovremeno/);
});

test("svaka vrsta vrednosti trazi svoje polje", () => {
  assert.match(
    rejectRuleShape(ruleForLevel(1, { valueKind: "discount_percent", discountPercent: null })),
    /mora imati procenat/,
  );
  assert.match(
    rejectRuleShape(ruleForLevel(1, { valueKind: "net_price", discountPercent: null, netPrice: null })),
    /mora imati neto cenu/,
  );
});

test("granice vrednosti se postuju", () => {
  assert.match(rejectRuleShape(ruleForLevel(1, { discountPercent: 101 })), /izmedju 0 i 100|između 0 i 100/);
  assert.match(rejectRuleShape(ruleForLevel(1, { discountPercent: -1 })), /izmedju 0 i 100|između 0 i 100/);
  assert.match(
    rejectRuleShape(ruleForLevel(1, { valueKind: "net_price", discountPercent: null, netPrice: -5 })),
    /negativna/,
  );
});

test("opseg bez svog polja se odbija", () => {
  assert.match(rejectRuleShape(ruleForLevel(1, { customerId: null })), /customerId/);
  assert.match(rejectRuleShape(ruleForLevel(5, { customerGroupId: null })), /customerGroupId/);
  assert.match(rejectRuleShape(ruleForLevel(2, { productGroup: null })), /productGroup/);
  assert.match(rejectRuleShape(ruleForLevel(3, { brand: null })), /brand/);
});

test("ispravno pravilo prolazi", () => {
  for (const spec of PRECEDENCE_LEVELS) {
    assert.equal(rejectRuleShape(ruleForLevel(spec.level)), null, spec.label);
  }
});

test("obrnut interval vazenja se odbija", () => {
  assert.match(
    rejectRuleShape(ruleForLevel(1, { effectiveFrom: "2026-06-01", effectiveTo: "2026-05-01" })),
    /vazi do|važi do/,
  );
});

/* -------------------------------------------------------------------------
 * Neto cena — i šta se NE naziva maržom
 * ---------------------------------------------------------------------- */

test("fiksna cena ne koristi cenovnicku cenu", () => {
  const decision = evaluatePricing(
    [ruleForLevel(1, { valueKind: "net_price", discountPercent: null, netPrice: 777.5 })],
    CONTEXT,
  );
  const { netPrice, basis } = netPriceFrom(decision, 1000);
  assert.equal(netPrice, 777.5);
  assert.match(basis, /Fiksna neto cena/);
});

test("rabat bez cenovnicke cene ne izmislja neto cenu", () => {
  const decision = evaluatePricing([ruleForLevel(1, { discountPercent: 20 })], CONTEXT);
  const { netPrice, basis } = netPriceFrom(decision, null);
  assert.equal(netPrice, null, "izvedena je cena bez izvora");
  assert.match(basis, /nije dostupna/);
});

test("rabat se primenjuje na cenovnicku cenu", () => {
  const decision = evaluatePricing([ruleForLevel(1, { discountPercent: 20 })], CONTEXT);
  assert.equal(netPriceFrom(decision, 1000).netPrice, 800);
});

test("konflikt ne daje cenu", () => {
  const decision = evaluatePricing([ruleForLevel(1, { id: "a" }), ruleForLevel(1, { id: "b" })], CONTEXT);
  assert.equal(netPriceFrom(decision, 1000).netPrice, null);
});

test("nigde se rabat ni odstupanje ne nazivaju marzom", async () => {
  const source = await readFile(new URL("./precedence.mjs", import.meta.url), "utf8");
  const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  for (const forbidden of ["margin", "marza", "marža", "Margin"]) {
    assert.ok(
      !code.includes(forbidden),
      `izvrsni kod pominje ${forbidden} — marza trazi nabavnu cenu koju portal nema`,
    );
  }
});

/* -------------------------------------------------------------------------
 * Objašnjenje odluke
 * ---------------------------------------------------------------------- */

test("odluka vraca sva razmatrana pravila i razlog", () => {
  const decision = evaluatePricing(
    [ruleForLevel(12), ruleForLevel(4), ruleForLevel(1)],
    CONTEXT,
  );
  assert.equal(decision.considered.length, 3);
  assert.deepEqual(
    decision.considered.map((rule) => rule.level),
    [1, 4, 12],
    "razmatrana pravila nisu poredjana po prvenstvu",
  );
  assert.match(decision.reason, /Nadjacano|Nadjačano/);
  assert.equal(decision.effectiveFrom, "2026-01-01");
});
