import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const systems = await readFile(new URL("./baslac-systems.ts", import.meta.url), "utf8");
const catalog = await readFile(new URL("./baslac-catalog-products.ts", import.meta.url), "utf8");

function countBases(system) {
  return (systems.match(new RegExp(`base\\("${system}",`, "g")) ?? []).length;
}
function activeCount(system) {
  // Svaki zapis pocinje sa `base("`; blok traje do sledeceg takvog poziva.
  return systems
    .split('base("')
    .slice(1)
    .filter((chunk) => chunk.startsWith(`${system}",`))
    .filter(
      (chunk) => !/productionStatus: "(PHASE_OUT|DISCONTINUED|UNVERIFIED)"/.test(chunk),
    ).length;
}

test("ukupan broj baza po sistemu odgovara katalogu proizvodjaca", () => {
  // +7 / +3 (2026-10-21): artikli iz našeg šifarnika sa zvanično potvrđenom šifrom (tabela 03/2021, portal, baslac.com).
  assert.equal(countBases("line-45"), 80);
  assert.equal(countBases("line-35"), 62);
  assert.equal(countBases("line-30"), 22);
  assert.equal(countBases("line-30-cv"), 1);
});

test("javno aktivnih varijanti je 156", () => {
  const counts = {
    "line-45": activeCount("line-45"),
    "line-35": activeCount("line-35"),
    "line-30": activeCount("line-30"),
    "line-30-cv": activeCount("line-30-cv"),
  };
  assert.equal(counts["line-45"], 77);
  assert.equal(counts["line-35"], 58);
  assert.equal(counts["line-30"], 20);
  assert.equal(counts["line-30-cv"], 1);
  assert.equal(Object.values(counts).reduce((a, b) => a + b, 0), 156);
});

test("javni selektor propusta samo ACTIVE_CONFIRMED", () => {
  assert.match(
    systems,
    /export function baslacPublicBases[\s\S]*?item\.productionStatus === "ACTIVE_CONFIRMED"/,
  );
});

test("30-S510 je UNVERIFIED i ne ulazi u katalog", () => {
  assert.match(systems, /"30-S510"[\s\S]{0,400}?productionStatus: "UNVERIFIED"/);
  assert.match(
    catalog,
    /base\.productionStatus === "ACTIVE_CONFIRMED"/,
    "katalog generise samo aktivne baze",
  );
  assert.doesNotMatch(systems, /"30-S510"[\s\S]{0,200}?productionStatus: "ACTIVE_CONFIRMED"/);
});

test("phase-out baze su evidentirane ali van kataloga", () => {
  const phaseOut = (systems.match(/productionStatus: "PHASE_OUT"/g) ?? []).length;
  assert.equal(phaseOut, 8, "8 phase-out baza ostaje u evidenciji");
});

test("katalog ne hardkoduje stanje ni cenu", () => {
  assert.doesNotMatch(catalog, /inStock|stockStatus:\s*"in_stock"|price:\s*\d/);
  assert.match(catalog, /inventoryKey/);
});

test("family packshot se bira po zapremini, bez zamene pakovanja", () => {
  assert.match(catalog, /const FAMILY_PACKSHOTS/);
  assert.match(catalog, /"line-35:3\.5": "\/products\/baslac\/baslac--line-35-3\.5l-family-packshot\.webp"/);
  assert.match(catalog, /"line-35:1": null/);
  assert.match(catalog, /"line-35:0\.5": null/);
  assert.match(catalog, /"line-30:1": null/);
});

test("pretraga radi sa i bez crtice", () => {
  assert.match(systems, /item\.code\.replace\(\/-\/g, ""\)/);
  assert.match(systems, /item\.code\.replace\(\/-\/g, " "\)/);
});

