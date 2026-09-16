import { generateKeyPairSync } from "node:crypto";
import { access, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { keyFingerprint, SIGNED_PATHS } from "../../lib/sync/device/signing.mjs";
import { ucitajKonfiguraciju } from "./config.mjs";
import { izaberiAdapter, KeystoreError } from "./keystore/index.mjs";
import { napraviLog, podrazumevanaPutanjaLoga } from "./logging.mjs";
import { STANJA } from "./outcomes.mjs";
import { IZLAZ_NEPOTPUN_POPIS, izlazniKodCiklusa, posaljiIzReda, skenirajURed } from "./pipeline.mjs";
import { opisiPokrivenost } from "./calendar.mjs";
import { lokalnoVreme, odlukaOCiklusu, sledeciTermin } from "./schedule.mjs";
import { otvoriStore, podrazumevanaPutanjaStanja, SEMA_VERZIJA, StoreError } from "./store.mjs";
import { proveriIzvor } from "./scanner.mjs";
import { posaljiHeartbeat } from "./client.mjs";
import {
  izvrsiKomandu,
  LOKALNA_ZAVRSNA,
  posaljiNepotvrdjene,
  PODRZANA_VERZIJA,
  PODRZAN_TIP,
  preuzmiKomandu,
  sledeciInterval,
} from "./commands.mjs";

/**
 * Ulazna tačka konektora.
 *
 * Komande su namerno razdvojene po tome ŠTA smeju: `doctor` i `dry-run` ne
 * dodiruju mrežu, `run-once` je izričito ručni ciklus, `auto` poštuje raspored.
 * Jedna komanda „uradi sve“ bi značila da proba i slanje izgledaju isto.
 */

const KOMANDE = ["doctor", "init", "export-key", "dry-run", "run-once", "auto", "poll-once", "watch", "status"];

function ispisi(objekat) {
  process.stdout.write(`${JSON.stringify(objekat, null, 2)}\n`);
}

/** Putanje lokalnog stanja; sve pod jednim folderom, u profilu naloga. */
export function putanje(env = process.env) {
  const bazaDb = podrazumevanaPutanjaStanja(env);
  const folder = dirname(bazaDb);
  return {
    folder,
    baza: bazaDb,
    kljuc: join(folder, "device-key.bin"),
    log: podrazumevanaPutanjaLoga(folder),
    konfiguracija: env.CS_CONNECTOR_CONFIG || join(folder, "config.json"),
  };
}

/** Identitet reda: vezuje lokalno stanje za server, uređaj i opseg. */
const identitetOd = (k) => ({
  origin: k.serverOrigin,
  deviceCode: k.deviceCode,
  sourceSystem: k.sourceSystem,
  issuerCode: k.issuerCode,
  contractVersion: 1,
});

async function postoji(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Kod greške skladišta ključa — samo iz poznatog, zatvorenog oblika.
 *
 * Poruka se nikad ne koristi: ume da nosi putanju. Kod DPAPI kanala se prihvata
 * samo ako odgovara obrascu, da slučajna vrednost iz izuzetka ne uđe u ispis.
 */
function bezbedanKodSkladista(greska) {
  if (greska instanceof KeystoreError) return greska.code;
  const kod = String(greska?.code ?? "");
  return /^dpapi_[a-z0-9_]{1,40}$/.test(kod) ? kod : "keystore_error";
}

/* ========================================================================= */

async function doctor(p) {
  const nalazi = [];
  const dodaj = (sta, status, detalj) => nalazi.push({ provera: sta, status, detalj });

  dodaj("runtime", "ok", { node: process.version, platforma: process.platform });

  /*
   * `node:sqlite` je u Node 24 označen kao eksperimentalan. To se PRIJAVLJUJE,
   * ne krije: runtime je pinovan uz paket, ali nadogradnja Node-a mora biti
   * namerna i testirana radnja.
   */
  dodaj("lokalno_skladiste", "ok", {
    modul: "node:sqlite",
    napomena: "U Node 24 označen kao experimental; runtime je pinovan uz paket.",
  });

  let k = null;
  try {
    k = await ucitajKonfiguraciju(p.konfiguracija);
    dodaj("konfiguracija", "ok", {
      origin: k.serverOrigin,
      device: k.deviceCode,
      opseg: `${k.sourceSystem}/${k.issuerCode}`,
    });
  } catch (greska) {
    dodaj("konfiguracija", "greska", { kod: greska.code, poruka: greska.message });
  }

  if (k) {
    try {
      await proveriIzvor(k.izvorniFolder);
      dodaj("izvorni_folder", "ok", { napomena: "dostupan i čitljiv" });
    } catch (greska) {
      // Nedostupan izvor NIJE „nema faktura“ — prikazuje se kao greška.
      dodaj("izvorni_folder", "greska", { kod: greska.code });
    }
  }

  try {
    await mkdir(p.folder, { recursive: true });
    dodaj("folder_stanja", "ok", { napomena: "postoji i upisiv" });
  } catch {
    dodaj("folder_stanja", "greska", { kod: "state_dir_unwritable" });
  }

  try {
    const { ime, adapter } = izaberiAdapter();
    const rez = await adapter.proveri();
    dodaj("skladiste_kljuca", rez.upozorenje ? "upozorenje" : "ok", { adapter: ime, ...rez });
  } catch (greska) {
    dodaj("skladiste_kljuca", "greska", {
      /*
       * Stabilan kod DPAPI kanala (`dpapi_process_failed`, `dpapi_timeout`, …)
       * prolazi doslovno. Bez njega bi „PowerShell se nije pokrenuo" i
       * „PowerShell je odbio podatak" u izveštaju izgledali isto.
       */
      kod: bezbedanKodSkladista(greska),
    });
  }

  dodaj("kljuc", (await postoji(p.kljuc)) ? "ok" : "nedostaje", {
    napomena: "privatni ključ postoji lokalno (sadržaj se ne prikazuje)",
  });

  const lokalno = lokalnoVreme(new Date());
  const pokrivenost = opisiPokrivenost(Number(lokalno.datum.slice(0, 4)));
  dodaj(
    "kalendar",
    pokrivenost.pokrivena ? "ok" : "greska",
    { ...pokrivenost, lokalnoVreme: lokalno },
  );

  /*
   * Kompatibilnost protokola komandi.
   *
   * Doctor NAMERNO ne poll-uje: poll bi na serveru preuzeo stvarnu komandu i
   * označio je kao isporučenu, a doctor je ne izvršava — komanda bi ostala da
   * visi. Zato se proverava samo ono što se može proveriti bez posledice:
   * da li lokalna šema, zatvoreni tip komande i lista potpisanih putanja idu
   * zajedno. Da li server uopšte nudi komande, vidi se pri prvom `poll-once`.
   */
  const putanjeKomandi = ["/api/sync/commands/poll", "/api/sync/commands/update"];
  const nepotpisane = putanjeKomandi.filter((x) => !SIGNED_PATHS.includes(x));
  dodaj("protokol_komandi", nepotpisane.length === 0 ? "ok" : "greska", {
    tip: PODRZAN_TIP,
    verzija: PODRZANA_VERZIJA,
    semaReda: SEMA_VERZIJA,
    nepotpisanePutanje: nepotpisane,
    napomena: "Doctor ne preuzima i ne izvršava komandu.",
  });

  const problema = nalazi.filter((n) => n.status === "greska").length;
  ispisi({ komanda: "doctor", problema, nalazi });
  return problema === 0 ? 0 : 1;
}

/* ========================================================================= */

async function init(p, { force = false } = {}) {
  if ((await postoji(p.kljuc)) && !force) {
    /*
     * Ponovljen `init` NE menja postojeći ključ.
     *
     * Tiha zamena bi obesmislila već obavljenu aktivaciju na serveru: uređaj bi
     * i dalje bio „aktivan“, a potpisi mu više ne bi odgovarali. Oporavak od
     * izgubljenog ključa je NOVA ovlašćena registracija, ne pogađanje.
     */
    ispisi({
      komanda: "init",
      status: "vec_postoji",
      poruka:
        "Ključ već postoji i nije zamenjen. Za rotaciju koristi ovlašćenu registraciju novog ključa na serveru.",
    });
    return 1;
  }

  const { ime, adapter } = izaberiAdapter();
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const pkcs8 = privateKey.export({ type: "pkcs8", format: "der" });
  const spki = publicKey.export({ type: "spki", format: "der" }).toString("base64");

  await adapter.sacuvaj({ putanja: p.kljuc, privateKeyPkcs8Der: new Uint8Array(pkcs8) });

  /*
   * Na ekran ide SAMO javni deo i otisak.
   *
   * Privatni ključ nikad ne prolazi kroz `stdout`, argumente procesa ni log.
   */
  ispisi({
    komanda: "init",
    status: "napravljen",
    adapter: ime,
    javniKljucSpkiBase64: spki,
    fingerprint: keyFingerprint(spki),
    sledeciKorak:
      "Predaj javni ključ i otisak ovlašćenom licu radi registracije i aktivacije uređaja na serveru " +
      "(postojeći tok `devices:manage`). Registracioni ekran u portalu je P4.",
  });
  return 0;
}

async function exportKey(p) {
  if (!(await postoji(p.kljuc))) {
    ispisi({ komanda: "export-key", status: "nema_kljuca" });
    return 1;
  }
  const { adapter } = izaberiAdapter();
  const pkcs8 = await adapter.ucitaj({ putanja: p.kljuc });
  const { createPrivateKey, createPublicKey } = await import("node:crypto");
  const priv = createPrivateKey({ key: Buffer.from(pkcs8), format: "der", type: "pkcs8" });
  const spki = createPublicKey(priv).export({ type: "spki", format: "der" }).toString("base64");
  ispisi({
    komanda: "export-key",
    javniKljucSpkiBase64: spki,
    fingerprint: keyFingerprint(spki),
  });
  return 0;
}

/* ========================================================================= */

async function otvori(p) {
  const k = await ucitajKonfiguraciju(p.konfiguracija);
  const store = otvoriStore({ putanja: p.baza, identitet: identitetOd(k) });
  return { k, store, log: napraviLog(p.log) };
}

async function dryRun(p) {
  const { k, store, log } = await otvori(p);
  try {
    /*
     * `dry-run` ne dodiruje mrežu i ne označava ništa poslatim.
     *
     * Koristi ISTI put skeniranja i validacije kao pravi ciklus, pa je ono što
     * operater vidi u probi zaista ono što bi se poslalo.
     */
    const rez = await skenirajURed({ store, konfiguracija: k, log });
    ispisi({ komanda: "dry-run", poslato: 0, ...rez, napomena: "Nijedan zahtev nije poslat." });
    // Proba koja nije videla celu arhivu ne sme da izgleda kao čista proba.
    return izlazniKodCiklusa({ skeniranje: rez });
  } finally {
    store.zatvori();
  }
}

async function ciklus(p, { rucni, now = new Date(), tiho = false }) {
  const { k, store, log } = await otvori(p);
  const vlasnik = `${process.pid}@${now.toISOString()}`;

  /*
   * Trajna brava u istoj bazi kao i red.
   *
   * Dve instance (autostart + ručno pokretanje) ne smeju da šalju istovremeno:
   * obe bi uzele iste stavke i napravile dvostruko toliko zahteva.
   */
  const brava = store.uzmiZakljucavanje({ vlasnik, now });
  if (!brava.uzeto) {
    ispisi({
      komanda: rucni ? "run-once" : "auto",
      status: "zauzeto",
      poruka: "Druga instanca je aktivna; ovaj prolaz ne radi ništa.",
    });
    store.zatvori();
    return 0;
  }

  try {
    const lokalno = lokalnoVreme(now);

    if (!rucni) {
      const odluka = odlukaOCiklusu({
        now,
        poslednjiIzvrsenDatum: store.citajMetu("poslednji_ciklus_datum"),
        odlozenoDo: store.citajMetu("odlozeno_do"),
        dodatnaZatvaranja: k.dodatnaZatvaranja,
      });
      if (odluka.akcija !== "pokreni") {
        if (!tiho) ispisi({ komanda: "auto", status: odluka.akcija, ...odluka });
        return odluka.akcija === "blokirano" ? 1 : 0;
      }
    }

    const kljuc = await (await izaberiAdapter()).adapter.ucitaj({ putanja: p.kljuc });

    const skeniranje = await skenirajURed({ store, konfiguracija: k, log });
    const slanje = await posaljiIzReda({
      store,
      konfiguracija: k,
      kljuc,
      lokalniDatum: lokalno.datum,
      log,
    });

    /*
     * Datum izvršenog ciklusa se upisuje i kada je bilo neuspeha.
     *
     * Bez toga bi propušten termin sledećeg pokretanja pokrenuo ciklus ponovo
     * istog dana, i konektor koji se restartuje u petlji bi tukao server.
     */
    if (!rucni) store.postaviMetu("poslednji_ciklus_datum", lokalno.datum);

    ispisi({
      komanda: rucni ? "run-once" : "auto",
      uzrok: rucni ? "rucno_pokretanje" : "raspored",
      datum: lokalno.datum,
      popis: skeniranje.popis,
      kodPopisa: skeniranje.kodPopisa,
      // Istorijski backfill: koliko novih dokumenata čeka i koliko je to serija.
      preostalo: skeniranje.preostalo,
      preostaloSerija: skeniranje.preostaloSerija,
      ostaloURedu: slanje.ostaloURedu,
      skeniranje,
      slanje,
      sledeciTermin: sledeciTermin({
        now,
        poslednjiIzvrsenDatum: store.citajMetu("poslednji_ciklus_datum"),
        dodatnaZatvaranja: k.dodatnaZatvaranja,
      }),
    });
    /*
     * Blokada ima prednost: ona zaustavlja slanje. Nepotpun popis nije
     * zaustavio slanje viđenog, ali ciklus nije potpuno uspešan — i Task
     * Scheduler to mora da vidi kao „Last Run Result“ različit od nule.
     */
    return izlazniKodCiklusa({ skeniranje, slanje });
  } finally {
    store.otpustiZakljucavanje(vlasnik);
    store.zatvori();
  }
}

/**
 * Jedan prolaz kroz komande: nepotvrđeni događaji, pa eventualna nova komanda.
 *
 * Odvojeno od `auto` da bi se moglo pozvati i testirati bez čekanja intervala.
 * Radi POD BRAVOM — komanda ne otvara drugi konkurentni scan; ako neki ciklus
 * već traje, ovaj prolaz ne radi ništa.
 */
/**
 * Jedan prolaz kroz komande.
 *
 * Vraća `{ kod, zdravo }`. `zdravo` NIJE isto što i „izlazni kod 0“: server koji
 * je odgovorio „nema komandi“ je zdrav, a nedostupna mreža, odbijen uređaj i
 * ugašen gate nisu — iako nijedno od toga nije pad procesa. Bez te razlike bi
 * `watch` petlja bez interneta zauvek pitala svakih 45 s.
 */
async function pollOnce(p, { now = new Date(), fetchImpl, dozvoliHttp, tiho = false } = {}) {
  const reci = (o) => {
    // U `watch` petlji se ispisuje samo ono što se stvarno desilo.
    if (!tiho || (o.status !== "nema" && o.status !== "zauzeto")) ispisi(o);
  };
  const { k, store, log } = await otvori(p);
  const vlasnik = `${process.pid}@${now.toISOString()}`;
  const brava = store.uzmiZakljucavanje({ vlasnik, now });
  if (!brava.uzeto) {
    // Drugi proces radi; to nije kvar veze i ne ubrzava se ponavljanjem.
    reci({ komanda: "poll-once", status: "zauzeto" });
    store.zatvori();
    return { kod: 0, zdravo: true };
  }

  try {
    const kljuc = await (await izaberiAdapter()).adapter.ucitaj({ putanja: p.kljuc });
    const ctx = { store, konfiguracija: k, kljuc, log, fetchImpl, dozvoliHttp };

    /*
     * Nepotvrđeni događaji IDU PRVI.
     *
     * Posle pada ili izgubljenog odgovora server možda ne zna ishod prethodne
     * komande. Slanje pre uzimanja nove drži portal tačnim.
     */
    const zaostali = await posaljiNepotvrdjene(ctx);

    /*
     * Otvorena lokalna komanda se NASTAVLJA, ne uzima se nova.
     *
     * Restart usred izvršenja ne sme da zaboravi komandu ni da uzme drugu
     * paralelno.
     */
    const otvorena = store.otvorenaKomanda();
    if (otvorena) {
      if (LOKALNA_ZAVRSNA.includes(otvorena.stanje)) {
        store.zavrsiKomandu({ id: otvorena.id, stanje: otvorena.stanje });
        reci({ komanda: "poll-once", status: "zatvorena_zaostala", zaostali });
        return { kod: 0, zdravo: true };
      }
      const rez = await izvrsiKomandu({
        ...ctx,
        komanda: otvorena,
        lokalniDatum: lokalnoVreme(now).datum,
      });
      reci({
        komanda: "poll-once",
        status: "nastavljena",
        ishod: rez.stanje,
        failureCode: rez.failureCode,
        zaostali,
      });
      return { kod: rez.skeniranje?.kodPopisa ? IZLAZ_NEPOTPUN_POPIS : 0, zdravo: true };
    }

    const preuzeta = await preuzmiKomandu(ctx);
    if (preuzeta.ishod !== "komanda") {
      reci({ komanda: "poll-once", status: preuzeta.ishod, razlog: preuzeta.razlog ?? null, zaostali });
      /*
       * Samo „nema komandi“ je zdrav odgovor.
       *
       * `nedostupno` (mreža), `odbijeno` (opozvan uređaj, loš potpis) i
       * `iskljuceno` (gate ugašen) traže backoff — inače uređaj bez interneta
       * ili sa opozvanim ključem pita svakih 45 s zauvek i puni log.
       */
      return { kod: 0, zdravo: preuzeta.ishod === "nema" };
    }

    const rez = await izvrsiKomandu({
      ...ctx,
      komanda: preuzeta.komanda,
      lokalniDatum: lokalnoVreme(now).datum,
    });
    reci({
      komanda: "poll-once",
      status: "izvrseno",
      ishod: rez.stanje,
      failureCode: rez.failureCode,
      ackPoslat: rez.ackPoslat,
      // Bez ijednog podatka o dokumentu — samo zbirni brojevi.
      skeniranje: rez.skeniranje,
      slanje: rez.slanje,
    });
    /*
     * Blokada je stvarni problem podešavanja; ni izlazni kod ni ritam je ne
     * prašta. Nepotpun popis nije mrežni problem i ne traži backoff (`zdravo`
     * ostaje), ali ga izlazni kod ne prećutkuje.
     */
    return { kod: izlazniKodCiklusa(rez), zdravo: rez.stanje !== "blocked" };
  } finally {
    store.otpustiZakljucavanje(vlasnik);
    store.zatvori();
  }
}

/**
 * Dugotrajni režim: periodično pita za komande i poštuje termin u 09:00.
 *
 * Dve nezavisne stvari u jednoj petlji:
 *  - komande, sa ograničenim intervalom (45 s ± jitter) i eksponencijalnim
 *    backoff-om do 30 min kada server ne odgovara ili je uređaj blokiran;
 *  - poslovni raspored, koji ostaje netaknut — `auto` odluka se proverava u
 *    svakom prolazu i izvršava najviše jednom dnevno.
 *
 * Bez backoff-a bi konektor bez interneta pitao svakih 45 s zauvek. Bez
 * jitter-a bi se više uređaja poravnalo u isti trenutak.
 */
/** Stanja koja čekanje ne popravlja: petlja staje i prijavljuje kod. */
const NEPOPRAVLJIVO = new Set([
  "config_missing",
  "config_invalid",
  "key_missing",
  "identity_mismatch",
  "schema_newer",
  "source_missing",
]);

export async function watch(p, { maxProlaza = Infinity, sleep = cekaj, now = () => new Date() } = {}) {
  let neuspeha = 0;
  let prolaz = 0;

  while (prolaz < maxProlaza) {
    prolaz += 1;
    const trenutak = now();

    // 1. Poslovni termin je nezavisan od komandi.
    try {
      await ciklus(p, { rucni: false, now: trenutak, tiho: true });
    } catch {
      /* Neuspeh ciklusa se već beleži; petlja se zbog njega ne prekida. */
    }

    // 2. Komande.
    let zdravo = false;
    try {
      ({ zdravo } = await pollOnce(p, { now: trenutak, tiho: true }));
    } catch (greska) {
      /*
       * Greška PODEŠAVANJA se ne odlaže — petlja staje.
       *
       * Nedostajuća konfiguracija, ključ ili neusklađen lokalni red ne
       * popravljaju se čekanjem. Da se i to tretira kao mrežni problem,
       * pogrešno podešen konektor bi tiho backoff-ovao u nedogled i izgledao
       * kao da radi, a nikada ne bi ni pitao za komandu.
       */
      if (NEPOPRAVLJIVO.has(greska?.code)) {
        ispisi({ komanda: "watch", status: "zaustavljeno", kod: greska.code });
        return 1;
      }
      zdravo = false;
    }
    neuspeha = zdravo ? 0 : neuspeha + 1;

    if (prolaz >= maxProlaza) break;
    await sleep(sledeciInterval({ neuspeha }));
  }
  return 0;
}

const cekaj = (ms) => new Promise((r) => setTimeout(r, ms));

async function status(p, now = new Date()) {
  const { k, store } = await otvori(p);
  try {
    const lokalno = lokalnoVreme(now);
    ispisi({
      komanda: "status",
      lokalnoVreme: lokalno,
      kalendar: opisiPokrivenost(Number(lokalno.datum.slice(0, 4))),
      red: store.zbir(),
      poslednjiCiklus: store.citajMetu("poslednji_ciklus_datum"),
      sledeciTermin: sledeciTermin({
        now,
        poslednjiIzvrsenDatum: store.citajMetu("poslednji_ciklus_datum"),
        dodatnaZatvaranja: k.dodatnaZatvaranja,
      }),
      // Redigovano: bez putanja, imena fajlova i sadržaja.
      poslednjiIshodi: store.poslednjiIshodi(10),
      // Bezbedno: samo ID, stanje i vreme — bez ijednog podatka o dokumentu.
      // Naziv NIJE `komanda`: taj ključ već nosi ime same CLI komande, pa bi
      // drugi isti ključ tiho pregazio oznaku i log bi izgubio identitet reda.
      otvorenaKomanda: (() => {
        const o = store.otvorenaKomanda();
        return o ? { id: o.id, stanje: o.stanje, preuzeto: o.preuzeto_u } : null;
      })(),
      nepotvrdjenihDogadjaja: store.nepotvrdjeniDogadjaji(50).length,
      stanja: Object.values(STANJA),
    });
    return 0;
  } finally {
    store.zatvori();
  }
}

async function heartbeat(p) {
  const { k, store } = await otvori(p);
  try {
    const kljuc = await (await izaberiAdapter()).adapter.ucitaj({ putanja: p.kljuc });
    const odgovor = await posaljiHeartbeat({
      origin: k.serverOrigin,
      deviceCode: k.deviceCode,
      keyId: k.keyId,
      privateKeyPkcs8Der: kljuc,
      timeoutMs: k.timeoutMs,
    });
    ispisi({
      komanda: "heartbeat",
      http: odgovor.httpStatus,
      kod: odgovor.code,
      // Heartbeat znači SAMO da se uređaj javio — ne uvoz i ne sinhronizaciju.
      znacenje: "authenticated_contact_only",
    });
    return odgovor.code === "acknowledged" ? 0 : 1;
  } finally {
    store.zatvori();
  }
}

/* ========================================================================= */

export async function main(argv = process.argv.slice(2), env = process.env) {
  const komanda = argv[0];
  const p = putanje(env);

  if (!komanda || komanda === "--help" || komanda === "-h") {
    process.stdout.write(
      `Carsystem konektor\n\nKomande:\n  ${KOMANDE.join("\n  ")}\n  heartbeat\n\n` +
        `Stanje: ${p.folder}\nKonfiguracija: ${p.konfiguracija}\n`,
    );
    return 0;
  }

  try {
    switch (komanda) {
      case "doctor":
        return await doctor(p);
      case "init":
        return await init(p, { force: argv.includes("--force") });
      case "export-key":
        return await exportKey(p);
      case "dry-run":
        return await dryRun(p);
      case "run-once":
        return await ciklus(p, { rucni: true });
      case "poll-once":
        return (await pollOnce(p)).kod;
      case "watch":
        return await watch(p);
      case "auto":
        return await ciklus(p, { rucni: false });
      case "status":
        return await status(p);
      case "heartbeat":
        return await heartbeat(p);
      default:
        process.stderr.write(`Nepoznata komanda: ${komanda}\n`);
        return 2;
    }
  } catch (greska) {
    /*
     * Poruka se reduguje pre ispisa; `stack` se NE ispisuje.
     *
     * Stack nosi pune lokalne putanje, a poruka ume da nosi ime fajla.
     */
    const kod =
      greska instanceof StoreError || greska instanceof KeystoreError
        ? greska.code
        : (greska?.code ?? "greska");
    ispisi({ komanda, status: "greska", kod });
    return 1;
  }
}
