import assert from "node:assert/strict";
import test from "node:test";

import {
  ACTOR_SYSTEM,
  ALLOWED_TRANSITIONS,
  actionFor,
  customerFacingDisclosure,
  isBiznisoftConfirmed,
  isOfficeRecorded,
  lastInvoicedPriceLabel,
  participatesInPricing,
  PRICE_RULE_STATUSES,
  rejectTransition,
  TRANSITION_CAPABILITY,
} from "./workflow.mjs";
import { resolveCapabilities } from "../authz/permissions.mjs";
import * as capabilityModel from "../authz/permissions.mjs";

const komercijalista = resolveCapabilities("komercijalista", ["cene_predlog"]);
const gazda = resolveCapabilities("gazda");
const kancelarija = resolveCapabilities("kancelarija", ["cene_primena"]);
const odobravac = resolveCapabilities("komercijalista", ["cene_odobravanje"]);

/* -------------------------------------------------------------------------
 * Osam stanja
 * ---------------------------------------------------------------------- */

test("postoji tacno devet stanja, ista u modelu i u prelazima", () => {
  assert.deepEqual(PRICE_RULE_STATUSES, [
    "draft",
    "pending_approval",
    "approved_pending_biznisoft",
    "office_recorded",
    "confirmed",
    "rejected",
    "reconciliation_failed",
    "revoked",
    "expired",
  ]);
  assert.deepEqual(
    Object.keys(ALLOWED_TRANSITIONS).sort(),
    [...PRICE_RULE_STATUSES].sort(),
    "neko stanje nema definisane prelaze",
  );
  for (const targets of Object.values(ALLOWED_TRANSITIONS)) {
    for (const target of targets) {
      assert.ok(PRICE_RULE_STATUSES.includes(target), target);
    }
  }
});

/* -------------------------------------------------------------------------
 * Komercijalista ne aktivira cenu
 * ---------------------------------------------------------------------- */

test("komercijalista sme da predlozi", () => {
  assert.equal(
    rejectTransition({
      from: "draft",
      to: "pending_approval",
      capabilities: komercijalista,
    }),
    null,
  );
});

test("komercijalista ne sme da odobri", () => {
  const refusal = rejectTransition({
    from: "pending_approval",
    to: "approved_pending_biznisoft",
    capabilities: komercijalista,
  });
  assert.match(refusal, /prices:approve/);
});

test("komercijalista ne sme da evidentira unos u BizniSoft", () => {
  const refusal = rejectTransition({
    from: "approved_pending_biznisoft",
    to: "office_recorded",
    capabilities: komercijalista,
    reason: "uneo sam",
  });
  assert.match(refusal, /prices:apply/);
});

test("predlog ne moze preskociti odobrenje i postati potvrdjen", () => {
  const refusal = rejectTransition({
    from: "pending_approval",
    to: "confirmed",
    capabilities: gazda,
  });
  assert.match(refusal, /nije dozvoljen/);
});

/* -------------------------------------------------------------------------
 * F-1: rucna evidencija NIJE potvrda sa fakture
 * ---------------------------------------------------------------------- */

test("nijedan covek ne moze postaviti confirmed — ni gazda", () => {
  for (const capabilities of [gazda, kancelarija, odobravac, komercijalista]) {
    const refusal = rejectTransition({
      from: "office_recorded",
      to: "confirmed",
      capabilities,
      reason: "video sam fakturu",
    });
    assert.ok(refusal, "neko je uspeo da postavi confirmed");
    assert.match(refusal, /usaglašavanje sa fakturom|usaglasavanje sa fakturom/);
  }
});

test("nijedan covek ne moze postaviti reconciliation_failed", () => {
  for (const capabilities of [gazda, kancelarija, odobravac]) {
    const refusal = rejectTransition({
      from: "office_recorded",
      to: "reconciliation_failed",
      capabilities,
      reason: "nije se poklopilo",
    });
    assert.ok(refusal);
    assert.match(refusal, /usaglašavanje sa fakturom|usaglasavanje sa fakturom/);
  }
});

test("systemski akter sme oba nalaza", () => {
  assert.equal(
    rejectTransition({
      from: "office_recorded",
      to: "confirmed",
      capabilities: new Set(["prices:reconcile_system"]),
      actorKind: ACTOR_SYSTEM,
    }),
    null,
  );
  assert.equal(
    rejectTransition({
      from: "office_recorded",
      to: "reconciliation_failed",
      capabilities: new Set(["prices:reconcile_system"]),
      reason: "cena na fakturi se razlikuje",
      actorKind: ACTOR_SYSTEM,
    }),
    null,
  );
});

