import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { checkCronAuth } from "./cronAuth.mjs";

test("zakazani zadatak: bez tajne odbijeno, pogrešna tajna odbijena, ispravna prolazi", () => {
  const secret = "a".repeat(32);
  assert.equal(checkCronAuth(`Bearer ${secret}`, undefined), "nije_podeseno");
  assert.equal(checkCronAuth(`Bearer ${secret}`, "kratko"), "nije_podeseno");
  assert.equal(checkCronAuth(null, secret), "odbijeno");
  assert.equal(checkCronAuth(`Bearer ${"b".repeat(32)}`, secret), "odbijeno");
  assert.equal(checkCronAuth(`Bearer ${secret}`, secret), "ok");
});

test("vercel.json zakazuje dnevno brisanje obaveštenja o rabatima", () => {
  const cfg = JSON.parse(readFileSync(new URL("../../vercel.json", import.meta.url), "utf8"));
  const job = (cfg.crons ?? []).find((c) => c.path === "/api/cron/obavestenja-rabata");
  assert.ok(job, "nema zakazanog zadatka");
  assert.match(job.schedule, /^\d{1,2} \d{1,2} \* \* \*$/, "jednom dnevno (Hobby dozvoljava dnevne zadatke)");
});
