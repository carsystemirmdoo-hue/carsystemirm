import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  sessionCookieContract,
  sessionCookieName,
  sessionCookieOptions,
  shouldUseSecureCookies,
} from "./cookie-policy.mjs";
import {
  HSTS_VALUE,
  MAP_TILES_ORIGIN,
  securityHeaders,
  shouldSendHsts,
} from "../security/http-headers.mjs";

const PROD = { AUTH_URL: "https://portal.carsystemirm.com", VERCEL_ENV: "production" };
const DEV = { AUTH_URL: "http://localhost:3000", NODE_ENV: "development" };

const byKey = (headers, key) => headers.find((h) => h.key === key)?.value;
const directives = (value) =>
  Object.fromEntries(
    value.split(";").map((part) => {
      const [name, ...rest] = part.trim().split(/\s+/);
      return [name, rest.join(" ")];
    }),
  );

/* -------------------------------------------------------------------------
 * Kolačić sesije
 * ---------------------------------------------------------------------- */

test("produkcija preko HTTPS-a dobija zasticen kolacic", () => {
  const contract = sessionCookieContract(PROD);
  assert.equal(contract.secure, true);
  assert.equal(contract.name, "__Host-authjs.session-token");
  assert.equal(contract.options.httpOnly, true);
  assert.equal(contract.options.secure, true);
  assert.equal(contract.options.sameSite, "lax");
  assert.equal(contract.options.path, "/");
});

test("lokalni HTTP razvoj NIJE pokvaren zastavicom Secure", () => {
  const contract = sessionCookieContract(DEV);
  assert.equal(contract.secure, false, "Secure na HTTP-u obara prijavu");
  assert.equal(
    contract.name,
    "authjs.session-token",
    "__Host- bez Secure pretrazivac odbacuje",
  );
  assert.equal(contract.options.secure, false);
  // Ostalo ostaje isto i u razvoju.
  assert.equal(contract.options.httpOnly, true);
  assert.equal(contract.options.sameSite, "lax");
  assert.equal(contract.options.path, "/");
});

test("Domain se NIKADA ne postavlja — kolacic je host-only", () => {
  for (const env of [PROD, DEV, {}]) {
    const options = sessionCookieContract(env).options;
    assert.ok(!("domain" in options), "postavljen je Domain; sesija curi na poddomene");
  }
});

test("izvod Secure prati isti signal kao Auth.js", () => {
  // `@auth/core/lib/init.js`: config.useSecureCookies ?? url.protocol === "https:"
  assert.equal(shouldUseSecureCookies({ AUTH_URL: "https://x.rs" }), true);
  assert.equal(shouldUseSecureCookies({ AUTH_URL: "http://localhost:3000" }), false);
  assert.equal(shouldUseSecureCookies({ NEXTAUTH_URL: "https://x.rs" }), true);
  // Bez adrese: samo Vercel produkcija.
  assert.equal(shouldUseSecureCookies({ VERCEL_ENV: "production" }), true);
  assert.equal(shouldUseSecureCookies({ VERCEL_ENV: "preview" }), false);
  assert.equal(shouldUseSecureCookies({}), false);
  // Prazna adresa ne sme da prođe kao HTTPS.
  assert.equal(shouldUseSecureCookies({ AUTH_URL: "" , VERCEL_ENV: "production" }), true);
});

test("prefiks i opcije su uskladjeni — nema imena bez uslova", () => {
  for (const secure of [true, false]) {
    const name = sessionCookieName(secure);
    const options = sessionCookieOptions(secure);
    if (name.startsWith("__Host-")) {
      // Uslovi prefiksa: Secure, Path=/, bez Domain.
      assert.equal(options.secure, true);
      assert.equal(options.path, "/");
      assert.ok(!("domain" in options));
    } else {
      assert.equal(options.secure, false);
    }
  }
});

