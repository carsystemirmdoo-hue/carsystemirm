/**
 * Prijava na LOKALNI sintetički portal bez ispisa lozinke.
 *
 *   node scripts/qa/sint-prijava.mjs                → spisak uloga (bez lozinki)
 *   SYNTH_PORT=3451 SYNTH_CREDS_FILE=~/.carsystem-secrets/cene-kupca-tok.json … → drugi server (tok korpe)
 *   node scripts/qa/sint-prijava.mjs kancelarija    → adresa na ekranu, lozinka u međuspremnik (pbcopy),
 *                                                     pa tekući kod drugog faktora (osvežava se; Ctrl+C za kraj)
 *
 * Nalozi su izmišljeni (seed-synthetic-portal.mts) i čuvaju se samo u fajlu sa pravima 0600
 * (podrazumevano ~/.carsystem-secrets/cene-kupca-sinteticki.json, ili SYNTH_CREDS_FILE).
 */
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import * as OTPAuth from "otpauth";

const file = process.env.SYNTH_CREDS_FILE ?? `${process.env.HOME}/.carsystem-secrets/cene-kupca-sinteticki.json`;
if ((statSync(file).mode & 0o077) !== 0) {
  console.error(`Fajl ${file} je čitljiv i drugima — prekidam (očekivana prava 0600).`);
  process.exit(1);
}
const creds = JSON.parse(readFileSync(file, "utf8"));
const LABEL = {
  vlasnik: "Vlasnik (gazda)",
  kancelarija: "Kancelarija (Tamara)",
  petar: "Komercijalista Petar — kupac SINT Auto Lak",
  jovan: "Komercijalista Jovan — kupac SINT Karoserija B",
  magacin: "Magacioner",
  kupac: "Kupac SINT Auto Lak (korpa)",
};
const who = process.argv[2];
if (!who || !creds[who] || !LABEL[who]) {
  console.log("Uloge:");
  for (const [k, l] of Object.entries(LABEL)) if (creds[k]) console.log(`  ${k.padEnd(12)} ${l} — ${creds[k].email}`);
  console.log("\nPokrenite sa ulogom, npr.: node scripts/qa/sint-prijava.mjs kancelarija");
  process.exit(who ? 1 : 0);
}
const c = creds[who];
execFileSync("pbcopy", { input: c.password });
const base = `http://127.0.0.1:${process.env.SYNTH_PORT ?? "3450"}`;
const url = who === "kupac" ? `${base}/prijava/kupac` : `${base}/prijava?za=zaposleni`;
console.log(`${LABEL[who]}\n  adresa:  ${c.email}\n  lozinka: kopirana u međuspremnik (Cmd+V u polje „Lozinka“)\n  prijava: ${url}`);
if (!c.totpBase32) process.exit(0);
const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(c.totpBase32), digits: 6, period: 30, algorithm: "SHA1" });
const show = () => {
  const left = 30 - (Math.floor(Date.now() / 1000) % 30);
  process.stdout.write(`\r  kod drugog faktora: ${totp.generate()}  (još ${String(left).padStart(2)} s)   `);
};
show();
setInterval(show, 1000);
