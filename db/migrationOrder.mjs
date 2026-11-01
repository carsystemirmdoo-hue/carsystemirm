/**
 * Provera redosleda migracija pre primene.
 *
 * Drizzle primenjuje samo migracije čije je vreme u dnevniku (`when`) veće od
 * vremena POSLEDNJE primenjene (`created_at` u `drizzle.__drizzle_migrations`).
 * Migracija sa grane spojene kasnije, a sa ranijim vremenom, bila bi tiho
 * preskočena. Ovde se to pretvara u grešku pre nego što se ijedna migracija
 * izvrši; ništa se ne menja ni u dnevniku ni u bazi.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

export async function ucitajDnevnik(migrationsFolder) {
  const raw = await readFile(path.join(migrationsFolder, "meta", "_journal.json"), "utf8");
  return JSON.parse(raw).entries;
}

/** Greške u samom dnevniku: redosled idx, broj u nazivu i strogo rastuće vreme. */
export function greskeDnevnika(entries) {
  const greske = [];
  let prethodniBroj = -1;
  entries.forEach((e, i) => {
    if (e.idx !== i) greske.push(`${e.tag}: idx ${e.idx} na mestu ${i}`);
    const broj = Number.parseInt(String(e.tag).slice(0, 4), 10);
    if (!Number.isInteger(broj) || broj <= prethodniBroj) {
      greske.push(`${e.tag}: broj u nazivu nije veći od prethodnog (${prethodniBroj})`);
    }
    prethodniBroj = broj;
    if (i > 0 && !(e.when > entries[i - 1].when)) {
      greske.push(`${e.tag}: vreme ${e.when} nije veće od ${entries[i - 1].tag} (${entries[i - 1].when})`);
    }
  });
  return greske;
}

/**
 * Poređenje dnevnika sa primenjenim migracijama (`created_at` iz baze).
 * - `preskocene`: neprimenjene, a ne kasnije od poslednje primenjene — drizzle bi ih preskočio;
 * - `nepoznate`: primenjene u bazi, a nema ih u dnevniku ovog koda (baza je ispred koda);
 * - `naCekanju`: neprimenjene koje će biti primenjene, redom.
 */
export function stanjeMigracija(entries, primenjeneCreatedAt) {
  const primenjene = new Set(primenjeneCreatedAt.map(Number));
  const poslednja = primenjene.size ? Math.max(...primenjene) : -Infinity;
  const uDnevniku = new Set(entries.map((e) => e.when));
  const preskocene = [];
  const naCekanju = [];
  for (const e of entries) {
    if (primenjene.has(e.when)) continue;
    (e.when <= poslednja ? preskocene : naCekanju).push(e.tag);
  }
  const nepoznate = [...primenjene].filter((ms) => !uDnevniku.has(ms)).sort((a, b) => a - b);
  return { preskocene, nepoznate, naCekanju };
}

/** Čita primenjene migracije; nova baza bez tabele znači „ništa primenjeno“. */
export async function primenjeneIzBaze(sql) {
  const [{ postoji }] = await sql`
    SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS postoji
  `;
  if (!postoji) return [];
  const rows = await sql`SELECT created_at FROM drizzle.__drizzle_migrations`;
  return rows.map((r) => Number(r.created_at));
}

/** Baca grešku ako bi migracija bila preskočena ili ako dnevnik nije ispravan. */
export async function proveriRedosled(sql, migrationsFolder) {
  const entries = await ucitajDnevnik(migrationsFolder);
  const greske = greskeDnevnika(entries);
  const stanje = stanjeMigracija(entries, await primenjeneIzBaze(sql));
  if (stanje.preskocene.length) {
    greske.push(
      `bile bi preskočene (vreme nije posle poslednje primenjene): ${stanje.preskocene.join(", ")}`,
    );
  }
  if (stanje.nepoznate.length) {
    greske.push(
      `baza ima primenjene migracije kojih nema u ovom kodu (created_at): ${stanje.nepoznate.join(", ")}`,
    );
  }
  if (greske.length) {
    throw new Error(`Migracije nisu pokrenute.\n- ${greske.join("\n- ")}`);
  }
  return stanje;
}
