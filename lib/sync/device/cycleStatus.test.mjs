import assert from "node:assert/strict";
import test from "node:test";
import { stanjeUredjaja, TOLERANCIJA_KASNJENJA_MIN } from "./cycle-status.mjs";

const t = (s) => new Date(s);
const baza = {
  status: "active",
  lastSeenAt: t("2026-10-07T13:02:30+02:00"),
  lastCycleAt: t("2026-10-07T13:02:00+02:00"),
  lastCycleOutcome: "obradjeno",
  lastScanCompletedAt: t("2026-10-07T13:02:00+02:00"),
  nextExpectedCycleAt: t("2026-10-07T14:02:00+02:00"),
};

test("uspešan ciklus bez novih faktura je zeleno, ne „ne radi“", () => {
  assert.equal(stanjeUredjaja({ ...baza, now: t("2026-10-07T13:30:00+02:00") }).kod, "obradjeno");
});

test("preskočen ciklus po rasporedu znači da računar radi", () => {
  const s = stanjeUredjaja({ ...baza, lastCycleOutcome: "preskoceno", now: t("2026-10-07T13:30:00+02:00") });
  assert.deepEqual([s.kod, s.ton], ["preskoceno", "success"]);
});

test("izostanak ciklusa posle najavljenog termina + tolerancija → upozorenje", () => {
  const tacnoNaGranici = new Date(baza.nextExpectedCycleAt.getTime() + TOLERANCIJA_KASNJENJA_MIN * 60_000);
  assert.equal(stanjeUredjaja({ ...baza, now: tacnoNaGranici }).kod, "obradjeno", "na samoj granici još nije uzbuna");
  const s = stanjeUredjaja({ ...baza, now: new Date(tacnoNaGranici.getTime() + 60_000) });
  assert.equal(s.kod, "nema_ciklusa");
  assert.equal(s.kasniOd.getTime(), baza.nextExpectedCycleAt.getTime());
});

test("vikend: uređaj najavi ponedeljak 08:02, pa subota nije uzbuna", () => {
  const s = stanjeUredjaja({ ...baza, nextExpectedCycleAt: t("2026-10-12T08:02:00+02:00"), now: t("2026-10-10T12:00:00+02:00") });
  assert.equal(s.kod, "obradjeno");
});

test("greška ciklusa je crveno; uređaj pre 0.3.9 nema izveštaj; neaktivan uređaj nema uzbunu", () => {
  assert.equal(stanjeUredjaja({ ...baza, lastCycleOutcome: "greska", now: t("2026-10-07T13:30:00+02:00") }).ton, "danger");
  assert.equal(stanjeUredjaja({ ...baza, lastCycleAt: null, now: t("2026-10-07T20:00:00+02:00") }).kod, "bez_izvestaja");
  assert.equal(stanjeUredjaja({ ...baza, status: "revoked", now: t("2026-10-09T20:00:00+02:00") }).kod, "neaktivan");
});
