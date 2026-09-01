import assert from "node:assert/strict";
import test from "node:test";
import {
  can,
  capabilityForPath,
  landingRouteFor,
  navGroupsFor,
  PACKAGE_KEYS,
  resolveCapabilities,
  ROUTE_CAPABILITY,
  seesAllCustomers,
} from "./permissions.mjs";

const gazda = { role: "gazda", permissions: PACKAGE_KEYS };
const komercijalista = { role: "komercijalista", permissions: [] };
const kancelarija = { role: "kancelarija", permissions: [] };
const magacioner = { role: "magacioner", permissions: ["otprema"] };
/** Miroslav Suljagić: komercijalista sa paketima, ne menadžer. */
const analiticar = {
  role: "komercijalista",
  permissions: ["analitika", "nabavka_predlog"],
};

test("uloga „Menadžer“ ne postoji u modelu", () => {
  assert.equal(resolveCapabilities("menadzer").size, 0);
  assert.equal(resolveCapabilities("manager").size, 0);
});

test("Gazda ima sve sposobnosti koje rute traže", () => {
  for (const capability of Object.values(ROUTE_CAPABILITY)) {
    assert.ok(can(gazda, capability), `Gazdi nedostaje ${capability}`);
  }
});

test("Komercijalista bez paketa vidi samo svoj osnovni obim", () => {
  assert.ok(can(komercijalista, "view:kupci"));
  assert.ok(can(komercijalista, "view:prodaja"));
  assert.ok(!can(komercijalista, "view:analitika"));
  assert.ok(!can(komercijalista, "view:limiti"));
  assert.ok(!can(komercijalista, "view:dozvole"));
  assert.ok(!can(komercijalista, "view:otprema"));
  // Bez „customers:view_all“ vidi isključivo dodeljene kupce.
  assert.ok(!seesAllCustomers(komercijalista));
});

test("Magacioner dobija otpremu, ali ne i finansije ni administraciju", () => {
  assert.ok(can(magacioner, "view:otprema"));
  assert.ok(can(magacioner, "view:adresnice"));
  assert.ok(can(magacioner, "shipments:create"));
  assert.ok(can(magacioner, "labels:print"));

  for (const forbidden of [
    "view:analitika",
    "view:limiti",
    "view:dugovanja",
    "view:dozvole",
    "view:prodaja",
    "limits:approve",
    "users:manage",
    "settings:manage",
  ]) {
    assert.ok(!can(magacioner, forbidden), `Magacioner ne sme ${forbidden}`);
  }
});

test("Kancelarija ne dobija automatski vlasnički pristup", () => {
  assert.ok(can(kancelarija, "view:kupci"));
  assert.ok(can(kancelarija, "view:importi"));
  assert.ok(!can(kancelarija, "users:manage"));
  assert.ok(!can(kancelarija, "limits:approve"));
  assert.ok(!can(kancelarija, "settings:manage"));
  assert.ok(!can(kancelarija, "procurement:confirm"));
});

test("paket „analitika“ otvara dublju analitiku cele firme", () => {
  assert.ok(can(analiticar, "view:analitika"));
  assert.ok(can(analiticar, "view:povrati"));
  assert.ok(can(analiticar, "view:izvestaji"));
  assert.ok(can(analiticar, "view:importi"));
  assert.ok(can(analiticar, "export:data"));
  assert.ok(seesAllCustomers(analiticar));
});

test("nosilac paketa „analitika“ nema vlasnička prava", () => {
  for (const forbidden of [
    "limits:approve",
    "procurement:confirm",
    "procurement:order_create",
    "customer_orders:create",
    "users:manage",
    "settings:manage",
    "notifications:resolve_global",
    "view:dozvole",
    "view:admin",
    "view:limiti",
  ]) {
    assert.ok(!can(analiticar, forbidden), `ne sme da dobije ${forbidden}`);
  }
});

test("„nabavka_predlog“ priprema predlog, ali ne potvrđuje količine", () => {
  assert.ok(can(analiticar, "view:nabavka"));
  assert.ok(can(analiticar, "procurement:prepare"));
  assert.ok(!can(analiticar, "procurement:confirm"));
  assert.ok(!can(analiticar, "view:porudzbine"));
});

test("dozvola je vezana za paket, a ne za osobu", () => {
  // Bilo koji drugi komercijalista sa istim paketom dobija isti pristup…
  const drugi = { role: "komercijalista", permissions: ["analitika"] };
  assert.ok(can(drugi, "view:analitika"));
  // …a oduzimanje paketa ga odmah uklanja, bez ponovne prijave.
  const bezPaketa = { role: "komercijalista", permissions: [] };
  assert.ok(!can(bezPaketa, "view:analitika"));
});

test("navigacija prikazuje samo ono što je dozvoljeno", () => {
  const hrefs = navGroupsFor(magacioner).flatMap((group) =>
    group.items.map((item) => item.href),
  );
  assert.deepEqual(hrefs, [
    "/portal/otprema",
    "/portal/adresnice",
    "/portal/bex",
  ]);
  // Prazne grupe se ne prikazuju.
  assert.ok(
    navGroupsFor(magacioner).every((group) => group.items.length > 0),
  );
});

