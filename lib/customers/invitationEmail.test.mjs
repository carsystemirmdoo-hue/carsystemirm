import assert from "node:assert/strict";
import test from "node:test";
import { belgradeDeadline, buildInvitationEmail, repSentence } from "./invitationEmail.mjs";

const base = {
  customerName: "AUTO CENTAR <TEST> DOO",
  contactName: "Petar",
  email: "kupac@example.com",
  repNames: ["Milan Vračar"],
  activationUrl: "https://carsystemirm.com/prijava/kupac/aktivacija?token=ABC",
  loginUrl: "https://carsystemirm.com/prijava",
  expiresAt: new Date("2026-11-21T10:05:00Z"),
};

test("komercijalista: samo ime, bez broja; više imena spojeno sa „i“", () => {
  assert.equal(repSentence(["Milan Vračar"]), "Vaš komercijalista je Milan Vračar.");
  assert.equal(repSentence(["A", "B", "C"]), "Vaši komercijalisti su A, B i C.");
  assert.equal(repSentence([]), null);
  const m = buildInvitationEmail(base);
  assert.match(m.text, /Vaš komercijalista je Milan Vračar\./);
  assert.match(m.text, /022 558 501/);
  assert.doesNotMatch(m.text, /\b06\d/);
});

test("bez dodeljenog komercijaliste ostaje samo kancelarija", () => {
  const m = buildInvitationEmail({ ...base, repNames: [] });
  assert.doesNotMatch(m.text, /komercijalist/);
  assert.match(m.text, /kancelariju na 022 558 501/);
});

test("rok 7 dana po beogradskom vremenu, link i adresa prijave", () => {
  assert.equal(belgradeDeadline(base.expiresAt), "21.11.2026. u 11:05");
  const m = buildInvitationEmail(base);
  assert.match(m.text, /važi 7 dana \(do 21\.11\.2026\. u 11:05\)/);
  assert.ok(m.text.includes(base.activationUrl));
  assert.match(m.text, /carsystemirm\.com\/prijava sa adresom kupac@example\.com/);
});

test("HTML je escape-ovan", () => {
  const m = buildInvitationEmail(base);
  assert.match(m.html, /AUTO CENTAR &lt;TEST&gt; DOO/);
  assert.doesNotMatch(m.html, /<TEST>/);
});
