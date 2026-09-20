/**
 * Slika i dokumentacija pripadaju AKTIVNOJ varijanti, ne porodici.
 *
 * Dva kvara koja ovo zaključava, oba nađena ručnim pregledom Norbin porodice N15-020:
 *
 *   1. bezbednosni list je vezan za PAKOVANJE, ali se skup dokumenata računao jednom — iz
 *      zapisa koji je server izabrao — pa su se listovi za 1 L i 5 L prikazivali zajedno i
 *      nisu se menjali izborom pakovanja;
 *   2. varijanta bez sopstvene slike ne sme da pozajmi sliku susednog pakovanja; ona ima
 *      placeholder, jer „nema svoju sliku" i „porodica ima sliku drugog pakovanja" nisu
 *      isto stanje.
 *
 * Test nije vezan za brend: prvi deo radi nad izmišljenim varijantama, drugi nad SVAKOM
 * porodicom stvarnog kataloga.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { loadCatalogRuntime } from "../../scripts/lib/catalog-runtime.mjs";
import { expandRowVariants, resolveActiveVariant } from "./productVariantState.mjs";

const read = (relative) => readFile(new URL(relative, import.meta.url), "utf8");

const doc = (title, href) => ({ id: `${title}-${href}`, title, kind: title.includes("Bezbednosni") ? "sds" : "tds", availability: "available", href, reviewStatus: "confirmed" });
const TDS = doc("Tehnički list", "https://example.test/tds.pdf");
const SDS_1L = doc("Bezbednosni list — 1 L", "https://example.test/sds-1l.pdf");
const SDS_5L = doc("Bezbednosni list — 5 L", "https://example.test/sds-5l.pdf");

const VIEWS = [
  { key: "A-1L", id: "1l", slug: "a-1l", name: "A 1 L", sku: "A-1L", images: [{ src: "/a-1l.webp", alt: "", contrastMode: "neutral" }], documents: [TDS, SDS_1L] },
  { key: "A-5L", id: "5l", slug: "a-5l", name: "A 5 L", sku: "A-5L", images: [], documents: [TDS, SDS_5L] },
];

test("dokument pakovanja ne curi na drugo pakovanje", () => {
  const first = resolveActiveVariant(VIEWS, "A-1L", "A-1L");
  const second = resolveActiveVariant(VIEWS, "A-5L", "A-1L");
  assert.deepEqual(first.documents.map((entry) => entry.title), ["Tehnički list", "Bezbednosni list — 1 L"]);
  assert.deepEqual(second.documents.map((entry) => entry.title), ["Tehnički list", "Bezbednosni list — 5 L"]);
  // Zajednički tehnički list stoji na obe varijante — to je i definicija „zajedničkog".
  assert.ok(first.documents.includes(TDS) && second.documents.includes(TDS));
  assert.ok(!second.documents.includes(SDS_1L), "list za 1 L ne sme na varijantu od 5 L");
  assert.ok(!first.documents.includes(SDS_5L), "list za 5 L ne sme na varijantu od 1 L");
});

test("varijanta bez svoje slike NE pozajmljuje sliku drugog pakovanja", () => {
  const withoutImage = resolveActiveVariant(VIEWS, "A-5L", "A-1L");
  assert.deepEqual(withoutImage.images, [], "prazna lista znači placeholder, ne tuđa slika");
  assert.equal(resolveActiveVariant(VIEWS, "A-1L", "A-1L").images[0].src, "/a-1l.webp");
});

test("redovi tabele šifara nasleđuju dokumente svog proizvoda", () => {
  const base = { key: "100.001", id: "d", slug: "d", name: "D", sku: "100.001", images: [], documents: [TDS] };
  const rows = [
    { id: "100.001", label: "Bela", sku: "100.001" },
    { id: "100.002", label: "Crna", sku: "100.002" },
  ];
  const views = expandRowVariants(base, rows, (src, row) => ({ src, alt: row.label, contrastMode: "neutral" }));
  assert.equal(views.length, 2);
  // Red nije zaseban zapis, pa nema svoje dokumente — nasleđuje proizvodove.
  for (const view of views) assert.deepEqual(view.documents, [TDS]);
});

test("PDP i pogled varijante dele JEDAN izvor dokumenata", async () => {
  const view = await read("./productVariantView.ts");
  assert.match(view, /documents: getProductDocuments\(product\)/);
  const page = await read("./ProductDetailPage.tsx");
  assert.match(page, /getProductDocuments\(product\)/);
  const accordion = await read("./ProductInformationAccordion.tsx");
  // Dokumentacija čita aktivnu varijantu, uz pad na server prop van porodice.
  assert.match(accordion, /variant\?\.activeVariant\.documents \?\? serverDocuments/);
});

test("stvarni katalog: nijedna varijanta ne nosi dokument drugog pakovanja", () => {
  const runtime = loadCatalogRuntime();
  const { toProductVariantViews } = runtime.requireModule("components/product/productVariantView.ts");

  /** Oznaka pakovanja ovog zapisa, onako kako je izvor piše („1 L", „2,5 L", „0,05 kg"). */
  const packOf = (product) => product.catalogMetadata?.volume ?? product.packages?.[0]?.label ?? null;
  const mentionsPack = (document, pack) => new RegExp(`(^|[^0-9,.])${pack.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\b|$)`).test(`${document.title} ${document.href ?? ""}`);

  let checkedVariants = 0;
  let packageSpecificDocuments = 0;
  for (const family of runtime.families) {
    if (family.variants.length < 2) continue;
    const packs = family.variants.map(packOf);
    if (new Set(packs.filter(Boolean)).size < 2) continue;

    const views = toProductVariantViews(family.variants, family.slug, []);
    for (const [index, view] of views.entries()) {
      const own = packs[index];
      if (!own) continue;
      checkedVariants += 1;
      const foreign = packs.filter((pack, other) => pack && other !== index && pack !== own);
      for (const document of view.documents ?? []) {
        if (mentionsPack(document, own)) packageSpecificDocuments += 1;
        for (const pack of foreign) {
          assert.ok(
            !(mentionsPack(document, pack) && !mentionsPack(document, own)),
            `${view.slug} (${own}): nosi dokument pakovanja ${pack} — „${document.title}"`,
          );
        }
      }
    }
  }
  assert.ok(checkedVariants > 0, "nijedna porodica sa različitim pakovanjima nije proverena");
  // Bar jedan dokument je STVARNO vezan za pakovanje — inače test ništa ne meri.
  assert.ok(packageSpecificDocuments > 0, "nijedan dokument nije vezan za pakovanje");
});

test("stvarni katalog: varijanta bez slike nema sliku susedne varijante", () => {
  const runtime = loadCatalogRuntime();
  const { toProductVariantViews } = runtime.requireModule("components/product/productVariantView.ts");

  let mixedFamilies = 0;
  for (const family of runtime.families) {
    if (family.variants.length < 2) continue;
    const views = toProductVariantViews(family.variants, family.slug, []);
    const withImage = views.filter((view) => view.images.length);
    const without = views.filter((view) => !view.images.length);
    if (!withImage.length || !without.length) continue;
    mixedFamilies += 1;

    const borrowed = new Set(withImage.flatMap((view) => view.images.map((image) => image.src)));
    for (const view of without) {
      assert.equal(view.images.length, 0, `${view.slug}: dobio je sliku iako je nema`);
      for (const src of borrowed) assert.ok(!view.images.some((image) => image.src === src), `${view.slug}: pozajmio sliku susedne varijante`);
    }
  }
  assert.ok(mixedFamilies > 0, "nijedna porodica nema mešovito stanje slika — test ništa ne meri");
});
