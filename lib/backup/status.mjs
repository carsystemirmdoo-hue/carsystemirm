/**
 * Stanje rezervnih kopija za portal — čista pravila.
 *
 * Tri ODVOJENE tvrdnje, jer svaka dokazuje nešto drugo:
 *   db_verified     — kopija baze je napravljena iz jednog snimka i vraćena u
 *                     praznu bazu; manifest se poklopio. NE znači da je kopija
 *                     sačuvana van GitHub-a.
 *   offsite_stored  — šifrovana kopija je preuzeta, otisak proveren i sačuvana
 *                     van GitHub-a (firmin računar / oblak).
 *   pdf_backup      — dnevna inkrementalna kopija izvornih PDF-ova je završena.
 */

export const BACKUP_KINDS = ["db_verified", "offsite_stored", "pdf_backup"];

/** Granice u satima: posle `warn` žuto, posle `critical` crveno. */
export const BACKUP_THRESHOLDS = Object.freeze({
  db_verified: { warn: 30, critical: 54 },
  offsite_stored: { warn: 36, critical: 60 },
  pdf_backup: { warn: 36, critical: 60 },
});

export const BACKUP_LABELS = {
  db_verified: "Kopija baze proverena",
  offsite_stored: "Šifrovana kopija preuzeta i sačuvana van GitHub-a",
  pdf_backup: "Kopija izvornih PDF-ova",
};

/**
 * Koje vrste kopija su UKLJUČENE na ovom okruženju (`BACKUP_AUTOMATION`,
 * zarezima odvojen spisak). Prazan spisak = promenljiva nije zadata.
 * @param {Record<string, string | undefined>} env
 */
export function enabledBackupKinds(env = {}) {
  return String(env.BACKUP_AUTOMATION ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter((k) => BACKUP_KINDS.includes(k));
}

/**
 * Koje vrste se prikazuju kao stvarne kopije.
 *
 * Ako je `BACKUP_AUTOMATION` zadat, važi tačno on (ručno isključenje ostaje
 * moguće). Ako nije, vrsta je aktivna čim u bazi postoji zapis DOKAZIVOG
 * porekla (`hasEvidence`, vidi `TRUSTED_ORIGIN_SQL` u status-service):
 *   db_verified    — zapis GitHub prolaza (ima github_run_id, nije uređaj);
 *   offsite_stored — potpisana potvrda uređaja, prihvaćena samo za otisak
 *                    koji je GitHub prolaz proverio (0037);
 *   pdf_backup     — potpisana potvrda uređaja.
 * Ručni ili probni upis sa Mac-a nema to poreklo i ne aktivira ništa.
 * @param {Record<string, string | undefined>} env
 * @param {Partial<Record<string, boolean>>} hasEvidence
 */
export function activeBackupKinds(env = {}, hasEvidence = {}) {
  const explicit = enabledBackupKinds(env);
  if (String(env.BACKUP_AUTOMATION ?? "").trim() !== "") return explicit;
  return BACKUP_KINDS.filter((k) => hasEvidence[k] === true);
}

/**
 * @param {string} kind
 * @param {{ finishedAt: string, ok: boolean } | null} lastOk poslednji USPEŠAN zapis
 * @param {{ finishedAt: string, ok: boolean, detail?: string | null } | null} lastAny poslednji zapis uopšte
 * @param {Date} now
 */
export function classifyBackup(kind, lastOk, lastAny, now = new Date(), { enabled = true } = {}) {
  const t = BACKUP_THRESHOLDS[kind];
  if (!enabled) {
    return { kind, tone: "warning", state: "nije_podesen", ageHours: null, message: "Nije podešeno — ova vrsta kopije još ne radi." };
  }
  if (!lastOk) {
    return { kind, tone: "danger", state: "nikad", ageHours: null, message: "Još nema nijedne uspešne kopije." };
  }
  const ageHours = Math.max(0, (now.getTime() - Date.parse(lastOk.finishedAt)) / 3600000);
  const failedSince = lastAny && !lastAny.ok && Date.parse(lastAny.finishedAt) > Date.parse(lastOk.finishedAt);
  let tone = "success";
  let state = "u_redu";
  if (ageHours > t.critical) { tone = "danger"; state = "kasni_kriticno"; }
  else if (ageHours > t.warn) { tone = "warning"; state = "kasni"; }
  if (failedSince && tone === "success") { tone = "warning"; state = "poslednji_neuspeo"; }
  const message =
    state === "u_redu" ? "U redu."
    : state === "poslednji_neuspeo" ? `Poslednji pokušaj nije uspeo${lastAny?.detail ? `: ${lastAny.detail}` : ""}. Poslednja uspešna je još u roku.`
    : `Poslednja uspešna je starija od ${state === "kasni" ? t.warn : t.critical} h.`;
  return { kind, tone, state, ageHours: Math.round(ageHours * 10) / 10, message };
}
