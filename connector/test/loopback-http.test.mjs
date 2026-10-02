import assert from "node:assert/strict";
import test from "node:test";

const D = (p) => new URL(`../dist/connector/src/${p}`, import.meta.url).href;
const { dozvoljenLoopbackHttp, proveriOrigin } = await import(D("client.mjs"));
const u = (s) => new URL(s);

test("loopback HTTP samo izričito, samo za isti računar, nikad u paketu", () => {
  const ok = { CS_CONNECTOR_ALLOW_LOOPBACK_HTTP: "1" };
  assert.equal(dozvoljenLoopbackHttp(u("http://127.0.0.1:3419"), ok), true);
  assert.equal(dozvoljenLoopbackHttp(u("http://localhost:3419"), ok), true);
  assert.equal(dozvoljenLoopbackHttp(u("http://[::1]:3419"), ok), true);
  assert.equal(dozvoljenLoopbackHttp(u("http://127.0.0.1:3419"), {}), false, "bez promenljive");
  assert.equal(dozvoljenLoopbackHttp(u("http://192.168.0.24:3419"), ok), false, "mrežna adresa");
  assert.equal(dozvoljenLoopbackHttp(u("http://kancelarija.local"), ok), false);
  assert.equal(dozvoljenLoopbackHttp(u("http://127.0.0.1:3419"), { ...ok, CS_CONNECTOR_PACKAGED: "1" }), false, "spakovan konektor");
});

test("bez promenljive HTTP je i dalje odbijen", () => {
  const pre = process.env.CS_CONNECTOR_ALLOW_LOOPBACK_HTTP;
  delete process.env.CS_CONNECTOR_ALLOW_LOOPBACK_HTTP;
  try {
    assert.throws(() => proveriOrigin("http://127.0.0.1:3419"), (e) => e.code === "origin_not_https");
  } finally {
    if (pre !== undefined) process.env.CS_CONNECTOR_ALLOW_LOOPBACK_HTTP = pre;
  }
});
