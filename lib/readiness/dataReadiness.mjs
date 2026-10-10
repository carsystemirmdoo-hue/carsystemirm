/**
 * Spremnost podataka — čista logika.
 *
 * Bez baze, bez I/O, bez React-a. Ovde se odlučuje ŠTA brojevi znače; SQL u
 * `lib/readiness/data-readiness.ts` odlučuje odakle dolaze, a stranica ih samo
 * prikazuje.
 *
 * Razlog za razdvajanje nije stil nego to što su tvrdnje ovog modula poslovne,
 * ne tehničke: „nula uvezenih povrata“ i „povrata nije bilo“ su različite
 * stvari, a razlika se ne vidi u SQL-u nego u tome kako se rezultat pročita.
 * Dok je ta odluka bila u upitu, jedini način da se proveri bio bi pun prolaz
 * kroz bazu.
 *
 * Ovo NIJE recommendation engine. Nema praga „N faktura = spremno“, nema
 * ocene kupca, nema predviđanja sledeće porudžbine. Brojevi su dijagnostika.
 */

/* =========================================================================
 * Status kriterijuma
 * ====================================================================== */

/**
 * Tri stanja, i nijedno se ne izvodi iz odsustva drugog.
 *
 * `nije_provereno` je namerno odvojeno od `nedostaje`. „Nismo našli“ i „nismo
 * ni mogli da gledamo" vode različitim postupcima: prvo se rešava u podacima,
 * drugo isključivo spoljnom evidencijom. Kada su bili isto stanje, svaki
 * neproveren kriterijum je izgledao kao nedostatak koji neko treba da popravi
 * u sistemu — a nijedan od njih se tako ne popravlja.
 */
export const STATUSI = ["potvrdjeno", "nedostaje", "nije_provereno"];

export const STATUS_LABELE = {
  potvrdjeno: "potvrđeno",
  nedostaje: "nedostaje",
  nije_provereno: "nije provereno",
};

/**
 * Natpis statusa, sa izričitom rezervom za nepoznatu vrednost.
 *
 * Nepoznat status NE pada nazad na „potvrđeno“ ni na prazan tekst: prvo bi
 * bilo lažno zeleno svetlo, drugo bi ostavilo praznu ćeliju koja se čita kao
 * „nema problema“. Vraća se sam ključ, pa se greška vidi na ekranu.
 *
 * @param {string} status
 * @returns {string}
 */
export function statusLabela(status) {
  return Object.prototype.hasOwnProperty.call(STATUS_LABELE, status)
    ? STATUS_LABELE[status]
    : status;
}

/**
 * Odakle status dolazi.
 *
 * `baza` znači da je tvrdnja merena nad stvarnim redovima u dozvoljenom
 * opsegu. `spoljna_evidencija` znači da je u bazi nema i da je ne može biti —
 * nijedan upit ne može da dokaže da su svi kupci firme uvezeni, jer bi za to
 * morao da zna šta nije uvezeno.
 */
export const OSNOVI = ["baza", "spoljna_evidencija"];

/* =========================================================================
 * Procenat nad imenovanim imeniteljem
 * ====================================================================== */

/**
 * Pokrivenost, ili izričito „nije dostupno“.
 *
 * Nulti imenitelj NE daje 0% ni 100%. Nula od nule nije „ništa nije mapirano“
 * (što bi 0% tvrdio) niti „sve je mapirano“ (što bi tvrdio 100%) — to je
 * odsustvo pitanja. Prazna baza bi inače prikazala 100% pokrivenosti i to bi
 * bio najgori mogući prikaz: potpuno tačan po formuli i potpuno pogrešan po
 * značenju.
 *
 * `imenitelj` je obavezan opis TOGA ŠTA se broji. Procenat bez imenovanog
 * imenitelja se čita kao tvrdnja o svim kupcima firme, a nikad to nije.
 *
 * @param {{ potvrdjeno: number, ukupno: number, imenitelj: string }} ulaz
 * @returns {{ potvrdjeno: number, ukupno: number, nepotvrdjeno: number,
 *             procenat: number | null, dostupno: boolean, imenitelj: string }}
 */
