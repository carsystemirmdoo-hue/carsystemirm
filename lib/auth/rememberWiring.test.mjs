import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (p) => readFile(new URL(`../../${p}`, import.meta.url), "utf8");

test("sesija zaposlenih ostaje 8 sati i JWT; „Zapamti me” je samo za kupce", async () => {
  const config = await read("auth.config.ts");
  assert.match(config, /strategy: "jwt"/);
  assert.match(config, /maxAge: 60 \* 60 \* 8,/);
  const auth = await read("auth.ts");
  assert.match(auth, /id: "customer-remember"/);
  const provider = auth.slice(auth.indexOf('id: "customer-remember"'));
  assert.match(provider, /subject: SUBJECT_CUSTOMER/);
  assert.match(provider, /assurance: "remembered"/);
  assert.doesNotMatch(provider.slice(0, 1500), /findUserByEmail|from\(users\)|SUBJECT_INTERNAL/);
  const tokens = await read("lib/auth/remember-tokens.ts");
  assert.doesNotMatch(tokens, /\bFROM users\b|\bUPDATE users\b/, "tokeni ne diraju interne naloge");
});

test("obnova je iza prekidača i ne otvara se u middleware-u bez kolačića", async () => {
  const mw = await read("middleware.ts");
  assert.match(mw, /process\.env\.CUSTOMER_REMEMBER_ME === "1"/);
  assert.match(mw, /cs_remember/);
  const session = await read("lib/auth/remember-session.ts");
  assert.match(session, /if \(!isRememberEnabled\(\)\) return null;/);
  assert.match(session, /httpOnly: true, sameSite: "lax"/);
  const env = await read(".env.example");
  assert.match(env, /^CUSTOMER_REMEMBER_ME=0$/m, "podrazumevano isključeno");
});
