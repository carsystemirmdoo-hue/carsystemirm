/**
 * Početno punjenje baze:
 *   npm run db:seed
 *
 * Upisuje isključivo ono bez čega sistem ne može da radi — pakete dozvola,
 * podrazumevane pragove i jedan početni Gazda nalog iz promenljivih okruženja.
 *
 * Namerno NE upisuje kupce, fakture, dugovanja, pošiljke ni bilo koji drugi
 * poslovni podatak. Vrednosti iz dizajn prototipa su prikaz izgleda, ne podaci.
 */

import postgres from "postgres";
import { hashPassword } from "../lib/auth/password.mjs";
import { PERMISSION_PACKAGES } from "../lib/authz/permissions.mjs";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL nije podešen.");
  process.exit(1);
}

const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
const displayName = process.env.BOOTSTRAP_ADMIN_NAME?.trim() || "Vlasnik";

const sql = postgres(connectionString, { max: 1 });

/** @param {string} name */
function initialsFrom(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

try {
  for (const [index, item] of PERMISSION_PACKAGES.entries()) {
    await sql`
      INSERT INTO permission_packages (key, name, description, sort_order)
      VALUES (${item.key}, ${item.name}, ${item.description}, ${String(index)})
      ON CONFLICT (key) DO UPDATE
        SET name = EXCLUDED.name,
            description = EXCLUDED.description,
            sort_order = EXCLUDED.sort_order
    `;
  }
  console.log(`Paketi dozvola: ${PERMISSION_PACKAGES.length}`);

  const defaultSettings = [
    ["pragovi.limit", { t70: 70, t90: 90, t100: 100, tDelay: 15 }],
    ["nabavka.horizonti", { dani: [30, 60, 90, 120, 180], podrazumevano: 60 }],
  ];
  for (const [key, value] of defaultSettings) {
    await sql`
      INSERT INTO system_settings (key, value)
      VALUES (${key}, ${sql.json(value)})
      ON CONFLICT (key) DO NOTHING
    `;
  }
  console.log(`Sistemski pragovi: ${defaultSettings.length}`);

  if (!email || !password) {
    console.log(
      "BOOTSTRAP_ADMIN_EMAIL / BOOTSTRAP_ADMIN_PASSWORD nisu podešeni — početni nalog nije kreiran.",
    );
  } else {
    const existing = await sql`SELECT id FROM users WHERE email = ${email}`;
    if (existing.length > 0) {
      console.log(`Nalog ${email} već postoji — preskočeno.`);
    } else {
      const passwordHash = await hashPassword(password);
      const [created] = await sql`
        INSERT INTO users (email, name, initials, password_hash, role)
        VALUES (${email}, ${displayName}, ${initialsFrom(displayName)}, ${passwordHash}, 'gazda')
        RETURNING id
      `;
      // Gazda ima sve pakete; ostali korisnici se otvaraju kroz /portal/dozvole.
      for (const item of PERMISSION_PACKAGES) {
        await sql`
          INSERT INTO user_permissions (user_id, permission_key, granted_by, reason)
          VALUES (${created.id}, ${item.key}, ${created.id}, 'Početni nalog vlasnika')
          ON CONFLICT DO NOTHING
        `;
      }
      await sql`
        INSERT INTO audit_log (actor_user_id, actor_label, action, entity_type, entity_id, entity_label, reason)
        VALUES (${created.id}, ${`${displayName} (gazda)`}, 'Kreiran korisnik', 'Korisnik', ${created.id}, ${email}, 'Početni nalog kreiran skriptom db:seed')
      `;
      console.log(`Kreiran početni Gazda nalog: ${email}`);
    }
  }

  console.log("Seed je završen.");
} catch (error) {
  console.error("Seed nije uspeo:", error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