export function pokrivenost({ potvrdjeno, ukupno, imenitelj }) {
  if (!imenitelj || !imenitelj.trim()) {
    throw new Error("Pokrivenost bez imenovanog imenitelja se ne sme prikazati.");
  }
  if (!Number.isInteger(potvrdjeno) || !Number.isInteger(ukupno)) {
    throw new Error("Pokrivenost radi nad celim brojevima redova.");
  }
  if (potvrdjeno < 0 || ukupno < 0) {
    throw new Error("Broj redova ne može biti negativan.");
  }
  if (potvrdjeno > ukupno) {
    throw new Error("Potvrđenih ne može biti više od ukupnog broja.");
  }

  const dostupno = ukupno > 0;
  return {
    potvrdjeno,
    ukupno,
    nepotvrdjeno: ukupno - potvrdjeno,
    // `null`, ne 0 i ne 100 — vidi objašnjenje iznad.
    procenat: dostupno ? (potvrdjeno / ukupno) * 100 : null,
    dostupno,
    imenitelj,
  };
}

/** Prikaz pokrivenosti; nedostupna daje tekst, ne broj. */
export function pokrivenostTekst(p) {
  if (!p.dostupno) return "nije dostupno";
  return `${p.procenat.toFixed(1)}%`;
}

/* =========================================================================
 * Period
 * ====================================================================== */

/**
 * Semantika datuma je `issued_on` — DATUM IZDAVANJA dokumenta, ne datum uvoza,
 * ne datum plaćanja i ne datum isporuke. Granice su UKLJUČIVE na oba kraja:
 * dokument izdat tačno na `do` ulazi u period.
 *
 * Zašto uključivo: operater koji ukuca „od 1. do 31.“ misli ceo mesec. Isključi
 * li se gornja granica, poslednji dan meseca tiho ispada i mesečni zbir se ne
 * poklapa sa knjigovodstvom za tačno jedan dan — razlika koju niko ne traži
 * dok ne postane velika.
 */
export const SEMANTIKA_DATUMA =
  "Datum = datum izdavanja dokumenta iz izvora. Nije datum uvoza, plaćanja ni isporuke. " +
  "Granice perioda su uključive na oba kraja.";

const OBLIK_DATUMA = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Stvaran datum iz kalendara, ne samo tačan oblik.
 *
 * Oblik sam po sebi propušta `2026-13-45`. Takva vrednost bi otišla u upit i
 * vratila se kao sirova greška drajvera na ekranu — poruka koja operateru ništa
 * ne znači, a koja ume da odaje i deo teksta upita. Zato se datum ovde stvarno
 * proverava: `Date` normalizuje prekoračenje (13. mesec postaje januar sledeće
 * godine), pa se poređenjem sa ulazom hvata upravo to.
 */
function jeStvaranDatum(v) {
  const m = OBLIK_DATUMA.exec(v);
  if (!m) return false;
  const [, g, mes, d] = m;
  const datum = new Date(`${v}T00:00:00Z`);
  if (Number.isNaN(datum.getTime())) return false;
  return (
    datum.getUTCFullYear() === Number(g) &&
    datum.getUTCMonth() + 1 === Number(mes) &&
    datum.getUTCDate() === Number(d)
  );
}

/**
 * Normalizuje traženi period.
 *
 * Prazan period je legitiman i znači „sve što postoji“ — ali se tada NE sme
 * prikazati kao potvrđen opseg istorije. Vidi `RASPON_NIJE_POTPUNOST`.
 *
 * @param {{ od?: string | null, do?: string | null }} [ulaz]
 * @returns {{ od: string | null, do: string | null, greske: string[] }}
 */
