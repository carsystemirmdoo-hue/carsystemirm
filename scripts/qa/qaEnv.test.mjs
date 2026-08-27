import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import {
  checkQaMasterKey,
  MIN_KEY_BYTES,
  QA_ENV_MESSAGES,
  QA_KEY_VAR,
  qaCryptoEnv,
} from "./qa-env.mjs";

/**
 * Provera QA okruzenja mora biti tacna PRE nego sto QA prolaz uopste pocne —
 * zato se testira ovde, medju testovima koji ne traze bazu.
 */

const validan = () => randomBytes(32).toString("base64");

test("nedostajuci kljuc se odbija sa uputstvom", () => {
  const r = checkQaMasterKey({});
  assert.equal(r.ok, false);
  assert.equal(r.reason, "missing");
  // Poruka mora reci sta tacno da se uradi.
  assert.match(QA_ENV_MESSAGES.missing, /openssl rand -base64 32/);
  assert.match(QA_ENV_MESSAGES.missing, new RegExp(QA_KEY_VAR));
});

test("prazan ili beo string je isto sto i nedostajuci", () => {
  for (const raw of ["", "   ", "\n", "\t\n "]) {
    assert.equal(checkQaMasterKey({ [QA_KEY_VAR]: raw }).reason, "missing");
  }
});

test("smece koje nije prazno prijavljuje se kao prekratko, ne kao nedostajuce", () => {
  // Razlika je korisna: „missing" znaci da promenljiva nije postavljena, a
  // „too-short" da jeste ali ne valja. Uputstvo je u oba slucaja isto.
  const r = checkQaMasterKey({ [QA_KEY_VAR]: "ovo-nije-kljuc" });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "too-short");
});

test("prekratak kljuc se odbija", () => {
  // AES-256 trazi 32 bajta; kraci kljuc bi znacio slabiju zastitu nego sto
  // sema tvrdi da ima.
  const kratak = randomBytes(16).toString("base64");
  const r = checkQaMasterKey({ [QA_KEY_VAR]: kratak });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "too-short");
  assert.ok(r.bytes < MIN_KEY_BYTES);
  assert.match(QA_ENV_MESSAGES["too-short"], /najmanje 32 bajta/);
});

test("ispravan kljuc prolazi", () => {
  const r = checkQaMasterKey({ [QA_KEY_VAR]: validan() });
  assert.equal(r.ok, true);
  assert.equal(r.reason, null);
  assert.equal(r.bytes, 32);
});

test("razmaci oko vrednosti ne smetaju", () => {
  const r = checkQaMasterKey({ [QA_KEY_VAR]: `  ${validan()}  ` });
  assert.equal(r.ok, true);
});

test("QA kljuc ne sme biti isti kao produkcijski", () => {
  const kljuc = validan();
  const r = checkQaMasterKey({
    [QA_KEY_VAR]: kljuc,
    PORTAL_MFA_MASTER_KEY_V1: kljuc,
  });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "same-as-production");
});

test("razlicit produkcijski kljuc ne smeta", () => {
  const r = checkQaMasterKey({
    [QA_KEY_VAR]: validan(),
    PORTAL_MFA_MASTER_KEY_V1: validan(),
  });
  assert.equal(r.ok, true);
});

test("nijedna poruka ne sadrzi vrednost kljuca", () => {
  const tajna = "TAJNA-VREDNOST-KOJA-NE-SME-DA-PROCURI";
  for (const poruka of Object.values(QA_ENV_MESSAGES)) {
    assert.ok(!poruka.includes(tajna));
    // Poruke su staticke; ne interpoliraju nista iz okruzenja.
    assert.ok(!/\\$\\{/.test(poruka));
  }
});

test("oba procesa dobijaju ISTI master kljuc", () => {
  // Ovo je bio uzrok pada: dete je dobijalo nasumican kljuc, roditelj nijedan.
  // Dozvola potpisana jednim kljucem ne bi se proverila drugim.
  const env = { [QA_KEY_VAR]: validan() };
  const prvi = qaCryptoEnv(env);
  const drugi = qaCryptoEnv(env);
  assert.equal(prvi.PORTAL_MFA_MASTER_KEY_V1, env[QA_KEY_VAR]);
  assert.equal(prvi.PORTAL_MFA_MASTER_KEY_V1, drugi.PORTAL_MFA_MASTER_KEY_V1);
  assert.equal(prvi.PORTAL_MFA_ACTIVE_KEY_VERSION, "1");
});

test("produkcijski kljuc iz ljuske ne curi u QA prolaz", () => {
  // Runner uvek prepisuje `PORTAL_MFA_MASTER_KEY_V1` QA vrednoscu, pa produkcijski
  // kljuc ne moze da sifruje test podatke.
  const qa = validan();
  const env = { [QA_KEY_VAR]: qa, PORTAL_MFA_MASTER_KEY_V1: validan() };
  assert.equal(qaCryptoEnv(env).PORTAL_MFA_MASTER_KEY_V1, qa);
});
