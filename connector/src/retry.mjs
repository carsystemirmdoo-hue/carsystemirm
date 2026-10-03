/**
 * Oporavak od PRIVREMENIH grešaka u toku ciklusa — čista pravila, bez sata.
 *
 * Ranije je svaka privremena greška (429, prekid veze, 5xx) odlagala stavku do
 * sledećeg radnog dana u 9:00. Na generalnoj probi talasa 01 to je značilo da
 * pet računa koji su dobili 429 čeka ponedeljak, iako je server bio spreman
 * posle nekoliko minuta. Sada:
 *
 *  - 429 sa vremenom (`Retry-After` ili `retryAfterSeconds`): čeka se tačno
 *    toliko ako staje u `maxCekanjeMs`; inače ciklus staje i beleži kada sme
 *    da nastavi — sledeći `run-once` pre tog trenutka ništa ne šalje;
 *  - 429 bez vremena, prekid veze, 5xx: postepeno produžavanje čekanja
 *    (5 s, 10 s, 20 s, 40 s, 60 s …), najviše `maxPokusajaUCiklusu` uzastopno;
 *    posle toga ciklus staje, a red ostaje netaknut za sledeće pokretanje;
 *  - ista stavka posle `maxPokusajaStavke` slanja ide na staro pravilo
 *    (sledeći radni dan), da jedan problematičan dokument ne zaustavi talas.
 *
 * Trajne greške (pregled, odbijeno, blokirano) se ovde ne dodiruju.
 */

export const PODRAZUMEVANA_POLITIKA = Object.freeze({
  /** Najduže čekanje koje ciklus odčeka sam; duže → ciklus staje. */
  maxCekanjeMs: 120_000,
  /** Prvo čekanje kada server ne kaže koliko. */
  pocetnoMs: 5_000,
  faktor: 2,
  /** Najduži pojedinačni korak postepenog čekanja. */
  maxKorakMs: 60_000,
  /** Uzastopnih privremenih neuspeha u jednom ciklusu pre zaustavljanja. */
  maxPokusajaUCiklusu: 5,
  /** Ukupno slanja jedne stavke (kroz sve cikluse) pre odlaganja za sledeći radni dan. */
  maxPokusajaStavke: 12,
});

/**
 * @param {{ vrsta: "rate_limit" | "server" | "transport", retryAfterSec: number | null,
 *           uzastopno: number, politika?: typeof PODRAZUMEVANA_POLITIKA }} ulaz
 *   `uzastopno` — koji je ovo uzastopni privremeni neuspeh u ciklusu (1, 2, …)
 * @returns {{ cekajMs: number, izvor: "retry_after" | "postepeno" } |
 *           { stani: true, nastaviPosleMs: number, razlog: string }}
 */
export function cekanjeZa({ vrsta, retryAfterSec, uzastopno, politika = PODRAZUMEVANA_POLITIKA }) {
  const korak = Math.min(politika.pocetnoMs * politika.faktor ** Math.max(0, uzastopno - 1), politika.maxKorakMs);
  if (vrsta === "rate_limit" && retryAfterSec !== null && retryAfterSec !== undefined) {
    const ms = Math.max(1_000, retryAfterSec * 1_000);
    if (ms > politika.maxCekanjeMs || uzastopno > politika.maxPokusajaUCiklusu) {
      return { stani: true, nastaviPosleMs: ms, razlog: "rate_limited" };
    }
    return { cekajMs: ms, izvor: "retry_after" };
  }
  if (uzastopno > politika.maxPokusajaUCiklusu) {
    return {
      stani: true,
      nastaviPosleMs: korak,
      razlog: vrsta === "rate_limit" ? "rate_limited" : vrsta === "transport" ? "server_nedostupan" : "server_privremeno",
    };
  }
  return { cekajMs: korak, izvor: "postepeno" };
}

/**
 * Vrsta privremenog neuspeha, ili `null` ako ishod nije privremen.
 *
 * @param {{ transport: string, httpStatus: number, code: string | null }} odgovor
 */
export function vrstaPrivremenog(odgovor) {
  if (odgovor.transport !== "ok") return "transport";
  if (odgovor.httpStatus === 429 || odgovor.code === "rate_limited") return "rate_limit";
  if (
    odgovor.httpStatus >= 500 ||
    odgovor.code === "temporarily_unavailable" ||
    odgovor.code === "ingest_failed"
  ) {
    return "server";
  }
  return null;
}
