/*
 * Kupac ne vidi poreklo teksta (ZIP, folder, „lokalna dokumentacija",
 * „sažetak je izveden…") — provenance ostaje u podacima sync-a.
 * BEFAR i SATA brend strane ne prikazuju liste proizvoda.
 *
 *   npm run test:content-copy
 *   npm run build && CONTENT_CHECK_HTML=1 npm run test:content-copy
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { getAllCarsystemProducts, getCarsystemProductBySlug } from "@/lib/carsystem-data";

const FORBIDDEN = [
  "Sažetak je izveden",
  "Sažetak se zasniva",
  "dostavljenog ZIP",
  "dostavljenom ZIP",
  "Dokumentovana uloga proizvoda",
  "Lokalna dokumentacija",
  "povezani su direktno",
  "lokalno sačuvan",
  "product-information materijal",
  "Product-information PDF",
  "proizvodnom folderu",
  "Stranica ne pretpostavlja",
  "iz potvrđenog lokalnog kataloga",
  "iz ranijeg lokalnog zapisa",
  "U izvoru označeno",
  "Izvor navodi",
];

/** Polja koja nikad ne idu na stranicu (interna beleška, preporuke za rangiranje). */
const INTERNAL_KEYS = new Set(["internalReason", "reviewerNote", "recommendations", "evidence"]);

function visibleText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(visibleText).join("\n");
  if (value && typeof value === "object") {
    return Object.entries(value)
      .filter(([key]) => !INTERNAL_KEYS.has(key))
      .map(([, v]) => visibleText(v))
      .join("\n");
  }
  return "";
}

test("A 2210 ONYX ACTIVATOR: namena proizvoda bez porekla teksta", () => {
  const product = getCarsystemProductBySlug("2210-onyx-activator");
  assert.ok(product, "proizvod postoji");
  const text = visibleText(product);
  for (const phrase of FORBIDDEN) assert.ok(!text.includes(phrase), `„${phrase}" je vidljivo`);
  const benefits = product.detail?.benefits?.content;
  assert.equal(benefits?.title, "Namena proizvoda");
  assert.equal(benefits?.description, undefined);
  assert.deepEqual(benefits?.items.map((item) => item.title), ["Uloga u procesu"]);
});

test("nijedan PDP zapis ne nosi poreklo teksta u vidljivim poljima", () => {
  const offenders: string[] = [];
  for (const product of getAllCarsystemProducts()) {
    const text = visibleText(product);
    const hit = FORBIDDEN.find((phrase) => text.includes(phrase));
    if (hit) offenders.push(`${product.slug}: ${hit}`);
  }
  assert.deepEqual(offenders, []);
});

const appDir = path.resolve(process.cwd(), process.env.NEXT_DIST_DIR || ".next", "server/app");
const htmlSkip =
  process.env.CONTENT_CHECK_HTML !== "1"
    ? "postavite CONTENT_CHECK_HTML=1 posle builda"
    : fs.existsSync(appDir)
      ? false
      : `nema builda u ${appDir}`;
const html = (route: string) => fs.readFileSync(path.join(appDir, `${route}.html`), "utf8");

test("renderovan /proizvodi/2210-onyx-activator ne sadrži provenance fraze", { skip: htmlSkip }, () => {
  const page = html("proizvodi/2210-onyx-activator");
  for (const phrase of ["Sažetak je izveden", "dostavljenog ZIP-a", "Dokumentovana uloga proizvoda", "Lokalna dokumentacija", ...FORBIDDEN]) {
    assert.ok(!page.includes(phrase), `„${phrase}" je u HTML-u`);
  }
  assert.ok(page.includes("Namena proizvoda"), "nema sekcije „Namena proizvoda\"");
});

test("renderovane brend strane: BEFAR bez „Ostali Befar proizvodi na sajtu“, SATA bez liste proizvoda", { skip: htmlSkip }, () => {
  const befar = html("brendovi/befar");
  assert.ok(!/Ostali Befar proizvodi na sajtu/i.test(befar));
  assert.ok(befar.includes('href="/katalog?brend=befar"'), "BEFAR i dalje vodi u filtriran katalog");

  const sata = html("brendovi/sata");
  assert.ok(!sata.includes("Zašto je lista kratka"));
  assert.ok(sata.includes('href="/katalog?brend=sata"'), "SATA vodi u filtriran katalog");
  const productLinks = (sata.match(/href="\/proizvodi\//g) ?? []).length;
  assert.ok(productLinks === 0, `SATA brend strana i dalje linkuje ${productLinks} proizvoda`);
});
