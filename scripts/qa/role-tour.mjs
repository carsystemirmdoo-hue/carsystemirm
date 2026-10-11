/**
 * Pregled portala „kao da sam ta uloga“ nad SINTETIČKOM bazom (docs/b2b/60).
 *
 *   node scripts/qa/role-tour.mjs galerija <izlazni-folder>
 *     Za svaku ulogu: prijava, početna strana, meni, pa svaka strana portala
 *     redom sa stvarnim odgovorom servera (200 / 403 / preusmerenje) i snimkom.
 *     Pravi <izlazni-folder>/index.html i matrica.json.
 *
 *   node scripts/qa/role-tour.mjs otvori <vlasnik|kancelarija|petar|milan|jovan|magacin|kupac>
 *     Otvara VIDLJIV prozor već prijavljen kao ta uloga; zatvorite prozor kad završite.
 *
 * Server: sintetička baza (scripts/qa/seed-synthetic-portal.mts) na 127.0.0.1:3450.
 * Lozinke i TOTP tajne čita iz SYNTH_CREDS_FILE i NIGDE ih ne ispisuje.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const ROOT = new URL("../../", import.meta.url).pathname;
const { chromium } = await import(ROOT + "node_modules/playwright-core/index.mjs");
const OTPAuth = await import(ROOT + "node_modules/otpauth/dist/otpauth.esm.js");
const creds = JSON.parse(readFileSync(process.env.SYNTH_CREDS_FILE ?? process.env.HOME + "/.carsystem-secrets/revizija-sinteticki.json", "utf8"));
const B = process.env.SYNTH_BASE_URL ?? "http://127.0.0.1:3450";
const [mode, arg] = process.argv.slice(2);

const ROLES = [
  ["vlasnik", "Vlasnik (gazda)"],
  ["kancelarija", "Kancelarija"],
  ["petar", "Komercijalista + predlog rabata (dodeljen firmi A)"],
  ["milan", "Komercijalista + analitika + predlog rabata (vidi sve kupce)"],
  ["jovan", "Komercijalista + nalozi kupaca (dodeljen firmi B)"],
  ["magacin", "Magacioner"],
  ["kupac", "Kupac (firma A, proba poručivanja)"],
];

/** Sve strane portala koje imaju smisla otvoriti (bez [id] i preusmerenja). */
const PORTAL_PAGES = [
  "/portal", "/portal/analitika", "/portal/kupci", "/portal/kupci/partneri", "/portal/kupci/mapiranja", "/portal/kupci/nalozi",
  "/portal/kupci/bez-dodele", "/portal/kupci/kontakti", "/portal/kupci/veze", "/portal/prodaja", "/portal/povrati", "/portal/zahtevi",
  "/portal/zahtevi/uslovi", "/portal/za-razgovor", "/portal/preporuke", "/portal/cene", "/portal/cene/pravila", "/portal/cene/odobravanje",
  "/portal/cene/istorija", "/portal/cene/rabati-iz-faktura", "/portal/cene/rabati-iz-faktura/predlozi", "/portal/cene/cenovnik",
  "/portal/dugovanja", "/portal/limiti", "/portal/zalihe", "/portal/nabavka", "/portal/proizvodi/mapiranja", "/portal/porudzbine",
  "/portal/otprema", "/portal/adresnice", "/portal/bex", "/portal/obavestenja", "/portal/izvestaji", "/portal/importi",
  "/portal/importi/dokumenti", "/portal/importi/spremnost", "/portal/importi/sinhronizacija", "/portal/dozvole", "/portal/admin",
  "/portal/aktivnosti", "/portal/bezbednost/lozinka", "/portal/bezbednost/mfa", "/portal/bezbednost/nalozi", "/portal/korpa",
];
const CUSTOMER_PAGES = ["/kupac", "/kupac/fakture", "/kupac/naruci", "/kupac/korpa", "/kupac/porudzbine", "/kupac/upiti", "/kupac/saglasnosti", "/kupac/bezbednost", "/portal"];

const totp = (b32) => new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(b32), digits: 6, period: 30, algorithm: "SHA1" }).generate();
const used = {};

async function login(page, who) {
  if (who === "kupac") {
    await page.goto(`${B}/prijava/kupac`, { waitUntil: "load" });
    await page.fill("input[name=email]", creds.kupac.email);
    await page.fill("input[name=password]", creds.kupac.password);
    await page.keyboard.press("Enter");
    await page.waitForURL((u) => !u.pathname.startsWith("/prijava"), { timeout: 30000 });
    return;
  }
  const c = creds[who];
  if (!c) throw new Error(`Nepoznata uloga u sintetičkoj pripremi: ${who}`);
  for (let attempt = 0; attempt < 3; attempt++) {
    // Isti kod se ne prima dvaput u istom 30 s prozoru (i posle pripreme baze).
    while (used[who] === Math.floor(Date.now() / 30000) || Date.now() % 30000 > 25000) await new Promise((r) => setTimeout(r, 500));
    used[who] = Math.floor(Date.now() / 30000);
    await page.goto(`${B}/prijava`, { waitUntil: "load" });
    await page.fill("input[name=email]", c.email);
    await page.fill("input[name=password]", c.password);
    await page.fill("input[name=secondFactor]", totp(c.totpBase32));
    await page.keyboard.press("Enter");
    try {
      await page.waitForURL((u) => !u.pathname.startsWith("/prijava"), { timeout: 20000 });
      return;
    } catch {
      /* sledeći prozor */
    }
  }
  throw new Error(`Prijava ${who} nije uspela.`);
}

