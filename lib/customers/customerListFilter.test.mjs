import assert from "node:assert/strict";
import test from "node:test";
import { filterCustomerList, parseCustomerListFilter } from "./customerListFilter.mjs";

const P = "6d03cd52-4e01-4661-afd4-93ac5459882f";
const J = "1d03cd52-4e01-4661-afd4-93ac5459882f";
const customers = [
  { id: "a", name: "Auto Lak Đurić d.o.o.", pib: "100000001", city: "Inđija" },
  { id: "b", name: "Karoserija Čačak", pib: "100000002", city: "Čačak" },
  { id: "c", name: "Farbara", pib: "100000003", city: null },
];
const assignees = new Map([["a", [{ id: P, name: "Petar" }]], ["b", [{ id: J, name: "Jovan" }]]]);
const ids = (f) => filterCustomerList(customers, f, assignees).map((c) => c.id);

test("pretraga bez obzira na kvačice, veličinu slova i redosled reči; po PIB-u i gradu", () => {
  assert.deepEqual(ids({ q: "djuric", rep: "" }), ["a"]);
  assert.deepEqual(ids({ q: "CACAK karoserija", rep: "" }), ["b"]);
  assert.deepEqual(ids({ q: "100000003", rep: "" }), ["c"]);
  assert.deepEqual(ids({ q: "indjija", rep: "" }), ["a"]);
});

test("komercijalista po dodeli; „bez“ = kupci bez dodele", () => {
  assert.deepEqual(ids({ q: "", rep: P }), ["a"]);
  assert.deepEqual(ids({ q: "", rep: "bez" }), ["c"]);
  assert.deepEqual(ids({ q: "", rep: "" }), ["a", "b", "c"]);
});

test("neispravan unos se ignoriše, ne širi ni ne obara", () => {
  assert.deepEqual(parseCustomerListFilter({ q: "  x ", komercijalista: "nije-uuid" }), { q: "x", rep: "" });
  assert.deepEqual(parseCustomerListFilter({ komercijalista: "bez" }), { q: "", rep: "bez" });
  assert.deepEqual(parseCustomerListFilter({}), { q: "", rep: "" });
});
