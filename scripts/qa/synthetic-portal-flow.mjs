/**
 * Ceo tok portala u pregledaču nad SINTETIČKOM bazom (revizija 57).
 *
 * Priprema: scripts/qa/seed-synthetic-portal.mts u bazu carsystem_revizija_ui_qa,
 * server iz .next-verify na 127.0.0.1:3450 (DATABASE_POOL_MAX=1 — najstrožije).
 *   node scripts/qa/synthetic-portal-flow.mjs <izlazni-folder> [sve|kupac|kancelarija|opseg|telefon|sajt|lager|lager-mfa|lager-kupci]
 * Menja samo sintetičku bazu (privremena promena rabata za proveru nove potvrde).
 * Lozinke i TOTP tajne čita iz SYNTH_CREDS_FILE i ne ispisuje ih.
 */
import { mkdirSync, readFileSync } from "node:fs";
const ROOT = new URL("../../", import.meta.url).pathname;
const { chromium } = await import(ROOT + "/node_modules/playwright-core/index.mjs");
const OTPAuth = await import(ROOT + "/node_modules/otpauth/dist/otpauth.esm.js");
const postgres = (await import(ROOT + "/node_modules/postgres/src/index.js")).default;
const creds = JSON.parse(readFileSync(process.env.SYNTH_CREDS_FILE ?? process.env.HOME + "/.carsystem-secrets/revizija-sinteticki.json", "utf8"));
const OUT = process.argv[2]; mkdirSync(OUT, { recursive: true });
const STEP = process.argv[3] ?? "sve";
// Podrazumevano kao ranije; SYNTH_BASE_URL / SYNTH_DB_URL za zasebnu bazu i server (paralelna proba).
const B = process.env.SYNTH_BASE_URL ?? "http://127.0.0.1:3450";
const sqlc = postgres(process.env.SYNTH_DB_URL ?? "postgres://carsystem_qa@127.0.0.1:55436/carsystem_revizija_ui_qa", { max: 1, onnotice: () => {} });
const desk = { viewport: { width: 1440, height: 1000 } };
const phone = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
const totp = (b32) => new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(b32), digits: 6, period: 30, algorithm: "SHA1" }).generate();
const results = [];
const log = (k, v) => console.log(`${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`);
const check = (name, ok, detail = "") => { results.push({ name, ok }); console.log(`${ok ? "PROLAZ" : "PAD   "} ${name}${detail ? " :: " + detail : ""}`); };
const txt = async (loc) => (await loc.innerText()).replace(/\s+/g, " ").trim();
const last = {};
// SYNTH_WAIT=load: kada pozadinsko unapred učitavanje ostane otvoreno (npr. /vodici posle promene dana), „networkidle“ se ne dostiže.
const WAIT = process.env.SYNTH_WAIT === "load" ? "load" : "networkidle";
const go = async (p, path) => {
  const r = await p.goto(`${B}${path}`, { waitUntil: WAIT, timeout: 120000 });
  if (WAIT === "load") await p.waitForTimeout(1500);
  return r;
};
async function staff(page, who) {
  while (last[who] === Math.floor(Date.now() / 30000)) await new Promise((r) => setTimeout(r, 1000));
  last[who] = Math.floor(Date.now() / 30000);
  const c = creds[who];
  await go(page, "/prijava");
  await page.fill("input[name=email]", c.email);
  await page.fill("input[name=password]", c.password);
  for (let attempt = 1; attempt <= 2; attempt++) {
    // Kod tek posle početka novog prozora: kod sa granice može isteći dok putuje.
    while (Date.now() % 30000 > 25000) await new Promise((r) => setTimeout(r, 500));
    await page.fill("input[name=password]", c.password);
    await page.fill("input[name=secondFactor]", totp(c.totpBase32));
    await page.keyboard.press("Enter");
    try {
      await page.waitForURL((u) => !u.pathname.startsWith("/prijava"), { timeout: 20000 });
      if (attempt > 1) log(`prijava ${who}`, "uspela iz drugog pokušaja (TOTP prozor)");
      return;
    } catch {
      if (attempt === 2) throw new Error(`prijava ${who} nije uspela ni iz drugog pokušaja`);
      while (last[who] === Math.floor(Date.now() / 30000)) await new Promise((r) => setTimeout(r, 1000));
    }
  }
}
async function customer(page) {
  const c = creds.kupac;
  await go(page, "/prijava/kupac");
  await page.fill("input[name=email]", c.email);
  await page.fill("input[name=password]", c.password);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/prijava"), { timeout: 60000 }), page.keyboard.press("Enter")]);
}
async function add(page, q, qty) {
  await go(page, `/kupac/naruci?q=${encodeURIComponent(q)}`);
  const r = page.locator("table.pn-table tbody tr").first();
  await r.locator("input").fill(qty);
  await r.getByRole("button", { name: "Dodajte u korpu" }).click();
  const st = r.locator("[role=status]");
  await page.waitForFunction((el) => el && el.textContent.trim().length > 0, await st.elementHandle(), { timeout: 30000 });
  return txt(st);
}
async function korpa(k, pick) {
  await go(k, "/kupac/korpa");
  await k.locator("a.pn-option", { hasText: pick }).click();
  await k.waitForFunction(() => location.search.includes("opcija="), null, { timeout: 30000 });
  await k.waitForLoadState(WAIT);
}
async function fillAndSend(k) {
  await k.locator("#korpa-napomena").fill("Sintetička proba — isporuka do petka.");
  await k.locator("#korpa-adresa").fill("SINT magacin 1");
  await k.locator("#korpa-telefon").fill("060 000 0000");
  await k.getByRole("button", { name: "Pošaljite zahtev za porudžbinu" }).click();
}
async function confirmDialog(page, openLabel, reasonText) {
  await page.getByRole("button", { name: openLabel }).click();
  const dlg = page.locator("dialog[open], [role=dialog]").last();
  if (reasonText) await dlg.locator("textarea, input[type=text]").first().fill(reasonText);
  await dlg.getByRole("button", { name: openLabel.replace("…", "") }).click();
  await page.waitForLoadState(WAIT); await page.waitForTimeout(1500);
}
const A = creds.ids.A;
const b = await chromium.launch({ channel: "chrome" }).catch(() => chromium.launch());
try {
  if (STEP === "sve" || STEP === "kupac") {
    const k = await (await b.newContext(desk)).newPage();
    const errors = []; k.on("response", (r) => { if (r.status() >= 500) errors.push(`${r.status()} ${new URL(r.url()).pathname}`); });
    await customer(k);
    check("kupac: prijava vodi na /kupac", new URL(k.url()).pathname.startsWith("/kupac"), new URL(k.url()).pathname);
    await go(k, "/kupac/fakture");
    const fakt = await k.locator("a[href^='/kupac/fakture/']").count();
    check("kupac: spisak faktura (2 sintetičke)", fakt >= 2, `${fakt} veza`);
    await k.screenshot({ path: `${OUT}/k1-fakture.png`, fullPage: true });
    const href = await k.locator("a[href^='/kupac/fakture/']").first().getAttribute("href");
    await go(k, href);
    check("kupac: detalj fakture", (await txt(k.locator("main"))).includes("SINT-RN-"), href.replace(/[0-9a-f-]{36}/, "<id>"));
    const tudja = await k.goto(`${B}/kupac/fakture/00000000-0000-4000-8000-000000000000`);
    check("kupac: nepostojeća/tuđa faktura = 404", tudja.status() === 404, String(tudja.status()));
    const los = await k.goto(`${B}/kupac/fakture?od=2026-02-31`);
    check("kupac: nemoguć datum u filteru ne daje 500 (B7)", los.status() < 500, String(los.status()));
    await go(k, "/kupac/fakture?q=SINT-RN-0002");
    check("kupac: pretraga faktura po broju", (await k.locator("a[href^='/kupac/fakture/']").count()) === 1);
    // Izbor artikala
    await go(k, "/kupac/naruci?q=SINT");
    const rows = await k.locator("table.pn-table tbody tr").count();
    const vanVidljiv = (await txt(k.locator("main"))).includes("SINT-X01");
    check("kupac: pretraga artikala vraća sintetičke artikle", rows >= 4, `${rows} redova; van programa vidljiv=${vanVidljiv}`);
    await k.screenshot({ path: `${OUT}/k2-izbor.png`, fullPage: true });
    log("dodaj B01", await add(k, "SINT-B01", "4"));
    log("dodaj K01", await add(k, "SINT-K01", "2"));
    log("dodaj N01 (na upit)", await add(k, "SINT-N01", "1"));
    const kom = await add(k, "SINT-K01", "1,5");
    check("kupac: KOM ne prima decimalnu količinu", /ceo|cel|kom/i.test(kom) || !/dodat/i.test(kom), kom);
    // Korpa
    await korpa(k, "Avansno plaćanje");
    const zbirAv = await txt(k.locator("main"));
    check("kupac: zbir avans = 3.560,00 (4×650 + 2×480)", zbirAv.includes("3.560,00"), (zbirAv.match(/Osnovica[^A-Z]{0,40}/) ?? [""])[0]);
    await k.screenshot({ path: `${OUT}/k3-korpa-avans.png`, fullPage: true });
    await korpa(k, "Odloženo");
    const zbirOd = await txt(k.locator("main"));
    check("kupac: zbir odloženo = 3.760,00 (4×700 + 2×480)", zbirOd.includes("3.760,00"), (zbirOd.match(/Osnovica[^A-Z]{0,40}/) ?? [""])[0]);
    await k.reload({ waitUntil: WAIT });
    check("kupac: osvežavanje korpe čuva stavke i opciju", (await k.locator("table.pn-table tbody tr").count()) === 3 && (await txt(k.locator("main"))).includes("3.760,00"));
    // Promena rabata posle prikaza → nova potvrda
    await korpa(k, "Avansno plaćanje");
    await sqlc`UPDATE price_rules SET discount_percent = 36 WHERE customer_id = ${A} AND brand = 'SINTLAK' AND payment_condition = 'avans'`;
    await fillAndSend(k);
    const poruka = k.locator("[role=alert]", { hasText: /promenil|više nije odobrena/ }).first();
    await poruka.waitFor({ timeout: 30000 });
    await k.waitForTimeout(1500);
    const promena = await txt(poruka);
    const nema = (await sqlc`SELECT count(*)::int n FROM customer_orders WHERE customer_id = ${A}`)[0].n;
    check("kupac: promena cene pre slanja traži novu potvrdu, zahtev nije napravljen", nema === 0, promena.slice(0, 140));
    await sqlc`UPDATE price_rules SET discount_percent = 35 WHERE customer_id = ${A} AND brand = 'SINTLAK' AND payment_condition = 'avans'`;
    await korpa(k, "Avansno plaćanje");
    await fillAndSend(k);
    await k.waitForFunction(() => location.pathname.startsWith("/kupac/porudzbine/"), null, { timeout: 60000 });
    await k.waitForLoadState(WAIT);
    const posl = await txt(k.locator("main"));
    check("kupac: zahtev poslat, vidi se detalj", /Z-\d{4}-\d+/.test(posl), posl.match(/Z-\d{4}-\d+/)?.[0] ?? "");
    await k.screenshot({ path: `${OUT}/k4-poslato.png`, fullPage: true });
    check("kupac: korpa prazna posle slanja", (await sqlc`SELECT count(*)::int n FROM customer_cart_items WHERE customer_id = ${A}`)[0].n === 0);
    check("kupac: bez 5xx odgovora (osim namernog loseg datuma)", errors.filter((e) => !e.includes("/kupac/fakture")).length === 0, errors.join(", "));
  }
  if (STEP === "sve" || STEP === "kancelarija") {
    const nBefore = (await sqlc`SELECT count(*)::int n FROM notifications`)[0].n;
    const t = await (await b.newContext(desk)).newPage(); await staff(t, "kancelarija");
    await go(t, "/portal/zahtevi");
    await t.screenshot({ path: `${OUT}/t1-zahtevi.png`, fullPage: true });
    const href = await t.locator('a[href^="/portal/zahtevi/"]').filter({ hasText: /Z-/ }).first().getAttribute("href");
    check("kancelarija: zahtev se vidi na spisku", !!href);
    check("kancelarija: obaveštenje o novom zahtevu postoji (B3)", nBefore > 0, `${nBefore} obaveštenja u bazi`);
    await go(t, "/portal/obavestenja");
    const obav = await txt(t.locator("main"));
    check("kancelarija: obaveštenje se vidi na strani Obaveštenja, sa vezom na zahtev", /Zahtev kupca/.test(obav) && !/customer_order_submitted/.test(obav) && /Nov zahtev za porudžbinu Z-\d{4}-\d+/.test(obav) && (await t.locator('a[href^="/portal/zahtevi/"]').count()) > 0);
    await t.screenshot({ path: `${OUT}/t0-obavestenje.png`, fullPage: true });
    await go(t, "/portal/zahtevi");
    const brojaci = await txt(t.locator('[aria-label="Stanje"]'));
    check("kancelarija: brojači stanja (Otvoreni 1, Novi 1, Svi 1)", /Otvoreni 1\b/.test(brojaci) && /Novi 1\b/.test(brojaci) && /Svi 1\b/.test(brojaci), brojaci);
    await go(t, href);
    if (await t.getByRole("button", { name: "Preuzmite u obradu" }).count()) {
      await t.getByRole("button", { name: "Preuzmite u obradu" }).click();
      await t.waitForLoadState(WAIT); await t.waitForTimeout(1500);
    }
    const potvrdaBlok = (await txt(t.locator("main"))).includes("Potvrda nije moguća dok ima stavki bez cene");
    check("kancelarija: potvrda blokirana dok postoji stavka na upit", potvrdaBlok);
    await t.screenshot({ path: `${OUT}/t2-detalj.png`, fullPage: true });
    // Izmenjen predlog: ukloni stavku na upit
    await t.locator("details#izmena > summary").click();
    const form = t.locator("details#izmena");
    await form.getByRole("button", { name: /Uklonite SINT-N01/ }).click();
    await form.locator("textarea").fill("Artikal bez dogovorene cene — uklonjen iz predloga");
    await form.getByRole("button", { name: "Proverite cene" }).click();
    await form.getByRole("button", { name: /Pošaljite izmenjen predlog/ }).and(form.locator("button:not([disabled])")).waitFor({ timeout: 30000 });
    const zbirPredloga = await txt(form.locator("text=Zbir predloga").locator("xpath=.."));
    check("kancelarija: provera cena predloga daje zbir 3.560,00", zbirPredloga.includes("3.560,00"), zbirPredloga.slice(0, 120));
    await form.getByRole("button", { name: /Pošaljite izmenjen predlog/ }).click();
    await t.waitForTimeout(2500); await t.waitForLoadState(WAIT);
    const nastao = (await sqlc`SELECT count(*)::int n FROM customer_orders WHERE status = 'awaiting_customer'`)[0].n;
    check("kancelarija: izmenjen predlog poslat kupcu", nastao === 1, `${nastao} predlog čeka kupca`);
    await t.screenshot({ path: `${OUT}/t2b-predlog.png`, fullPage: true });
    // Kupac prihvata
    const k = await (await b.newContext(desk)).newPage(); await customer(k);
    await go(k, "/kupac/porudzbine");
    const h2 = await k.locator("a", { hasText: /\/2/ }).first().getAttribute("href");
    await go(k, h2);
    await k.getByRole("button", { name: "Potvrdite predlog" }).click();
    await k.waitForLoadState(WAIT); await k.waitForTimeout(1500);
    await k.screenshot({ path: `${OUT}/k5-prihvaceno.png`, fullPage: true });
    // Kancelarija: preuzmi, potvrdi, broj iz BizniSofta
    await go(t, "/portal/zahtevi");
    const h3 = await t.locator('a[href^="/portal/zahtevi/"]').filter({ hasText: /\/2/ }).first().getAttribute("href");
    await go(t, h3);
    if (await t.getByRole("button", { name: "Preuzmite u obradu" }).count()) {
      await t.getByRole("button", { name: "Preuzmite u obradu" }).click(); await t.waitForLoadState(WAIT); await t.waitForTimeout(1500);
    }
    await confirmDialog(t, "Potvrdite porudžbinu…");
    const posle = await txt(t.locator("main"));
    check("kancelarija: porudžbina potvrđena, dodeljen broj P-", /P-\d{4}-\d+/.test(posle), posle.match(/P-\d{4}-\d+/)?.[0] ?? posle.slice(0, 120));
    const bs = t.locator('input[id^="bs-"]');
    if (await bs.count()) {
      await bs.fill("SINT-PRED-0001");
      await bs.locator("xpath=ancestor::form").getByRole("button").last().click();
      await t.waitForLoadState(WAIT); await t.waitForTimeout(1500);
      check("kancelarija: upisan broj dokumenta iz BizniSofta", (await txt(t.locator("main"))).includes("SINT-PRED-0001"));
    } else check("kancelarija: polje za broj iz BizniSofta postoji", false);
    await t.screenshot({ path: `${OUT}/t3-potvrdjeno.png`, fullPage: true });
    await go(t, `${h3}/stampa`);
    await t.emulateMedia({ media: "print" });
    await t.pdf({ path: `${OUT}/t4-stampa.pdf`, format: "A4", printBackground: true, preferCSSPageSize: true });
    check("kancelarija: A4 štampa zahteva", (await txt(t.locator("body"))).includes("SINT"));
    await go(k, h2.replace(/\/[^/]+$/, "") ); await go(k, "/kupac/porudzbine");
    check("kupac: vidi potvrđenu porudžbinu", /potvrđ/i.test(await txt(k.locator("main"))));
  }
  if (STEP === "sve" || STEP === "opseg") {
    const p = await (await b.newContext(desk)).newPage(); await staff(p, "petar");
    await go(p, "/portal/zahtevi");
    check("komercijalista Petar (dodeljen A) vidi zahtev firme A", /Svi 1\b/.test(await txt(p.locator("main"))), "brojač Svi");
    const j = await (await b.newContext(desk)).newPage(); await staff(j, "jovan");
    await go(j, "/portal/zahtevi");
    check("komercijalista Jovan (dodeljen B) ne vidi zahtev firme A", /Svi 0\b/.test(await txt(j.locator("main"))), "brojač Svi");
    const kartica = await j.goto(`${B}/portal/kupci/${A}`);
    check("Jovan: kartica tuđeg kupca = 403", kartica.status() === 403, String(kartica.status()));
    // B1: nalozi — Jovan vidi samo nalog firme B; podmetnut ID naloga firme A se odbija
    await go(j, "/portal/kupci/nalozi");
    const strana = await txt(j.locator("main"));
    check("B1: Jovan na spisku naloga ne vidi nalog firme A", !strana.includes("sint-kupac-a@") && strana.includes("sint-kupac-b@"));
    await j.screenshot({ path: `${OUT}/b1-jovan-nalozi.png`, fullPage: true });
    const forme = j.locator('form:has(input[name="accountId"])');
    log("B1 forme sa accountId", await forme.count());
    const pre = (await sqlc`SELECT status::text s FROM customer_users WHERE id = ${creds.ids.kupacA}`)[0].s;
    const forma = forme.first();
    const odgovori = [];
    j.on("response", (r) => { if (r.request().method() === "POST") odgovori.push(r.status()); });
    await forma.evaluate((f, id) => {
      f.querySelector('input[name="accountId"]').value = id;
      f.querySelector('input[name="reason"]').value = "podmetnut nalog druge firme";
      f.requestSubmit();
    }, creds.ids.kupacA);
    await j.waitForTimeout(3000);
    const posle = (await sqlc`SELECT status::text s FROM customer_users WHERE id = ${creds.ids.kupacA}`)[0].s;
    const trag = (await sqlc`SELECT count(*)::int n FROM audit_log WHERE entity_id = ${creds.ids.kupacA} AND actor_user_id = ${creds.ids.jovan}`)[0].n;
    check("B1: podmetnut ID naloga firme A se odbija, nalog netaknut", pre === posle && trag === 0 && odgovori.includes(403), `status ${pre}→${posle}; POST ${odgovori.join(",")}; audit ${trag}`);
    await j.screenshot({ path: `${OUT}/b1-jovan-podmetnuto.png`, fullPage: true });
    const g = await (await b.newContext(desk)).newPage(); await staff(g, "vlasnik");
    await go(g, "/portal/kupci/nalozi");
    const sv = await txt(g.locator("main"));
    check("B1: vlasnik i dalje vidi naloge obe firme", sv.includes("sint-kupac-a@") && sv.includes("sint-kupac-b@"));
  }
  if (STEP === "sve" || STEP === "telefon") {
    const k = await (await b.newContext(phone)).newPage(); await customer(k);
    for (const path of ["/kupac", "/kupac/fakture", "/kupac/naruci?q=SINT", "/kupac/porudzbine"]) {
      await go(k, path);
      check(`telefon ${path}: bez horizontalnog skrola`, !(await k.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)));
    }
    await k.screenshot({ path: `${OUT}/m1-telefon-porudzbine.png`, fullPage: true });
    // Odjava kupca
    await go(k, "/kupac");
    await k.getByRole("button", { name: "Odjavite se", exact: true }).click();
    await k.waitForURL((u) => !u.pathname.startsWith("/kupac"), { timeout: 30000 }).catch(() => {});
    log("posle klika na Odjavite se", new URL(k.url()).pathname);
    await go(k, "/kupac");
    check("kupac: posle odjave /kupac vodi na prijavu", new URL(k.url()).pathname.startsWith("/prijava"), new URL(k.url()).pathname);
  }
  if (STEP === "sve" || STEP === "sesija") {
    // B8: kolačić kopiran PRE odjave ne sme da otvori portal POSLE odjave.
    for (const [who, prijava, cilj, dugme] of [["kancelarija", null, "/portal", "Odjavite se"], ["kupac", "kupac", "/kupac", "Odjavite se"]]) {
      const ctx = await b.newContext(desk);
      const pg = await ctx.newPage();
      if (prijava === "kupac") await customer(pg); else await staff(pg, who);
      await go(pg, cilj);
      const kopija = await ctx.cookies();
      const drugi = await b.newContext(desk);
      await drugi.addCookies(kopija);
      const d = await drugi.newPage();
      await go(d, cilj);
      check(`B8 ${who}: kopiran kolačić radi pre odjave`, new URL(d.url()).pathname.startsWith(cilj), new URL(d.url()).pathname);
      const btn = pg.getByRole("button", { name: dugme, exact: true }).or(pg.getByRole("button", { name: /Odjav/ })).first();
      await btn.click();
      await pg.waitForURL((u) => !u.pathname.startsWith(cilj), { timeout: 30000 }).catch(() => {});
      log(`${who} posle klika na odjavu`, new URL(pg.url()).pathname);
      const d2 = await (await (async () => { const c = await b.newContext(desk); await c.addCookies(kopija); return c; })()).newPage();
      await go(d2, cilj);
      check(`B8 ${who}: isti kolačić posle odjave vodi na prijavu`, new URL(d2.url()).pathname.startsWith("/prijava"), new URL(d2.url()).pathname);
      await go(d, cilj);
      check(`B8 ${who}: i već otvoren drugi prozor sa tom sesijom gubi pristup`, new URL(d.url()).pathname.startsWith("/prijava"), new URL(d.url()).pathname);
    }
    const n = (await sqlc`SELECT count(*)::int n FROM auth_revoked_sessions`)[0].n;
    check("B8: opozvane sesije upisane (bar 2)", n >= 2, String(n));
  }
  if (STEP === "sve" || STEP === "uvoz") {
    // B2: ručni uvoz sintetičkog BizniSoft PDF-a (fixtures/dev) zatvara zapis istorije.
    const t = await (await b.newContext(desk)).newPage(); await staff(t, "kancelarija");
    await go(t, "/portal/importi");
    const prazno = await txt(t.locator("main"));
    check("B2: odeljak prijema sa konektora postoji (prazno stanje)", /Prijem sa konektora/.test(prazno) && /nisu poslali nijedan dokument/.test(prazno));
    await t.locator('input[name="izdavalac"]').fill("SINTQ");
    await t.locator('input[name="fajlovi"]').setInputFiles([`${ROOT}fixtures/dev/biznisoft/vise-stavki.pdf`, `${ROOT}fixtures/dev/biznisoft/neispravan-bez-zaglavlja.pdf`]);
    await t.locator("form").filter({ has: t.locator('input[name="fajlovi"]') }).locator('button[type="submit"]').click();
    await t.getByText(/Obrađeno dokumenata: 2 od 2/).waitFor({ timeout: 60000 });
    await go(t, "/portal/importi");
    const runs = await sqlc`SELECT file_name, status::text AS status, rows_read, finished_at IS NOT NULL AS fin FROM import_runs ORDER BY id`;
    log("import_runs", runs.map((r) => `${r.file_name}:${r.status}:${r.rows_read}:${r.fin}`).join(" | "));
    check("B2: nijedan zapis ručnog uvoza nije ostao „u toku“", runs.length === 2 && runs.every((r) => r.status !== "u_toku" && r.fin));
    const istorija = await txt(t.locator("main"));
    check("B2: istorija prikazuje ishod (bez „u toku“)", !/\bu toku\b/.test(istorija.slice(istorija.indexOf("Istorija uvoza"), istorija.indexOf("Prijem sa konektora"))), "");
    await t.screenshot({ path: `${OUT}/u1-istorija-uvoza.png`, fullPage: true });
  }
  if (STEP === "sve" || STEP === "faktura") {
    // B6: pregled podataka iz fakture za štampu, jasno označen da nije original.
    const k = await (await b.newContext(desk)).newPage(); await customer(k);
    await go(k, "/kupac/fakture");
    const href = await k.locator("a[href^='/kupac/fakture/']").first().getAttribute("href");
    await go(k, href);
    await k.getByRole("link", { name: "Pregled za štampu" }).click();
    await k.waitForURL((u) => u.pathname.endsWith("/stampa"), { timeout: 30000 });
    await k.waitForLoadState(WAIT);
    const doc = await txt(k.locator("article.zp-doc"));
    check("B6: pregled nosi oznaku „nije original“ i stavke sa iznosima", /NIJE ORIGINAL DOKUMENTA/.test(doc) && /SINT-RN-000\d/.test(doc) && /Ukupno/.test(doc), doc.slice(0, 120));
    await k.emulateMedia({ media: "print" });
    const skriveno = await k.evaluate(() => ["nav", ".pn-account", ".zp-screen-only", ".acct-bar"].map((sel) => { const el = document.querySelector(sel); return el ? getComputedStyle(el).display : "none"; }));
    check("B6: u štampi nema navigacije, zaglavlja naloga ni dugmadi", skriveno.every((d) => d === "none"), skriveno.join(","));
    await k.pdf({ path: `${OUT}/f1-faktura-pregled.pdf`, format: "A4", printBackground: true, preferCSSPageSize: true });
    await k.emulateMedia({ media: "screen" });
    await k.screenshot({ path: `${OUT}/f1-faktura-pregled.png`, fullPage: true });
    const tudja = await k.goto(`${B}/kupac/fakture/00000000-0000-4000-8000-000000000000/stampa`);
    check("B6: tuđa/nepostojeća faktura = 404", tudja.status() === 404, String(tudja.status()));
    const los = await k.goto(`${B}/kupac/fakture/nije-uuid/stampa`);
    check("B6: neispravan ID = 404", los.status() === 404, String(los.status()));
  }
  if (STEP === "sve" || STEP === "kartica") {
    // B4: kancelarija vidi istoriju kupca (bez predloga za razgovor); komercijalista i predloge.
    const t = await (await b.newContext(desk)).newPage(); await staff(t, "kancelarija");
    await go(t, `/portal/kupci/${A}`);
    const kk = await txt(t.locator("main"));
    check("B4 kancelarija: kartica ima istoriju (artikli, poslednja kupovina)", /Artikli \(\d+\)/.test(kk) && /poslednja kupovina/i.test(kk), (kk.match(/Artikli \(\d+\)/) ?? [""])[0]);
    check("B4 kancelarija: bez predloga za razgovor i proširenje", !/predlog za sledeći razgovor/i.test(kk) && !/predlozi za proširenje/i.test(kk));
    check("B4 kancelarija: veze na prodaju i zahteve kupca", (await t.locator(`a[href="/portal/prodaja?kupac=${A}"]`).count()) === 1 && (await t.locator('a[href^="/portal/zahtevi?stanje=svi&q="]').count()) === 1);
    await t.screenshot({ path: `${OUT}/c1-kartica-kancelarija.png`, fullPage: true });
    await t.locator(`a[href="/portal/prodaja?kupac=${A}"]`).click();
    await t.waitForURL((u) => u.pathname === "/portal/prodaja", { timeout: 30000 });
    await t.waitForLoadState(WAIT);
    check("B4 veza na prodaju vodi na filtrirane fakture kupca", /SINT-RN-000/.test(await txt(t.locator("main"))));
    const p = await (await b.newContext(desk)).newPage(); await staff(p, "petar");
    await go(p, `/portal/kupci/${A}`);
    check("B4 komercijalista: i dalje vidi predlog za razgovor", /predlog za sledeći razgovor/i.test(await txt(p.locator("main"))));
  }
  if (STEP === "sve" || STEP === "lista") {
    // B5: lista kupaca — pretraga i filter po komercijalisti (po dodeli), GET preživljava osvežavanje.
    const g = await (await b.newContext(desk)).newPage(); await staff(g, "vlasnik");
    await go(g, "/portal/kupci");
    const rows = async () => (await g.locator("table.portal-table tbody th[scope=row] a").allInnerTexts()).map((x) => x.trim());
    check("B5: bez filtera sve 4 firme", (await rows()).length === 4, (await rows()).join(" | "));
    await g.locator('select[name="komercijalista"]').selectOption({ label: "SINT Petar Komercijalista" });
    await g.locator("form.portal-inline-form button[type=submit]").click();
    await g.waitForURL((u) => u.searchParams.has("komercijalista"), { timeout: 30000 });
    await g.waitForLoadState(WAIT);
    check("B5: filter Petar → samo njegove firme (A i D)", JSON.stringify(await rows()) === JSON.stringify(["SINT Auto Lak d.o.o.", "SINT Lakirnica D"]), (await rows()).join(" | "));
    await g.reload({ waitUntil: WAIT });
    check("B5: filter preživljava osvežavanje", (await rows()).length === 2 && (await g.locator('select[name="komercijalista"]').inputValue()) === creds.ids.petar);
    await go(g, "/portal/kupci?komercijalista=bez");
    check("B5: „Bez komercijaliste“ → firma C", JSON.stringify(await rows()) === JSON.stringify(["SINT Farbara C"]), (await rows()).join(" | "));
    await go(g, "/portal/kupci?q=karoserija");
    check("B5: pretraga po nazivu (mala slova)", JSON.stringify(await rows()) === JSON.stringify(["SINT Karoserija B"]));
    await go(g, "/portal/kupci?q=SINT-0003");
    check("B5: pretraga po PIB-u", JSON.stringify(await rows()) === JSON.stringify(["SINT Farbara C"]));
    const los = await g.goto(`${B}/portal/kupci?komercijalista=nije-uuid&q=${"x".repeat(200)}`);
    check("B5: neispravan filter ne obara stranu", los.status() === 200, String(los.status()));
    await g.screenshot({ path: `${OUT}/l1-lista-kupaca.png`, fullPage: true });
    const p = await (await b.newContext(desk)).newPage(); await staff(p, "petar");
    await go(p, "/portal/kupci?komercijalista=bez");
    check("B5: komercijalista nema filter po komercijalisti i vidi samo svoje", (await p.locator('select[name="komercijalista"]').count()) === 0 && (await p.locator("table.portal-table tbody th[scope=row] a").count()) === 2);
  }
  if (STEP === "sve" || STEP === "predaja") {
    // B10: poziv izdat iz portala pojavljuje se „za ručnu predaju“ i zatvara se označavanjem.
    const g = await (await b.newContext(desk)).newPage(); await staff(g, "vlasnik");
    // Sintetički nalog firme B je „zatražen“; za poziv mora biti potvrđen — ovde se poziv pravi kroz isti servis kao proba.
    const accB = (await sqlc`SELECT id FROM customer_users WHERE email = 'sint-kupac-b@revizija.test'`)[0].id;
    await sqlc`INSERT INTO customer_message_outbox (customer_user_id, kind) VALUES (${accB}, 'invitation')`;
    await go(g, "/portal/kupci/nalozi");
    const panel = g.locator("section", { has: g.locator("#outbox-naslov") });
    const t0 = await txt(panel);
    check("B10: poruka čeka ručnu predaju (firma, kontakt, vrsta)", /Za ručnu predaju \(1\)/.test(t0) && /SINT Karoserija B/.test(t0) && /Poziv za nalog/.test(t0), t0.slice(0, 160));
    await panel.getByRole("button", { name: "Označite predatim" }).click();
    await g.waitForFunction(() => /Za ručnu predaju \(0\)/.test(document.querySelector("#outbox-naslov")?.textContent ?? ""), null, { timeout: 30000 });
    const st = (await sqlc`SELECT status::text AS s, handed_over_by IS NOT NULL AS ko FROM customer_message_outbox WHERE customer_user_id = ${accB}`)[0];
    check("B10: označeno predatim (status i ko)", st.s === "handed_over" && st.ko, JSON.stringify(st));
    await g.reload({ waitUntil: WAIT });
    check("B10: posle osvežavanja spisak je prazan", /Za ručnu predaju \(0\)/.test(await txt(g.locator("section", { has: g.locator("#outbox-naslov") }))));
    const j = await (await b.newContext(desk)).newPage(); await staff(j, "jovan");
    await sqlc`INSERT INTO customer_message_outbox (customer_user_id, kind) VALUES (${creds.ids.kupacA}, 'invitation')`;
    await go(j, "/portal/kupci/nalozi");
    check("B10: Jovan (dodeljen B) ne vidi poruku firme A", !/SINT Auto Lak/.test(await txt(j.locator("section", { has: j.locator("#outbox-naslov") }))));
  }
  if (STEP === "sve" || STEP === "proba") {
    // B11: vlasnik pravi probni nalog, kupac ga aktivira — nad pool-om od jedne veze.
    const g = await (await b.newContext(desk)).newPage(); await staff(g, "vlasnik");
    await go(g, "/portal/zahtevi");
    const panel = g.locator("details", { has: g.locator("#proba-email") });
    await g.locator("summary", { hasText: "Kontrolisana proba" }).click();
    await g.locator("#proba-email").fill("sint-proba-2@revizija.test");
    await g.locator("#proba-email").locator("xpath=ancestor::div[contains(@class,'pn-filters')]").locator("button").click();
    const link = panel.locator('a[href^="/prijava/kupac/aktivacija"]');
    await link.waitFor({ timeout: 30000 });
    const href = await link.getAttribute("href");
    check("B11: vlasnik dobija jednokratni link probnog naloga", Boolean(href));
    const k = await (await b.newContext(desk)).newPage();
    await go(k, href);
    const lozinka = `sint-proba-lozinka-${Date.now()}`;
    await k.fill('input[name="password"]', lozinka);
    await k.fill('input[name="confirm"]', lozinka);
    await k.locator('button[type="submit"]').click();
    await k.waitForLoadState(WAIT); await k.waitForTimeout(2000);
    const st = (await sqlc`SELECT status::text AS s FROM customer_users WHERE email = 'sint-proba-2@revizija.test'`)[0]?.s;
    check("B11: aktivacija završena (nalog aktivan) bez zaglavljivanja", st === "active", `${st} · ${new URL(k.url()).pathname}`);
  }
  if (STEP === "sve" || STEP === "upit") {
    // B3 (upit): kupac sa kodom sajta (katalog je iza održavanja, kao na Production-u) traži cenu
    // sa strane proizvoda; kancelarija dobija obaveštenje, preuzima i odgovara; kupac vidi odgovor.
    const envText = readFileSync(process.env.SYNTH_ENV_FILE ?? process.env.HOME + "/.carsystem-secrets/revizija-sinteticki.env", "utf8");
    const code = envText.match(/^SITE_ACCESS_PASSWORD=(.*)$/m)[1];
    const kctx = await b.newContext(desk);
    const k = await kctx.newPage();
    await customer(k);
    const otkljucano = await kctx.request.post(`${B}/site-u-pripremi/access`, { form: { accessCode: code }, maxRedirects: 0 });
    check("upit: kod sajta otključava katalog (kao pilot kupac)", otkljucano.status() === 303 && !/access=/.test(otkljucano.headers().location ?? ""), String(otkljucano.status()));
    const slug = process.env.SYNTH_PRODUCT_SLUG ?? "c-2e50-clear-coat";
    const res = await k.goto(`${B}/proizvodi/${slug}`, { waitUntil: "load", timeout: 120000 });
    check("upit: strana proizvoda se otvara", res.status() === 200 && new URL(k.url()).pathname.startsWith("/proizvodi/"), `${res.status()} ${new URL(k.url()).pathname}`);
    const panel = k.locator('section[aria-labelledby="buy-panel-title"]');
    await panel.waitFor({ timeout: 60000 });
    const pt = await txt(panel);
    // Od 0049: nepovezan proizvod nudi „Upit za nabavku“; povezan bez cene „Zatražite cenu/uslove“.
    const upitDugme = /Pošaljite upit za nabavku/i.test(pt) ? "Pošaljite upit za nabavku" : "Zatražite cenu/uslove";
    check("upit: panel „Za Vašu firmu“ bez cene, sa formom upita", /SINT Auto Lak/i.test(pt) && /Zatražite cenu\/uslove|Upit za nabavku/i.test(pt) && !/RSD \//.test(pt), pt.slice(0, 140));
    await panel.locator('input[type="number"]').fill("12");
    await panel.locator('input[type="text"]').fill("Sintetička provera — mesečna potrošnja");
    await panel.getByRole("button", { name: upitDugme }).click();
    await panel.locator('[role="status"]').waitFor({ timeout: 30000 });
    const potvrda = await txt(panel.locator('[role="status"]'));
    const broj = potvrda.match(/U-\d{4}-\d{5}/)?.[0] ?? "";
    check("upit: kupac dobija broj upita", Boolean(broj), potvrda.slice(0, 80));
    await k.screenshot({ path: `${OUT}/p1-upit-poslat.png`, fullPage: false });
    const [{ n }] = await sqlc`SELECT count(*)::int AS n FROM notifications WHERE kind = 'customer_price_request_submitted'`;
    check("upit: upisano jedno obaveštenje kancelariji", n === 1, String(n));
    const t = await (await b.newContext(desk)).newPage(); await staff(t, "kancelarija");
    await go(t, "/portal/obavestenja");
    const ob = await txt(t.locator("main"));
    check("upit: kancelarija vidi „Upit za cenu“ sa brojem i vezom", /Upit za (cenu|nabavku)/.test(ob) && ob.includes(broj) && (await t.locator('a[href="/portal/zahtevi/uslovi"]').count()) > 0);
    await t.screenshot({ path: `${OUT}/p2-obavestenje-upit.png`, fullPage: true });
    await go(t, "/portal/zahtevi/uslovi");
    const red = t.locator("tr, li, article").filter({ hasText: broj }).first();
    if (await red.getByRole("button", { name: /Preuzmite/ }).count()) {
      await red.getByRole("button", { name: /Preuzmite/ }).click();
      await t.waitForLoadState(WAIT); await t.waitForTimeout(1500);
    }
    const red2 = t.locator("tr, li, article").filter({ hasText: broj }).first();
    await red2.locator("textarea").fill("Sintetički odgovor: cena 1.234,00 bez PDV-a; javite se za količinu.");
    await red2.getByRole("button", { name: /Pošaljite|Odgovorite|Sačuvajte/ }).first().click();
    await t.waitForLoadState(WAIT); await t.waitForTimeout(1500);
    const st = (await sqlc`SELECT status::text AS s, answer IS NOT NULL AS a FROM customer_price_requests WHERE request_number = ${broj}`)[0];
    check("upit: kancelarija je odgovorila (status i odgovor u bazi)", Boolean(st?.a), JSON.stringify(st));
    await go(k, "/kupac/upiti");
    check("upit: kupac vidi odgovor u „Upiti“", /Sintetički odgovor/.test(await txt(k.locator("main"))));
    const p = await (await b.newContext(desk)).newPage(); await staff(p, "petar");
    await go(p, "/portal/obavestenja");
    check("upit: komercijalista ne dobija obaveštenje (vidljivost po sposobnosti)", !(await txt(p.locator("main"))).includes(broj));
  }
  if (STEP === "sajt") {
    // Dok. 61 (K6): kupovina preko javnog sajta. Pokreće se ZASEBNO, na sveže
    // napravljenoj bazi (ostali koraci broje zahteve). Katalog je iza održavanja
    // kao na Production-u — svaki prozor prvo unosi kod sajta (kao pilot kupac).
    const envText = readFileSync(process.env.SYNTH_ENV_FILE ?? process.env.HOME + "/.carsystem-secrets/revizija-sinteticki.env", "utf8");
    const code = envText.match(/^SITE_ACCESS_PASSWORD=(.*)$/m)[1];
    const D = creds.ids.D;
    const FILLER = "/proizvodi/carsystem-2k-filler-air-plus?varijanta=152.580";
    const VOC = "/proizvodi/carsystem-2k-voc-filler-540";
    const ANTISIL = "/proizvodi/baslac-70-10-silicone-remover-for-oil-silicone-and-grease";
    const PRICES = ["1.800,00", "1.920,00", "2.160,00", "2.304,00", "750,00", "720,00", "768,00"];
    const errors = [];
    async function win(opts = desk) {
      const ctx = await b.newContext(opts);
      const r = await ctx.request.post(`${B}/site-u-pripremi/access`, { form: { accessCode: code }, maxRedirects: 0 });
      if (r.status() !== 303) throw new Error(`kod sajta: ${r.status()}`);
      const page = await ctx.newPage();
      page.on("response", (x) => { if (x.status() >= 500) errors.push(`${x.status()} ${new URL(x.url()).pathname}`); });
      return { ctx, page };
    }
    const panelOf = (p) => p.locator('section[aria-labelledby="buy-panel-title"]');
    async function panelText(p) { const pn = panelOf(p); await pn.waitFor({ timeout: 60000 }); await p.waitForTimeout(800); return txt(pn); }
    async function loginForm(p, c) {
      await p.waitForURL((u) => u.pathname === "/prijava/kupac", { timeout: 60000 });
      await p.fill("input[name=email]", c.email);
      await p.fill("input[name=password]", c.password);
      await Promise.all([p.waitForURL((u) => u.pathname !== "/prijava/kupac", { timeout: 60000 }), p.keyboard.press("Enter")]);
      await p.waitForLoadState(WAIT);
    }
    // Status u identitetu varijante (ProductIdentity: <small>Status</small><strong>…</strong>).
    const statusOf = async (p) => { await p.waitForTimeout(600); return txt(p.locator('xpath=//*[normalize-space(text())="Status"]/following-sibling::*[1]').first()); };
    const loginIcon = (p) => p.locator('header a[aria-label="Prijava za kupce"]').first();
    const pathOf = (p) => { const u = new URL(p.url()); return decodeURIComponent(u.pathname + u.search); };
    async function cartRows(id) { return sqlc`SELECT a.code, ci.quantity::text AS q, ci.pack_count AS n FROM customer_cart_items ci JOIN articles a ON a.id = ci.article_id WHERE ci.customer_id = ${id} ORDER BY a.code`; }

    // 1. Neprijavljen posetilac: bez panela, bez cena — ni u HTML-u ni u API-ju.
    const anon = await win();
    await go(anon.page, FILLER);
    const anonHtml = await anon.page.content();
    check("sajt: neprijavljen — nema panela „Za Vašu firmu“ ni cene", (await panelOf(anon.page).count()) === 0 && !PRICES.some((x) => anonHtml.includes(x)) && !/SINT Auto/.test(anonHtml));
    const anonApi = await anon.ctx.request.get(`${B}/api/kupac/ponude`);
    const anonBody = await anonApi.text();
    check("sajt: /api/kupac/ponude bez sesije — bez ponuda, no-store", !/"offers":\[\{/.test(anonBody) && !/SINT/.test(anonBody) && /no-store/.test(anonApi.headers()["cache-control"] ?? ""), `${anonApi.status()} ${anonBody.slice(0, 80)} · ${anonApi.headers()["cache-control"]}`);
    check("sajt: neprijavljen — javni status „Na upit“", /Na upit/i.test(await statusOf(anon.page)), await statusOf(anon.page));
    await anon.page.screenshot({ path: `${OUT}/s1-anoniman-proizvod.png` });

    // 2. Prijava sa konkretnog proizvoda (varijanta u adresi) → povratak na istu stranu.
    const a = await win();
    await go(a.page, FILLER);
    await loginIcon(a.page).click();
    await loginForm(a.page, creds.kupac);
    check("sajt: prijava sa proizvoda vraća na isti proizvod i varijantu", pathOf(a.page) === FILLER, pathOf(a.page));
    const pA = await panelText(a.page);
    check("sajt: firma A — cena po opciji, bez i sa PDV-om (1.800,00/2.160,00 avans; 1.920,00/2.304,00 odloženo)",
      /SINT Auto Lak/i.test(pA) && ["1.800,00", "2.160,00", "1.920,00", "2.304,00"].every((x) => pA.includes(x)), pA.slice(0, 260));
    check("sajt: status prati ponudu — „Vaša cena potvrđena“ (ne „Na upit“) za varijantu sa cenom", /Vaša cena potvrđena/i.test(await statusOf(a.page)), await statusOf(a.page));
    // Izbor druge varijante na istoj strani (bez nove strane): status i panel prate izbor.
    await a.page.locator("button, a, label").filter({ hasText: "152.416" }).first().click();
    await a.page.waitForFunction(() => location.search.includes("152.416") || document.body.innerText.includes("152.416"), null, { timeout: 15000 }).catch(() => {});
    const st416 = await statusOf(a.page);
    const pn416 = await panelText(a.page);
    check("sajt: druga varijanta na istoj strani — status „Na upit“, panel bez cene", /^Na upit$/i.test(st416) && /nije u našoj ponudi za direktno poručivanje|Pošaljite upit za nabavku/i.test(pn416) && !pn416.includes("1.800,00"), `${st416} · ${pn416.slice(0, 90)}`);
    await a.page.locator("button, a, label").filter({ hasText: "152.580" }).first().click();
    await a.page.waitForTimeout(800);
    check("sajt: povratak na varijantu sa cenom — status ponovo „Vaša cena potvrđena“", /Vaša cena potvrđena/i.test(await statusOf(a.page)) && (await panelText(a.page)).includes("1.800,00"));
    check("sajt: panel kaže na šta se cena odnosi i da nije rezervacija", /SINT-C01/.test(pA) && /bez PDV/i.test(pA) && /rezerv/i.test(pA));
    await a.page.screenshot({ path: `${OUT}/s2-A-proizvod-cena.png` });
    await panelOf(a.page).locator('input[type="number"]').fill("2");
    await panelOf(a.page).getByRole("button", { name: "Dodajte u korpu" }).click();
    await panelOf(a.page).locator('[role="status"]').waitFor({ timeout: 30000 });
    check("sajt: dodato iz kataloga u serversku korpu (2 pakovanja = 2 kom)", JSON.stringify(await cartRows(A)) === JSON.stringify([{ code: "SINT-C01", q: "2.000", n: 2 }]), JSON.stringify(await cartRows(A)));
    const badge = await a.page.locator('header a[aria-label^="Korpa"]').first().getAttribute("aria-label");
    check("sajt: ikonica korpe u zaglavlju pokazuje broj stavki", /1 stavk/.test(badge ?? ""), badge ?? "");

    // 3. Dva pakovanja jedne kartice (1 L i 5 L), izbor 5 L.
    await go(a.page, ANTISIL);
    const pAs = await panelText(a.page);
    check("sajt: dva pakovanja na jednoj kartici (limenka 1 L ispred kante 5 L), cena celog pakovanja", /SINT-C03/.test(pAs) && /SINT-C04/.test(pAs) && pAs.indexOf("SINT-C03") < pAs.indexOf("SINT-C04") && pAs.includes("800,00") && pAs.includes("3.840,00"), pAs.slice(0, 200));
    await panelOf(a.page).locator('label', { hasText: "SINT-C04" }).locator('input[type="radio"]').check();
    await a.page.waitForTimeout(400);
    const p5 = await txt(panelOf(a.page));
    check("sajt: kanta 5 L — cena pakovanja 3.600,00 avans (5 × 720,00), sa PDV-om 4.320,00; cena po L ostaje vidljiva", p5.includes("3.600,00 RSD / kanta 5 L") && p5.includes("4.320,00") && p5.includes("720,00 RSD / L"), p5.slice(0, 220));
    await panelOf(a.page).locator('input[type="number"]').fill("2");
    await a.page.waitForTimeout(300);
    check("sajt: broj pakovanja i obračun — „2 × kanta 5 L = 10 L u obračunu“", /2 × kanta 5 L = 10 L u obračunu/.test(await txt(panelOf(a.page))));
    await panelOf(a.page).locator('input[type="number"]').fill("0");
    await panelOf(a.page).getByRole("button", { name: "Dodajte u korpu" }).click();
    await panelOf(a.page).locator('[role="status"]').waitFor({ timeout: 30000 });
    check("sajt: 0 pakovanja se ne prima (deo pakovanja odbija i server — integracioni test)", !/Dodato/.test(await txt(panelOf(a.page).locator('[role="status"]'))) && (await cartRows(A)).length === 1, await txt(panelOf(a.page).locator('[role="status"]')));
    await panelOf(a.page).locator('input[type="number"]').fill("2");
    await panelOf(a.page).getByRole("button", { name: "Dodajte u korpu" }).click();
    await panelOf(a.page).locator('[role="status"]').waitFor({ timeout: 30000 });
    await a.page.screenshot({ path: `${OUT}/s3-A-dva-pakovanja.png` });

    // 3b. LIT sa cenom, bez potvrđenog pakovanja: nema preračuna ni dodavanja — upit.
    await go(a.page, "/proizvodi/norbin-n15-v20-clear-voc");
    const pNp = await panelText(a.page);
    check("sajt: LIT bez potvrđenog pakovanja → „Cena na upit: pakovanje … nije potvrđeno“, bez dugmeta i bez cene po L", /pakovanje \(zapremina\) ovog artikla još nije potvrđeno/.test(pNp) && !/Dodajte u korpu/.test(pNp) && !/2\.\d{3},00 RSD \/ L/.test(pNp), pNp.slice(0, 200));
    check("sajt: status za LIT bez pakovanja = „Cena na upit“", /Cena na upit/i.test(await statusOf(a.page)), await statusOf(a.page));
    await a.page.screenshot({ path: `${OUT}/s3b-A-bez-pakovanja.png`, fullPage: false });

    // 4. Na upit: povezan bez cene / nepovezana varijanta.
    await go(a.page, `${VOC}?varijanta=144.027`);
    const pNo = await panelText(a.page);
    check("sajt: status varijante bez cene = „Cena na upit“", /Cena na upit/i.test(await statusOf(a.page)), await statusOf(a.page));
    check("sajt: povezan artikal bez cene → „Cena na upit“, bez nule", /Cena na upit: za ovaj artikal/.test(pNo) && !/0,00 RSD/.test(pNo), pNo.slice(0, 160));
    await go(a.page, `${VOC}?varijanta=144.539`);
    const pUn = await panelText(a.page);
    check("sajt: status nepovezane varijante = javni „Na upit“", /^Na upit$/i.test(await statusOf(a.page)), await statusOf(a.page));
    check("sajt: nepovezana varijanta → upit za nabavku, bez dodavanja u korpu", /nije u našoj ponudi za direktno poručivanje|Pošaljite upit za nabavku/i.test(pUn) && !/Dodajte u korpu/.test(pUn), pUn.slice(0, 160));
    await a.page.screenshot({ path: `${OUT}/s4-A-na-upit.png` });

    // 5. „Poručite ponovo“ u katalogu puni ISTU korpu.
    await go(a.page, "/katalog");
    const re = a.page.locator('section[aria-labelledby="reorder-title"]');
    await re.waitFor({ timeout: 60000 });
    const item = re.locator("li", { hasText: "SINTETICKI ARTIKAL 1" }).first();
    await item.locator('input[type="number"]').fill("1");
    await item.getByRole("button", { name: "Dodajte u korpu" }).click();
    await item.locator('[role="status"]').waitFor({ timeout: 30000 });
    await a.page.screenshot({ path: `${OUT}/s5-A-poructe-ponovo.png` });
    check("sajt: „Poručite ponovo“ i katalog — ista korpa (C01 2 kom, C04 2 kante = 10 LIT, 900001 1)", JSON.stringify(await cartRows(A)) === JSON.stringify([{ code: "900001", q: "1.000", n: 1 }, { code: "SINT-C01", q: "2.000", n: 2 }, { code: "SINT-C04", q: "10.000", n: 2 }]), JSON.stringify(await cartRows(A)));

    // 6. Odjava sa proizvoda → ista strana, bez cena; ponovna prijava iz kataloga → katalog; korpa ostaje.
    await go(a.page, FILLER);
    await a.page.getByRole("button", { name: /Moj nalog/ }).click();
    await a.page.getByRole("menuitem", { name: "Odjavite se" }).click();
    await a.page.waitForLoadState(WAIT); await a.page.waitForTimeout(1500);
    check("sajt: odjava vraća na isti proizvod, panel nestaje", pathOf(a.page) === FILLER && (await panelOf(a.page).count()) === 0, pathOf(a.page));
    const posle = await a.ctx.request.get(`${B}/api/kupac/ponude`);
    const posleBody = await posle.text();
    check("sajt: posle odjave API u istom prozoru ne daje cene", !/"offers":\[\{/.test(posleBody) && !/SINT Auto/.test(posleBody), posleBody.slice(0, 80));
    const back = await a.ctx.request.get(`${B}/kupac/korpa`, { maxRedirects: 0 });
    check("sajt: posle odjave /kupac/korpa traži prijavu", back.status() >= 300 && back.status() < 400, String(back.status()));
    await go(a.page, "/katalog");
    await loginIcon(a.page).click();
    await loginForm(a.page, creds.kupac);
    check("sajt: prijava iz kataloga vraća u katalog", pathOf(a.page) === "/katalog", pathOf(a.page));
    check("sajt: korpa preživela odjavu i ponovnu prijavu", (await cartRows(A)).length === 3);

    // 7. Drugi kupac u drugom prozoru, istovremeno: svoja cena, jedna opcija, bez cena firme A.
    const d = await win();
    await go(d.page, "/");
    await loginIcon(d.page).click();
    await loginForm(d.page, creds.kupacD);
    check("sajt: prijava sa početne vraća na početnu", pathOf(d.page) === "/", pathOf(d.page));
    await go(d.page, FILLER);
    const pD = await panelText(d.page);
    const dHtml = await d.page.content();
    check("sajt: firma D — svoja cena (2.160,00 bez PDV-a), jedna opcija, bez cena firme A",
      /SINT Lakirnica D/i.test(pD) && pD.includes("2.160,00") && !/Odloženo/i.test(pD) && !["1.800,00", "1.920,00"].some((x) => dHtml.includes(x)) && !/SINT Auto/.test(dHtml), pD.slice(0, 200));
    await d.page.screenshot({ path: `${OUT}/s6-D-proizvod-cena.png` });
    const dApi = await (await d.ctx.request.get(`${B}/api/kupac/ponude`)).text();
    check("sajt: API firme D ne nosi podatke firme A", /SINT Lakirnica D/.test(dApi) && !/SINT Auto/.test(dApi) && !/"1800/.test(dApi));
    await go(a.page, FILLER);
    const pA2 = await panelText(a.page);
    check("sajt: prozor firme A posle prijave D i dalje pokazuje A", /SINT Auto Lak/i.test(pA2) && pA2.includes("1.800,00"));
    const pub = await (await a.ctx.request.get(`${B}${FILLER}`)).text();
    check("sajt: HTML strane proizvoda (prijavljen) ne sadrži cene — stižu samo kroz no-store API", !PRICES.some((x) => pub.includes(x)));

    // 8. Telefon: firma D, prijava iz menija na proizvodu, korpa.
    const ph = await win(phone);
    await go(ph.page, FILLER);
    await ph.page.getByRole("button", { name: "Otvorite meni" }).click();
    await ph.page.getByRole("link", { name: "Prijava za kupce" }).click();
    await loginForm(ph.page, creds.kupacD);
    check("sajt (telefon): prijava iz menija vraća na proizvod", pathOf(ph.page) === FILLER, pathOf(ph.page));
    const pPh = await panelText(ph.page);
    check("sajt (telefon): panel sa cenom firme D", pPh.includes("2.160,00"));
    await panelOf(ph.page).scrollIntoViewIfNeeded();
    await ph.page.screenshot({ path: `${OUT}/s7-telefon-panel.png` });
    await panelOf(ph.page).locator('input[type="number"]').fill("1");
    await panelOf(ph.page).getByRole("button", { name: "Dodajte u korpu" }).click();
    await panelOf(ph.page).locator('[role="status"]').waitFor({ timeout: 30000 });
    await go(ph.page, "/kupac/korpa");
    await ph.page.screenshot({ path: `${OUT}/s8-telefon-korpa.png`, fullPage: true });
    check("sajt (telefon): korpa firme D ima samo svoju stavku", JSON.stringify(await cartRows(D)) === JSON.stringify([{ code: "SINT-C01", q: "1.000", n: 1 }]));

    // 9. Korpa A: zbir po opciji; promena rabata pre slanja → nova potvrda; slanje.
    const k = a.page;
    await korpa(k, "Avansno plaćanje");
    const zAv = await txt(k.locator("main"));
    check("sajt: korpa A avans = 15.220,00 (2×1.800 + 2 kante × 3.600 + 4.420)", zAv.includes("15.220,00"), (zAv.match(/Osnovica[^A-Z]{0,40}/) ?? [""])[0]);
    check("sajt: korpa prikazuje broj pakovanja, obračun u JM i cenu pakovanja", /× kanta 5 L/.test(zAv) && /= 10 LIT/.test(zAv) && zAv.includes("3.600,00"), "");
    await k.screenshot({ path: `${OUT}/s9-A-korpa.png`, fullPage: true });
    await korpa(k, "Odloženo");
    check("sajt: korpa A odloženo = 15.940,00 (2×1.920 + 2 × 3.840 + 4.420)", (await txt(k.locator("main"))).includes("15.940,00"));
    await korpa(k, "Avansno plaćanje");
    await sqlc`UPDATE price_rules SET discount_percent = 26 WHERE customer_id = ${A} AND brand = 'SINTKAT' AND payment_condition = 'avans'`;
    await fillAndSend(k);
    const alert = k.locator("[role=alert]", { hasText: /promenil|više nije odobrena/ }).first();
    await alert.waitFor({ timeout: 30000 });
    check("sajt: promena cene pre slanja → nova potvrda, zahtev nije napravljen", (await sqlc`SELECT count(*)::int n FROM customer_orders WHERE customer_id = ${A}`)[0].n === 0, (await txt(alert)).slice(0, 120));
    await sqlc`UPDATE price_rules SET discount_percent = 25 WHERE customer_id = ${A} AND brand = 'SINTKAT' AND payment_condition = 'avans'`;
    await korpa(k, "Avansno plaćanje");
    await fillAndSend(k);
    await k.waitForFunction(() => location.pathname.startsWith("/kupac/porudzbine/"), null, { timeout: 60000 });
    await k.waitForLoadState(WAIT);
    const broj = (await txt(k.locator("main"))).match(/Z-\d{4}-\d+/)?.[0] ?? "";
    check("sajt: zahtev poslat iz korpe napunjene sa sajta", Boolean(broj), broj);
    const red = await sqlc`SELECT l.article_code, l.quantity::text q, l.pack_count n, l.pack_quantity::text pq, l.net_price::text p, l.catalog_product_slug s, l.catalog_variant_id v FROM customer_order_lines l JOIN customer_orders o ON o.id = l.order_id WHERE o.customer_id = ${A} ORDER BY l.article_code`.catch((e) => [{ greska: e.message }]);
    log("stavke zahteva", red);
    const c04 = red.find((r) => r.article_code === "SINT-C04");
    check("zahtev: C04 = 2 pakovanja × 5 = 10 LIT po 720,00/L (iznos 7.200,00)", c04 && c04.q === "10.000" && c04.n === 2 && c04.pq === "5.000" && c04.p === "720.0000", JSON.stringify(c04));
    const det0 = await txt(k.locator("main"));
    check("zahtev (kupac): stavka pokazuje „2 × kanta 5 L“ i „= 10 LIT“", /2 × kanta 5 L/.test(det0) && /= 10 LIT/.test(det0));
    await k.screenshot({ path: `${OUT}/s10-A-poslato.png`, fullPage: true });

    // 10. Kancelarija prima i štampa.
    const t = await (await b.newContext(desk)).newPage(); await staff(t, "kancelarija");
    await go(t, "/portal/zahtevi");
    const href = await t.locator('a[href^="/portal/zahtevi/"]').filter({ hasText: broj }).first().getAttribute("href");
    await go(t, href);
    const det = await txt(t.locator("main"));
    check("kancelarija: zahtev sa sajta u pregledu (SINT-C01 i SINT-C04, firma A)", /SINT-C01/.test(det) && /SINT-C04/.test(det) && /900001/.test(det) && /SINT Auto Lak/i.test(det));
    await t.screenshot({ path: `${OUT}/s11-kancelarija-zahtev.png`, fullPage: true });
    await go(t, `${href}/stampa`);
    const st = await txt(t.locator("body"));
    check("kancelarija: štampa zahteva sadrži stavke i broj", st.includes(broj) && /SINT-C01/.test(st) && /SINT-C04/.test(st));
    check("kancelarija: štampa — količina u JM (10) i „poručeno: 2 × kanta 5 L = 10 LIT“", /poručeno: 2 × kanta 5 L = 10 LIT/.test(st) && /7\.200,00/.test(st));
    const prelivanje = await t.locator("td.zp-code").evaluateAll((els) => els.filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent));
    check("kancelarija: šifra u štampi ne prelazi u susednu kolonu", prelivanje.length === 0 && (await t.locator("td.zp-code").count()) === 3, JSON.stringify(prelivanje));
    await t.screenshot({ path: `${OUT}/s12-stampa.png`, fullPage: true });

    // 11. Kancelarija u predlogu menja kante 10 LIT → 7 LIT (nije celo pakovanje): izuzetak svuda, bez „2 × kanta“.
    await go(t, href);
    if (await t.getByRole("button", { name: "Preuzmite u obradu" }).count()) {
      await t.getByRole("button", { name: "Preuzmite u obradu" }).click();
      await t.waitForLoadState(WAIT); await t.waitForTimeout(1500);
    }
    await t.locator("details#izmena > summary").click();
    const form = t.locator("details#izmena");
    await form.locator('input[aria-label^="Količina, SINT-C04"]').fill("7");
    await form.locator("textarea").fill("Na stanju samo 7 litara — izuzetak od cele kante");
    await form.getByRole("button", { name: "Proverite cene" }).click();
    await form.getByRole("button", { name: /Pošaljite izmenjen predlog/ }).and(form.locator("button:not([disabled])")).waitFor({ timeout: 30000 });
    const fz = await txt(form);
    check("kancelarija: predlog upozorava „Izuzetak: 7 LIT nije ceo broj pakovanja (kanta 5 L)“", /Izuzetak: 7 LIT nije ceo broj pakovanja \(kanta 5 L\)/.test(fz), "");
    await t.screenshot({ path: `${OUT}/s13-kancelarija-izuzetak.png`, fullPage: true });
    await form.getByRole("button", { name: /Pošaljite izmenjen predlog/ }).click();
    await t.waitForTimeout(2500); await t.waitForLoadState(WAIT);
    await go(k, "/kupac/porudzbine");
    const hp = await k.locator("a", { hasText: /\/2/ }).first().getAttribute("href");
    await go(k, hp);
    const kp = await txt(k.locator("main"));
    const c04row = await txt(k.locator("tr", { hasText: "SINT-C04" }).first());
    check("kupac: predlog pokazuje novu količinu 7 LIT i izuzetak, ne „2 × kanta 5 L“", /Izuzetak: nije ceo broj pakovanja \(kanta 5 L\)/i.test(c04row) && /7 LIT/.test(c04row) && !/2 × kanta 5 L/.test(c04row) && /Količina 10 → 7/.test(c04row), c04row.slice(0, 200));
    check("kupac: ostale stavke predloga ostaju u celim pakovanjima", /Potvrdite predlog/.test(kp));
    await k.screenshot({ path: `${OUT}/s14-kupac-predlog-izuzetak.png`, fullPage: true });
    await go(t, "/portal/zahtevi");
    const hpOffice = await t.locator('a[href^="/portal/zahtevi/"]').filter({ hasText: /\/2/ }).first().getAttribute("href").catch(() => null);
    if (hpOffice) {
      await go(t, `${hpOffice}/stampa`);
      const st2 = await txt(t.locator("body"));
      check("kancelarija: štampa predloga — „IZUZETAK: 7 LIT nije ceo broj pakovanja“", /IZUZETAK: 7 LIT nije ceo broj pakovanja \(kanta 5 L\)/.test(st2));
      await t.screenshot({ path: `${OUT}/s15-stampa-izuzetak.png`, fullPage: true });
    }

    // 12. „Poručite ponovo“: uobičajeno 7 LIT, pakovanje kanta 5 L → bez predloga, objašnjenje, ručni unos celog broja.
    await go(k, "/katalog");
    const reo = k.locator('section[aria-labelledby="reorder-title"]');
    await reo.waitFor({ timeout: 60000 });
    const reoLi = reo.locator("li", { hasText: "SINT-C04" }).first();
    await reoLi.scrollIntoViewIfNeeded();
    const reoT = await txt(reoLi);
    const val = await reoLi.locator('input[type="number"]').inputValue();
    check("Poručite ponovo: 7 LIT nije ceo broj kanti — polje prazno, bez tihog zaokruživanja", val === "", `vrednost „${val}“`);
    check("Poručite ponovo: objašnjenje „Uobičajeno ste kupovali 7 LIT, a pakovanje je kanta 5 L — nije ceo broj pakovanja“", /Uobičajeno ste kupovali 7 LIT, a pakovanje je kanta 5 L — to nije ceo broj pakovanja/.test(reoT), reoT.slice(0, 220));
    const before = await cartRows(A);
    await reoLi.getByRole("button", { name: "Dodajte u korpu" }).click();
    await reoLi.locator('[role="status"]').waitFor({ timeout: 30000 });
    const emptyMsg = await txt(reoLi.locator('[role="status"]'));
    check("Poručite ponovo: prazno polje se ne šalje kao predlog — traži ceo broj pakovanja", /ceo broj pakovanja/.test(emptyMsg) && JSON.stringify(await cartRows(A)) === JSON.stringify(before), emptyMsg);
    await k.screenshot({ path: `${OUT}/s16-poruci-ponovo-nedeljivo.png`, fullPage: false });
    await reoLi.locator('input[type="number"]').fill("1");
    await reoLi.getByRole("button", { name: "Dodajte u korpu" }).click();
    await k.waitForTimeout(1500);
    const reoCart = (await cartRows(A)).find((r) => r.code === "SINT-C04");
    check("Poručite ponovo: ručno 1 kanta = 5 LIT u korpi", reoCart?.n === 1 && reoCart?.q === "5.000", JSON.stringify(reoCart));

    // 13. Baslac „0,5L“ sa JM KOM: pakovanje = 1 komad (limenka 0,5 L), cena po komadu se NE množi sa 0,5.
    await go(k, "/proizvodi/baslac-50-420-2k-clear-hardener-normal-voc");
    const pk = await panelText(k);
    check("KOM limenka 0,5 L: cena pakovanja = cena po komadu (1.792,50 avans), ne pola", pk.includes("1.792,50 RSD / limenka 0,5 L") && !pk.includes("896,25"), pk.slice(0, 220));
    await panelOf(k).locator('input[type="number"]').fill("2");
    await k.waitForTimeout(300);
    check("KOM limenka 0,5 L: „2 × limenka 0,5 L = 2 kom u obračunu“", /2 × limenka 0,5 L = 2 kom u obračunu/.test(await txt(panelOf(k))));
    await panelOf(k).getByRole("button", { name: "Dodajte u korpu" }).click();
    await panelOf(k).locator('[role="status"]').waitFor({ timeout: 30000 });
    const c07 = (await cartRows(A)).find((r) => r.code === "SINT-C07");
    check("KOM limenka 0,5 L: korpa 2 pakovanja = 2.000 KOM", c07?.n === 2 && c07?.q === "2.000", JSON.stringify(c07));
    await k.screenshot({ path: `${OUT}/s17-kom-limenka-05.png`, fullPage: false });
    check("sajt: bez 5xx odgovora", errors.length === 0, errors.join(", "));
  }
  if (STEP === "kontrolne") {
    // Deset kontrolnih veza (potvrda vlasnika 2026-10-11): stvarni artikli i osnovne cene iz privatnog
    // snimka, sintetički rabat firme A (20 % / avans 25 %). Pre koraka: reset, seed-control-links.mts,
    // apply-confirmed-links.mts --upis. Plan veza čita iz CONTROL_LINKS (privatni JSON).
    const plan = JSON.parse(readFileSync(process.env.CONTROL_LINKS, "utf8")).veze;
    const envText = readFileSync(process.env.SYNTH_ENV_FILE ?? process.env.HOME + "/.carsystem-secrets/revizija-sinteticki.env", "utf8");
    const code = envText.match(/^SITE_ACCESS_PASSWORD=(.*)$/m)[1];
    const ctx = await b.newContext(desk);
    await ctx.request.post(`${B}/site-u-pripremi/access`, { form: { accessCode: code }, maxRedirects: 0 });
    const k = await ctx.newPage();
    const errors = []; k.on("response", (x) => { if (x.status() >= 500) errors.push(`${x.status()} ${new URL(x.url()).pathname}`); });
    await customer(k);
    await sqlc`DELETE FROM customer_cart_items WHERE customer_id = ${A}`;
    const money = (n) => new Intl.NumberFormat("sr-Latn-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
    const offers = await k.evaluate(async () => (await (await fetch("/api/kupac/ponude", { cache: "no-store" })).json()).offers);
    log("ponude kataloga (stanja)", offers.reduce((m, o) => ({ ...m, [o.state]: (m[o.state] ?? 0) + 1 }), {}));
    const panel = k.locator('section[aria-labelledby="buy-panel-title"]');
    for (const v of plan) {
      const [{ base }] = await sqlc`SELECT b.net_price::numeric AS base FROM article_base_prices b JOIN articles a ON a.id = b.article_id WHERE a.code = ${v.sifra} ORDER BY b.valid_from DESC LIMIT 1`;
      const o = offers.find((x) => x.articleCode === v.sifra);
      const unitNet = Math.round(Number(base) * 0.75 * 100) / 100;
      const packNet = Math.round(unitNet * v.pakovanje * 100) / 100;
      const n = v.proba ?? 1; // broj pakovanja koje kupac bira u probi
      // Iznos pakovanja računa obračun iz osnovne cene × količina × (1 − rabat) u jednom koraku (kao fakture),
      // pa sme da se razlikuje za paru od „zaokružena cena po JM × pakovanje“.
      const apiPack = o?.byOption.avans?.packAmounts?.net;
      const apiOk = o && o.state === "orderable" && o.pack?.quantity === v.pakovanje && o.pack?.label === v.oznaka && o.byOption.avans?.netPrice === unitNet && apiPack !== undefined && Math.abs(apiPack - Number(base) * 0.75 * v.pakovanje) <= 0.0051;
      if (!v.slug) {
        // Bez kartice na sajtu: poručuje se kroz „Izbor robe“ u nalogu (isto potvrđeno pakovanje).
        await go(k, `/kupac/naruci?q=${encodeURIComponent(v.sifra)}`);
        const row = k.locator("table.pn-table tbody tr", { hasText: v.sifra }).first();
        const rt = await txt(row);
        check(`kontrolna ${v.sifra} (bez kartice): Izbor robe nudi „${v.oznaka}“ po ceni pakovanja ${money(packNet)}`, rt.includes(`× ${v.oznaka}`) && rt.includes(money(packNet)), rt.slice(0, 160));
        await row.locator("input").fill(String(n));
        await row.getByRole("button", { name: "Dodajte u korpu" }).click();
        await row.locator("[role=status]").filter({ hasText: /Dodato/ }).waitFor({ timeout: 30000 });
        continue;
      }
      await go(k, `/proizvodi/${v.slug}${v.varijanta ? `?varijanta=${encodeURIComponent(v.varijanta)}` : ""}`);
      await panel.waitFor({ timeout: 60000 }); await k.waitForTimeout(800);
      const radio = panel.locator("label", { hasText: `šifra ${v.sifra}` }).locator('input[type="radio"]');
      if (await radio.count()) { await radio.check(); await k.waitForTimeout(300); }
      const pt = await txt(panel);
      const shown = pt.includes(`${money(apiPack ?? packNet)} RSD / ${v.oznaka}`);
      // Prefill: „400 ml“ iz BizniSoft naziva nije potvrđen kapacitet — kupac ga ne sme videti kao opis.
      const no400 = !v.slug.includes("prefill") || !/400\s*ml/i.test(pt);
      check(`kontrolna ${v.sifra}: pakovanje „${v.oznaka}“ = ${v.pakovanje} ${v.jm}, cena pakovanja ${money(packNet)} (osnovna × 0,75 × ${v.pakovanje})`, Boolean(apiOk && shown && no400), apiOk ? (shown ? (no400 ? "" : "400 ml prikazan") : pt.slice(0, 160)) : JSON.stringify(o?.pack ?? o?.state ?? "nema ponude"));
      await panel.locator('input[type="number"]').fill(String(n));
      await k.waitForTimeout(200);
      if (n > 1 || v.pakovanje !== 1) {
        const bill = `${n} × ${v.oznaka} = ${String(n * v.pakovanje).replace(".", ",")} ${v.jm === "KOM" ? "kom" : v.jm === "LIT" ? "L" : v.jm} u obračunu`;
        check(`kontrolna ${v.sifra}: kupac vidi „${bill}“`, (await txt(panel)).includes(bill), "");
      }
      await panel.getByRole("button", { name: "Dodajte u korpu" }).click();
      await panel.locator('[role="status"]').waitFor({ timeout: 30000 });
      await k.screenshot({ path: `${OUT}/c-${v.sifra}.png` });
    }
    const cart = await sqlc`SELECT a.code, ci.pack_count AS n, ci.quantity::text AS q FROM customer_cart_items ci JOIN articles a ON a.id = ci.article_id WHERE ci.customer_id = ${A}`;
    const cartOk = plan.every((v) => cart.some((c) => c.code === v.sifra && c.n === (v.proba ?? 1) && Number(c.q) === v.pakovanje * (v.proba ?? 1)));
    check("kontrolne: korpa — broj pakovanja i BizniSoft količina (pakovanja × količina pakovanja) za svaki artikal", cartOk && cart.length === plan.length, JSON.stringify(cart));
    await korpa(k, "Avansno plaćanje");
    await k.screenshot({ path: `${OUT}/c-korpa.png`, fullPage: true });
    await fillAndSend(k);
    await k.waitForFunction(() => location.pathname.startsWith("/kupac/porudzbine/"), null, { timeout: 60000 });
    const broj = (await txt(k.locator("main"))).match(/Z-\d{4}-\d+/)?.[0] ?? "";
    const lines = await sqlc`SELECT l.article_code AS c, l.quantity::numeric AS q, l.pack_count AS n, l.pack_quantity::numeric AS pq, l.pack_label AS lab, l.net_price::numeric AS p
      FROM customer_order_lines l JOIN customer_orders o ON o.id = l.order_id WHERE o.request_number = ${broj}`;
    const linesOk = plan.every((v) => lines.some((l) => l.c === v.sifra && l.n === (v.proba ?? 1) && Number(l.pq) === v.pakovanje && Number(l.q) === v.pakovanje * (v.proba ?? 1) && l.lab === v.oznaka));
    check(`kontrolne: zahtev ${broj} — broj pakovanja, količina pakovanja, obračun i oznaka po stavci`, linesOk && lines.length === plan.length, "");
    const t = await (await b.newContext(desk)).newPage(); await staff(t, "kancelarija");
    await go(t, "/portal/zahtevi");
    const href = await t.locator('a[href^="/portal/zahtevi/"]').filter({ hasText: broj }).first().getAttribute("href");
    await go(t, `${href}/stampa`);
    const st = await txt(t.locator("body"));
    // Za svaku stavku: „poručeno: 1 × <oznaka> = <pakovanje> <JM>“ (oznaka je opis prodajne jedinice).
    const missing = plan.filter((v) => !st.includes(v.sifra) || !st.includes(`poručeno: ${v.proba ?? 1} × ${v.oznaka} = ${String(v.pakovanje * (v.proba ?? 1)).replace(".", ",")} ${v.jm}`));
    check("kontrolne: štampa — sve šifre i „poručeno: 1 × <pakovanje> = <količina> <JM>“ za svaku stavku", missing.length === 0, missing.map((v) => v.sifra).join(", "));
    const overflow = await t.locator("td.zp-code").evaluateAll((els) => els.filter((e) => e.scrollWidth > e.clientWidth + 1).length);
    check("kontrolne: štampa — šifre ne prelaze u susednu kolonu", overflow === 0, String(overflow));
    await t.screenshot({ path: `${OUT}/c-stampa.png`, fullPage: true });
    check("kontrolne: bez 5xx", errors.length === 0, errors.join(", "));
  }
  if (STEP === "pribor") {
    // Predlog poklopca uz izabranu posudu (0048, odluka vlasnika 2026-10-13). PRIBOR_PAROVI = privatni plan
    // { parovi: [{ artikal, pribor }] }; prva dva para se proveravaju: jedan kroz „Izbor robe”, jedan kroz katalog
    // (ako posuda ima karticu). Server mora imati ORDERING_COMPANION_STOCK=unknown-ok (izvor zaliha ne postoji).
    const pairs = JSON.parse(readFileSync(process.env.PRIBOR_PAROVI, "utf8")).parovi;
    const code = readFileSync(process.env.SYNTH_ENV_FILE ?? process.env.HOME + "/.carsystem-secrets/revizija-sinteticki.env", "utf8").match(/^SITE_ACCESS_PASSWORD=(.*)$/m)[1];
    const ctx = await b.newContext(desk);
    await ctx.request.post(`${B}/site-u-pripremi/access`, { form: { accessCode: code }, maxRedirects: 0 });
    const k = await ctx.newPage();
    const errors = []; k.on("response", (x) => { if (x.status() >= 500) errors.push(`${x.status()} ${new URL(x.url()).pathname}`); });
    await customer(k);
    const cartCodes = async () => (await sqlc`SELECT a.code, ci.pack_count AS n FROM customer_cart_items ci JOIN articles a ON a.id = ci.article_id WHERE ci.customer_id = ${A}`).map((r) => `${r.code}×${r.n}`).sort();
    const aside = k.locator('aside[aria-label="Odgovarajući pribor"]');
    const offers = await k.evaluate(async () => (await (await fetch("/api/kupac/ponude", { cache: "no-store" })).json()).offers);
    for (const [i, pair] of pairs.slice(0, 6).entries()) {
      await sqlc`DELETE FROM customer_cart_items WHERE customer_id = ${A}`;
      const viaCatalog = offers.find((o) => o.articleCode === pair.artikal);
      if (viaCatalog && i > 0) {
        await go(k, `/proizvodi/${viaCatalog.slug}${viaCatalog.variantKey ? `?varijanta=${encodeURIComponent(viaCatalog.variantKey)}` : ""}`);
        const panel = k.locator('section[aria-labelledby="buy-panel-title"]');
        await panel.waitFor({ timeout: 30000 });
        const radio = panel.locator(`input[type="radio"][value="${viaCatalog.articleId}"]`);
        if (await radio.count()) { await radio.check(); await k.waitForTimeout(300); }
        await panel.locator('input[inputmode="numeric"]').first().fill("2");
        await panel.getByRole("button", { name: "Dodajte u korpu" }).click();
      } else {
        await go(k, `/kupac/naruci?q=${encodeURIComponent(pair.artikal)}`);
        const row = k.locator("table.pn-table tbody tr", { hasText: pair.artikal }).first();
        await row.locator("input").fill("2");
        await row.getByRole("button", { name: "Dodajte u korpu" }).click();
      }
      await aside.waitFor({ timeout: 30000 });
      const at = await txt(aside);
      const before = await cartCodes();
      check(`pribor ${pair.artikal} (${viaCatalog && i > 0 ? "katalog" : "Izbor robe"}): panel nudi poklopac ${pair.pribor}; u korpi samo posuda`, at.includes(pair.pribor) && /Ne dodaje se automatski/.test(at) && before.join() === `${pair.artikal}×2`, `${at.slice(0, 160)} | korpa ${before.join()}`);
      await k.screenshot({ path: `${OUT}/p-${pair.artikal}.png` });
      // „Kompatibilno“ nema predlog broja (prazno polje) — kupac upisuje broj; poklopac je predložen.
      const qty = aside.locator("li").first().locator("input");
      if (!(await qty.inputValue())) await qty.fill("2");
      await aside.getByRole("button", { name: "Dodajte" }).first().click();
      await k.waitForFunction(() => /(Poklopac|Artikal) je dodat u korpu/.test(document.body.innerText), null, { timeout: 30000 });
      const after = await cartCodes();
      check(`pribor ${pair.artikal}: posle klika korpa ima posudu i poklopac (2 + 2)`, after.join() === [`${pair.artikal}×2`, `${pair.pribor}×2`].sort().join(), after.join());
    }
    check("pribor: bez 5xx", errors.length === 0, errors.join(", "));
  }
  if (STEP === "herteri") {
    // Predlog hertera (0048, odluka vlasnika 2026-10-13). HERTER_PROBA = privatni JSON
    // [{ artikal, kanal: "katalog" | "izbor", paketa, opcije: { <šifra hertera>: <predlog broja pakovanja | null> }, dodaj: <šifra> }].
    // Proverava: sve opcije iz tehničkog lista, nijedna unapred izabrana, predlog količine samo gde je dozvoljen,
    // u korpi samo osnovni artikal do klika; zatim zahtev i štampa sa herterima. Server: ORDERING_COMPANION_STOCK=unknown-ok.
    const cases = JSON.parse(readFileSync(process.env.HERTER_PROBA, "utf8"));
    const code = readFileSync(process.env.SYNTH_ENV_FILE ?? process.env.HOME + "/.carsystem-secrets/revizija-sinteticki.env", "utf8").match(/^SITE_ACCESS_PASSWORD=(.*)$/m)[1];
    const ctx = await b.newContext(desk);
    await ctx.request.post(`${B}/site-u-pripremi/access`, { form: { accessCode: code }, maxRedirects: 0 });
    const k = await ctx.newPage();
    const errors = []; k.on("response", (x) => { if (x.status() >= 500) errors.push(`${x.status()} ${new URL(x.url()).pathname}`); });
    await customer(k);
    await sqlc`DELETE FROM customer_cart_items WHERE customer_id = ${A}`;
    const cart = async () => Object.fromEntries((await sqlc`SELECT a.code, ci.pack_count AS n FROM customer_cart_items ci JOIN articles a ON a.id = ci.article_id WHERE ci.customer_id = ${A}`).map((r) => [r.code, r.n]));
    const offers = await k.evaluate(async () => (await (await fetch("/api/kupac/ponude", { cache: "no-store" })).json()).offers);
    const aside = k.locator('aside[aria-label="Odgovarajući pribor"]');
    const expectCart = {};
    for (const c of cases) {
      const before = await cart();
      if (c.kanal === "katalog") {
        const o = offers.find((x) => x.articleCode === c.artikal);
        if (!o) { check(`herteri ${c.artikal}: ponuda u katalogu postoji`, false, "nema ponude"); continue; }
        await go(k, `/proizvodi/${o.slug}${o.variantKey ? `?varijanta=${encodeURIComponent(o.variantKey)}` : ""}`);
        const panel = k.locator('section[aria-labelledby="buy-panel-title"]');
        await panel.waitFor({ timeout: 30000 });
        const radio = panel.locator(`input[type="radio"][value="${o.articleId}"]`);
        if (await radio.count()) { await radio.check(); await k.waitForTimeout(300); }
        await panel.locator('input[inputmode="numeric"]').first().fill(String(c.paketa));
        await panel.getByRole("button", { name: "Dodajte u korpu" }).click();
      } else {
        await go(k, `/kupac/naruci?q=${encodeURIComponent(c.artikal)}`);
        const row = k.locator("table.pn-table tbody tr", { hasText: c.artikal }).first();
        await row.locator("input").fill(String(c.paketa));
        await row.getByRole("button", { name: "Dodajte u korpu" }).click();
      }
      expectCart[c.artikal] = (expectCart[c.artikal] ?? 0) + c.paketa;
      await aside.waitFor({ timeout: 30000 });
      await k.waitForTimeout(300);
      const at = await txt(aside);
      const values = Object.fromEntries(await aside.locator("li").evaluateAll((lis) => lis.map((li) => [li.textContent.match(/šifra (\d{6})/)?.[1], li.querySelector("input")?.value ?? ""])));
      const want = Object.entries(c.opcije);
      const optsOk = want.every(([h, n]) => h in values && values[h] === (n === null ? "" : String(n))) && Object.keys(values).length === want.length;
      const after = await cart();
      const onlyBase = Object.keys(after).every((x) => x in before || x === c.artikal);
      check(`herteri ${c.artikal} (${c.kanal}): ${want.length} opcija iz tehničkog lista, predlozi ${JSON.stringify(c.opcije)}, ništa automatski`, optsOk && onlyBase && /tehnički list/.test(at), `${JSON.stringify(values)} | ${at.slice(0, 200)}`);
      await k.screenshot({ path: `${OUT}/h-${c.artikal}.png` });
      if (c.dodaj) {
        const li = aside.locator("li", { hasText: `šifra ${c.dodaj}` });
        if (!(await li.locator("input").inputValue())) await li.locator("input").fill("1");
        const n = Number(await li.locator("input").inputValue());
        await li.getByRole("button", { name: "Dodajte" }).click();
        await k.waitForFunction(() => /Herter je dodat/.test(document.body.innerText), null, { timeout: 30000 });
        expectCart[c.dodaj] = (expectCart[c.dodaj] ?? 0) + n;
        const now = await cart();
        check(`herteri ${c.artikal}: posle klika u korpi ${c.dodaj} × ${n}`, now[c.dodaj] === expectCart[c.dodaj], JSON.stringify(now));
      }
      await aside.getByRole("button", { name: "Zatvorite predlog" }).click();
    }
    const final = await cart();
    check("herteri: korpa = osnovni artikli + samo kliknuti herteri", JSON.stringify(Object.entries(final).sort()) === JSON.stringify(Object.entries(expectCart).sort()), JSON.stringify(final));
    await korpa(k, "Avansno plaćanje");
    await fillAndSend(k);
    await k.waitForFunction(() => location.pathname.startsWith("/kupac/porudzbine/"), null, { timeout: 60000 });
    const broj = (await txt(k.locator("main"))).match(/Z-\d{4}-\d+/)?.[0] ?? "";
    const lines = await sqlc`SELECT l.article_code AS c, l.pack_count AS n, l.quantity::numeric AS q, l.pack_label AS lab, l.unit AS u FROM customer_order_lines l JOIN customer_orders o ON o.id = l.order_id WHERE o.request_number = ${broj}`;
    check(`herteri: zahtev ${broj} sadrži sve stavke korpe sa brojem pakovanja`, lines.length === Object.keys(expectCart).length && lines.every((l) => expectCart[l.c] === l.n), JSON.stringify(lines));
    const t = await (await b.newContext(desk)).newPage(); await staff(t, "kancelarija");
    await go(t, "/portal/zahtevi");
    const href = await t.locator('a[href^="/portal/zahtevi/"]').filter({ hasText: broj }).first().getAttribute("href");
    await go(t, `${href}/stampa`);
    const st = await txt(t.locator("body"));
    const miss = lines.filter((l) => !st.includes(l.c) || !st.includes(`poručeno: ${l.n} × ${l.lab}`));
    check("herteri: štampa — šifra i „poručeno: N × <pakovanje>“ za osnovu i herter", miss.length === 0, miss.map((l) => l.c).join(", "));
    await t.screenshot({ path: `${OUT}/h-stampa.png`, fullPage: true });
    check("herteri: bez 5xx", errors.length === 0, errors.join(", "));
  }
  if (STEP === "odluke") {
    // Odluke vlasnika 2026-10-13. ODLUKE_PROBA = privatni JSON { upit: [šifra u Izboru robe], van: [šifra sa zvezdicom],
    // upitKartica: slug bez ponude, preusmerenja: [[sa, na]], bezVarijante: [[slug, red]], redovi: [[slug, [oznake]]],
    // tekst: [[slug, mora, ne_sme]] }.
    const t0 = JSON.parse(readFileSync(process.env.ODLUKE_PROBA, "utf8"));
    const code = readFileSync(process.env.SYNTH_ENV_FILE ?? process.env.HOME + "/.carsystem-secrets/revizija-sinteticki.env", "utf8").match(/^SITE_ACCESS_PASSWORD=(.*)$/m)[1];
    const ctx = await b.newContext(desk);
    await ctx.request.post(`${B}/site-u-pripremi/access`, { form: { accessCode: code }, maxRedirects: 0 });
    const k = await ctx.newPage();
    const errors = []; k.on("response", (x) => { if (x.status() >= 500) errors.push(`${x.status()} ${new URL(x.url()).pathname}`); });
    await customer(k);
    for (const c of t0.upit) {
      await go(k, `/kupac/naruci?q=${encodeURIComponent(c)}`);
      const row = k.locator("table.pn-table tbody tr", { hasText: c }).first();
      const rt = await txt(row);
      check(`odluke ${c}: Izbor robe — „Upit za nabavku“, bez dugmeta za korpu`, /Upit za nabavku/.test(rt) && (await row.getByRole("button", { name: "Dodajte u korpu" }).count()) === 0, rt.slice(0, 200));
    }
    for (const c of t0.van) {
      await go(k, `/kupac/naruci?q=${encodeURIComponent(c)}`);
      const n = await k.locator("table.pn-table tbody tr", { hasText: c }).count();
      check(`odluke ${c}: artikal van programa se ne nudi u Izboru robe`, n === 0, String(n));
    }
    const offers = await k.evaluate(async () => (await (await fetch("/api/kupac/ponude", { cache: "no-store" })).json()).offers);
    check("odluke: ponude kataloga bez artikala van programa i sa stanjem „inquiry“ za upit za nabavku", !offers.some((o) => t0.van.includes(o.articleCode)), "");
    await go(k, `/proizvodi/${t0.upitKartica}`);
    const panel = k.locator('section[aria-labelledby="buy-panel-title"]');
    await panel.waitFor({ timeout: 30000 });
    const pt = await txt(panel);
    check(`odluke ${t0.upitKartica}: kartica bez ponude nudi „Upit za nabavku“, bez korpe`, /Upit za nabavku/.test(pt) && (await panel.getByRole("button", { name: "Dodajte u korpu" }).count()) === 0, pt.slice(0, 200));
    const before = (await sqlc`SELECT count(*)::int AS n FROM customer_price_requests WHERE kind = 'procurement'`)[0].n;
    await panel.getByRole("button", { name: "Pošaljite upit za nabavku" }).click();
    await k.waitForFunction(() => /Zahtev U-\d{4}-\d+ je poslat/.test(document.body.innerText), null, { timeout: 30000 });
    const after = (await sqlc`SELECT count(*)::int AS n FROM customer_price_requests WHERE kind = 'procurement'`)[0].n;
    check(`odluke ${t0.upitKartica}: upit za nabavku zapisan kao vrsta „procurement“ (ne porudžbina, ne upit za cenu)`, after === before + 1, `${before} → ${after}`);
    await k.screenshot({ path: `${OUT}/o-upit-nabavka.png` });
    const anon = await (await b.newContext(desk)).newPage();
    await anon.context().request.post(`${B}/site-u-pripremi/access`, { form: { accessCode: code }, maxRedirects: 0 });
    for (const [from, to] of t0.preusmerenja) {
      const r = await anon.context().request.get(`${B}${from}`, { maxRedirects: 0 });
      check(`odluke: ${from} → ${to} (trajno preusmerenje)`, [301, 308].includes(r.status()) && (r.headers().location ?? "").endsWith(to), `${r.status()} ${r.headers().location}`);
    }
    for (const [slug, row] of t0.bezVarijante) {
      const html = await (await anon.context().request.get(`${B}/proizvodi/${slug}`)).text();
      check(`odluke: ${slug} bez varijante van programa ${row}`, !html.includes(row), "");
    }
    for (const [slug, ids] of t0.redovi) {
      const html = await (await anon.context().request.get(`${B}/proizvodi/${slug}`)).text();
      const missing = ids.filter((id) => !html.includes(id));
      check(`odluke: ${slug} prikazuje svih ${ids.length} redova`, missing.length === 0, missing.join(", "));
    }
    for (const [slug, must, mustNot] of t0.tekst) {
      await go(anon, `/proizvodi/${slug}`);
      const body = await txt(anon.locator("main"));
      check(`odluke: ${slug} prikazuje „${must}“${mustNot ? `, ne „${mustNot}“` : ""}`, body.includes(must) && (!mustNot || !body.includes(mustNot)), body.slice(0, 160));
    }
    check("odluke: bez 5xx", errors.length === 0, errors.join(", "));
  }
  if (STEP === "ponude-svi") {
    // Svi artikli plana kroz /api/kupac/ponude (bez klikova): stanje „orderable”, potvrđeno pakovanje i
    // oznaka, cena pakovanja = osnovna × 0,75 × pakovanje (sintetički rabat firme A, avans 25 %).
    // Plan čita iz CONTROL_LINKS; pre koraka: seed-control-links + apply-confirmed-links --upis.
    const plan = JSON.parse(readFileSync(process.env.CONTROL_LINKS, "utf8")).veze;
    const code = readFileSync(process.env.SYNTH_ENV_FILE ?? process.env.HOME + "/.carsystem-secrets/revizija-sinteticki.env", "utf8").match(/^SITE_ACCESS_PASSWORD=(.*)$/m)[1];
    const ctx = await b.newContext(desk);
    await ctx.request.post(`${B}/site-u-pripremi/access`, { form: { accessCode: code }, maxRedirects: 0 });
    const k = await ctx.newPage(); await customer(k);
    const offers = await k.evaluate(async () => (await (await fetch("/api/kupac/ponude", { cache: "no-store" })).json()).offers);
    const bad = [];
    let checked = 0;
    // Artikal bez kartice (samo pakovanje) nema ponudu kataloga — poručuje se kroz „Izbor robe” (korak kontrolne).
    for (const v of plan.filter((x) => x.slug)) {
      checked += 1;
      const [row] = await sqlc`SELECT b.net_price::numeric AS base FROM article_base_prices b JOIN articles a ON a.id = b.article_id WHERE a.code = ${v.sifra} ORDER BY b.valid_from DESC LIMIT 1`;
      const o = offers.find((x) => x.articleCode === v.sifra);
      // Samo upit za nabavku (0049): ponuda postoji (veza), ali se ne poručuje.
      const [inq] = await sqlc`SELECT 1 AS x FROM articles_procurement_only p JOIN articles a ON a.id = p.article_id WHERE a.code = ${v.sifra}`;
      if (inq) { if (o?.state !== "inquiry" || o?.slug !== v.slug) bad.push(`${v.sifra}: očekivano „inquiry“, a ${o?.state}`); continue; }
      if (!row) { if (o?.state !== "no_price") bad.push(`${v.sifra}: bez osnovne cene, a stanje ${o?.state}`); continue; }
      const pack = o?.byOption.avans?.packAmounts?.net;
      const linkOk = v.slug ? o?.slug === v.slug && (v.varijanta ? o?.variantKey === v.varijanta : true) : true;
      // Veza bez upisanog pakovanja: za JM komad pravilo nudi 1 KOM („1 kom”); merna JM bez pakovanja se ne poručuje.
      const want = v.pakovanje ?? (/^(KOM|KT)$/i.test(v.jm) ? 1 : null);
      const label = v.pakovanje === null ? "1 kom" : v.oznaka;
      const ok = o && want !== null && o.state === "orderable" && o.pack?.quantity === want && o.pack?.label === label && pack !== undefined && Math.abs(pack - Number(row.base) * 0.75 * want) <= 0.0051 && linkOk;
      if (!ok) bad.push(`${v.sifra}: ${JSON.stringify({ state: o?.state, pack: o?.pack, slug: o?.slug, variantKey: o?.variantKey, net: pack })}`);
    }
    check(`ponude-svi: ${checked} artikala sa karticom (od ${plan.length}) — poručivo, pakovanje, oznaka, cena pakovanja i veza`, bad.length === 0, bad.slice(0, 8).join(" | "));
  }
  if (STEP === "cediljke") {
    // Kancelarijska izmena količine za artikal čije pakovanje je deo KOM (paket 125 cediljki = 0,5 KOM):
    // korak je 0,5 KOM — 1,5 prolazi (3 paketa), 1,3 se odbija. Pre koraka: seed-control-links + apply sa 146958.
    const code = readFileSync(process.env.SYNTH_ENV_FILE ?? process.env.HOME + "/.carsystem-secrets/revizija-sinteticki.env", "utf8").match(/^SITE_ACCESS_PASSWORD=(.*)$/m)[1];
    const ctx = await b.newContext(desk);
    await ctx.request.post(`${B}/site-u-pripremi/access`, { form: { accessCode: code }, maxRedirects: 0 });
    const k = await ctx.newPage(); await customer(k);
    await sqlc`DELETE FROM customer_cart_items WHERE customer_id = ${A}`;
    await go(k, "/proizvodi/carsystem-multi-strain?varijanta=146.958");
    const panel = k.locator('section[aria-labelledby="buy-panel-title"]'); await panel.waitFor({ timeout: 60000 }); await k.waitForTimeout(800);
    await panel.locator('input[type="number"]').fill("1");
    await panel.getByRole("button", { name: "Dodajte u korpu" }).click();
    await panel.locator('[role="status"]').waitFor({ timeout: 30000 });
    await korpa(k, "Avansno plaćanje"); await fillAndSend(k);
    await k.waitForFunction(() => location.pathname.startsWith("/kupac/porudzbine/"), null, { timeout: 60000 });
    const broj = (await txt(k.locator("main"))).match(/Z-\d{4}-\d+/)?.[0] ?? "";
    const [l0] = await sqlc`SELECT l.quantity::text q, l.pack_count n FROM customer_order_lines l JOIN customer_orders o ON o.id = l.order_id WHERE o.request_number = ${broj}`;
    check("cediljke: kupac 1 paket 125 = 0,5 KOM u zahtevu", l0?.q === "0.500" && l0?.n === 1, JSON.stringify(l0));
    const t = await (await b.newContext(desk)).newPage(); await staff(t, "kancelarija");
    await go(t, "/portal/zahtevi");
    const href = await t.locator('a[href^="/portal/zahtevi/"]').filter({ hasText: broj }).first().getAttribute("href");
    await go(t, href);
    if (await t.getByRole("button", { name: "Preuzmite u obradu" }).count()) { await t.getByRole("button", { name: "Preuzmite u obradu" }).click(); await t.waitForLoadState(WAIT); await t.waitForTimeout(1500); }
    await t.locator("details#izmena > summary").click();
    const form = t.locator("details#izmena");
    const qty = form.locator('input[aria-label^="Količina, 146958"]');
    await qty.fill("1,3");
    await form.locator("textarea").fill("Proba koraka 0,5 KOM za cediljke");
    await form.getByRole("button", { name: "Proverite cene" }).click();
    await t.waitForTimeout(2500);
    const bad = await txt(form);
    check("cediljke: kancelarija 1,3 KOM se odbija (korak 0,5)", /koracima od 0,5\./.test(bad), (bad.match(/Količina[^.]*\./) ?? [""])[0]);
    await qty.fill("1,5");
    await form.getByRole("button", { name: "Proverite cene" }).click();
    await form.getByRole("button", { name: /Pošaljite izmenjen predlog/ }).and(form.locator("button:not([disabled])")).waitFor({ timeout: 30000 });
    const okText = await txt(form);
    check("cediljke: kancelarija 1,5 KOM prolazi — „3 × paket 125 cediljki = 1,5 KOM“", /3 × paket 125 cediljki = 1,5 KOM/.test(okText), "");
    await form.getByRole("button", { name: /Pošaljite izmenjen predlog/ }).click();
    await t.waitForTimeout(2500); await t.waitForLoadState(WAIT);
    const [l1] = await sqlc`SELECT l.quantity::text q, l.pack_count n, l.pack_quantity::text pq FROM customer_order_lines l JOIN customer_orders o ON o.id = l.order_id WHERE o.request_number = ${broj + "/2"}`;
    check("cediljke: predlog upisan kao 1,5 KOM = 3 paketa", l1?.q === "1.500" && l1?.n === 3 && l1?.pq === "0.500", JSON.stringify(l1));
    await t.screenshot({ path: `${OUT}/cediljke-predlog.png`, fullPage: true });
    await go(k, "/kupac/porudzbine");
    const h2 = await k.locator("a", { hasText: /\/2/ }).first().getAttribute("href");
    await go(k, h2);
    const kv = await txt(k.locator("tr", { hasText: "146958" }).first());
    check("cediljke: kupac vidi „3 × paket 125 cediljki“ i „= 1,5 KOM“", /3 × paket 125 cediljki/.test(kv) && /= 1,5 KOM/.test(kv), kv.slice(0, 160));
    await k.screenshot({ path: `${OUT}/cediljke-kupac.png`, fullPage: true });
  }
  if (STEP === "b9") {
    // Kod za otključavanje sajta: tačan radi; posle 20 pogrešnih i tačan je odbijen dok traje blokada.
    const envText = readFileSync(process.env.SYNTH_ENV_FILE ?? process.env.HOME + "/.carsystem-secrets/revizija-sinteticki.env", "utf8");
    const code = envText.match(/^SITE_ACCESS_PASSWORD=(.*)$/m)[1];
    const post = async (value) => {
      const r = await fetch(`${B}/site-u-pripremi/access`, { method: "POST", body: new URLSearchParams({ accessCode: value }), redirect: "manual" });
      return r.headers.get("location") ?? "";
    };
    check("B9 kod sajta: tačan kod otključava", !/access=/.test(await post(code)));
    for (let i = 0; i < 21; i++) await post(`pogresno-${i}`);
    check("B9 kod sajta: posle 21 pogrešnog (prag 20) i tačan je privremeno odbijen", /access=invalid/.test(await post(code)));
    // Promena uređaja traži kod sa TRENUTNOG uređaja.
    const p = await (await b.newContext(desk)).newPage(); await staff(p, "petar");
    await p.goto(`${B}/portal/bezbednost/mfa`, { waitUntil: "load", timeout: 60000 });
    await p.waitForTimeout(1500);
    const forma = p.locator("form").filter({ has: p.locator('input[name="grant"], input[name="password"]') }).first();
    await forma.locator('input[name="password"]').fill(creds.petar.password);
    const polje = forma.locator('input[name="token"]');
    check("B9 promena uređaja: obrazac traži kod iz trenutne aplikacije", (await polje.count()) === 1);
    await polje.evaluate((el) => el.removeAttribute("required"));
    await forma.locator('button[type="submit"]').click();
    await p.locator("[role=alert]").first().waitFor({ timeout: 20000 });
    check("B9 promena uređaja: samo lozinka se odbija", !(await p.locator("text=/[A-Z2-7]{16,}/").count()), await txt(p.locator("[role=alert]").first()));
    // Novi rezervni kodovi: brojač pokušaja (5 za TOTP).
    const regen = p.locator("details.portal-mfa-regen");
    await regen.locator("summary").click();
    let poslednja = "";
    for (let i = 0; i < 6; i++) {
      await regen.locator('input[name="password"]').fill(creds.petar.password);
      await regen.locator('input[name="token"]').fill("000000");
      await regen.locator('button[type="submit"]').click();
      await p.waitForTimeout(1200);
      poslednja = await txt(regen.locator("[role=alert]").first()).catch(() => "");
    }
    check("B9 rezervni kodovi: posle 5 promašaja „Previše pokušaja“", /Previše pokušaja/.test(poslednja), poslednja);
    // Lozinka kupca: brojač kao prijava (10 po nalogu).
    const k = await (await b.newContext(desk)).newPage(); await customer(k);
    await k.goto(`${B}/kupac/bezbednost`, { waitUntil: "load", timeout: 60000 });
    let kp = "";
    for (let i = 0; i < 12; i++) {
      await k.fill('input[name="current"]', `pogresna-lozinka-${i}`);
      await k.fill('input[name="next"]', "nova-sinteticka-lozinka-1");
      await k.fill('input[name="confirm"]', "nova-sinteticka-lozinka-1");
      await k.getByRole("button", { name: "Promenite lozinku" }).click();
      await k.waitForTimeout(1200);
      kp = await txt(k.locator("[role=alert], .pn-error").first()).catch(() => "");
    }
    check("B9 lozinka kupca: posle 11 promašaja (prag 10) „Previše pokušaja“", /Previše pokušaja/.test(kp), kp);
  }
  if (STEP === "lager") {
    // Ručni uvoz lagera (dok. 65): sintetički izveštaji oba rasporeda kao BizniSoft izvoz.
    const XLSX = ROOT + "/fixtures/dev/biznisoft/lager/stanje-zaliha-sinteticki.xlsx";
    const XLSX_B = ROOT + "/fixtures/dev/biznisoft/lager/stanje-zaliha-artikla-sinteticki.xlsx";
    const pre = (await sqlc`SELECT count(*)::int n FROM stock_imports`)[0].n;
    const t = await (await b.newContext(desk)).newPage(); await staff(t, "kancelarija");
    await go(t, "/portal/zalihe/uvoz");
    check("lager: kancelarija vidi stranicu uvoza i korake", /Uvoz lagera/.test(await txt(t.locator("h1").first())) && (await t.locator(".lg-step").count()) === 3);
    check("lager: izbor fajla na srpskom, dugme isključeno dok fajl nije izabran", /Izaberite izvoz lagera/.test(await txt(t.locator(".lg-drop"))) && (await t.getByRole("button", { name: "Proverite fajl" }).isDisabled()));
    await t.screenshot({ path: `${OUT}/lager-0-uvoz.png`, fullPage: true });
    await t.setInputFiles('input[name="lager"]', XLSX_B);
    check("lager: izabran fajl se prikazuje imenom", /stanje-zaliha-artikla-sinteticki\.xlsx/.test(await txt(t.locator(".lg-drop"))));
    await Promise.all([t.waitForURL(/\/portal\/zalihe\/uvoz\/[0-9a-f-]{36}/, { timeout: 60000 }), t.getByRole("button", { name: "Proverite fajl" }).click()]);
    const body = await txt(t.locator("main"));
    check("lager provera (raspored B): spreman za potvrdu", /Provera je prošla/.test(body), body.slice(0, 300));
    check("lager provera: objekat, datum, stavke, potpunost", /021 VELEPRODAJA/.test(body) && /Stanje na dan 05[./] ?09[./] ?2026/.test(body) && /Stavki 10/.test(body) && /sve strane i zbir se slažu/.test(body));
    check("lager provera: bez cena", !/26\.?000|5\.?200|Nab\.Cena|VP Cena/.test(body));
    const top = await t.evaluate(() => { const h = document.querySelector("main h1"); const bar = document.querySelector(".portal-topbar"); return h && bar ? h.getBoundingClientRect().top - bar.getBoundingClientRect().bottom : -1; });
    check("lager provera: naslov nije ispod gornje trake", top >= 0, `razmak ${top}px`);
    await t.screenshot({ path: `${OUT}/lager-1-provera.png`, fullPage: true });
    await t.getByRole("checkbox", { name: /Pregledao sam proveru/ }).check();
    await t.getByRole("button", { name: "Potvrdite lager" }).click();
    await t.waitForURL(/ishod=potvrdjeno/, { timeout: 30000 });
    check("lager: potvrda → važeće stanje", /ovo je važeće stanje/.test(await txt(t.locator("main"))));
    await t.screenshot({ path: `${OUT}/lager-2-potvrdjeno.png`, fullPage: true });
    await go(t, "/portal/zalihe/uvoz");
    await t.setInputFiles('input[name="lager"]', XLSX_B);
    await Promise.all([t.waitForURL(/isti=1/, { timeout: 60000 }), t.getByRole("button", { name: "Proverite fajl" }).click()]);
    check("lager: isti fajl ponovo → postojeća provera, bez duplikata", (await sqlc`SELECT count(*)::int n FROM stock_imports`)[0].n === pre + 1);
    await go(t, "/portal/zalihe/uvoz");
    await t.setInputFiles('input[name="lager"]', XLSX);
    await Promise.all([t.waitForURL(/\/portal\/zalihe\/uvoz\/[0-9a-f-]{36}/, { timeout: 60000 }), t.getByRole("button", { name: "Proverite fajl" }).click()]);
    check("lager: raspored A istog sadržaja (drugi fajl) → postojeći snimak, bez drugog snimka", /Isti sadržaj/.test(await txt(t.locator("main"))) && /isti=sadrzaj/.test(t.url()), t.url());
    // PDF „Zbirni pregled po artiklima“ istog stanja: isti tok, isti sadržaj → postojeći snimak.
    await go(t, "/portal/zalihe/uvoz");
    check("lager: izbor fajla navodi PDF, XLSX i CSV", /PDF, XLSX ili CSV/.test(await txt(t.locator(".lg-drop"))));
    await t.setInputFiles('input[name="lager"]', ROOT + "/fixtures/dev/biznisoft/lager/zbirni-pregled-sinteticki.pdf");
    await Promise.all([t.waitForURL(/\/portal\/zalihe\/uvoz\/[0-9a-f-]{36}/, { timeout: 60000 }), t.getByRole("button", { name: "Proverite fajl" }).click()]);
    const pdfCount = (await sqlc`SELECT count(*)::int n FROM stock_imports WHERE status IN ('pregled', 'potvrdjeno') AND stock_date = '2026-09-05'`)[0].n;
    check("lager: PDF istog stanja prepoznat kao isti sadržaj; jedan važeći snimak", /isti=sadrzaj/.test(t.url()) && pdfCount === 1, `${t.url()} · ${pdfCount}`);
    // PDF „STANJE ZALIHA ARTIKLA“ (raspored stvarnog izvoza 16. 10.) istog stanja → isti sadržaj.
    await go(t, "/portal/zalihe/uvoz");
    await t.setInputFiles('input[name="lager"]', ROOT + "/fixtures/dev/biznisoft/lager/stanje-zaliha-artikla-sinteticki.pdf");
    await Promise.all([t.waitForURL(/\/portal\/zalihe\/uvoz\/[0-9a-f-]{36}/, { timeout: 60000 }), t.getByRole("button", { name: "Proverite fajl" }).click()]);
    check("lager: PDF „Stanje zaliha artikla“ istog stanja → isti sadržaj, bez drugog snimka", /isti=sadrzaj/.test(t.url()), t.url());
    // Šifre su tekst u tabeli: kanonska šifra iz šifarnika, vrednost iz fajla odvojeno.
    const codeCells = await t.locator("code.lg-code").allInnerTexts();
    check("lager: šifre prikazane kao tekst, bez separatora hiljada", codeCells.length > 0 && codeCells.every((c) => !/^\d{1,3}(\.\d{3})+$/.test(c)), codeCells.slice(0, 5).join(" "));
    await go(t, "/portal/zalihe/uvoz");
    await t.setInputFiles('input[name="lager"]', { name: "pogresan.csv", mimeType: "text/csv", buffer: Buffer.from("nije lager;1;2\n") });
    await Promise.all([t.waitForURL(/\/portal\/zalihe\/uvoz\/[0-9a-f-]{36}/, { timeout: 60000 }), t.getByRole("button", { name: "Proverite fajl" }).click()]);
    const bad = await txt(t.locator("main"));
    check("lager: pogrešan fajl → nije prošao proveru, bez dugmeta za potvrdu", /nije prošao proveru/.test(bad) && !(await t.getByRole("button", { name: "Potvrdite lager" }).count()));
    await t.screenshot({ path: `${OUT}/lager-3-greska.png`, fullPage: true });
    await go(t, "/portal/zalihe/uvoz");
    check("lager: istorija sa statusima", /Istorija uvoza/.test(await txt(t.locator("main"))) && /važeći/.test(await txt(t.locator(".lg-history"))));
    await t.screenshot({ path: `${OUT}/lager-4-istorija.png`, fullPage: true });
    check("lager: kancelarija ima „Uvoz lagera“ u meniju", (await t.locator('a[href="/portal/zalihe/uvoz"]').count()) > 0);
    const g = await (await b.newContext(desk)).newPage(); await staff(g, "vlasnik");
    await go(g, "/portal/zalihe");
    const zal = await txt(g.locator("main"));
    check("zalihe (vlasnik): važeći snimak i isključen prikaz kupcima", /Stanje na dan 05[./] ?09[./] ?2026/.test(zal) && /Prikaz isključen/i.test(zal), zal.slice(0, 300));
    // Telefon: stranice uvoza i provere bez horizontalnog pomeranja.
    const tm = await (await b.newContext(phone)).newPage(); await staff(tm, "kancelarija");
    for (const [name, path] of [["uvoz", "/portal/zalihe/uvoz"], ["provera", `/portal/zalihe/uvoz/${(await sqlc`SELECT id FROM stock_imports WHERE status = 'potvrdjeno' ORDER BY decided_at DESC LIMIT 1`)[0].id}`]]) {
      await go(tm, path);
      const sw = await tm.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(`lager ${name} na telefonu: bez horizontalnog pomeranja strane`, sw <= 1, `višak ${sw}px`);
      await tm.screenshot({ path: `${OUT}/lager-telefon-${name}.png`, fullPage: true });
    }
    const m = await (await b.newContext(desk)).newPage(); await staff(m, "magacin");
    const r = await m.goto(`${B}/portal/zalihe/uvoz`, { waitUntil: "load", timeout: 60000 });
    check("lager: magacioner nema pristup uvozu (403)", r?.status() === 403 || /nemate (pristup|dozvolu)|zabranjen/i.test(await txt(m.locator("body"))), String(r?.status()));
    const k = await (await b.newContext(desk)).newPage(); await customer(k);
    const rk = await k.goto(`${B}/portal/zalihe/uvoz`, { waitUntil: "load", timeout: 60000 });
    check("lager: kupac nema pristup uvozu", !/Uvoz lagera/.test(await txt(k.locator("body"))) && (rk?.status() !== 200 || new URL(k.url()).pathname !== "/portal/zalihe/uvoz"), `${rk?.status()} ${new URL(k.url()).pathname}`);
    const api = await k.evaluate(async () => (await fetch("/api/kupac/ponude", { cache: "no-store" })).json());
    check("kupac: ponude bez stanja dok je prikaz isključen", api.signedIn === true && (api.stock === null || api.stock === undefined), JSON.stringify(api.stock));
  }
  if (STEP === "lager-mfa") {
    // Potvrda lagera posle isteka potvrde drugog faktora (Production 15. 10. 2026): umesto
    // „Nemate dozvolu" — ponovna potvrda identiteta, povratak na isti uvoz, jedna odluka.
    const XLSX_B = ROOT + "/fixtures/dev/biznisoft/lager/stanje-zaliha-artikla-sinteticki.xlsx";
    const t = await (await b.newContext(desk)).newPage(); await staff(t, "kancelarija");
    const prijavljen = Date.now();
    await go(t, "/portal/zalihe/uvoz");
    await t.setInputFiles('input[name="lager"]', XLSX_B);
    await Promise.all([t.waitForURL(/\/portal\/zalihe\/uvoz\/[0-9a-f-]{36}/, { timeout: 60000 }), t.getByRole("button", { name: "Proverite fajl" }).click()]);
    const id = new URL(t.url()).pathname.split("/").pop();
    check("lager-mfa: sveža prijava — bez upozorenja o potvrdi identiteta", !(await t.locator(".lg-reauth").count()));
    // Stvarno isticanje: 10 minuta od prijave (bez prečica u kodu ili satu).
    const ceka = prijavljen + 10 * 60_000 + 20_000 - Date.now();
    log("čekam istek potvrde (s)", String(Math.round(ceka / 1000)));
    await new Promise((r) => setTimeout(r, Math.max(0, ceka)));
    await go(t, `/portal/zalihe/uvoz/${id}`);
    check("lager-mfa: istekla potvrda — upozorenje i veza „Potvrdite identitet“", /Pre odluke ponovo potvrdite identitet/.test(await txt(t.locator("main"))) && (await t.getByRole("link", { name: "Potvrdite identitet" }).count()) === 1);
    await t.screenshot({ path: `${OUT}/lager-mfa-1-istekla.png`, fullPage: true });
    // Druga kartica drži isti obrazac — kasnije služi kao ponovljen klik.
    const stara = await t.context().newPage();
    await go(stara, `/portal/zalihe/uvoz/${id}`);
    await t.getByRole("checkbox", { name: /Pregledao sam proveru/ }).check();
    await Promise.all([t.waitForURL(/\/prijava\?/, { timeout: 30000 }), t.getByRole("button", { name: "Potvrdite lager" }).click()]);
    const u = new URL(t.url());
    const prijava = await txt(t.locator("main"));
    check("lager-mfa: potvrda sa isteklom MFA → ponovna potvrda identiteta, ne zabrana", u.searchParams.get("potvrda") === "identitet" && /Potvrdite identitet/.test(prijava) && !/Nemate dozvolu/.test(prijava), t.url());
    check("lager-mfa: povratak je isti uvoz", u.searchParams.get("callbackUrl") === `/portal/zalihe/uvoz/${id}?identitet=potvrdjen`);
    check("lager-mfa: e-pošta popunjena i zaključana", (await t.inputValue("input[name=email]")) === creds.kancelarija.email && (await t.locator("input[name=email]").getAttribute("readonly")) !== null);
    check("lager-mfa: ništa nije odlučeno pre ponovne potvrde", (await sqlc`SELECT status::text s FROM stock_imports WHERE id = ${id}`)[0].s === "pregled");
    await t.screenshot({ path: `${OUT}/lager-mfa-2-potvrda-identiteta.png`, fullPage: true });
    while (last.kancelarija === Math.floor(Date.now() / 30000) || Date.now() % 30000 > 25000) await new Promise((r) => setTimeout(r, 1000));
    last.kancelarija = Math.floor(Date.now() / 30000);
    await t.fill("input[name=password]", creds.kancelarija.password);
    await t.fill("input[name=secondFactor]", totp(creds.kancelarija.totpBase32));
    await Promise.all([t.waitForURL(/\/portal\/zalihe\/uvoz\/[0-9a-f-]{36}\?identitet=potvrdjen/, { timeout: 30000 }), t.getByRole("button", { name: "Potvrdite i nastavite" }).click()]);
    const nazad = await txt(t.locator("main"));
    check("lager-mfa: posle potvrde identiteta — isti uvoz, jasna poruka, bez upozorenja", new URL(t.url()).pathname === `/portal/zalihe/uvoz/${id}` && /Identitet je potvrđen/.test(nazad) && !(await t.locator(".lg-reauth").count()));
    await t.getByRole("checkbox", { name: /Pregledao sam proveru/ }).check();
    await Promise.all([t.waitForURL(/ishod=potvrdjeno/, { timeout: 30000 }), t.getByRole("button", { name: "Potvrdite lager" }).click()]);
    check("lager-mfa: potvrda uspela — važeće stanje", /ovo je važeće stanje/.test(await txt(t.locator("main"))));
    const prvi = (await sqlc`SELECT decided_at, decided_by FROM stock_imports WHERE id = ${id}`)[0];
    await t.screenshot({ path: `${OUT}/lager-mfa-3-potvrdjeno.png`, fullPage: true });
    // Ponovljen klik: stari obrazac iz druge kartice (sesija je sada sveža).
    await stara.getByRole("checkbox", { name: /Pregledao sam proveru/ }).check();
    await Promise.all([stara.waitForURL(/ishod=vec-odluceno/, { timeout: 30000 }), stara.getByRole("button", { name: "Potvrdite lager" }).click()]);
    const drugi = (await sqlc`SELECT decided_at, decided_by FROM stock_imports WHERE id = ${id}`)[0];
    const audit = (await sqlc`SELECT count(*)::int n FROM audit_log WHERE entity_type = 'Lager' AND entity_id = ${id} AND action ILIKE '%potvr%'`)[0].n;
    check("lager-mfa: ponovljen klik — poruka o već zapisanoj odluci, bez promene i bez duplikata", /već odlučeno/.test(await txt(stara.locator("main"))) && +drugi.decided_at === +prvi.decided_at && audit === 1, `audit potvrda ${audit}`);
    const r = await t.goto(`${B}/portal/zalihe/uvoz/${id}`, { waitUntil: WAIT, timeout: 60000 });
    check("lager-mfa: detalj posle potvrde se otvara (200)", r?.status() === 200 && /Potvrđeno/.test(await txt(t.locator("main"))), String(r?.status()));
    const pon = await t.goto(`${B}/prijava?callbackUrl=${encodeURIComponent(`/portal/zalihe/uvoz/${id}`)}&potvrda=identitet`, { waitUntil: WAIT, timeout: 60000 });
    check("lager-mfa: sveža potvrda — prijava odmah vraća na uvoz", new URL(t.url()).pathname === `/portal/zalihe/uvoz/${id}`, `${pon?.status()} ${t.url()}`);
    const k = await (await b.newContext(desk)).newPage(); await customer(k);
    const api = await k.evaluate(async () => (await fetch("/api/kupac/ponude", { cache: "no-store" })).json());
    check("lager-mfa: kupac i dalje bez stanja", api.signedIn === true && (api.stock === null || api.stock === undefined));
  }
  if (STEP === "lager-kupci") {
    // Lager prijavljenim kupcima (dok. 65 §4) — server MORA raditi sa MAINTENANCE_MODE=true:
    // kupac bez koda sajta vidi katalog; neprijavljen posetilac i API ne dobijaju ništa.
    const XLSX_B = ROOT + "/fixtures/dev/biznisoft/lager/stanje-zaliha-artikla-sinteticki.xlsx";
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Belgrade" }).format(new Date());
    const dmyToday = `${today.slice(8, 10)}.${today.slice(5, 7)}.${today.slice(0, 4)}`;
    const csv = new TextDecoder("windows-1250").decode(readFileSync(ROOT + "/fixtures/dev/biznisoft/lager/stanje-zaliha-sinteticki.csv"));
    const todayCsv = Buffer.from(Uint8Array.from(csv.replace(/(Na dan:;+)05\.09\.2026/, `$1${dmyToday}`).replace("Datum štampe: 05.09.2026", `Datum štampe: ${dmyToday}`), (ch) => {
      const m = { "Š": 0x8a, "š": 0x9a, "Č": 0xc8, "č": 0xe8, "Ć": 0xc6, "ć": 0xe6, "Ž": 0x8e, "ž": 0x9e, "Đ": 0xd0, "đ": 0xf0 }[ch];
      return m ?? ch.charCodeAt(0);
    }));
    const anon = await (await b.newContext(desk)).newPage();
    const ra = await anon.goto(`${B}/proizvodi/baslac-70-10-silicone-remover-for-oil-silicone-and-grease`, { waitUntil: "load", timeout: 120000 });
    check("lager-kupci: neprijavljen posetilac i dalje ide na „sajt u pripremi“", new URL(anon.url()).pathname === "/site-u-pripremi", `${ra?.status()} ${new URL(anon.url()).pathname}`);
    const apiAnon = await anon.request.get(`${B}/api/kupac/ponude`);
    const apiAnonBody = await apiAnon.text();
    check("lager-kupci: API bez sesije → 401, bez stanja i ponuda", apiAnon.status() === 401 && !/stock|offers|Na stanju/.test(apiAnonBody), `${apiAnon.status()} ${apiAnonBody.slice(0, 80)}`);

    // Kancelarija: snimak 05.09. (zastareo), vlasnik uključuje prikaz.
    const t = await (await b.newContext(desk)).newPage(); await staff(t, "kancelarija");
    await go(t, "/portal/zalihe/uvoz");
    await t.setInputFiles('input[name="lager"]', XLSX_B);
    await Promise.all([t.waitForURL(/\/portal\/zalihe\/uvoz\/[0-9a-f-]{36}/, { timeout: 60000 }), t.getByRole("button", { name: "Proverite fajl" }).click()]);
    await t.getByRole("checkbox", { name: /Pregledao sam proveru/ }).check();
    await Promise.all([t.waitForURL(/ishod=potvrdjeno/, { timeout: 30000 }), t.getByRole("button", { name: "Potvrdite lager" }).click()]);
    const g = await (await b.newContext(desk)).newPage(); await staff(g, "vlasnik");
    await go(g, "/portal/zalihe");
    check("lager-kupci: vlasnik vidi prikaz isključen i dugme za uključivanje", /Prikaz isključen/i.test((await txt(g.locator("main"))).replace(/\s+/g, " ")) || (await g.getByRole("button", { name: "Uključite prikaz kupcima" }).count()) === 1);
    await g.fill('input[name="razlog"]', "sintetička proba prikaza");
    await g.getByRole("button", { name: "Uključite prikaz kupcima" }).click();
    await g.locator('.lg-toggle [role="status"]').waitFor({ timeout: 30000 });
    const set = (await sqlc`SELECT value FROM system_settings WHERE key = 'stock.customerDisplay'`)[0]?.value;
    const aud = (await sqlc`SELECT count(*)::int n FROM audit_log WHERE action = 'Prikaz lagera kupcima'`)[0].n;
    check("lager-kupci: uključeno (24 h) sa audit zapisom", set?.enabled === true && set?.maxAgeHours === 24 && aud === 1, JSON.stringify(set));
    await g.screenshot({ path: `${OUT}/lager-kupci-0-zalihe-vlasnik.png`, fullPage: true });

    const kctx = await b.newContext(desk);
    const k = await kctx.newPage();
    await go(k, `/prijava/kupac?callbackUrl=${encodeURIComponent("/proizvodi/baslac-70-10-silicone-remover-for-oil-silicone-and-grease")}`);
    await k.fill("input[name=email]", creds.kupac.email);
    await k.fill("input[name=password]", creds.kupac.password);
    await Promise.all([k.waitForURL((u) => !u.pathname.startsWith("/prijava"), { timeout: 60000 }), k.keyboard.press("Enter")]);
    check("lager-kupci: kupac posle prijave ostaje na strani proizvoda, bez koda sajta", new URL(k.url()).pathname === "/proizvodi/baslac-70-10-silicone-remover-for-oil-silicone-and-grease", k.url());
    const panel = k.locator('section[aria-labelledby="buy-panel-title"]');
    await panel.waitFor({ timeout: 60000 });
    await k.locator('section[aria-label="Stanje na lageru"]').waitFor({ timeout: 30000 });
    const stale = await txt(k.locator('section[aria-label="Stanje na lageru"]'));
    check("lager-kupci: zastareo snimak → „potrebna je provera“, bez brojeva", /Potrebna je provera raspoloživosti/.test(stale) && !/Na stanju prema izvozu/.test(stale) && /Raspoloživost potvrđuje kancelarija/.test(stale), stale);

    // Današnji izvoz (samo datum) → svež. Dodatni sintetički redovi pokrivaju nulu, minus i ostatak.
    await go(t, "/portal/zalihe/uvoz");
    await t.setInputFiles('input[name="lager"]', { name: "danas.csv", mimeType: "text/csv", buffer: todayCsv });
    await Promise.all([t.waitForURL(/\/portal\/zalihe\/uvoz\/[0-9a-f-]{36}/, { timeout: 60000 }), t.getByRole("button", { name: "Proverite fajl" }).click()]);
    const todayId = new URL(t.url()).pathname.split("/").pop();
    await sqlc`INSERT INTO stock_import_lines (import_id, line_no, source_row, source_code, code_key, name, quantity) VALUES
      (${todayId}, 901, 901, 'SINT-C03', 'SINT-C03', 'SINT ANTISILIKON 1L', 3),
      (${todayId}, 902, 902, 'SINT-C04', 'SINT-C04', 'SINT ANTISILIKON 5L', 12.5),
      (${todayId}, 903, 903, 'SINT-C07', 'SINT-C07', 'SINT HERTER NORMAL 0,5L', 0),
      (${todayId}, 904, 904, 'SINT-C06', 'SINT-C06', 'SINT LAK VOC 4L', -2)`;
    await t.reload({ waitUntil: WAIT });
    await t.getByRole("checkbox", { name: /Pregledao sam proveru/ }).check();
    await Promise.all([t.waitForURL(/ishod=potvrdjeno/, { timeout: 30000 }), t.getByRole("button", { name: "Potvrdite lager" }).click()]);
    // Pravilo čuvanja: dva potvrđena snimka zadržavaju stavke.
    const kept = (await sqlc`SELECT count(*)::int n FROM stock_imports WHERE status = 'potvrdjeno' AND lines_purged_at IS NULL`)[0].n;
    check("lager-kupci: oba potvrđena snimka zadržavaju stavke (pravilo čuvanja)", kept === 2, String(kept));

    const kp = await kctx.newPage();
    await kp.goto(`${B}/proizvodi/baslac-70-10-silicone-remover-for-oil-silicone-and-grease`, { waitUntil: WAIT, timeout: 120000 });
    await kp.locator('section[aria-label="Stanje na lageru"]').waitFor({ timeout: 30000 });
    const fresh = await txt(kp.locator('section[aria-label="Stanje na lageru"]'));
    check("lager-kupci: svež snimak — 3 × limenka 1 L i 2 × kanta 5 L (12,5 L naniže)", /Na stanju prema izvozu: 3 × limenka 1 L/.test(fresh) && /Na stanju prema izvozu: 2 × kanta 5 L/.test(fresh), fresh);
    check("lager-kupci: datum stanja bez vremena uvoza; napomena kancelarije", fresh.includes(`na dan ${dmyToday}.`) && /Raspoloživost potvrđuje kancelarija/.test(fresh) && !/Uvezeno/.test(fresh), fresh);
    await kp.screenshot({ path: `${OUT}/lager-kupci-1-proizvod.png`, fullPage: true });
    const api = await kp.evaluate(async () => (await fetch("/api/kupac/ponude", { cache: "no-store" })).json());
    const offerBy = Object.fromEntries(api.offers.map((o) => [o.articleCode, o.articleId]));
    const line = (code) => api.stock?.byArticle?.[offerBy[code]];
    check("lager-kupci: nula → „nema na stanju“, bez broja", line("SINT-C07")?.state === "nema" && !/\d/.test(line("SINT-C07")?.text ?? "x"), JSON.stringify(line("SINT-C07")));
    check("lager-kupci: negativno stanje → „Raspoloživost na upit“ (bez minusa)", line("SINT-C06")?.state === "upit" && !Object.values(api.stock.byArticle).some((v) => /-\s*\d/.test(v.text)), JSON.stringify(line("SINT-C06")));
    check("lager-kupci: šifra van izvoza → „na upit“, ne nula", line("SINT-C05")?.state === "upit", JSON.stringify(line("SINT-C05")));
    check("lager-kupci: 900001 (1 kom) → 12 kom", line("900001")?.text === "Na stanju prema izvozu: 12 kom", JSON.stringify(line("900001")));
    check("lager-kupci: API kupcu bez izvornih količina, nabavnih cena i internih naziva lagera", !/quantity|Nab|1000|SINT STARA|codeKey|sourceCode/.test(JSON.stringify(api.stock)));
    // Telefon: blok stanja bez horizontalnog pomeranja.
    const tm = await (await b.newContext(phone)).newPage();
    await go(tm, `/prijava/kupac?callbackUrl=${encodeURIComponent("/proizvodi/baslac-70-10-silicone-remover-for-oil-silicone-and-grease")}`);
    await tm.fill("input[name=email]", creds.kupac.email);
    await tm.fill("input[name=password]", creds.kupac.password);
    await Promise.all([tm.waitForURL((u) => !u.pathname.startsWith("/prijava"), { timeout: 60000 }), tm.keyboard.press("Enter")]);
    await tm.locator('section[aria-label="Stanje na lageru"]').waitFor({ timeout: 30000 });
    await tm.locator('section[aria-label="Stanje na lageru"]').scrollIntoViewIfNeeded();
    const sw = await tm.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check("lager-kupci telefon: bez horizontalnog pomeranja", sw <= 1, `višak ${sw}px`);
    await tm.screenshot({ path: `${OUT}/lager-kupci-2-telefon.png`, fullPage: false });
    // Isključivanje: vlasnik jednim klikom; kupac više ne vidi stanje.
    await go(g, "/portal/zalihe");
    await g.fill('input[name="razlog"]', "sintetička proba isključivanja");
    await g.getByRole("button", { name: "Isključite prikaz kupcima" }).click();
    await g.locator('.lg-toggle [role="status"]').waitFor({ timeout: 30000 });
    const off = await kp.evaluate(async () => (await fetch("/api/kupac/ponude", { cache: "no-store" })).json());
    check("lager-kupci: posle isključivanja kupac nema stanje", off.signedIn === true && off.stock === null, JSON.stringify(off.stock));
    // Ulazi za prijavu: vidljivi tokom održavanja, na računaru i telefonu; prijavljen → „Moj nalog“ / „Poslovni portal“.
    for (const [label, ctxOpts] of [["računar", desk], ["telefon", phone]]) {
      const p = await (await b.newContext(ctxOpts)).newPage();
      await go(p, "/site-u-pripremi");
      const nav = p.getByRole("navigation", { name: "Prijava" });
      const ok = (await nav.getByRole("link", { name: "Prijava kupca" }).isVisible()) && (await nav.getByRole("link", { name: "Za zaposlene" }).isVisible());
      const hrefs = [await nav.getByRole("link", { name: "Prijava kupca" }).getAttribute("href"), await nav.getByRole("link", { name: "Za zaposlene" }).getAttribute("href")];
      check(`prijava (${label}): „Prijava kupca“ i „Za zaposlene“ na strani „sajt u pripremi“`, ok && hrefs[0]?.startsWith("/prijava/kupac") && hrefs[1] === "/prijava", hrefs.join(" "));
      await p.screenshot({ path: `${OUT}/prijava-traka-${label}.png` });
    }
    const signedNav = await kp.getByRole("navigation", { name: "Prijava" }).innerText();
    check("prijava: prijavljen kupac vidi „Moj nalog“ u traci", /Moj nalog/.test(signedNav) && !/Prijava kupca/.test(signedNav), signedNav);
    await go(g, "/site-u-pripremi");
    const staffNav = await g.getByRole("navigation", { name: "Prijava" }).innerText().catch(() => "");
    check("prijava: prijavljen zaposleni vidi „Poslovni portal“", /Poslovni portal/.test(staffNav) && !/Za zaposlene/.test(staffNav), staffNav);
  }
} catch (e) {
  check("skripta", false, String(e.message).split("\n").slice(0, 3).join(" | "));
  for (const ctx of b.contexts()) for (const pg of ctx.pages()) await pg.screenshot({ path: `${OUT}/greska-${Date.now()}.png`, fullPage: true }).catch(() => {});
} finally {
  console.log(`UKUPNO: ${results.filter((r) => r.ok).length}/${results.length}`);
  await b.close(); await sqlc.end();
}
