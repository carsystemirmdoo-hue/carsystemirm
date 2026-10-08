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

  /*
   * Satni ciklus u radnom vremenu (`ciklus` u konfiguraciji, docs/b2b/49):
   * fakture izdate tokom dana ne čekaju sledeće jutro. Odluka gleda VREME
   * poslednjeg ciklusa; posle kraja radnog vremena najviše jedan naknadni
   * ciklus (računar upaljen kasno). Preklapanje sprečava brava reda.
   */
  if (ulaz.ciklus) {
    return odlukaUnutarRadnogVremena(ulaz, lokalno, pokrivenost);
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

const minutaU = (hhmm) => {
  const [h, m] = String(hhmm).split(":").map(Number);
  return h * 60 + m;
};
const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
/** Tolerancija: okidač u :02 i ciklus koji je trajao minut ne smeju da preskoče ceo sat. */
const TOLERANCIJA_MIN = 5;

/**
 * @param {{ now: Date, ciklus: { od: string, do: string, svakihMinuta: number },
 *           poslednjiCiklusVreme?: string | null }} ulaz
 */
function odlukaUnutarRadnogVremena(ulaz, lokalno, pokrivenost) {
  const od = minutaU(ulaz.ciklus.od);
  const doKraja = minutaU(ulaz.ciklus.do);
  const sada = lokalno.sat * 60 + lokalno.minut;
  const poslednji = ulaz.poslednjiCiklusVreme ? new Date(ulaz.poslednjiCiklusVreme) : null;
  const poslednjiLokalno = poslednji ? lokalnoVreme(poslednji) : null;
  const poslednjiDanas = poslednjiLokalno && poslednjiLokalno.datum === lokalno.datum;
  const proteklo = poslednji ? (ulaz.now.getTime() - poslednji.getTime()) / 60000 : Infinity;

  if (sada < od) {
    return { akcija: "cekaj", razlog: "pre_radnog_vremena", sledeciTermin: `${lokalno.datum} ${ulaz.ciklus.od}`, lokalnoVreme: lokalno, pokrivenost };
  }
  if (sada <= doKraja) {
    if (proteklo >= ulaz.ciklus.svakihMinuta - TOLERANCIJA_MIN) {
      return { akcija: "pokreni", razlog: "radno_vreme", lokalnoVreme: lokalno, pokrivenost };
    }
    return { akcija: "cekaj", razlog: "ceka_sledeci_ciklus", lokalnoVreme: lokalno, pokrivenost };
  }
  // Posle kraja radnog vremena: jedan naknadni ciklus ako danas nije bilo ciklusa posle kraja.
  const poslednjiMin = poslednjiDanas ? poslednjiLokalno.sat * 60 + poslednjiLokalno.minut : -1;
  if (poslednjiMin < doKraja) {
    return { akcija: "pokreni", razlog: "naknadni_kraj_dana", lokalnoVreme: lokalno, pokrivenost };
  }
  return { akcija: "cekaj", razlog: "posle_radnog_vremena", lokalnoVreme: lokalno, pokrivenost };
}

/** Sledeći termin u satnom režimu — za `status`; ne menja ništa. */
export function sledeciTerminRadnoVreme(ulaz) {
  const lokalno = lokalnoVreme(ulaz.now);
  const opcije = { dodatnaZatvaranja: ulaz.dodatnaZatvaranja ?? [] };
  /*
   * Stvarni sledeći okidač (HH:02) na kome će ciklus raditi — isto što
   * heartbeat šalje kao očekivano sledeće javljanje. Ranije je ovde stajalo
   * „poslednji + 60 min" (npr. 12:32), a u to vreme okidača nema.
   */
  const okidac = sledeciOkidacSaRadom({ ...ulaz, dodatnaZatvaranja: opcije.dodatnaZatvaranja });
  if (okidac) {
    const l = lokalnoVreme(okidac);
    return `${l.datum} ${hhmm(l.sat * 60 + l.minut)}`;
  }
  return `${prviRadniDanOd(dodajDana(lokalno.datum, 1), opcije)} ${ulaz.ciklus.od}`;
}

/* =========================================================================
 * Sledeći stvarni okidač i vreme sa vremenskom zonom (heartbeat, 0.3.9)
 * ====================================================================== */

/**
 * Pomak okidača zakazanog zadatka u odnosu na pun sat.
 *
 * `windows/task.ps1` registruje okidač u 08:02 sa ponavljanjem svakih sat
 * vremena (08:02, 09:02 … 19:02). Ako se tamo promeni, menja se i ovde.
 */
export const OKIDAC_POMAK_MIN = 2;

/** Pomak zone u minutama za dati trenutak (npr. +120 leti, +60 zimi). */
function pomakZone(trenutak, zona = VREMENSKA_ZONA) {
  const deo = new Intl.DateTimeFormat("en-US", { timeZone: zona, timeZoneName: "longOffset" })
    .formatToParts(trenutak)
    .find((d) => d.type === "timeZoneName")?.value ?? "GMT";
  const m = /GMT([+-])(\d{2}):?(\d{2})?/.exec(deo);
  if (!m) return 0;
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}

/**
 * Apsolutni trenutak za beogradski zidni sat (`datum` GGGG-MM-DD, sat, minut).
 * Dva prolaza dovoljna su i oko prelaska na letnje/zimsko vreme.
 */
export function beogradskiTrenutak(datum, sat, minut) {
  const [g, m, d] = datum.split("-").map(Number);
  const kaoUtc = Date.UTC(g, m - 1, d, sat, minut);
  let t = kaoUtc - pomakZone(new Date(kaoUtc)) * 60_000;
  t = kaoUtc - pomakZone(new Date(t)) * 60_000;
  return new Date(t);
}

/**
 * ISO 8601 sa pomakom zone, npr. `2026-10-07T15:02:00+02:00`.
 * Vremena u heartbeat-u nose zonu — server ih čuva kao `timestamptz`.
 */
export function isoBeograd(trenutak) {
  const l = lokalnoVreme(trenutak);
  const sek = new Intl.DateTimeFormat("en-GB", { timeZone: VREMENSKA_ZONA, second: "2-digit" })
    .format(trenutak)
    .padStart(2, "0");
  const p = pomakZone(trenutak);
  const znak = p < 0 ? "-" : "+";
  const a = Math.abs(p);
  const hh = (n) => String(n).padStart(2, "0");
  return `${l.datum}T${hh(l.sat)}:${hh(l.minut)}:${sek}${znak}${hh(Math.floor(a / 60))}:${hh(a % 60)}`;
}

/**
 * Prvi sledeći okidač zadatka posle kog će ciklus STVARNO raditi.
 *
 * Okidači su u HH:02 od `ciklus.od` do `ciklus.do`, radnim danima. Okidač koji
 * dođe pre isteka `svakihMinuta − tolerancija` od poslednjeg ciklusa konektor
 * preskače (`ceka_sledeci_ciklus`), pa se ne računa kao očekivan rad.
 * Primer: ručno pokretanje u 11:32 → 12:02 se preskače, sledeći rad je 13:02.
 *
 * @param {{ now: Date, ciklus: { od: string, do: string, svakihMinuta: number } | null,
 *           poslednjiCiklusVreme?: string | null, dodatnaZatvaranja?: readonly string[] }} ulaz
 * @returns {Date | null}  `null` kada satni raspored nije podešen
 */
export function sledeciOkidacSaRadom(ulaz) {
  if (!ulaz.ciklus) return null;
  const opcije = { dodatnaZatvaranja: ulaz.dodatnaZatvaranja ?? [] };
  const [odSat] = ulaz.ciklus.od.split(":").map(Number);
  const [doSat, doMin] = ulaz.ciklus.do.split(":").map(Number);
  const poslednji = ulaz.poslednjiCiklusVreme ? new Date(ulaz.poslednjiCiklusVreme) : null;
  const minRazmak = (ulaz.ciklus.svakihMinuta - TOLERANCIJA_MIN) * 60_000;

  const doKraja = doSat * 60 + doMin;
  const poslednjiLokalno = poslednji ? lokalnoVreme(poslednji) : null;

  let datum = lokalnoVreme(ulaz.now).datum;
  for (let dan = 0; dan < 40; dan += 1) {
    if (jeRadniDan(datum, opcije)) {
      for (let sat = odSat; sat <= doSat; sat += 1) {
        const okidac = beogradskiTrenutak(datum, sat, OKIDAC_POMAK_MIN);
        if (okidac <= ulaz.now) continue;
        if (sat * 60 + OKIDAC_POMAK_MIN > doKraja) {
          // Okidač posle kraja radnog vremena: isto pravilo kao `naknadni_kraj_dana`.
          const vecPosleKraja =
            poslednjiLokalno?.datum === datum &&
            poslednjiLokalno.sat * 60 + poslednjiLokalno.minut >= doKraja;
          if (vecPosleKraja) continue;
        } else if (poslednji && okidac.getTime() - poslednji.getTime() < minRazmak) {
          continue;
        }
        return okidac;
      }
    }
    datum = dodajDana(datum, 1);
  }
  return null;
}
