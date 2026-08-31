import { dodajDana, jeRadniDan, opisiPokrivenost, prviRadniDanOd, razlogNeradnog } from "./calendar.mjs";

/**
 * Kada se sme pokrenuti automatski ciklus — čista logika, sat se ubacuje.
 *
 * Nijedna funkcija ovde ne zove `Date.now()` sama: sve primaju `now`. Bez toga
 * bi se raspored mogao testirati samo čekanjem petka, praznika i prelaska
 * godine.
 */

export const VREME_TERMINA = { sat: 9, minut: 0 };
export const VREMENSKA_ZONA = "Europe/Belgrade";

/**
 * Lokalni zidni sat u Beogradu iz apsolutnog trenutka.
 *
 * `Intl` je jedini ispravan put: fiksni UTC+1 bi bio pogrešan pola godine, a
 * ručno računanje DST prelaza je greška koja se vidi dvaput godišnje i uvek u
 * pogrešnom trenutku.
 *
 * @param {Date} now
 * @returns {{ datum: string, sat: number, minut: number }}
 */
export function lokalnoVreme(now, zona = VREMENSKA_ZONA) {
  const delovi = new Intl.DateTimeFormat("en-CA", {
    timeZone: zona,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const uzmi = (tip) => delovi.find((d) => d.type === tip)?.value ?? "";
  // `hour12: false` ume da da „24" za ponoć; svodi se na 0.
  const sat = Number(uzmi("hour")) % 24;
  return {
    datum: `${uzmi("year")}-${uzmi("month")}-${uzmi("day")}`,
    sat,
    minut: Number(uzmi("minute")),
  };
}

/** Da li je lokalno vreme dostiglo termin tog dana. */
function posleTermina(lokalno) {
  return (
    lokalno.sat > VREME_TERMINA.sat ||
    (lokalno.sat === VREME_TERMINA.sat && lokalno.minut >= VREME_TERMINA.minut)
  );
}

/**
 * Odluka o automatskom ciklusu.
 *
 * Tri situacije se namerno razlikuju, jer traže različito ponašanje:
 *
 *  1. `pokreni` — danas je radni dan, prošlo je 09:00, a ciklus za ovaj datum
 *     još nije izvršen;
 *  2. `cekaj` — termin još nije stigao, ili danas nije radni dan;
 *  3. `blokirano` — kalendar ne pokriva ovu godinu.
 *
 * Propušten termin daje NAJVIŠE JEDAN naknadni ciklus, i to za tekući dan.
 * Konektor koji je bio ugašen nedelju dana ne sme da izvrši pet ciklusa
 * zaredom — preostali red i novo skeniranje se ionako obrađuju u jednom
 * ograničenom prolazu.
 *
 * @param {{ now: Date, poslednjiIzvrsenDatum: string | null,
 *           odlozenoDo?: string | null, dodatnaZatvaranja?: readonly string[] }} ulaz
 */
export function odlukaOCiklusu(ulaz) {
  const lokalno = lokalnoVreme(ulaz.now);
  const godina = Number(lokalno.datum.slice(0, 4));
  const pokrivenost = opisiPokrivenost(godina);

  if (!pokrivenost.pokrivena) {
    /*
     * Van pokrivenosti kalendara se NE radi.
     *
     * Alternativa bi bila „ponašaj se kao da je ponedeljak–petak“, a to bi
     * značilo slanje na Novu godinu čim istekne poslednja pregledana godina.
     */
    return {
      akcija: "blokirano",
      razlog: "calendar_unverified",
      lokalnoVreme: lokalno,
      pokrivenost,
    };
  }

  const opcije = { dodatnaZatvaranja: ulaz.dodatnaZatvaranja ?? [] };

  /*
   * Odlaganje posle neuspeha ima prednost nad svime.
   *
   * `odlozenoDo` je lokalni datum najranijeg sledećeg pokušaja. Bez ove grane
   * bi neuspeo ciklus bio ponovljen odmah pri sledećem pokretanju procesa, i
   * konektor koji se restartuje u petlji bi tukao server.
   */
  if (ulaz.odlozenoDo && lokalno.datum < ulaz.odlozenoDo) {
    return {
      akcija: "cekaj",
      razlog: "odlozeno_do_sledeceg_termina",
      sledeciTermin: ulaz.odlozenoDo,
      lokalnoVreme: lokalno,
      pokrivenost,
    };
  }

  if (!jeRadniDan(lokalno.datum, opcije)) {
    return {
      akcija: "cekaj",
      razlog: "neradni_dan",
      detalj: razlogNeradnog(lokalno.datum, opcije),
      sledeciTermin: prviRadniDanOd(dodajDana(lokalno.datum, 1), opcije),
      lokalnoVreme: lokalno,
      pokrivenost,
    };
  }

  if (ulaz.poslednjiIzvrsenDatum === lokalno.datum) {
    return {
      akcija: "cekaj",
      razlog: "vec_izvrseno_danas",
      sledeciTermin: prviRadniDanOd(dodajDana(lokalno.datum, 1), opcije),
      lokalnoVreme: lokalno,
      pokrivenost,
    };
  }

  if (!posleTermina(lokalno)) {
    return {
      akcija: "cekaj",
      razlog: "pre_termina",
      sledeciTermin: lokalno.datum,
      lokalnoVreme: lokalno,
      pokrivenost,
    };
  }

  /*
   * Ovde smo i kada je termin propušten (npr. računar upaljen u 14:00) — to je
   * upravo taj JEDAN naknadni ciklus. Ne postoji petlja po propuštenim danima:
   * `poslednjiIzvrsenDatum` se posle ovoga postavlja na današnji datum.
   */
  return {
    akcija: "pokreni",
    razlog: posleTermina(lokalno) && lokalno.sat > VREME_TERMINA.sat ? "naknadni" : "redovan",
    lokalnoVreme: lokalno,
    pokrivenost,
  };
}

/**
 * Najraniji sledeći termin posle neuspelog pokušaja.
 *
 * Uvek SLEDEĆI radni dan, nikad „za nekoliko sekundi“. Neuspeh je najčešće
 * nedostupan server ili mreža; ponavljanje u petlji ne popravlja nijedno od
 * toga, a pravi saobraćaj i buku u logu.
 */
export function sledeciPokusajPosleNeuspeha(lokalniDatum, opcije = {}) {
  return prviRadniDanOd(dodajDana(lokalniDatum, 1), opcije);
}

/**
 * Sledeći termin za prikaz u `status`.
 *
 * Odvojeno od odluke, jer `status` sme da se pozove u bilo kom trenutku i ne
 * sme ništa da menja.
 */
export function sledeciTermin(ulaz) {
  const lokalno = lokalnoVreme(ulaz.now);
  const opcije = { dodatnaZatvaranja: ulaz.dodatnaZatvaranja ?? [] };
  const godina = Number(lokalno.datum.slice(0, 4));
  if (!opisiPokrivenost(godina).pokrivena) return null;

  if (ulaz.odlozenoDo && lokalno.datum < ulaz.odlozenoDo) {
    return `${prviRadniDanOd(ulaz.odlozenoDo, opcije)} 09:00`;
  }
  const danasMoze =
    jeRadniDan(lokalno.datum, opcije) &&
    ulaz.poslednjiIzvrsenDatum !== lokalno.datum &&
    !posleTermina(lokalno);
  const datum = danasMoze
    ? lokalno.datum
    : prviRadniDanOd(dodajDana(lokalno.datum, 1), opcije);
  return `${datum} 09:00`;
}
