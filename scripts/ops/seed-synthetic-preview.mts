/**
 * Sintetički podaci za ZAŠTIĆENI Preview (testna Neon baza) — ništa stvarno.
 *
 *   npx tsx --tsconfig db/integration/tsconfig.test.json scripts/ops/seed-synthetic-preview.mts
 *
 * Pravi:
 * - oznaku skupa podataka `dataset.kind = demo` (portal ga svuda označava kao demo;
 *   demo poručivanje radi SAMO nad ovom oznakom i demo cenovnikom);
 * - dva kupca („Primer Kupac A/B", PIB sa vodećim nulama — nikad dodeljiv PIB),
 *   po jedan aktivan kupčev nalog, fakture za oba;
 * - komercijalistu (dodeljen samo kupcu A) i kancelariju, sa već vezanim
 *   drugim faktorom (TOTP tajna samo u fajlu ispod);
 * - tri sintetička artikla vezana za postojeće proizvode iz kataloga i aktivan
 *   DEMO cenovnik, uz rabat 10 % za kupca A na prvi artikal.
 *
 * Lozinke i TOTP tajne idu ISKLJUČIVO u ~/.carsystem-secrets/preview-synthetic.env
 * (600); ništa se ne ispisuje. Drugo pokretanje ne pravi ništa novo.
 * Odbija bazu u kojoj postoji kupac van sintetičkog opsega PIB-a.
 */
import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { hashPassword } from "@/lib/auth/password.mjs";
import { encryptMfaSecret } from "@/lib/auth/mfa-crypto.mjs";
import { generateTotpSecret } from "@/lib/auth/totp.mjs";
import { getAllCarsystemProducts, getProductVariantSelector } from "@/lib/carsystem-data";
import { readSecrets, requireSecret, SECRETS_FILE } from "./secrets-file.mts";

const OUT = path.join(path.dirname(SECRETS_FILE), "preview-synthetic.env");
const DOMAIN = "preview.carsystem.invalid";
const MARKER = "Sintetički podaci — zaštićeni Preview";

const secrets = readSecrets();
// Pilot baza nosi stvarne podatke: sintetika (i demo oznaka) tamo nikad ne ide.
if (secrets.DATASET_ROLE === "pilot") {
  console.error("Fajl tajni je označen kao PILOT (DATASET_ROLE=pilot) — sintetički podaci se tu ne upisuju.");
  process.exit(1);
}
const LOCAL_TEST = process.env.PREVIEW_DB_LOCAL_TEST === "1";

const url = new URL(requireSecret(secrets, "NEON_OWNER_URL"));
url.searchParams.delete("channel_binding");
const local = LOCAL_TEST && url.hostname === "127.0.0.1";
if (!local) {
  if (!/\.eu-central-1\.aws\.neon\.tech$/.test(url.hostname)) throw new Error("Meta nije Neon u Frankfurtu.");
  if (!url.searchParams.get("sslmode")) url.searchParams.set("sslmode", "require");
}

const mfaEnv = {
  PORTAL_MFA_MASTER_KEY_V1: requireSecret(secrets, "PORTAL_MFA_MASTER_KEY_V1"),
  PORTAL_MFA_ACTIVE_KEY_VERSION: "1",
};

/** PIB sa vodećim nulama i ispravnom kontrolnom cifrom (MOD 11,10). */
function syntheticPib(n: number): string {
  const first8 = String(n).padStart(8, "0");
  let p = 10;
  for (const ch of first8) {
    let s = (p + Number(ch)) % 10;
    if (s === 0) s = 10;
    p = (s * 2) % 11;
  }
  return first8 + String((11 - p) % 10);
}

const password = () => randomBytes(18).toString("base64url");

