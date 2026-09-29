/**
 * Da li je obračun preporuka još aktuelan za jednog kupca — čista funkcija.
 *
 * Obračun (`cadence_v1`) je snimak: čita potvrđene dokumente u trenutku
 * pokretanja i računa statuse „na dan" obračuna. Posle toga mogu nastati dve
 * različite stvari, i obe se ovde razlikuju:
 *
 *   `new_documents` — za kupca je stigao potvrđen dokument koji obračun nije
 *       video (uvezen posle početka obračuna, ili izdat posle dana obračuna).
 *       Status i savet su tada možda POGREŠNI (kupac je upravo kupio „kasni"
 *       artikal). Konkretan savet se ne prikazuje dok se obračun ne ponovi.
 *
 *   `aged` — novih dokumenata nema, ali je od dana obračuna prošlo vreme.
 *       Status je tačan za dan obračuna; danas je možda strožiji („uskoro"
 *       postaje „kasni"). Prikazuje se uz upozorenje.
 */

import { dayNumber } from "./cadence.mjs";

/** Posle ovoliko dana bez novog obračuna, statusi se označavaju kao stari. */
export const AGED_AFTER_DAYS = 2;

/**
 * @param {{
 *   run: { asOfDate: string, startedAt: Date } | null,
 *   documents: readonly { issuedOn: string, ingestedAt: Date | null }[],
 *   today: string,
 * }} input
 * @returns {{
 *   state: "no_run" | "current" | "aged" | "new_documents",
 *   newDocuments: { issuedOn: string, ingestedAt: Date | null }[],
 *   runAgeDays: number | null,
 * }}
 */
export function freshnessOf({ run, documents, today }) {
  if (!run) return { state: "no_run", newDocuments: [], runAgeDays: null };
  const asOf = dayNumber(run.asOfDate);
  const startedAt = run.startedAt.getTime();
  const newDocuments = documents.filter(
    (d) => dayNumber(d.issuedOn) > asOf || (d.ingestedAt !== null && d.ingestedAt.getTime() > startedAt),
  );
  const runAgeDays = dayNumber(today) - asOf;
  if (newDocuments.length > 0) return { state: "new_documents", newDocuments, runAgeDays };
  if (runAgeDays >= AGED_AFTER_DAYS) return { state: "aged", newDocuments, runAgeDays };
  return { state: "current", newDocuments, runAgeDays };
}
