import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { STANJA, ZAVRSNA } from "./outcomes.mjs";

/**
 * Trajni lokalni red — `node:sqlite`, WAL, prave transakcije.
 *
 * Zašto SQLite iz jezgra Node-a
 * -----------------------------
 * Traži se dokazana atomarnost i oporavak. `Set` u memoriji ne preživljava
 * restart; jedan JSON fajl prepisan `writeFile`-om gubi ceo red ako proces
 * padne usred upisa, a `better-sqlite3` je nativni modul koji bi na Windowsu
 * tražio prevođenje ili prebuilt binarije po arhitekturi — tačno onaj deo
 * pakovanja koji najčešće pukne na tuđem računaru.
 *
 * `node:sqlite` je u isporučenom runtime-u i nema ništa da se prevodi.
 *
 * OGRADA: u Node 24 je ovaj modul označen kao EXPERIMENTAL. Runtime je pinovan
 * uz paket, pa se ponašanje ne menja samo od sebe, ali nadogradnja Node-a je
 * namerna i testirana radnja. `doctor` to prijavljuje kao poznat status, a ne
 * krije.
 *
 * Šta se OVDE ne radi
 * -------------------
 * Nema automatskog resetovanja pokvarenog reda i nema brisanja „starih
 * neuspeha“. Red koji se ne može otvoriti je razlog da se stane, ne da se
 * napravi nov prazan.
 */

/** Verzija šeme lokalnog reda; menja se samo uz migraciju ispod. */
const SEMA_VERZIJA = 1;

export class StoreError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "StoreError";
    this.code = code;
  }
}

/**
 * Otvara (ili pravi) lokalni red.
 *
 * `identitet` vezuje red za konkretan server i uređaj. Bez toga bi promena
 * `origin`-a ili uređaja tiho prenela stare potvrde o slanju na novi server —
 * i dokumenti bi izgledali poslati tamo gde nikad nisu stigli.
 *
 * @param {{ putanja: string, identitet: { origin: string, deviceCode: string,
 *           sourceSystem: string, issuerCode: string, contractVersion: number } }} ulaz
 */
