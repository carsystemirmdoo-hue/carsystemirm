#!/usr/bin/env node
/**
 * Provera aplikacije nad VRAĆENOM bazom (mesečna ručna proba vraćanja).
 *
 *   APP_URL=http://127.0.0.1:3432 PROBE_CREDS_FILE=<json> node scripts/backup/app-check.mjs --manifest <m.json>
 *
 * Prijavljuje se probnim nalogom (lozinka + TOTP iz tajne fajla), otvara Prodaju
 * za ceo period i poredi „Neto promet" sa zbirom iz manifesta snimka. Dokazuje
 * da vraćena baza + čuvani MFA ključ + tajne aplikacije zajedno rade.
 *
 * Fajl sa kredencijalima je JSON { email, password, totpBase32 } van repoa (600).
 * Ništa od toga se ne ispisuje.
 */
import { readFileSync } from "node:fs";
import * as OTPAuth from "otpauth";
import { chromium } from "playwright-core";
import { makeLogger } from "../../lib/backup/redact.mjs";

const creds = JSON.parse(readFileSync(process.env.PROBE_CREDS_FILE ?? "", "utf8"));
const log = makeLogger(undefined, () => [creds.password, creds.totpBase32]);
const APP = process.env.APP_URL ?? "http://127.0.0.1:3432";
const mIdx = process.argv.indexOf("--manifest");
const manifest = JSON.parse(readFileSync(process.argv[mIdx + 1], "utf8"));
const expectedNet = Math.round(manifest.totals.net);

const totp = () => new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(creds.totpBase32), digits: 6, period: 30, algorithm: "SHA1" }).generate();
const result = { login: false, mfa: false, salesNet: null, expectedNet, salesMatch: false };
const browser = await chromium.launch();
try {
  const page = await (await browser.newContext()).newPage();
  await page.goto(`${APP}/prijava`, { waitUntil: "networkidle", timeout: 180000 });
  await page.fill("input[name=email]", creds.email);
  await page.fill("input[name=password]", creds.password);
  await page.fill("input[name=secondFactor]", totp());
  await Promise.all([page.waitForURL((u) => !u.pathname.endsWith("/prijava"), { timeout: 120000 }), page.keyboard.press("Enter")]);
  result.login = true;
  result.mfa = !new URL(page.url()).pathname.includes("/bezbednost/mfa");
  await page.goto(`${APP}/portal/prodaja?from=2000-01-01&to=2100-12-31`, { waitUntil: "networkidle", timeout: 180000 });
  const card = page.locator(".portal-metric", { hasText: "Neto promet" }).first();
  const text = (await card.locator(".portal-metric-value").textContent())?.trim() ?? "";
  result.salesNet = Number(text.replace(/\./g, "").replace(/,/g, ".").replace(/[^\d.-]/g, ""));
  result.salesMatch = result.salesNet === expectedNet;
} finally {
  await browser.close();
}
log(JSON.stringify(result));
process.exitCode = result.login && result.mfa && result.salesMatch ? 0 : 1;
