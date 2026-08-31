/**
 * Radni dani u Srbiji — čista logika, bez I/O.
 *
 * Postoji zato što raspored glasi „radnim danima u 09:00“, a „radni dan“ nije
 * isto što i „ponedeljak–petak“. Bez kalendara bi konektor pokušavao slanje na
 * Božić i na Dan primirja, i to bi izgledalo kao kvar servera.
 *
 * IZVOR
 * -----
 * Zakon o državnim i drugim praznicima u Republici Srbiji
 * („Sl. glasnik RS“, br. 43/2001, 101/2007, 92/2011), članovi 1, 2, 3 i 3a.
 *
 * Ovo je zapis zakona, ne zvanična objava svake godine. Vlada povremeno
 * objavljuje pojedinačna rešenja (npr. pomeranja); ona ovde NISU uračunata.
 * Zato postoji `POKRIVENE_GODINE` i status `calendar_unverified` — vidi dole.
 */

/**
 * Godine za koje je kalendar pregledan.
 *
 * Van ovog opsega konektor NE tvrdi da zna raspored: `opisiPokrivenost` vraća
 * `calendar_unverified`, a automatski ciklus se ne izvršava. Tiho nastavljanje
 * bi značilo da sledeći 1. januar postane običan radni dan.
 */
export const POKRIVENE_GODINE = Object.freeze({ od: 2024, do: 2030 });

export const KALENDAR_IZVOR =
  "Zakon o državnim i drugim praznicima u Republici Srbiji " +
  '("Sl. glasnik RS", br. 43/2001, 101/2007, 92/2011)';

/** Verzija samog zapisa; menja se kad se pravila ili opseg promene. */
export const KALENDAR_VERZIJA = 1;

/**
 * Državni praznici sa fiksnim datumom.
 *
 * Na njih se primenjuje član 3a: kada padnu u NEDELJU, ne radi se prvog narednog
 * radnog dana.
 */
const DRZAVNI_FIKSNI = [
  { md: "01-01", naziv: "Nova godina" },
  { md: "01-02", naziv: "Nova godina (drugi dan)" },
  { md: "02-15", naziv: "Dan državnosti (Sretenje)" },
  { md: "02-16", naziv: "Dan državnosti (drugi dan)" },
  { md: "05-01", naziv: "Praznik rada" },
  { md: "05-02", naziv: "Praznik rada (drugi dan)" },
  { md: "11-11", naziv: "Dan primirja u Prvom svetskom ratu" },
];

/**
 * Verski praznik sa fiksnim datumom.
 *
 * NA NJEGA SE NE PRIMENJUJE pomeranje iz člana 3a — to pravilo zakon vezuje za
 * državne praznike. Odvojen je upravo zato da razlika bude vidljiva, a ne
 * posledica toga što je neko zaboravio.
 */
const VERSKI_FIKSNI = [{ md: "01-07", naziv: "Božić (pravoslavni)" }];

/**
 * Pravoslavni Vaskrs — julijanski Paschalion (Meeus), pa +13 dana.
 *
 * Pomak od 13 dana važi za 1900–2099; van toga se razlika menja, pa
 * `POKRIVENE_GODINE` ionako staje mnogo ranije.
 *
 * Provereno nad poznatim godinama pre ulaska u kod: 2024-05-05, 2025-04-20,
 * 2026-04-12, 2027-05-02, 2028-04-16.
 *
 * @param {number} godina
 * @returns {string} ISO datum Vaskrsa (nedelja)
 */
export function pravoslavniVaskrs(godina) {
  const a = godina % 4;
  const b = godina % 7;
  const c = godina % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const mesec = Math.floor((d + e + 114) / 31);
  const dan = ((d + e + 114) % 31) + 1;
  const julijanski = Date.UTC(godina, mesec - 1, dan);
  return new Date(julijanski + 13 * 86400000).toISOString().slice(0, 10);
}

const dodajDana = (iso, n) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

/** Dan u nedelji za ISO datum, po UTC — datum je već lokalni kalendarski dan. */
function danUNedelji(iso) {
  return new Date(`${iso}T00:00:00Z`).getUTCDay(); // 0 = nedelja
}

/**
 * Svi neradni dani jedne godine, sa nazivom.
 *
 * @param {number} godina
 * @returns {Map<string, string>} ISO datum → naziv
 */
