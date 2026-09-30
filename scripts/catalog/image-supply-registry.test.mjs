import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  PORTAL_SOURCE_DETAIL,
  isLegacyLockMetadata,
  lockMetadataErrors,
  nextLockMetadata,
  validateSuppliedRegistry,
} from "./image-supply-registry.mjs";

const registry = JSON.parse(readFileSync(new URL("../../data/catalog/image-supply/supplied-images.json", import.meta.url), "utf8"));
const lock = JSON.parse(readFileSync(new URL("../../data/catalog/image-supply/manifest-lock.json", import.meta.url), "utf8"));

const legacy = { createdFromMainSha: "e679765", metadata: { approvedAt: "2026-09-25", note: "approvedAt je samo metapodatak" } };

test("svi postojeći zapisi registra prolaze (OWNER_SUPPLIED i SUPPLIER_BRAND_PORTAL)", () => {
  assert.deepEqual(validateSuppliedRegistry(registry), []);
  assert.ok(registry.images.some((image) => image.sourceBasis === "OWNER_SUPPLIED"));
  assert.ok(registry.images.some((image) => image.sourceBasis === "SUPPLIER_BRAND_PORTAL"));
  assert.ok(Object.hasOwn(registry.provenanceModel.sourceBasis, "SUPPLIER_BRAND_PORTAL"));
});

test("vrednost porekla van provenanceModel-a se odbija", () => {
  const broken = structuredClone(registry);
  broken.images[0].sourceBasis = "NEPOZNATO";
  assert.match(validateSuppliedRegistry(broken).join("\n"), /sourceBasis „NEPOZNATO” nije u provenanceModel/);
});

test("slika sa portala mora nositi potpuno poreklo", () => {
  const broken = structuredClone(registry);
  const portal = broken.images.find((image) => image.sourceBasis === "SUPPLIER_BRAND_PORTAL");
  for (const field of PORTAL_SOURCE_DETAIL) {
    const copy = structuredClone(broken);
    delete copy.images.find((image) => image.imageId === portal.imageId).sourceDetail[field];
    assert.match(validateSuppliedRegistry(copy).join("\n"), new RegExp(`sourceDetail\\.${field} nedostaje`), field);
  }
  portal.alt = "  ";
  assert.match(validateSuppliedRegistry(broken).join("\n"), /alt mora biti neprazan/);
});

test("stari oblik lock-a ostaje važeći i ne tumači se kao ljudsko odobrenje", () => {
  assert.equal(isLegacyLockMetadata(legacy.metadata), true);
  assert.deepEqual(lockMetadataErrors(legacy.metadata), []);
  // Nepromenjen sadržaj: stari metapodaci ostaju bajt-identični.
  assert.equal(nextLockMetadata({ previous: legacy, unchanged: true, today: "2026-09-29" }), legacy.metadata);

  const next = nextLockMetadata({ previous: legacy, unchanged: false, today: "2026-09-29" });
  assert.equal(next.generatedOn, "2026-09-29");
  assert.equal(next.approvedAt, null);
  assert.equal(next.approvedBy, null);
  assert.equal(next.previousLockMetadata.legacyGeneratorDate, "2026-09-25");
  assert.equal("approvedAt" in next.previousLockMetadata, false);
  assert.equal(next.previousLockMetadata.createdFromMainSha, "e679765");
});

test("generator nikad ne upisuje odobrenje; ljudsko odobrenje se prenosi kao trag", () => {
  const approved = { createdFromMainSha: "abc", metadata: { generatedOn: "2026-09-28", approvedAt: "2026-10-01", approvedBy: "vlasnik", note: "x" } };
  assert.deepEqual(lockMetadataErrors(approved.metadata), []);
  const next = nextLockMetadata({ previous: approved, unchanged: false, today: "2026-10-02" });
  assert.equal(next.approvedAt, null);
  assert.equal(next.approvedBy, null);
  assert.deepEqual(next.previousLockMetadata, { generatedOn: "2026-09-28", approvedAt: "2026-10-01", approvedBy: "vlasnik", createdFromMainSha: "abc" });
  // Lanac se ne ugnježđava.
  assert.equal("previousLockMetadata" in next.previousLockMetadata, false);
});

test("nepotpuno odobrenje u novom obliku je greška", () => {
  assert.equal(lockMetadataErrors({ generatedOn: "2026-09-28", approvedAt: "2026-10-01", approvedBy: null }).length, 1);
  assert.equal(lockMetadataErrors({ generatedOn: "2026-09-28", approvedAt: null, approvedBy: "vlasnik" }).length, 1);
  assert.equal(lockMetadataErrors({ generatedOn: "28.09.2026", approvedAt: null, approvedBy: null }).length, 1);
});

test("trenutni lock: generisan, neodobren, prethodni trag nikad nije odobrenje", () => {
  assert.deepEqual(lockMetadataErrors(lock.metadata), []);
  assert.equal(lock.metadata.approvedAt, null);
  assert.equal(lock.metadata.approvedBy, null);
  // Lanac drži samo JEDAN prethodni korak (istorija je u Gitu), pa se posle svake
  // regeneracije trag menja; proverava se oblik, ne jedna istorijska vrednost.
  const previous = lock.metadata.previousLockMetadata;
  if (!previous) return;
  if ("legacyGeneratorDate" in previous) {
    assert.match(previous.interpretation, /nije dokaz ljudskog odobrenja/);
  } else {
    assert.match(previous.generatedOn, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(Boolean(previous.approvedAt), Boolean(previous.approvedBy), "prethodno odobrenje je potpuno ili ga nema");
  }
});
