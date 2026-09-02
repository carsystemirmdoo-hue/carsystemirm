import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
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
