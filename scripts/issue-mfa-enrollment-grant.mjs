/**
 * Prva dozvola za vezivanje drugog faktora — samo za vlasnika.
 *
 *   MFA_GRANT_EMAIL=vlasnik@primer.rs node scripts/issue-mfa-enrollment-grant.mjs
 *
 * Zašto postoji
 * -------------
 * Vezivanje drugog faktora traži dozvolu koju izdaje neko ko već ima MFA. Prvi
 * vlasnik je nema od koga da dobije — to je problem prvog jajeta. Ovaj alat ga
 * rešava, ali NE zaobilazi vezivanje: izdaje običnu jednokratnu dozvolu, istu
 * onu koju vlasnik kasnije izdaje ostalima kroz portal.
 *
 * Šta NE radi
 * -----------
 *   - ne aktivira MFA;
 *   - ne ispisuje TOTP tajnu;
 *   - ne pravi trajni „master" kod;
 *   - ne radi za bilo koga osim za AKTIVNOG `gazda` naloga.
 *
 * Pokreće se sa servera, uz pristup bazi i master ključu.
 */

import postgres from "postgres";

const email = process.env.MFA_GRANT_EMAIL?.trim().toLowerCase();
if (!email) {
  console.error("MFA_GRANT_EMAIL nije podešen. Navedite e-poštu vlasnika.");
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL nije podešen.");
  process.exit(1);
}

if (!process.env.PORTAL_MFA_MASTER_KEY_V1) {
  console.error(
    "PORTAL_MFA_MASTER_KEY_V1 nije podešen. Bez njega dozvola se ne može otisnuti.",
  );
  process.exit(1);
}

const { generateRecoveryCode } = await import("../lib/auth/recovery-codes.mjs");
const { recoveryCodeFingerprint, activeKeyVersion } = await import(
  "../lib/auth/mfa-crypto.mjs"
);

const sql = postgres(connectionString, { max: 1 });

try {
  const [owner] = await sql`
    SELECT id, email, name FROM users
    WHERE email = ${email} AND role = 'gazda' AND active = true
    LIMIT 1
  `;

  if (!owner) {
    // Namerno ista poruka za „ne postoji", „nije gazda" i „nije aktivan":
    // alat se pokreće sa servera, ali ni tu nema razloga otkrivati stanje naloga.
    console.error("Nije pronađen aktivan nalog sa ulogom Vlasnik i tom e-poštom.");
    process.exit(1);
  }

  const code = generateRecoveryCode();
  const keyVersion = activeKeyVersion(process.env);
  const fingerprint = recoveryCodeFingerprint(code, process.env, keyVersion);
  const expiresAt = new Date(Date.now() + 30 * 60_000);

  await sql.begin(async (tx) => {
    // Najviše jedna otvorena dozvola po korisniku.
    await tx`
      UPDATE mfa_enrollment_grants SET superseded_at = now()
      WHERE user_id = ${owner.id} AND used_at IS NULL AND superseded_at IS NULL
    `;
    await tx`
      INSERT INTO mfa_enrollment_grants
        (user_id, code_fingerprint, key_version, issued_by, expires_at)
      VALUES (${owner.id}, ${fingerprint}, ${keyVersion}, NULL, ${expiresAt})
    `;
    await tx`
      INSERT INTO audit_log (actor_user_id, actor_label, action, entity_type, entity_id, entity_label, reason)
      VALUES (
        NULL,
        'Bootstrap (komandna linija)',
        'Izdata dozvola za vezivanje drugog faktora',
        'Korisnik',
        ${owner.id},
        ${owner.email},
        'Prva dozvola za vlasnika, izdata sa servera'
      )
    `;
  });

  console.log("");
  console.log("Dozvola za vezivanje drugog faktora");
  console.log("-----------------------------------");
  console.log(`Nalog:  ${owner.name} <${owner.email}>`);
  console.log(`Kod:    ${code}`);
  console.log(`Važi do: ${expiresAt.toLocaleString("sr-Latn-RS")}`);
  console.log("");
  console.log("Kod se prikazuje SAMO sada. Unesite ga na /portal/bezbednost/mfa.");
  console.log("");
} catch (error) {
  console.error("Dozvola nije izdata:", error.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
