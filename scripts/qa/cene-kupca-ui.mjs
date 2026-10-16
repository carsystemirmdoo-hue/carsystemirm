/**
 * Provera „Cene po kupcu“ (0057) u pregledaču nad sintetičkom bazom.
 *
 * Server: `.next-verify` na 127.0.0.1:3450, baza iz `seed-synthetic-portal.mts` + `seed-synthetic-cene-kupca.mts`.
 *   SYNTH_CREDS_FILE=~/.carsystem-secrets/cene-kupca-sinteticki.json \
 *   SYNTH_DB_URL=postgres://carsystem_qa@127.0.0.1:55436/carsystem_cene_kupca_ui_qa \
 *   SHOTS=<fascikla za snimke> node scripts/qa/cene-kupca-ui.mjs
 * Lozinke i TOTP tajne se čitaju iz fajla i ne ispisuju se.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import * as OTPAuth from "otpauth";
import postgres from "postgres";
import { chromium } from "playwright-core";

const creds = JSON.parse(readFileSync(process.env.SYNTH_CREDS_FILE, "utf8"));
const B = process.env.SYNTH_BASE_URL ?? "http://127.0.0.1:3450";
const SHOTS = process.env.SHOTS ?? "/tmp/cene-kupca-shots";
mkdirSync(SHOTS, { recursive: true });
const sqlc = postgres(process.env.SYNTH_DB_URL, { max: 1, onnotice: () => {} });
const totp = (b32) => new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(b32), digits: 6, period: 30, algorithm: "SHA1" }).generate();
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PROLAZ" : "PAD   "} ${name}${detail ? " :: " + detail : ""}`);
};
const last = {};
async function login(page, who) {
  while (last[who] === Math.floor(Date.now() / 30000)) await new Promise((r) => setTimeout(r, 1000));
  last[who] = Math.floor(Date.now() / 30000);
  const c = creds[who];
  await page.goto(`${B}/prijava?za=zaposleni`, { waitUntil: "networkidle" });
  await page.fill("input[name=email]", c.email);
  await page.fill("input[name=password]", c.password);
  for (let attempt = 1; attempt <= 2; attempt++) {
    while (Date.now() % 30000 > 25000) await new Promise((r) => setTimeout(r, 500));
    if (!(await page.locator("input[name=secondFactor]").isVisible())) {
      await page.fill("input[name=password]", c.password);
      await page.getByRole("button", { name: "Nastavite" }).click();
    }
    await page.fill("input[name=secondFactor]", totp(c.totpBase32));
    await page.keyboard.press("Enter");
    try {
      await page.waitForURL((u) => !u.pathname.startsWith("/prijava"), { timeout: 20000 });
      return;
    } catch {
      if (attempt === 2) throw new Error(`prijava ${who} nije uspela`);
      while (last[who] === Math.floor(Date.now() / 30000)) await new Promise((r) => setTimeout(r, 1000));
    }
  }
}
const A = creds.ids.A;
const C = creds.ids.C;
const errors = [];
const browser = await chromium.launch();
const ctx = async (w = 1440, h = 1000) => {
  const c = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1.5 });
  const p = await c.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("dialog", (d) => d.accept());
  return { c, p };
};
const go = (p, path) => p.goto(`${B}${path}`, { waitUntil: "networkidle", timeout: 120000 });
const noHScroll = async (p) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

try {
  /* ---- Kancelarija (Tamara): samo pregled, poslednja faktura, sme uvoz ---- */
  {
    const { c, p } = await ctx();
    await login(p, "kancelarija");
    await go(p, `/portal/cene/kupci/${A}`);
    check("kancelarija: ime kupca istaknuto", (await p.locator(".ck-customer-name").innerText()).includes("SINT Auto Lak"));
    check("kancelarija: nema polja za rabat", (await p.locator("input.ck-inp").count()) === 0);
    check("kancelarija: kolona Poslednja faktura", await p.getByRole("columnheader", { name: /Poslednja faktura/ }).isVisible());
    check("kancelarija: traka „Samo pregled“", await p.locator(".ck-readonly").isVisible());
    await p.screenshot({ path: `${SHOTS}/1-kancelarija-racunar.png` });
    await go(p, "/portal/cene/uvoz");
    check("kancelarija: otvara uvoz VP cenovnika", await p.getByRole("heading", { name: "Uvoz VP cenovnika" }).isVisible());
    const csv = `Sifra;Naziv;VP pak.\nSINT-L05;Lak 5L;11.700,00\nSINT-T19;Traka;250,00\nSINT-NOVO9;Nova bazna 0,5L;3.600,00\nSINT-U25;Ucvrscivac;12a\n`;
    await p.setInputFiles("#uvoz-fajl", { name: "sint-cenovnik.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
    await p.getByText("pakovanju — deli se").click();
    await p.screenshot({ path: `${SHOTS}/5-uvoz-kolone.png`, fullPage: true });
    await Promise.all([p.waitForURL(/\/portal\/cene\/uvoz\/[0-9a-f-]{36}/, { timeout: 60000 }), p.getByRole("button", { name: /Dalje: prepoznavanje/ }).click()]);
    const body = await p.locator("main").innerText();
    check("uvoz: 11.700,00 ÷ 5 = 2.340,00 po JM", body.includes("2.340,00"));
    check("uvoz: neispravan red izdvojen", /Neispravni redovi[\s\S]*SINT-U25/.test(body));
    check("uvoz: nova šifra u koraku 4", body.includes("SINT-NOVO9"));
    await p.screenshot({ path: `${SHOTS}/6-uvoz-pregled.png`, fullPage: true });
    await c.close();
  }
  /* ---- Magacioner: samo pregled ---- */
  {
    const { c, p } = await ctx();
    await login(p, "magacin");
    await go(p, `/portal/cene/kupci/${A}`);
    check("magacioner: vidi cene, bez polja", (await p.locator(".ck-customer-name").count()) === 1 && (await p.locator("input.ck-inp").count()) === 0);
    const r = await p.goto(`${B}/portal/cene/uvoz`);
    check("magacioner: uvoz zabranjen", r.status() === 403 || (await p.locator("body").innerText()).includes("Nemate"));
    await c.close();
  }
  /* ---- Komercijalista (Petar): svoj kupac, izmena cenom, čuvanje, akcija i preklapanje ---- */
  {
    const { c, p } = await ctx();
    await login(p, "petar");
    await go(p, "/portal/cene/kupci");
    const list = await p.locator("main").innerText();
    check("komercijalista: vidi samo svoje kupce", list.includes("SINT Auto Lak") && !list.includes("SINT Karoserija B"));
    const forbidden = await p.goto(`${B}/portal/cene/kupci/${creds.ids.B}`);
    check("komercijalista: tuđi kupac zabranjen", forbidden.status() === 403);
    await go(p, `/portal/cene/kupci/${A}?q=SINT-L01`);
    const odlRabat = p.locator('input[aria-label^="Odloženo plaćanje — 30 dana: rabat"]').first();
    const avRabat = p.locator('input[aria-label^="Avansno plaćanje: rabat"]').first();
    // Ponovljiv tok: cilj se menja u odnosu na sačuvano (24 ↔ 25 %, 28 ↔ 29 %).
    const target = (await odlRabat.inputValue()) === "24" ? 25 : 24;
    const targetAv = (await avRabat.inputValue()) === "28" ? 29 : 28;
    const price = new Intl.NumberFormat("sr-Latn-RS", { minimumFractionDigits: 2 }).format(2360 * (1 - target / 100));
    await p.locator('input[aria-label^="Odloženo plaćanje — 30 dana: cena"]').first().fill(price);
    check(`izmena cenom ${price}: rabat izračunat ${target}`, (await odlRabat.inputValue()) === String(target));
    await avRabat.fill(String(targetAv));
    await p.screenshot({ path: `${SHOTS}/2-komercijalista-uredjivanje.png` });
    await p.getByRole("button", { name: /Sačuvajte izmene \(2\)/ }).click();
    await p.screenshot({ path: `${SHOTS}/3-pregled-pre-cuvanja.png`, fullPage: true });
    await p.getByRole("button", { name: /Potvrdite i sačuvajte/ }).click();
    await p.locator('[role="status"]').filter({ hasText: "Sačuvano" }).waitFor({ timeout: 30000 });
    check("čuvanje: poruka i obaveštenje vlasniku", (await p.locator('[role="status"]').filter({ hasText: "Sačuvano" }).innerText()).includes("Vlasnik je dobio obaveštenje"));
    const [rule] = await sqlc`SELECT discount_percent::text AS d, net_price, biznisoft_entry_required AS b FROM price_rules WHERE customer_id = ${A} AND payment_condition = 'odlozeno_30' AND article_id = (SELECT id FROM articles WHERE code = 'SINT-L01') AND status <> 'revoked' ORDER BY created_at DESC LIMIT 1`;
    check(`baza: sačuvan rabat ${target}, ne cena, samo portal`, Number(rule.d) === target && rule.net_price === null && rule.b === false);
    // Akcija koja se preklapa sa postojećom (SINT-T19, odloženo)
    await go(p, `/portal/cene/kupci/${A}?q=SINT-T19`);
    await p.locator('input[aria-label^="Odloženo plaćanje — 30 dana: rabat"]').first().fill("35");
    await p.getByRole("button", { name: /Sačuvajte izmene \(1\)/ }).click();
    await p.getByRole("button", { name: "Akcija od–do" }).click();
    const fmt = (d) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    const d1 = new Date(Date.now() + 5 * 86400000);
    const d2 = new Date(Date.now() + 10 * 86400000);
    await p.getByRole("textbox", { name: "Akcija od" }).fill(fmt(d1));
    await p.getByRole("textbox", { name: "Akcija do" }).fill(fmt(d2));
    await p.keyboard.press("Tab");
    const save = p.getByRole("button", { name: /Potvrdite i sačuvajte/ });
    check("preklapanje: bez potvrde nema čuvanja", (await p.getByText("Preklapanje sa postojećom akcijom").isVisible()) && (await save.isDisabled()));
    await p.screenshot({ path: `${SHOTS}/4-akcija-preklapanje.png`, fullPage: true });
    await p.getByLabel(/Zamenite: postojeća akcija/).check();
    await save.click();
    await p.locator('[role="status"]').filter({ hasText: "Sačuvano" }).waitFor({ timeout: 30000 });
    const promos = await sqlc`SELECT effective_from::text AS f, effective_to::text AS t, discount_percent::text AS d FROM price_rules WHERE customer_id = ${A} AND rule_kind = 'akcija' AND article_id = (SELECT id FROM articles WHERE code = 'SINT-T19') AND status <> 'revoked' ORDER BY effective_from`;
    check("akcija: stara skraćena do dana pre nove", promos.length === 2 && promos[1].d.startsWith("35") && promos[0].t < promos[1].f, JSON.stringify(promos));
    await c.close();
  }
  /* ---- Vlasnik: obaveštenje od komercijaliste; izmena kupca bez komercijaliste ---- */
  {
    const { c, p } = await ctx();
    await login(p, "vlasnik");
    await go(p, "/portal/cene/obavestenja");
    const t = await p.locator("main").innerText();
    check("vlasnik: obaveštenje o izmeni komercijaliste", t.includes("SINT Petar") && t.includes("SINT-L01"));
    await p.screenshot({ path: `${SHOTS}/7-obavestenja-vlasnik.png`, fullPage: true });
    await go(p, `/portal/cene/kupci/${C}?q=SINT-L05`);
    const cAv = p.locator('input[aria-label^="Avansno plaćanje: rabat"]').first();
    await cAv.fill((await cAv.inputValue()) === "16" ? "17" : "16");
    await p.getByRole("button", { name: /Sačuvajte izmene \(1\)/ }).click();
    check("vlasnik, kupac bez komercijaliste: najava „ne ide nikome“", await p.getByText(/ne ide nikome/).isVisible());
    await p.getByRole("button", { name: /Potvrdite i sačuvajte/ }).click();
    await p.locator('[role="status"]').filter({ hasText: "Sačuvano" }).waitFor({ timeout: 30000 });
    const [{ n }] = await sqlc`SELECT count(*)::int AS n FROM rebate_change_notices WHERE customer_id = ${C}`;
    check("vlasnik, kupac bez komercijaliste: nijedno obaveštenje", n === 0);
    await c.close();
  }
  /* ---- Komercijalista na telefonu ---- */
  {
    const { c, p } = await ctx(390, 844);
    await login(p, "petar");
    await go(p, `/portal/cene/kupci/${A}`);
    check("telefon: bez vodoravnog pomeranja (tabela)", await noHScroll(p));
    await p.locator('input[aria-label^="Avansno plaćanje: rabat"]').nth(1).fill("30");
    check("telefon: bez vodoravnog pomeranja (izmena)", await noHScroll(p));
    await p.screenshot({ path: `${SHOTS}/8-komercijalista-telefon.png` });
    await go(p, "/portal/cene/obavestenja");
    check("telefon: obaveštenja bez vodoravnog pomeranja", await noHScroll(p));
    await p.screenshot({ path: `${SHOTS}/9-obavestenja-telefon.png`, fullPage: true });
    await c.close();
  }
} catch (e) {
  check("tok bez prekida", false, String(e?.message ?? e).slice(0, 300));
} finally {
  check("bez JS grešaka na stranama", errors.length === 0, errors.slice(0, 3).join(" | "));
  writeFileSync(`${SHOTS}/rezultat.json`, JSON.stringify(results, null, 2));
  console.log(`\n${results.filter((r) => r.ok).length}/${results.length} provera prošlo`);
  await browser.close();
  await sqlc.end();
}
