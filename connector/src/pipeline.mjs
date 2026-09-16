import { canonicalFromParsedDocument } from "../../lib/sync/contract/fromParsedDocument.mjs";
import { validateCanonicalInvoice } from "../../lib/sync/contract/validate.mjs";
import { parseBiznisoftPdf } from "../../lib/pdf/parseDocument.js";
import { posaljiPotpisano } from "./client.mjs";
import { odlukaZaOdgovor, STANJA, ZAUSTAVLJA_CIKLUS } from "./outcomes.mjs";
import {
  nadjiKandidate, PODRAZUMEVANE_GRANICE, procitajStabilno, procitajZaOtisak, proveriIzvor,
} from "./scanner.mjs";
import { sledeciPokusajPosleNeuspeha } from "./schedule.mjs";

/**
 * Jedan ciklus: skeniraj → upiši u red → pošalji.
 *
 * Redosled nije stvar stila. Dokument se UPISUJE u trajni red pre nego što se
 * ijedan bajt pošalje; da je obrnuto, pad posle uspešnog slanja a pre upisa
 * ostavio bi dokument koji je server knjižio a konektor ne zna za njega.
 *
 * PDF i sirovi izdvojeni tekst ostaju na računaru. Kroz mrežu ide isključivo
 * canonical payload — isti oblik koji već postoji od P1.
 */

/**
 * Kodovi nepotpunog popisa — stabilni, bez putanje i bez imena foldera.
 *
 * Idu u `failureCode` komande (portal ih čuva i beleži u audit) i u izlaz
 * `run-once`/`dry-run`/`auto`. Novi brojač u portalu bi tražio migraciju; ovaj
 * zadatak je ne sme uvesti, pa vidljivost nosi postojeći kanal ishoda.
 */
export const KOD_POPIS_PREKINUT = "scan_inventory_truncated";
export const KOD_FOLDER_NEDOSTUPAN = "scan_folder_unreadable";

/**
 * Izlazni kod ciklusa čiji popis nije pun.
 *
 * Ne 0: Task Scheduler i operater moraju videti da ciklus nije potpuno
 * uspešan. Ne 1 (blokada), 2 (nepoznata komanda) ni 3 (nepodržan runtime u
 * `bin/connector.mjs`) — ti već znače nešto drugo.
 */
export const IZLAZ_NEPOTPUN_POPIS = 5;

/**
 * Izlazni kod jednog ciklusa — isti za `run-once`, `auto`, `dry-run` i
 * `poll-once`, da ista situacija nigde ne izgleda kao uspeh.
 */
export function izlazniKodCiklusa({ skeniranje = {}, slanje = {} }) {
  if (slanje.zaustavljeno) return 1;
  return skeniranje.kodPopisa ? IZLAZ_NEPOTPUN_POPIS : 0;
}

/**
 * Ocena popisa iz liste preskočenog.
 *
 * `popis_prekinut` je teži slučaj — deo arhive uopšte nije viđen, i to posle
 * granice koja nije vezana za godinu — pa ima prednost nad nedostupnim
 * folderom kada se dese zajedno.
 */
export function ocenaPopisa(preskoceno = []) {
  const popisPrekinut = preskoceno.some((s) => s.razlog === "popis_prekinut");
  const folderaNedostupno = preskoceno.filter((s) => s.razlog === "folder_nedostupan").length;
  const kodPopisa = popisPrekinut
    ? KOD_POPIS_PREKINUT
    : folderaNedostupno > 0
      ? KOD_FOLDER_NEDOSTUPAN
      : null;
  return {
    popis: kodPopisa ? "nepotpun" : "pun",
    kodPopisa,
    popisPrekinut,
    folderaNedostupno,
  };
}

/**
 * Skenira izvorni folder i upisuje nove dokumente u red.
 *
 * Ne šalje ništa. `dry-run` koristi tačno ovo, pa je ono što operater vidi u
 * probi zaista ono što će se poslati.
 */
