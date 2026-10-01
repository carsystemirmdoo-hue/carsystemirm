/**
 * Provera zaštićenog Preview-a nad sintetičkim podacima — bez ispisa tajni.
 *
 *   npx tsx --tsconfig db/integration/tsconfig.test.json scripts/ops/preview-smoke.mts [--base <url>]
 *
 * Čita ~/.carsystem-secrets/preview-test.env (PREVIEW_URL, VERCEL_BYPASS_TOKEN)
 * i preview-synthetic.env (nalozi iz seed-synthetic-preview.mts).
 * Vercel Authentication se prolazi zaglavljem „Protection Bypass for Automation";
 * vrednost se ne ispisuje. Ispisuju se samo ishodi provera.
 */
import path from "node:path";
import { chromium, type Browser, type Page } from "playwright-core";
import * as OTPAuth from "otpauth";
import { readSecrets, SECRETS_FILE } from "./secrets-file.mts";

const secrets = readSecrets();
const syn = readSecrets(path.join(path.dirname(SECRETS_FILE), "preview-synthetic.env"));
const baseArg = process.argv.indexOf("--base");
const BASE = (baseArg > 0 ? process.argv[baseArg + 1] : secrets.PREVIEW_URL || "").replace(/\/$/, "");
if (!BASE) throw new Error("PREVIEW_URL nije upisan (ili --base).");
const bypass = secrets.VERCEL_BYPASS_TOKEN || "";
// HTTP provere šalju samo ključ; zaglavlje za kolačić bi izazvalo 307 na istu adresu
// (Vercel tako postavlja kolačić), pa ga dobija samo pregledač.
const headers: Record<string, string> = bypass ? { "x-vercel-protection-bypass": bypass } : {};
const browserHeaders: Record<string, string> = bypass
  ? { ...headers, "x-vercel-set-bypass-cookie": "samesitenone" }
  : {};

let failed = 0;
const results: string[] = [];
function check(label: string, pass: boolean, note = "") {
  if (!pass) failed += 1;
  results.push(`  ${pass ? "✔" : "✖"} ${label}${note ? ` — ${note}` : ""}`);
}

const get = (p: string) => fetch(`${BASE}${p}`, { headers, redirect: "manual" });
const locationOf = (r: Response) => new URL(r.headers.get("location") ?? "/", BASE).pathname;

function totp(base32: string) {
  return new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(base32), algorithm: "SHA1", digits: 6, period: 30 }).generate();
}

/* ------------------------------------------------------------- HTTP */

async function httpChecks() {
  const home = await get("/");
  const html = await home.text();
  check("početna strana odgovara (200)", home.status === 200, `status ${home.status}`);
  check(
    "zabrana indeksiranja (X-Robots-Tag ili meta robots noindex)",
    /noindex/i.test(home.headers.get("x-robots-tag") ?? "") || /<meta[^>]+name="robots"[^>]+noindex/i.test(html),
  );
  const robots = await (await get("/robots.txt")).text();
  check("robots.txt zabranjuje ceo sajt", /Disallow:\s*\/\s*$/m.test(robots));
  check("sitemap se ne nudi robotima", !/Sitemap:/i.test(robots));

  const portal = await get("/portal");
  check("/portal bez sesije vodi na prijavu", portal.status >= 300 && portal.status < 400 && locationOf(portal).startsWith("/prijava"));
  check("/portal preusmerenje se ne kešira", /no-store/i.test(portal.headers.get("cache-control") ?? ""));
  const kupac = await get("/kupac");
  check("/kupac bez sesije vodi na prijavu kupca", kupac.status >= 300 && kupac.status < 400 && locationOf(kupac).startsWith("/prijava"));
  // Ruta prima samo POST; isključen prekidač daje 404 pre provere potpisa.
  const sync = await fetch(`${BASE}/api/sync/heartbeat`, { method: "POST", headers, redirect: "manual", body: "{}" });
  check("/api/sync je isključen (404)", sync.status === 404, `status ${sync.status}`);
  const offers = await get("/api/kupac/ponude");
  check("ponude bez sesije odbijene (401)", offers.status === 401, `status ${offers.status}`);
  check("X-Content-Type-Options: nosniff", (home.headers.get("x-content-type-options") ?? "") === "nosniff");
  check("CSP frame-ancestors postoji", /frame-ancestors/i.test(home.headers.get("content-security-policy") ?? ""));
}

/* ---------------------------------------------------------- browser */

async function newPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ extraHTTPHeaders: browserHeaders, locale: "sr-RS" });
  return context.newPage();
}