test("auth.config koristi ugovor i ne postavlja imena naslepo", async () => {
  const config = await readFile(new URL("../../auth.config.ts", import.meta.url), "utf8");
  const code = config.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

  assert.match(code, /sessionCookieContract\(/);
  assert.match(code, /useSecureCookies: sessionCookie\.secure/);
  assert.match(code, /sessionToken: \{/);

  // Pomoćni kolačići se NE preimenuju — CSRF već koristi __Host- po defaultu.
  for (const other of ["csrfToken", "callbackUrl", "state", "pkceCodeVerifier"]) {
    assert.ok(!code.includes(`${other}:`), `preimenovan je ${other} bez potrebe`);
  }
});

/* -------------------------------------------------------------------------
 * HTTP zaglavlja
 * ---------------------------------------------------------------------- */

test("na snazi su samo direktive koje ne mogu oboriti stranu", () => {
  const enforced = directives(byKey(securityHeaders(PROD), "Content-Security-Policy"));

  assert.equal(enforced["frame-ancestors"], "'none'");
  assert.equal(enforced["object-src"], "'none'");
  assert.equal(enforced["base-uri"], "'self'");
  assert.equal(enforced["form-action"], "'self'");

  // Skripte i stilovi NISU na snazi — to bi tražilo nonce i oborilo SSG.
  assert.ok(!("script-src" in enforced), "script-src je na snazi bez nonce-a");
  assert.ok(!("style-src" in enforced), "style-src je na snazi bez nonce-a");
  assert.ok(!("default-src" in enforced), "default-src je na snazi bez nonce-a");
});

test("puna politika je u rezimu prijave i pokriva stvarne izvore", () => {
  const report = directives(
    byKey(securityHeaders(PROD), "Content-Security-Policy-Report-Only"),
  );

  assert.equal(report["default-src"], "'self'");
  // MapLibre: stil, pločice i radnik.
  assert.ok(report["connect-src"].includes(MAP_TILES_ORIGIN));
  assert.ok(report["img-src"].includes(MAP_TILES_ORIGIN));
  assert.ok(report["img-src"].includes("blob:"));
  assert.ok(report["worker-src"].includes("blob:"));
  // `next/font` self-hostuje — nema Google domena.
  assert.equal(report["font-src"], "'self'");
  assert.ok(!JSON.stringify(report).includes("gstatic"));
  assert.ok(!JSON.stringify(report).includes("googleapis"));
  // Turnstile i analitika ne postoje u kodu, pa ih nema ni u politici.
  assert.ok(!JSON.stringify(report).includes("challenges.cloudflare"));
});

test("unsafe-eval nikada nije dozvoljen", () => {
  for (const header of securityHeaders(PROD)) {
    assert.ok(
      !header.value.includes("'unsafe-eval'"),
      `${header.key} dozvoljava unsafe-eval`,
    );
  }
});

test("unsafe-inline postoji SAMO u rezimu prijave, i samo za skripte i stilove", () => {
  const headers = securityHeaders(PROD);
  const enforced = byKey(headers, "Content-Security-Policy");
  const report = byKey(headers, "Content-Security-Policy-Report-Only");

  assert.ok(!enforced.includes("'unsafe-inline'"), "unsafe-inline je na snazi");

  const withInline = report
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.includes("'unsafe-inline'"))
    .map((part) => part.split(/\s+/)[0]);
  assert.deepEqual(withInline.sort(), ["script-src", "style-src"]);
});

test("geolokacija ostaje dozvoljena — na njoj stoji glavni javni CTA", () => {
  const permissions = byKey(securityHeaders(PROD), "Permissions-Policy");
  assert.match(permissions, /geolocation=\(self\)/);
  assert.match(permissions, /camera=\(\)/);
  assert.match(permissions, /microphone=\(\)/);
});

test("nosniff i referrer-policy su postavljeni", () => {
  const headers = securityHeaders(PROD);
  assert.equal(byKey(headers, "X-Content-Type-Options"), "nosniff");
  assert.equal(
    byKey(headers, "Referrer-Policy"),
    "strict-origin-when-cross-origin",
  );
});

/* -------------------------------------------------------------------------
 * HSTS
 * ---------------------------------------------------------------------- */

test("HSTS ide samo u produkciju", () => {
  assert.equal(shouldSendHsts(PROD), true);
  assert.equal(shouldSendHsts({ VERCEL_ENV: "preview" }), false);
  assert.equal(shouldSendHsts(DEV), false);
  assert.equal(shouldSendHsts({}), false);
});

test("razvoj i preview ne dobijaju HSTS", () => {
  for (const env of [DEV, { VERCEL_ENV: "preview" }, {}]) {
    const value = byKey(securityHeaders(env), "Strict-Transport-Security");
    assert.equal(value, undefined, `HSTS je poslat u ${JSON.stringify(env)}`);
  }
});

test("HSTS je konzervativan: bez preload i bez includeSubDomains", () => {
  assert.equal(byKey(securityHeaders(PROD), "Strict-Transport-Security"), HSTS_VALUE);
  assert.ok(!HSTS_VALUE.includes("preload"), "preload se tesko povlaci");
  assert.ok(
    !HSTS_VALUE.includes("includeSubDomains"),
    "poddomen portala jos nema sertifikat",
  );
  const maxAge = Number(HSTS_VALUE.match(/max-age=(\d+)/)[1]);
  assert.ok(maxAge > 0 && maxAge <= 60 * 60 * 24 * 7, `max-age nije konzervativan: ${maxAge}`);
});

/* -------------------------------------------------------------------------
 * Vezivanje u konfiguraciju
 * ---------------------------------------------------------------------- */

test("zaglavlja su primenjena na sve rute i ne traze dinamicko renderovanje", async () => {
  const config = await readFile(new URL("../../next.config.ts", import.meta.url), "utf8");
  const code = config.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

  assert.match(code, /source: "\/:path\*"/);
  assert.match(code, /headers: securityHeaders\(/);
  // Nonce bi zahtevao dinamičko renderovanje i oborio statičku generaciju.
  assert.doesNotMatch(code, /nonce/i);
  // Tehnička dokumenta ostaju noindex. Pravilo je od SEO rada (PR #10) prošireno sa
  // `/documents/products/rm/` na sve brendove, pa pokriva i R-M.
  assert.match(code, /source: "\/documents\/products\/:path\*",\s*headers: \[\s*\{\s*key: "X-Robots-Tag",\s*value: "noindex, follow"/);
  // Statička generacija se ne dira.
  assert.doesNotMatch(code, /output:\s*["']export["']/);
});