export function normalizujPeriod(ulaz = {}) {
  const greske = [];
  const uzmi = (v, ime) => {
    if (v === undefined || v === null || v === "") return null;
    if (!jeStvaranDatum(v)) {
      greske.push(`Datum „${ime}“ nije stvaran datum u obliku GGGG-MM-DD.`);
      return null;
    }
    return v;
  };

  let od = uzmi(ulaz.od, "od");
  let doo = uzmi(ulaz.do, "do");

  /*
   * Obrnut period se ODBIJA, ne ćuti i ne zamenjuje se u mestu.
   *
   * Tiha zamena bi vratila brojeve za period koji operater nije tražio, a
   * ekran bi izgledao ispravno. Bolje je vratiti pun opseg uz vidljivu grešku.
   */
  if (od && doo && od > doo) {
    greske.push("Početak perioda je posle kraja; period je zanemaren.");
    od = null;
    doo = null;
  }

  return { od, do: doo, greske };
}

/**
 * Raspon između prve i poslednje fakture NIJE dokaz potpune istorije za taj
 * period. Između dva datuma može nedostajati bilo koliko dokumenata, a sistem
 * ne može da zna za dokument koji nikada nije uvezen.
 */
export const RASPON_NIJE_POTPUNOST =
  "Najraniji i najkasniji datum pokazuju samo šta JESTE uvezeno. Oni ne dokazuju " +
  "da je istorija između njih potpuna — sistem ne može znati za dokument koji nije uvezen.";

/* =========================================================================
 * Kriterijumi
 * ====================================================================== */

/**
 * Ulazne činjenice za ocenu kriterijuma. Svaka je merena nad dozvoljenim
 * opsegom; nijedna nije procenjena.
 *
 * @typedef {object} Cinjenice
 * @property {number} efektivnihDokumenata  Različitih efektivnih prodajnih dokumenata.
 * @property {number} parovaSaViseFaktura   Parova (kupac, artikal) na ≥2 različite efektivne fakture.
 * @property {number} parovaSaViseDatuma    Parova (kupac, artikal) na ≥2 različita datuma.
 * @property {ReturnType<typeof pokrivenost>} mapiranjeKupaca
 * @property {ReturnType<typeof pokrivenost>} mapiranjeArtikala
 * @property {number} korektivnihDokumenata Poznatih korektivnih dokumenata u opsegu.
 * @property {number} korektivnihBezVeze    Od toga bez dokazane veze sa originalom.
 * @property {boolean} opsegDostupan        Ima li korisnik ijednog kupca u opsegu.
 */

/**
 * Ocena sedam kriterijuma spremnosti.
 *
 * Četiri su merljiva iz baze; tri nisu i nikad neće biti — i to nije rupa u
 * implementaciji nego svojstvo pitanja. Vraćaju se zajedno, jer bi razdvojena
 * lista merljivih izgledala kao potpuna ocena spremnosti.
 *
 * NEMA zbirnog „zelenog svetla“. Nijedna kombinacija ovih statusa ne pokreće
 * recommendation engine; odluku donosi čovek nad spiskom nedostajućih dokaza.
 *
 * @param {Cinjenice} c
 */
