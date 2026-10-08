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
 * zarezima odvojen spisak). Dok vrsta nije uključena, portal prikazuje
 * „Backup nije podešen“ i zanemaruje sve zapise te vrste — ni probni ni ručni
 * zapis ne sme da izgleda kao stvarna automatska kopija.
 * @param {Record<string, string | undefined>} env
 */
export function enabledBackupKinds(env = {}) {
  return String(env.BACKUP_AUTOMATION ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter((k) => BACKUP_KINDS.includes(k));
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
    return { kind, tone: "warning", state: "nije_podesen", ageHours: null, message: "Backup nije podešen — automatika ove kopije nije uključena." };
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
