/**
 * Razvojni nalozi za probu sistema.
 *
 *   DEV_PASSWORD=... node scripts/seed-dev-accounts.mjs
 *
 * ISKLJUČIVO ZA RAZVOJ. Lozinke su privremene i zajedničke; u produkciji naloge
 * otvara Gazda kroz /portal/dozvole, sa lozinkom koja se prenosi lično.
 *
 * Ovlašćenja se dodeljuju preko uloge i paketa dozvola vezanih za ID naloga —
 * nigde se ne proverava ime osobe.
 */

import postgres from "postgres";
import { hashPassword } from "../lib/auth/password.mjs";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL nije podešen.");
  process.exit(1);
}

const password = process.env.DEV_PASSWORD;
if (!password || password.length < 10) {
  console.error("DEV_PASSWORD mora imati najmanje 10 znakova.");
  process.exit(1);
}

/** @type {{email:string,name:string,role:string,packages:string[],note:string}[]} */
const ACCOUNTS = [
  {
    email: "aleksandar.novkovic@carsystem.local",
    name: "Aleksandar Novković",
    role: "gazda",
    packages: [
      "analitika",
      "otprema",
      "nabavka_predlog",
      "porucivanje",
      "limiti",
      "korisnici",
      "pragovi",
      "zatvaranje",
    ],
    note: "Vlasnik — potpun pristup, potvrda nabavke, limiti, administracija.",
  },
  {
    email: "miroslav.suljagic@carsystem.local",
    name: "Miroslav Suljagić",
    role: "komercijalista",
    // Bez „porucivanje“, „limiti“, „korisnici“, „pragovi“ i „zatvaranje“.
    packages: ["analitika", "nabavka_predlog"],
    note: "Komercijalista, region Jug + paket „Napredna analitika i izveštaji“.",
  },
  {
    email: "aleksandar.s@carsystem.local",
    name: "Aleksandar S.",
    role: "komercijalista",
    packages: [],
    note: "Komercijalista — samo dodeljeni kupci i sopstveni rezultati.",
  },
  {
    email: "milan.vracar@carsystem.local",
    name: "Milan Vračar",
    role: "komercijalista",
    packages: [],
    note: "Komercijalista — samo dodeljeni kupci i sopstveni rezultati.",
  },
  {
    email: "magacioner@carsystem.local",
    name: "Magacioner",
    role: "magacioner",
    packages: ["otprema"],
    note: "Otprema, adresnice i BEX. Bez finansija i administracije.",
  },
  {
    email: "kancelarija@carsystem.local",
    name: "Kancelarija",
    role: "kancelarija",
    packages: ["otprema"],
    note: "Administrativna uloga sa podešenim dozvolama, bez vlasničkih prava.",
  },
];

const sql = postgres(connectionString, { max: 1 });

function initialsFrom(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

try {
  const passwordHash = await hashPassword(password);

  for (const account of ACCOUNTS) {
    const [user] = await sql`
      INSERT INTO users (email, name, initials, password_hash, role)
      VALUES (${account.email}, ${account.name}, ${initialsFrom(account.name)}, ${passwordHash}, ${account.role})
      ON CONFLICT (email) DO UPDATE
        SET name = EXCLUDED.name,
            role = EXCLUDED.role,
            password_hash = EXCLUDED.password_hash,
            active = true,
            failed_login_attempts = 0,
            locked_until = NULL,
            updated_at = now()
      RETURNING id
    `;

    // Paketi se postavljaju na tačno stanje iz specifikacije.
    await sql`DELETE FROM user_permissions WHERE user_id = ${user.id}`;
    for (const key of account.packages) {
      await sql`
        INSERT INTO user_permissions (user_id, permission_key, granted_by, reason)
        VALUES (${user.id}, ${key}, ${user.id}, 'Razvojni nalog (scripts/seed-dev-accounts.mjs)')
        ON CONFLICT DO NOTHING
      `;
    }

    await sql`
      INSERT INTO audit_log (actor_user_id, actor_label, action, entity_type, entity_id, entity_label, value_after, reason)
      VALUES (${user.id}, ${`${account.name} (${account.role})`}, 'Kreiran korisnik', 'Korisnik', ${user.id}, ${account.email},
              ${sql.json({ uloga: account.role, paketi: account.packages })},
              'Razvojni nalog — nije produkcijski')
    `;

    console.log(
      `${account.email.padEnd(42)} ${account.role.padEnd(15)} [${account.packages.join(", ") || "bez paketa"}]`,
    );
  }

  // Dodela kupaca komercijalistima, da ograničenje vidljivosti ima sadržaj.
  const customers = await sql`SELECT id, name FROM customers ORDER BY name`;
  if (customers.length > 0) {
    const reps = await sql`
      SELECT id, email FROM users
      WHERE email IN ('miroslav.suljagic@carsystem.local','aleksandar.s@carsystem.local','milan.vracar@carsystem.local')
      ORDER BY email
    `;
    await sql`DELETE FROM customer_assignments WHERE user_id IN ${sql(reps.map((r) => r.id))}`;
    for (const [index, customer] of customers.entries()) {
      const rep = reps[index % reps.length];
      await sql`
        INSERT INTO customer_assignments (user_id, customer_id)
        VALUES (${rep.id}, ${customer.id})
        ON CONFLICT DO NOTHING
      `;
    }
    console.log(
      `\nDodeljeno ${customers.length} kupaca na ${reps.length} komercijalista.`,
    );
  } else {
    console.log("\nNema kupaca za dodelu — prvo uvezite fakture.");
  }

  console.log("\nRazvojni nalozi su spremni. Lozinka je ista za sve naloge.");
} catch (error) {
  console.error("Nije uspelo:", error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
