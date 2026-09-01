import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

/**
 * Ručne komande na strani konektora — iz SPAKOVANOG paketa.
 *
 * Nijedan pravi server se ne dodiruje: `fetch` je zamenjen, a dokumenti,
 * uređaji i ključevi su sintetički. Testira se ono što odlučuje da li će posao
 * biti izvršen dvaput, nikad, ili tačno jednom.
 */

const D = (p) => new URL(`../dist/connector/src/${p}`, import.meta.url).href;
const { otvoriStore, SEMA_VERZIJA, StoreError } = await import(D("store.mjs"));
const {
  brojaciZa,
  OSNOVNI_INTERVAL_MS,
  PODRZANA_VERZIJA,
  PODRZAN_TIP,
  posaljiDogadjaj,
  posaljiNepotvrdjene,
  preuzmiKomandu,
  sledeciInterval,
  stanjeZaIshod,
} = await import(D("commands.mjs"));

const IDENTITET = {
  origin: "https://qa.invalid",
  deviceCode: "office-pc-01",
  sourceSystem: "biznisoft",
  issuerCode: "QA01",
  contractVersion: 1,
};

/** Sintetički Ed25519 ključ — nastaje u testu, nigde se ne čuva. */
const { generateKeyPairSync } = await import("node:crypto");
const KLJUC = generateKeyPairSync("ed25519").privateKey.export({
  type: "pkcs8",
  format: "der",
});

const KONF = {
  serverOrigin: "https://qa.invalid",
  deviceCode: "office-pc-01",
  keyId: "k1",
  sourceSystem: "biznisoft",
  issuerCode: "QA01",
  timeoutMs: 2000,
};

async function privremeniStore() {
  const baza = await mkdtemp(join(tmpdir(), "cs-komande-"));
  const putanja = join(baza, "Stanje ČĆŽ", "red.db");
  return { baza, putanja, store: otvoriStore({ putanja, identitet: IDENTITET }) };
}

/** Lažan `fetch` koji vraća unapred pripremljene odgovore. */
function lazniFetch(odgovori) {
  const pozivi = [];
  const f = async (url, init) => {
    pozivi.push({ url: String(url), telo: init?.body ? new TextDecoder().decode(init.body) : null });
    const sledeci = odgovori.shift();
    if (!sledeci) throw new Error("nema više pripremljenih odgovora");
    if (sledeci instanceof Error) throw sledeci;
    return new Response(JSON.stringify(sledeci.telo), {
      status: sledeci.status,
      headers: { "content-type": "application/json" },
    });
  };
  f.pozivi = pozivi;
  return f;
}

/* =========================================================================
 * Ritam pitanja
 * ====================================================================== */

test("zdrav interval je ograničen i pomeren jitter-om", () => {
  // Bez jitter-a bi se uređaji posle restarta poravnali u isti trenutak.
  const bez = sledeciInterval({ neuspeha: 0, random: () => 0 });
  const pun = sledeciInterval({ neuspeha: 0, random: () => 0.999 });
  assert.equal(bez, OSNOVNI_INTERVAL_MS);
  assert.ok(pun > bez && pun < OSNOVNI_INTERVAL_MS * 2);
  // Zahtev P4: ne agresivnije od ~30–60 s kada je sve u redu.
  assert.ok(bez >= 30_000 && pun <= 60_000);
});

test("backoff raste eksponencijalno i staje na 30 minuta", () => {
  const r = () => 0;
  const prvi = sledeciInterval({ neuspeha: 1, random: r });
  const drugi = sledeciInterval({ neuspeha: 2, random: r });
  assert.equal(drugi, prvi * 2);

  /*
   * Bez gornje granice bi uređaj bez interneta posle jednog dana pitao jednom
   * u nekoliko sati — a bez backoff-a bi svakih 45 s punio log.
   */
  const dugo = sledeciInterval({ neuspeha: 50, random: r });
  assert.equal(dugo, 30 * 60_000);
});

/* =========================================================================
 * Preuzimanje
 * ====================================================================== */

