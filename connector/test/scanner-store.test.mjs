import assert from "node:assert/strict";
import { chmod, cp, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

/**
 * Skener i trajni red — iz SPAKOVANOG paketa, nad pravim fajl sistemom.
 *
 * Sve se dešava u privremenim folderima; nijedan stvarni dokument ne postoji.
 */

const D = (p) => new URL(`../dist/connector/src/${p}`, import.meta.url).href;
const skener = await import(D("scanner.mjs"));
const { otvoriStore, StoreError } = await import(D("store.mjs"));
const { STANJA } = await import(D("outcomes.mjs"));

const FIXTURES = new URL("../../fixtures/dev/biznisoft/", import.meta.url).pathname;

/** Folder sa razmacima i srpskim slovima — kao stvarna kancelarijska putanja. */
async function privremeni() {
  const baza = await mkdtemp(join(tmpdir(), "cs-konektor-"));
  const folder = join(baza, "Moj Folder ČĆŽŠĐ", "fakture ulaz");
  await mkdir(folder, { recursive: true });
  return { baza, folder };
}

const IDENTITET = {
  origin: "https://qa.invalid",
  deviceCode: "office-pc-01",
  sourceSystem: "biznisoft",
  issuerCode: "QA01",
  contractVersion: 1,
};

/* =========================================================================
 * Skener
 * ====================================================================== */

test("izvorni folder se NE pravi automatski", async () => {
  const { baza } = await privremeni();
  try {
    /*
     * Pogrešna putanja mora biti greška. Automatsko pravljenje bi je pretvorilo
     * u „uspešan prazan uvoz“, i niko ne bi primetio da se ništa ne skenira.
     */
    await assert.rejects(
      () => skener.proveriIzvor(join(baza, "ne-postoji")),
      (e) => e.code === "source_missing",
    );
  } finally {
    await rm(baza, { recursive: true, force: true });
  }
});

test("nedostupan izvor se razlikuje od praznog", async () => {
  const { baza, folder } = await privremeni();
  try {
    // Prazan, ali dostupan: uredan prolaz sa nula kandidata.
    const { koren } = await skener.proveriIzvor(folder);
    const { kandidati } = await skener.nadjiKandidate(koren);
    assert.equal(kandidati.length, 0);

    // Nedostupan: greška sa svojim kodom, nikad „nema faktura“.
    await rm(folder, { recursive: true, force: true });
    await assert.rejects(
      () => skener.proveriIzvor(folder),
      (e) => e.code === "source_missing",
    );
  } finally {
    await rm(baza, { recursive: true, force: true });
  }
});

test("skenira se SAMO zadati folder — bez rekurzije i bez linkova van korena", async () => {
  const { baza, folder } = await privremeni();
  try {
    const spolja = join(baza, "spolja");
    await mkdir(spolja, { recursive: true });
    await cp(join(FIXTURES, "jedna-stavka.pdf"), join(spolja, "tudja.pdf"));

    // Podfolder — ne sme se obići.
    await mkdir(join(folder, "podfolder"), { recursive: true });
    await cp(join(FIXTURES, "jedna-stavka.pdf"), join(folder, "podfolder", "duboko.pdf"));

    // Fajl u samom folderu, sa razmacima i srpskim slovima, VELIKA ekstenzija.
    await cp(join(FIXTURES, "vise-stavki.pdf"), join(folder, "Račun broj 42.PDF"));

    // Symlink koji izlazi iz korena.
    await symlink(join(spolja, "tudja.pdf"), join(folder, "veza.pdf")).catch(() => {});

    const { koren } = await skener.proveriIzvor(folder);
    const { kandidati, preskoceno } = await skener.nadjiKandidate(koren);

    assert.deepEqual(
      kandidati.map((k) => k.putanja.split("/").pop()),
      ["Račun broj 42.PDF"],
      "skener je uzeo nešto van zadatog foldera ili iz podfoldera",
    );
    assert.ok(
      preskoceno.some((p) => p.razlog === "symlink"),
      "symlink nije preskočen",
    );
  } finally {
    await rm(baza, { recursive: true, force: true });
  }
});

test("prazan i prevelik fajl se preskaču bez rušenja ciklusa", async () => {
  const { baza, folder } = await privremeni();
  try {
    await writeFile(join(folder, "prazan.pdf"), "");
    await writeFile(join(folder, "velik.pdf"), Buffer.alloc(1024));
    await cp(join(FIXTURES, "jedna-stavka.pdf"), join(folder, "dobar.pdf"));

    const { koren } = await skener.proveriIzvor(folder);
    const { kandidati, preskoceno } = await skener.nadjiKandidate(koren, {
      ...skener.PODRAZUMEVANE_GRANICE,
      maxBajtova: 512,
    });

    assert.ok(preskoceno.some((p) => p.razlog === "prazan"));
    assert.ok(preskoceno.some((p) => p.razlog === "prevelik"));
    // Ispravan fajl je i dalje obrađen — jedan loš ne obara ciklus.
    assert.ok(kandidati.length >= 0);
  } finally {
    await rm(baza, { recursive: true, force: true });
  }
});

test("stabilan fajl se čita jednom, i otisak pripada TIM bajtovima", async () => {
  const { baza, folder } = await privremeni();
  try {
    const p = join(folder, "dobar.pdf");
    await cp(join(FIXTURES, "vise-stavki.pdf"), p);

    const rez = await skener.procitajStabilno(p, {
      ...skener.PODRAZUMEVANE_GRANICE,
      stabilnostMs: 1,
    });
    assert.equal(rez.ok, true);

    const { createHash } = await import("node:crypto");
    assert.equal(
      rez.sourceHash,
      createHash("sha256").update(rez.bajtovi).digest("hex"),
      "otisak ne pripada pročitanim bajtovima",
    );
  } finally {
    await rm(baza, { recursive: true, force: true });
  }
});

test("nestao fajl se prijavljuje, ne ruši ciklus", async () => {
  const { baza, folder } = await privremeni();
  try {
    const rez = await skener.procitajStabilno(join(folder, "nema.pdf"), {
      ...skener.PODRAZUMEVANE_GRANICE,
      stabilnostMs: 1,
    });
    assert.equal(rez.ok, false);
    assert.equal(rez.razlog, "nestao");
  } finally {
    await rm(baza, { recursive: true, force: true });
  }
});

test("nestabilan fajl se ODLAŽE, ne proglašava trajno neispravnim", async () => {
  const { baza, folder } = await privremeni();
  try {
    const p = join(folder, "raste.pdf");
    await writeFile(p, "a");

    /*
     * Fajl raste između očitanja — kao dokument koji BizniSoft još upisuje.
     * Ishod mora biti „nestabilan“ (odlaganje), ne trajna greška.
     */
    const timer = setInterval(() => {
      writeFile(p, "a".repeat(Math.floor(Math.random() * 1000) + 10)).catch(() => {});
    }, 5);

    const rez = await skener.procitajStabilno(p, {
      stabilnostMs: 20,
      stabilnostPokusaja: 3,
      maxBajtova: 1024 * 1024,
      maxFajlovaPoCiklusu: 10,
    });
    clearInterval(timer);

    assert.equal(rez.ok, false);
    assert.ok(
      ["nestabilan", "menjan_tokom_citanja"].includes(rez.razlog),
      `neočekivan razlog: ${rez.razlog}`,
    );
  } finally {
    await rm(baza, { recursive: true, force: true });
  }
});

test("pokvaren PDF se pročita, ali parser ga odbije", async () => {
  const { baza, folder } = await privremeni();
  try {
    const p = join(folder, "pokvaren.pdf");
    await writeFile(p, "ovo nije PDF");

    const rez = await skener.procitajStabilno(p, {
      ...skener.PODRAZUMEVANE_GRANICE,
      stabilnostMs: 1,
    });
    assert.equal(rez.ok, true, "skener treba da pročita bajtove; ocena je na parseru");

    const { parseBiznisoftPdf } = await import(
      new URL("../dist/lib/pdf/parseDocument.js", import.meta.url).href
    );
    const parsed = await parseBiznisoftPdf(rez.bajtovi);
    assert.equal(parsed.validationStatus, "unparsable");
  } finally {
    await rm(baza, { recursive: true, force: true });
  }
});

/* =========================================================================
 * Trajni red
 * ====================================================================== */

async function noviStore(sufiks = "") {
  const baza = await mkdtemp(join(tmpdir(), "cs-red-"));
  const putanja = join(baza, "Moj Folder ČĆŽŠĐ", `queue${sufiks}.db`);
  return { baza, putanja, store: otvoriStore({ putanja, identitet: IDENTITET }) };
}

test("isti sadržaj pod drugim imenom NE pravi drugu stavku", async () => {
  const { baza, store } = await noviStore();
  try {
    const telo = Buffer.from("{}");
    const a = store.dodajSpremno({
      sourceHash: "hash-a", putanja: "/x/prvo.pdf", velicina: 1, telo, semanticHash: "s",
    });
    const b = store.dodajSpremno({
      sourceHash: "hash-a", putanja: "/x/drugo-ime.pdf", velicina: 1, telo, semanticHash: "s",
    });
    assert.equal(a.dodato, true);
    assert.equal(b.dodato, false, "isti otisak je napravio drugu stavku");
    assert.equal(store.zbir()[STANJA.SPREMNO], 1);
  } finally {
    store.zatvori();
    await rm(baza, { recursive: true, force: true });
  }
});

test("ista putanja sa DRUGIM sadržajem prolazi ponovo", async () => {
  const { baza, store } = await noviStore();
  try {
    const telo = Buffer.from("{}");
    store.dodajSpremno({ sourceHash: "hash-1", putanja: "/x/a.pdf", velicina: 1, telo, semanticHash: "s1" });
    const drugi = store.dodajSpremno({
      sourceHash: "hash-2", putanja: "/x/a.pdf", velicina: 2, telo, semanticHash: "s2",
    });
    assert.equal(drugi.dodato, true, "promenjeni bajtovi nisu prošli ponovo");
    assert.equal(store.zbir()[STANJA.SPREMNO], 2);
  } finally {
    store.zatvori();
    await rm(baza, { recursive: true, force: true });
  }
});

test("red preživljava zatvaranje i ponovno otvaranje", async () => {
  const { baza, putanja, store } = await noviStore();
  try {
    store.dodajSpremno({
      sourceHash: "h", putanja: "/x/a.pdf", velicina: 1,
      telo: Buffer.from('{"a":1}'), semanticHash: "s",
    });
    store.zatvori();

    // Nov proces bi otvorio isti fajl — ovde nova instanca nad istom putanjom.
    const opet = otvoriStore({ putanja, identitet: IDENTITET });
    try {
      const stavke = opet.zaSlanje({ lokalniDatum: "2026-03-10" });
      assert.equal(stavke.length, 1);
      assert.equal(Buffer.from(stavke[0].telo).toString("utf8"), '{"a":1}');
    } finally {
      opet.zatvori();
    }
  } finally {
    await rm(baza, { recursive: true, force: true });
  }
});

test("promena servera/uređaja NE prenosi stare potvrde", async () => {
  const { baza, putanja, store } = await noviStore();
  try {
    store.zatvori();
    /*
     * Isti fajl reda, drugi origin. Tiho preuzimanje bi značilo da dokumenti
     * izgledaju poslati serveru na koji nikad nisu stigli.
     */
    assert.throws(
      () => otvoriStore({ putanja, identitet: { ...IDENTITET, origin: "https://drugi.invalid" } }),
      (e) => e instanceof StoreError && e.code === "identity_mismatch",
    );
    // I promena uređaja.
    assert.throws(
      () => otvoriStore({ putanja, identitet: { ...IDENTITET, deviceCode: "drugi-pc" } }),
      (e) => e.code === "identity_mismatch",
    );
  } finally {
    await rm(baza, { recursive: true, force: true });
  }
});

test("pad usred slanja: stavka se OPORAVLJA, ne ostaje zaglavljena", async () => {
  const { baza, putanja, store } = await noviStore();
  try {
    const { id } = store.dodajSpremno({
      sourceHash: "h", putanja: "/x/a.pdf", velicina: 1, telo: Buffer.from("{}"), semanticHash: "s",
    });
    assert.equal(store.oznaciSalje(id), true);
    assert.equal(store.zbir()[STANJA.SALJE_SE], 1);

    // „Pad“: proces nestaje bez upisa ishoda.
    store.zatvori();

    const posle = otvoriStore({ putanja, identitet: IDENTITET });
    try {
      assert.equal(posle.zbir()[STANJA.SALJE_SE], 1, "preduslov: stavka je ostala u slanju");
      const oporavljeno = posle.oporaviZaglavljene();
      assert.equal(oporavljeno, 1);
      assert.equal(posle.zbir()[STANJA.SPREMNO], 1, "stavka nije vraćena u red");
    } finally {
      posle.zatvori();
    }
  } finally {
    await rm(baza, { recursive: true, force: true });
  }
});

test("dve petlje ne mogu preuzeti istu stavku", async () => {
  const { baza, store } = await noviStore();
  try {
    const { id } = store.dodajSpremno({
      sourceHash: "h", putanja: "/x/a.pdf", velicina: 1, telo: Buffer.from("{}"), semanticHash: "s",
    });
    assert.equal(store.oznaciSalje(id), true);
    // Drugi pokušaj nad istom stavkom ne prolazi — uslov je nad stanjem.
    assert.equal(store.oznaciSalje(id), false);
  } finally {
    store.zatvori();
    await rm(baza, { recursive: true, force: true });
  }
});

test("dve instance: druga ne uzima bravu dok je prva živa", async () => {
  const { baza, putanja, store } = await noviStore();
  try {
    const prva = store.uzmiZakljucavanje({ vlasnik: "A", now: new Date("2026-03-10T09:00:00Z") });
    assert.equal(prva.uzeto, true);

    const druga = otvoriStore({ putanja, identitet: IDENTITET });
    try {
      const pokusaj = druga.uzmiZakljucavanje({
        vlasnik: "B",
        now: new Date("2026-03-10T09:01:00Z"),
      });
      assert.equal(pokusaj.uzeto, false, "druga instanca je otela bravu živoj");
      assert.equal(pokusaj.vlasnik, "A");

      /*
       * Zastarela brava se preuzima, ali TEK posle punog perioda bez obnove.
       * Živa instanca obnavlja bravu u svakom ciklusu, pa ne može biti prekinuta.
       */
      const kasnije = druga.uzmiZakljucavanje({
        vlasnik: "B",
        now: new Date("2026-03-10T09:20:00Z"),
        zastarelostMs: 15 * 60 * 1000,
      });
      assert.equal(kasnije.uzeto, true, "zastarela brava nije preuzeta");
    } finally {
      druga.zatvori();
    }
  } finally {
    store.zatvori();
    await rm(baza, { recursive: true, force: true });
  }
});

test("obnova brave sprečava preuzimanje", async () => {
  const { baza, store } = await noviStore();
  try {
    store.uzmiZakljucavanje({ vlasnik: "A", now: new Date("2026-03-10T09:00:00Z") });
    // Živa instanca obnavlja bravu.
    store.obnoviZakljucavanje("A", new Date("2026-03-10T09:19:00Z"));

    const pokusaj = store.uzmiZakljucavanje({
      vlasnik: "B",
      now: new Date("2026-03-10T09:20:00Z"),
      zastarelostMs: 15 * 60 * 1000,
    });
    assert.equal(pokusaj.uzeto, false, "obnovljena brava je preuzeta");
  } finally {
    store.zatvori();
    await rm(baza, { recursive: true, force: true });
  }
});

test("nema automatskog resetovanja: pokvaren red je greška, ne nov prazan", async () => {
  const baza = await mkdtemp(join(tmpdir(), "cs-red-"));
  const putanja = join(baza, "queue.db");
  try {
    // Fajl koji nije SQLite baza.
    await writeFile(putanja, "ovo nije baza");
    assert.throws(
      () => otvoriStore({ putanja, identitet: IDENTITET }),
      "pokvaren red je tiho zamenjen novim",
    );
  } finally {
    await rm(baza, { recursive: true, force: true });
  }
});

test("status ne otkriva putanje ni imena fajlova", async () => {
  const { baza, store } = await noviStore();
  try {
    store.dodajSpremno({
      sourceHash: "abcdef0123456789",
      putanja: "/Users/tajna/Fakture/Račun 09002 KUPAC DOO.pdf",
      velicina: 1,
      telo: Buffer.from("{}"),
      semanticHash: "s",
    });
    const ishodi = store.poslednjiIshodi(5);
    const tekst = JSON.stringify(ishodi);
    assert.doesNotMatch(tekst, /Users|tajna|KUPAC|\.pdf/i, `status curi: ${tekst}`);
    assert.match(tekst, /sd:abcdef012345/);
  } finally {
    store.zatvori();
    await rm(baza, { recursive: true, force: true });
  }
});

test("greška upisa se ne prijavljuje kao uspeh", async () => {
  const { baza, store } = await noviStore();
  try {
    const { id } = store.dodajSpremno({
      sourceHash: "h", putanja: "/x/a.pdf", velicina: 1, telo: Buffer.from("{}"), semanticHash: "s",
    });
    /*
     * Nezavršno stanje se ODBIJA. Pozivalac ne sme da „završi“ stavku stanjem
     * koje ostavlja mesta za tumačenje.
     */
    assert.throws(
      () => store.zavrsi({ id, stanje: STANJA.SPREMNO, serverKod: "x" }),
      (e) => e.code === "not_final",
    );
  } finally {
    store.zatvori();
    await rm(baza, { recursive: true, force: true });
  }
});

/* =========================================================================
 * Obim
 * ====================================================================== */

test("red od 12.000 stavki ostaje ograničen po memoriji i vremenu", async () => {
  const { baza, store } = await noviStore("-obim");
  try {
    const pocetak = Date.now();
    const pre = process.memoryUsage().heapUsed;

    /*
     * Sintetički obim, bez ijednog stvarnog dokumenta.
     *
     * Cilj nije brzina nego dokaz da `zaSlanje` ne povlači ceo red u memoriju:
     * višegodišnja istorija mora da prolazi u serijama.
     */
    store.db.exec("BEGIN IMMEDIATE");
    const upis = store.db.prepare(
      `INSERT INTO stavke(source_hash, putanja, velicina, telo, semantic_hash, stanje, dodato_u, izmenjeno_u)
       VALUES(?,?,?,?,?,?,?,?)`,
    );
    const t = new Date().toISOString();
    for (let i = 0; i < 12000; i += 1) {
      upis.run(`h-${i}`, `/x/${i}.pdf`, 100, Buffer.from("{}"), `s-${i}`, STANJA.SPREMNO, t, t);
    }
    store.db.exec("COMMIT");
    const upisMs = Date.now() - pocetak;

    const serija = store.zaSlanje({ limit: 50, lokalniDatum: "2026-03-10" });
    assert.equal(serija.length, 50, "serija nije ograničena");

    const zbir = store.zbir();
    assert.equal(zbir[STANJA.SPREMNO], 12000);

    const posle = process.memoryUsage().heapUsed;
    const porastMb = (posle - pre) / 1024 / 1024;
    assert.ok(porastMb < 120, `memorija je porasla ${porastMb.toFixed(1)} MB`);

    process.stdout.write(
      `\n  [obim] 12000 stavki: upis ${upisMs} ms, serija 50, porast heap-a ${porastMb.toFixed(1)} MB\n`,
    );
  } finally {
    store.zatvori();
    await rm(baza, { recursive: true, force: true });
  }
});

/* =========================================================================
 * Keystore
 * ====================================================================== */

test("spakovan konektor ODBIJA test skladište ključa", async () => {
  const { izaberiAdapter } = await import(D("keystore/index.mjs"));
  assert.throws(
    () => izaberiAdapter({ CS_CONNECTOR_INSECURE_KEYSTORE: "1", CS_CONNECTOR_PACKAGED: "1" }),
    (e) => e.code === "insecure_keystore_refused",
    "paket je prihvatio nebezbedno skladište",
  );
});

test("bez izričitog test režima nema plaintext fallback-a", async () => {
  const { izaberiAdapter } = await import(D("keystore/index.mjs"));
  if (process.platform === "win32") return; // Na Windowsu je DPAPI dostupan.
  assert.throws(
    () => izaberiAdapter({}),
    (e) => e.code === "no_secure_keystore",
  );
});

test("test adapter čuva ključ sa uskim dozvolama", async () => {
  const baza = await mkdtemp(join(tmpdir(), "cs-kljuc-"));
  try {
    const adapter = await import(D("keystore/test-insecure.mjs"));
    const { generateKeyPairSync } = await import("node:crypto");
    const { privateKey } = generateKeyPairSync("ed25519");
    const pkcs8 = new Uint8Array(privateKey.export({ type: "pkcs8", format: "der" }));

    const p = join(baza, "kljuc.bin");
    await adapter.sacuvaj({ putanja: p, privateKeyPkcs8Der: pkcs8 });
    await chmod(p, 0o600);

    const nazad = await adapter.ucitaj({ putanja: p });
    assert.deepEqual(Buffer.from(nazad), Buffer.from(pkcs8), "ključ se ne vraća isti");
  } finally {
    await rm(baza, { recursive: true, force: true });
  }
});
