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
  /** Koliko fajlova jedan ciklus uopšte razmatra. */
  maxFajlovaPoCiklusu: 200,
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
 * Lista kandidata — SAMO neposredno u folderu.
 *
 * Bez rekurzije: podfolderi se ne obilaze. Kancelarija bira jedan folder, a
 * rekurzija bi pri pogrešnoj putanji pretražila pola diska.
 *
 * Symlink/junction se preskaču. `lstat` (ne `stat`) vidi sam link; posle toga se
 * `realpath` poredi sa korenom, pa veza koja pokazuje van dozvoljenog korena ne
 * može da uvuče tuđi fajl. Na Windowsu isto važi za junction i reparse tačke —
 * `lstat` ih prijavljuje kao simboličke veze.
 */
export async function nadjiKandidate(koren, granice = PODRAZUMEVANE_GRANICE) {
  let unosi;
  try {
    unosi = await readdir(koren, { withFileTypes: true });
  } catch {
    throw new ScanError("source_unreachable", "Izvorni folder se ne može pročitati.");
  }

  const kandidati = [];
  const preskoceno = [];

  for (const unos of unosi) {
    if (kandidati.length >= granice.maxFajlovaPoCiklusu) break;
    if (!jePdfIme(unos.name)) continue;

    const puna = join(koren, unos.name);
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

    /*
     * Odbrana u dubini: i posle `lstat` provere, stvarna putanja mora ostati
     * unutar korena. Junction u lancu roditelja bi inače izašao iz dozvoljenog
     * stabla, a `lstat` nad samim fajlom to ne bi video.
     */
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

  return { kandidati, preskoceno };
}

function uKorenu(putanja, koren) {
  const k = resolve(koren);
  const p = resolve(putanja);
  return p === k || p.startsWith(k.endsWith(sep) ? k : k + sep);
}

const cekaj = (ms) => new Promise((r) => setTimeout(r, ms));

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
      // Dva ista očitanja — pokušava se čitanje.
      let fh;
      try {
        fh = await open(putanja, "r");
      } catch (greska) {
        /*
         * `EBUSY`/`EPERM` na Windowsu znači da fajl još drži drugi proces.
         * To je odlaganje, ne trajna greška.
         */
        return {
          ok: false,
          razlog: greska?.code === "ENOENT" ? "nestao" : "zakljucan",
        };
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

    prethodni = otisakStanja;
    if (pokusaj < granice.stabilnostPokusaja - 1) await cekaj(granice.stabilnostMs);
  }

  return { ok: false, razlog: "nestabilan" };
}
