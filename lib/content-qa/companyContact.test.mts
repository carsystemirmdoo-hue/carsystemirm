/*
 * Kontakt podaci koje je firma direktno potvrdila 2026-10-01
 * (docs/CONTENT_GAPS_REQUIRING_OWNER_INPUT.md, GAP-001 i GAP-002).
 *
 *   npm run test:content-copy
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { companyContact, toTelHref } from "@/lib/company-contact";
import { organizationJsonLd } from "@/lib/seo";
import { scanRenderedHtml } from "@/lib/content-qa/contentCopyGuard.mjs";

test("telefon kancelarije je glavni broj, u domaćem prikazu i međunarodnom linku", () => {
  assert.equal(companyContact.phone, "022 558 501");
  assert.equal(companyContact.phoneInternational, "+381 22 558 501");
  assert.equal(companyContact.phoneHref, "tel:+38122558501");
});

test("glavna e-pošta i mailto", () => {
  assert.equal(companyContact.email, "carsystemirmdoo@gmail.com");
  assert.equal(companyContact.emailHref, "mailto:carsystemirmdoo@gmail.com");
});

test("tri regionalna komercijalista, bez imena, sa ispravnim tel:", () => {
  assert.deepEqual(
    companyContact.salesContacts.map(({ region, phone, phoneInternational, phoneHref }) => [
      region,
      phone,
      phoneInternational,
      phoneHref,
    ]),
    [
      ["Vojvodina", "061 168 8472", "+381 61 168 8472", "tel:+381611688472"],
      ["Centralna Srbija", "069 333 7401", "+381 69 333 7401", "tel:+381693337401"],
      ["Južna Srbija", "063 157 8270", "+381 63 157 8270", "tel:+381631578270"],
    ],
  );
  for (const sales of companyContact.salesContacts) {
    assert.deepEqual(Object.keys(sales).sort(), ["phone", "phoneHref", "phoneInternational", "region"]);
  }
});

test("svaki tel: je međunarodni oblik bez razmaka i odgovara prikazanom broju", () => {
  const all = [
    { phone: companyContact.phone!, phoneInternational: companyContact.phoneInternational!, phoneHref: companyContact.phoneHref! },
    ...companyContact.salesContacts,
  ];
  for (const entry of all) {
    assert.match(entry.phoneHref, /^tel:\+381\d{8,9}$/);
    assert.equal(entry.phoneHref, `tel:${entry.phoneInternational.replace(/\s/g, "")}`);
    assert.equal(toTelHref(entry.phone), entry.phoneHref, `${entry.phone} → ${entry.phoneHref}`);
  }
});

test("toTelHref: prvi broj iz polja sa više brojeva, null za neprepoznat zapis", () => {
  assert.equal(toTelHref("011 386 33 60 / 063 528 477"), "tel:+381113863360");
  assert.equal(toTelHref("022 622 907 / 064 644 9 339"), "tel:+38122622907");
  assert.equal(toTelHref("+381 22 558 501"), "tel:+38122558501");
  assert.equal(toTelHref("00381 63 157 8270"), "tel:+381631578270");
  assert.equal(toTelHref("558 501"), null);
  assert.equal(toTelHref("nema"), null);
});

test("schema.org Organization nosi iste potvrđene kontakte", () => {
  const organization = organizationJsonLd()["@graph"][0] as Record<string, unknown>;
  assert.equal(organization.telephone, "+381 22 558 501");
  assert.equal(organization.email, "carsystemirmdoo@gmail.com");
  assert.deepEqual(organization.address, {
    "@type": "PostalAddress",
    streetAddress: "Ive Andrića 3",
    postalCode: "22320",
    addressLocality: "Inđija",
    addressCountry: "RS",
  });
  const points = organization.contactPoint as Array<Record<string, unknown>>;
  assert.deepEqual(
    points.map((point) => [point.contactType, point.telephone]),
    [
      ["customer service", "+381 22 558 501"],
      ["sales", "+381 61 168 8472"],
      ["sales", "+381 69 333 7401"],
      ["sales", "+381 63 157 8270"],
    ],
  );
  assert.doesNotMatch(JSON.stringify(organizationJsonLd()), /office@carsystemirm|info@carsystem-rm|000 000/);
});

// Stvarni prerenderovan HTML se proverava samo na zahtev, posle svežeg builda
// (zastareo lokalni `.next` ne sme da obori `npm test`):
//   npm run build && CONTENT_CHECK_HTML=1 npm run test:content-copy
//   npm run build && npm run content:check:html
const appDir = path.resolve(process.cwd(), process.env.NEXT_DIST_DIR || ".next", "server/app");
const htmlSkip =
  process.env.CONTENT_CHECK_HTML !== "1"
    ? "postavite CONTENT_CHECK_HTML=1 posle builda"
    : fs.existsSync(appDir)
      ? false
      : `nema builda u ${appDir}`;
test(
  "prerenderovan HTML ne sadrži povučene ni šablonske kontakte",
  { skip: htmlSkip },
  () => {
    const { pages, findings } = scanRenderedHtml(appDir);
    assert.ok(pages > 100, `samo ${pages} strana`);
    assert.deepEqual(findings, []);
    const contact = fs.readFileSync(path.join(appDir, "kontakt.html"), "utf8");
    for (const href of ["tel:+38122558501", "tel:+381611688472", "tel:+381693337401", "tel:+381631578270", "mailto:carsystemirmdoo@gmail.com"]) {
      assert.ok(contact.includes(`href="${href}"`), `/kontakt nema ${href}`);
    }
  },
);
