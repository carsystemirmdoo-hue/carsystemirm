import assert from "node:assert/strict";
import test from "node:test";

import {
  CONSENT_LABELS,
  CONSENT_PURPOSES,
  CONSENT_TEXT_VERSIONS,
  consentLabelFor,
  isRedundantConsentEvent,
  consentRequiredForAccount,
  CURRENT_CONSENT_TEXT_VERSION,
  defaultConsentState,
  effectiveConsents,
  rejectConsentEvent,
  staffMayGrantUnilaterally,
} from "./consent.mjs";

const base = {
  source: "customer_self_service",
  consentTextVersion: CURRENT_CONSENT_TEXT_VERSION,
};

/* -------------------------------------------------------------------------
 * Podrazumevano: bez pristanka
 * ---------------------------------------------------------------------- */

test("podrazumevano stanje je BEZ pristanka za svaku svrhu", () => {
  const state = defaultConsentState();
  assert.deepEqual(Object.keys(state).sort(), [...CONSENT_PURPOSES].sort());
  for (const purpose of CONSENT_PURPOSES) {
    assert.equal(state[purpose].granted, false, purpose);
    assert.equal(state[purpose].since, null);
  }
});

test("prazna istorija daje isto sto i podrazumevano", () => {
  assert.deepEqual(effectiveConsents([]), defaultConsentState());
  assert.deepEqual(effectiveConsents(undefined), defaultConsentState());
});

test("marketing saglasnost nije uslov za nalog", () => {
  assert.equal(consentRequiredForAccount(), false);
});

test("zaposleni ne sme samovoljno ukljuciti tudju saglasnost", () => {
  assert.equal(staffMayGrantUnilaterally(), false);
});

/* -------------------------------------------------------------------------
 * Dve odvojene odluke
 * ---------------------------------------------------------------------- */

test("email i oglasi su nezavisne odluke", () => {
  const state = effectiveConsents([
    { id: 1, purpose: "email_marketing", action: "granted", ...base },
  ]);
  assert.equal(state.email_marketing.granted, true);
  assert.equal(
    state.ad_personalization.granted,
    false,
    "pristanak na e-postu je ukljucio i oglase",
  );
});

test("povlacenje jedne svrhe ne dira drugu", () => {
  const state = effectiveConsents([
    { id: 1, purpose: "email_marketing", action: "granted", ...base },
    { id: 2, purpose: "ad_personalization", action: "granted", ...base },
    { id: 3, purpose: "ad_personalization", action: "withdrawn", ...base },
  ]);
  assert.equal(state.email_marketing.granted, true);
  assert.equal(state.ad_personalization.granted, false);
});

/* -------------------------------------------------------------------------
 * Append-only: stanje se izvodi iz poslednjeg događaja
 * ---------------------------------------------------------------------- */

test("merodavan je poslednji dogadjaj po rednom broju upisa", () => {
  const state = effectiveConsents([
    { id: 1, purpose: "email_marketing", action: "granted", ...base },
    { id: 2, purpose: "email_marketing", action: "withdrawn", ...base },
    { id: 3, purpose: "email_marketing", action: "granted", ...base },
  ]);
  assert.equal(state.email_marketing.granted, true);
});

test("redosled u nizu ne menja ishod — odlucuje id", () => {
  const events = [
    { id: 3, purpose: "email_marketing", action: "withdrawn", ...base },
    { id: 1, purpose: "email_marketing", action: "granted", ...base },
    { id: 2, purpose: "email_marketing", action: "granted", ...base },
  ];
  assert.equal(effectiveConsents(events).email_marketing.granted, false);
  assert.equal(
    effectiveConsents([...events].reverse()).email_marketing.granted,
    false,
  );
});

test("occurred_at van redosleda ne moze da obori id", () => {
  // Offline evidentiran pristanak sme nositi raniji datum; upis je ipak noviji.
  const state = effectiveConsents([
    {
      id: 1,
      purpose: "email_marketing",
      action: "granted",
      occurredAt: "2026-08-01",
      ...base,
    },
    {
      id: 2,
      purpose: "email_marketing",
      action: "withdrawn",
      occurredAt: "2026-01-01",
      ...base,
    },
  ]);
  assert.equal(state.email_marketing.granted, false);
});

test("nepoznata svrha ili radnja se ignorise, ne ruse stanje", () => {
  const state = effectiveConsents([
    { id: 1, purpose: "email_marketing", action: "granted", ...base },
    { id: 2, purpose: "sms_marketing", action: "granted", ...base },
    { id: 3, purpose: "email_marketing", action: "mozda", ...base },
  ]);
  assert.equal(state.email_marketing.granted, true);
  assert.equal(Object.keys(state).length, CONSENT_PURPOSES.length);
});

