import assert from "node:assert/strict";
import { chmod, cp, mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

/**
 * Dnevni ciklus nad godišnjim podfolderima.
 *
 * Ovo su ponašanja koja kancelarija stvarno traži, a koja se ne vide iz
 * jediničnih provera skenera: šta se svakog dana popiše, šta troši budžet
 * obrade, i šta se dešava kada isti dokument stoji u dva foldera.
 *
 * Konektor traži `node:sqlite`; ispod Node 22 se ceo fajl preskače, kao i
 * ostali testovi reda.
 */

const D = (p) => new URL(`../dist/connector/src/${p}`, import.meta.url).href;
/*
 * `fileURLToPath`, ne `.pathname`.
 *
 * `.pathname` vraća procenat-kodiran oblik, pa putanja sa razmakom ili srpskim
 * slovom prestaje da postoji na disku. `paths.test.mjs` to izričito zabranjuje
 * u celom `connector/test` folderu — i uhvatilo je upravo ovaj fajl.
 */
const FIXTURES = fileURLToPath(new URL("../../fixtures/dev/biznisoft/", import.meta.url));

let moduli = null;
try {
  await import("node:sqlite");
  moduli = {
    pipeline: await import(D("pipeline.mjs")),
    store: await import(D("store.mjs")),
    scanner: await import(D("scanner.mjs")),
    commands: await import(D("commands.mjs")),
  };
} catch {
  moduli = null;
}

const guard = (t) => {
  if (moduli) return false;
  t.skip(`Konektor traži node:sqlite (Node 22+); tekući runtime je ${process.version}.`);
  return true;
};

const IDENTITET = {
  origin: "https://smoke.invalid",
  deviceCode: "test-pc",
  sourceSystem: "biznisoft",
  issuerCode: "TEST",
  contractVersion: 1,
};

/** Koren `FAKTURE/` + lokalni red, sve u privremenom folderu. */
async function okruzenje() {
  const baza = await mkdtemp(join(tmpdir(), "cs-daily-"));
  const koren = join(baza, "FAKTURE");
  await mkdir(koren, { recursive: true });
  const store = moduli.store.otvoriStore({
    putanja: join(baza, "queue.db"),
    identitet: IDENTITET,
  });
  const konfiguracija = {
    ...IDENTITET,
    serverOrigin: IDENTITET.origin,
    keyId: "k1",
    izvorniFolder: koren,
    dodatnaZatvaranja: [],
    maxPoCiklusu: 50,
    timeoutMs: 30_000,
  };
  return {
    baza,
    koren,
    store,
    konfiguracija,
    /** Jedan dnevni prolaz. Ne dodiruje mrežu — `skenirajURed` ništa ne šalje. */
    ciklus: (granice) =>
      moduli.pipeline.skenirajURed({
        store,
        konfiguracija,
        ...(granice ? { granice } : {}),
      }),
    zatvori: async () => {
      store.zatvori();
      await rm(baza, { recursive: true, force: true });
    },
  };
}

/** Kratke granice: test ne sme da čeka po dve sekunde na stabilnost. */
const BRZE = {
  maxBajtova: 20 * 1024 * 1024,
  maxNovihPoCiklusu: 200,
  maxPopisa: 200_000,
  stabilnostMs: 5,
  stabilnostPokusaja: 3,
};

const godina = (o, ime) => join(o.koren, ime);
async function stavi(o, folder, ime, izvor = "vise-stavki.pdf") {
  const put = folder === null ? o.koren : godina(o, folder);
  await mkdir(put, { recursive: true });
  await cp(join(FIXTURES, izvor), join(put, ime));
  return join(put, ime);
}

/* =========================================================================
 * Otkrivanje kroz godine
 * ====================================================================== */

test("FAKTURE 2028 i 2029 se nalaze bez izmene konfiguracije", async (t) => {
  if (guard(t)) return;
  const o = await okruzenje();
  try {
    await stavi(o, "FAKTURE 2024", "stara.pdf");
    const prvi = await o.ciklus(BRZE);
    assert.equal(prvi.novo, 1);

    /*
     * Nijedna godina nije upisana u kod ni u konfiguraciju. Folder se nalazi
     * zato što je NEPOSREDAN podfolder korena — ime se nigde ne čita.
     */
    await stavi(o, "FAKTURE 2028", "nova-2028.pdf", "jedna-stavka.pdf");
    await stavi(o, "FAKTURE 2029", "nova-2029.pdf", "nastavak-tabele.pdf");

    const drugi = await o.ciklus(BRZE);
    assert.equal(drugi.pregledano, 3, "popis nije video nove godišnje foldere");
    assert.equal(drugi.poznato, 1, "stari dokument nije prepoznat kao poznat");
    assert.ok(drugi.novo + drugi.nepodrzano === 2, "nova dva dokumenta nisu razmotrena");
  } finally {
    await o.zatvori();
  }
});

test("nov PDF u STAROM folderu se nalazi", async (t) => {
  if (guard(t)) return;
  const o = await okruzenje();
  try {
    await stavi(o, "FAKTURE 2024", "prva.pdf");
    await o.ciklus(BRZE);

    // Dokument dodat unazad, u već obrađen folder.
    await stavi(o, "FAKTURE 2024", "naknadna.pdf", "jedna-stavka.pdf");
    const drugi = await o.ciklus(BRZE);

    assert.equal(drugi.pregledano, 2);
    assert.equal(drugi.poznato, 1);
    assert.ok(drugi.novo + drugi.nepodrzano === 1, "naknadno dodat dokument nije viđen");
  } finally {
    await o.zatvori();
  }
});

/* =========================================================================
 * Budžet troše samo novi dokumenti
 * ====================================================================== */

test("250 poznatih PDF-ova ne sprečava nov dokument u drugom folderu", async (t) => {
  if (guard(t)) return;
  const o = await okruzenje();
  try {
    /*
     * Ovo je tačan oblik kvara koji je stara granica pravila: popis bi stao na
     * 200 sirovih kandidata, uvek u istom folderu, i nov dokument iza njih ne
     * bi bio viđen NIKAD — ni sledećeg dana, jer popis počinje iznova.
     */
    const stari = godina(o, "FAKTURE 2024");
    await mkdir(stari, { recursive: true });
    for (let i = 0; i < 250; i += 1) {
      await writeFile(join(stari, `stara-${i}.pdf`), `sadržaj ${i}`);
    }
    // Prvi ciklus ih sve upozna (nisu validni PDF-ovi → `nepodrzano`, ali su poznati).
    const prvi = await o.ciklus(BRZE);
    assert.equal(prvi.pregledano, 250);

    await stavi(o, "FAKTURE 2029", "nova.pdf");
    const drugi = await o.ciklus(BRZE);

    assert.equal(drugi.pregledano, 251, "popis je prekinut pre novog dokumenta");
    assert.equal(drugi.novo, 1, "nov dokument nije obrađen");
    assert.equal(drugi.cekaBudzet, 0, "poznati dokumenti su potrošili budžet");
  } finally {
    await o.zatvori();
  }
});

test("poznati dokumenti ne troše budžet novih", async (t) => {
  if (guard(t)) return;
  const o = await okruzenje();
  try {
    const stari = godina(o, "FAKTURE 2024");
    await mkdir(stari, { recursive: true });
    for (let i = 0; i < 30; i += 1) {
      await writeFile(join(stari, `stara-${i}.pdf`), `sadržaj ${i}`);
    }
    await o.ciklus(BRZE);

    // Budžet je 2; poznatih je 30. Da ga oni troše, nijedan nov ne bi prošao.
    await stavi(o, "FAKTURE 2029", "n1.pdf", "vise-stavki.pdf");
    await stavi(o, "FAKTURE 2029", "n2.pdf", "jedna-stavka.pdf");
    const drugi = await o.ciklus({ ...BRZE, maxNovihPoCiklusu: 2 });

    assert.equal(drugi.poznato, 30);
    assert.equal(drugi.novo + drugi.nepodrzano, 2, "budžet su potrošili poznati dokumenti");
    assert.equal(drugi.cekaBudzet, 0);
  } finally {
    await o.zatvori();
  }
});

test("kad novih ima više od budžeta, ostatak čeka — i dočeka", async (t) => {
  if (guard(t)) return;
  const o = await okruzenje();
  try {
    await stavi(o, "FAKTURE 2026", "a.pdf", "vise-stavki.pdf");
    await stavi(o, "FAKTURE 2026", "b.pdf", "jedna-stavka.pdf");
    await stavi(o, "FAKTURE 2026", "c.pdf", "nastavak-tabele.pdf");

    const prvi = await o.ciklus({ ...BRZE, maxNovihPoCiklusu: 1 });
    assert.equal(prvi.pregledano, 3, "popis se ne ograničava budžetom");
    assert.equal(prvi.cekaBudzet, 2, "ostatak nije prijavljen kao odložen zbog budžeta");

    const drugi = await o.ciklus({ ...BRZE, maxNovihPoCiklusu: 1 });
    assert.equal(drugi.poznato, 1, "prvi obrađen dokument nije zapamćen");
    assert.equal(drugi.cekaBudzet, 1);

    const treci = await o.ciklus({ ...BRZE, maxNovihPoCiklusu: 5 });
    assert.equal(treci.poznato, 2);
    assert.equal(treci.cekaBudzet, 0, "ostatak nikad nije dočekao obradu");
  } finally {
    await o.zatvori();
  }
});

/* =========================================================================
 * Identitet je sadržaj
 * ====================================================================== */

test("isti sadržaj u dva godišnja foldera ostaje JEDNA stavka", async (t) => {
  if (guard(t)) return;
  const o = await okruzenje();
  try {
    await stavi(o, "FAKTURE 2024", "kopija-a.pdf");
    await stavi(o, "FAKTURE 2025", "kopija-b.pdf");

    const prvi = await o.ciklus(BRZE);
    assert.equal(prvi.pregledano, 2, "oba fajla moraju biti popisana");
    assert.equal(prvi.novo, 1, "isti sadržaj je napravio dve stavke");
    assert.equal(prvi.poznato, 1, "drugi primerak nije prepoznat kao poznat");

    // Red nosi tačno jednu stavku — dakle serveru ide jedan dokument.
    const uRedu = o.store.zaSlanje({ limit: 100, lokalniDatum: "2026-09-02" });
    assert.equal(uRedu.length, 1, "u redu su dva zapisa za isti sadržaj");
  } finally {
    await o.zatvori();
  }
});

test("isto ime, DRUGI bajtovi — ponovo se razmatra kao nova izvorna verzija", async (t) => {
  if (guard(t)) return;
  const o = await okruzenje();
  try {
    const put = await stavi(o, "FAKTURE 2026", "faktura.pdf", "vise-stavki.pdf");
    const prvi = await o.ciklus(BRZE);
    assert.equal(prvi.novo, 1);

    /*
     * Isti fajl, ponovo sačuvan sa drugim sadržajem.
     *
     * Otisak je drugi, pa dokument prolazi PONOVO — kao nova izvorna verzija.
     * Server na to odgovara postojećim business-key tokom (`conflict` +
     * ručni pregled); konektor ovde samo ne sme da ga prećuti.
     */
    await cp(join(FIXTURES, "jedna-stavka.pdf"), put);
    const drugi = await o.ciklus(BRZE);

    assert.equal(drugi.pregledano, 1);
    assert.equal(drugi.poznato, 0, "promenjen sadržaj je prećutan kao poznat");
    assert.equal(drugi.novo, 1, "promenjen sadržaj nije ponovo razmotren");

    /*
     * OBE verzije stoje u redu.
     *
     * Konektor ne bira koja važi i ne prepisuje staru — to je odluka servera,
     * kroz postojeći business-key `conflict` + ručni pregled. Tiha zamena ovde
     * bi tu odluku donela umesto čoveka.
     */
    const uRedu = o.store.zaSlanje({ limit: 100, lokalniDatum: "2026-09-02" });
    assert.equal(uRedu.length, 2, "stara verzija je tiho zamenjena umesto da ostane");
  } finally {
    await o.zatvori();
  }
});

/* =========================================================================
 * Nestabilan fajl
 * ====================================================================== */

test("nepotpuno sačuvan fajl se odlaže, pa se nađe kad se čuvanje završi", async (t) => {
  if (guard(t)) return;
  const o = await okruzenje();
  try {
    const folder = godina(o, "FAKTURE 2026");
    await mkdir(folder, { recursive: true });
    const put = join(folder, "u-toku.pdf");
    await writeFile(put, "a");

    // Fajl raste dok traje ciklus — kao dokument koji BizniSoft još upisuje.
    const timer = setInterval(() => {
      writeFile(put, "a".repeat(Math.floor(Math.random() * 4000) + 10)).catch(() => {});
    }, 3);
    const prvi = await o.ciklus({ ...BRZE, stabilnostMs: 15 });
    clearInterval(timer);

    assert.equal(prvi.novo, 0, "nestabilan fajl je ušao u red");
    assert.ok(prvi.odlozeno >= 1 || prvi.nepodrzano >= 1, "nestabilan fajl nije ni primećen");

    // Čuvanje je gotovo — sledeći ciklus ga mora naći.
    await cp(join(FIXTURES, "vise-stavki.pdf"), put);
    const drugi = await o.ciklus(BRZE);
    assert.equal(drugi.novo, 1, "dovršen dokument nije nađen u sledećem ciklusu");
  } finally {
    await o.zatvori();
  }
});

/* =========================================================================
 * Granice ostaju
 * ====================================================================== */

test("dva nivoa dubine ostaju nevidljiva i kroz ceo ciklus", async (t) => {
  if (guard(t)) return;
  const o = await okruzenje();
  try {
    const duboko = join(o.koren, "FAKTURE 2024", "arhiva", "jos-dublje");
    await mkdir(duboko, { recursive: true });
    await cp(join(FIXTURES, "vise-stavki.pdf"), join(duboko, "duboko.pdf"));
    await stavi(o, "FAKTURE 2024", "plitko.pdf", "jedna-stavka.pdf");

    const rez = await o.ciklus(BRZE);
    assert.equal(rez.pregledano, 1, "ciklus je sišao dublje od jednog nivoa");
    assert.ok(rez.preskoceno.some((x) => x.razlog === "predubok"));
  } finally {
    await o.zatvori();
  }
});

test("poslovni datum ne zavisi od imena foldera", async (t) => {
  if (guard(t)) return;
  const o = await okruzenje();
  try {
    /*
     * Isti dokument u folderu čije ime tvrdi POGREŠNU godinu. Ako bi ime
     * foldera igde ušlo u poslovne podatke, ovo bi dalo drugačiji rezultat od
     * istog dokumenta u „ispravnom" folderu — a daje isti, jer se ime nigde
     * ne čita.
     */
    await stavi(o, "FAKTURE 1999", "ista.pdf", "vise-stavki.pdf");
    const rez = await o.ciklus(BRZE);
    assert.equal(rez.novo, 1);

    const [stavka] = o.store.zaSlanje({ limit: 10, lokalniDatum: "2026-09-02" });
    const telo = JSON.parse(Buffer.from(stavka.telo).toString("utf8"));

    // Datum i godina dolaze iz zaglavlja dokumenta, ne iz putanje.
    assert.match(telo.document.issued_on, /^\d{4}-\d{2}-\d{2}$/);
    assert.notEqual(telo.document.business_year, 1999, "godina je uzeta iz imena foldera");
    assert.notEqual(String(telo.document.issued_on).slice(0, 4), "1999");
    assert.ok(
      !JSON.stringify(telo).includes("1999") && !JSON.stringify(telo).includes("FAKTURE"),
      "ime foldera je procurilo u canonical payload",
    );
  } finally {
    await o.zatvori();
  }
});

/* =========================================================================
 * Nepotpun popis — operater mora da vidi da ciklus NIJE potpuno uspešan
 *
 * Runbook §21 je ovo vodio kao kapiju: `popis_prekinut` i `folder_nedostupan`
 * završavali su u listi `preskoceno`, ali izlazni kod je bio 0, a portal je
 * dobijao `completed`. Ovi testovi drže oba puta — zbir, stanje komande,
 * `failureCode` koji stiže portalu i izlazni kod.
 * ====================================================================== */

const BEZ_SLANJA = { potvrdjeno: 0, zaPregled: 0, odbijeno: 0, odlozeno: 0, zaustavljeno: null };

/** Lažna mreža: ništa ne stiže, pa događaji ostaju lokalno i mogu se pročitati. */
const offline = async () => {
  throw new Error("offline");
};

/**
 * Izvrši jednu komandu kroz ISTI put kao `poll-once` i vrati terminalni
 * događaj onakav kakav bi otišao portalu.
 */
async function komandaNad(o, granice) {
  const { PODRZAN_TIP, izvrsiKomandu } = moduli.commands;
  const { generateKeyPairSync } = await import("node:crypto");
  const kljuc = generateKeyPairSync("ed25519").privateKey.export({ type: "pkcs8", format: "der" });
  o.store.preuzmiKomandu({ id: "cmd-popis", tip: PODRZAN_TIP, verzija: 1, isticeU: null });
  const rez = await izvrsiKomandu({
    store: o.store,
    konfiguracija: { ...o.konfiguracija, timeoutMs: 500 },
    kljuc,
    komanda: { id: "cmd-popis", tip: PODRZAN_TIP, verzija: 1 },
    lokalniDatum: "2026-09-02",
    granice,
    fetchImpl: offline,
    dozvoliHttp: true,
  });
  const dogadjaji = o.store.nepotvrdjeniDogadjaji();
  return { rez, kraj: dogadjaji[dogadjaji.length - 1] };
}

test("dostignut maxPopisa daje `failed` sa kodom, ne tihi uspeh", async (t) => {
  if (guard(t)) return;
  const o = await okruzenje();
  try {
    await stavi(o, "FAKTURE 2024", "a.pdf", "vise-stavki.pdf");
    await stavi(o, "FAKTURE 2025", "b.pdf", "jedna-stavka.pdf");
    await stavi(o, "FAKTURE 2026", "c.pdf", "nastavak-tabele.pdf");

    // Granica ispod broja dokumenata — isti put kao 200.000 u kancelariji.
    const granice = { ...BRZE, maxPopisa: 2 };
    const sken = await o.ciklus(granice);

    assert.equal(sken.pregledano, 2, "popis nije stao na granici");
    assert.equal(sken.popis, "nepotpun");
    assert.equal(sken.kodPopisa, "scan_inventory_truncated");
    assert.equal(sken.popisPrekinut, true);
    assert.ok(sken.preskoceno.some((x) => x.razlog === "popis_prekinut"));

    const ishod = moduli.commands.stanjeZaIshod({ skeniranje: sken, slanje: BEZ_SLANJA });
    assert.deepEqual(ishod, { stanje: "failed", failureCode: "scan_inventory_truncated" });

    // Izlazni kod: nenulti, i NIJE kod blokade (1) ni nepodržanog runtime-a (3).
    const kod = moduli.pipeline.izlazniKodCiklusa({ skeniranje: sken, slanje: BEZ_SLANJA });
    assert.equal(kod, moduli.pipeline.IZLAZ_NEPOTPUN_POPIS);
    assert.ok(![0, 1, 2, 3].includes(kod));
    // Blokada i dalje ima prednost — ona zaustavlja slanje.
    assert.equal(
      moduli.pipeline.izlazniKodCiklusa({ skeniranje: sken, slanje: { ...BEZ_SLANJA, zaustavljeno: "revoked" } }),
      1,
    );
  } finally {
    await o.zatvori();
  }
});

test("prekinut popis stiže portalu kao `failed` + failureCode kroz komandu", async (t) => {
  if (guard(t)) return;
  const o = await okruzenje();
  try {
    await stavi(o, "FAKTURE 2024", "a.pdf");
    const { rez, kraj } = await komandaNad(o, { ...BRZE, maxPopisa: 0 });

    assert.equal(rez.stanje, "failed");
    assert.equal(rez.failureCode, "scan_inventory_truncated");
    // Ovaj zapis je tačno ono što `posaljiDogadjaj` šalje na /api/sync/commands/update.
    assert.equal(kraj.stanje, "failed");
    assert.equal(kraj.failure_code, "scan_inventory_truncated");
    assert.equal(JSON.parse(kraj.brojaci).foundCount, 0);
  } finally {
    await o.zatvori();
  }
});

test("nečitljiv godišnji folder: ostatak se popiše, ciklus NIJE `completed`", async (t) => {
  if (guard(t)) return;
  if (process.platform === "win32") {
    t.skip("POSIX chmod ne uskraćuje čitanje na Windows-u; ACL put pokriva kancelarijska provera.");
    return;
  }
  const o = await okruzenje();
  const zatvoren = godina(o, "FAKTURE 2025");
  try {
    await stavi(o, "FAKTURE 2024", "otvoren.pdf", "vise-stavki.pdf");
    await stavi(o, "FAKTURE 2025", "zatvoren.pdf", "jedna-stavka.pdf");
    await chmod(zatvoren, 0o000);

    // Root čita i folder bez prava — tada test ne bi dokazao ništa.
    let stvarnoZatvoren = false;
    try {
      await readdir(zatvoren);
    } catch {
      stvarnoZatvoren = true;
    }
    if (!stvarnoZatvoren) {
      t.skip("Proces čita folder i sa 000 (root); nedostupnost se ne može izazvati.");
      return;
    }

    const sken = await o.ciklus(BRZE);
    assert.equal(sken.pregledano, 1, "jedan nedostupan folder je zaustavio ceo popis");
    assert.equal(sken.novo, 1);
    assert.equal(sken.popis, "nepotpun");
    assert.equal(sken.kodPopisa, "scan_folder_unreadable");
    assert.equal(sken.folderaNedostupno, 1);
    assert.equal(sken.popisPrekinut, false);

    const ishod = moduli.commands.stanjeZaIshod({ skeniranje: sken, slanje: BEZ_SLANJA });
    assert.equal(ishod.stanje, "completed_with_review", "nečitljiva godina je prikazana kao potpun uspeh");
    assert.equal(ishod.failureCode, "scan_folder_unreadable");

    // I kad ima neslatih stavki, kod ostaje vidljiv.
    const saRetry = moduli.commands.stanjeZaIshod({ skeniranje: sken, slanje: { ...BEZ_SLANJA, odlozeno: 1 } });
    assert.deepEqual(saRetry, { stanje: "retry_pending", failureCode: "scan_folder_unreadable" });

    assert.equal(
      moduli.pipeline.izlazniKodCiklusa({ skeniranje: sken, slanje: BEZ_SLANJA }),
      moduli.pipeline.IZLAZ_NEPOTPUN_POPIS,
    );

    // Kod i zbir ne nose ime foldera ni putanju.
    const javno = JSON.stringify({ ...sken, preskoceno: undefined, ...ishod });
    assert.ok(!javno.includes("FAKTURE") && !javno.includes(o.baza), "putanja u javnom ishodu");
  } finally {
    await chmod(zatvoren, 0o700).catch(() => {});
    await o.zatvori();
  }
});

test("nečitljiv folder stiže portalu kroz komandu", async (t) => {
  if (guard(t)) return;
  if (process.platform === "win32") {
    t.skip("POSIX chmod ne uskraćuje čitanje na Windows-u.");
    return;
  }
  const o = await okruzenje();
  const zatvoren = godina(o, "FAKTURE 2025");
  try {
    await mkdir(zatvoren, { recursive: true });
    await cp(join(FIXTURES, "jedna-stavka.pdf"), join(zatvoren, "z.pdf"));
    await chmod(zatvoren, 0o000);
    try {
      await readdir(zatvoren);
      t.skip("Proces čita folder i sa 000 (root).");
      return;
    } catch {
      /* očekivano — folder je zaista nečitljiv */
    }

    const { rez, kraj } = await komandaNad(o, BRZE);
    assert.equal(rez.stanje, "completed_with_review");
    assert.equal(kraj.stanje, "completed_with_review");
    assert.equal(kraj.failure_code, "scan_folder_unreadable");
  } finally {
    await chmod(zatvoren, 0o700).catch(() => {});
    await o.zatvori();
  }
});

test("pun popis ostaje `completed` sa izlaznim kodom 0", async (t) => {
  if (guard(t)) return;
  const o = await okruzenje();
  try {
    await stavi(o, "FAKTURE 2024", "a.pdf");
    const sken = await o.ciklus(BRZE);
    assert.equal(sken.popis, "pun");
    assert.equal(sken.kodPopisa, null);
    assert.deepEqual(
      moduli.commands.stanjeZaIshod({ skeniranje: sken, slanje: { ...BEZ_SLANJA, potvrdjeno: 1 } }),
      { stanje: "completed", failureCode: null },
    );
    assert.equal(moduli.pipeline.izlazniKodCiklusa({ skeniranje: sken, slanje: BEZ_SLANJA }), 0);
  } finally {
    await o.zatvori();
  }
});