test("sentinel sposobnost ne postoji ni u jednom paketu ni ulozi", () => {
  const { CAPABILITIES } = capabilityModel;
  assert.ok(
    !CAPABILITIES.includes("prices:reconcile_system"),
    "sistemski sentinel je procurio u model dozvola",
  );
  for (const role of ["gazda", "komercijalista", "kancelarija", "magacioner"]) {
    for (const paket of [[], ...capabilityModel.PACKAGE_KEYS.map((k) => [k])]) {
      assert.ok(
        !resolveCapabilities(role, paket).has("prices:reconcile_system"),
        `${role} + ${paket} je dobio sistemski sentinel`,
      );
    }
  }
});

test("kancelarija evidentira unos, i to NIJE potvrda", () => {
  assert.equal(
    rejectTransition({
      from: "approved_pending_biznisoft",
      to: "office_recorded",
      capabilities: kancelarija,
      reason: "uneto u BizniSoft 15.06.",
    }),
    null,
  );
  assert.equal(isOfficeRecorded("office_recorded"), true);
  assert.equal(isBiznisoftConfirmed("office_recorded"), false);
});

test("evidencija kancelarije trazi obaveznu napomenu", () => {
  assert.match(
    rejectTransition({
      from: "approved_pending_biznisoft",
      to: "office_recorded",
      capabilities: kancelarija,
      reason: "",
    }),
    /razlog/,
  );
});

test("odobreno pravilo ne ide pravo u office_recorded preskacuci odobrenje", () => {
  assert.match(
    rejectTransition({
      from: "pending_approval",
      to: "office_recorded",
      capabilities: kancelarija,
      reason: "uneo sam",
    }),
    /nije dozvoljen/,
  );
});

test("neuspelo usaglasavanje se vraca na ponovnu evidenciju, ne pravo u confirmed", () => {
  assert.equal(
    rejectTransition({
      from: "reconciliation_failed",
      to: "office_recorded",
      capabilities: kancelarija,
      reason: "ponovo uneto",
    }),
    null,
  );
  assert.ok(
    rejectTransition({
      from: "reconciliation_failed",
      to: "confirmed",
      capabilities: kancelarija,
    }),
  );
});

test("kupceva ograda razlikuje evidenciju od potvrde", () => {
  assert.match(
    customerFacingDisclosure({ status: "office_recorded" }).note,
    /nije potvrđeno fakturom|nije potvrdjeno fakturom/,
  );
  assert.match(
    customerFacingDisclosure({ status: "confirmed" }).note,
    /potvrđen fakturom|potvrdjen fakturom/,
  );
});

test("predlagac ne odobrava sopstveni predlog bez dozvole odobravanja", () => {
  // Nosilac paketa „cene_predlog" ne sme oba koraka.
  const refusal = rejectTransition({
    from: "pending_approval",
    to: "approved_pending_biznisoft",
    capabilities: new Set([...komercijalista, "prices:approve"]),
    actorIsProposer: true,
  });
  assert.match(refusal, /sopstveni predlog/);

  // Gazda i nosilac paketa „cene_odobravanje" jesu poslednja instanca.
  assert.equal(
    rejectTransition({
      from: "pending_approval",
      to: "approved_pending_biznisoft",
      capabilities: gazda,
      actorIsProposer: true,
    }),
    null,
  );
  assert.equal(
    rejectTransition({
      from: "pending_approval",
      to: "approved_pending_biznisoft",
      capabilities: odobravac,
      actorIsProposer: true,
    }),
    null,
  );
});

test("kupac van opsega onemogucava predlog", () => {
  const refusal = rejectTransition({
    from: "draft",
    to: "pending_approval",
    capabilities: komercijalista,
    customerInScope: false,
  });
  assert.match(refusal, /nije u vasem opsegu|nije u vašem opsegu/);
});

/* -------------------------------------------------------------------------
 * approved != confirmed
 * ---------------------------------------------------------------------- */

test("odobreno nije potvrdjeno", () => {
  assert.equal(isBiznisoftConfirmed("office_recorded"), false);
  assert.equal(isBiznisoftConfirmed("approved_pending_biznisoft"), false);
  assert.equal(isBiznisoftConfirmed("confirmed"), true);
  for (const status of PRICE_RULE_STATUSES) {
    if (status === "confirmed") continue;
    assert.equal(isBiznisoftConfirmed(status), false, status);
  }
});

test("u odlucivanju ucestvuju tacno tri stanja", () => {
  const participating = PRICE_RULE_STATUSES.filter(participatesInPricing);
  assert.deepEqual(participating, [
    "approved_pending_biznisoft",
    "office_recorded",
    "confirmed",
  ]);
});

