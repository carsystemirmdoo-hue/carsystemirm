import { test } from "node:test";
import assert from "node:assert/strict";
import { getRmSystemNavigation, rmSelectionPackSummary } from "./rm-system-navigation";
import { getCarsystemProductBySlug } from "./carsystem-data";

test("DIAMONT: prezentacija i var CV vode na izbor baza, sa brojem baza po zapremini", () => {
  for (const slug of ["rm-diamont", "rm-diamont-bazna-boja", "rm-diamont-crystal-base", "rm-paste-za-mesanje", "rm-d-403-diamont-jet-black"]) {
    const navigation = getRmSystemNavigation(slug);
    assert.equal(navigation?.line, "DIAMONT", slug);
    const selection = navigation!.links.find((link) => link.slug === "rm-diamont-bazna-boja");
    assert.ok(selection?.selection, slug);
  }
  assert.equal(rmSelectionPackSummary("rm-diamont-bazna-boja"), "4 L: 6 · 1 L: 15 · 0,5 L: 14");
  const links = getRmSystemNavigation("rm-diamont")!.links;
  assert.equal(links.find((link) => link.slug === "rm-diamont")?.label, "R-M DIAMONT var CV");
  assert.match(links.find((link) => link.slug === "rm-diamont")!.note, /komercijalna vozila/);
  assert.equal(getCarsystemProductBySlug("rm-diamont")?.name, "R-M DIAMONT var CV");
});

test("članstvo u liniji je iz zvaničnog polja, ne iz sličnog naziva", () => {
  // D 121 ULTRA FLASH FLAKE DIAMOND nema liniju u R-M izvoru — nije deo DIAMONT navigacije.
  assert.equal(getRmSystemNavigation("rm-d-121-ultra-flash-flake-diamond"), null);
  const onyx = getRmSystemNavigation("rm-onyx-hd")!;
  assert.equal(onyx.links[0].slug, "rm-onyx-hd", "prezentacija sistema prva");
  assert.ok(onyx.links.every((link) => !link.selection), "ONYX HD nema karticu izbora baza");
  assert.match(onyx.note ?? "", /nisu u katalogu za izbor/);
  const uno = getRmSystemNavigation("rm-uno-hd")!;
  assert.ok(uno.links.some((link) => link.slug === "rm-sc-t2a204-mat-black"));
  assert.match(uno.note ?? "", /SC 10/);
});

test("R-M kartice sa istim zvaničnim nazivom razlikuju se zvaničnom oznakom", async () => {
  const { getRmCatalogProducts } = await import("./rm-catalog-products");
  const names = getRmCatalogProducts().map((product) => product.name);
  assert.equal(new Set(names).size, names.length, "nijedan R-M naslov se ne ponavlja");
  assert.ok(names.includes("R-M Pure black SC T2A203") && names.includes("R-M Pure black SC T2P203"));
  assert.ok(names.includes("R-M GHD THINNER GV 300"));
});

test("ONYX HD blok: baze i boje odvojene od pomoćnih proizvoda; prezentacija nije izbor", () => {
  const onyx = getRmSystemNavigation("rm-onyx-hd")!;
  const group = (slug: string) => onyx.links.find((link) => link.slug === slug)?.group;
  assert.equal(group("rm-db-403-onyx-hd-deep-black"), "products", "vodorazrediva bazna boja nije razređivač");
  assert.equal(group("rm-hb-10s-gleam-silver-onyx-hd"), "products");
  assert.equal(group("rm-a-2610-onyx-interior"), "auxiliary");
  assert.equal(group("rm-onyx-blender-plus"), "auxiliary");
  assert.equal(group("rm-onyx-hd-tropical"), "presentation");
  assert.match(onyx.links.find((link) => link.slug === "rm-hb-002-onyx-hd")!.note, /druga formulacija, za komercijalna vozila \(CV\)/);
  // DIAMONT: izbor baza po zapremini vodi direktno na tu zapreminu.
  const diamont = getRmSystemNavigation("rm-diamont")!.links.filter((link) => link.group === "selection" && link.href.includes("rm-diamont-bazna-boja"));
  assert.deepEqual(diamont.map((link) => link.href), [
    "/proizvodi/rm-diamont-bazna-boja?pakovanje=0-5-l",
    "/proizvodi/rm-diamont-bazna-boja?pakovanje=1-l",
    "/proizvodi/rm-diamont-bazna-boja?pakovanje=4-l",
  ]);
});
