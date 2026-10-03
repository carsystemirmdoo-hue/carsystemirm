import assert from "node:assert/strict";
import test from "node:test";
import { decideRedemption, deviceLabel, isRememberEnabled, ROTATION_GRACE_MS } from "./rememberRules.mjs";

const now = new Date("2026-10-01T10:00:00Z");
const row = (over = {}) => ({ revokedAt: null, revokedReason: null, expiresAt: new Date("2026-10-20T00:00:00Z"), sessionVersion: 3, ...over });
const acc = (over = {}) => ({ status: "active", sessionVersion: 3, canSignIn: true, ...over });

test("važeći token se rotira", () => {
  assert.deepEqual(decideRedemption(row(), acc(), now), { action: "rotate" });
});

test("nepoznat, istekao ili opozvan token se odbija", () => {
  assert.equal(decideRedemption(null, acc(), now).reason, "unknown");
  assert.equal(decideRedemption(row({ expiresAt: new Date("2026-10-01T09:59:59Z") }), acc(), now).reason, "expired");
  assert.deepEqual(decideRedemption(row({ revokedAt: now, revokedReason: "logout" }), acc(), now), { action: "reject", reason: "revoked" });
});

test("promena lozinke, odjava sa svih uređaja ili isključenje gase celu porodicu", () => {
  assert.deepEqual(decideRedemption(row(), acc({ sessionVersion: 4 }), now), { action: "revoke_family", reason: "session_revoked" });
  assert.deepEqual(decideRedemption(row(), acc({ canSignIn: false, status: "suspended" }), now), { action: "revoke_family", reason: "account_inactive" });
  assert.deepEqual(decideRedemption(row(), null, now), { action: "revoke_family", reason: "account_inactive" });
});

test("stari token posle rotacije: kratko = druga kartica, kasnije = krađa", () => {
  const recent = row({ revokedAt: new Date(now.getTime() - 5_000), revokedReason: "rotated" });
  assert.deepEqual(decideRedemption(recent, acc(), now), { action: "reject", reason: "rotated_recently" });
  const old = row({ revokedAt: new Date(now.getTime() - ROTATION_GRACE_MS - 1), revokedReason: "rotated" });
  assert.deepEqual(decideRedemption(old, acc(), now), { action: "revoke_family", reason: "reuse_detected" });
});

test("prekidač je podrazumevano isključen", () => {
  assert.equal(isRememberEnabled({}), false);
  assert.equal(isRememberEnabled({ CUSTOMER_REMEMBER_ME: "true" }), false, "samo tačno „1”");
  assert.equal(isRememberEnabled({ CUSTOMER_REMEMBER_ME: "1" }), true);
});

test("opis uređaja bez IP adrese i bez celog user-agent niza", () => {
  assert.equal(deviceLabel("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36"), "Chrome, macOS");
  assert.equal(deviceLabel("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1"), "Safari, iOS");
  assert.equal(deviceLabel(""), "Pregledač, nepoznat sistem");
});
