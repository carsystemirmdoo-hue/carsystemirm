/**
 * Potvrđene ispravke engleskog zapisa hiljada („7,500 o/min” → „7.500 o/min”), proizvod po proizvod.
 *
 * Na srpskom se zapeta čita kao decimalni znak, pa „1,000 g” znači jedan gram. Ispravka se NE
 * izvodi iz jedinice ni broja cifara: svaka vrednost ovde ima dokaz u izvornom dokumentu
 * (provera 2026-10-14). Vrednost koje nema na spisku ostaje kako je zapisana — npr. C.A.R.FIT
 * „1,095 g/cm³”, „168,408 g/l” i „13,536%” su decimale (izvor piše decimale zapetom), a
 * Carsystem „2,523 kg” i „0,820 kg” su takođe decimale. Carsystem izvor meša konvencije
 * („2,523 kg cartridge” uz atribut „2.523 kg”), pa se ni za njega ne primenjuje opšte pravilo.
 */
export type VerifiedThousands = { from: string; to: string; evidence: string };

const CARSYSTEM_LAMP =
  "Carsystem TDS tds-colour-match-lamp-v03.pdf: „1. Step: 2,700 K …”; isti list piše decimale tačkom („2.5 hours”, „3.7V”)";

export const verifiedThousands: Record<string, VerifiedThousands[]> = {
  "carsystem-colour-match-lamp": [
    { from: "2,700K", to: "2.700 K", evidence: CARSYSTEM_LAMP },
    { from: "4,500K", to: "4.500 K", evidence: CARSYSTEM_LAMP },
    { from: "6,500K", to: "6.500 K", evidence: CARSYSTEM_LAMP },
  ],
  "carsystem-fill-putty": [
    {
      from: "1,000 g",
      to: "1.000 g",
      evidence: "carsystem.org fotografija artikla 124.552: „124552-cs-fuellspachtel-inkl-haerter-1_0-kg.webp” (1,0 kg)",
    },
  ],
  // carsystem-fine-putty 124.126 („1,000 g tin”) NIJE na spisku: nema fotografije ni stavke u
  // katalogu, a tekst i atribut („1.000 g”) su dvosmisleni — izdvojeno za potvrdu.
  "carsystem-polyester-repair-resin": [
    {
      from: "1,000 g",
      to: "1.000 g",
      evidence: "Carsystem katalog 2026/27 „1,000 g incl. hardener”, fotografija 126.050 „…-1000g-3D.png”",
    },
  ],
  "carsystem-rupes-mini-random-orbital-sander-ld30": [
    { from: "7,500 o/min", to: "7.500 o/min", evidence: "rupes.com LD30: R.P.M. 7500" },
  ],
  "carsystem-rupes-polishing-machine-lhr75": [
    { from: "11,000 o/min", to: "11.000 o/min", evidence: "rupes.com LHR75: R.P.M. 0 – 11000" },
  ],
  "carsystem-rupes-polishing-machine-lhr75e": [
    { from: "5,500 o/min", to: "5.500 o/min", evidence: "rupes.com LHR75E: R.P.M. 4000-5500" },
  ],
  "carsystem-rupes-random-orbital-sander-er": [
    { from: "10,000 o/min", to: "10.000 o/min", evidence: "rupes.com ER303TE/ER305TE: R.P.M. 5000-10000" },
  ],
  "carsystem-rupes-random-orbital-sander-ta50": [
    { from: "15,000 o/min", to: "15.000 o/min", evidence: "rupes.com TA50: R.P.M. 15000" },
  ],
  "carsystem-rupes-vacuum-cleaner-s145": [
    { from: "3,400 L/min", to: "3.400 L/min", evidence: "rupes.com S145: Air flow 3400 l/min" },
    { from: "1,200 W", to: "1.200 W", evidence: "rupes.com S145: Power 1×1200 W" },
    { from: "2,400 W", to: "2.400 W", evidence: "rupes.com S145: Max power socket 1×2400 W" },
  ],
};

/** Primena potvrđenih ispravki na jedan tekst proizvoda (tačno poklapanje zapisa). */
export function applyVerifiedThousands(slug: string, text: string): string {
  const fixes = verifiedThousands[slug];
  if (!fixes || typeof text !== "string" || !text.includes(",")) return text;
  return fixes.reduce((value, fix) => value.split(fix.from).join(fix.to), text);
}
