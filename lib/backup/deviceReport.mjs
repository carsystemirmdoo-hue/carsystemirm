/**
 * Izveštaj o kopiji koji firmin računar šalje POTPISANO na /api/sync/backup.
 *
 * Čista logika, bez baze: isti modul proverava izveštaj na računaru (pre
 * potpisivanja) i na serveru (posle provere potpisa). Bela lista polja —
 * samo brojevi, otisci i vreme; nikad putanje, imena fajlova ni podaci kupaca.
 *
 *   offsite_stored — šifrovana kopija baze preuzeta sa GitHub-a, otisak proveren,
 *                    sačuvana van GitHub-a. Server je prihvata samo ako se
 *                    `githubRunId` + `sifrovanSha256` poklapaju sa USPEŠNIM
 *                    `db_verified` zapisom (vidi migraciju 0037).
 *   pdf_backup     — dnevna inkrementalna šifrovana kopija izvornih PDF-ova.
 */

export const DEVICE_BACKUP_PATH = "/api/sync/backup";

const SHA_RE = /^[0-9a-f]{64}$/;
const RUN_RE = /^[0-9]{1,20}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
const MAX_INT = 2_000_000_000;
const count = (v) => Number.isInteger(v) && v >= 0 && v <= MAX_INT;

const SHAPES = {
  offsite_stored: {
    vrsta: (v) => v === "offsite_stored",
    githubRunId: (v) => typeof v === "string" && RUN_RE.test(v),
    sifrovanSha256: (v) => typeof v === "string" && SHA_RE.test(v),
    bajtova: count,
    kopijaOd: (v) => typeof v === "string" && ISO_RE.test(v) && Number.isFinite(Date.parse(v)),
    cuvaSe: count,
  },
  pdf_backup: {
    vrsta: (v) => v === "pdf_backup",
    pocetak: (v) => typeof v === "string" && ISO_RE.test(v) && Number.isFinite(Date.parse(v)),
    novih: count,
    promenjenih: count,
    nestalih: count,
    ukupnoObjekata: count,
  },
};

/**
 * @param {unknown} value
 * @returns {{ ok: true, report: Record<string, unknown> } | { ok: false, code: string }}
 */
export function checkDeviceBackupReport(value) {
  /** @type {(code: string) => { ok: false, code: string }} */
  const fail = (code) => ({ ok: false, code });
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail("report_not_object");
  const shape = SHAPES[/** @type {any} */ (value).vrsta];
  if (!shape) return fail("report_kind_unknown");
  const keys = Object.keys(value);
  if (keys.length !== Object.keys(shape).length || keys.some((k) => !(k in shape))) return fail("report_fields");
  for (const [k, ok] of Object.entries(shape)) if (!ok(/** @type {any} */ (value)[k])) return fail(`report_field_${k}`);
  return { ok: /** @type {const} */ (true), report: /** @type {Record<string, unknown>} */ (value) };
}

/**
 * Iz primljenih bajtova (server) — JSON, pa ista provera.
 * @param {Uint8Array} bytes
 * @returns {{ ok: true, report: Record<string, unknown> } | { ok: false, code: string }}
 */
export function parseDeviceBackupReport(bytes) {
  let value;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return { ok: false, code: "report_not_json" };
  }
  return checkDeviceBackupReport(value);
}
