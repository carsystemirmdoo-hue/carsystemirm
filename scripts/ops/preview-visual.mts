/**
 * Vizuelni pregled zaštićenog Preview-a: snimci + automatske napomene po strani.
 *
 *   OUT=<folder> npx tsx --tsconfig db/integration/tsconfig.test.json scripts/ops/preview-visual.mts [public|flows|all]
 *
 * Telefon (390×844) i desktop (1440×900), svetla i tamna tema. Za svaku stranu
 * beleži: HTTP status, greške u konzoli, neuspele zahteve (≥400), horizontalno
 * prelivanje i slike koje se nisu učitale. Snimci su za ČOVEKA — automatske
 * napomene nisu zamena za pregled. Ništa se ne ispisuje iz fajlova sa tajnama.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import * as OTPAuth from "otpauth";
import { readSecrets, SECRETS_FILE } from "./secrets-file.mts";

const secrets = readSecrets();
const syn = readSecrets(path.join(path.dirname(SECRETS_FILE), "preview-synthetic.env"));
const BASE = (secrets.PREVIEW_URL || "").replace(/\/$/, "");
const OUT = process.env.OUT || "preview-visual";
const mode = process.argv[2] ?? "all";
const headers: Record<string, string> = secrets.VERCEL_BYPASS_TOKEN
  ? { "x-vercel-protection-bypass": secrets.VERCEL_BYPASS_TOKEN, "x-vercel-set-bypass-cookie": "samesitenone" }
  : {};
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = {
  phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
} as const;
type Combo = { device: keyof typeof VIEWPORTS; scheme: "light" | "dark" };
const COMBOS: Combo[] = [
  { device: "desktop", scheme: "light" }, { device: "desktop", scheme: "dark" },
  { device: "phone", scheme: "light" }, { device: "phone", scheme: "dark" },
];

const MAX_SHOT_PX = 16_000;

const PUBLIC_PAGES: [string, string][] = [
  ["pocetna", "/"],
  ["brendovi", "/brendovi"],
  ["brend-rm", "/brendovi/rm"],
  ["katalog", "/katalog"],
  ["pretraga", "/katalog?q=lak"],
  ["filter-brend", "/katalog?brend=carsystem"],
  ["pdp-varijante", "/proizvodi/baslac-basecoat-35"],
  ["pdp-pakovanja", "/proizvodi/rm-diamont-bazna-boja"],
  ["pdp-dokumenti", "/proizvodi/2210-onyx-activator"],
  ["dokumenti", "/katalozi"],
  ["kontakt", "/kontakt"],
];

type Note = { page: string; combo: string; status: number; consoleErrors: string[]; failed: string[]; overflowPx: number; brokenImages: number };
const notes: Note[] = [];

async function context(browser: Browser, combo: Combo): Promise<BrowserContext> {
  // `reduce`: snimak cele strane inače hvata elemente koji se pojavljuju tek pri
  // skrolovanju kao prazne; sajt za smanjeno kretanje prikazuje sadržaj odmah.
  const ctx = await browser.newContext({
    ...VIEWPORTS[combo.device], colorScheme: combo.scheme, locale: "sr-RS", reducedMotion: "reduce",
  });
  // Ključ samo za Preview: na spoljnim domenima (npr. pločice mape) dodatno
  // zaglavlje izaziva CORS proveru koju oni odbijaju.
  const host = new URL(BASE).host;
  await ctx.route("**/*", (route) =>
    new URL(route.request().url()).host === host
      ? route.continue({ headers: { ...route.request().headers(), ...headers } })
      : route.continue(),
  );
  return ctx;
}

async function capture(page: Page, name: string, combo: Combo, p: string) {
  const consoleErrors: string[] = [];
  const failed: string[] = [];
  const onConsole = (m: { type(): string; text(): string }) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 160));
  };
  const onResponse = (r: { status(): number; url(): string }) => {
    if (r.status() >= 400) failed.push(`${r.status()} ${new URL(r.url()).pathname}`);
  };
  page.on("console", onConsole);
  page.on("response", onResponse);
  const response = await page.goto(`${BASE}${p}`, { waitUntil: "networkidle", timeout: 60_000 }).catch(() => null);
  await page.waitForTimeout(1200);
  // Lenjo učitane slike: pomeranje do dna, pa nazad.
  // Do MAX_SHOT_PX: katalog sa beskonačnim skrolovanjem bi inače učitao sve
  // proizvode, a JPEG ne prima visinu preko 65 535 px.
  await page.evaluate(async (max) => {
    for (let y = 0; y < Math.min(document.body.scrollHeight, max); y += 700) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
  }, MAX_SHOT_PX);
  await page.waitForTimeout(600);
  const metrics = await page.evaluate(() => ({
    overflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
    broken: [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.getAttribute("src")).length,
  }));
  const file = path.join(OUT, `${name}__${combo.device}-${combo.scheme}.jpg`);
  const fullHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  const width = page.viewportSize()?.width ?? 1440;
  await page.screenshot({
    path: file, fullPage: true, type: "jpeg", quality: 55,
    clip: { x: 0, y: 0, width, height: Math.min(fullHeight, MAX_SHOT_PX) },
  });
  page.off("console", onConsole);
  page.off("response", onResponse);
  notes.push({
    page: name, combo: `${combo.device}-${combo.scheme}`, status: response?.status() ?? 0,
    consoleErrors: [...new Set(consoleErrors)], failed: [...new Set(failed)], overflowPx: metrics.overflow, brokenImages: metrics.broken,
  });
}

