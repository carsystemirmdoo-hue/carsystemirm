/**
 * Neon-ove interne opcije kolona pri vraćanju kopije (2026-11-16).
 *
 * Neon je kolonama tabela napravljenih od 13. 11. 2026 (stock_level_history,
 * stock_requests) dopisao opciju `pg_attver=<broj>`. `pg_dump` je verno prenosi kao
 *
 *   ALTER TABLE ONLY public.t ALTER COLUMN c SET (pg_attver=484681096);
 *
 * a običan Postgres je ne poznaje i prekida vraćanje. Te opcije nemaju značenje van
 * Neona, pa se pri vraćanju izbacuju. Izbacuje se SAMO `pg_attver`: ostale opcije
 * kolone ostaju, a svaka druga greška i dalje zaustavlja vraćanje.
 *
 * Redovi podataka (`COPY … FROM stdin;` do `\.`) se nikad ne menjaju.
 */

const NEON_ONLY = new Set(["pg_attver"]);
const SET_OPTIONS = /^(ALTER TABLE (?:ONLY )?\S.* ALTER COLUMN \S.* SET )\((.*)\);$/;

/**
 * Jedan red DDL-a → isti red, red bez Neon opcija ili `null` (red se izbacuje).
 * @param {string} line
 * @returns {string | null}
 */
export function stripNeonColumnOptions(line) {
  const m = SET_OPTIONS.exec(line);
  if (!m) return line;
  const opts = m[2].split(",").map((s) => s.trim());
  const keep = opts.filter((o) => !NEON_ONLY.has(o.split("=")[0].trim().toLowerCase()));
  if (keep.length === opts.length) return line;
  return keep.length ? `${m[1]}(${keep.join(", ")});` : null;
}

/**
 * Prolaz kroz SQL iz `pg_restore --file=-` red po red; podaci iz COPY blokova se ne diraju.
 * Vraća funkciju koja prima jedan pun red (bez `\n`) i vraća red za ispis ili `null`.
 */
export function neonRestoreFilter() {
  let inCopy = false;
  const state = { removed: 0 };
  /** @param {string} line */
  const filter = (line) => {
    if (inCopy) {
      if (line === "\\.") inCopy = false;
      return line;
    }
    if (/^COPY .* FROM stdin;$/.test(line)) {
      inCopy = true;
      return line;
    }
    const out = stripNeonColumnOptions(line);
    if (out !== line) state.removed += 1;
    return out;
  };
  return Object.assign(filter, { state });
}
