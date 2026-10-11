/**
 * Sintetička baza za proveru celog toka portala u pregledaču (revizija 57).
 *
 * Pravi isključivo izmišljene podatke — tri firme „SINT …“, šest artikala,
 * osnovne cene, rabate, opcije plaćanja, dve fakture, kupčev nalog i četiri
 * zaposlena sa vezanim drugim faktorom — da bi kupčev zahtev, obrada u
 * kancelariji i opseg komercijaliste mogli da se kliknu bez ijednog stvarnog
 * podatka. Odbija svaku bazu koja nije testna (`db/integration/safety.mjs`).
 *
 *   TEST_DATABASE_URL=postgres://…/carsystem_revizija_ui_qa \
 *   SYNTH_ENV_FILE=~/.carsystem-secrets/revizija-sinteticki.env \
 *   SYNTH_CREDS_FILE=~/.carsystem-secrets/revizija-sinteticki.json \
 *   npx tsx --tsconfig db/integration/tsconfig.test.json scripts/qa/seed-synthetic-portal.mts
 *
 * `SYNTH_ENV_FILE` (ključevi servera) se pravi ako ne postoji; lozinke i TOTP
 * tajne idu samo u `SYNTH_CREDS_FILE` (0600) i nikad na izlaz.
 */
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import postgres from "postgres";
import * as OTPAuth from "otpauth";
import { evaluateTestTarget, SAFETY_MESSAGES } from "../../db/integration/safety.mjs";

const testUrl = process.env.TEST_DATABASE_URL;
const decision = evaluateTestTarget({
  testUrl,
  databaseUrl: process.env.DATABASE_URL,
  migrationUrl: process.env.MIGRATION_DATABASE_URL,
  vercelEnv: process.env.VERCEL_ENV,
});
if (!decision.ok) {
  console.error(SAFETY_MESSAGES[decision.reason as keyof typeof SAFETY_MESSAGES] ?? decision.reason);
  process.exit(1);
}
const envFile = process.env.SYNTH_ENV_FILE;
const credsFile = process.env.SYNTH_CREDS_FILE;
if (!envFile || !credsFile) {
  console.error("Postavite SYNTH_ENV_FILE i SYNTH_CREDS_FILE.");
  process.exit(1);
}

