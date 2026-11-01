import "server-only";

/**
 * Serverski pristup rubrici „Saveti i vodiči“ (javni deo).
 *
 * Od migracije 0058 izvor istine je baza (urednik u poslovnom panelu). Javna je verzija koju
 * određuje `javnaVerzijaU` (lib/saveti/urednik/stanje.mjs): odobrena verzija čiji je termin
 * prošao, inače objavljena i nepovučena verzija. Termin se poredi sa trenutkom generisanja
 * strane, pa objava ne čeka zakazani posao; strane se obnavljaju najkasnije na
 * SAVETI_REVALIDATE_SECONDS. Fajlovi u content/saveti su samo izvor za početni uvoz
 * (scripts/saveti/uvezi-u-bazu.mjs).
 *
 * Kada baza nije dostupna (npr. build bez baze), rubrika je prazna — ništa se ne prikazuje
 * nasumično i nijedan neodobren tekst ne može da procuri.
 */

import { and, eq, inArray, isNull, lte } from "drizzle-orm";
import { getDb } from "@/db/client";
import { savetiAdrese, savetiClanci, savetiSlike, savetiVerzije, savetiZakazivanja } from "@/db/schema";
import { javnaVerzijaU } from "@/lib/saveti/urednik/stanje.mjs";
import { parseArticleMarkdown, wordCount } from "@/lib/saveti/markdown.mjs";
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

export type SavetiSlika = { id: string; alt: string; sirina: number; visina: number };