test("kupcu se ni u jednom stanju ne prikazuje garantovana buduca cena", () => {
  for (const status of PRICE_RULE_STATUSES) {
    const disclosure = customerFacingDisclosure({ status });
    assert.equal(disclosure.visibleToCustomer, false, status);
  }
  assert.match(
    customerFacingDisclosure({ status: "approved_pending_biznisoft" }).note,
    /nije garantovana/,
  );
});

test("poslednja fakturisana cena nosi ogradu u samom tekstu", () => {
  const label = lastInvoicedPriceLabel("2026-05-04");
  assert.match(label, /Poslednja fakturisana cena od 2026-05-04/);
  assert.match(label, /informativno/);
  assert.match(label, /nije potvrda buduće cene|nije potvrda buduce cene/);
  assert.equal(lastInvoicedPriceLabel(""), null);
});

/* -------------------------------------------------------------------------
 * Razlozi i završna stanja
 * ---------------------------------------------------------------------- */

test("odbijanje, opoziv i evidencija traze razlog", () => {
  const cases = [
    { from: "pending_approval", to: "rejected", capabilities: gazda },
    { from: "confirmed", to: "revoked", capabilities: gazda },
    {
      from: "approved_pending_biznisoft",
      to: "office_recorded",
      capabilities: kancelarija,
    },
  ];
  for (const input of cases) {
    assert.match(
      rejectTransition({ ...input, reason: "" }),
      /razlog/,
      `${input.to} je prosao bez razloga`,
    );
    assert.equal(
      rejectTransition({ ...input, reason: "provereno u knjigovodstvu" }),
      null,
      input.to,
    );
  }
});

test("zavrsna stanja nemaju izlaz", () => {
  for (const terminal of ["rejected", "revoked", "expired"]) {
    assert.deepEqual(ALLOWED_TRANSITIONS[terminal], [], terminal);
    for (const target of PRICE_RULE_STATUSES) {
      assert.ok(
        rejectTransition({
          from: terminal,
          to: target,
          capabilities: gazda,
          reason: "bilo koji razlog",
        }),
        `${terminal} → ${target} je prosao`,
      );
    }
  }
});

test("potvrdjeno pravilo se ne vraca u odobreno", () => {
  assert.ok(
    rejectTransition({
      from: "confirmed",
      to: "approved_pending_biznisoft",
      capabilities: gazda,
      reason: "greska",
    }),
  );
});

test("svaka radnja ima svoju sposobnost", () => {
  for (const [from, targets] of Object.entries(ALLOWED_TRANSITIONS)) {
    for (const to of targets) {
      const action = actionFor(from, to);
      assert.ok(
        TRANSITION_CAPABILITY[action],
        `radnja ${action} (${from} → ${to}) nema sposobnost`,
      );
    }
  }
});

test("nepoznato stanje se odbija", () => {
  assert.match(
    rejectTransition({ from: "draft", to: "mozda", capabilities: gazda }),
    /Nepoznato stanje/,
  );
  assert.match(
    rejectTransition({ from: "mozda", to: "confirmed", capabilities: gazda }),
    /Nepoznato polazno stanje/,
  );
});

/* -------------------------------------------------------------------------
 * Paketi dozvola su stvarno razdvojeni
 * ---------------------------------------------------------------------- */

test("tri paketa daju tri razlicite moci", () => {
  const predlog = resolveCapabilities("komercijalista", ["cene_predlog"]);
  const odobrenje = resolveCapabilities("komercijalista", ["cene_odobravanje"]);
  const primena = resolveCapabilities("kancelarija", ["cene_primena"]);

  assert.ok(predlog.has("prices:propose"));
  assert.ok(!predlog.has("prices:approve"));
  assert.ok(!predlog.has("prices:apply"));

  assert.ok(odobrenje.has("prices:approve"));
  assert.ok(!odobrenje.has("prices:propose"));
  assert.ok(!odobrenje.has("prices:apply"));

  assert.ok(primena.has("prices:apply"));
  assert.ok(!primena.has("prices:approve"));
});

test("nijedan paket osim gazda uloge ne daje sva tri koraka", () => {
  for (const paket of ["cene_predlog", "cene_odobravanje", "cene_primena"]) {
    const capabilities = resolveCapabilities("komercijalista", [paket]);
    const koraci = ["prices:propose", "prices:approve", "prices:apply"].filter(
      (capability) => capabilities.has(capability),
    );
    assert.ok(koraci.length <= 1, `paket ${paket} daje ${koraci.join(", ")}`);
  }
});