test("nepoznat tip i nepoznata verzija se NE izvršavaju", async () => {
  const { baza, store } = await privremeniStore();
  try {
    for (const komanda of [
      { id: "c1", type: "obrisi_sve", version: 1 },
      { id: "c2", type: PODRZAN_TIP, version: PODRZANA_VERZIJA + 1 },
    ]) {
      const rez = await preuzmiKomandu({
        store,
        konfiguracija: KONF,
        kljuc: KLJUC,
        dozvoliHttp: true,
        fetchImpl: lazniFetch([{ status: 200, telo: { code: "command", command: komanda } }]),
      });
      assert.equal(rez.ishod, "nepodrzana");
      assert.equal(rez.razlog, "unsupported_command");
    }
    // Ništa se nije upisalo: nepodržana komanda ne postaje lokalni posao.
    assert.equal(store.otvorenaKomanda(), null);
  } finally {
    store.zatvori();
    await rm(baza, { recursive: true, force: true });
  }
});

test("nepoznat kod odgovora ne pokreće posao", async () => {
  const { baza, store } = await privremeniStore();
  try {
    const rez = await preuzmiKomandu({
      store,
      konfiguracija: KONF,
      kljuc: KLJUC,
      dozvoliHttp: true,
      fetchImpl: lazniFetch([{ status: 200, telo: { code: "iznenadjenje" } }]),
    });
    assert.equal(rez.ishod, "odbijeno");
    assert.equal(store.otvorenaKomanda(), null);
  } finally {
    store.zatvori();
    await rm(baza, { recursive: true, force: true });
  }
});

test("isključen gate na serveru nije kvar uređaja", async () => {
  const { baza, store } = await privremeniStore();
  try {
    const rez = await preuzmiKomandu({
      store,
      konfiguracija: KONF,
      kljuc: KLJUC,
      dozvoliHttp: true,
      fetchImpl: lazniFetch([{ status: 404, telo: { code: "not_found" } }]),
    });
    assert.equal(rez.ishod, "iskljuceno");
  } finally {
    store.zatvori();
    await rm(baza, { recursive: true, force: true });
  }
});

test("komanda se upisuje PRE izvršenja i drugi poll je ne duplira", async () => {
  const { baza, store } = await privremeniStore();
  try {
    const telo = {
      status: 200,
      telo: {
        code: "command",
        command: { id: "c-1", type: PODRZAN_TIP, version: PODRZANA_VERZIJA, expiresAt: "2026-09-08T07:00:00Z" },
      },
    };
    const prvi = await preuzmiKomandu({
      store, konfiguracija: KONF, kljuc: KLJUC, dozvoliHttp: true,
      fetchImpl: lazniFetch([telo]),
    });
    assert.equal(prvi.ishod, "komanda");
    assert.equal(store.otvorenaKomanda().id, "c-1");

    /*
     * Isti ID posle izgubljenog odgovora NE sme da postane druga komanda —
     * inače bi se isti posao izvršio dvaput.
     */
    await preuzmiKomandu({
      store, konfiguracija: KONF, kljuc: KLJUC, dozvoliHttp: true,
      fetchImpl: lazniFetch([telo]),
    });
    assert.equal(store.otvorenaKomanda().id, "c-1");
  } finally {
    store.zatvori();
    await rm(baza, { recursive: true, force: true });
  }
});

/* =========================================================================
 * Izveštaj napretka
 * ====================================================================== */

test("`already_recorded` je uspeh, ne ponovno slanje", async () => {
  const { baza, store } = await privremeniStore();
  try {
    store.preuzmiKomandu({ id: "c-2", tip: PODRZAN_TIP, verzija: 1, isticeU: null });
    const d = store.dodajDogadjaj({
      komandaId: "c-2", eventId: "evt-1", stanje: "running",
      brojaci: brojaciZa({ skeniranje: {}, slanje: {} }),
    });

    const rez = await posaljiDogadjaj({
      store, konfiguracija: KONF, kljuc: KLJUC, dogadjaj: d, dozvoliHttp: true,
      fetchImpl: lazniFetch([{ status: 200, telo: { code: "already_recorded" } }]),
    });
    assert.equal(rez.poslat, true);
    assert.equal(store.nepotvrdjeniDogadjaji().length, 0);
  } finally {
    store.zatvori();
    await rm(baza, { recursive: true, force: true });
  }
});

