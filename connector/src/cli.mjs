import { generateKeyPairSync } from "node:crypto";
import { access, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { keyFingerprint } from "../../lib/sync/device/signing.mjs";
import { ucitajKonfiguraciju } from "./config.mjs";
import { izaberiAdapter, KeystoreError } from "./keystore/index.mjs";
import { napraviLog, podrazumevanaPutanjaLoga } from "./logging.mjs";
import { STANJA } from "./outcomes.mjs";
import { posaljiIzReda, skenirajURed } from "./pipeline.mjs";
import { opisiPokrivenost } from "./calendar.mjs";
import { lokalnoVreme, odlukaOCiklusu, sledeciTermin } from "./schedule.mjs";
import { otvoriStore, podrazumevanaPutanjaStanja, StoreError } from "./store.mjs";
import { proveriIzvor } from "./scanner.mjs";
import { posaljiHeartbeat } from "./client.mjs";

/**
 * Ulazna tačka konektora.
 *
 * Komande su namerno razdvojene po tome ŠTA smeju: `doctor` i `dry-run` ne
 * dodiruju mrežu, `run-once` je izričito ručni ciklus, `auto` poštuje raspored.
 * Jedna komanda „uradi sve“ bi značila da proba i slanje izgledaju isto.
 */

const KOMANDE = ["doctor", "init", "export-key", "dry-run", "run-once", "auto", "status"];

function ispisi(objekat) {
  process.stdout.write(`${JSON.stringify(objekat, null, 2)}\n`);
}

/** Putanje lokalnog stanja; sve pod jednim folderom, u profilu naloga. */
function putanje(env = process.env) {
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
      kod: greska instanceof KeystoreError ? greska.code : "keystore_error",
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
    return 0;
  } finally {
    store.zatvori();
  }
}

async function ciklus(p, { rucni, now = new Date() }) {
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
        ispisi({ komanda: "auto", status: odluka.akcija, ...odluka });
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
      skeniranje,
      slanje,
      sledeciTermin: sledeciTermin({
        now,
        poslednjiIzvrsenDatum: store.citajMetu("poslednji_ciklus_datum"),
        dodatnaZatvaranja: k.dodatnaZatvaranja,
      }),
    });
    return slanje.zaustavljeno ? 1 : 0;
  } finally {
    store.otpustiZakljucavanje(vlasnik);
    store.zatvori();
  }
}

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
