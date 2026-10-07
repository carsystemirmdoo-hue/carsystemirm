/**
 * Stanje uređaja iz izveštaja ciklusa — čista funkcija, bez baze i sata.
 *
 * Razdvaja tri stvari:
 *   - javljanje (`lastSeenAt`): bilo koji potpisan zahtev;
 *   - ciklus (`lastCycleAt`, `lastCycleOutcome`): obrađen, preskočen po rasporedu, greška;
 *   - uspešno skeniranje (`lastScanCompletedAt`): ceo izvor je obiđen.
 *
 * „Računar ne radi" se prepoznaje po izostanku ciklusa posle termina koji je
 * uređaj SAM najavio (`nextExpectedCycleAt`, Europe/Belgrade, radni dani i
 * praznici). Server ne pogađa raspored: ne zna praznike ni ručna pokretanja.
 */

/**
 * Koliko posle najavljenog termina ciklus sme da kasni pre upozorenja.
 * 75 min = najavljeni termin i sledeći okidač (sat kasnije) su oba prošli bez
 * izveštaja; jedan zakasneli ili spor ciklus ne pravi lažnu uzbunu.
 */
export const TOLERANCIJA_KASNJENJA_MIN = 75;

/**
 * @param {{ now: Date, status: string, lastSeenAt: Date | null, lastCycleAt: Date | null,
 *           lastCycleOutcome: "obradjeno" | "preskoceno" | "greska" | null,
 *           lastScanCompletedAt: Date | null, nextExpectedCycleAt: Date | null }} u
 * @returns {{ kod: string, ton: "success" | "warning" | "danger" | "neutral", kasniOd: Date | null }}
 */
export function stanjeUredjaja(u) {
  if (u.status !== "active") return { kod: "neaktivan", ton: "neutral", kasniOd: null };
  if (!u.lastCycleAt) return { kod: "bez_izvestaja", ton: "neutral", kasniOd: null };

  if (u.nextExpectedCycleAt) {
    const granica = u.nextExpectedCycleAt.getTime() + TOLERANCIJA_KASNJENJA_MIN * 60_000;
    if (u.now.getTime() > granica) {
      return { kod: "nema_ciklusa", ton: "warning", kasniOd: u.nextExpectedCycleAt };
    }
  }
  if (u.lastCycleOutcome === "greska") return { kod: "greska", ton: "danger", kasniOd: null };
  if (u.lastCycleOutcome === "preskoceno") return { kod: "preskoceno", ton: "success", kasniOd: null };
  return { kod: "obradjeno", ton: "success", kasniOd: null };
}

/** Tekst stanja za ekran. Vremena se formatiraju u Europe/Belgrade. */
export function opisStanja(stanje, u, formatiraj) {
  switch (stanje.kod) {
    case "neaktivan":
      return "Uređaj nije aktivan.";
    case "bez_izvestaja":
      return "Uređaj još ne šalje izveštaj ciklusa (konektor pre 0.3.9); prikazano je samo poslednje javljanje.";
    case "nema_ciklusa":
      return `Nema ciklusa posle ${formatiraj(u.lastCycleAt)}; sledeći je bio očekivan u ${formatiraj(stanje.kasniOd)}. Proveriti da li je kancelarijski računar uključen i nalog prijavljen.`;
    case "greska":
      return `Poslednji ciklus (${formatiraj(u.lastCycleAt)}) završio je greškom.`;
    case "preskoceno":
      return `Poslednji ciklus (${formatiraj(u.lastCycleAt)}) preskočen po rasporedu — računar radi.`;
    default:
      return `Poslednji ciklus (${formatiraj(u.lastCycleAt)}) obrađen.`;
  }
}
