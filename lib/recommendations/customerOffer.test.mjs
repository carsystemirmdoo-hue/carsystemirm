import assert from "node:assert/strict";
import test from "node:test";
import { DISMISS_REASONS, dismissReasonLabel, fileSlug, offerLines, parseDismissal } from "./customerOffer.mjs";

test("razlozi: isti ključevi kao CHECK u 0060", async () => {
  const { readFile } = await import("node:fs/promises");
  const sql = await readFile(new URL("../../db/migrations/0060_customer_article_dismissals.sql", import.meta.url), "utf8");
  for (const [k] of DISMISS_REASONS) assert.match(sql, new RegExp(`'${k}'`), k);
  assert.equal(dismissReasonLabel("cena"), "Cena");
});

test("unos „Ne uzima više“: zamena traži artikal, „Drugo“ traži napomenu", () => {
  assert.equal(parseDismissal({ articleCode: "315120", reason: "x" }).ok, false);
  assert.equal(parseDismissal({ articleCode: "315120", reason: "zamenjen" }).ok, false);
  assert.equal(parseDismissal({ articleCode: "315120", reason: "zamenjen", replacementCode: "315120" }).ok, false);
  assert.equal(parseDismissal({ articleCode: "315120", reason: "drugo", note: " " }).ok, false);
  const ok = parseDismissal({ articleCode: " 315120 ", reason: "drugi_brend", replacementCode: "999", note: " Sikkens " });
  assert.deepEqual(ok, { ok: true, value: { articleCode: "315120", reason: "drugi_brend", replacementCode: null, note: "Sikkens" } });
});

test("ponuda: poklopac ide uz posudu u zbiru količina; bez cene = na upit", () => {
  const price = (b, p) => ({ baseCents: b, discountPercent: p, netCents: Math.round(b * (1 - p / 100)) });
  const lid = { code: "700192", name: "POKLOPAC 1,2 L", unit: "KOM", quantity: 0, price: price(1400, 35) };
  const r = offerLines(
    [
      { code: "700191", name: "BLANKO POSUDA 1,2 L", unit: "KOM", quantity: 100, price: price(4500, 35) },
      { code: "009120", name: "PVC POSUDA 1,2L", unit: "KOM", quantity: 50, price: price(5000, 35) },
      { code: "X1", name: "Bez cene", unit: "KOM", quantity: 2, price: null },
    ],
    [{ containerCode: "700191", lid }, { containerCode: "009120", lid }],
  );
  const l = r.lines.find((x) => x.code === "700192");
  assert.equal(l?.quantity, 150);
  assert.equal(l?.lid, true);
  assert.equal(r.priceless, 1);
  assert.equal(r.totalCents, 2925 * 100 + 3250 * 50 + 910 * 150);
  // Poklopac koji je već izabran ne duplira se.
  const r2 = offerLines([{ code: "700191", name: "P", unit: "KOM", quantity: 10, price: null }, { ...lid, quantity: 10 }], [{ containerCode: "700191", lid }]);
  assert.equal(r2.lines.filter((x) => x.code === "700192").length, 1);
});

test("naziv fajla bez dijakritika i znakova", () => {
  assert.equal(fileSlug("AUTO CENTAR ŠOKČIĆ DOO"), "AUTO-CENTAR-SOKCIC-DOO");
  assert.equal(fileSlug("Đorđe / „Lak“"), "Djordje-Lak");
});
