/**
 * Stvarno ponašanje ekrana `/portal/kupci/veze` u pregledaču — LOKALNA baza
 * prikaza, samo SINTETIČKI partneri (PIB ispod 10.000.000, izmišljeni nazivi).
 *
 *   CARSYSTEM_SECRETS_DIR=~/.carsystem-secrets/lokalni-prikaz BASE=http://127.0.0.1:3420 \
 *     npx tsx --tsconfig db/integration/tsconfig.test.json scripts/qa/local-veze-check.mts
 *
 * Scenariji: bez dozvole (komercijalista, kancelarija bez „mapiranja"), bez
 * vezanog drugog faktora, istekla potvrda drugog faktora (> 10 min), važeća
 * potvrda, ponovna primena. Svaki ishod se proverava i u bazi. Ispisuje samo
 * nazive scenarija i ✔/✖.
 */
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { deflateRawSync } from "node:zlib";
import * as OTPAuth from "otpauth";
import postgres from "postgres";
import { chromium, type Page } from "playwright-core";
import { readSecrets, SECRETS_FILE } from "../ops/secrets-file.mts";
import { REVIEW_COLUMNS } from "../../lib/commercial/linkReviewFiles.mjs";
import { planCustomerLinks } from "../../lib/commercial/customerLinkPlan.mjs";
import { pibCheckDigit } from "../../lib/partners/pib.mjs";

const secrets = readSecrets();
if (secrets.DATASET_ROLE !== "lokalni-prikaz") throw new Error("Samo lokalna baza prikaza.");
const acc = readSecrets(path.join(path.dirname(SECRETS_FILE), "local-view-accounts.env"));
const BASE = (process.env.BASE ?? "http://127.0.0.1:3420").replace(/\/$/, "");
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(BASE)) throw new Error("Samo server na 127.0.0.1.");
const sql = postgres(secrets.NEON_OWNER_URL, { max: 1, prepare: false, onnotice: () => {} });
const ISSUER = "CSRM";
const WAIT_MS = Number(process.env.MFA_WAIT_MS ?? 10.5 * 60_000);

/* ---------------------------------------------------- sintetički fajlovi */
const run = randomBytes(2).readUInt16BE(0) % 9000 + 1000;
const pib = (n: number) => { const f = String(n).padStart(8, "0"); return `${f}${pibCheckDigit(f)}`; };
const partners = [1, 2, 3].map((i) => ({ code: String(run * 10 + i), pib: pib(run * 10 + i), name: `QA VEZE ${run}-${i}` }));
const dir = mkdtempSync(path.join(tmpdir(), "veze-"));

function zip(files: Record<string, string>) {
  const locals: Buffer[] = []; const centrals: Buffer[] = []; let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const n = Buffer.from(name); const raw = Buffer.from(content); const data = deflateRawSync(raw);
    const l = Buffer.alloc(30); l.writeUInt32LE(0x04034b50, 0); l.writeUInt16LE(8, 8); l.writeUInt32LE(data.length, 18); l.writeUInt32LE(raw.length, 22); l.writeUInt16LE(n.length, 26);
    locals.push(l, n, data);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(8, 10); c.writeUInt32LE(data.length, 20); c.writeUInt32LE(raw.length, 24); c.writeUInt16LE(n.length, 28); c.writeUInt32LE(offset, 42);
    centrals.push(c, n); offset += 30 + n.length + data.length;
  }
  const d = Buffer.concat(centrals); const e = Buffer.alloc(22);
  e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(Object.keys(files).length, 8); e.writeUInt16LE(Object.keys(files).length, 10); e.writeUInt32LE(d.length, 12); e.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, d, e]);
}
const cell = (ref: string, v: string) => `<c r="${ref}" t="inlineStr"><is><t>${v}</t></is></c>`;
const head = ["Šifra", "Naziv partnera", "PIB / JMBG", "Mesto", "Blokiran"];
const rowsXml = [head, ...partners.map((p) => [p.code, p.name, p.pib, "QA", "False"])]
  .map((r, i) => `<row r="${i + 1}">${r.map((v, j) => cell(`${"ABCDE"[j]}${i + 1}`, v)).join("")}</row>`).join("");
const xlsxPath = path.join(dir, "sifarnik.xlsx");
writeFileSync(xlsxPath, zip({
  "xl/workbook.xml": '<?xml version="1.0"?><workbook><sheets><sheet name="List" sheetId="1" r:id="R1" xmlns:r="r"/></sheets></workbook>',
  "xl/_rels/workbook.xml.rels": '<?xml version="1.0"?><Relationships><Relationship Id="R1" Target="worksheets/sheet1.xml" Type="t"/></Relationships>',
  "xl/worksheets/sheet1.xml": `<worksheet><sheetData>${rowsXml}</sheetData></worksheet>`,
}));
const register = partners.map((p) => ({ code: p.code, pib: p.pib, name: p.name, city: "QA", blocked: false }));
const invoiceCode = (p: { code: string }) => p.code.padStart(5, "0");

