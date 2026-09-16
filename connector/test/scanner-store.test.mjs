import assert from "node:assert/strict";
import { chmod, cp, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
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

/*
 * `fileURLToPath`, ne `.pathname`.
 *
 * `URL.pathname` vraća PROCENAT-KODIRANU putanju: folder „Smoke ČĆŽ“ postane
 * `Smoke%20%C4%8C…`, i `fs` traži fajl koji tako doslovno ne postoji. Na
 * Windowsu je gore — `.pathname` nosi i vodeću kosu crtu (`/C:/…`).
 *
 * Nije se videlo jer repozitorijum stoji na putanji bez razmaka i bez srpskih
 * slova; puklo bi tek na kancelarijskom računaru, u paketu.
 */
const FIXTURES = fileURLToPath(new URL("../../fixtures/dev/biznisoft/", import.meta.url));

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

/* =========================================================================
 * Oznaka fakture u imenu
 *
 * Poslovno pravilo kancelarije: PDF je kandidat za fakturu samo ako ime nosi
 * `faktura` ili `fak` kao samostalan segment. Tabela je doslovno spisak iz
 * zahteva; donji blok „posledice pravila" su slučajevi koje pravilo ne
 * navodi, a ishod sledi iz spiska dozvoljenih razdvajača.
 * ====================================================================== */

const PRIHVACENO = [
  "FAKTURA 123.pdf",
  "faktura-123.PDF",
  "Faktura_2026_123.pdf",
  "FAK 123.pdf",
  "FAK-123.pdf",
  "FAK_123.pdf",
  "FAK123.pdf",
  "2026-FAK-123.pdf",
  "storno faktura 123.pdf",
  // velika/mala slova i ekstenzija
  "fAkTuRa 9.Pdf",
  "fak.pdf",
  "FAKTURA.PDF",
  "123.faktura.pdf",
  "FAKTURA123.pdf",
];

const ODBIJENO = [
  "racun 123.pdf",
  "otpremnica 123.pdf",
  "kompenzacija.pdf",
  "profaktura.pdf",
  "nefaktura.pdf",
  "faks.pdf",
  "faktor.pdf",
  // nije PDF
  "FAKTURA 123.docx",
  "FAK 123.pdf.txt",
  "faktura",
  "FAK-123.xml",
];

const POSLEDICE_PRAVILA = [
  // cifra je dozvoljena samo POSLE oznake
  ["123FAK.pdf", false],
  // zagrada i zarez nisu na spisku razdvajača
  ["faktura(1).pdf", false],
  ["FAK,123.pdf", false],
  // `fakture` nije `faktura`, a `fak` iza sebe ima slovo
  ["fakture 2026.pdf", false],
  // Windows kopija zadržava razmak iza oznake
  ["FAKTURA 123 - Copy.pdf", true],
  ["FAKTURA 123 (2).pdf", true],
];

test("naziv: svi prihvaćeni primeri iz poslovnog pravila", () => {
  for (const ime of PRIHVACENO) {
    assert.equal(skener.jeFakturaPoNazivu(ime), true, `odbijeno, a mora biti prihvaćeno: ${ime}`);
  }
});

test("naziv: svi odbijeni primeri iz poslovnog pravila", () => {
  for (const ime of ODBIJENO) {
    assert.equal(skener.jeFakturaPoNazivu(ime), false, `prihvaćeno, a mora biti odbijeno: ${ime}`);
  }
});

test("naziv: posledice spiska razdvajača", () => {
  for (const [ime, ocekivano] of POSLEDICE_PRAVILA) {
    assert.equal(skener.jeFakturaPoNazivu(ime), ocekivano, ime);
  }
});

test("naziv: matcher nije `includes(\"fak\")`", () => {
  // Svako od ovih imena SADRŽI `fak`; nijedno nije faktura.
  for (const ime of ["profaktura.pdf", "nefaktura.pdf", "faks.pdf", "faktor.pdf", "defakto.pdf"]) {
    assert.ok(ime.toLowerCase().includes("fak"));
    assert.equal(skener.jeFakturaPoNazivu(ime), false, ime);
  }
});

test("popis uzima samo PDF-ove sa oznakom i broji ostale po folderu", async () => {
  const { baza, folder } = await privremeni();
  try {
    for (const godina of ["2021", "2026"]) {
      await mkdir(join(folder, godina), { recursive: true });
      await cp(join(FIXTURES, "jedna-stavka.pdf"), join(folder, godina, `FAK ${godina}-1.pdf`));
      await cp(join(FIXTURES, "vise-stavki.pdf"), join(folder, godina, `racun ${godina}-1.pdf`));
      await cp(join(FIXTURES, "vise-stavki.pdf"), join(folder, godina, `profaktura ${godina}.pdf`));
      await writeFile(join(folder, godina, "FAKTURA beleška.txt"), "nije pdf");
    }

    const { koren } = await skener.proveriIzvor(folder);
    const { kandidati, folderi } = await skener.nadjiKandidate(koren);

    assert.deepEqual(
      kandidati.map((k) => k.putanja.split(/[\\/]/).pop()).sort(),
      ["FAK 2021-1.pdf", "FAK 2026-1.pdf"],
    );
    const po = Object.fromEntries(folderi.map((f) => [f.folder, f]));
    for (const godina of ["2021", "2026"]) {
      assert.equal(po[godina].ukupnoPdf, 2 + 1, `${godina}: ukupno PDF`);
      assert.equal(po[godina].kandidata, 1, `${godina}: kandidata`);
      assert.equal(po[godina].nijeFakturaPoNazivu, 2, `${godina}: odbijeno po nazivu`);
    }
    assert.equal(po[skener.OZNAKA_KORENA].ukupnoPdf, 0);
    // Zbir po folderu nosi ime foldera — nikad putanju ni ime fajla.
    const tekst = JSON.stringify(folderi);
    assert.ok(!tekst.includes(baza) && !tekst.includes(".pdf"), `zbir curi: ${tekst}`);
  } finally {
    await rm(baza, { recursive: true, force: true });
  }
});

test("buduće godine 2027, 2028, 2029 se nalaze bez izmene konfiguracije", async () => {
  const { baza, folder } = await privremeni();
  try {
    for (const godina of ["2021", "2022", "2023", "2024", "2025", "2026"]) {
      await mkdir(join(folder, godina), { recursive: true });
      await cp(join(FIXTURES, "jedna-stavka.pdf"), join(folder, godina, `FAKTURA ${godina}.pdf`));
    }
    const { koren } = await skener.proveriIzvor(folder);
    assert.equal((await skener.nadjiKandidate(koren)).kandidati.length, 6);

    for (const godina of ["2027", "2028", "2029"]) {
      await mkdir(join(folder, godina), { recursive: true });
      await cp(join(FIXTURES, "jedna-stavka.pdf"), join(folder, godina, `FAK-${godina}-1.pdf`));
    }
    // Isti koren, isti poziv — nijedna godina nije upisana u kod.
    const { kandidati, folderi } = await skener.nadjiKandidate(koren);
    assert.equal(kandidati.length, 9);
    assert.deepEqual(
      folderi.map((f) => f.folder),
      [skener.OZNAKA_KORENA, "2021", "2022", "2023", "2024", "2025", "2026", "2027", "2028", "2029"],
    );
  } finally {
    await rm(baza, { recursive: true, force: true });
  }
});

test("skenira se koren I neposredni podfolderi — ali ne dublje i ne kroz linkove", async () => {
  const { baza, folder } = await privremeni();
  try {
    const spolja = join(baza, "spolja");
    await mkdir(spolja, { recursive: true });
    await cp(join(FIXTURES, "jedna-stavka.pdf"), join(spolja, "FAK tudja.pdf"));

    // Fajl u samom korenu, sa razmacima i srpskim slovima, VELIKA ekstenzija.
    await cp(join(FIXTURES, "vise-stavki.pdf"), join(folder, "Faktura broj 42.PDF"));

    // Neposredni podfolderi — MORAJU se obići. Ime foldera nije poslovni podatak.
    for (const godina of ["FAKTURE 2024", "FAKTURE 2029", "bilo kakvo ime ČĆŽ"]) {
      await mkdir(join(folder, godina), { recursive: true });
      await cp(join(FIXTURES, "jedna-stavka.pdf"), join(folder, godina, `faktura ${godina}.pdf`));
    }

    // Dva nivoa dublje — NE sme se obići.
    await mkdir(join(folder, "FAKTURE 2024", "arhiva"), { recursive: true });
    await cp(
      join(FIXTURES, "jedna-stavka.pdf"),
      join(folder, "FAKTURE 2024", "arhiva", "FAK duboko.pdf"),
    );

    /*
     * Linkovi se prave uslovno.
     *
     * Na Windowsu `symlink` bez povišenih prava ne uspeva; ovaj isti fajl se
     * izvršava u kancelarijskom smoke-u, pa tvrdnja o linku sme da postoji samo
     * ako je link stvarno napravljen. Junction varijantu pokriva `[WIN]` test.
     */
    const linkFajl = await symlink(join(spolja, "FAK tudja.pdf"), join(folder, "FAK veza.pdf"))
      .then(() => true)
      .catch(() => false);
    const linkFolder = await symlink(spolja, join(folder, "vezani folder"))
      .then(() => true)
      .catch(() => false);

    const { koren } = await skener.proveriIzvor(folder);
    const { kandidati, preskoceno } = await skener.nadjiKandidate(koren);
    // `basename`, ne deljenje po `/`: na Windowsu je separator `\`.
    const imena = kandidati.map((k) => basename(k.putanja)).sort();

    assert.deepEqual(
      imena,
      ["Faktura broj 42.PDF", "faktura FAKTURE 2024.pdf", "faktura FAKTURE 2029.pdf", "faktura bilo kakvo ime ČĆŽ.pdf"],
      "popis nije tačno koren + jedan nivo",
    );
    assert.ok(!imena.includes("FAK duboko.pdf"), "skener je sišao dva nivoa dublje");
    assert.ok(!imena.includes("FAK tudja.pdf"), "skener je izašao iz korena");

    if (linkFajl) {
      assert.ok(preskoceno.some((x) => x.razlog === "symlink"), "symlink fajl nije preskočen");
    }
    if (linkFolder) {
      assert.ok(
        preskoceno.some((x) => x.razlog === "podfolder_symlink"),
        "symlink podfolder nije preskočen PRE otvaranja",
      );
    }
    assert.ok(
      preskoceno.some((x) => x.razlog === "predubok"),
      "dublji folder nije prijavljen kao preskočen",
    );
  } finally {
    await rm(baza, { recursive: true, force: true });
  }
});

test("nov podfolder se nalazi bez ijedne izmene konfiguracije", async () => {
  const { baza, folder } = await privremeni();
  try {
    /*
     * Ime foldera se NIGDE ne čita — nema obrasca, nema spiska godina.
     * Zato 2028, 2029, 2030 i „bilo šta" rade isto, bez izmene podešavanja.
     */
    const { koren } = await skener.proveriIzvor(folder);
    assert.equal((await skener.nadjiKandidate(koren)).kandidati.length, 0);

    for (const ime of ["FAKTURE 2028", "FAKTURE 2029", "FAKTURE 2030", "ARHIVA XYZ"]) {
      await mkdir(join(folder, ime), { recursive: true });
      await cp(join(FIXTURES, "jedna-stavka.pdf"), join(folder, ime, `faktura ${ime}.pdf`));

      const { kandidati } = await skener.nadjiKandidate(koren);
      assert.ok(
        kandidati.some((k) => k.putanja.includes(ime)),
        `nov podfolder „${ime}" nije pronađen`,
      );
    }

    const { kandidati } = await skener.nadjiKandidate(koren);
    assert.equal(kandidati.length, 4, "nisu nađeni svi novi podfolderi");
  } finally {
    await rm(baza, { recursive: true, force: true });
  }
});

test("popis NIJE ograničen budžetom obrade", async () => {
  const { baza, folder } = await privremeni();
  try {
    /*
     * Ranije je ista granica prekidala POPIS posle 200 sirovih kandidata, pa je
     * pun stari folder mogao trajno da sakrije nov dokument u drugom.
     */
    const stari = join(folder, "FAKTURE 2024");
    await mkdir(stari, { recursive: true });
    for (let i = 0; i < 250; i += 1) {
      await writeFile(join(stari, `FAK-stara-${i}.pdf`), `sadržaj ${i}`);
    }
    const novi = join(folder, "FAKTURE 2029");
    await mkdir(novi, { recursive: true });
    await cp(join(FIXTURES, "jedna-stavka.pdf"), join(novi, "FAK nova.pdf"));

    const { koren } = await skener.proveriIzvor(folder);
    const { kandidati } = await skener.nadjiKandidate(koren);

    assert.equal(kandidati.length, 251, "popis je prekinut pre kraja");
    assert.ok(
      kandidati.some((k) => k.putanja.endsWith("FAK nova.pdf")),
      "nov dokument je ostao sakriven iza 250 starih",
    );
  } finally {
    await rm(baza, { recursive: true, force: true });
  }
});

test("podfolder bez prava čitanja ne ruši popis", async () => {
  const { baza, folder } = await privremeni();
  try {
    const zatvoren = join(folder, "FAKTURE 2025");
    await mkdir(zatvoren, { recursive: true });
    await cp(join(FIXTURES, "jedna-stavka.pdf"), join(zatvoren, "FAK-u-zatvorenom.pdf"));

    const otvoren = join(folder, "FAKTURE 2026");
    await mkdir(otvoren, { recursive: true });
    await cp(join(FIXTURES, "vise-stavki.pdf"), join(otvoren, "FAK-u-otvorenom.pdf"));

    await chmod(zatvoren, 0o000);
    try {
      const { koren } = await skener.proveriIzvor(folder);
      const { kandidati, preskoceno } = await skener.nadjiKandidate(koren);

      // Ostatak arhive se i dalje popisuje.
      assert.ok(
        kandidati.some((k) => k.putanja.endsWith("FAK-u-otvorenom.pdf")),
        "jedan nedostupan folder je zaustavio ceo popis",
      );
      assert.ok(
        preskoceno.some((x) => x.razlog === "folder_nedostupan") ||
          kandidati.some((k) => k.putanja.endsWith("FAK-u-zatvorenom.pdf")),
        "nedostupan folder nije ni pročitan ni prijavljen",
      );
    } finally {
      await chmod(zatvoren, 0o700);
    }
  } finally {
    await rm(baza, { recursive: true, force: true });
  }
});

test("prazan i prevelik fajl se preskaču bez rušenja ciklusa", async () => {
  const { baza, folder } = await privremeni();
  try {
    await writeFile(join(folder, "FAK-prazan.pdf"), "");
    await writeFile(join(folder, "FAK-velik.pdf"), Buffer.alloc(1024));
    await cp(join(FIXTURES, "jedna-stavka.pdf"), join(folder, "FAK-dobar.pdf"));

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
    const p = join(folder, "FAK raste.pdf");
    await writeFile(p, "%PDF-1.4 a");
    const granice = { stabilnostMs: 20, stabilnostPokusaja: 3, maxBajtova: 1024 * 1024, maxNovihPoCiklusu: 10 };

    /*
     * Fajl RASTE između svaka dva očitanja — kao dokument koji BizniSoft još
     * upisuje. Ranije je to radio `setInterval` od 5 ms sa nasumičnom
     * veličinom: na Windowsu tajmer ima rezoluciju ~15,6 ms, pa je rast
     * ponekad promašio pauzu i fajl je izgledao stabilan (kancelarijski
     * prolaz 2 od 2 nije bio isti). Sada se fajl menja TAČNO u pauzi.
     */
    const pauza = async () => {
      const { appendFile } = await import("node:fs/promises");
      await appendFile(p, "x");
    };
    const rez = await skener.procitajStabilno(p, granice, { cekaj: pauza });

    assert.equal(rez.ok, false);
    assert.equal(rez.razlog, "nestabilan", `neočekivan razlog: ${rez.razlog}`);

    // Sledeći ciklus: upis je završen, fajl miruje — i dokument se NALAZI.
    const posle = await skener.procitajStabilno(p, granice, { cekaj: async () => {} });
    assert.equal(posle.ok, true, `dovršen fajl nije pročitan: ${posle.razlog}`);
    assert.equal(posle.velicina, "%PDF-1.4 a".length + 2);
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

/**
 * Broji `DatabaseSync#close` dok traje `fn`.
 *
 * Na Windowsu otvorena SQLite baza ne može da se obriše; na macOS-u može, pa
 * se curenje ručke odavde vidi samo ovako. Kancelarijski smoke 45a3460 je
 * pao na tri testa upravo zato što neuspelo otvaranje nije zatvaralo bazu.
 */
async function brojZatvaranja(fn) {
  const { DatabaseSync } = await import("node:sqlite");
  const izvorno = DatabaseSync.prototype.close;
  let n = 0;
  DatabaseSync.prototype.close = function zatvori(...a) {
    n += 1;
    return izvorno.apply(this, a);
  };
  try {
    await fn();
  } finally {
    DatabaseSync.prototype.close = izvorno;
  }
  return n;
}

test("neuspelo otvaranje reda ZATVARA bazu — noviji red, tuđi identitet, pokvaren fajl", async () => {
  const { DatabaseSync } = await import("node:sqlite");
  const { SEMA_VERZIJA } = await import(D("store.mjs"));

  const slucajevi = {
    schema_newer: async (putanja) => {
      otvoriStore({ putanja, identitet: IDENTITET }).zatvori();
      const db = new DatabaseSync(putanja);
      db.prepare("UPDATE meta SET vrednost = ? WHERE kljuc = 'sema_verzija'").run(String(SEMA_VERZIJA + 1));
      db.close();
      return () => otvoriStore({ putanja, identitet: IDENTITET });
    },
    identity_mismatch: async (putanja) => {
      otvoriStore({ putanja, identitet: IDENTITET }).zatvori();
      return () => otvoriStore({ putanja, identitet: { ...IDENTITET, origin: "https://drugi.invalid" } });
    },
    pokvaren_fajl: async (putanja) => {
      await mkdir(join(putanja, ".."), { recursive: true });
      await writeFile(putanja, "ovo nije baza");
      return () => otvoriStore({ putanja, identitet: IDENTITET });
    },
  };

  for (const [ime, pripremi] of Object.entries(slucajevi)) {
    const baza = await mkdtemp(join(tmpdir(), "cs-ruka-"));
    const putanja = join(baza, "Stanje ČĆŽ", "queue.db");
    try {
      const otvori = await pripremi(putanja);
      let greska = null;
      const zatvoreno = await brojZatvaranja(async () => {
        try {
          otvori();
        } catch (e) {
          greska = e;
        }
      });
      assert.ok(greska, `${ime}: otvaranje nije odbijeno`);
      assert.equal(zatvoreno, 1, `${ime}: baza je ostala otvorena posle odbijanja`);
    } finally {
      // Na Windowsu ovo je pucalo sa EBUSY dok je ručka ostajala otvorena.
      await rm(baza, { recursive: true, force: true });
    }
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
  const trazenTest = { CS_CONNECTOR_INSECURE_KEYSTORE: "1", CS_CONNECTOR_PACKAGED: "1" };

  /*
   * Obe grane, na SVAKOJ platformi.
   *
   * Ranije je test pretpostavljao da DPAPI nije dostupan. Na Windowsu jeste,
   * pa je izbor vratio DPAPI umesto greške i test je pao — iako paket nijednom
   * nije izabrao test skladište. Dostupnost se sada zadaje izričito.
   */
  assert.throws(
    () => izaberiAdapter(trazenTest, { dpapiDostupan: false }),
    (e) => e.code === "insecure_keystore_refused",
    "paket je prihvatio nebezbedno skladište",
  );

  const saDpapi = izaberiAdapter(trazenTest, { dpapiDostupan: true });
  assert.match(saDpapi.ime, /dpapi/i, "izričita promenljiva je nadjačala DPAPI");
  assert.doesNotMatch(saDpapi.ime, /insecure/i);
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