export function oceniKriterijume(c) {
  /*
   * Prazan opseg nije „nema podataka o firmi“.
   *
   * Komercijalista bez ijedne dodele meri nulu nad nula kupaca. To ne znači da
   * prodaje nema — znači da on ne sme da je vidi. Da ovo nije odvojeno stanje,
   * njegov ekran bi tvrdio isto što i prazna baza.
   */
  const bezOpsega = !c.opsegDostupan;

  const istorija = bezOpsega
    ? nijeProvereno(
        "istorija_prodaje",
        "Postoji istorija prodaje",
        "U Vašem opsegu nema nijednog kupca, pa se istorija ne meri. To nije tvrdnja o prometu firme.",
      )
    : {
        kljuc: "istorija_prodaje",
        naslov: "Postoji istorija prodaje",
        status: c.efektivnihDokumenata > 0 ? "potvrdjeno" : "nedostaje",
        osnov: "baza",
        objasnjenje:
          c.efektivnihDokumenata > 0
            ? `Mereno nad efektivnom prodajom u opsegu i periodu: ${c.efektivnihDokumenata} dokumenata. ` +
              "Broj važi za ono što je uvezeno, ne za celu istoriju firme."
            : "U opsegu i periodu nema nijednog efektivnog prodajnog dokumenta. " +
              "„Nema podataka“ NIJE „kupac nikada nije kupovao“ — dokument može postojati a ne biti uvezen.",
      };

  const ponovljene = bezOpsega
    ? nijeProvereno(
        "ponovljene_kupovine",
        "Postoje ponovljene kupovine",
        "U Vašem opsegu nema nijednog kupca, pa se ponavljanje ne meri.",
      )
    : {
        kljuc: "ponovljene_kupovine",
        naslov: "Postoje ponovljene kupovine",
        status: c.parovaSaViseFaktura > 0 ? "potvrdjeno" : "nedostaje",
        osnov: "baza",
        objasnjenje:
          c.parovaSaViseFaktura > 0
            ? `${c.parovaSaViseFaktura} parova (kupac, artikal) pojavljuje se na najmanje dve različite ` +
              `efektivne fakture, od toga ${c.parovaSaViseDatuma} na različitim datumima. ` +
              "Postojanje ponavljanja NE dokazuje da ih ima dovoljno za bilo kakav algoritam — " +
              "dovoljnost nije merena i ovde se ne tvrdi."
            : "Nijedan par (kupac, artikal) se ne pojavljuje na dve različite efektivne fakture " +
              "u opsegu i periodu.",
      };

  /*
   * Mapiranja se ocenjuju SAMO nad poznatim uvezenim opsegom.
   *
   * Imenitelj je broj uvezenih identiteta, ne pretpostavljeni broj svih kupaca
   * firme. Sistem ne zna koliko kupaca firma ima; kada bi procenat računao nad
   * pretpostavkom, svaki novi uvoz bi ga menjao bez ijedne stvarne promene u
   * mapiranju.
   */
  const mapiranja = (() => {
    const k = c.mapiranjeKupaca;
    const a = c.mapiranjeArtikala;
    if (!k.dostupno && !a.dostupno) {
      return nijeProvereno(
        "mapiranja_potvrdjena",
        "Mapiranja su potvrđena",
        "Nema nijednog uvezenog identiteta kupca ni artikla u opsegu, pa imenitelja nema. " +
          "Pokrivenost je „nije dostupno“, ne 0% i ne 100%.",
      );
    }
    const nepotvrdjeno = k.nepotvrdjeno + a.nepotvrdjeno;
    return {
      kljuc: "mapiranja_potvrdjena",
      naslov: "Mapiranja su potvrđena",
      status: nepotvrdjeno === 0 ? "potvrdjeno" : "nedostaje",
      osnov: "baza",
      objasnjenje:
        `Kupci: ${k.potvrdjeno}/${k.ukupno} (${k.imenitelj}). ` +
        `Artikli: ${a.potvrdjeno}/${a.ukupno} (${a.imenitelj}). ` +
        "Važi isključivo za poznat uvezen opseg. Identitet koji nikad nije uvezen se ovde ne broji " +
        "ni kao mapiran ni kao nemapiran.",
    };
  })();

  /*
   * Korektivni dokumenti.
   *
   * Nikad `potvrdjeno` iz baze. Nula uvezenih povrata ne znači da povrata nije
   * bilo, a postojanje povrata bez dokazane veze sa originalom znači da se
   * njegov efekat na promet ne može izračunati. Oba ishoda su otvorena, samo
   * iz različitih razloga.
   */
  const korektivni =
    c.korektivnihDokumenata === 0
      ? nijeProvereno(
          "korektivni_dokumenti",
          "Povrati, storno i korekcije su podržani",
          "U opsegu i periodu nema nijednog uvezenog korektivnog dokumenta. " +
            "„Nema uvezenih povrata“ NIJE „povrata nije bilo“ — format povrata još nema potvrđen uzorak, " +
            "pa takav dokument ni ne bi bio pročitan.",
        )
      : {
          kljuc: "korektivni_dokumenti",
          naslov: "Povrati, storno i korekcije su podržani",
          status: "nedostaje",
          osnov: "baza",
          objasnjenje:
            `Poznato korektivnih dokumenata: ${c.korektivnihDokumenata}, ` +
            `od toga bez dokazane veze sa originalom: ${c.korektivnihBezVeze}. ` +
            "Dokument bez veze se vidi u svojoj kofi ali NE umanjuje neto promet — " +
            "efekat se ne pogađa iz vrste dokumenta.",
        };

  /*
   * Tri kriterijuma koja baza ne može da oceni.
   *
   * Njihov status je konstanta, i to je tačno ono što treba da bude. Kada bi se
   * izvodio iz podataka, dovoljan uvoz bi ih pretvorio u „potvrđeno“ bez ijedne
   * stvarne provere — što je upravo lažna spremnost koju ovaj ekran postoji da
   * spreči.
   */
  const pokrivenostPerioda = nijeProvereno(
    "pokrivenost_perioda_i_kupaca",
    "Pokrivenost perioda i svih kupaca je potvrđena",
    "Ovo se ne može utvrditi iz baze ni pod kojim uslovom: da bi sistem znao šta nedostaje, " +
      "morao bi znati za dokument koji nikada nije uvezen. Traži spoljnu evidenciju — " +
      "istoriju fakturisanja iz BizniSoft-a i spisak svih kupaca firme. " +
      "Lista ranijih kupaca ne dokazuje da obuhvata sve kupce firme.",
    "spoljna_evidencija",
  );

  const kancelarijska = nijeProvereno(
    "kancelarijska_prihvatna_provera",
    "Kancelarijska prihvatna provera je urađena",
    "Trenutno nije urađena. Prolazak automatizovanih testova to NE menja — testovi rade nad " +
      "sintetičkim podacima i mere kod, ne stvarne dokumente firme. Ranija prihvatna provera " +
      "uzoraka ne znači da su ti dokumenti trajno u bazi.",
    "spoljna_evidencija",
  );

  const cene = nijeProvereno(
    "aktuelne_cene_valuta_pdv_lager",
    "Aktuelne cene, valuta/PDV i lager imaju potvrđen izvor i svežinu",
    "Nema potvrđenog izvora ni datuma svežine. Ove vrednosti se NE smeju izvoditi iz istorijskih " +
      "faktura: fakturisana cena je zapis prošlog posla, a ne važeći cenovnik, i lager se iz nje " +
      "ne vidi uopšte.",
    "spoljna_evidencija",
  );

  return [
    istorija,
    ponovljene,
    mapiranja,
    pokrivenostPerioda,
    korektivni,
    kancelarijska,
    cene,
  ];
}

