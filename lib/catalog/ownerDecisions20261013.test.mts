/*
 * Odluke vlasnika 2026-10-13 u javnom katalogu (bez internih šifara i cena).
 *
 *   npm run test:rm-brand
 */
import assert from "node:assert/strict";
import test from "node:test";

import { baslacLine35Bases } from "@/lib/baslac-systems";
import { getCarsystemProductBySlug } from "@/lib/carsystem-data";

const INTERNAL = /BizniSoft|ERP|vlasnik|interna šifra/i;
const publicText = (slug: string) => JSON.stringify(getCarsystemProductBySlug(slug));

test("R-M: SC 850, H 9000, STARTOP HS, SM 09 i BASIC imaju zasebne kartice sa zvaničnim tehničkim listom", () => {
  for (const [slug, sku] of [
    ["rm-sc-850-thinner-medium", "SC 850"],
    ["rm-h-9000-hardener-medium", "H 9000"],
    ["rm-c-1450-startop-hs", "C 1450"],
    ["rm-sm-09-special-mat-09", "SM 09"],
    ["rm-c-1150-basic-clear", "C 1150"],
    ["rm-h-1150-basic-hardener", "H 1150"],
  ]) {
    const product = getCarsystemProductBySlug(slug);
    assert.ok(product, slug);
    assert.equal(product.brandSlug, "rm");
    assert.equal(product.sku, sku);
    assert.ok(product.documents.some((d) => d.status === "available" && d.href?.startsWith("https://techinfo.rmpaint.com/")), slug);
    assert.doesNotMatch(publicText(slug), INTERNAL, slug);
    for (const related of product.relatedProductSlugs ?? []) assert.ok(getCarsystemProductBySlug(related), `${slug} → ${related}`);
  }
});

test("R-M CRYSTAL BASE pripada sistemu crystal-base (veza sa stranicom brenda)", () => {
  assert.equal(getCarsystemProductBySlug("rm-diamont-crystal-base")?.rmMetadata?.system, "crystal-base");
});

test("C.A.R.FIT cediljke: kartica prikazuje samo 190 µm (naša ponuda)", () => {
  const product = getCarsystemProductBySlug("carfit-disposable-paint-strainers")!;
  assert.equal(product.manufacturerCode, "7-850-0190");
  assert.equal(product.detail?.variants, undefined);
  assert.doesNotMatch(publicText("carfit-disposable-paint-strainers"), /7-850-0125|125 μm|125 µm/);
  assert.match(publicText("carfit-disposable-paint-strainers"), /pakovanje od 250 cediljki/);
});

test("C.A.R.FIT Premium Soft Plus: kartica sa zvaničnim šiframa iz kataloga 2026", () => {
  const product = getCarsystemProductBySlug("carfit-premium-soft-plus-putty")!;
  assert.equal(product.brandSlug, "carfit");
  assert.deepEqual(product.detail?.variants?.content.rows.map((row) => row.id), ["2-253-1800", "2-253-4700"]);
  assert.doesNotMatch(publicText("carfit-premium-soft-plus-putty"), INTERNAL);
});

test("Carsystem Paint Strainer je BOX pakovanje (obe gustine ostaju)", () => {
  const text = publicText("carsystem-paint-strainer");
  assert.match(text, /BOX — dispenzer kutija sa 250 cediljki/);
  assert.match(text, /125 µ/);
  assert.match(text, /190 µ/);
});

test("baslac: kartica prikazuje naše pakovanje, zvanična KLW zapremina ostaje zapisana", () => {
  const by = (code: string) => baslacLine35Bases.find((b) => b.code === code)!;
  for (const [code, ours, official] of [["35-M1370", 1, 0.5], ["35-M391", 1, 0.5], ["35-M1420", 0.5, 1]] as const) {
    assert.equal(by(code).volumeL, ours, code);
    assert.equal(by(code).officialVolumeL, official, code);
    assert.match(by(code).inventoryKey, new RegExp(`:${String(official).replace(".", "-")}l$`), `${code}: ključ za spajanje se ne menja`);
  }
  assert.equal(by("35-M1390").volumeL, 0.5, "35-M1390 je 0,5 L (ranija potvrda za 1 L povučena)");
  assert.equal(by("35-M1390").officialVolumeL, undefined);
});

test("uklonjeno 2026-10-13: Easy Mask, 35-M1521, stare R-M paste 190; CPS 2.0 bez dve varijante", () => {
  for (const slug of ["carsystem-easy-mask", "baslac-35-m1521", "rm-pasta-190-1l", "rm-pasta-190-5l"]) assert.equal(getCarsystemProductBySlug(slug), undefined, slug);
  const cps = getCarsystemProductBySlug("carsystem-paint-system-cps-2-0")!;
  const rows = cps.detail?.variants?.content.rows.map((r) => r.id) ?? [];
  assert.ok(rows.length >= 2 && !rows.includes("159.312") && !rows.includes("159.643"), rows.join(", "));
  const paste = getCarsystemProductBySlug("rm-paste-za-mesanje")!;
  assert.equal(paste.detail?.variants?.content.rows.length, 20);
  assert.doesNotMatch(JSON.stringify(paste), /(?<![,\d])5 L/, "bez pogrešnog pakovanja 5 L");
  assert.doesNotMatch(JSON.stringify(paste), INTERNAL);
  assert.deepEqual(getCarsystemProductBySlug("carfit-nitrile-gloves-6-mil")!.detail?.variants?.content.rows.map((r) => r.id), ["3-260-0350", "3-260-0450", "3-260-0550", "3-260-0650"]);
});

test("etikete 2026-10-13: Befar 04405 na kartici; FPS redovi nose zapreminu sa etikete", () => {
  const befar = getCarsystemProductBySlug("befar-velcro-polishing-pad")!;
  const ids = befar.detail?.variants?.content.rows.map((r) => r.id) ?? [];
  assert.equal(ids[ids.indexOf("04404") + 1], "04405");
  const fps = JSON.stringify(getCarsystemProductBySlug("carfit-fast-paint-system"));
  for (const label of ["Čvrsta čaša sa prstenom · 650 ml", "Unutrašnje čaše 190 μm, 25 kom. · 400 ml", "Unutrašnje čaše 190 μm, 25 kom. · 650 ml"]) assert.ok(fps.includes(label), label);
});