const sql = postgres(url.toString(), { max: 1, prepare: false, onnotice: () => {} });
try {
  const real = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM customers WHERE pib !~ '^000000'`;
  if (real[0].n > 0) throw new Error("Baza sadrži kupce van sintetičkog opsega — odbijeno.");

  const existing = await sql`SELECT 1 FROM system_settings WHERE key = 'dataset.kind'`;
  if (existing.length) {
    console.log("Sintetički podaci već postoje — ništa nije promenjeno.");
    process.exit(0);
  }
  if (existsSync(OUT)) throw new Error(`${OUT} već postoji, a baza je bez oznake — proverite ručno.`);

  const products = getAllCarsystemProducts()
    .filter((p) => p.slug && !(getProductVariantSelector(p)?.variants?.length))
    .slice(0, 3);
  if (products.length < 3) throw new Error("U katalogu nisu nađena tri proizvoda bez varijanti.");

  const creds: Record<string, string> = {};
  const ids: Record<string, string> = {};

  await sql.begin(async (tx) => {
    await tx`
      INSERT INTO system_settings (key, value)
      VALUES ('dataset.kind', ${tx.json({ kind: "demo", label: MARKER, asOf: new Date().toISOString().slice(0, 10) })})`;

    // Zaposleni sa vezanim drugim faktorom.
    for (const [key, role, name] of [
      ["REP", "komercijalista", "Primer Komercijalista"],
      ["OFFICE", "kancelarija", "Primer Kancelarija"],
    ] as const) {
      const pw = password();
      const email = `${key.toLowerCase()}@${DOMAIN}`;
      const [u] = await tx<{ id: string }[]>`
        INSERT INTO users (email, name, initials, password_hash, role, active)
        VALUES (${email}, ${name}, ${name.split(" ").map((w) => w[0]).join("")}, ${await hashPassword(pw)}, ${role}, true)
        RETURNING id`;
      const totp = generateTotpSecret();
      const enc = encryptMfaSecret(totp.bytes, mfaEnv);
      await tx`
        INSERT INTO user_mfa (user_id, secret_ciphertext, secret_iv, secret_auth_tag, secret_key_version, enrolled_at)
        VALUES (${u.id}, ${enc.ciphertext}, ${enc.iv}, ${enc.authTag}, ${enc.keyVersion}, now())`;
      ids[key] = u.id;
      creds[`SYN_${key}_EMAIL`] = email;
      creds[`SYN_${key}_PASSWORD`] = pw;
      creds[`SYN_${key}_TOTP`] = totp.base32;
    }

    // Kupci, nalozi i dodela komercijalisti (samo A).
    for (const [key, n, city] of [["A", 11, "Inđija"], ["B", 21, "Novi Sad"]] as const) {
      const [c] = await tx<{ id: string }[]>`
        INSERT INTO customers (pib, name, city)
        VALUES (${syntheticPib(n)}, ${`Primer Kupac ${key} d.o.o.`}, ${city}) RETURNING id`;
      ids[`CUSTOMER_${key}`] = c.id;
      const pw = password();
      const email = `kupac-${key.toLowerCase()}@${DOMAIN}`;
      await tx`
        INSERT INTO customer_users (customer_id, email, name, password_hash, status)
        VALUES (${c.id}, ${email}, ${`Primer Kontakt ${key}`}, ${await hashPassword(pw)}, 'active')`;
      creds[`SYN_CUSTOMER_${key}_EMAIL`] = email;
      creds[`SYN_CUSTOMER_${key}_PASSWORD`] = pw;
      creds[`SYN_CUSTOMER_${key}_ID`] = c.id;
    }
    await tx`INSERT INTO customer_assignments (user_id, customer_id) VALUES (${ids.REP}, ${ids.CUSTOMER_A})`;

    // Artikli vezani za postojeće proizvode iz kataloga.
    const articleIds: string[] = [];
    for (const [i, product] of products.entries()) {
      const [a] = await tx<{ id: string }[]>`
        INSERT INTO articles (code, name, product_group, brand, unit)
        VALUES (${`QA-90000${i + 1}`}, ${`Sintetički artikal ${i + 1}`}, 'Sintetička grupa', 'Primer', 'kom')
        RETURNING id`;
      articleIds.push(a.id);
      await tx`
        INSERT INTO article_catalog_mappings (article_id, catalog_product_slug, status, note, confirmed_by, confirmed_at)
        VALUES (${a.id}, ${product.slug}, 'mapped', ${MARKER}, ${ids.OFFICE}, now())`;
      creds[`SYN_PRODUCT_${i + 1}_SLUG`] = product.slug;
    }

    // Fakture: dve za A, jedna za B (bez izvornog PDF-a, kao raniji CSV uvoz).
    const invoices: [string, string, string, number[]][] = [
      ["A", "QA-A-1", "2026-08-12", [0, 1]],
      ["A", "QA-A-2", "2026-09-15", [0, 2]],
      ["B", "QA-B-1", "2026-09-02", [1]],
    ];
    for (const [key, number, issuedOn, lines] of invoices) {
      const net = lines.length * 1000;
      const [inv] = await tx<{ id: string }[]>`
        INSERT INTO invoices (company_id, document_kind, number, year, issued_on, customer_id, net_amount, tax_amount, total_amount)
        VALUES ('QA', 'faktura', ${number}, 2026, ${issuedOn}, ${ids[`CUSTOMER_${key}`]},
                ${net.toFixed(2)}, ${(net * 0.2).toFixed(2)}, ${(net * 1.2).toFixed(2)})
        RETURNING id`;
      creds[`SYN_INVOICE_${number.replaceAll("-", "_")}_ID`] = inv.id;
      for (const [ln, idx] of lines.entries()) {
        await tx`
          INSERT INTO invoice_lines (invoice_id, line_number, article_id, article_code, description, quantity, unit_price, tax_percent, line_amount)
          VALUES (${inv.id}, ${ln + 1}, ${articleIds[idx]}, ${`QA-90000${idx + 1}`}, ${`Sintetički artikal ${idx + 1}`},
                  '2.000', '500.0000', '20.000', '1000.00')`;
      }
    }

    // Aktivan DEMO cenovnik + rabat za kupca A.
    const [pl] = await tx<{ id: string }[]>`
      INSERT INTO price_lists (code, name, kind, status, currency, valid_from, source_note, activated_by, activated_at)
      VALUES ('QA-DEMO-2026', 'Sintetički demo cenovnik', 'demo', 'active', 'RSD', '2026-10-01', ${MARKER}, ${ids.OFFICE}, now())
      RETURNING id`;
    for (const [i, articleId] of articleIds.entries()) {
      await tx`
        INSERT INTO price_list_items (price_list_id, article_id, unit, pack_label, net_price, vat_percent)
        VALUES (${pl.id}, ${articleId}, 'kom', '1 kom', ${(1000 + i * 250).toFixed(4)}, '20.00')`;
    }
    await tx`
      INSERT INTO price_list_customer_terms (price_list_id, customer_id, product_scope, article_id, discount_percent)
      VALUES (${pl.id}, ${ids.CUSTOMER_A}, 'article', ${articleIds[0]}, '10.000')`;
  });

  writeFileSync(OUT, `${Object.entries(creds).map(([k, v]) => `${k}=${v}`).join("\n")}\n`, { mode: 0o600 });
  console.log(`Sintetički podaci upisani. Pristupni podaci za proveru: ${OUT} (600, ne ispisuju se).`);
} finally {
  await sql.end();
}