function nijeProvereno(kljuc, naslov, objasnjenje, osnov = "baza") {
  return { kljuc, naslov, status: "nije_provereno", osnov, objasnjenje };
}

/* =========================================================================
 * Nedostajući dokazi
 * ====================================================================== */

/**
 * Šta vlasnik treba da pribavi, izvedeno iz stvarnih statusa.
 *
 * Spisak nije statičan tekst: stavka koja je merljivo potvrđena ispada, a
 * stavka koja to nije ostaje sa razlogom zbog koga ostaje. Statičan spisak bi
 * posle prve popravke počeo da laže u drugom smeru.
 *
 * @param {ReturnType<typeof oceniKriterijume>} kriterijumi
 */
export function nedostajuciDokazi(kriterijumi) {
  const po = new Map(kriterijumi.map((k) => [k.kljuc, k]));
  const trazi = (kljuc) => po.get(kljuc)?.status !== "potvrdjeno";

  const spisak = [];

  if (trazi("pokrivenost_perioda_i_kupaca")) {
    spisak.push({
      kljuc: "istorija_fakturisanja",
      naslov: "Istorija fakturisanja iz BizniSoft-a",
      zasto:
        "Bez nje se ne može reći da li je period pokriven ni da li su obuhvaćeni svi kupci. " +
        "Uvezeni raspon datuma to ne dokazuje.",
    });
  }

  if (trazi("korektivni_dokumenti")) {
    spisak.push({
      kljuc: "korektivni_uzorci",
      naslov: "Korektivni uzorci sa vidljivom vezom na original",
      zasto:
        "Storno, povrat, knjižno odobrenje i korekcija cene/popusta nemaju potvrđen uzorak. " +
        "Bez uzorka koji pokazuje referencu na original, efekat na promet se ne sme računati.",
    });
    spisak.push({
      kljuc: "nastavak_tabele",
      naslov: "Dokument sa tabelom koja se nastavlja na narednoj strani",
      zasto:
        "Takav oblik danas završava na ručnom pregledu jer nijedan uzorak ne pokazuje kako se " +
        "nastavak označava. Nagađanje bi tiho odseklo stavke.",
    });
  }

  if (trazi("mapiranja_potvrdjena")) {
    spisak.push({
      kljuc: "partner_artikal_potvrda",
      naslov: "Potvrda partner i artikal podataka",
      zasto:
        "Šifra partnera bez potvrđenog kupca ne pravi fakturu, a artikal bez potvrđene veze na " +
        "katalog ostaje bez stranice. Oboje traži ljudsku potvrdu — sličnost naziva nije dokaz.",
    });
  }

  if (trazi("aktuelne_cene_valuta_pdv_lager")) {
    spisak.push({
      kljuc: "aktuelne_cene_i_lager",
      naslov: "Aktuelne cene, valuta/PDV i stanje lagera sa datumom svežine",
      zasto:
        "Istorijska faktura ne sadrži važeći cenovnik ni zalihe. Bez izvora i datuma svežine " +
        "svaki prikaz „cene“ bi bio obećanje koje niko nije dao.",
    });
  }

  if (trazi("kancelarijska_prihvatna_provera")) {
    spisak.push({
      kljuc: "fizicka_provera",
      naslov: "Fizička prihvatna provera u kancelariji",
      zasto:
        "Poređenje prikazanih brojeva sa knjigovodstvom nad stvarnim dokumentima. " +
        "Nijedan automatizovani test ne može da je zameni.",
    });
  }

  return spisak;
}

