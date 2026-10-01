/**
 * „Zapamti me" za kupce — čista pravila (bez baze, bez kolačića).
 *
 * Token ne produžava JWT: kada 8-časovna sesija istekne, važeći token
 * zamenjuje se novim (rotacija) i izdaje se nova 8-časovna sesija. Porodica
 * tokena (`family_id`) traje najduže 30 dana od prijave lozinkom.
 */

export const REMEMBER_DAYS = 30;
export const REMEMBER_MS = REMEMBER_DAYS * 24 * 60 * 60 * 1000;
/** Najviše zapamćenih uređaja po nalogu; višak gasi najstariji. */
export const MAX_REMEMBERED_DEVICES = 5;
/**
 * Dve kartice istog pregledača mogu istovremeno pokušati obnovu istim
 * tokenom. U ovom prozoru posle rotacije stari token se samo odbija, bez
 * gašenja porodice — inače bi običan korisnik bio izbačen sa svih uređaja.
 */
export const ROTATION_GRACE_MS = 60 * 1000;
export const GRANT_TTL_MS = 60 * 1000;

export function isRememberEnabled(env = process.env) {
  return env.CUSTOMER_REMEMBER_ME === "1";
}

/**
 * Odluka o tokenu koji je pregledač poslao.
 *
 * @param {{
 *   revokedAt: Date | null, revokedReason: string | null, expiresAt: Date,
 *   sessionVersion: number,
 * } | null} row
 * @param {{ status: string, sessionVersion: number, canSignIn: boolean } | null} account
 * @param {Date} now
 * @returns {{ action: "rotate" } | { action: "reject", reason: string } | { action: "revoke_family", reason: string }}
 */
export function decideRedemption(row, account, now) {
  if (!row) return { action: "reject", reason: "unknown" };
  if (row.revokedAt) {
    if (row.revokedReason === "rotated") {
      // Stari token posle rotacije: u kratkom prozoru je to druga kartica;
      // kasnije je to ponovna upotreba — mogući ukraden token.
      return now.getTime() - row.revokedAt.getTime() <= ROTATION_GRACE_MS
        ? { action: "reject", reason: "rotated_recently" }
        : { action: "revoke_family", reason: "reuse_detected" };
    }
    return { action: "reject", reason: "revoked" };
  }
  if (row.expiresAt.getTime() <= now.getTime()) return { action: "reject", reason: "expired" };
  if (!account || !account.canSignIn) return { action: "revoke_family", reason: "account_inactive" };
  // Odjava sa svih uređaja, promena/reset lozinke i isključenje povećavaju verziju.
  if (account.sessionVersion !== row.sessionVersion) return { action: "revoke_family", reason: "session_revoked" };
  return { action: "rotate" };
}

/**
 * Kratak opis uređaja za spisak „Zapamćeni uređaji". Bez IP adrese i bez
 * celog user-agent niza — dovoljno da kupac prepozna svoj uređaj.
 */
export function deviceLabel(userAgent) {
  const ua = String(userAgent ?? "");
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Pregledač";
  const os = /iPhone|iPad/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Mac OS X/.test(ua)
        ? "macOS"
        : /Windows/.test(ua)
          ? "Windows"
          : /Linux/.test(ua)
            ? "Linux"
            : "nepoznat sistem";
  return `${browser}, ${os}`;
}

export const REVOKE_REASON_LABELS = {
  rotated: "zamenjen novim",
  logout: "odjava na uređaju",
  logout_all: "odjava sa svih uređaja",
  password_changed: "promena lozinke",
  reuse_detected: "ponovna upotreba starog tokena",
  session_revoked: "sesije opozvane",
  account_inactive: "nalog isključen",
  device_limit: "premašen broj uređaja",
};