test("izgubljen odgovor čuva ISTI event_id za ponovno slanje", async () => {
  const { baza, store } = await privremeniStore();
  try {
    store.preuzmiKomandu({ id: "c-3", tip: PODRZAN_TIP, verzija: 1, isticeU: null });
    const d = store.dodajDogadjaj({
      komandaId: "c-3", eventId: "evt-7", stanje: "completed",
      brojaci: brojaciZa({ skeniranje: {}, slanje: {} }),
    });

    // 1. Mreža pukne — događaj ostaje nepotvrđen.
    await posaljiDogadjaj({
      store, konfiguracija: KONF, kljuc: KLJUC, dogadjaj: d, dozvoliHttp: true,
      fetchImpl: lazniFetch([new Error("ECONNRESET")]),
    });
    assert.equal(store.nepotvrdjeniDogadjaji().length, 1);

    // 2. Sledeći prolaz šalje ISTI ID; server ga prepoznaje kao već primljen.
    const f = lazniFetch([{ status: 200, telo: { code: "already_recorded" } }]);
    const rez = await posaljiNepotvrdjene({
      store, konfiguracija: KONF, kljuc: KLJUC, dozvoliHttp: true, fetchImpl: f,
    });
    assert.deepEqual(rez, { cekalo: 1, poslato: 1 });
    assert.match(f.pozivi[0].telo, /"eventId":"evt-7"/);
    assert.equal(store.nepotvrdjeniDogadjaji().length, 0);
  } finally {
    store.zatvori();
    await rm(baza, { recursive: true, force: true });
  }
});

test("konflikt se ne ponavlja u petlji", async () => {
  const { baza, store } = await privremeniStore();
  try {
    store.preuzmiKomandu({ id: "c-4", tip: PODRZAN_TIP, verzija: 1, isticeU: null });
    const d = store.dodajDogadjaj({
      komandaId: "c-4", eventId: "evt-9", stanje: "running",
      brojaci: brojaciZa({ skeniranje: {}, slanje: {} }),
    });
    const rez = await posaljiDogadjaj({
      store, konfiguracija: KONF, kljuc: KLJUC, dogadjaj: d, dozvoliHttp: true,
      fetchImpl: lazniFetch([{ status: 409, telo: { code: "terminal" } }]),
    });
    assert.equal(rez.poslat, false);
    assert.equal(rez.konflikt, true);
    /*
     * Označen je potvrđenim iako NIJE prihvaćen: server ga trajno odbija, pa bi
     * inače zauvek visio i blokirao sve kasnije događaje iza sebe.
     */
    assert.equal(store.nepotvrdjeniDogadjaji().length, 0);
  } finally {
    store.zatvori();
    await rm(baza, { recursive: true, force: true });
  }
});

test("mreža koja ne radi zaustavlja red, ne preskače ga", async () => {
  const { baza, store } = await privremeniStore();
  try {
    store.preuzmiKomandu({ id: "c-5", tip: PODRZAN_TIP, verzija: 1, isticeU: null });
    for (const id of ["evt-a", "evt-b"]) {
      store.dodajDogadjaj({
        komandaId: "c-5", eventId: id, stanje: "running",
        brojaci: brojaciZa({ skeniranje: {}, slanje: {} }),
      });
    }
    const rez = await posaljiNepotvrdjene({
      store, konfiguracija: KONF, kljuc: KLJUC, dozvoliHttp: true,
      fetchImpl: lazniFetch([new Error("offline")]),
    });
    // Drugi se ne pokušava: redosled izveštaja mora ostati redosled.
    assert.deepEqual(rez, { cekalo: 2, poslato: 0 });
    assert.equal(store.nepotvrdjeniDogadjaji().length, 2);
  } finally {
    store.zatvori();
    await rm(baza, { recursive: true, force: true });
  }
});

/* =========================================================================
 * Ishod
 * ====================================================================== */

