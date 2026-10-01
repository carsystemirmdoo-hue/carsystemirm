import assert from "node:assert/strict";
import test from "node:test";
import {
  CALLBACK_PARAM,
  LOGIN_ROUTE,
  loginUrlFor,
  normalizeCallback,
  resolvePostLoginTarget,
} from "./redirects.mjs";
import { landingRouteFor } from "./permissions.mjs";

test("neprijavljen pristup /portal vodi na prijavu sa callbackUrl-om", () => {
  assert.equal(
    loginUrlFor("/portal"),
    `${LOGIN_ROUTE}?${CALLBACK_PARAM}=%2Fportal`,
  );
});

test("neprijavljen pristup /portal/dozvole vodi na prijavu sa callbackUrl-om", () => {
  const url = loginUrlFor("/portal/dozvole");
  assert.equal(url, `${LOGIN_ROUTE}?${CALLBACK_PARAM}=%2Fportal%2Fdozvole`);
  // Putanja se ne sme nadovezati na adresu prijave.
  assert.ok(!url.startsWith("/prijava/dozvole"));
  assert.ok(!url.includes("/prijava/portal"));
});

test("neprijavljen pristup /portal/analitika vodi na prijavu sa callbackUrl-om", () => {
  assert.equal(
    loginUrlFor("/portal/analitika"),
    `${LOGIN_ROUTE}?${CALLBACK_PARAM}=%2Fportal%2Fanalitika`,
  );
});

test("nijedna zaštićena ruta se ne nadovezuje na /prijava", () => {
  const routes = [
    "/portal",
    "/portal/dozvole",
    "/portal/analitika",
    "/portal/kupci",
    "/portal/kupci/7116b48a-9b0c-4048-baaa-a32477a2e980",
    "/portal/importi",
    "/portal/admin",
    "/portal/otprema",
  ];
  for (const route of routes) {
    const url = loginUrlFor(route);
    const [path, query] = url.split("?");
    assert.equal(path, LOGIN_ROUTE, `${route} je promenio putanju prijave`);
    assert.equal(
      decodeURIComponent(query.slice(CALLBACK_PARAM.length + 1)),
      route,
    );
  }
});

test("upit i fragment iz zaštićene rute se čuvaju", () => {
  const url = loginUrlFor("/portal/kupci?filter=preko&strana=2");
  assert.equal(
    decodeURIComponent(url.split("=")[1]),
    "/portal/kupci?filter=preko&strana=2",
  );
});

test("uspešna prijava vraća korisnika na traženu rutu", () => {
  assert.equal(
    resolvePostLoginTarget("/portal/dozvole", "/portal"),
    "/portal/dozvole",
  );
  assert.equal(
    resolvePostLoginTarget("/portal/kupci?filter=preko", "/portal"),
    "/portal/kupci?filter=preko",
  );
});

test("spoljne i zlonamerne adrese se odbijaju", () => {
  const napadi = [
    "https://zlonamerno.rs",
    "http://zlonamerno.rs/portal",
    "//zlonamerno.rs",
    "//zlonamerno.rs/portal/dozvole",
    "/\\zlonamerno.rs",
    "/\\/zlonamerno.rs",
    "javascript:alert(1)",
    "javascript:/portal",
    "/portal\\@zlonamerno.rs",
    "%2F%2Fzlonamerno.rs",
    "/%2f%2fzlonamerno.rs",
    "data:text/html,<script>",
    "/portal/dozvole\nSet-Cookie: x=1",
    "/portal/dozvole\r\nLocation: https://zlonamerno.rs",
    " /portal/dozvole",
  ];
  for (const napad of napadi) {
    assert.equal(normalizeCallback(napad), null, `propušteno: ${napad}`);
  }
});

test("putanje izvan portala se odbijaju", () => {
  for (const putanja of ["/", "/katalog", "/kontakt", "/portalno", "/admin"]) {
    assert.equal(normalizeCallback(putanja), null, `propušteno: ${putanja}`);
  }
});

