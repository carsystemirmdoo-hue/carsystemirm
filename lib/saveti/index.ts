import "server-only";

/**
 * Serverski pristup rubrici „Saveti i vodiči“.
 *
 * Generisani skup sadrži SVE zapise — i buduće, neodobrene i nenapisane.
 * Zato se ovaj modul nikada ne uvozi u klijentsku komponentu (`server-only`),
 * a strane klijentu prosleđuju samo sažetke JAVNIH članaka. Šta je javno
 * odlučuje kapija (`objava.mjs`) za trenutak generisanja strane.
 */

import generated from "@/data/saveti/clanci.generated.json";
import raspored from "@/content/saveti/raspored.json";
import {
  articlePublicationState,
  effectiveModifiedAt,
  JAVNO_STANJE,
  slotReport,
  slotsByArticle,
} from "@/lib/saveti/objava.mjs";
import { instantFrom } from "@/lib/saveti/vreme.mjs";
import { getSavetiKategorija, SAVETI_KATEGORIJE } from "@/lib/saveti/kategorije.mjs";

export type SavetiInline =
  | { t: "text"; v: string }
  | { t: "code"; v: string }
  | { t: "cite"; id: string }
  | { t: "strong" | "em"; c: SavetiInline[] }
  | { t: "link"; href: string; c: SavetiInline[] };

export type SavetiBlock =
  | { t: "h"; level: 2 | 3; id: string; c: SavetiInline[] }
  | { t: "p"; c: SavetiInline[] }
  | { t: "ul" | "ol"; items: SavetiInline[][] }
  | { t: "table"; head: SavetiInline[][]; rows: SavetiInline[][][] }
  | { t: "callout"; kind: "napomena" | "upozorenje" | "savet"; c: SavetiInline[][] };

export type SavetiIzvor = {
  id: string;
  naziv: string;
  url?: string;
  dokument?: string;
  verzija?: string;
  datumIzvora?: string;
  pristupljeno: string;
  tip: string;
  napomena?: string;
};

export type SavetiTip = "novost" | "osnovni-vodic" | "postupak" | "resavanje-problema";

export type SavetiZapis = {
  id: string;
  slug: string;
  naslov: string;
  metaNaslov: string;
  opis: string;
  kategorija: string;
  podtema: string;
  tip: SavetiTip;
  publika: string[];
  glavnoPitanje: string;
  dodatnaPitanja: string[];
  brendovi: string[];
  proizvodi: string[];
  povezani: string[];
  izvori: SavetiIzvor[];
  datumDogadjaja: string | null;
  datumObjaveIzvora: string | null;
  trziste: string | null;
  dostupnostUSrbiji: "potvrdjena" | "nije-potvrdjena" | null;
  istorijska: boolean | null;
  prioritet: number;
  status: Record<string, string>;
  strucnaPotvrda: { potrebna: boolean; razlog?: string; status?: string };
  poslednjaProvera: string | null;
  ponovniPregled: string | null;
  proveraVaziDo: string | null;
  odobrenje: { odobrio: string; uloga?: string; datum: string; otisak: string; prikaziIme?: boolean } | null;
  povucen: { datum: string; razlog: string } | null;
  revizije: { datum: string; opis: string }[];
  imaTekst: boolean;
  reci: number;
  otisak: string;
  blocks: SavetiBlock[];
};

export type SavetiClanak = SavetiZapis & {
  /** Trenutak termina (ISO, UTC). */
  datumObjave: string;
  /** Poslednja stvarna izmena posle objave, inače isto što i datumObjave. */
  datumIzmene: string;
};

/** Sažetak za liste i klijentski filter — bez tela članka. */
export type SavetiSazetak = Pick<
  SavetiClanak,
  "id" | "slug" | "naslov" | "opis" | "kategorija" | "tip" | "datumObjave" | "datumIzmene" | "datumDogadjaja" | "istorijska"
> & { kategorijaNaziv: string };

type Raspored = {
  podesavanja: {
    aktivan: boolean;
    pocetakPretpostavljen?: boolean;
    pocetniDatum: string;
    vremeObjave: string;
    vremenskaZona: string;
    razmakDana: number;
    pauzaOd: string | null;
  };
  termini: { redniBroj: number; datum: string; clanak: string | null; preskocen?: { clanak?: string; razlog: string } }[];
};

const zapisi = (generated as unknown as { clanci: SavetiZapis[] }).clanci;
const schedule = raspored as unknown as Raspored;
const slotIndex = slotsByArticle(schedule);

/** Koliko dugo generisana strana rubrike važi pre ponovnog generisanja. */
export const SAVETI_REVALIDATE_SECONDS = 3600;

/**
 * Trenutak „sada“ za kapiju. `SAVETI_SAT` pomera sat SAMO van Vercela
 * (lokalni build i testovi); na Vercel deploymentu se zanemaruje, pa
 * promenljiva okruženja ne može da otkrije budući članak.
 */
export function savetiNow(): Date {
  const override = process.env.SAVETI_SAT;
  if (override && !process.env.VERCEL) return instantFrom(override);
  return new Date();
}

export function getSavetiRaspored() {
  return schedule;
}

export function getAllSavetiZapisi(): SavetiZapis[] {
  return zapisi;
}

function toPublic(zapis: SavetiZapis, publishedAt: Date): SavetiClanak {
  const datumObjave = publishedAt.toISOString();
  return { ...zapis, datumObjave, datumIzmene: effectiveModifiedAt(zapis, datumObjave) };
}