export async function skenirajURed({
  store,
  konfiguracija,
  granice = PODRAZUMEVANE_GRANICE,
  log,
  /*
   * Čitači sadržaja. Zamenjuju se SAMO u testu, da bi se dokazalo koji fajlovi
   * su uopšte otvoreni; proizvodni poziv ih nikad ne prosleđuje.
   */
  citac = { zaOtisak: procitajZaOtisak, stabilno: procitajStabilno },
}) {
  const { koren } = await proveriIzvor(konfiguracija.izvorniFolder);
  const { kandidati, preskoceno, folderi } = await nadjiKandidate(koren, granice);

  /*
   * Zbir ciklusa. Svaki kandidat koji uđe u petlju završava u TAČNO jednom od
   * brojača ishoda, pa važi:
   *
   *   pregledano = poznato + ponovljenSadrzaj + novo + nepodrzano
   *              + odlozeno + necitljivo + preostalo
   *
   * a iznad toga:
   *
   *   ukupnoPdf = nijeFakturaPoNazivu + kandidata
   *   kandidata = preskocenoTehnicki + pregledano   (osim kad je popis prekinut)
   */
  const BROJACI_ISHODA = ["poznato", "ponovljenSadrzaj", "novo", "nepodrzano", "odlozeno", "necitljivo", "preostalo"];
  const nula = () => Object.fromEntries(BROJACI_ISHODA.map((b) => [b, 0]));
  const poFolderu = new Map(folderi.map((f) => [f.folder, { ...f, ...nula() }]));
  const saberi = (polje) => folderi.reduce((n, f) => n + f[polje], 0);

  const zbir = {
    /** Svi PDF-ovi u korenu i neposrednim podfolderima, pre filtera po imenu. */
    ukupnoPdf: saberi("ukupnoPdf"),
    /** PDF-ovi bez oznake `faktura`/`fak` — nisu otvoreni, nisu heširani. */
    nijeFakturaPoNazivu: saberi("nijeFakturaPoNazivu"),
    /** PDF-ovi sa oznakom fakture u imenu. */
    kandidata: saberi("kandidata"),
    /** Kandidati odbijeni pre čitanja: veza, prazan, prevelik, nestao. */
    preskocenoTehnicki: saberi("preskocenoTehnicki"),
    /** Kandidati koji su ušli u otkrivanje (čitanje + otisak). */
    pregledano: kandidati.length,
    ...nula(),
  };
  const ubroji = (k, polje) => {
    zbir[polje] += 1;
    const f = poFolderu.get(k.folder);
    if (f) f[polje] += 1;
  };
  // Nije otvoren (zaključan, bez prava) — nečitljiv; sve ostalo je odlaganje.
  const neuspehCitanja = (razlog) => (razlog === "zakljucan" ? "necitljivo" : "odlozeno");

  /*
   * Otisci novih dokumenata viđeni U OVOM ciklusu, a još neupisani u red.
   *
   * Bez ovoga bi ista faktura u `2024` i `2025`, obe iznad budžeta, bila
   * izbrojana kao DVA preostala dokumenta — a sledeći ciklus ih obrađuje kao
   * jedan. `preostalo` mora da broji dokumente, ne kopije.
   */
  const noviOtisci = new Set();
  let uObradi = 0;
  /*
   * Protokol stabilnosti košta ~2 s po fajlu. Neuspeli pokušaji ne troše
   * budžet obrade, pa ih ograničava zasebna, dvostruko veća granica — inače
   * bi arhiva puna fajlova koji se upravo pišu produžila ciklus bez kraja.
   */
  const maxPokusajaStabilnosti = 2 * granice.maxNovihPoCiklusu;
  let pokusajaStabilnosti = 0;

  for (const k of kandidati) {
    /*
     * KORAK 1 — jeftino otkrivanje: jedno čitanje, otisak, bez čekanja.
     *
     * Protokol stabilnosti košta dve sekunde po fajlu; nad arhivom od ~12.000
     * dokumenata to je oko 6,7 sati (mereno). Zato ga ovde nema — plaćaju ga
     * samo dokumenti koji se pokažu kao novi ili promenjeni.
     */
    const otkrivanje = await citac.zaOtisak(k.putanja, granice);
    if (!otkrivanje.ok) {
      /*
       * Nestabilan, zaključan ili nestao fajl se ODLAŽE.
       *
       * Ne upisuje se u red kao neispravan: delimično zapisan dokument je
       * sledećeg ciklusa gotov, a trajna oznaka bi ga zauvek izbacila.
       */
      ubroji(k, neuspehCitanja(otkrivanje.razlog));
      continue;
    }

    /*
     * Identitet je otisak SADRŽAJA.
     *
     * Isti sadržaj pod drugim imenom ILI U DRUGOM FOLDERU ne pravi novu stavku;
     * promenjeni bajtovi na istoj putanji daju drugi otisak i zato prolaze
     * ponovo, kao nova izvorna verzija.
     *
     * Poznat dokument NE troši budžet obrade. Da ga troši, 200 poznatih fajlova
     * u `FAKTURE 2024` moglo bi trajno da sakrije nov dokument u `FAKTURE 2029`.
     */
    if (store.imaOtisak(otkrivanje.sourceHash)) {
      ubroji(k, "poznato");
      continue;
    }
    if (noviOtisci.has(otkrivanje.sourceHash)) {
      ubroji(k, "ponovljenSadrzaj");
      continue;
    }
    noviOtisci.add(otkrivanje.sourceHash);

    /*
     * KORAK 2 — tek sada budžet, i tek sada protokol stabilnosti.
     *
     * Popis je već gotov i pun; ovo ograničava samo koliko se novih dokumenata
     * parsira i šalje u jednom ciklusu. Ostatak čeka sledeći, i biće viđen jer
     * popis ne pamti dokle je stigao.
     */
    if (uObradi >= granice.maxNovihPoCiklusu || pokusajaStabilnosti >= maxPokusajaStabilnosti) {
      ubroji(k, "preostalo");
      continue;
    }
    pokusajaStabilnosti += 1;

    const citanje = await citac.stabilno(k.putanja, granice);
    if (!citanje.ok) {
      /*
       * Neuspelo stabilno čitanje NE troši budžet obrade.
       *
       * Ne upisuje se u red, pa se sledeći ciklus vraća na njega — i dolazi na
       * red PRE dokumenata iza sebe. Da troši mesto u budžetu, jedan trajno
       * nestabilan dokument bi uz mali budžet svakog dana pojeo seriju i
       * dokumenti iza njega nikad ne bi došli na red. Vreme ciklusa ipak
       * ograničava `maxPokusajaStabilnosti`.
       */
      ubroji(k, neuspehCitanja(citanje.razlog));
      continue;
    }
    uObradi += 1;

    /*
     * Otisak se proverava PONOVO nad stabilnim čitanjem.
     *
     * Između otkrivanja i ovog čitanja fajl je mogao da se dovrši ili vrati na
     * raniju verziju; merodavan je otisak bajtova koje parser stvarno dobija.
     */
    if (citanje.sourceHash !== otkrivanje.sourceHash && store.imaOtisak(citanje.sourceHash)) {
      ubroji(k, "poznato");
      continue;
    }

    let parsed;
    try {
      // Parser dobija ISTI bafer nad kojim je računat otisak.
      parsed = await parseBiznisoftPdf(citanje.bajtovi);
    } catch {
      store.dodajNepodrzano({
        sourceHash: citanje.sourceHash,
        putanja: k.putanja,
        velicina: citanje.velicina,
        razlog: "parser_greska",
      });
      ubroji(k, "nepodrzano");
      continue;
    }

    if (parsed.validationStatus !== "valid") {
      /*
       * Nepodržan oblik ostaje nepodržan i sa konektorom.
       *
       * Continuation, nepoklopljen zbir i nepoznat naslov su granice koje P1
       * postavlja; konektor ih ne pomera time što je dodat.
       */
      store.dodajNepodrzano({
        sourceHash: citanje.sourceHash,
        putanja: k.putanja,
        velicina: citanje.velicina,
        razlog: `parser:${parsed.validationStatus}`,
      });
      ubroji(k, "nepodrzano");
      continue;
    }

    let payload;
    try {
      payload = canonicalFromParsedDocument(parsed, citanje.bajtovi, {
        issuerCode: konfiguracija.issuerCode,
      });
      /*
       * Lokalna provera PRE upisa u red.
       *
       * Isti validator koji server koristi. Dokument koji server ionako ne bi
       * primio ne treba da zauzima red i da svakog radnog dana pravi jedan
       * odbijen zahtev.
       */
      validateCanonicalInvoice(payload, { issuerCode: konfiguracija.issuerCode });
    } catch (greska) {
      store.dodajNepodrzano({
        sourceHash: citanje.sourceHash,
        putanja: k.putanja,
        velicina: citanje.velicina,
        razlog: `canonical:${greska?.code ?? "greska"}`,
      });
      ubroji(k, "nepodrzano");
      continue;
    }

    /*
     * Telo se serijalizuje JEDNOM i čuva kao bajtovi.
     *
     * Potpis se računa nad ovim istim bajtovima pri svakom pokušaju. Ponovna
     * serijalizacija pred slanje dala bi drugi niz i drugi otisak.
     */
    const telo = Buffer.from(JSON.stringify(payload), "utf8");
    store.dodajSpremno({
      sourceHash: citanje.sourceHash,
      putanja: k.putanja,
      velicina: citanje.velicina,
      telo,
      semanticHash: payload.semantic_hash,
    });
    ubroji(k, "novo");
  }

  /*
   * Nepotpun popis se ne sme utopiti u zbir.
   *
   * Ranije je dnevnik dobijao samo `preskoceno: <broj>`, a izlazni kod i
   * portal ništa — ciklus koji nije video celu arhivu izgledao je kao potpuno
   * uspešan. Sada ocena ide u zbir, u dnevnik kao `warn`, i dalje u ishod.
   */
  Object.assign(zbir, ocenaPopisa(preskoceno));

  /*
   * `preostalo` je TAČAN broj različitih novih ili promenjenih dokumenata koje
   * je ovaj ciklus video, heširao i ostavio za sledeći zbog budžeta. Nije
   * procena: svaki od njih je pročitan i nije u redu. Broj serija važi uz
   * pretpostavku da se u međuvremenu ne pojave novi dokumenti i da se nijedan
   * ne odloži.
   */
  zbir.preostaloSerija = Math.ceil(zbir.preostalo / granice.maxNovihPoCiklusu);
  zbir.maxNovihPoCiklusu = granice.maxNovihPoCiklusu;
  // Upisano u red a još neposlato — slanje ide u sopstvenim serijama.
  zbir.cekaSlanje = store.zbir()[STANJA.SPREMNO] ?? 0;
  zbir.poFolderu = [...poFolderu.values()];
  await log?.zapisi(zbir.kodPopisa ? "warn" : "info", "scan", { ...zbir, preskoceno: preskoceno.length });
  return { ...zbir, preskoceno };
}

