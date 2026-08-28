#!/usr/bin/env node
/**
 * Validator identiteta proizvoda nad STVARNIM runtime katalogom.
 *
 * Proverava ono što danas ništa ne proverava: jedinstvenost sluga, oblik i
 * jedinstvenost interne šifre, oblik šifre proizvođača i dvosmislenost
 * `?varijanta=` ključa unutar `variant-pdp` porodica.
 *
 * Dva režima, namerno:
 *
 *   audit (podrazumevano)  izlaz 0, ali PRIJAVLJUJE svaki zatečeni konflikt
 *   --strict               izlaz 1 na bilo koji konflikt
 *
 * Razlog: katalog danas ima poznate konflikte (duplirani slug `baslac-35-m214`,
 * sudari ključa varijante u Cosmos porodicama). Oni se rešavaju u koraku 2B, uz
 * odluku o vlasništvu nad ručno pisanim naspram generisanog zapisa. Do tada
 * validator mora da ih pokaže, ali ne sme da obori svaki build.
 *
 * NEMA allowliste konkretnih slugova. Allowlist bi konflikt učinio nevidljivim
 * i time zamenio rešavanje problema — režim ga i dalje broji i ispisuje.
 * `catalog:validate` uključuje audit režim; `--strict` se dodaje tek kad 2B
 * očisti zatečene konflikte.
 *
 * Usage:
 *   node scripts/validate-product-identity.mjs [--strict] [--json]
 */

import { auditProductIdentity } from "../lib/catalog/product-identity.mjs";
import { loadCatalogRuntime } from "./lib/catalog-runtime.mjs";

const args = new Set(process.argv.slice(2));
const strict = args.has("--strict");
const asJson = args.has("--json");

const { products, families, productVariantKey } = loadCatalogRuntime();
const report = auditProductIdentity({
  products,
  families,
  variantKeyOf: productVariantKey,
});

if (asJson) {
  console.log(JSON.stringify({ mode: strict ? "strict" : "audit", ...report }, null, 2));
} else {
  console.log(
    JSON.stringify(
      {
        mode: strict ? "strict" : "audit",
        totals: report.totals,
        skuSemantics: report.skuSemantics,
        conflictsByKind: report.conflictsByKind,
      },
      null,
      2,
    ),
  );

  if (report.hasConflicts) {
    console.log(`\nZatečeni konflikti (${report.conflicts.length}):`);
    for (const conflict of report.conflicts) {
      console.log(`  [${conflict.kind}] ${conflict.message}`);
    }
  } else {
    console.log("\nNijedan konflikt identiteta nije pronađen.");
  }
}

if (strict && report.hasConflicts) {
  console.error(
    `\nStrict režim: ${report.conflicts.length} konflikata identiteta. Build se obara.`,
  );
  process.exit(1);
}

if (report.hasConflicts) {
  console.log(
    "\nAudit režim: konflikti su prijavljeni, izlaz je 0. Razrešenje je predviđeno za korak 2B.",
  );
}