async function reviewCsv(file: string, which: number[]) {
  // Plan nad TRENUTNIM stanjem baze, kao `customer-link.mts plan`.
  const customers = await sql<{ id: string; name: string; pib: string }[]>`SELECT id, name, pib FROM customers WHERE pib IN ${sql(partners.map((p) => p.pib))}`;
  const idents = await sql<{ code: string; customer_id: string | null; status: string }[]>`
    SELECT external_partner_code AS code, customer_id, status FROM customer_external_identifiers WHERE issuer_code = ${ISSUER}`;
  const { proposals } = planCustomerLinks({
    issuerCode: ISSUER, register,
    invoicePartners: which.map((i) => ({ code: invoiceCode(partners[i]), pib: partners[i].pib, documents: 1 })),
    existing: {
      customersByPib: new Map(customers.map((c) => [c.pib, { id: c.id, name: c.name }])),
      identifiers: new Map(idents.map((i) => [i.code, { customerId: i.customer_id, status: i.status }])),
    },
  });
  const lines = proposals.map((p) => REVIEW_COLUMNS.map((c) => ({
    kljuc: p.key, sifra_na_fakturi: p.invoiceCode, sifra_u_sifarniku: p.registerCode, pib: p.pib, naziv_u_sifarniku: p.name,
    mesto: p.city, dokumenata: String(p.documents), predlog: p.action, postojeci_kupac: "", odluka: "potvrdi", potvrdio: "QA Kancelarija", napomena: "",
  } as Record<string, unknown>)[c] ?? "").join(";"));
  writeFileSync(file, "﻿" + [REVIEW_COLUMNS.join(";"), ...lines].join("\n") + "\n");
  return proposals.length;
}

