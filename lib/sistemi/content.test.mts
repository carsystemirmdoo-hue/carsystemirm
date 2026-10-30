import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { getCarsystemProductBySlug } from "@/lib/carsystem-data";

/*
 * Sadržaj stranica „Sistemi i programi“ (content/sistemi): svaka vrednost ima izvor sa
 * stranom, svaki proizvod postoji u katalogu, a spisak slika bez potvrđenog prava je
 * usklađen sa evidencijom prava.
 */
const ROOT = path.resolve(import.meta.dirname, "../..");
const DIR = path.join(ROOT, "content/sistemi");
const izvori = JSON.parse(readFileSync(path.join(DIR, "izvori.json"), "utf8")) as Record<string, { naziv: string; url?: string; dokument?: string }>;
const pages = readdirSync(DIR)
  .filter((name) => name.endsWith(".json") && !["izvori.json", "slike-bez-potvrde-prava.json"].includes(name))
  .map((name) => ({ name, data: JSON.parse(readFileSync(path.join(DIR, name), "utf8")) }));

function walk(value: unknown, visit: (record: Record<string, unknown>) => void) {
  if (Array.isArray(value)) value.forEach((item) => walk(item, visit));
  else if (value && typeof value === "object") {
    visit(value as Record<string, unknown>);
    Object.values(value).forEach((item) => walk(item, visit));
  }
}

test("pet stručnih stranica ima sadržaj", () => {
  assert.deepEqual(
    pages.map((page) => page.name).sort(),
    ["boje-i-lakovi.json", "pistolji-i-oprema.json", "poliranje.json", "potrosni-materijal.json", "priprema-i-abrazivi.json"],
  );
});

test("svaki izvor postoji i ima stranu", () => {
  for (const page of pages) {
    walk(page.data, (record) => {
      const refs = [...((record.sources as { doc: string; strana: number }[]) ?? []), ...(record.source ? [record.source as { doc: string; strana: number }] : [])];
      for (const ref of refs) {
        assert.ok(izvori[ref.doc], `${page.name}: nepoznat izvor ${ref.doc}`);
        assert.ok(Number.isInteger(ref.strana) && ref.strana > 0, `${page.name}: ${ref.doc} bez strane`);
      }
    });
  }
  for (const [id, izvor] of Object.entries(izvori)) {
    assert.ok(izvor.url || izvor.dokument, `${id}: nema adrese`);
    if (izvor.dokument) assert.ok(existsSync(path.join(ROOT, "public", izvor.dokument)), `${id}: ${izvor.dokument} ne postoji u public/`);
  }
});

test("svaki proizvod postoji u katalogu", () => {
  for (const page of pages) {
    walk(page.data, (record) => {
      for (const slug of (record.products as string[]) ?? []) assert.ok(getCarsystemProductBySlug(slug), `${page.name}: nema proizvoda ${slug}`);
    });
  }
});

test("sadržaj nema oznake za potvrdu ni interne napomene", () => {
  for (const page of pages) {
    const text = JSON.stringify(page.data);
    assert.doesNotMatch(text, /"rev"\s*:\s*true|za stručnu potvrdu|za potvrdu|u doradi/i, page.name);
    assert.doesNotMatch(text, /\bkora(?:k|ku)\s+\d/, `${page.name}: upućivanje na broj koraka`);
  }
});

test("spisak slika bez potvrđenog prava je usklađen sa IMAGE_RIGHTS_REVIEW.csv", () => {
  execFileSync(process.execPath, [path.join(ROOT, "scripts/sistemi/sync-image-rights.mjs"), "--check"], { stdio: "pipe" });
});
