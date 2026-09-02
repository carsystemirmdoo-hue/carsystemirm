import { createHash } from "node:crypto";
import { open, lstat, readdir, realpath } from "node:fs/promises";
import { isAbsolute, join, resolve, sep } from "node:path";

/**
 * Read-only skeniranje izvornog foldera.
 *
 * Konektor NIKADA ne menja, ne preimenuje, ne briše i ne premešta BizniSoft
 * originale. Lokalni red i karantin žive u sopstvenom folderu stanja.
 */

export const PODRAZUMEVANE_GRANICE = Object.freeze({
  /** Iznad ovoga se dokument ne čita; `lib/pdf` ionako staje na 20 MB. */
  maxBajtova: 20 * 1024 * 1024,

  /*
   * Koliko NOVIH ili PROMENJENIH dokumenata jedan ciklus stavlja u obradu.
   *
   * Ranije se ista granica primenjivala na SIROVE kandidate, pa je 200 poznatih
   * fajlova u `FAKTURE 2024` moglo trajno da sakrije nov dokument u
   * `FAKTURE 2029`: popis bi stao pre nego što do njega dođe, i sledeći ciklus
   * bi stao na istom mestu. Popis je sada neograničen; budžet troše isključivo
   * dokumenti koje treba parsirati i poslati.
   */
  maxNovihPoCiklusu: 200,

  /*
   * Gornja granica POPISA — zaštita od pogrešnog korena, ne od arhive.
   *
   * Postavljena tako da nikad ne dodirne stvarnu arhivu (očekuje se red
   * veličine 10–12 hiljada dokumenata), ali da koren greškom postavljen na
   * Korisnički profilni direktorijum na Windowsu ne pretvori ciklus u pretragu pola diska.
   */
  maxPopisa: 200_000,

  /** Dva ista očitanja veličine i `mtime` u razmaku — fajl miruje. */
  stabilnostMs: 2000,
  stabilnostPokusaja: 3,
});

export class ScanError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ScanError";
    this.code = code;
  }
}

/**
 * Proverava izvorni folder pre ijednog čitanja.
 *
 * Folder se NIKADA ne pravi automatski. Pogrešna putanja je greška
 * podešavanja; automatsko pravljenje bi je pretvorilo u „uspešan prazan uvoz“,
 * i niko ne bi primetio da fakture nikad nisu ni skenirane.
 */
export async function proveriIzvor(putanja) {
  if (!putanja || !isAbsolute(putanja)) {
    throw new ScanError("source_not_absolute", "Izvorni folder mora biti apsolutna putanja.");
  }
  let st;
  try {
    st = await lstat(putanja);
  } catch (greska) {
    /*
     * Nedostupan izvor NIJE „nema novih faktura“.
     *
     * Razlika je suštinska: prazan folder znači da nema šta da se radi, a
     * nedostupan znači da se ne zna. Drugo mora da se vidi u statusu.
     */
    throw new ScanError(
      greska?.code === "ENOENT" ? "source_missing" : "source_unreachable",
      "Izvorni folder nije dostupan. Ne pravi se automatski.",
    );
  }
  if (!st.isDirectory()) {
    throw new ScanError("source_not_directory", "Izvorna putanja nije folder.");
  }
  return { koren: await realpath(putanja) };
}

/** Samo obični PDF fajlovi; `.PDF` je isto što i `.pdf`. */
const jePdfIme = (ime) => /\.pdf$/i.test(ime);

/**
 * Lista kandidata — koren i NEPOSREDNI podfolderi, tačno jedan nivo dublje.
 *
 * Zašto jedan nivo
 * ----------------
 * Kancelarijska arhiva je `FAKTURE/FAKTURE 2024…2027/`, i svake godine dobija
 * nov neposredan podfolder. Konektor je podešen na koren i mora ga naći bez
 * izmene konfiguracije. Ime foldera se pri tom NIGDE ne čita: godina i datum
 * dolaze isključivo iz sadržaja dokumenta, pa nema ni obrasca za ime ni spiska
 * dozvoljenih godina.
 *
 * Dublje se NE ide. Rekurzija bi pri pogrešno podešenom korenu pretražila pola
 * diska, a arhiva takvu dubinu nema.
 *
 * Šta se NE prati
 * ---------------
 * Symlink, junction i reparse tačka — ni kao fajl ni kao PODFOLDER. `lstat`
 * (ne `stat`) vidi sam link; posle toga se `realpath` poredi sa korenom, pa
 * veza koja pokazuje van dozvoljenog stabla ne može da uvuče tuđi fajl.
 * Podfolder se proverava PRE nego što se uopšte otvori.
 *
 * Popis je NEOGRANIČEN
 * --------------------
 * `maxNovihPoCiklusu` se ovde ne primenjuje. Popis mora svakog dana da vidi
 * ceo koren; ograničenje troše tek novi dokumenti, u `pipeline.mjs`.
 */
