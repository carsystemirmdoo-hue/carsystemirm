import assert from "node:assert/strict";
import test from "node:test";
import { brandOfSlug, legacyCategoryTarget, legacyProductTarget } from "./legacyRedirect.mjs";

const idx = [
  { href: "/proizvodi/grupa/baslac-line-35?varijanta=35-M1360", kind: "variant", brandSlug: "baslac", name: "Baslac 35-M1360 Red light" },
  { href: "/proizvodi/carsystem-micro-fiber-cloth-fluffy", kind: "standalone", brandSlug: "carsystem", name: "Carsystem Mikrofiber krpa Fluffy", terms: ["mikrofiber", "krpa", "fluffy"] },
  { href: "/proizvodi/sata-lcs-the-liner", kind: "standalone", brandSlug: "sata", name: "SATA LCS liner 0,85 L", terms: ["85l", "125"] },
  { href: "/proizvodi/rm-paste-za-mesanje", kind: "standalone", brandSlug: "rm", name: "R-M paste za mešanje", terms: ["bc", "881"] },
  { href: "/proizvodi/sata-wet-dry-cleaner", kind: "standalone", brandSlug: "sata", name: "SATA wet & dry cleaner", terms: ["881"] },
];

test("šifra iz starog naziva nalazi tačno jedan proizvod (i varijantu)", () => {
  assert.deepEqual(legacyProductTarget("baslac-35-m1360-05l-basecoat", idx), { destination: "/proizvodi/grupa/baslac-line-35?varijanta=35-M1360", reason: "proizvod" });
});

test("ista šifra u dva brenda: odlučuje brend iz naziva", () => {
  assert.equal(legacyProductTarget("rm-pasta-bc-881-crvena-1l", idx).destination, "/proizvodi/rm-paste-za-mesanje");
});

test("mera (85l, 40x35cm) nije šifra — bez sigurnog poklapanja ide na katalog, ne na pogrešan proizvod", () => {
  assert.deepEqual(legacyProductTarget("cb-85l-0-125", idx), { destination: "/katalog", reason: "katalog" });
  assert.equal(legacyProductTarget("jelenska-kozica-40x35cm", idx).destination, "/katalog");
});

test("bez šifre: gotovo sve reči u jednom zapisu brenda", () => {
  assert.equal(legacyProductTarget("cs-mikrofiber-krpa-fluffy/", idx).destination, "/proizvodi/carsystem-micro-fiber-cloth-fluffy");
});

test("nesigurno → stranica brenda; 3M je van programa → katalog", () => {
  assert.deepEqual(legacyProductTarget("cs-daska-za-mesanje-gita", idx), { destination: "/brendovi/carsystem", reason: "brend" });
  assert.equal(legacyProductTarget("3m-fast-cut-plus-zelena-250ml", idx).destination, "/katalog");
  assert.deepEqual(brandOfSlug("r-m-pasta"), { known: true, brand: "rm" });
});

test("stare kategorije → brend", () => {
  assert.equal(legacyCategoryTarget(["cosmos"]), "/brendovi/cosmos-lac");
  assert.equal(legacyCategoryTarget(["r-m", "linije-boja", "uno-hd"]), "/brendovi/rm");
  assert.equal(legacyCategoryTarget(["car-fit", "page", "2"]), "/brendovi/carfit");
  assert.equal(legacyCategoryTarget(["3m", "poliranje-3m"]), "/katalog");
  assert.equal(legacyCategoryTarget(["nepoznato"]), "/katalog");
});
