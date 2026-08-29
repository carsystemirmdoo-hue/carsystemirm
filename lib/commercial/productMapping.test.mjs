import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  HISTORICAL_MAPPING_STATUSES,
  isCustomerFacing,
  PRODUCT_MAPPING_STATUSES,
  normalizeArticleCode,
  presentArticle,
  proposeExactMapping,
  rejectMappingTransition,
} from "./productMapping.mjs";

const catalog = [
  { slug: "rm-onyx-hd-baza", internalCode: "005500" },
  { slug: "baslac-hs-lak", internalCode: "5500" },
  { slug: "cosmos-punilo", internalCode: null },
  { slug: "norbin-razredjivac" },
];

/* -------------------------------------------------------------------------
 * Tačna šifra, bez izuzetka
 * ---------------------------------------------------------------------- */

test("vodeca nula razlikuje dva razlicita proizvoda", () => {
  const sVodecom = proposeExactMapping({ articleCode: "005500", catalogProducts: catalog });
  const bez = proposeExactMapping({ articleCode: "5500", catalogProducts: catalog });

  assert.equal(sVodecom.status, "suggested");
  assert.equal(sVodecom.catalogProductSlug, "rm-onyx-hd-baza");
  assert.equal(bez.status, "suggested");
  assert.equal(bez.catalogProductSlug, "baslac-hs-lak");
});

test("sifra bez poklapanja ostaje nemapirana, bez nagadjanja", () => {
  const result = proposeExactMapping({ articleCode: "999999", catalogProducts: catalog });
  assert.equal(result.status, "unmapped");
  assert.equal(result.catalogProductSlug, null);
  assert.deepEqual(result.candidates, []);
});

test("dva proizvoda sa istom sifrom su konflikt, ne izbor", () => {
  const duplo = [
    { slug: "a", internalCode: "005500" },
    { slug: "b", internalCode: "005500" },
  ];
  const result = proposeExactMapping({ articleCode: "005500", catalogProducts: duplo });
  assert.equal(result.status, "conflict");
  assert.equal(result.catalogProductSlug, null);
  assert.deepEqual(result.candidates, ["a", "b"]);
});

test("proizvod bez interne sifre nikad nije kandidat", () => {
  const result = proposeExactMapping({
    articleCode: "005500",
    catalogProducts: [{ slug: "cosmos-punilo", internalCode: null }, { slug: "x" }],
  });
  assert.equal(result.status, "unmapped");
});

test("naziv nije ulaz — isti naziv, druga sifra, nema predloga", () => {
  const result = proposeExactMapping({
    articleCode: "005500",
    catalogProducts: [{ slug: "rm-onyx-hd-baza", internalCode: "005501", name: "ONYX HD baza" }],
  });
  assert.equal(result.status, "unmapped");
});

test("brojcani oblik sifre se odbija", () => {
  assert.throws(() => normalizeArticleCode(5500), { code: "not_a_string" });
  assert.throws(() => normalizeArticleCode(""), { code: "empty" });
});

test("modul ne sadrzi nijedan trag poredjenja po nazivu", async () => {
  const source = await readFile(new URL("./productMapping.mjs", import.meta.url), "utf8");
  const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  for (const forbidden of ["levenshtein", "similarity", "fuzzy", "toLowerCase()", "Number("]) {
    assert.ok(
      !code.includes(forbidden),
      `modul sadrzi ${forbidden} — put ka povezivanju po nazivu ili po broju`,
    );
  }
});

/* -------------------------------------------------------------------------
 * Šta artikal sme da pokaže kupcu
 * ---------------------------------------------------------------------- */

test("samo potvrdjena veza je customer-facing", () => {
  assert.equal(isCustomerFacing({ status: "mapped", catalogProductSlug: "a" }), true);
  assert.equal(isCustomerFacing({ status: "suggested", catalogProductSlug: "a" }), false);
  assert.equal(isCustomerFacing({ status: "conflict", catalogProductSlug: "a" }), false);
  assert.equal(isCustomerFacing({ status: "mapped", catalogProductSlug: null }), false);
});

test("nemapiran artikal ostaje vidljiv interno, ali bez slike i PDP-a", () => {
  const view = presentArticle({ code: "005500", name: "ONYX HD baza" }, null);
  assert.equal(view.visibleInternally, true);
  assert.equal(view.catalogHref, null);
  assert.equal(view.imageAllowed, false);
  assert.equal(view.status, "unmapped");
});