export async function nadjiKandidate(koren, granice = PODRAZUMEVANE_GRANICE) {
  const kandidati = [];
  const preskoceno = [];

  const foldere = await neposredniFolderi(koren, preskoceno);

  /*
   * Deterministički redosled: koren, pa podfolderi po imenu.
   *
   * Redosled više ne odlučuje šta će biti VIĐENO — popis je pun. Ali odlučuje
   * šta ulazi u obradu kad novih ima više od budžeta, a nasumičan redosled bi
   * značio da se dva uzastopna ciklusa ne mogu porediti.
   */
  for (const folder of [koren, ...foldere]) {
    if (kandidati.length >= granice.maxPopisa) {
      preskoceno.push({ razlog: "popis_prekinut" });
      break;
    }
    await pokupiPdfove(folder, koren, granice, kandidati, preskoceno);
  }

  return { kandidati, preskoceno };
}

/**
 * Neposredni podfolderi korena — sortirani, bez linkova, bez izlaska iz korena.
 *
 * @param {string} koren već razrešena (`realpath`) putanja korena
 */
async function neposredniFolderi(koren, preskoceno) {
  let unosi;
  try {
    unosi = await readdir(koren, { withFileTypes: true });
  } catch {
    throw new ScanError("source_unreachable", "Izvorni folder se ne može pročitati.");
  }

  const folderi = [];
  for (const unos of unosi) {
    if (unos.isFile()) continue;

    const puna = join(koren, unos.name);
    let st;
    try {
      st = await lstat(puna);
    } catch {
      preskoceno.push({ razlog: "nestao" });
      continue;
    }

    /*
     * Junction i reparse tačka se odbijaju PRE otvaranja.
     *
     * Na Windowsu ih `lstat` prijavljuje kao simboličke veze. Da se folder prvo
     * otvorio pa proveravao, jedan junction ka `C:\` bi već bio pročitan.
     */
    if (st.isSymbolicLink()) {
      preskoceno.push({ razlog: "podfolder_symlink", ime: unos.name });
      continue;
    }
    if (!st.isDirectory()) continue;

    // Odbrana u dubini: i običan folder mora da se razreši unutar korena.
    let stvarna;
    try {
      stvarna = await realpath(puna);
    } catch {
      preskoceno.push({ razlog: "nestao" });
      continue;
    }
    if (!uKorenu(stvarna, koren)) {
      preskoceno.push({ razlog: "podfolder_van_korena", ime: unos.name });
      continue;
    }

    folderi.push(stvarna);
  }

  folderi.sort();
  return folderi;
}

/** Skuplja PDF-ove iz JEDNOG foldera. Ne silazi dublje. */
async function pokupiPdfove(folder, koren, granice, kandidati, preskoceno) {
  let unosi;
  try {
    unosi = await readdir(folder, { withFileTypes: true });
  } catch {
    /*
     * Folder bez prava čitanja ne ruši ciklus.
     *
     * Ostatak arhive se i dalje popisuje; nedostupan folder je vidljiv u
     * `preskoceno`, umesto da jedan pogrešan ACL zaustavi ceo dan.
     */
    preskoceno.push({ razlog: "folder_nedostupan" });
    return;
  }

  const imena = unosi
    .filter((u) => !u.isDirectory())
    .map((u) => u.name)
    .filter(jePdfIme)
    .sort();

  /*
   * Folder DVA nivoa dublje se ne otvara i ne skenira.
   *
   * Broji se samo da bi bio vidljiv: tiho ignorisanje bi značilo da niko ne zna
   * da tamo nešto stoji.
   */
  const dublji = unosi.filter((u) => u.isDirectory()).length;
  if (folder !== koren && dublji > 0) {
    preskoceno.push({ razlog: "predubok", foldera: dublji });
  }

  for (const ime of imena) {
    if (kandidati.length >= granice.maxPopisa) {
      preskoceno.push({ razlog: "popis_prekinut" });
      return;
    }

    const puna = join(folder, ime);
    let st;
    try {
      st = await lstat(puna);
    } catch {
      preskoceno.push({ razlog: "nestao" });
      continue;
    }

    if (st.isSymbolicLink()) {
      preskoceno.push({ razlog: "symlink" });
      continue;
    }
    if (!st.isFile()) {
      preskoceno.push({ razlog: "nije_obican_fajl" });
      continue;
    }

    let stvarna;
    try {
      stvarna = await realpath(puna);
    } catch {
      preskoceno.push({ razlog: "nestao" });
      continue;
    }
    if (!uKorenu(stvarna, koren)) {
      preskoceno.push({ razlog: "van_korena" });
      continue;
    }

    if (st.size > granice.maxBajtova) {
      preskoceno.push({ razlog: "prevelik", putanja: puna, velicina: st.size });
      continue;
    }
    if (st.size === 0) {
      // Nula bajtova je gotovo uvek fajl koji se upravo pravi.
      preskoceno.push({ razlog: "prazan", putanja: puna });
      continue;
    }

    kandidati.push({ putanja: puna, velicina: st.size, mtimeMs: st.mtimeMs });
  }
}