async function customerLogin(page: Page, email: string, password: string) {
  await page.goto(`${BASE}/prijava/kupac`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/prijava"), { timeout: 30_000 }), page.click('button[type="submit"]')]);
}

async function staffLogin(page: Page, email: string, password: string, base32: string) {
  await page.goto(`${BASE}/prijava`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  const second = page.locator('input[name="secondFactor"]');
  if (await second.count()) await second.fill(totp(base32));
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => u.pathname.startsWith("/portal"), { timeout: 30_000 });
}

// `innerText` vraća prikazan tekst — CSS ume da ga ispiše velikim slovima — pa se poredi bez obzira na veličinu.
const text = async (page: Page, p: string) => {
  const r = await page.goto(`${BASE}${p}`, { waitUntil: "domcontentloaded" });
  const raw = await page.locator("body").innerText();
  return { status: r?.status() ?? 0, body: raw.toLocaleLowerCase("sr-Latn"), url: new URL(page.url()).pathname };
};

async function customerChecks(browser: Browser) {
  const a = await newPage(browser);
  await customerLogin(a, syn.SYN_CUSTOMER_A_EMAIL, syn.SYN_CUSTOMER_A_PASSWORD);
  const home = await text(a, "/kupac");
  check("kupac A: prijava i nalog sopstvene firme", home.body.includes("primer kupac a"));
  check("kupac A: ne vidi kupca B", !home.body.includes("primer kupac b"));
  const invoices = await text(a, "/kupac/fakture");
  check("kupac A: vidi svoje fakture", invoices.body.includes("qa-a-1") && invoices.body.includes("qa-a-2"));
  check("kupac A: ne vidi fakturu kupca B u spisku", !invoices.body.includes("qa-b-1"));
  const foreign = await text(a, `/kupac/fakture/${syn.SYN_INVOICE_QA_B_1_ID}`);
  check("kupac A: tuđa faktura po ID-u nije dostupna", !foreign.body.includes("qa-b-1"), `status ${foreign.status}`);
  const portal = await text(a, "/portal");
  check("kupac A: interni portal nije dostupan", !portal.url.startsWith("/portal") || /prijav/i.test(portal.body));

  const offers = await a.evaluate(async () => (await fetch("/api/kupac/ponude", { cache: "no-store" })).json());
  const first = offers.offers?.find((o: { articleCode: string }) => o.articleCode === "QA-900001");
  check("kupac A: demo poručivanje uključeno nad demo cenovnikom", offers.ordering?.enabled === true && offers.demo === true);
  check("kupac A: cena artikla 1 sa rabatom 10 %", first?.listPrice === 1000 && first?.discountPercent === 10 && first?.netPrice === 900,
    first ? `osnovna ${first.listPrice}, rabat ${first.discountPercent}, neto ${first.netPrice}` : "artikal nije u ponudi");
  check("kontakt kancelarije u ponudama", offers.contacts?.office?.phone === "022 558 501" && /08:00–16:00/.test(offers.contacts?.office?.workingHours ?? ""));

  await text(a, `/proizvodi/${syn.SYN_PRODUCT_1_SLUG}`);
  const add = a.getByRole("button", { name: "Dodajte u korpu" }).first();
  await add.waitFor({ timeout: 30_000 }).catch(() => undefined);
  if (await add.count()) await add.click();
  await a.waitForTimeout(2000);
  const cart = await text(a, "/kupac/korpa");
  check("kupac A: korpa sa sintetičkim artiklom (demo)", /qa-900001|sintetički artikal 1/.test(cart.body));

  const b = await newPage(browser);
  await customerLogin(b, syn.SYN_CUSTOMER_B_EMAIL, syn.SYN_CUSTOMER_B_PASSWORD);
  const bOffers = await b.evaluate(async () => (await fetch("/api/kupac/ponude", { cache: "no-store" })).json());
  const bSecond = bOffers.offers?.find((o: { articleCode: string }) => o.articleCode === "QA-900002");
  check("kupac B: osnovna cena bez rabata kupca A", bSecond?.discountPercent === 0 && bSecond?.netPrice === bSecond?.listPrice,
    bSecond ? `osnovna ${bSecond.listPrice}, neto ${bSecond.netPrice}` : "artikal nije u ponudi");
  const bCart = await text(b, "/kupac/korpa");
  check("kupac B: ne vidi korpu kupca A", !/qa-900001/.test(bCart.body));
}

async function staffChecks(browser: Browser) {
  const rep = await newPage(browser);
  await staffLogin(rep, syn.SYN_REP_EMAIL, syn.SYN_REP_PASSWORD, syn.SYN_REP_TOTP);
  const repCustomers = await text(rep, "/portal/kupci");
  check("komercijalista: prijava sa drugim faktorom", repCustomers.url.startsWith("/portal"));
  check("komercijalista: vidi dodeljenog kupca A", repCustomers.body.includes("primer kupac a"));
  check("komercijalista: ne vidi kupca B", !repCustomers.body.includes("primer kupac b"));
  const repB = await text(rep, `/portal/kupci/${syn.SYN_CUSTOMER_B_ID}`);
  check("komercijalista: kartica kupca B nedostupna", !repB.body.includes("primer kupac b"), `status ${repB.status}`);
  const repImports = await text(rep, "/portal/importi");
  check("komercijalista: uvoz nedostupan", repImports.status === 403 || /nemate pristup|zabranjen/i.test(repImports.body), `status ${repImports.status}`);

  const office = await newPage(browser);
  await staffLogin(office, syn.SYN_OFFICE_EMAIL, syn.SYN_OFFICE_PASSWORD, syn.SYN_OFFICE_TOTP);
  const officeCustomers = await text(office, "/portal/kupci");
  check("kancelarija: vidi oba kupca", officeCustomers.body.includes("primer kupac a") && officeCustomers.body.includes("primer kupac b"));
  const officeImports = await text(office, "/portal/importi");
  check("kancelarija: vidi uvoz i CSV je isključen", officeImports.status === 200 && /csv uvoz faktura je isključen/.test(officeImports.body));
}

console.log(`Meta: ${new URL(BASE).host}${bypass ? " (uz zaglavlje za zaštitu Vercela)" : ""}`);
await httpChecks();
const browser = await chromium.launch();
try {
  await customerChecks(browser);
  await staffChecks(browser);
} catch (error) {
  check("tok u pregledaču završen bez izuzetka", false, (error as Error).message.split("\n")[0].slice(0, 160));
} finally {
  await browser.close();
}
console.log(results.join("\n"));
console.log(`\nUKUPNO ${results.length}: prošlo ${results.length - failed}, palo ${failed}`);
process.exitCode = failed ? 1 : 0;
