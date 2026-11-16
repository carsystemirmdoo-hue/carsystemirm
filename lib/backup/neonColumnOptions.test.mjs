import assert from "node:assert/strict";
import { test } from "node:test";
import { neonRestoreFilter, stripNeonColumnOptions } from "./neonColumnOptions.mjs";

test("red samo sa pg_attver se izbacuje", () => {
  assert.equal(stripNeonColumnOptions("ALTER TABLE ONLY public.stock_level_history ALTER COLUMN code_key SET (pg_attver=484681096);"), null);
  assert.equal(stripNeonColumnOptions('ALTER TABLE ONLY public."Neka tabela" ALTER COLUMN "neka kolona" SET (pg_attver=1);'), null);
});

test("ostale opcije kolone ostaju", () => {
  assert.equal(
    stripNeonColumnOptions("ALTER TABLE ONLY public.t ALTER COLUMN c SET (n_distinct=-1, pg_attver=484681096);"),
    "ALTER TABLE ONLY public.t ALTER COLUMN c SET (n_distinct=-1);",
  );
  const plain = "ALTER TABLE ONLY public.t ALTER COLUMN c SET (n_distinct=-1);";
  assert.equal(stripNeonColumnOptions(plain), plain);
});

test("drugi DDL se ne dira", () => {
  for (const l of [
    "ALTER TABLE ONLY public.t ALTER COLUMN c SET DEFAULT gen_random_uuid();",
    "ALTER TABLE ONLY public.t ALTER COLUMN c SET STATISTICS 1000;",
    "ALTER TABLE ONLY public.t ADD CONSTRAINT t_pkey PRIMARY KEY (id);",
    "CREATE TABLE public.t (",
  ]) assert.equal(stripNeonColumnOptions(l), l);
});

test("COPY podaci se ne menjaju, posle \\. filter opet radi", () => {
  const f = neonRestoreFilter();
  const attver = "ALTER TABLE ONLY public.t ALTER COLUMN c SET (pg_attver=7);";
  const lines = ["COPY public.notes (id, body) FROM stdin;", `1\t${attver}`, attver, "\\.", attver];
  const out = lines.map(f);
  assert.deepEqual(out, [lines[0], lines[1], attver, "\\.", null]);
  assert.equal(f.state.removed, 1);
});
