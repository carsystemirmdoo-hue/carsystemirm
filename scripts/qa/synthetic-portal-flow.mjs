/**
 * Ceo tok portala u pregledaču nad SINTETIČKOM bazom (revizija 57).
 *
 * Priprema: scripts/qa/seed-synthetic-portal.mts u bazu carsystem_revizija_ui_qa,
 * server iz .next-verify na 127.0.0.1:3450 (DATABASE_POOL_MAX=1 — najstrožije).
 *   node scripts/qa/synthetic-portal-flow.mjs <izlazni-folder> [sve|kupac|kancelarija|opseg|telefon]
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
const B = "http://127.0.0.1:3450";
const sqlc = postgres("postgres://carsystem_qa@127.0.0.1:55436/carsystem_revizija_ui_qa", { max: 1, onnotice: () => {} });
const desk = { viewport: { width: 1440, height: 1000 } };
const phone = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
const totp = (b32) => new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(b32), digits: 6, period: 30, algorithm: "SHA1" }).generate();
const results = [];
const log = (k, v) => console.log(`${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`);
const check = (name, ok, detail = "") => { results.push({ name, ok }); console.log(`${ok ? "PROLAZ" : "PAD   "} ${name}${detail ? " :: " + detail : ""}`); };
const txt = async (loc) => (await loc.innerText()).replace(/\s+/g, " ").trim();
const last = {};
const go = (p, path) => p.goto(`${B}${path}`, { waitUntil: "networkidle", timeout: 120000 });
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
  await k.waitForLoadState("networkidle");
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
  await page.waitForLoadState("networkidle"); await page.waitForTimeout(1500);
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
    await k.reload({ waitUntil: "networkidle" });
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
    await k.waitForLoadState("networkidle");
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
      await t.waitForLoadState("networkidle"); await t.waitForTimeout(1500);
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
    await t.waitForTimeout(2500); await t.waitForLoadState("networkidle");
    const nastao = (await sqlc`SELECT count(*)::int n FROM customer_orders WHERE status = 'awaiting_customer'`)[0].n;
    check("kancelarija: izmenjen predlog poslat kupcu", nastao === 1, `${nastao} predlog čeka kupca`);
    await t.screenshot({ path: `${OUT}/t2b-predlog.png`, fullPage: true });
    // Kupac prihvata
    const k = await (await b.newContext(desk)).newPage(); await customer(k);
    await go(k, "/kupac/porudzbine");
    const h2 = await k.locator("a", { hasText: /\/2/ }).first().getAttribute("href");
    await go(k, h2);
    await k.getByRole("button", { name: "Potvrdite predlog" }).click();
    await k.waitForLoadState("networkidle"); await k.waitForTimeout(1500);
    await k.screenshot({ path: `${OUT}/k5-prihvaceno.png`, fullPage: true });
    // Kancelarija: preuzmi, potvrdi, broj iz BizniSofta
    await go(t, "/portal/zahtevi");
    const h3 = await t.locator('a[href^="/portal/zahtevi/"]').filter({ hasText: /\/2/ }).first().getAttribute("href");
    await go(t, h3);
    if (await t.getByRole("button", { name: "Preuzmite u obradu" }).count()) {
      await t.getByRole("button", { name: "Preuzmite u obradu" }).click(); await t.waitForLoadState("networkidle"); await t.waitForTimeout(1500);
    }
    await confirmDialog(t, "Potvrdite porudžbinu…");
    const posle = await txt(t.locator("main"));
    check("kancelarija: porudžbina potvrđena, dodeljen broj P-", /P-\d{4}-\d+/.test(posle), posle.match(/P-\d{4}-\d+/)?.[0] ?? posle.slice(0, 120));
    const bs = t.locator('input[id^="bs-"]');
    if (await bs.count()) {
      await bs.fill("SINT-PRED-0001");
      await bs.locator("xpath=ancestor::form").getByRole("button").last().click();
      await t.waitForLoadState("networkidle"); await t.waitForTimeout(1500);
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
    await k.waitForLoadState("networkidle");
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
    await t.waitForLoadState("networkidle");
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
    check("B5: bez filtera sve 3 firme", (await rows()).length === 3, (await rows()).join(" | "));
    await g.locator('select[name="komercijalista"]').selectOption({ label: "SINT Petar Komercijalista" });
    await g.locator("form.portal-inline-form button[type=submit]").click();
    await g.waitForURL((u) => u.searchParams.has("komercijalista"), { timeout: 30000 });
    await g.waitForLoadState("networkidle");
    check("B5: filter Petar → samo firma A", JSON.stringify(await rows()) === JSON.stringify(["SINT Auto Lak d.o.o."]), (await rows()).join(" | "));
    await g.reload({ waitUntil: "networkidle" });
    check("B5: filter preživljava osvežavanje", (await rows()).length === 1 && (await g.locator('select[name="komercijalista"]').inputValue()) === creds.ids.petar);
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
    check("B5: komercijalista nema filter po komercijalisti i vidi samo svoje", (await p.locator('select[name="komercijalista"]').count()) === 0 && (await p.locator("table.portal-table tbody th[scope=row] a").count()) === 1);
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
    await g.reload({ waitUntil: "networkidle" });
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
    await k.waitForLoadState("networkidle"); await k.waitForTimeout(2000);
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
    check("upit: panel „Za Vašu firmu“ bez cene, sa formom upita", /SINT Auto Lak/i.test(pt) && /Zatražite cenu\/uslove/i.test(pt) && !/RSD \//.test(pt), pt.slice(0, 140));
    await panel.locator('input[type="number"]').fill("12");
    await panel.locator('input[type="text"]').fill("Sintetička provera — mesečna potrošnja");
    await panel.getByRole("button", { name: "Zatražite cenu/uslove" }).click();
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
    check("upit: kancelarija vidi „Upit za cenu“ sa brojem i vezom", /Upit za cenu/.test(ob) && ob.includes(broj) && (await t.locator('a[href="/portal/zahtevi/uslovi"]').count()) > 0);
    await t.screenshot({ path: `${OUT}/p2-obavestenje-upit.png`, fullPage: true });
    await go(t, "/portal/zahtevi/uslovi");
    const red = t.locator("tr, li, article").filter({ hasText: broj }).first();
    if (await red.getByRole("button", { name: /Preuzmite/ }).count()) {
      await red.getByRole("button", { name: /Preuzmite/ }).click();
      await t.waitForLoadState("networkidle"); await t.waitForTimeout(1500);
    }
    const red2 = t.locator("tr, li, article").filter({ hasText: broj }).first();
    await red2.locator("textarea").fill("Sintetički odgovor: cena 1.234,00 bez PDV-a; javite se za količinu.");
    await red2.getByRole("button", { name: /Pošaljite|Odgovorite|Sačuvajte/ }).first().click();
    await t.waitForLoadState("networkidle"); await t.waitForTimeout(1500);
    const st = (await sqlc`SELECT status::text AS s, answer IS NOT NULL AS a FROM customer_price_requests WHERE request_number = ${broj}`)[0];
    check("upit: kancelarija je odgovorila (status i odgovor u bazi)", Boolean(st?.a), JSON.stringify(st));
    await go(k, "/kupac/upiti");
    check("upit: kupac vidi odgovor u „Upiti“", /Sintetički odgovor/.test(await txt(k.locator("main"))));
    const p = await (await b.newContext(desk)).newPage(); await staff(p, "petar");
    await go(p, "/portal/obavestenja");
    check("upit: komercijalista ne dobija obaveštenje (vidljivost po sposobnosti)", !(await txt(p.locator("main"))).includes(broj));
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
} catch (e) {
  check("skripta", false, String(e.message).split("\n").slice(0, 3).join(" | "));
  for (const ctx of b.contexts()) for (const pg of ctx.pages()) await pg.screenshot({ path: `${OUT}/greska-${Date.now()}.png`, fullPage: true }).catch(() => {});
} finally {
  console.log(`UKUPNO: ${results.filter((r) => r.ok).length}/${results.length}`);
  await b.close(); await sqlc.end();
}
