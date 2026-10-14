import { test } from "node:test";
import assert from "node:assert/strict";
import { getCarsystemProductBySlug } from "@/lib/carsystem-data";
import { applyVerifiedThousands, verifiedThousands } from "@/lib/verified-thousands";

test("potvrđene hiljade: samo navedeni proizvod i tačan zapis", () => {
  assert.equal(applyVerifiedThousands("carsystem-rupes-vacuum-cleaner-s145", "Snaga je 1,200 W"), "Snaga je 1.200 W");
  assert.equal(applyVerifiedThousands("carfit-zinc-spray", "1,095 g/cm³"), "1,095 g/cm³");
  assert.equal(applyVerifiedThousands("carsystem-speedmixer-3-kg", "kartuša 2,523 kg"), "kartuša 2,523 kg");
  for (const fixes of Object.values(verifiedThousands)) for (const fix of fixes) assert.ok(fix.evidence.length > 10, fix.from);
});

test("prikaz proizvoda: potvrđene vrednosti promenjene, C.A.R.FIT decimale netaknute", () => {
  const all = (slug: string) => JSON.stringify(getCarsystemProductBySlug(slug));
  assert.match(all("carsystem-rupes-mini-random-orbital-sander-ld30"), /7\.500 o\/min/);
  assert.doesNotMatch(all("carsystem-rupes-mini-random-orbital-sander-ld30"), /7,500 o\/min/);
  assert.match(all("carsystem-colour-match-lamp"), /2\.700 K/);
  assert.match(all("carsystem-polyester-repair-resin"), /1\.000 g/);
  assert.match(all("carfit-zinc-spray"), /1,095 g\/cm³/);
  assert.match(all("carfit-cutting-compound"), /168,408 g\/l/);
  assert.match(all("carfit-finishing-compound"), /13,536% \(136,718 g\/l\)/);
});

test("fini kit 124.126: dvosmislena količina se kupcu ne prikazuje kao pakovanje", async () => {
  const { unverifiedQuantities } = await import("@/lib/unverified-quantities");
  const all = JSON.stringify(getCarsystemProductBySlug("carsystem-fine-putty"));
  assert.doesNotMatch(all, /1[.,]000 g/);
  assert.match(all, /veličina pakovanja se potvrđuje na upit/);
  assert.equal(unverifiedQuantities["carsystem-fine-putty"].status, "otvoreno");
  // Kit za popunjavanje (potvrđen fotografijom) ostaje 1.000 g.
  assert.match(JSON.stringify(getCarsystemProductBySlug("carsystem-fill-putty")), /1\.000 g/);
});