export function otvoriStore(ulaz) {
  mkdirSync(dirname(ulaz.putanja), { recursive: true });
  const db = new DatabaseSync(ulaz.putanja);

  /*
   * WAL + `synchronous=FULL`.
   *
   * WAL da čitanje statusa ne blokira slanje; FULL zato što je gubitak
   * poslednje potvrde gori od nekoliko milisekundi po upisu — upravo ta
   * potvrda razlikuje „poslato“ od „poslaćemo opet“.
   */
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA synchronous = FULL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA busy_timeout = 10000");

  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      kljuc TEXT PRIMARY KEY,
      vrednost TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stavke (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      /* Otisak PDF bajtova — identitet dokumenta. Ime fajla to NIJE. */
      source_hash TEXT NOT NULL,
      /* Poslednja poznata putanja; samo za prikaz i ponovno čitanje. */
      putanja TEXT NOT NULL,
      velicina INTEGER NOT NULL,
      /* Tacni body bajtovi koji se potpisuju i salju. */
      telo BLOB,
      semantic_hash TEXT,
      stanje TEXT NOT NULL,
      razlog TEXT,
      pokusaja INTEGER NOT NULL DEFAULT 0,
      /* Lokalni datum najranijeg sledeceg pokusaja. */
      odlozeno_do TEXT,
      dodato_u TEXT NOT NULL,
      izmenjeno_u TEXT NOT NULL,
      /* Sto ga je server vratio pri zavrsnom ishodu; bez sadrzaja dokumenta. */
      server_kod TEXT,
      server_ref TEXT
    );

    /*
     * Jedan red po otisku SADRZAJA.
     *
     * Isti sadrzaj pod drugim imenom NE pravi drugu stavku; promenjeni bajtovi
     * na istoj putanji daju drugi otisak i zato novu stavku.
     */
    CREATE UNIQUE INDEX IF NOT EXISTS stavke_source_hash ON stavke(source_hash);
    CREATE INDEX IF NOT EXISTS stavke_stanje ON stavke(stanje);

    CREATE TABLE IF NOT EXISTS zakljucavanje (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      vlasnik TEXT NOT NULL,
      pid INTEGER NOT NULL,
      uzeto_u TEXT NOT NULL,
      obnovljeno_u TEXT NOT NULL
    );
  `);

  const meta = citajMetu(db);
  if (meta.sema_verzija && Number(meta.sema_verzija) !== SEMA_VERZIJA) {
    throw new StoreError(
      "schema_mismatch",
      `Lokalni red je šeme ${meta.sema_verzija}, a ovaj konektor očekuje ${SEMA_VERZIJA}.`,
    );
  }

  /*
   * Identitet se upisuje jednom i posle se SAMO poredi.
   *
   * Neslaganje je greška podešavanja, ne prilika za tiho preseljenje: stare
   * potvrde važe za stari server, a neposlate stavke za stari opseg.
   */
  const ocekivan = JSON.stringify(ulaz.identitet);
  if (!meta.identitet) {
    db.prepare("INSERT INTO meta(kljuc, vrednost) VALUES(?, ?)").run("identitet", ocekivan);
    db.prepare("INSERT INTO meta(kljuc, vrednost) VALUES(?, ?)").run(
      "sema_verzija",
      String(SEMA_VERZIJA),
    );
  } else if (meta.identitet !== ocekivan) {
    throw new StoreError(
      "identity_mismatch",
      "Lokalni red pripada drugom serveru/uređaju/opsegu. " +
        "Stari red se NE prenosi automatski — potrebno je kontrolisano ponovno podešavanje " +
        "(nova putanja stanja), a postojeći red ostaje netaknut.",
    );
  }

  return napraviApi(db, ulaz.putanja);
}

function citajMetu(db) {
  const redovi = db.prepare("SELECT kljuc, vrednost FROM meta").all();
  return Object.fromEntries(redovi.map((r) => [r.kljuc, r.vrednost]));
}

const sada = () => new Date().toISOString();

function napraviApi(db, putanja) {
  /**
   * Transakcija sa `BEGIN IMMEDIATE`.
   *
   * `IMMEDIATE` odmah uzima pisačku bravu; sa podrazumevanim `DEFERRED` bi dve
   * instance mogle da uđu u transakciju i da druga padne tek pri upisu, posle
   * posla koji je već obavljen.
   */
  const uTransakciji = (fn) => {
    db.exec("BEGIN IMMEDIATE");
    try {
      const rezultat = fn();
      db.exec("COMMIT");
      return rezultat;
    } catch (greska) {
      try {
        db.exec("ROLLBACK");
      } catch {
        /* rollback posle pada veze nema šta da vrati */
      }
      throw greska;
    }
  };

  return {
    putanja,
    db,

    /* ------------------------------------------------------------------ */
    /* Zaključavanje                                                       */
    /* ------------------------------------------------------------------ */

    /**
     * Trajno zaključavanje, u istoj bazi kao i red.
     *
     * Memorijski mutex ne vidi drugi proces, a zaseban lock fajl bi mogao da se
     * raziđe sa redom. Ovako brava i podaci ne mogu biti u različitim stanjima.
     *
     * `zastarelostMs` je zaštita od brave koju je ostavio pali proces. Obnavlja
     * se pri svakom ciklusu (`obnoviZakljucavanje`), pa ŽIVA instanca ne može da
     * bude prekinuta: da bi brava istekla, mora proći ceo period bez ijedne
     * obnove.
     */
    uzmiZakljucavanje({ vlasnik, zastarelostMs = 15 * 60 * 1000, now = new Date() }) {
      return uTransakciji(() => {
        const red = db.prepare("SELECT * FROM zakljucavanje WHERE id = 1").get();
        if (red) {
          const staro = now.getTime() - Date.parse(red.obnovljeno_u);
          if (staro < zastarelostMs) {
            return { uzeto: false, vlasnik: red.vlasnik, pid: red.pid, staroMs: staro };
          }
          db.prepare("DELETE FROM zakljucavanje WHERE id = 1").run();
        }
        db.prepare(
          "INSERT INTO zakljucavanje(id, vlasnik, pid, uzeto_u, obnovljeno_u) VALUES(1,?,?,?,?)",
        ).run(vlasnik, process.pid, now.toISOString(), now.toISOString());
        return { uzeto: true, vlasnik, pid: process.pid };
      });
    },

    obnoviZakljucavanje(vlasnik, now = new Date()) {
      db.prepare("UPDATE zakljucavanje SET obnovljeno_u = ? WHERE id = 1 AND vlasnik = ?").run(
        now.toISOString(),
        vlasnik,
      );
    },

    otpustiZakljucavanje(vlasnik) {
      db.prepare("DELETE FROM zakljucavanje WHERE id = 1 AND vlasnik = ?").run(vlasnik);
    },

    /* ------------------------------------------------------------------ */
    /* Red                                                                 */
    /* ------------------------------------------------------------------ */

    /** Postoji li već stavka za taj otisak sadržaja. */
    imaOtisak(sourceHash) {
      return Boolean(db.prepare("SELECT 1 FROM stavke WHERE source_hash = ?").get(sourceHash));
    },

    /**
     * Upisuje canonical telo i stanje `spremno` — u JEDNOJ transakciji.
     *
     * Telo i stanje moraju nastati zajedno. Da se upisuju odvojeno, pad između
     * njih bi ostavio stavku „spremnu za slanje“ bez ijednog bajta za slanje.
     */
    dodajSpremno({ sourceHash, putanja: p, velicina, telo, semanticHash }) {
      const t = sada();
      return uTransakciji(() => {
        const postoji = db.prepare("SELECT id FROM stavke WHERE source_hash = ?").get(sourceHash);
        if (postoji) return { dodato: false, id: postoji.id };
        const rez = db
          .prepare(
            `INSERT INTO stavke(source_hash, putanja, velicina, telo, semantic_hash,
                                stanje, dodato_u, izmenjeno_u)
             VALUES(?,?,?,?,?,?,?,?)`,
          )
          .run(sourceHash, p, velicina, telo, semanticHash, STANJA.SPREMNO, t, t);
        return { dodato: true, id: Number(rez.lastInsertRowid) };
      });
    },

    /** Stavka koja se lokalno ne može poslati (nečitljiva, nepodržana). */
    dodajNepodrzano({ sourceHash, putanja: p, velicina, razlog }) {
      const t = sada();
      return uTransakciji(() => {
        const postoji = db.prepare("SELECT id FROM stavke WHERE source_hash = ?").get(sourceHash);
        if (postoji) return { dodato: false, id: postoji.id };
        const rez = db
          .prepare(
            `INSERT INTO stavke(source_hash, putanja, velicina, stanje, razlog, dodato_u, izmenjeno_u)
             VALUES(?,?,?,?,?,?,?)`,
          )
          .run(sourceHash, p, velicina, STANJA.NEPODRZANO, razlog, t, t);
        return { dodato: true, id: Number(rez.lastInsertRowid) };
      });
    },

    /**
     * Stavke za slanje, u ograničenoj seriji.
     *
     * `LIMIT` je obavezan: bez njega bi ciklus nad višegodišnjom istorijom
     * povukao ceo red u memoriju.
     */
    zaSlanje({ limit = 50, lokalniDatum }) {
      return db
        .prepare(
          `SELECT id, source_hash, putanja, telo, semantic_hash, pokusaja
             FROM stavke
            WHERE stanje = ?
              AND (odlozeno_do IS NULL OR odlozeno_do <= ?)
            ORDER BY id
            LIMIT ?`,
        )
        .all(STANJA.SPREMNO, lokalniDatum, limit);
    },

    /**
     * Označava stavku kao „u slanju“ — atomarno, uz uslov nad trenutnim stanjem.
     *
     * `WHERE stanje = 'spremno'` sprečava da dve petlje uzmu istu stavku; vraća
     * se broj izmenjenih redova, pa pozivalac zna da li je stvarno on preuzeo.
     */
    oznaciSalje(id) {
      const rez = db
        .prepare(
          `UPDATE stavke SET stanje = ?, pokusaja = pokusaja + 1, izmenjeno_u = ?
            WHERE id = ? AND stanje = ?`,
        )
        .run(STANJA.SALJE_SE, sada(), id, STANJA.SPREMNO);
      return rez.changes === 1;
    },

    /**
     * Vraća zaglavljene `salje_se` stavke u `spremno`.
     *
     * Poziva se na POČETKU ciklusa, pod bravom. Pad procesa usred slanja inače
     * ostavlja stavku zauvek u `salje_se` i ona nikad više ne bi bila poslata —
     * najtiši mogući gubitak.
     */
    oporaviZaglavljene() {
      const rez = db
        .prepare(`UPDATE stavke SET stanje = ?, izmenjeno_u = ? WHERE stanje = ?`)
        .run(STANJA.SPREMNO, sada(), STANJA.SALJE_SE);
      return rez.changes;
    },

    /**
     * Završni ishod od servera.
     *
     * Upisuje se TEK posle prepoznatog odgovora. Ako ovaj upis ne uspe,
     * pozivalac NE sme da prijavi uspeh — stavka ostaje i biće poslata ponovo,
     * a server je idempotentan po otisku.
     */
    zavrsi({ id, stanje, serverKod, serverRef = null, razlog = null }) {
      if (!ZAVRSNA.includes(stanje) && stanje !== STANJA.BLOKIRANO) {
        throw new StoreError("not_final", `Stanje „${stanje}“ nije završno.`);
      }
      return uTransakciji(() => {
        db.prepare(
          `UPDATE stavke SET stanje = ?, server_kod = ?, server_ref = ?, razlog = ?, izmenjeno_u = ?
            WHERE id = ?`,
        ).run(stanje, serverKod, serverRef, razlog, sada(), id);
      });
    },

    /** Privremeni neuspeh: nazad u `spremno`, uz odlaganje do sledećeg termina. */
    odlozi({ id, odlozenoDo, razlog }) {
      return uTransakciji(() => {
        db.prepare(
          `UPDATE stavke SET stanje = ?, odlozeno_do = ?, razlog = ?, izmenjeno_u = ? WHERE id = ?`,
        ).run(STANJA.SPREMNO, odlozenoDo, razlog, sada(), id);
      });
    },

    /** Vraća stavku u `spremno` bez odlaganja (npr. posle `nonce_replayed`). */
    vratiUSpremno({ id, razlog }) {
      db.prepare(`UPDATE stavke SET stanje = ?, razlog = ?, izmenjeno_u = ? WHERE id = ?`).run(
        STANJA.SPREMNO,
        razlog,
        sada(),
        id,
      );
    },

    /* ------------------------------------------------------------------ */
    /* Stanje ciklusa                                                      */
    /* ------------------------------------------------------------------ */

    postaviMetu(kljuc, vrednost) {
      db.prepare(
        "INSERT INTO meta(kljuc, vrednost) VALUES(?, ?) ON CONFLICT(kljuc) DO UPDATE SET vrednost = excluded.vrednost",
      ).run(kljuc, String(vrednost));
    },

    citajMetu(kljuc) {
      return db.prepare("SELECT vrednost FROM meta WHERE kljuc = ?").get(kljuc)?.vrednost ?? null;
    },

    /** Zbir po stanjima — za `status`, bez ijednog poslovnog podatka. */
    zbir() {
      const redovi = db.prepare("SELECT stanje, count(*) AS n FROM stavke GROUP BY stanje").all();
      return Object.fromEntries(redovi.map((r) => [r.stanje, r.n]));
    },

    /** Poslednji ishodi, redigovano: bez putanje, imena fajla i sadržaja. */
    poslednjiIshodi(limit = 10) {
      return db
        .prepare(
          `SELECT source_hash, stanje, server_kod, razlog, pokusaja, izmenjeno_u
             FROM stavke ORDER BY izmenjeno_u DESC LIMIT ?`,
        )
        .all(limit)
        .map((r) => ({
          // Samo prefiks otiska — dovoljno da se stavka pronađe, ne otkriva dokument.
          ref: `sd:${String(r.source_hash).slice(0, 12)}`,
          stanje: r.stanje,
          serverKod: r.server_kod,
          razlog: r.razlog,
          pokusaja: r.pokusaja,
          izmenjeno: r.izmenjeno_u,
        }));
    },

    zatvori() {
      try {
        db.close();
      } catch {
        /* zatvaranje već zatvorene baze nije greška koju iko treba da vidi */
      }
    },
  };
}

/** Podrazumevana putanja lokalnog stanja, u profilu naloga koji izvršava. */
export function podrazumevanaPutanjaStanja(env = process.env) {
  const baza =
    env.CS_CONNECTOR_STATE_DIR ||
    (env.LOCALAPPDATA ? join(env.LOCALAPPDATA, "CarsystemConnector") : null) ||
    join(env.HOME || ".", ".carsystem-connector");
  return join(baza, "queue.db");
}
