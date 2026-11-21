/**
 * Prikazi kroz vreme u Analitici: ključ je ISO (hronološki redosled), oznaka
 * dd/mm/gggg kao ostatak portala, a redosled je po vremenu, ne po iznosu.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const src = await readFile(new URL("./queries.ts", import.meta.url), "utf8");

test("dani, meseci i godine postoje i imaju ISO ključ", () => {
  assert.match(src, /dani: \{\s*key: sql<string>`to_char\(\$\{invoices\.issuedOn\}, 'YYYY-MM-DD'\)`/);
  assert.match(src, /meseci: \{\s*key: sql<string>`to_char\(\$\{invoices\.issuedOn\}, 'YYYY-MM'\)`/);
  assert.match(src, /godine: \{\s*key: sql<string>`to_char\(\$\{invoices\.issuedOn\}, 'YYYY'\)`/);
  assert.match(src, /'DD\/MM\/YYYY'/);
});

test("prikazi kroz vreme se ređaju hronološki, ostali po iznosu", () => {
  assert.match(src, /TIME_VIEWS as readonly string\[\]\)\.includes\(view\)\s*\?\s*\[sql`1 DESC`\]/);
});
