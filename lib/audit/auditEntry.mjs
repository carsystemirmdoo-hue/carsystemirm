/**
 * Priprema reda za trag revizije.
 *
 * Odvojeno od upisa u bazu da bi se pravila (obavezna polja, redigovanje osetljivih
 * vrednosti, oblik zapisa pre/posle) mogla testirati bez konekcije.
 */

/** Ključevi čija se vrednost nikada ne upisuje u trag revizije. */
const REDACTED_KEYS = [
  "password",
  "passwordhash",
  "password_hash",
  "lozinka",
  "token",
  "secret",
  "apikey",
  "api_key",
  "authorization",
  "cookie",
  "sessiontoken",
];

const REDACTED = "[redigovano]";

/**
 * @param {unknown} value
 * @returns {unknown}
 */
export function redactSensitive(value) {
  if (Array.isArray(value)) return value.map(redactSensitive);
  if (value === null || typeof value !== "object") return value;

  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    out[key] = REDACTED_KEYS.includes(key.toLowerCase().replace(/[\s-]/g, ""))
      ? REDACTED
      : redactSensitive(item);
  }
  return out;
}

/**
 * @typedef {object} AuditInput
 * @property {{ id?: string | null, name: string, role: string }} actor
 * @property {string} action
 * @property {string} entityType
 * @property {string | null} [entityId]
 * @property {string | null} [entityLabel]
 * @property {unknown} [before]
 * @property {unknown} [after]
 * @property {string | null} [reason]
 * @property {string | null} [correlationId]
 */

/**
 * @param {AuditInput} input
 */
export function buildAuditEntry(input) {
  if (!input?.action) throw new Error("Trag revizije zahteva radnju (action).");
  if (!input.entityType) {
    throw new Error("Trag revizije zahteva tip entiteta (entityType).");
  }
  if (!input.actor?.name || !input.actor?.role) {
    throw new Error("Trag revizije zahteva izvršioca (actor).");
  }

  return {
    actorUserId: input.actor.id ?? null,
    // Ime i uloga se zamrzavaju u trenutku radnje: red ostaje čitljiv i kada
    // korisnik kasnije promeni ulogu ili bude deaktiviran.
    actorLabel: `${input.actor.name} (${input.actor.role})`,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    entityLabel: input.entityLabel ?? null,
    valueBefore:
      input.before === undefined ? null : redactSensitive(input.before),
    valueAfter: input.after === undefined ? null : redactSensitive(input.after),
    reason: input.reason ?? null,
    correlationId: input.correlationId ?? null,
  };
}

/** Radnje koje se obavezno beleže — spisak raste sa fazama 2–5. */
export const AUDIT_ACTIONS = {
  roleChanged: "Promena uloge korisnika",
  permissionGranted: "Dodeljen paket dozvola",
  permissionRevoked: "Oduzet paket dozvola",
  userCreated: "Kreiran korisnik",
  userDeactivated: "Deaktiviran korisnik",
  settingChanged: "Izmena sistemskog praga",
  loginFailed: "Neuspela prijava",
  loginLocked: "Nalog privremeno zaključan",
  importCompleted: "Uvoz faktura izvršen",
  importDuplicateAttempt: "Ponovljen pokušaj uvoza istog fajla",
  importManual: "Ručno pokrenut uvoz",
  exportGenerated: "Izvoz podataka",
  dataCorrection: "Ručna ispravka podataka",
};
