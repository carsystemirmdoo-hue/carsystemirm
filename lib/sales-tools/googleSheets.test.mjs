import assert from "node:assert/strict";
import { createVerify, generateKeyPairSync } from "node:crypto";
import test from "node:test";
import { readSheetValues, serviceAccountAssertion, SheetReadError, sheetConfig } from "./googleSheets.mjs";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const env = { RECEIVABLES_SHEET_ID: "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789", GOOGLE_SERVICE_ACCOUNT_EMAIL: "portal@x.iam.gserviceaccount.com", GOOGLE_SERVICE_ACCOUNT_KEY: pem.replace(/\n/g, "\\n") };

test("bez sve tri promenljive nema povezivanja", () => {
  assert.equal(sheetConfig({}), null);
  assert.equal(sheetConfig({ ...env, RECEIVABLES_SHEET_ID: "../x" }), null);
  assert.equal(sheetConfig(env)?.range, "A1:Z5000");
});

test("JWT je potpisan ključem servisnog naloga i traži SAMO čitanje", () => {
  const cfg = sheetConfig(env);
  assert.ok(cfg);
  const jwt = serviceAccountAssertion(cfg, 1_800_000_000);
  const [h, c, s] = jwt.split(".");
  const v = createVerify("RSA-SHA256");
  v.update(`${h}.${c}`);
  assert.equal(v.verify(publicKey, Buffer.from(s, "base64url")), true);
  const claims = JSON.parse(Buffer.from(c, "base64url").toString());
  assert.equal(claims.scope, "https://www.googleapis.com/auth/spreadsheets.readonly");
  assert.equal(claims.exp - claims.iat, 3600);
});

test("čitanje: token pa vrednosti; nepodeljena tabela daje jasnu poruku", async () => {
  const cfg = sheetConfig(env);
  assert.ok(cfg);
  const calls = [];
  const ok = async (url, init) => {
    calls.push(String(url));
    if (String(url).includes("oauth2")) return new Response(JSON.stringify({ access_token: "t" }));
    assert.equal(init.headers.authorization, "Bearer t");
    return new Response(JSON.stringify({ values: [["Kupac", "Ostatak"], ["Firma", 1200.5, ""]] }));
  };
  assert.deepEqual(await readSheetValues(cfg, ok), [["Kupac", "Ostatak"], ["Firma", 1200.5, null]]);
  assert.match(calls[1], /valueRenderOption=UNFORMATTED_VALUE/);
  const denied = async (url) => (String(url).includes("oauth2") ? new Response(JSON.stringify({ access_token: "t" })) : new Response("{}", { status: 403 }));
  await assert.rejects(readSheetValues(cfg, denied), (e) => e instanceof SheetReadError && /podeljena/.test(e.message));
});