const browser = await chromium.launch({ channel: "chrome", headless: mode !== "otvori" }).catch(() => chromium.launch({ headless: mode !== "otvori" }));

if (mode === "otvori") {
  if (!ROLES.some(([k]) => k === arg)) {
    console.error(`Uloga: ${ROLES.map(([k]) => k).join(" | ")}`);
    process.exit(1);
  }
  const page = await (await browser.newContext({ viewport: null })).newPage();
  await login(page, arg);
  console.log(`Prijavljeni ste kao: ${ROLES.find(([k]) => k === arg)[1]}. Zatvorite prozor kad završite.`);
  await new Promise((r) => browser.on("disconnected", r));
  process.exit(0);
}

if (mode !== "galerija" || !arg) {
  console.error("Upotreba: galerija <folder> | otvori <uloga>");
  process.exit(1);
}

const OUT = arg;
mkdirSync(OUT, { recursive: true });
const matrix = {};
const sections = [];
for (const [who, label] of ROLES) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await login(page, who);
  const landing = new URL(page.url()).pathname;
  const menu = who === "kupac"
    ? await page.locator("nav a").allInnerTexts().catch(() => [])
    : await page.locator(".portal-sidebar nav a, aside nav a").allInnerTexts().catch(() => []);
  const rows = [];
  for (const path of who === "kupac" ? CUSTOMER_PAGES : PORTAL_PAGES) {
    const res = await page.goto(`${B}${path}`, { waitUntil: "load", timeout: 60000 }).catch(() => null);
    const status = res ? res.status() : 0;
    const final = new URL(page.url()).pathname;
    const outcome = status === 403 ? "403" : status === 404 ? "404" : final !== path ? `→ ${final}` : String(status);
    const file = `${who}${path.replace(/\//g, "_")}.png`;
    if (outcome === "200") await page.screenshot({ path: `${OUT}/${file}` }).catch(() => {});
    rows.push({ path, outcome, file: outcome === "200" ? file : null });
  }
  matrix[who] = Object.fromEntries(rows.map((r) => [r.path, r.outcome]));
  sections.push({ who, label, landing, menu: menu.map((m) => m.replace(/\s+/g, " ").trim()).filter(Boolean), rows });
  console.log(`${label}: početna ${landing}; dostupno ${rows.filter((r) => r.outcome === "200").length}/${rows.length}`);
  await ctx.close();
}
writeFileSync(`${OUT}/matrica.json`, JSON.stringify(matrix, null, 1));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const pages = [...new Set(Object.values(matrix).flatMap((m) => Object.keys(m)))];
const head = `<tr><th>Strana</th>${ROLES.map(([k]) => `<th>${esc(k)}</th>`).join("")}</tr>`;
const body = pages.map((p) => `<tr><td>${esc(p)}</td>${ROLES.map(([k]) => {
  const o = matrix[k]?.[p];
  return `<td class="${o === "200" ? "ok" : o ? "no" : ""}">${esc(o ?? "")}</td>`;
}).join("")}</tr>`).join("");
const html = `<!doctype html><meta charset="utf-8"><title>Pregled uloga (sintetički)</title>
<style>body{font:14px/1.4 system-ui;margin:24px;max-width:1500px}table{border-collapse:collapse;margin:12px 0}td,th{border:1px solid #ccc;padding:3px 6px;font-size:12px}.ok{background:#e7f6e7}.no{background:#f6e7e7}img{width:360px;border:1px solid #ddd;margin:4px}figure{display:inline-block;margin:0 8px 8px 0;vertical-align:top}figcaption{font-size:11px}</style>
<h1>Pregled uloga — sintetička baza</h1><p>Stvaran odgovor servera za svaku stranu (200 = otvara se; 403 = zabranjeno; → = preusmerenje). Nijedan stvaran nalog ni podatak.</p>
<table>${head}${body}</table>
${sections.map((s) => `<h2>${esc(s.label)}</h2><p>Početna posle prijave: <code>${esc(s.landing)}</code><br>Meni: ${esc(s.menu.join(" · "))}</p>
${s.rows.filter((r) => r.file).map((r) => `<figure><img src="${esc(r.file)}" loading="lazy"><figcaption>${esc(r.path)}</figcaption></figure>`).join("")}`).join("")}`;
writeFileSync(`${OUT}/index.html`, html);
console.log(`Galerija: ${OUT}/index.html`);
await browser.close();
