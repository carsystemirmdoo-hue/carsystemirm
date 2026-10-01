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
  assert.deepEqual(rules("lib/contact.ts", 'export const real = "+381 22 367 139";'), []);
  assert.deepEqual(rules("lib/contact.ts", 'export const t = "Lorem ipsum dolor sit amet";'), ["lorem"]);
  assert.deepEqual(rules("lib/contact.ts", 'export const t = "Adresa: TBD";'), ["instruction-placeholder"]);
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