const key = () => randomBytes(32).toString("base64");
if (!existsSync(envFile)) {
  writeFileSync(
    envFile,
    [
      `AUTH_SECRET=${key()}`,
      `PORTAL_MFA_MASTER_KEY_V1=${key()}`,
      "PORTAL_MFA_ACTIVE_KEY_VERSION=1",
      `AUTH_RATE_LIMIT_HMAC_KEY=${key()}`,
      `SITE_ACCESS_PASSWORD=${randomBytes(12).toString("base64url")}`,
      "",
    ].join("\n"),
    { mode: 0o600 },
  );
}
for (const line of readFileSync(envFile, "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}
process.env.DATABASE_URL = testUrl;

const sql = postgres(testUrl!, { max: 1, onnotice: () => {} });
const [{ n: existing }] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM customers`;
if (existing > 0) {
  console.error("Baza nije prazna — sintetička priprema ide samo u novu bazu.");
  await sql.end();
  process.exit(1);
}

const { hashPassword } = await import("@/lib/auth/password.mjs");
const mfa = await import("@/lib/auth/mfa-service");
const { precedenceLevelFor, scopeKeyFor } = await import("@/lib/pricing/precedence.mjs");
const { PERMISSION_PACKAGES } = await import("@/lib/authz/permissions.mjs");

for (const [index, item] of PERMISSION_PACKAGES.entries()) {
  await sql`INSERT INTO permission_packages (key, name, description, sort_order)
            VALUES (${item.key}, ${item.name}, ${item.description}, ${String(index)}) ON CONFLICT (key) DO NOTHING`;
}

const creds: Record<string, unknown> = {};
const staff: Record<string, string> = {};
const STAFF = [
  ["vlasnik", "gazda", "SINT Vlasnik"],
  ["kancelarija", "kancelarija", "SINT Kancelarija"],
  ["petar", "komercijalista", "SINT Petar Komercijalista"],
  ["jovan", "komercijalista", "SINT Jovan Komercijalista"],
  ["milan", "komercijalista", "SINT Milan Analitika"],
  ["magacin", "magacioner", "SINT Magacin Magacioner"],
] as const;
for (const [k, role, name] of STAFF) {
  const email = `sint-${k}@revizija.test`;
  const password = randomBytes(18).toString("base64url");
  const [u] = await sql<{ id: string }[]>`
    INSERT INTO users (email, name, initials, password_hash, role, active)
    VALUES (${email}, ${name}, ${name.split(" ")[1].slice(0, 2).toUpperCase()}, ${await hashPassword(password)}, ${role}, true)
    RETURNING id`;
  staff[k] = u.id;
  const begun = await mfa.beginMfaEnrollment({ userId: u.id, accountLabel: email });
  const token = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(begun.base32), digits: 6, period: 30, algorithm: "SHA1" }).generate();
  await mfa.confirmMfaEnrollment({ userId: u.id, token });
  creds[k] = { email, password, totpBase32: begun.base32, role };
}
// Jovan ima paket „Nalozi kupaca“, ali dodelu samo za firmu B (provera opsega, A12).
await sql`INSERT INTO user_permissions (user_id, permission_key, granted_by, reason)
          VALUES (${staff.jovan}, 'kupacki_nalozi', ${staff.vlasnik}, 'sintetička provera opsega')`;
// Petar i Milan predlažu rabate (kao komercijalisti na Production-u); Milan ima i „analitiku“ (vidi SVE kupce).
for (const [who, key] of [["petar", "cene_predlog"], ["milan", "cene_predlog"], ["milan", "analitika"]] as const) {
  await sql`INSERT INTO user_permissions (user_id, permission_key, granted_by, reason)
            VALUES (${staff[who]}, ${key}, ${staff.vlasnik}, 'sintetički pregled uloga')`;
}

const customer = async (pib: string, name: string) =>
  (await sql<{ id: string }[]>`INSERT INTO customers (pib, name) VALUES (${pib}, ${name}) RETURNING id`)[0].id;
const A = await customer("SINT-0001", "SINT Auto Lak d.o.o.");
const B = await customer("SINT-0002", "SINT Karoserija B");
const C = await customer("SINT-0003", "SINT Farbara C");
await sql`INSERT INTO customer_assignments (customer_id, user_id) VALUES (${A}, ${staff.petar}), (${B}, ${staff.jovan})`;

const ARTICLES = [
  ["SINT-B01", "SINT BAZNA BOJA 1L", "LIT", "SINTLAK", "1000.00"],
  ["SINT-B02", "SINT BEZBOJNI LAK 5L", "LIT", "SINTLAK", "1500.00"],
  ["SINT-K01", "SINT KIT UNIVERZALNI 1KG", "KOM", "SINTKIT", "800.00"],
  ["SINT-P01", "SINT PODLOGA 2K 1L", "LIT", "SINTLAK", "1200.00"],
  ["SINT-N01", "SINT NOVI ARTIKAL BEZ RABATA", "KOM", "SINTNOVO", "300.00"],
  ["SINT-X01", "SINT ARTIKAL VAN PROGRAMA", "KOM", "SINTVAN", "100.00"],
] as const;
const art: Record<string, string> = {};
for (const [code, name, unit, brand, price] of ARTICLES) {
  const [a] = await sql<{ id: string }[]>`INSERT INTO articles (code, name, unit, brand) VALUES (${code}, ${name}, ${unit}, ${brand}) RETURNING id`;
  art[code] = a.id;
  await sql`INSERT INTO article_base_prices (article_id, net_price, vat_percent, valid_from, source, reason, created_by)
            VALUES (${a.id}, ${price}, '20', '2026-01-01', 'rucno', 'sintetička osnovna cena', ${staff.vlasnik})`;
}
await sql`INSERT INTO article_programme_decisions (article_id, in_programme, reason, decided_by)
          VALUES (${art["SINT-X01"]}, false, 'sintetički van programa', ${staff.vlasnik})`;

async function rule(customerId: string, scope: { productScope: "article" | "brand"; articleId?: string; brand?: string }, pct: number, cond: string | null = null) {
  const s = { customerScope: "customer", customerId, ...scope, paymentCondition: cond };
  await sql`
    INSERT INTO price_rules (customer_scope, customer_id, product_scope, article_id, brand, precedence_level, scope_key, value_kind, discount_percent,
                             effective_from, status, reason, proposed_by, proposed_at, decided_by, decided_at, biznisoft_entry_required, payment_condition)
    VALUES ('customer', ${customerId}, ${scope.productScope}, ${scope.articleId ?? null}, ${scope.brand ?? null}, ${precedenceLevelFor(s)}, ${scopeKeyFor(s)},
            'discount_percent', ${pct}, '2026-01-01', 'approved_pending_biznisoft', 'sintetički rabat', ${staff.vlasnik}, now(), ${staff.vlasnik}, now(), false, ${cond})`;
}
await rule(A, { productScope: "brand", brand: "SINTLAK" }, 30);
await rule(A, { productScope: "brand", brand: "SINTLAK" }, 35, "avans");
await rule(A, { productScope: "article", articleId: art["SINT-K01"] }, 40);
for (const o of ["avans", "odlozeno_30"]) {
  await sql`INSERT INTO customer_payment_options (customer_id, option_code, status, effective_from, reason, proposed_by, decided_by, decided_at)
            VALUES (${A}, ${o}, 'odobreno', '2026-01-01', 'sintetički odobreno', ${staff.vlasnik}, ${staff.vlasnik}, now())`;
}

// Kupovina preko sajta (dok. 61, K6): sintetički artikli sa POTVRĐENOM vezom na stvarne
// kataloške proizvode (cene izmišljene). C05 je povezan bez osnovne cene → „Cena na upit“;
// ostale varijante tih proizvoda ostaju bez veze. C03 i C04 su dva pakovanja jedne kartice.
const CATALOG = [
  ["SINT-C01", "SINT FILLER AIR PLUS SIVI 1,25L", "KOM", "2400.00", "carsystem-2k-filler-air-plus", "152.580"],
  ["SINT-C03", "SINT ANTISILIKON 1L", "LIT", "1000.00", "baslac-70-10-silicone-remover-for-oil-silicone-and-grease", null],
  ["SINT-C04", "SINT ANTISILIKON 5L", "LIT", "960.00", "baslac-70-10-silicone-remover-for-oil-silicone-and-grease", null],
  ["SINT-C05", "SINT VOC FILLER 540 UCVRSCIVAC VEOMA BRZI 0,9L", "KOM", null, "carsystem-2k-voc-filler-540", "144.027"],
] as const;
for (const [code, name, unit, price, slug, variant] of CATALOG) {
  const [a] = await sql<{ id: string }[]>`INSERT INTO articles (code, name, unit, brand) VALUES (${code}, ${name}, ${unit}, 'SINTKAT') RETURNING id`;
  art[code] = a.id;
  if (price) {
    await sql`INSERT INTO article_base_prices (article_id, net_price, vat_percent, valid_from, source, reason, created_by)
              VALUES (${a.id}, ${price}, '20', '2026-01-01', 'rucno', 'sintetička osnovna cena', ${staff.vlasnik})`;
  }
  await sql`INSERT INTO article_catalog_mappings (article_id, catalog_product_slug, catalog_variant_id, status, note, proposed_by, proposed_at, confirmed_by, confirmed_at)
            VALUES (${a.id}, ${slug}, ${variant}, 'mapped', 'sintetička potvrđena veza', ${staff.vlasnik}, now(), ${staff.vlasnik}, now())`;
}
await rule(A, { productScope: "brand", brand: "SINTKAT" }, 20);
await rule(A, { productScope: "brand", brand: "SINTKAT" }, 25, "avans");
// Firma D: drugi rabat, samo jedna opcija plaćanja.
const D = await customer("SINT-0004", "SINT Lakirnica D");
await sql`INSERT INTO customer_assignments (customer_id, user_id) VALUES (${D}, ${staff.petar})`;
await rule(D, { productScope: "brand", brand: "SINTKAT" }, 10);
await sql`INSERT INTO customer_payment_options (customer_id, option_code, status, effective_from, reason, proposed_by, decided_by, decided_at)
          VALUES (${D}, 'avans', 'odobreno', '2026-01-01', 'sintetički odobreno', ${staff.vlasnik}, ${staff.vlasnik}, now())`;

// Dve fakture firme A: „ranije kupljeno“ u izboru artikala i spisak faktura kupca.
const invoices = [
  ["SINT-RN-0001", "2026-09-15", [["SINT-B01", "4.000", "1000.0000", "30", "2800.00"], ["SINT-K01", "2.000", "800.0000", "40", "960.00"]]],
  ["SINT-RN-0002", "2026-10-02", [["SINT-P01", "1.000", "1200.0000", "30", "840.00"]]],
] as const;
for (const [number, day, lines] of invoices) {
  const net = lines.reduce((s, l) => s + Number(l[4]), 0);
  const [inv] = await sql<{ id: string }[]>`
    INSERT INTO invoices (company_id, document_kind, number, year, issued_on, customer_id, net_amount, tax_amount, total_amount, origin)
    VALUES ('SINT', 'faktura', ${number}, 2026, ${day}, ${A}, ${net.toFixed(2)}, ${(net * 0.2).toFixed(2)}, ${(net * 1.2).toFixed(2)}, 'manual_upload')
    RETURNING id`;
  let ln = 0;
  for (const [code, qty, price, disc, amount] of lines) {
    ln += 1;
    await sql`INSERT INTO invoice_lines (invoice_id, line_number, article_id, article_code, description, quantity, unit_price, discount_percent, line_amount)
              VALUES (${inv.id}, ${ln}, ${art[code]}, ${code}, ${[...ARTICLES, ...CATALOG].find((a) => a[0] === code)![1]}, ${qty}, ${price}, ${disc}, ${amount})`;
  }
}

// Potvrđena istorija kupovine: sintetički BizniSoft PDF-ovi (fixtures/dev) kroz PRAVI uvoz,
// sa vezom šifre partnera na firmu A — kartica kupca i „Za razgovor“ ih računaju kao kupovine.
for (const code of ["09001", "09002"]) {
  await sql`INSERT INTO customer_external_identifiers (source_system, issuer_code, external_partner_code, customer_id, status)
            VALUES ('biznisoft', 'SINT', ${code}, ${A}, 'mapped')`;
}
{
  const { readFile } = await import("node:fs/promises");
  const { ingestBiznisoftPdf } = await import("@/lib/pdf/ingest");
  const owner = { id: staff.vlasnik, name: "SINT Vlasnik", role: "gazda" };
  for (const f of ["jedna-stavka.pdf", "vise-stavki.pdf"]) {
    const bytes = new Uint8Array(await readFile(new URL(`../../fixtures/dev/biznisoft/${f}`, import.meta.url)));
    const out = await ingestBiznisoftPdf({ bytes, fileName: f, issuerCode: "SINT" }, owner);
    if (out.result !== "ingested") throw new Error(`${f}: ${out.result}`);
  }
}

// „Poručite ponovo“ čita samo potvrđene uvoze: artikal iz PDF uvoza (900001) dobija sintetičku
// osnovnu cenu, rabat firme A i potvrđenu vezu na jednu stvarnu kataloški varijantu.
{
  const [a1] = await sql<{ id: string }[]>`SELECT id FROM articles WHERE code = '900001'`;
  await sql`INSERT INTO article_base_prices (article_id, net_price, vat_percent, valid_from, source, reason, created_by)
            VALUES (${a1.id}, '5200.00', '20', '2026-01-01', 'rucno', 'sintetička osnovna cena', ${staff.vlasnik})`;
  await rule(A, { productScope: "article", articleId: a1.id }, 15);
  await sql`INSERT INTO article_catalog_mappings (article_id, catalog_product_slug, catalog_variant_id, status, note, proposed_by, proposed_at, confirmed_by, confirmed_at)
            VALUES (${a1.id}, 'carsystem-2k-voc-filler-540', '144.026', 'mapped', 'sintetička potvrđena veza', ${staff.vlasnik}, now(), ${staff.vlasnik}, now())`;
}

await sql`INSERT INTO system_settings (key, value) VALUES ('ordering.trial', ${sql.json({ customerIds: [A, D] })})`;

const kupacEmail = "sint-kupac-a@revizija.test";
const kupacPassword = randomBytes(18).toString("base64url");
const [kupac] = await sql<{ id: string }[]>`
  INSERT INTO customer_users (customer_id, email, name, password_hash, status)
  VALUES (${A}, ${kupacEmail}, 'SINT Kupac A', ${await hashPassword(kupacPassword)}, 'active') RETURNING id`;
await sql`INSERT INTO customer_users (customer_id, email, name, status)
          VALUES (${B}, 'sint-kupac-b@revizija.test', 'SINT Kupac B', 'requested')`;
const kupacDPassword = randomBytes(18).toString("base64url");
const [kupacD] = await sql<{ id: string }[]>`
  INSERT INTO customer_users (customer_id, email, name, password_hash, status)
  VALUES (${D}, 'sint-kupac-d@revizija.test', 'SINT Kupac D', ${await hashPassword(kupacDPassword)}, 'active') RETURNING id`;
creds.kupac = { email: kupacEmail, password: kupacPassword, role: "kupac" };
creds.kupacD = { email: "sint-kupac-d@revizija.test", password: kupacDPassword, role: "kupac" };
creds.ids = { A, B, C, D, kupacA: kupac.id, kupacD: kupacD.id, ...staff };

writeFileSync(credsFile, JSON.stringify(creds, null, 2), { mode: 0o600 });
console.log(`Sintetička baza spremna: 4 firme, ${ARTICLES.length + CATALOG.length} artikala (${CATALOG.length} sa potvrđenom vezom na katalog), 2 + 2 fakture (2 kroz pravi PDF uvoz), 4 zaposlena, 2 aktivna kupčeva naloga (A: dve opcije, D: jedna).`);
await sql.end();
process.exit(0);