async function publicPass(browser: Browser) {
  for (const combo of COMBOS) {
    const ctx = await context(browser, combo);
    const page = await ctx.newPage();
    for (const [name, p] of PUBLIC_PAGES) await capture(page, name, combo, p);
    await ctx.close();
  }
}

const totp = (b32: string) =>
  new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(b32), algorithm: "SHA1", digits: 6, period: 30 }).generate();
let lastStep = 0;
async function freshTotp(b32: string) {
  // Isti 30-sekundni prozor se ne prihvata dvaput (zaštita od ponavljanja).
  while (Math.floor(Date.now() / 30_000) <= lastStep) await new Promise((r) => setTimeout(r, 1000));
  lastStep = Math.floor(Date.now() / 30_000);
  return totp(b32);
}

async function customerLogin(page: Page, email: string, password: string) {
  await page.goto(`${BASE}/prijava/kupac`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/prijava"), { timeout: 30_000 }), page.click('button[type="submit"]')]);
}

async function staffLogin(page: Page, email: string, password: string, b32: string) {
  await page.goto(`${BASE}/prijava`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  const second = page.locator('input[name="secondFactor"]');
  if (await second.count()) await second.fill(await freshTotp(b32));
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => u.pathname.startsWith("/portal"), { timeout: 30_000 });
}

async function flowsPass(browser: Browser) {
  for (const combo of [COMBOS[0], COMBOS[2], COMBOS[3]]) {
    const tag = `${combo.device}-${combo.scheme}`;
    // Kupac A: nalog, fakture, cena na strani proizvoda, korpa, zahtev.
    const ctx = await context(browser, combo);
    const a = await ctx.newPage();
    await customerLogin(a, syn.SYN_CUSTOMER_A_EMAIL, syn.SYN_CUSTOMER_A_PASSWORD);
    await capture(a, "kupacA-nalog", combo, "/kupac");
    await capture(a, "kupacA-fakture", combo, "/kupac/fakture");
    await capture(a, "kupacA-faktura", combo, `/kupac/fakture/${syn.SYN_INVOICE_QA_A_1_ID}`);
    await capture(a, "kupacA-proizvod", combo, `/proizvodi/${syn.SYN_PRODUCT_1_SLUG}`);
    await capture(a, "kupacA-korpa", combo, "/kupac/korpa");
    if (combo === COMBOS[0]) {
      // Jedan sintetički zahtev kancelariji (demo cenovnik, ostaje u portalu).
      const send = a.getByRole("button", { name: /Pošaljite zahtev kancelariji|Potvrdite lozinkom i pošaljite/ }).first();
      if (await send.count()) {
        await send.click();
        const pw = a.locator('input[type="password"]');
        if (await pw.count()) {
          await pw.first().fill(syn.SYN_CUSTOMER_A_PASSWORD);
          await a.getByRole("button", { name: /Potvrdite lozinkom i pošaljite/ }).first().click().catch(() => undefined);
        }
        await a.waitForTimeout(3000);
        await a.screenshot({ path: path.join(OUT, `kupacA-posle-slanja__${tag}.jpg`), fullPage: true, type: "jpeg", quality: 55 });
      }
      await capture(a, "kupacA-porudzbine", combo, "/kupac/porudzbine");
      await capture(a, "kupacA-upiti", combo, "/kupac/upiti");
    }
    await ctx.close();

    // Kancelarija i komercijalista.
    for (const [who, email, pw, b32] of [
      ["kancelarija", syn.SYN_OFFICE_EMAIL, syn.SYN_OFFICE_PASSWORD, syn.SYN_OFFICE_TOTP],
      ["komercijalista", syn.SYN_REP_EMAIL, syn.SYN_REP_PASSWORD, syn.SYN_REP_TOTP],
    ] as const) {
      const sctx = await context(browser, combo);
      const s = await sctx.newPage();
      await staffLogin(s, email, pw, b32);
      await capture(s, `${who}-pocetna`, combo, "/portal");
      await capture(s, `${who}-kupci`, combo, "/portal/kupci");
      await capture(s, `${who}-kupacA`, combo, `/portal/kupci/${syn.SYN_CUSTOMER_A_ID}`);
      await capture(s, `${who}-prodaja`, combo, "/portal/prodaja");
      await capture(s, `${who}-zahtevi`, combo, "/portal/zahtevi");
      if (who === "kancelarija") await capture(s, `${who}-importi`, combo, "/portal/importi");
      await sctx.close();
    }
  }
}

const browser = await chromium.launch();
try {
  if (mode === "public" || mode === "all") await publicPass(browser);
  if (mode === "flows" || mode === "all") await flowsPass(browser);
} finally {
  await browser.close();
  writeFileSync(path.join(OUT, `notes-${mode}.json`), JSON.stringify(notes, null, 2));
  const flagged = notes.filter((n) => n.status >= 400 || n.consoleErrors.length || n.failed.length || n.overflowPx > 0 || n.brokenImages > 0);
  console.log(`Snimaka: ${notes.length}; sa napomenom: ${flagged.length}`);
  for (const n of flagged) {
    console.log(`- ${n.page} [${n.combo}] status ${n.status}` +
      (n.overflowPx ? ` | prelivanje ${n.overflowPx}px` : "") +
      (n.brokenImages ? ` | neučitanih slika ${n.brokenImages}` : "") +
      (n.failed.length ? ` | neuspeli zahtevi: ${n.failed.slice(0, 4).join(", ")}` : "") +
      (n.consoleErrors.length ? ` | konzola: ${n.consoleErrors.slice(0, 2).join(" / ")}` : ""));
  }
}