test("sistemski PDP je odmah PDP, bez medjukoraka", async () => {
  const adapter = await readFile(
    new URL("../components/baslac-brand/BaslacSystemPdp.tsx", import.meta.url),
    "utf8",
  );
  // 2026-10-21: raspored i izbor su u zajedničkoj komponenti (Baslac i R-M).
  const pdp = await readFile(
    new URL("../components/product/family/FamilyBasePdp.tsx", import.meta.url),
    "utf8",
  );
  // Sve baze su na istoj stranici: bez paginacije i bez linka na drugu stranu.
  assert.match(adapter, /baslacPublicBases\(system\)/);
  assert.doesNotMatch(pdp, /Prika[zž]i slede[ćc]|paginat|page=\d/i);
  // Aktivna varijanta ima jasno stanje; grupni izbor je uklonjen sa javnog PDP-a.
  assert.match(pdp, /data-active=\{isActive \|\| undefined\}/);
  assert.match(pdp, /aria-pressed=\{isActive\}/);
  assert.doesNotMatch(pdp, /data-picked|pickButton/);
  // URL se menja bez reloada i BEZ novog koraka istorije; Back vraća na prethodnu stranu.
  assert.match(pdp, /window\.history\.replaceState/);
  assert.doesNotMatch(pdp, /window\.history\.pushState/);
  assert.match(pdp, /addEventListener\("popstate"/);
  // Javni PDP ne sme imati cart sloj — CTA je upit.
  assert.doesNotMatch(pdp, /components\/cart\/CartProvider/);
  assert.match(pdp, /Pošaljite upit/);
});

test("stari variant URL vodi na family PDP sa preselektovanom varijantom", () => {
  assert.match(catalog, /export function baslacVariantRedirect/);
  assert.match(catalog, /\/proizvodi\/grupa\/\$\{familySlug\}\?varijanta=/);
});

test("mala kartica baze ne ponavlja fotografiju limenke", async () => {
  const pdp = await readFile(
    new URL("../components/product/family/FamilyBasePdp.tsx", import.meta.url),
    "utf8",
  );
  const grid = pdp.slice(pdp.indexOf("<ul className={layout(\"grid\")}>"), pdp.indexOf("</ul>"));
  assert.doesNotMatch(grid, /<Image/);
  assert.match(grid, /styles\.swatch/);
});

test("generator daje polja koja zajednicki selektor porodice cita", () => {
  /*
   * Ove dve tvrdnje su ranije stajale u `components/product/
   * productVariantSurface.test.mjs`. Tamo su vezivale PDP test za Baslac
   * fajlove, iako je predmet provere generator, a ne zajednicki sloj.
   *
   * `getFamilyVariantSelector` u `lib/carsystem-data.ts` grupise varijante po
   * `catalogMetadata.baseProductSlug` i propusta samo statuse iz
   * `SELECTABLE_VARIANT_STATUSES`. Da generator prestane da postavlja ta dva
   * polja, Baslac porodice bi tiho ostale bez biraca varijante.
   */
  assert.match(catalog, /baseProductSlug: variant\.family/);
  assert.match(catalog, /verificationStatus: "ACTIVE_CONFIRMED"/);
});

test("tehnički list sistema je zvanični TDS linije iz baslac synca i postoji lokalno", async () => {
  const { existsSync } = await import("node:fs");
  const source = JSON.parse(
    await readFile(new URL("../data/baslac-sync/source-products.generated.json", import.meta.url), "utf8"),
  );
  for (const system of source.systems) {
    const block = catalog.split("baseProductSlug: ").find((chunk) => chunk.startsWith(`"${system.familySlug}",`));
    assert.ok(block, `nema definicije za ${system.familySlug}`);
    const href = /lineDocument: \{\s*href: "([^"]+)"/.exec(block)?.[1];
    assert.equal(href, system.lineDocument.localPath, system.familySlug);
    assert.ok(block.includes(`sourceUrl: "${system.lineDocument.url}"`), system.familySlug);
    assert.ok(existsSync(new URL(`../public${href}`, import.meta.url)), href);
  }
});
