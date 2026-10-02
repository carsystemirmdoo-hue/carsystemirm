import { canonicalFromParsedDocument } from "../../lib/sync/contract/fromParsedDocument.mjs";
import { validateCanonicalInvoice } from "../../lib/sync/contract/validate.mjs";
import { parseBiznisoftPdf } from "../../lib/pdf/parseDocument.js";
import { posaljiPotpisano } from "./client.mjs";
import { odlukaZaOdgovor, STANJA, ZAUSTAVLJA_CIKLUS } from "./outcomes.mjs";
import {
  nadjiKandidate, PODRAZUMEVANE_GRANICE, procitajStabilno, procitajZaOtisak, proveriIzvor,
} from "./scanner.mjs";
import { sledeciPokusajPosleNeuspeha } from "./schedule.mjs";
import { cekanjeZa, PODRAZUMEVANA_POLITIKA, vrstaPrivremenog } from "./retry.mjs";

const spavaj = (ms) => new Promise((r) => setTimeout(r, ms));

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
 * Skenira izvorni folder i upisuje nove dokumente u red.
 *
 * Ne šalje ništa. `dry-run` koristi tačno ovo, pa je ono što operater vidi u
 * probi zaista ono što će se poslati.
 */
export async function skenirajURed({ store, konfiguracija, granice = PODRAZUMEVANE_GRANICE, log }) {
  const { koren } = await proveriIzvor(konfiguracija.izvorniFolder);
  const { kandidati, preskoceno } = await nadjiKandidate(koren, granice);

  const zbir = {
    /** Koliko je PDF-ova uopšte popisano — koren i svi neposredni podfolderi. */
    pregledano: kandidati.length,
    novo: 0,
    poznato: 0,
    odlozeno: 0,
    nepodrzano: 0,
    /** Novih je bilo više nego što budžet dozvoljava; ostatak ide sledeći ciklus. */
    cekaBudzet: 0,
  };
  const detalji = [];
  let uObradi = 0;

  for (const k of kandidati) {
    /*
     * KORAK 1 — jeftino otkrivanje: jedno čitanje, otisak, bez čekanja.
     *
     * Protokol stabilnosti košta dve sekunde po fajlu; nad arhivom od ~12.000
     * dokumenata to je oko 6,7 sati (mereno). Zato ga ovde nema — plaćaju ga
     * samo dokumenti koji se pokažu kao novi ili promenjeni.
     */
    const otkrivanje = await procitajZaOtisak(k.putanja, granice);
    if (!otkrivanje.ok) {
      /*
       * Nestabilan, zaključan ili nestao fajl se ODLAŽE.
       *
       * Ne upisuje se u red kao neispravan: delimično zapisan dokument je
       * sledećeg ciklusa gotov, a trajna oznaka bi ga zauvek izbacila.
       */
      zbir.odlozeno += 1;
      detalji.push({ razlog: otkrivanje.razlog });
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
      zbir.poznato += 1;
      continue;
    }

    /*
     * KORAK 2 — tek sada budžet, i tek sada protokol stabilnosti.
     *
     * Popis je već gotov i pun; ovo ograničava samo koliko se novih dokumenata
     * parsira i šalje u jednom ciklusu. Ostatak čeka sledeći, i biće viđen jer
     * popis ne pamti dokle je stigao.
     */
    if (uObradi >= granice.maxNovihPoCiklusu) {
      zbir.cekaBudzet += 1;
      continue;
    }
    uObradi += 1;

    const citanje = await procitajStabilno(k.putanja, granice);
    if (!citanje.ok) {
      zbir.odlozeno += 1;
      detalji.push({ razlog: citanje.razlog });
      continue;
    }

    /*
     * Otisak se proverava PONOVO nad stabilnim čitanjem.
     *
     * Između otkrivanja i ovog čitanja fajl je mogao da se dovrši ili vrati na
     * raniju verziju; merodavan je otisak bajtova koje parser stvarno dobija.
     */
    if (citanje.sourceHash !== otkrivanje.sourceHash && store.imaOtisak(citanje.sourceHash)) {
      zbir.poznato += 1;
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
      zbir.nepodrzano += 1;
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
      zbir.nepodrzano += 1;
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
      zbir.nepodrzano += 1;
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
    zbir.novo += 1;
  }

  await log?.zapisi("info", "scan", { ...zbir, preskoceno: preskoceno.length });
  return { ...zbir, preskoceno };
}

/**
 * Šalje stavke iz reda.
 *
 * Privremene greške (429, prekid veze, 5xx) se oporavljaju u toku ciklusa —
 * vidi `retry.mjs`. `cekaj` i `sada` se mogu zameniti u testovima.
 *
 * @param {{ store, konfiguracija, kljuc, lokalniDatum, fetchImpl?, dozvoliHttp?, log?,
 *           cekaj?: (ms: number) => Promise<void>, sada?: () => number, politika? }} ulaz
 */
export async function posaljiIzReda(ulaz) {
  const { store, konfiguracija, kljuc, lokalniDatum } = ulaz;
  const cekaj = ulaz.cekaj ?? spavaj;
  const sada = ulaz.sada ?? (() => Date.now());
  const politika = ulaz.politika ?? PODRAZUMEVANA_POLITIKA;

  /*
   * Oporavak PRE svega ostalog.
   *
   * Pad procesa usred slanja ostavlja stavku u `salje_se`. Bez ovoga bi ostala
   * tamo zauvek — najtiši mogući gubitak, jer izgleda kao da se nešto dešava.
   * Radi se pod bravom, pa ne može da otme stavku živoj instanci.
   */
  const oporavljeno = store.oporaviZaglavljene();

  /*
   * Stavke koje je starija verzija zbog 429 ili prekida veze odložila do
   * sledećeg radnog dana vraćaju se u red — prekinut talas se nastavlja istim
   * `queue.db`, bez premeštanja ili brisanja.
   */
  const oslobodjeno = store.oslobodiPrivremenaOdlaganja();

  const zbir = {
    oporavljeno,
    oslobodjeno,
    poslato: 0,
    potvrdjeno: 0,
    zaPregled: 0,
    odlozeno: 0,
    odbijeno: 0,
    ponovljeno: 0,
    cekanoMs: 0,
    zaustavljeno: null,
    nastaviPosle: null,
  };

  /*
   * Server je tražio duže čekanje u prethodnom ciklusu: do tog trenutka se ne
   * šalje ništa (ponovno pokretanje ne sme da tuče server).
   */
  const pauza = store.citajMetu("nastavi_posle");
  if (pauza && Date.parse(pauza) > sada()) {
    zbir.zaustavljeno = "ceka_server";
    zbir.nastaviPosle = pauza;
    return zbir;
  }
  if (pauza) store.postaviMetu("nastavi_posle", "");

  const stavke = store.zaSlanje({ limit: konfiguracija.maxPoCiklusu, lokalniDatum });
  let uzastopno = 0;
  /** Slanja u OVOM ciklusu po stavci; `stavka.pokusaja` je snimak sa početka. */
  const ovajCiklus = new Map();

  for (let i = 0; i < stavke.length; i += 1) {
    const stavka = stavke[i];
    if (!store.oznaciSalje(stavka.id)) continue; // Neko drugi ju je preuzeo.
    ovajCiklus.set(stavka.id, (ovajCiklus.get(stavka.id) ?? 0) + 1);
    if (ovajCiklus.get(stavka.id) === 1) zbir.poslato += 1;

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

    const privremeno = vrstaPrivremenog(odgovor);
    if (privremeno) {
      /*
       * Odgovor nije stigao, ili server traži da se sačeka. O knjiženju se ne
       * zaključuje ništa: ako je knjiženo, ponovno slanje dobija `duplicate_file`.
       */
      const ukupnoSlanja = (stavka.pokusaja ?? 0) + ovajCiklus.get(stavka.id);
      if (ukupnoSlanja >= politika.maxPokusajaStavke) {
        store.odlozi({
          id: stavka.id,
          odlozenoDo: sledeciPokusajPosleNeuspeha(lokalniDatum, {
            dodatnaZatvaranja: konfiguracija.dodatnaZatvaranja,
          }),
          razlog: `iscrpljeno:${odgovor.code ?? odgovor.razlog ?? privremeno}`,
        });
        zbir.odlozeno += 1;
        uzastopno = 0;
        continue;
      }
      store.vratiUSpremno({ id: stavka.id, razlog: `privremeno:${odgovor.code ?? odgovor.razlog ?? privremeno}` });
      uzastopno += 1;
      const odluka = cekanjeZa({ vrsta: privremeno, retryAfterSec: odgovor.retryAfter ?? null, uzastopno, politika });
      await ulaz.log?.zapisi("warn", "privremeno", {
        ref: `sd:${stavka.source_hash.slice(0, 12)}`,
        vrsta: privremeno,
        http: odgovor.httpStatus,
        retryAfter: odgovor.retryAfter ?? null,
        uzastopno,
      });
      if ("stani" in odluka) {
        zbir.zaustavljeno = odluka.razlog;
        zbir.nastaviPosle = new Date(sada() + odluka.nastaviPosleMs).toISOString();
        store.postaviMetu("nastavi_posle", zbir.nastaviPosle);
        break;
      }
      await cekaj(odluka.cekajMs);
      zbir.cekanoMs += odluka.cekajMs;
      zbir.ponovljeno += 1;
      i -= 1; // ista stavka ponovo, sa novim nonce-om
      continue;
    }
    uzastopno = 0;

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

  return zbir;
}