test("stanje nosi verziju teksta i izvor poslednje odluke", () => {
  const state = effectiveConsents([
    {
      id: 1,
      purpose: "email_marketing",
      action: "granted",
      source: "office_recorded_offline",
      consentTextVersion: "2025-v9",
      occurredAt: "2026-02-02",
    },
  ]);
  assert.equal(state.email_marketing.textVersion, "2025-v9");
  assert.equal(state.email_marketing.source, "office_recorded_offline");
  assert.equal(state.email_marketing.since, "2026-02-02");
});

/* -------------------------------------------------------------------------
 * Šta se sme upisati
 * ---------------------------------------------------------------------- */

test("ispravan kupcev dogadjaj prolazi", () => {
  for (const purpose of CONSENT_PURPOSES) {
    for (const action of ["granted", "withdrawn"]) {
      assert.equal(
        rejectConsentEvent({ purpose, action, ...base }),
        null,
        `${purpose}/${action}`,
      );
    }
  }
});

test("verzija teksta je obavezna", () => {
  assert.match(
    rejectConsentEvent({
      purpose: "email_marketing",
      action: "granted",
      source: "customer_self_service",
      consentTextVersion: "",
    }),
    /verziju teksta/,
  );
});

test("nepoznata svrha, radnja i izvor se odbijaju", () => {
  assert.match(
    rejectConsentEvent({ purpose: "sms", action: "granted", ...base }),
    /Nepoznata svrha/,
  );
  assert.match(
    rejectConsentEvent({ purpose: "email_marketing", action: "mozda", ...base }),
    /Nepoznata radnja/,
  );
  assert.match(
    rejectConsentEvent({
      purpose: "email_marketing",
      action: "granted",
      source: "uvoz",
      consentTextVersion: "v1",
    }),
    /Nepoznat izvor/,
  );
});

test("offline pristanak mora imati coveka iza sebe", () => {
  assert.match(
    rejectConsentEvent({
      purpose: "email_marketing",
      action: "granted",
      source: "office_recorded_offline",
      consentTextVersion: "v1",
    }),
    /mora imati korisnika/,
  );
  // Potpis vise nije dovoljan sam za sebe — offline zapis trazi i referencu.
  assert.equal(
    rejectConsentEvent({
      purpose: "email_marketing",
      action: "granted",
      source: "office_recorded_offline",
      consentTextVersion: "v1",
      recordedBy: "user-1",
      note: "potpisan formular na sajmu",
    }),
    null,
  );
});

test("offline povlacenje je DOZVOLJENO uz potpis i referencu", () => {
  /*
   * Ranije je ovo bilo zabranjeno. Zabrana je proizvodila netacan zapis: kupac
   * koji opozove saglasnost telefonom nije mogao biti evidentiran, pa bi u
   * sistemu i dalje stajao kao saglasan. Zastita je pomerena sa zabrane na
   * dokaz.
   */
  assert.equal(
    rejectConsentEvent({
      purpose: "email_marketing",
      action: "withdrawn",
      source: "office_recorded_offline",
      consentTextVersion: "v1",
      recordedBy: "user-1",
      note: "telefonski zahtev 12.09.",
    }),
    null,
  );
});

test("offline zapis bez reference na zahtev se odbija", () => {
  for (const action of ["granted", "withdrawn"]) {
    assert.match(
      rejectConsentEvent({
        purpose: "email_marketing",
        action,
        source: "office_recorded_offline",
        consentTextVersion: "v1",
        recordedBy: "user-1",
        note: "  ",
      }),
      /referencu na zahtev/,
      action,
    );
  }
});

test("offline zapis bez potpisa se odbija, bez obzira na odluku", () => {
  for (const action of ["granted", "withdrawn"]) {
    assert.match(
      rejectConsentEvent({
        purpose: "email_marketing",
        action,
        source: "office_recorded_offline",
        consentTextVersion: "v1",
        note: "pisani zahtev",
      }),
      /korisnika koji je evidentira/,
      action,
    );
  }
});

/* -------------------------------------------------------------------------
 * Idempotentnost i re-grant
 * ---------------------------------------------------------------------- */

test("ponovljena ista odluka po istom tekstu je suvisna", () => {
  assert.equal(
    isRedundantConsentEvent(
      { granted: false, textVersion: "v1" },
      { action: "withdrawn", consentTextVersion: "v1" },
    ),
    true,
  );
  assert.equal(
    isRedundantConsentEvent(
      { granted: true, textVersion: "v1" },
      { action: "granted", consentTextVersion: "v1" },
    ),
    true,
  );
});

