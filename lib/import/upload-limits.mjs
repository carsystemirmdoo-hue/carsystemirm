/**
 * Granice otpremanja fajlova kroz server akcije portala.
 *
 * Jedno mesto za sve brojeve koje platforma nameće, da ekran, akcija i
 * `next.config.ts` ne bi pričali različite priče. Ranije je akcija dozvoljavala
 * 20 MB po fajlu i 200 MB po prolazu, a Next.js je podrazumevano odbijao svako
 * telo veće od 1 MB — provere u kodu nikad nisu dolazile na red, i operater je
 * dobijao opštu grešku umesto poruke.
 *
 * Vercel (dokumentacija „Vercel Functions Limits", provereno 2026-10-01):
 * - telo zahteva ili odgovora funkcije: najviše 4,5 MB (inače 413);
 * - trajanje: Hobby sa Fluid compute 300 s; bez Fluid compute Hobby ima
 *   najviše 60 s. Uzima se 60 s, jer važi u oba slučaja i na svakom planu.
 */

const MB = 1024 * 1024;

/**
 * Najveće telo jednog otpremanja (svi fajlovi zajedno plus polja obrasca).
 * Ispod 4,5 MB Vercela, sa rezervom za multipart zaglavlja.
 */
export const MAX_UPLOAD_REQUEST_BYTES = 4 * MB;

/** Isto, u obliku koji traži `experimental.serverActions.bodySizeLimit`. */
export const SERVER_ACTION_BODY_LIMIT = "4mb";

/** Najveći pojedinačni fajl. Ne može biti veći od celog zahteva. */
export const MAX_UPLOAD_FILE_BYTES = MAX_UPLOAD_REQUEST_BYTES;

/** Najviše PDF dokumenata u jednom otpremanju. */
export const MAX_PDF_FILES_PER_UPLOAD = 50;

/**
 * `maxDuration` (sekunde) za rute koje primaju otpremanje.
 * Mora biti broj napisan u samoj ruti (Next ga čita statički); test proverava
 * da se slaže sa ovom vrednošću.
 */
export const UPLOAD_ROUTE_MAX_DURATION_S = 60;

/**
 * Budžet obrade jednog prolaza. Mora biti kraći od `maxDuration`, da prolaz
 * stane sam i vrati izveštaj pre nego što ga platforma prekine (504).
 */
export const UPLOAD_PROCESSING_BUDGET_MS = 45 * 1000;

/** Čitljiva veličina za poruke na ekranu. */
export function formatMegabytes(bytes) {
  return `${Math.round((bytes / MB) * 10) / 10} MB`;
}

/**
 * Provera skupa izabranih fajlova pre slanja i na serveru.
 * Vraća poruku za korisnika ili `null` kada je skup prihvatljiv.
 *
 * @param {{ size: number }[]} files
 * @param {{ maxFiles?: number }} [options]
 */
export function uploadSelectionError(files, { maxFiles = MAX_PDF_FILES_PER_UPLOAD } = {}) {
  if (files.length > maxFiles) {
    return `Najviše ${maxFiles} dokumenata u jednom otpremanju.`;
  }
  const tooLarge = files.find((file) => file.size > MAX_UPLOAD_FILE_BYTES);
  if (tooLarge) {
    return `Pojedinačan fajl može imati najviše ${formatMegabytes(MAX_UPLOAD_FILE_BYTES)}.`;
  }
  const total = files.reduce((sum, file) => sum + file.size, 0);
  if (total > MAX_UPLOAD_REQUEST_BYTES) {
    return `Izabrani fajlovi zajedno imaju ${formatMegabytes(total)}; u jednom otpremanju može najviše ${formatMegabytes(MAX_UPLOAD_REQUEST_BYTES)}. Podelite ih u više otpremanja.`;
  }
  return null;
}