test("bez callbackUrl-a korisnik ide na početni ekran svoje uloge", () => {
  const gazda = { role: "gazda", permissions: [] };
  const magacioner = { role: "magacioner", permissions: ["otprema"] };
  const komercijalista = { role: "komercijalista", permissions: [] };

  assert.equal(
    resolvePostLoginTarget(null, landingRouteFor(gazda)),
    "/portal",
  );
  assert.equal(
    resolvePostLoginTarget(undefined, landingRouteFor(magacioner)),
    "/portal/otprema",
  );
  assert.equal(
    resolvePostLoginTarget("", landingRouteFor(komercijalista)),
    "/portal",
  );
});

test("magacioner sa nedozvoljenim callbackUrl-om ne završi na 403", () => {
  // Adresa je bezbedna po obliku, ali ekran nije njegov — ovlašćenje i dalje
  // proverava server; ovde se samo potvrđuje da oblik prolazi validaciju.
  assert.equal(
    resolvePostLoginTarget("/portal/limiti", "/portal/otprema"),
    "/portal/limiti",
  );
});

test("nema petlje: prijava ne može biti sopstveno odredište", () => {
  assert.equal(normalizeCallback(LOGIN_ROUTE), null);
  assert.equal(normalizeCallback(`${LOGIN_ROUTE}?${CALLBACK_PARAM}=%2Fportal`), null);
  assert.equal(normalizeCallback("/prijava/dozvole"), null);
  // Odredište posle prijave nikada nije sama prijava.
  assert.notEqual(resolvePostLoginTarget(LOGIN_ROUTE, "/portal"), LOGIN_ROUTE);
});

test("nepostojeća ruta portala i dalje prolazi kroz prijavu, ne kroz 404", () => {
  // Ovlašćenje i postojanje rute su odvojena pitanja: neprijavljen korisnik
  // prvo mora na prijavu, pa tek onda dobija 404 ako ruta ne postoji.
  const url = loginUrlFor("/portal/ne-postoji");
  assert.equal(url, `${LOGIN_ROUTE}?${CALLBACK_PARAM}=%2Fportal%2Fne-postoji`);
  assert.equal(normalizeCallback("/portal/ne-postoji"), "/portal/ne-postoji");
});

test("prazna ili neispravna vrednost ne ruši preusmeravanje", () => {
  assert.equal(loginUrlFor(undefined), LOGIN_ROUTE);
  assert.equal(loginUrlFor(null), LOGIN_ROUTE);
  assert.equal(loginUrlFor(""), LOGIN_ROUTE);
  assert.equal(normalizeCallback(42), null);
  assert.equal(normalizeCallback({}), null);
});

/* F5 — kupčev povratak na javni sajt */
import { normalizeCustomerReturn } from "./redirects.mjs";

test("kupac se vraća na javnu stranicu sa koje je došao", () => {
  for (const ok of ["/", "/katalog", "/katalog/strana/2?brend=rm", "/proizvodi/baslac-60-20-razredjivac", "/kupac/fakture?od=2026-01-01"]) {
    assert.equal(normalizeCustomerReturn(ok), ok, `odbijeno: ${ok}`);
  }
});

test("kupčev povratak nikad ne vodi u portal, prijavu, API ni van sajta", () => {
  for (const bad of [
    "/portal", "/portal/kupci", "/PORTAL/kupci", "/%70ortal", "/prijava/kupac", "/api/kupac/sesija", "/_next/static/x",
    "//evil.example", "/\\evil.example", "https://evil.example", "javascript:alert(1)", "/katalog\nSet-Cookie:x",
    " /katalog", "katalog", "", null, 42, "/%2Fevil.example", "/%E0%A4%A",
  ]) {
    assert.equal(normalizeCustomerReturn(bad), null, `propušteno: ${JSON.stringify(bad)}`);
  }
});