export type SavetiClanak = SavetiZapis & {
  /** Naslovna slika (iz panela); bez nje strana koristi podrazumevanu sliku sajta. */
  slika: SavetiSlika | null;
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


/**
 * Koliko dugo generisana strana rubrike važi pre ponovnog generisanja: zakazan članak postaje
 * vidljiv najkasnije ovoliko posle termina (radnje u panelu osvežavaju strane odmah).
 */
export const SAVETI_REVALIDATE_SECONDS = 60;

type ClanakRed = typeof savetiClanci.$inferSelect;
type VerzijaRed = typeof savetiVerzije.$inferSelect;

const str = (v: unknown) => (typeof v === "string" ? v : "");
const strOrNull = (v: unknown) => (typeof v === "string" && v ? v : null);
const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

/** Verzija iz baze → oblik koji koriste strane rubrike (isti za javni prikaz i pregled u panelu). */
export function verzijaUClanak(
  clanak: Pick<ClanakRed, "id" | "slug" | "tip" | "kategorija" | "prviPutObjavljeno" | "javnoOd">,
  verzija: VerzijaRed,
  slika: SavetiSlika | null,
  sada = new Date(),
): SavetiClanak {
  const p = (verzija.podaci ?? {}) as Record<string, unknown>;
  const { blocks } = parseArticleMarkdown(verzija.telo, clanak.slug) as { blocks: SavetiBlock[] };
  const objavljeno = (clanak.prviPutObjavljeno ?? clanak.javnoOd ?? sada).toISOString();
  const izmena = (clanak.javnoOd ?? clanak.prviPutObjavljeno ?? sada).toISOString();
  return {
    id: clanak.id,
    slug: clanak.slug,
    naslov: verzija.naslov,
    metaNaslov: verzija.metaNaslov || verzija.naslov,
    opis: verzija.opis,
    kategorija: clanak.kategorija,
    podtema: str(p.podtema),
    tip: clanak.tip as SavetiTip,
    publika: arr(p.publika),
    glavnoPitanje: str(p.glavnoPitanje),
    dodatnaPitanja: arr(p.dodatnaPitanja),
    brendovi: arr(p.brendovi),
    proizvodi: arr(p.proizvodi),
    povezani: arr(p.povezani),
    izvori: (Array.isArray(verzija.izvori) ? verzija.izvori : []) as SavetiIzvor[],
    datumDogadjaja: strOrNull(p.datumDogadjaja),
    datumObjaveIzvora: strOrNull(p.datumObjaveIzvora),
    trziste: strOrNull(p.trziste),
    dostupnostUSrbiji: (strOrNull(p.dostupnostUSrbiji) as SavetiZapis["dostupnostUSrbiji"]) ?? null,
    istorijska: typeof p.istorijska === "boolean" ? p.istorijska : null,
    prioritet: typeof p.prioritet === "number" ? p.prioritet : 0,
    status: {},
    strucnaPotvrda: { potrebna: false },
    poslednjaProvera: strOrNull(p.poslednjaProvera),
    ponovniPregled: null,
    proveraVaziDo: strOrNull(p.proveraVaziDo),
    odobrenje: null,
    povucen: null,
    revizije: [],
    imaTekst: true,
    reci: wordCount(blocks),
    otisak: verzija.otisak,
    blocks,
    datumObjave: objavljeno,
    datumIzmene: izmena > objavljeno ? izmena : objavljeno,
    slika,
  };
}

async function slikeZa(ids: (string | null)[]) {
  const list = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  if (!list.length) return new Map<string, { sirina: number; visina: number }>();
  const rows = await getDb()
    .select({ id: savetiSlike.id, sirina: savetiSlike.sirina, visina: savetiSlike.visina })
    .from(savetiSlike)
    .where(inArray(savetiSlike.id, list));
  return new Map(rows.map((r) => [r.id, r]));
}

function bazaDostupna() {
  return Boolean(process.env.DATABASE_URL);
}

export async function getPublicSaveti(sada = new Date()): Promise<SavetiClanak[]> {
  if (!bazaDostupna()) return [];
  try {
    const db = getDb();
    const dospeli = await db
      .select({ id: savetiZakazivanja.id, clanakId: savetiZakazivanja.clanakId, verzijaId: savetiZakazivanja.verzijaId, termin: savetiZakazivanja.termin, izvrseno: savetiZakazivanja.izvrseno })
      .from(savetiZakazivanja)
      .where(and(isNull(savetiZakazivanja.otkazano), isNull(savetiZakazivanja.izvrseno), lte(savetiZakazivanja.termin, sada)));
    const poClanku = new Map(dospeli.map((z) => [z.clanakId, z]));
    const clanci = await db.select().from(savetiClanci);
    const javni = clanci
      .map((clanak) => {
        const z = poClanku.get(clanak.id) ?? null;
        const verzijaId = javnaVerzijaU(clanak, z, sada) as string | null;
        if (!verzijaId) return null;
        // Termin koji je prošao, a usklađivanje ga još nije upisalo: datum objave je termin.
        const objava = z && z.verzijaId === verzijaId ? { ...clanak, javnoOd: z.termin, prviPutObjavljeno: clanak.prviPutObjavljeno ?? z.termin } : clanak;
        return { clanak: objava, verzijaId };
      })
      .filter((x): x is { clanak: ClanakRed; verzijaId: string } => x !== null);
    if (!javni.length) return [];
    const verzije = await db.select().from(savetiVerzije).where(inArray(savetiVerzije.id, javni.map((j) => j.verzijaId)));
    const poId = new Map(verzije.map((v) => [v.id, v]));
    const slike = await slikeZa(verzije.map((v) => v.slikaId));
    return javni
      .map(({ clanak, verzijaId }) => {
        const verzija = poId.get(verzijaId);
        if (!verzija) return null;
        const s = verzija.slikaId ? slike.get(verzija.slikaId) : undefined;
        return verzijaUClanak(clanak, verzija, s && verzija.slikaId ? { id: verzija.slikaId, alt: verzija.slikaAlt, ...s } : null, sada);
      })
      .filter((x): x is SavetiClanak => x !== null)
      .sort((a, b) => b.datumObjave.localeCompare(a.datumObjave));
  } catch (error) {
    // Tabele još ne postoje (baza pre 0058) ili baza nije dostupna: rubrika je prazna.
    console.error("[saveti] javni članci nisu učitani", (error as Error)?.message?.slice(0, 160));
    return [];
  }
}

/** Javni članak po adresi; ranija adresa vraća `preusmerenje` na trenutnu. */
export async function getPublicSavetBySlug(slug: string): Promise<{ clanak?: SavetiClanak; preusmerenje?: string }> {
  const all = await getPublicSaveti();
  const clanak = all.find((item) => item.slug === slug);
  if (clanak) return { clanak };
  if (!bazaDostupna()) return {};
  try {
    const [alias] = await getDb()
      .select({ slug: savetiClanci.slug })
      .from(savetiAdrese)
      .innerJoin(savetiClanci, eq(savetiClanci.id, savetiAdrese.clanakId))
      .where(eq(savetiAdrese.slug, slug));
    if (alias && all.some((item) => item.slug === alias.slug)) return { preusmerenje: alias.slug };
  } catch {
    // bez baze nema preusmerenja
  }
  return {};
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
  return SAVETI_KATEGORIJE.map((kategorija: { slug: string; naziv: string }) => ({
    ...kategorija,
    broj: publicArticles.filter((clanak) => clanak.kategorija === kategorija.slug).length,
  })).filter((kategorija: { broj: number }) => kategorija.broj > 0);
}

/** Kategorija dobija indeksabilnu stranu tek sa ovoliko javnih članaka. */
export const MIN_CLANAKA_ZA_INDEKS_KATEGORIJE = 3;

/**
 * Povezani javni članci: prvo urednički izabrani (`povezani`), zatim iz iste
 * kategorije. Neobjavljen članak se nikada ne prikazuje ni ne linkuje.
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