test("dokument koji čeka čoveka NIJE `completed`", () => {
  const prazno = { pregledano: 0, novo: 0, poznato: 0, nepodrzano: 0 };
  const bez = { potvrdjeno: 1, zaPregled: 0, odbijeno: 0, odlozeno: 0, zaustavljeno: null };

  assert.equal(stanjeZaIshod({ skeniranje: prazno, slanje: bez }).stanje, "completed");

  for (const [sken, slanje] of [
    [prazno, { ...bez, zaPregled: 1 }],
    [prazno, { ...bez, odbijeno: 1 }],
    [{ ...prazno, nepodrzano: 1 }, bez],
  ]) {
    assert.equal(
      stanjeZaIshod({ skeniranje: sken, slanje }).stanje,
      "completed_with_review",
      "„završeno“ bi ovde značilo „sve je knjiženo“, a nije",
    );
  }

  assert.equal(stanjeZaIshod({ skeniranje: prazno, slanje: { ...bez, odlozeno: 2 } }).stanje, "retry_pending");

  const blokada = stanjeZaIshod({ skeniranje: prazno, slanje: { ...bez, zaustavljeno: "revoked" } });
  assert.equal(blokada.stanje, "blocked");
  assert.equal(blokada.failureCode, "revoked");
});

test("brojači razdvajaju knjiženo od pregleda i nepodržanog", () => {
  const b = brojaciZa({
    skeniranje: { pregledano: 5, novo: 3, poznato: 1, nepodrzano: 1 },
    slanje: { potvrdjeno: 2, zaPregled: 1, odlozeno: 1, zaustavljeno: null },
  });
  assert.deepEqual(b, {
    foundCount: 5, readCount: 4, postedCount: 2, duplicateCount: 0,
    reviewCount: 1, unsupportedCount: 1, pendingCount: 1, blockedCount: 0,
  });
});

/* =========================================================================
 * Šema reda
 * ====================================================================== */

test("stariji red se NADOGRAĐUJE, ne briše", async () => {
  const baza = await mkdtemp(join(tmpdir(), "cs-sema-"));
  const putanja = join(baza, "red.db");
  try {
    // 1. Red kakav je ostavio P3: neposlata stavka i šema 1.
    const prvi = otvoriStore({ putanja, identitet: IDENTITET });
    prvi.dodajSpremno({
      sourceHash: "a".repeat(64),
      putanja: join(baza, "x.pdf"),
      velicina: 10,
      telo: new TextEncoder().encode("{}"),
      semanticHash: "b".repeat(64),
    });
    prvi.zatvori();

    const db = new DatabaseSync(putanja);
    db.prepare("UPDATE meta SET vrednost = '1' WHERE kljuc = 'sema_verzija'").run();
    db.close();

    // 2. P4 otvara isti red.
    const drugi = otvoriStore({ putanja, identitet: IDENTITET });
    // Posao koji niko nije video se NE sme izgubiti zbog nove verzije programa.
    assert.equal(drugi.zbir().spremno, 1);
    // Nove tabele postoje i prazne su.
    assert.equal(drugi.otvorenaKomanda(), null);
    assert.equal(drugi.nepotvrdjeniDogadjaji().length, 0);
    drugi.zatvori();

    const provera = new DatabaseSync(putanja);
    const v = provera.prepare("SELECT vrednost FROM meta WHERE kljuc = 'sema_verzija'").get();
    provera.close();
    assert.equal(Number(v.vrednost), SEMA_VERZIJA);
  } finally {
    await rm(baza, { recursive: true, force: true });
  }
});

test("noviji red i stariji konektor su GREŠKA, ne „snađi se“", async () => {
  const baza = await mkdtemp(join(tmpdir(), "cs-sema-novo-"));
  const putanja = join(baza, "red.db");
  try {
    otvoriStore({ putanja, identitet: IDENTITET }).zatvori();
    const db = new DatabaseSync(putanja);
    db.prepare("UPDATE meta SET vrednost = ? WHERE kljuc = 'sema_verzija'").run(
      String(SEMA_VERZIJA + 1),
    );
    db.close();

    let uhvacena = null;
    try {
      otvoriStore({ putanja, identitet: IDENTITET });
    } catch (e) {
      uhvacena = e;
    }
    assert.ok(uhvacena instanceof StoreError);
    assert.equal(uhvacena.code, "schema_newer");
  } finally {
    await rm(baza, { recursive: true, force: true });
  }
});