/**
 * Lokalni pregled nacrta za vlasnika (`SAVETI_NACRT_PREGLED=1`, npr. dev server).
 * Prikazuje tehnički i jezički proverene, a još NEODOBRENE tekstove sa oznakom
 * „Nacrt“ i bez indeksiranja. Kao i `SAVETI_SAT`, na Vercel deploymentu se
 * zanemaruje, pa promenljiva okruženja ne može da objavi neodobren tekst.
 */
export function savetiNacrtPregled(): boolean {
  return process.env.SAVETI_NACRT_PREGLED === "1" && !process.env.VERCEL;
}

function isNacrtZaPregled(zapis: SavetiZapis): boolean {
  return (
    zapis.imaTekst &&
    !zapis.povucen &&
    zapis.status.tehnickaProvera === "provereno" &&
    zapis.status.jezickaProvera === "provereno"
  );
}

function nacrtDatum(zapis: SavetiZapis): Date {
  return new Date(`${zapis.poslednjaProvera ?? "2026-10-08"}T09:00:00+02:00`);
}

export function getPublicSaveti(now = savetiNow()): SavetiClanak[] {
  if (savetiNacrtPregled()) {
    return zapisi
      .filter(isNacrtZaPregled)
      .map((zapis) => toPublic(zapis, nacrtDatum(zapis)))
      .sort((a, b) => a.id.localeCompare(b.id));
  }
  return zapisi
    .map((zapis) => ({ zapis, state: articlePublicationState(zapis, schedule, now, slotIndex) }))
    .filter(({ state }) => state.stanje === JAVNO_STANJE)
    .map(({ zapis, state }) => toPublic(zapis, state.objavljeno as Date))
    .sort((a, b) => b.datumObjave.localeCompare(a.datumObjave));
}

export function getPublicSavetBySlug(slug: string, now = savetiNow()): SavetiClanak | undefined {
  const zapis = zapisi.find((item) => item.slug === slug);
  if (!zapis) return undefined;
  if (savetiNacrtPregled()) return isNacrtZaPregled(zapis) ? toPublic(zapis, nacrtDatum(zapis)) : undefined;
  const state = articlePublicationState(zapis, schedule, now, slotIndex);
  return state.stanje === JAVNO_STANJE ? toPublic(zapis, state.objavljeno as Date) : undefined;
}

export function toSazetak(clanak: SavetiClanak): SavetiSazetak {
  return {
    id: clanak.id,
    slug: clanak.slug,
    naslov: clanak.naslov,
    opis: clanak.opis,
    kategorija: clanak.kategorija,
    kategorijaNaziv: getSavetiKategorija(clanak.kategorija)?.naziv ?? clanak.kategorija,
    tip: clanak.tip,
    datumObjave: clanak.datumObjave,
    datumIzmene: clanak.datumIzmene,
    datumDogadjaja: clanak.datumDogadjaja,
    istorijska: clanak.istorijska,
  };
}

/**
 * Javne novosti, od najnovijeg DOGAĐAJA ka starijem. Na listi novosti se
 * prikazuje datum događaja, pa i redosled mora da ga prati; datum objave na
 * našem sajtu je drugi kriterijum.
 */
export function getPublicNovosti(publicArticles: SavetiClanak[]) {
  return publicArticles
    .filter((clanak) => clanak.tip === "novost")
    .sort(
      (a, b) =>
        (b.datumDogadjaja ?? "").localeCompare(a.datumDogadjaja ?? "") ||
        b.datumObjave.localeCompare(a.datumObjave),
    );
}

/** Kategorije sa brojem javnih članaka (samo neprazne). */
export function getPublicKategorije(publicArticles: SavetiClanak[]) {
  return SAVETI_KATEGORIJE.map((kategorija) => ({
    ...kategorija,
    broj: publicArticles.filter((clanak) => clanak.kategorija === kategorija.slug).length,
  })).filter((kategorija) => kategorija.broj > 0);
}

/** Kategorija dobija indeksabilnu stranu tek sa ovoliko javnih članaka. */
export const MIN_CLANAKA_ZA_INDEKS_KATEGORIJE = 3;

/**
 * Povezani javni članci: prvo urednički izabrani (`povezani`), zatim iz iste
 * podteme/kategorije. Budući članak se nikada ne prikazuje ni ne linkuje.
 */
export function getRelatedSaveti(clanak: SavetiClanak, publicArticles: SavetiClanak[], limit = 4) {
  const byId = new Map(publicArticles.map((item) => [item.id, item]));
  const chosen = clanak.povezani
    .map((id) => byId.get(id))
    .filter((item): item is SavetiClanak => Boolean(item));
  const seen = new Set([clanak.id, ...chosen.map((item) => item.id)]);
  const fill = publicArticles.filter(
    (item) => !seen.has(item.id) && item.kategorija === clanak.kategorija && item.tip !== "novost",
  );
  return [...chosen, ...fill].slice(0, limit);
}

/** Skup javnih slugova — za odluku da li interni link sme da bude link. */
export function publicSlugSet(publicArticles: SavetiClanak[]) {
  return new Set(publicArticles.map((clanak) => clanak.slug));
}

/** Izveštaj o terminima oko trenutka — za zakazani posao. */
export function getSavetiSlotReport(now: Date, fromIndex: number, toIndex: number) {
  return slotReport(zapisi, schedule, now, { fromIndex, toIndex });
}