export function prazniciZaGodinu(godina) {
  const mapa = new Map();
  const dodaj = (iso, naziv) => {
    if (!mapa.has(iso)) mapa.set(iso, naziv);
  };

  for (const p of DRZAVNI_FIKSNI) dodaj(`${godina}-${p.md}`, p.naziv);
  for (const p of VERSKI_FIKSNI) dodaj(`${godina}-${p.md}`, p.naziv);

  /*
   * Vaskršnji praznici: Veliki petak do drugog dana Vaskrsa.
   *
   * Subota i nedelja su ionako neradne; petak i ponedeljak su ti koji stvarno
   * pomeraju raspored. Svi se upisuju da bi status bio čitljiv.
   */
  const vaskrs = pravoslavniVaskrs(godina);
  dodaj(dodajDana(vaskrs, -2), "Veliki petak");
  dodaj(dodajDana(vaskrs, -1), "Velika subota");
  dodaj(vaskrs, "Vaskrs");
  dodaj(dodajDana(vaskrs, 1), "Drugi dan Vaskrsa");

  /*
   * Član 3a: državni praznik koji padne u NEDELJU pomera se na prvi naredni
   * radni dan.
   *
   * Primenjuje se odvojeno, posle svih upisa, i samo na državne — verski
   * praznik i Vaskrs po zakonu ne pomeraju.
   */
  for (const p of DRZAVNI_FIKSNI) {
    const iso = `${godina}-${p.md}`;
    if (danUNedelji(iso) !== 0) continue;
    let pomeren = dodajDana(iso, 1);
    // Preskače se sve što je već neradno, da se pomeranje ne „potroši“ uzalud.
    while (mapa.has(pomeren) || danUNedelji(pomeren) === 0 || danUNedelji(pomeren) === 6) {
      pomeren = dodajDana(pomeren, 1);
    }
    dodaj(pomeren, `${p.naziv} — pomereno (nedelja)`);
  }

  return mapa;
}

/**
 * Pokrivenost kalendara za datu godinu.
 *
 * Vraća `calendar_unverified` van pregledanog opsega. Pozivalac to MORA da
 * poštuje: prećutno proglašavanje rasporeda validnim je gore od zaustavljanja,
 * jer se vidi tek kad neko uporedi šta je poslato sa radnim kalendarom.
 */
export function opisiPokrivenost(godina) {
  const pokrivena = godina >= POKRIVENE_GODINE.od && godina <= POKRIVENE_GODINE.do;
  return {
    pokrivena,
    status: pokrivena ? "calendar_ok" : "calendar_unverified",
    izvor: KALENDAR_IZVOR,
    verzija: KALENDAR_VERZIJA,
    opseg: { ...POKRIVENE_GODINE },
  };
}

/**
 * Da li je dati lokalni datum radni dan.
 *
 * `dodatnaZatvaranja` su eksplicitna zatvaranja firme (kolektivni godišnji i
 * slično) — lista ISO datuma iz konfiguracije. Firma sme da ne radi i kada
 * zakon to ne traži; obrnuto ne važi.
 *
 * Radna nedelja je ponedeljak–petak. Subota se NE tretira kao radni dan; ako se
 * to ikada promeni, menja se ovde i u dokumentaciji, ne u pozivaocu.
 *
 * @param {string} iso  lokalni datum `YYYY-MM-DD`
 * @param {{ dodatnaZatvaranja?: readonly string[] }} [opcije]
 */
export function jeRadniDan(iso, opcije = {}) {
  const dan = danUNedelji(iso);
  if (dan === 0 || dan === 6) return false;
  if ((opcije.dodatnaZatvaranja ?? []).includes(iso)) return false;
  const godina = Number(iso.slice(0, 4));
  return !prazniciZaGodinu(godina).has(iso);
}

/** Zašto dan nije radni — za `status`, bez pogađanja. */
export function razlogNeradnog(iso, opcije = {}) {
  const dan = danUNedelji(iso);
  if (dan === 0) return "nedelja";
  if (dan === 6) return "subota";
  if ((opcije.dodatnaZatvaranja ?? []).includes(iso)) return "zatvaranje firme";
  return prazniciZaGodinu(Number(iso.slice(0, 4))).get(iso) ?? null;
}

/**
 * Prvi radni dan počev od `iso` (uključivo).
 *
 * Granica od 400 dana je zaštita od beskonačne petlje pri pogrešnoj
 * konfiguraciji (npr. cela godina proglašena zatvaranjem) — bolje greška nego
 * proces koji se vrti.
 */
export function prviRadniDanOd(iso, opcije = {}) {
  let dan = iso;
  for (let i = 0; i < 400; i += 1) {
    if (jeRadniDan(dan, opcije)) return dan;
    dan = dodajDana(dan, 1);
  }
  throw new Error("Nijedan radni dan u narednih 400 dana — proveri konfiguraciju zatvaranja.");
}

export { dodajDana };
