import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { policyFor, RATE_LIMIT_SCOPES } from "../auth/rate-limit-policy.mjs";

/**
 * Oporavak kupčevog naloga dok ne postoji slanje e-pošte (odluka 2026-10-01).
 *
 * Regresija (audit 2026-10-01): „Zaboravljena lozinka" za kupce je pravila
 * token i bacala ga — outbox red nije nosio token, pa kancelarija nije imala
 * šta da preda. Uz to, aktivacija i oba reset obrasca nisu imali ograničenje
 * pokušaja. Samostalni reset je sada uklonjen, a aktivacija se broji.
 */

const root = new URL("../../", import.meta.url);
const raw = (rel) => readFileSync(new URL(rel, root), "utf8");
const code = (rel) => raw(rel).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

test("nijedna strana ni akcija ne poziva samostalni reset kupca", () => {
  const actions = code("app/prijava/kupac/aktivacija/actions.ts");
  assert.doesNotMatch(actions, /requestPasswordReset|completePasswordReset/);
  assert.doesNotMatch(actions, /export async function (requestResetAction|completeResetAction)/);
  assert.ok(!existsSync(new URL("app/prijava/kupac/lozinka/ResetRequestForm.tsx", root)));
  const page = code("app/prijava/kupac/lozinka/page.tsx");
  assert.doesNotMatch(page, /searchParams|token|PasswordSetupForm|action=/);
  assert.match(page, /komercijalisti ili kancelariji/);
  const form = code("app/prijava/kupac/aktivacija/PasswordSetupForm.tsx");
  assert.doesNotMatch(form, /completeResetAction|mode/);
});

test("aktivacija ima sopstveni opseg ograničenja pokušaja", () => {
  assert.ok(RATE_LIMIT_SCOPES.includes("customer_activation"));
  const account = policyFor("customer_activation", "account");
  const ip = policyFor("customer_activation", "ip");
  assert.ok(account.limit <= 5 && account.blockMs >= 15 * 60_000);
  assert.ok(ip.limit <= 30);
});

test("brojač se povećava pre trošenja tokena", () => {
  const actions = code("app/prijava/kupac/aktivacija/actions.ts");
  const count = actions.indexOf('scope: "customer_activation"');
  const consume = actions.indexOf("activateWithInvitation(parsed.data)");
  assert.ok(count > 0 && consume > count, "registerAttempt mora pre activateWithInvitation");
  assert.match(actions, /if \(!decision\.allowed\)/);
});