/**
 * Šalje stavke iz reda.
 *
 * @param {{ store, konfiguracija, kljuc, lokalniDatum, fetchImpl?, dozvoliHttp?, log? }} ulaz
 */
export async function posaljiIzReda(ulaz) {
  const { store, konfiguracija, kljuc, lokalniDatum } = ulaz;

  /*
   * Oporavak PRE svega ostalog.
   *
   * Pad procesa usred slanja ostavlja stavku u `salje_se`. Bez ovoga bi ostala
   * tamo zauvek — najtiši mogući gubitak, jer izgleda kao da se nešto dešava.
   * Radi se pod bravom, pa ne može da otme stavku živoj instanci.
   */
  const oporavljeno = store.oporaviZaglavljene();

  const zbir = {
    oporavljeno,
    poslato: 0,
    potvrdjeno: 0,
    zaPregled: 0,
    odlozeno: 0,
    odbijeno: 0,
    zaustavljeno: null,
  };

  const stavke = store.zaSlanje({ limit: konfiguracija.maxPoCiklusu, lokalniDatum });

  for (const stavka of stavke) {
    if (!store.oznaciSalje(stavka.id)) continue; // Neko drugi ju je preuzeo.
    zbir.poslato += 1;

    const odgovor = await posaljiPotpisano({
      origin: konfiguracija.serverOrigin,
      path: "/api/sync/ingest",
      bodyBytes: new Uint8Array(stavka.telo),
      deviceCode: konfiguracija.deviceCode,
      keyId: konfiguracija.keyId,
      privateKeyPkcs8Der: kljuc,
      timeoutMs: konfiguracija.timeoutMs,
      fetchImpl: ulaz.fetchImpl,
      dozvoliHttp: ulaz.dozvoliHttp,
    });

    if (odgovor.transport !== "ok") {
      /*
       * Odgovor nije stigao — o knjiženju se NE sme ništa zaključiti.
       *
       * Server je možda knjižio. Stavka se odlaže i ponavlja sledećeg radnog
       * dana sa NOVIM nonce-om; ako je knjiženo, dobiće `duplicate_file`.
       */
      store.odlozi({
        id: stavka.id,
        odlozenoDo: sledeciPokusajPosleNeuspeha(lokalniDatum, {
          dodatnaZatvaranja: konfiguracija.dodatnaZatvaranja,
        }),
        razlog: `transport:${odgovor.razlog}`,
      });
      zbir.odlozeno += 1;
      await ulaz.log?.zapisi("warn", "slanje_neuspelo", {
        ref: `sd:${stavka.source_hash.slice(0, 12)}`,
        razlog: odgovor.razlog,
      });
      continue;
    }

    const odluka = odlukaZaOdgovor(odgovor);

    /*
     * Lokalna potvrda se upisuje TEK posle prepoznatog odgovora.
     *
     * Ako ovaj upis pukne, greška se propagira i ciklus staje: prijaviti uspeh
     * bez trajne potvrde značilo bi da sledeći ciklus ne zna šta je poslato, a
     * izveštaj tvrdi da jeste.
     */
    if (odluka.stanje === STANJA.POTVRDJENO || odluka.stanje === STANJA.ZA_PREGLED ||
        odluka.stanje === STANJA.ODBIJENO) {
      store.zavrsi({
        id: stavka.id,
        stanje: odluka.stanje,
        serverKod: odgovor.code,
        serverRef: odgovor.sourceDocumentId ?? odgovor.invoiceId ?? null,
        razlog: odluka.razlog,
      });
      if (odluka.stanje === STANJA.POTVRDJENO) zbir.potvrdjeno += 1;
      else if (odluka.stanje === STANJA.ZA_PREGLED) zbir.zaPregled += 1;
      else zbir.odbijeno += 1;
    } else if (odluka.stanje === STANJA.BLOKIRANO) {
      store.zavrsi({
        id: stavka.id,
        stanje: STANJA.BLOKIRANO,
        serverKod: odgovor.code,
        razlog: odluka.razlog,
      });
    } else if (odluka.stanje === STANJA.SPREMNO) {
      // `nonce_replayed`: ponovo, ali sa novim nonce-om — bez odlaganja.
      store.vratiUSpremno({ id: stavka.id, razlog: odluka.razlog });
    } else {
      store.odlozi({
        id: stavka.id,
        odlozenoDo: sledeciPokusajPosleNeuspeha(lokalniDatum, {
          dodatnaZatvaranja: konfiguracija.dodatnaZatvaranja,
        }),
        razlog: odluka.razlog,
      });
      zbir.odlozeno += 1;
    }

    await ulaz.log?.zapisi("info", "ishod", {
      ref: `sd:${stavka.source_hash.slice(0, 12)}`,
      stanje: odluka.stanje,
      kod: odgovor.code,
      http: odgovor.httpStatus,
    });

    if (odluka.ciklus === ZAUSTAVLJA_CIKLUS) {
      /*
       * Opozvan uređaj, pomeren sat, rate limit ili isključen gate se ne
       * popravljaju sledećom stavkom. Nastavak bi napravio N identičnih
       * odbijanja i N zapisa u serverskom brojaču.
       */
      zbir.zaustavljeno = odluka.razlog;
      break;
    }
  }

  /*
   * Koliko spremnih stavki ostaje u redu posle ove serije slanja — uključujući
   * one odložene za sledeći radni dan. Tokom istorijskog backfill-a red raste
   * brže nego što se prazni, i to mora da se vidi.
   */
  zbir.ostaloURedu = store.zbir()[STANJA.SPREMNO] ?? 0;
  return zbir;
}