/* =========================================================================
 * Raspodela broja faktura po kupcu
 * ====================================================================== */

/**
 * Grupiše kupce po broju različitih efektivnih faktura.
 *
 * Kante su fiksne i BEZ ocene: „10+ faktura“ nije „dobar kupac“ i nigde se
 * tako ne prikazuje. Prag koji bi značio spremnost namerno ne postoji — čim
 * jedan broj postane granica, on postane odluka, a odluku ovde niko nije doneo.
 *
 * @param {{ faktura: number, kupaca: number }[]} redovi Iz SQL-a: koliko kupaca ima tačno N faktura.
 * @returns {{ oznaka: string, kupaca: number }[]}
 */
export function raspodelaFakturaPoKupcu(redovi) {
  const kante = [
    { oznaka: "1 faktura", test: (n) => n === 1 },
    { oznaka: "2–3 fakture", test: (n) => n >= 2 && n <= 3 },
    { oznaka: "4–9 faktura", test: (n) => n >= 4 && n <= 9 },
    { oznaka: "10 i više faktura", test: (n) => n >= 10 },
  ];

  const zbir = kante.map((k) => ({ oznaka: k.oznaka, kupaca: 0 }));
  for (const red of redovi) {
    if (!Number.isInteger(red.faktura) || red.faktura < 1) continue;
    const i = kante.findIndex((k) => k.test(red.faktura));
    if (i >= 0) zbir[i].kupaca += red.kupaca;
  }
  return zbir;
}

/* =========================================================================
 * Problemi izvornih dokumenata
 * ====================================================================== */