test("predlozen artikal jos uvek ne dobija sliku ni PDP", () => {
  const view = presentArticle(
    { code: "005500", name: "ONYX HD baza" },
    { status: "suggested", catalogProductSlug: "rm-onyx-hd-baza" },
  );
  assert.equal(view.catalogHref, null);
  assert.equal(view.imageAllowed, false);
});

test("potvrdjen artikal dobija PDP i sliku", () => {
  const view = presentArticle(
    { code: "005500", name: "ONYX HD baza" },
    { status: "mapped", catalogProductSlug: "rm-onyx-hd-baza" },
  );
  assert.equal(view.catalogHref, "/katalog/rm-onyx-hd-baza");
  assert.equal(view.imageAllowed, true);
});

/* -------------------------------------------------------------------------
 * Prelazi stanja
 * ---------------------------------------------------------------------- */

test("potvrda bez kataloskog proizvoda nije potvrda", () => {
  const reason = rejectMappingTransition({
    from: "suggested",
    to: "mapped",
    catalogProductSlug: null,
    note: "provereno u cenovniku",
  });
  assert.match(reason, /kataloski proizvod|kataloški proizvod/);
});

test("potvrda i ponistavanje traze razlog", () => {
  assert.ok(
    rejectMappingTransition({ from: "suggested", to: "mapped", catalogProductSlug: "a", note: "" }),
  );
  assert.ok(rejectMappingTransition({ from: "mapped", to: "rejected", note: "x" }));
  assert.equal(
    rejectMappingTransition({
      from: "suggested",
      to: "mapped",
      catalogProductSlug: "a",
      note: "provereno u cenovniku",
    }),
    null,
  );
});

test("odbijena veza se ne vraca pravo u potvrdjenu", () => {
  assert.ok(
    rejectMappingTransition({
      from: "rejected",
      to: "mapped",
      catalogProductSlug: "a",
      note: "ipak jeste",
    }),
  );
  assert.equal(
    rejectMappingTransition({ from: "rejected", to: "unmapped", note: "otvara se ponovo" }),
    null,
  );
});

test("nepoznato stanje se odbija", () => {
  assert.ok(rejectMappingTransition({ from: "unmapped", to: "mozda", note: "x" }));
});

/* -------------------------------------------------------------------------
 * `revoked` je istorija potvrđene veze, `rejected` je odbijen predlog (F-10)
 * ---------------------------------------------------------------------- */

test("ponistavanje se bira samo iz potvrdjene veze", () => {
  assert.equal(
    rejectMappingTransition({
      from: "mapped",
      to: "revoked",
      note: "pogresna veza",
    }),
    null,
  );
  for (const from of ["unmapped", "suggested", "conflict"]) {
    assert.match(
      rejectMappingTransition({ from, to: "revoked", note: "pokusaj" }),
      /samo potvrdjena veza|samo potvrđena veza/,
      from,
    );
  }
});

test("potvrdjena veza se ne odbija kao predlog", () => {
  assert.match(
    rejectMappingTransition({ from: "mapped", to: "rejected", note: "greska" }),
    /revoked/,
  );
});

test("oba istorijska stanja traze razlog", () => {
  for (const to of ["rejected", "revoked"]) {
    const from = to === "revoked" ? "mapped" : "suggested";
    assert.match(
      rejectMappingTransition({ from, to, note: "x" }),
      /razlog/,
      to,
    );
  }
});

test("iz istorijskog stanja se izlazi samo kroz unmapped", () => {
  for (const from of ["rejected", "revoked"]) {
    assert.match(
      rejectMappingTransition({
        from,
        to: "mapped",
        catalogProductSlug: "a",
        note: "ipak jeste",
      }),
      /unmapped/,
      from,
    );
    assert.equal(
      rejectMappingTransition({ from, to: "unmapped", note: "otvara se ponovo" }),
      null,
      from,
    );
  }
});

test("ponisteni artikal nije customer-facing", () => {
  assert.equal(
    isCustomerFacing({ status: "revoked", catalogProductSlug: "a" }),
    false,
  );
  const view = presentArticle(
    { code: "005500", name: "ONYX HD baza" },
    { status: "revoked", catalogProductSlug: null },
  );
  assert.equal(view.catalogHref, null);
  assert.equal(view.imageAllowed, false);
  assert.equal(view.visibleInternally, true);
});

test("oba istorijska stanja su na spisku HISTORICAL", () => {
  assert.deepEqual([...HISTORICAL_MAPPING_STATUSES].sort(), ["rejected", "revoked"]);
  for (const status of HISTORICAL_MAPPING_STATUSES) {
    assert.ok(PRODUCT_MAPPING_STATUSES.includes(status), status);
  }
});