test("re-grant posle povlacenja NIJE suvisan — trazi nov dogadjaj", () => {
  assert.equal(
    isRedundantConsentEvent(
      { granted: false, textVersion: "v1" },
      { action: "granted", consentTextVersion: "v1" },
    ),
    false,
  );
});

test("ista odluka po NOVOM tekstu je nova odluka", () => {
  // Pravni pregled pita po kom je tekstu pristanak dat; nova verzija je nov dokaz.
  assert.equal(
    isRedundantConsentEvent(
      { granted: true, textVersion: "2025-v1" },
      { action: "granted", consentTextVersion: "2026-v2" },
    ),
    false,
  );
});

test("prva odluka nikad nije suvisna", () => {
  assert.equal(
    isRedundantConsentEvent(undefined, {
      action: "withdrawn",
      consentTextVersion: "v1",
    }),
    false,
  );
});

/* -------------------------------------------------------------------------
 * Verzije teksta: 2026-08-v1 -> 2026-10-v2 (odluka vlasnika 2026-10-01)
 * ---------------------------------------------------------------------- */

test("nova verzija je 2026-10-v2 i važi za nove odluke", () => {
  assert.equal(CURRENT_CONSENT_TEXT_VERSION, "2026-10-v2");
  assert.equal(CONSENT_LABELS, CONSENT_TEXT_VERSIONS["2026-10-v2"]);
  assert.equal(
    CONSENT_LABELS.email_marketing.body,
    "Pristajem da mi CAR SYSTEM I R-M d.o.o. Inđija na moju poslovnu e-poštu šalje " +
      "obaveštenja o proizvodima, akcijama i tehničkim novostima. Saglasnost je " +
      "dobrovoljna i mogu je povući u bilo kom trenutku, jednako jednostavno kao što je data.",
  );
  // Rodno neutralno: nema oblika „dao/dala".
  assert.doesNotMatch(CONSENT_LABELS.email_marketing.body, /\bsam je da(o|la)\b/);
  // Nova odluka nosi novu verziju.
  assert.equal(rejectConsentEvent({ purpose: "email_marketing", action: "granted", ...base }), null);
  assert.equal(base.consentTextVersion, "2026-10-v2");
});

test("tekst verzije 2026-08-v1 ostaje doslovno isti za već evidentirane saglasnosti", () => {
  assert.equal(
    consentLabelFor("email_marketing", "2026-08-v1").body,
    "Pristajem da mi Carsystem i R-M Inđija d.o.o. šalje obaveštenja o proizvodima, " +
      "akcijama i tehničkim novostima na moju poslovnu e-poštu. Saglasnost mogu povući " +
      "u bilo kom trenutku, jednako lako kao što sam je dao.",
  );
  for (const purpose of CONSENT_PURPOSES) {
    assert.ok(consentLabelFor(purpose, "2026-08-v1"), `v1 ${purpose}`);
    assert.ok(consentLabelFor(purpose, "2026-10-v2"), `v2 ${purpose}`);
  }
});

test("prelaz: stari pristanak zadržava v1, novi događaj posle njega nosi v2", () => {
  const events = [
    { id: 1, purpose: "email_marketing", action: "granted", consentTextVersion: "2026-08-v1" },
    { id: 2, purpose: "ad_personalization", action: "granted", consentTextVersion: "2026-08-v1" },
    { id: 3, purpose: "ad_personalization", action: "withdrawn", consentTextVersion: CURRENT_CONSENT_TEXT_VERSION },
    { id: 4, purpose: "ad_personalization", action: "granted", consentTextVersion: CURRENT_CONSENT_TEXT_VERSION },
  ];
  const state = effectiveConsents(events);
  assert.equal(state.email_marketing.textVersion, "2026-08-v1");
  assert.equal(state.ad_personalization.textVersion, "2026-10-v2");
  // Ekran prikazuje tekst one verzije uz koju je pristanak dat.
  assert.match(consentLabelFor("email_marketing", state.email_marketing.textVersion).body, /jednako lako kao što sam je dao/);
});

test("nepoznata verzija ne dobija tuđi tekst", () => {
  assert.equal(consentLabelFor("email_marketing", "2025-v9"), null);
  assert.equal(consentLabelFor("email_marketing", null), null);
  assert.equal(consentLabelFor("nepostojeca_svrha", "2026-10-v2"), null);
});