/**
 * Kategorije problema se NE SABIRAJU.
 *
 * Jedan dokument može istovremeno biti u sudaru i čekati ručni pregled — CSV/PDF
 * sudar je tačno takav slučaj. Zbir kategorija bi ga prebrojao dvaput i dao broj
 * veći od broja dokumenata koji uopšte postoje. Zato se svaka kategorija
 * prikazuje zasebno, uz izričit `ukupnoRazlicitih` koji jedini sme da se čita
 * kao „koliko dokumenata“.
 *
 * @param {{ cekaMapiranje: number, sudar: number, rucniPregled: number,
 *           bezPodrskeZaFormat: number, ukupnoRazlicitih: number }} ulaz
 */
export function problemiDokumenata(ulaz) {
  const kategorije = [
    { kljuc: "ceka_mapiranje", naslov: "Čeka mapiranje kupca", broj: ulaz.cekaMapiranje },
    { kljuc: "sudar", naslov: "Čeka razrešenje sudara verzija", broj: ulaz.sudar },
    { kljuc: "rucni_pregled", naslov: "Čeka ručni pregled", broj: ulaz.rucniPregled },
    {
      kljuc: "bez_podrske",
      naslov: "Oblik bez potvrđenog uzorka",
      broj: ulaz.bezPodrskeZaFormat,
    },
  ];

  const zbirKategorija = kategorije.reduce((a, k) => a + k.broj, 0);

  return {
    kategorije,
    ukupnoRazlicitih: ulaz.ukupnoRazlicitih,
    /*
     * Vidljiv dokaz da se kategorije preklapaju. Bez ovoga bi neko sabrao
     * kolone i pitao zašto se ne slaže sa ukupnim brojem.
     */
    preklapaSe: zbirKategorija > ulaz.ukupnoRazlicitih,
    napomena:
      "Kategorije se preklapaju i ne smeju se sabirati — isti dokument može biti " +
      "i u sudaru i na ručnom pregledu. „Ukupno različitih“ je jedini broj dokumenata.",
  };
}

/**
 * Sudar CSV fakture i PDF-a iz drugog izvora.
 *
 * Ovo je OTVOREN problem porekla, ne potvrda da je sadržaj isti. CSV zapis ne
 * čuva stavke onako kako ih čuva izvorni dokument, pa se sadržaj ne može
 * dokazano uporediti. Ranija faktura ostaje u prometu po zatečenim pravilima
 * ledgera; PDF se NE računa drugi put i čeka ručni pregled.
 */
export const CSV_PDF_SUDAR =
  "Postojeća faktura iz ranijeg (CSV) uvoza i PDF koji tvrdi isti poslovni identitet: " +
  "PDF se ne knjiži drugi put i promet se ne udvostručuje. To NIJE potvrda da je sadržaj " +
  "identičan — sadržaj se ne može dokazano uporediti, pa je ovo otvoren problem porekla " +
  "koji čeka ručno razrešenje.";

/* =========================================================================
 * Šta se iz ovih brojeva NE sme zaključiti
 * ====================================================================== */

/**
 * Ograde koje idu uz svaki prikaz.
 *
 * Stoje u kodu, a ne samo u dokumentaciji, jer ekran nadživi dokument koji ga
 * objašnjava. Prvi čitalac koji ih ne vidi izvešće upravo zaključak koji svaka
 * od njih zabranjuje.
 */
export const OGRADE = [
  "„Nema podataka“ nije „kupac nikada nije kupovao“. Dokument može postojati a ne biti uvezen.",
  "„Nema uvezenih povrata“ nije „povrata nije bilo“. Format povrata još nema potvrđen uzorak.",
  RASPON_NIJE_POTPUNOST,
  "Lista ranijih kupaca ne dokazuje da obuhvata sve kupce firme.",
  "Procenat mapiranja važi samo nad imenovanim, uvezenim identitetima — ne nad svim kupcima firme.",
  "Nulti imenitelj daje „nije dostupno“, ne 0% i ne 100%.",
  "Ovo su dijagnostički brojevi. Nema predloga kupovine, očekivane sledeće porudžbine, " +
    "predviđene količine ni rejtinga kupca.",
  "Nema praga „N faktura = spremno“. Nijedna kombinacija ovih brojeva ne otvara zeleno svetlo " +
    "za recommendation engine.",
];