test("svaka vidljiva stavka navigacije ima ovlašćenje na serveru", () => {
  for (const user of [gazda, komercijalista, kancelarija, magacioner, analiticar]) {
    for (const group of navGroupsFor(user)) {
      for (const item of group.items) {
        assert.ok(
          can(user, capabilityForPath(item.href)),
          `${item.href} je prikazan bez ovlašćenja`,
        );
      }
    }
  }
});

test("podruta nasleđuje ovlašćenje nadređene rute", () => {
  assert.equal(capabilityForPath("/portal/kupci/abc-123"), "view:kupci");
  assert.equal(capabilityForPath("/portal/kupci"), "view:kupci");
  assert.equal(capabilityForPath("/portal"), "view:home");
  assert.equal(capabilityForPath("/portal/"), "view:home");
  assert.equal(capabilityForPath("/portal/nepoznato"), null);
});

test("odredište posle prijave je prva dozvoljena ruta", () => {
  assert.equal(landingRouteFor(gazda), "/portal");
  assert.equal(landingRouteFor(komercijalista), "/portal");
  assert.equal(landingRouteFor(magacioner), "/portal/otprema");
});

test("nepoznat paket se ignoriše umesto da širi pristup", () => {
  const podmetnut = {
    role: "komercijalista",
    permissions: ["korisnici_", "*", "gazda", "users:manage"],
  };
  assert.ok(!can(podmetnut, "users:manage"));
  assert.ok(!can(podmetnut, "view:dozvole"));
});

/* =========================================================================
 * Sinhronizacija (P4)
 * ====================================================================== */

test("`sync:monitor` i `sync:trigger` ima kancelarija, ali ne i teren", () => {
  /*
   * Kancelarija je ta koja gleda kada uvoz zapne i pokreće ga ponovo. Da ovo
   * traži gazdu, jedina osoba koja radi sa fakturama ne bi mogla ništa.
   */
  for (const sposobnost of ["sync:monitor", "sync:trigger"]) {
    assert.ok(can(gazda, sposobnost), `Gazdi nedostaje ${sposobnost}`);
    assert.ok(can(kancelarija, sposobnost), `Kancelariji nedostaje ${sposobnost}`);
    assert.ok(!can(komercijalista, sposobnost), `Komercijalista ima ${sposobnost}`);
    assert.ok(!can(magacioner, sposobnost), `Magacioner ima ${sposobnost}`);
    assert.ok(!can(analiticar, sposobnost), `Paket je dodelio ${sposobnost}`);
  }
});

test("uređaje i dalje vodi samo gazda, ni jedan paket to ne menja", () => {
  assert.ok(can(gazda, "devices:manage"));
  /*
   * Gledanje i pokretanje NIJE isto što i registracija ključa. Kancelarija sme
   * da pokrene sinhronizaciju, ali ne i da uvede nov uređaj u sistem.
   */
  assert.ok(!can(kancelarija, "devices:manage"));

  // Nijedan paket ne otvara `devices:manage` — ni svi zajedno.
  const sviPaketi = { role: "kancelarija", permissions: PACKAGE_KEYS };
  assert.ok(!can(sviPaketi, "devices:manage"));
  assert.ok(can(sviPaketi, "sync:monitor"));
});

test("stranica sinhronizacije traži `sync:monitor`, ne `view:importi`", () => {
  assert.equal(capabilityForPath("/portal/importi/sinhronizacija"), "sync:monitor");
  /*
   * Da je vezana za `view:importi`, svako ko sme da vidi uvoze mogao bi i da
   * gleda stanje kancelarijskog računara.
   */
  assert.notEqual(capabilityForPath("/portal/importi/sinhronizacija"), "view:importi");
});

test("`/portal/importi/dokumenti` više ne ispada iz mape ovlašćenja", () => {
  /*
   * Prijavljeni nedostatak: ruta nije imala unos, pa je `navGroupsFor` tražio
   * `capabilities.has(undefined)` — uvek `false`, i stavka se NIKOME nije
   * prikazivala. Serverska provera se ovim ne širi: traži se isto `view:importi`
   * koje ruta ionako zahteva.
   */
  assert.equal(capabilityForPath("/portal/importi/dokumenti"), "view:importi");
  const hrefs = navGroupsFor(kancelarija).flatMap((g) => g.items.map((i) => i.href));
  assert.ok(hrefs.includes("/portal/importi/dokumenti"));
  assert.ok(hrefs.includes("/portal/importi/sinhronizacija"));
});

test("sinhronizacija se ne pojavljuje u navigaciji terena", () => {
  for (const user of [komercijalista, magacioner, analiticar]) {
    const hrefs = navGroupsFor(user).flatMap((g) => g.items.map((i) => i.href));
    assert.ok(
      !hrefs.includes("/portal/importi/sinhronizacija"),
      `${user.role} vidi sinhronizaciju u navigaciji`,
    );
  }
});