/* ------------------------------------------------------------- prijava */
let lastStep = 0;
async function freshTotp(b32: string) {
  while (Math.floor(Date.now() / 30_000) <= lastStep) await new Promise((r) => setTimeout(r, 1000));
  lastStep = Math.floor(Date.now() / 30_000);
  return new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(b32), digits: 6, period: 30, algorithm: "SHA1" }).generate();
}
async function login(page: Page, key: string) {
  await page.goto(`${BASE}/prijava`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', acc[`LP_${key}_EMAIL`]);
  await page.fill('input[name="password"]', acc[`LP_${key}_PASSWORD`]);
  const second = page.locator('input[name="secondFactor"]');
  if (acc[`LP_${key}_TOTP`] && (await second.count())) await second.fill(await freshTotp(acc[`LP_${key}_TOTP`]));
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/prijava") || u.searchParams.has("error"), { timeout: 30_000 }).catch(() => undefined);
}
async function submit(page: Page, csv: string, mode: "provera" | "primena", confirm = true) {
  await page.goto(`${BASE}/portal/kupci/veze`, { waitUntil: "domcontentloaded" });
  await page.setInputFiles('input[name="sifarnik"]', xlsxPath);
  await page.setInputFiles('input[name="pregled"]', csv);
  await page.fill('input[name="issuerCode"]', ISSUER);
  if (mode === "primena" && confirm) await page.check('input[name="potvrda"]');
  const status = page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/portal/kupci/veze"), { timeout: 30_000 });
  await page.click(`button[name="mode"][value="${mode}"]`);
  const resp = await status;
  await page.waitForTimeout(800);
  return { http: resp.status(), text: await page.locator("main").innerText().catch(() => "") };
}
const linked = async () => (await sql<{ n: number }[]>`
  SELECT count(*)::int AS n FROM customer_external_identifiers WHERE issuer_code = ${ISSUER} AND status = 'mapped'
     AND external_partner_code IN ${sql(partners.map(invoiceCode))}`)[0].n;
const customersN = async () => (await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM customers WHERE pib IN ${sql(partners.map((p) => p.pib))}`)[0].n;

const results: [string, boolean, string][] = [];
const check = (name: string, ok: boolean, detail = "") => { results.push([name, ok, detail]); console.log(`  ${ok ? "✔" : "✖"} ${name}${detail ? ` — ${detail}` : ""}`); };

const browser = await chromium.launch();
try {
  const csv12 = path.join(dir, "pregled-12.csv"); await reviewCsv(csv12, [0, 1]);
  const csv3 = path.join(dir, "pregled-3.csv"); await reviewCsv(csv3, [2]);

  // 1. Bez dozvole.
  for (const key of ["REP", "OFFICE"]) {
    const ctx = await browser.newContext(); const page = await ctx.newPage();
    await login(page, key);
    const r = await page.goto(`${BASE}/portal/kupci/veze`);
    check(`bez dozvole (${key === "REP" ? "komercijalista" : "kancelarija bez mapiranja"}): ekran odbijen`, r?.status() === 403, `HTTP ${r?.status()}`);
    await ctx.close();
  }
  // 2. Bez vezanog drugog faktora: bez dozvole za vezivanje prijava se odbija;
  //    sa dozvolom sesija sme samo do vezivanja, ne do ekrana za veze.
  {
    const ctx = await browser.newContext(); const page = await ctx.newPage();
    await login(page, "NOMFA");
    const p1 = new URL(page.url()).pathname;
    await page.goto(`${BASE}/portal/kupci/veze`);
    const p2 = new URL(page.url()).pathname;
    check("bez drugog faktora i bez dozvole za vezivanje: prijava odbijena", p1 === "/prijava" && p2 === "/prijava", `${p1} → ${p2}`);
    await ctx.close();

    // Dozvola za vezivanje kroz postojeći alat; kod se ne ispisuje i ne koristi.
    const { execFileSync } = await import("node:child_process");
    execFileSync("node", ["scripts/issue-mfa-enrollment-grant.mjs"], {
      env: { ...process.env, DATABASE_URL: secrets.NEON_OWNER_URL, PORTAL_MFA_MASTER_KEY_V1: secrets.PORTAL_MFA_MASTER_KEY_V1, MFA_GRANT_EMAIL: acc.LP_NOMFA_EMAIL },
      stdio: ["ignore", "ignore", "ignore"],
    });
    const ctx2 = await browser.newContext(); const page2 = await ctx2.newPage();
    await login(page2, "NOMFA");
    await page2.goto(`${BASE}/portal/kupci/veze`);
    const p3 = new URL(page2.url()).pathname;
    check("bez drugog faktora, sa dozvolom: samo ekran za vezivanje, veze se ne prikazuju",
      p3.startsWith("/portal/bezbednost/mfa") && !(await page2.locator('input[name="pregled"]').count()), p3);
    await ctx2.close();
  }
  // 3. Istekla potvrda drugog faktora.
  {
    const ctx = await browser.newContext(); const page = await ctx.newPage();
    await login(page, "OWNER");
    const dry = await submit(page, csv3, "provera");
    check("važeća sesija: provera bez upisa radi", /Provera završena/.test(dry.text) && (await customersN()) === 0, `HTTP ${dry.http}`);
    console.log(`  … čeka se ${Math.round(WAIT_MS / 60000 * 10) / 10} min da potvrda drugog faktora istekne`);
    await page.waitForTimeout(WAIT_MS);
    const exp = await submit(page, csv3, "primena");
    check("istekla potvrda drugog faktora: primena odbijena, ništa upisano", exp.http === 403 && (await customersN()) === 0 && (await linked()) === 0, `HTTP ${exp.http}`);
    await ctx.close();
  }
  // 4. Važeća potvrda (nova prijava), bez i sa izričitom potvrdom.
  {
    const ctx = await browser.newContext(); const page = await ctx.newPage();
    await login(page, "OWNER");
    const noConfirm = await submit(page, csv12, "primena", false);
    check("bez izričite potvrde: primena odbijena", /Potvrdite da ste pregledali/.test(noConfirm.text) && (await linked()) === 0);
    const ok = await submit(page, csv12, "primena");
    const audits = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM audit_log WHERE actor_user_id = ${acc.LP_OWNER_ID}
         AND entity_label IN ${sql(partners.slice(0, 2).map((p) => `biznisoft/${ISSUER}/${invoiceCode(p)}`))}`;
    check("važeća potvrda: dva kupca otvorena i povezana, akter = prijavljeni", /Primena završena/.test(ok.text) && (await customersN()) === 2 && (await linked()) === 2 && audits[0].n === 4,
      `kupaca ${await customersN()}, veza ${await linked()}, trag ${audits[0].n}`);
    // 5. Ponovna primena iste tabele.
    const again = await submit(page, csv12, "primena");
    check("ponovna primena iste tabele: zastarelo, bez duplikata", /zastareo/.test(again.text) && (await customersN()) === 2 && (await linked()) === 2);
    const csvNow = path.join(dir, "pregled-12-novi.csv"); await reviewCsv(csvNow, [0, 1]);
    const fresh = await submit(page, csvNow, "primena");
    check("nov plan posle primene: već povezano, bez radnje", /već povezano/.test(fresh.text) && (await customersN()) === 2 && (await linked()) === 2);
    await ctx.close();
  }
} finally {
  await browser.close();
  rmSync(dir, { recursive: true, force: true });
  await sql.end();
}
const failed = results.filter(([, ok]) => !ok).length;
console.log(failed ? `\nNE PROLAZI: ${failed}` : "\nSvi scenariji prolaze.");
process.exitCode = failed ? 1 : 0;