function uKorenu(putanja, koren) {
  const k = resolve(koren);
  const p = resolve(putanja);
  return p === k || p.startsWith(k.endsWith(sep) ? k : k + sep);
}

const cekaj = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Jedno čitanje sa otiskom — bez čekanja na stabilnost.
 *
 * ZAŠTO POSTOJI
 * =============
 * Dnevni popis mora da vidi CEO koren, a `procitajStabilno` po fajlu plaća dva
 * sekunde čekanja (dva očitanja u razmaku `stabilnostMs`). Nad arhivom od
 * ~12.000 dokumenata to je oko **6,7 sati** — mereno, ne procenjeno. Ciklus
 * koji toliko traje ne postoji.
 *
 * Zato se otkrivanje razdvaja od obrade: ovde se fajl pročita JEDNOM i dobije
 * otisak, a skupi protokol stabilnosti plaćaju samo dokumenti koji su se
 * pokazali kao novi ili promenjeni. Puno čitanje cele arhive sa SHA-256 je
 * mereno na ~2,7 s / 955 MB lokalno; i uz pesimističnu Windows/AV/SMB kaznu
 * ostaje u minutima, jednom dnevno.
 *
 * Provera „menjan tokom čitanja" ostaje: bafer koji ne pripada jednoj verziji
 * fajla ne sme da dobije otisak.
 */
export async function procitajZaOtisak(putanja, granice = PODRAZUMEVANE_GRANICE) {
  return procitajJednom(putanja, granice);
}

/** Zajedničko jezgro: otvori, pročitaj, dokaži da se nije menjalo, heširaj. */
async function procitajJednom(putanja, granice) {
  let fh;
  try {
    fh = await open(putanja, "r");
  } catch (greska) {
    /*
     * `EBUSY`/`EPERM` na Windowsu znači da fajl još drži drugi proces.
     * To je odlaganje, ne trajna greška.
     */
    return { ok: false, razlog: greska?.code === "ENOENT" ? "nestao" : "zakljucan" };
  }
  try {
    const pre = await fh.stat();
    if (pre.size > granice.maxBajtova) return { ok: false, razlog: "prevelik" };
    const bafer = Buffer.alloc(pre.size);
    await fh.read(bafer, 0, pre.size, 0);
    const posle = await fh.stat();

    if (posle.size !== pre.size || posle.mtimeMs !== pre.mtimeMs) {
      // Menjao se dok smo čitali — bafer nije verzija dokumenta.
      return { ok: false, razlog: "menjan_tokom_citanja" };
    }

    const bajtovi = new Uint8Array(bafer);
    return {
      ok: true,
      bajtovi,
      velicina: pre.size,
      /*
       * Otisak se računa nad ISTIM bajtovima koje dobija parser.
       * Drugo čitanje bi moglo da vrati drugi sadržaj.
       */
      sourceHash: createHash("sha256").update(bajtovi).digest("hex"),
    };
  } finally {
    await fh.close().catch(() => {});
  }
}

/**
 * Čeka da fajl prestane da se menja, pa ga pročita JEDNOM.
 *
 * Parser dobija taj jedan bafer — ne putanju. Da parser sam ponovo otvara fajl,
 * čitao bi verziju koja se u međuvremenu promenila, i `source_hash` bi
 * pripadao bajtovima koje niko nije parsirao.
 *
 * Posle čitanja se veličina i `mtime` porede ponovo: ako se fajl menjao TOKOM
 * čitanja, bafer se odbacuje. Delimično zapisan fajl se ODLAŽE, ne proglašava
 * trajno neispravnim — sledeći ciklus ga zatiče gotovog.
 */
export async function procitajStabilno(putanja, granice = PODRAZUMEVANE_GRANICE) {
  let prethodni = null;

  for (let pokusaj = 0; pokusaj < granice.stabilnostPokusaja; pokusaj += 1) {
    let st;
    try {
      st = await lstat(putanja);
    } catch {
      return { ok: false, razlog: "nestao" };
    }
    const otisakStanja = `${st.size}:${st.mtimeMs}`;

    if (prethodni === otisakStanja) {
      // Dva ista očitanja — pokušava se čitanje kroz isto jezgro kao otkrivanje.
      return procitajJednom(putanja, granice);
    }

    prethodni = otisakStanja;
    if (pokusaj < granice.stabilnostPokusaja - 1) await cekaj(granice.stabilnostMs);
  }

  return { ok: false, razlog: "nestabilan" };
}
