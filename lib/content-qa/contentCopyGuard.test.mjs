/*
 * Čuvar korisničkog teksta: repo je čist, a namerno ubačen placeholder,
 * neformalno obraćanje ili žargon ga obaraju.
 *
 *   npm run test:content-copy
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  ALLOWLIST,
  RULE_EXCEPTIONS,
  checkCopy,
  formatFinding,
  scanRenderedHtml,
  scanRepository,
  scanSource,
} from "./contentCopyGuard.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const rules = (relPath, source) => scanSource(relPath, source).map((finding) => finding.rule);

test("runtime izvori nemaju nijedan nalaz", () => {
  const { scanned, findings } = scanRepository(repoRoot);
  assert.ok(scanned > 300, `pregledano samo ${scanned} fajlova`);
  assert.deepEqual(findings.map(formatFinding), []);
});

test("šablonski telefon i primer-adresa obaraju proveru", () => {
  assert.deepEqual(rules("components/x/Footer.tsx", 'export const p = { phone: "+381 22 000 000" };'), ["template-phone"]);
  assert.deepEqual(rules("components/x/Footer.tsx", 'export const h = "tel:+38122000000";'), ["template-phone"]);
  assert.deepEqual(rules("components/x/Footer.tsx", "export const A = () => <a>011/000-000</a>;"), ["template-phone"]);
  assert.deepEqual(rules("lib/contact.ts", 'export const email = "info@example.com";'), ["example-email"]);
  assert.deepEqual(rules("lib/ids.ts", 'export const nil = "00000000-0000-0000-0000-000000000000";'), []);
  assert.deepEqual(rules("lib/contact.ts", 'export const real = "+381 22 558 501";'), []);
  assert.deepEqual(rules("lib/contact.ts", 'export const t = "Lorem ipsum dolor sit amet";'), ["lorem"]);
  assert.deepEqual(rules("lib/contact.ts", 'export const t = "Adresa: TBD";'), ["instruction-placeholder"]);
});

test("kontakti koje firma nije potvrdila obaraju proveru", () => {
  assert.deepEqual(rules("lib/contact.ts", 'export const e = "office@carsystemirm.com";'), [
    "retired-contact:office@carsystemirm.com",
  ]);
  assert.deepEqual(rules("lib/contact.ts", 'export const e = "mailto:info@carsystem-rm.rs";'), [
    "retired-contact:info@carsystem-rm.rs",
  ]);
  assert.deepEqual(rules("lib/contact.ts", 'export const e = "eurospektar@blic.net";'), [
    "retired-contact:eurospektar@blic.net",
  ]);
  assert.deepEqual(rules("lib/contact.ts", 'export const p = "+381 22 367 139";'), ["retired-contact:022 367 139"]);
  assert.deepEqual(rules("lib/contact.ts", 'export const p = "+381 62 8810895";'), ["retired-contact:062 8810895"]);
  // Potvrđeni kontakti prolaze.
  assert.deepEqual(rules("lib/contact.ts", 'export const e = "mailto:carsystemirmdoo@gmail.com";'), []);
  assert.deepEqual(rules("lib/contact.ts", 'export const p = "061 168 8472";'), []);
});

test("odluke vlasnika: uloga Vlasnik, bez faza u UI-ju, samo dva oblika naziva firme", () => {
  assert.deepEqual(rules("app/portal/x.tsx", 'export const t = "Dodelu radi Gazda.";'), ["role-label-gazda"]);
  assert.deepEqual(rules("app/portal/x.tsx", 'export const t = "Zatražite od Gazde dodelu.";'), ["role-label-gazda"]);
  assert.deepEqual(rules("app/portal/x.tsx", 'export const t = "Komercijalista predlaže, gazda odobrava.";'), ["role-label-gazda"]);
  // Interni ključ uloge nije tekst za korisnika.
  assert.deepEqual(rules("lib/authz/x.mjs", 'export const OWNER_ROLE = "gazda";'), []);
  assert.deepEqual(rules("app/portal/x.tsx", 'export const t = "Dodelu radi Vlasnik.";'), []);
  assert.deepEqual(rules("app/portal/x.tsx", "export const A = () => <Notice phase=\"x\">Planirano: faza 2</Notice>;"), ["jargon:project-phase"]);
  assert.deepEqual(rules("app/portal/x.tsx", 'export const t = "Uvoz faktura (faza 2).";'), ["jargon:project-phase"]);
  assert.deepEqual(rules("app/portal/x.tsx", 'export const t = "Dostupno nakon povezivanja BiznisSoft izvoza";'), []);
  assert.deepEqual(rules("app/x.tsx", "export const A = () => <strong>Carsystem i R-M DOO</strong>;"), ["mixed-company-name"]);
  assert.deepEqual(rules("app/x.tsx", 'export const t = "Carsystem i R-M Inđija d.o.o.";'), ["mixed-company-name"]);
  assert.deepEqual(rules("app/x.tsx", 'export const t = "CAR SYSTEM I R-M d.o.o. Inđija · Carsystem i R-M";'), []);
});

test("tel: mora biti međunarodni oblik bez razmaka", () => {
  assert.deepEqual(rules("components/x/A.tsx", 'export const A = () => <a href="tel:022558501">x</a>;'), ["tel-format"]);
  assert.deepEqual(rules("components/x/A.tsx", 'export const A = () => <a href="tel:+381 22 558 501">x</a>;'), ["tel-format"]);
  assert.deepEqual(rules("components/x/A.tsx", 'export const A = () => <a href="tel:+38122558501">x</a>;'), []);
});

test("renderovan HTML: povučen kontakt, šablonski broj i loš tel: su prijavljeni po strani", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "content-guard-html-"));
  try {
    fs.mkdirSync(path.join(dir, "kontakt"), { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), '<a href="tel:+38122558501">022 558 501</a><a href="mailto:carsystemirmdoo@gmail.com">x</a>');
    fs.writeFileSync(
      path.join(dir, "kontakt.html"),
      '<a href="mailto:office@carsystemirm.com">x</a><a href="tel:0113863360063528477">y</a><span>+381 22 000 000</span>',
    );
    const { pages, findings } = scanRenderedHtml(dir);
    assert.equal(pages, 2);
    assert.deepEqual(
      findings.map((finding) => [finding.page, finding.rule]),
      [
        ["/kontakt", "retired-contact:office@carsystemirm.com"],
        ["/kontakt", "template-phone"],
        ["/kontakt", "tel-format"],
      ],
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("neformalno obraćanje i zamenica malim slovom obaraju proveru", () => {
  assert.deepEqual(rules("components/x/Cta.tsx", "export const C = () => <button>Pošalji upit</button>;"), [
    "informal-imperative",
  ]);
  assert.deepEqual(rules("components/x/Cta.tsx", 'export const C = () => <button aria-label="Zatvori meni" />;'), [
    "informal-imperative",
  ]);
  assert.deepEqual(rules("components/x/Cta.tsx", 'export const l = { label: "Pronađi prodavnicu" };'), [
    "informal-imperative",
  ]);
  assert.deepEqual(rules("components/x/Cta.tsx", 'export const t = "Ovo je tvoj nalog.";'), ["informal-pronoun"]);
  assert.deepEqual(rules("components/x/Cta.tsx", 'export const t = "Treba vam savet?";'), ["lowercase-vi"]);
});

test("ispravan tekst i ne-tekstualni stringovi ne prave lažnu uzbunu", () => {
  const clean = `
    // TODO: komentar nije tekst za korisnika
    import x from "./Pogledaj";
    export const a = (s: string) => s === "Pogledaj";
    export const b = { "Zatvori": 1 };
    export const c = () => <button className="Zatvori">Pošaljite upit</button>;
    export const d = "Svaka izmena traži razlog i evidentira se u Aktivnostima.";
    export const e = "Treba Vam savet pri izboru proizvoda?";
    export const f = { slug: "primer-filler", internalReason: "iz dostavljenog ZIP-a" };
    export const g = "Koristi se zajedno sa";
  `;
  assert.deepEqual(rules("components/x/Clean.tsx", clean), []);
});

test("razvojni žargon obara proveru", () => {
  assert.deepEqual(checkCopy("Automatsko backend slanje nije povezano."), ["jargon:backend"]);
  assert.deepEqual(checkCopy("Crawlable pregled kataloga"), ["jargon:crawlable"]);
  assert.deepEqual(checkCopy("Potrebna je SITE_ACCESS_PASSWORD env varijabla."), ["jargon:env-var"]);
  assert.deepEqual(checkCopy("Nedostajući asseti ostaju tehnički slotovi."), ["jargon:asset"]);
});

test("ubačen placeholder u stvarnoj strukturi repoa obara celu proveru", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "content-guard-"));
  try {
    fs.mkdirSync(path.join(dir, "components/layout"), { recursive: true });
    fs.writeFileSync(
      path.join(dir, "components/layout/Footer.tsx"),
      'export const Footer = () => <a href="tel:+38122000000">+381 22 000 000</a>;\n',
    );
    fs.writeFileSync(path.join(dir, "components/layout/Ok.tsx"), "export const Ok = () => <p>Kontakt</p>;\n");
    const { scanned, findings } = scanRepository(dir);
    assert.equal(scanned, 2);
    // I `tel:` link i vidljiv broj — oba mesta su prijavljena sa putanjom i linijom.
    assert.deepEqual(
      findings.map((finding) => [finding.file, finding.line, finding.rule, finding.context]),
      [
        ["components/layout/Footer.tsx", 1, "template-phone", "attr:href"],
        ["components/layout/Footer.tsx", 1, "template-phone", "jsx"],
      ],
    );
    assert.match(formatFinding(findings[1]), /Footer\.tsx:1 {2}\[template-phone\] {2}\+381 22 000 000/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("izuzeci važe samo za svoj fajl i svoj tekst", () => {
  const greeting = 'export const g = "Želimo vam mirne praznike u krugu porodice.";';
  assert.deepEqual(rules("lib/seasonal/seasonalCampaigns.config.mjs", greeting), []);
  assert.deepEqual(rules("components/x/Other.tsx", greeting), ["lowercase-vi"]);
});

test("svaki izuzetak ima razlog, postoji na disku i vodi do owner dokumenta kad je otvoren", () => {
  const ownerDoc = fs.readFileSync(path.join(repoRoot, "docs/CONTENT_GAPS_REQUIRING_OWNER_INPUT.md"), "utf8");
  for (const entry of [...ALLOWLIST, ...RULE_EXCEPTIONS]) {
    assert.ok(entry.reason && entry.reason.length > 20, `razlog za ${entry.prefix ?? entry.file}`);
    const target = entry.prefix ?? entry.file;
    assert.ok(fs.existsSync(path.join(repoRoot, target)), `${target} ne postoji`);
    for (const gap of entry.reason.match(/GAP-\d{3}/g) ?? []) {
      assert.match(ownerDoc, new RegExp(`^## ${gap} — `, "m"), `${gap} nije u owner dokumentu`);
    }
  }
});
