import "server-only";
import { createHash } from "node:crypto";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb, type Database } from "@/db/client";
import {
  savetiAdrese,
  savetiClanci,
  savetiDogadjaji,
  savetiObjave,
  savetiSlike,
  savetiVerzije,
  savetiZakazivanja,
  users,
} from "@/db/schema";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit/record";
import { can } from "@/lib/authz/permissions.mjs";
import type { PortalUser } from "@/lib/authz/user-repository";
import { getSavetiKategorija, SAVETI_KATEGORIJE } from "@/lib/saveti/kategorije.mjs";
import { parseArticleMarkdown } from "@/lib/saveti/markdown.mjs";
import { blokoviUMarkdown } from "@/lib/saveti/urednik/format.mjs";
import {
  ispravanSlug,
  odgovaraFilteru,
  otisakSadrzaja,
  slugIzNaslova,
  stanjeClanka,
  terminIzUnosa,
  razlogNeprihvatljivogPotpisnika,
} from "@/lib/saveti/urednik/stanje.mjs";

/**
 * Urednik članaka „Saveti i vodiči“ — servis (migracija 0058, zahtev vlasnika 15. 10. 2026).
 *
 * Svaka radnja SAMA proverava sposobnost aktera (skriveno dugme nije ovlašćenje) i upisuje
 * izmenu, događaj i trag revizije u istoj transakciji. Pravila statusa i termina su u
 * stanje.mjs (čist modul, testiran bez baze).
 *
 * Objava u terminu (2026-11-01): javni upit (lib/saveti/index.ts) prikazuje zakazanu verziju čim
 * termin prođe, pa objava ne zavisi od zakazanog posla. `uskladiDospeleObjave` samo naknadno
 * upisuje tu objavu (javna verzija, događaj, revizija) — pre svake radnje nad člankom, pri
 * otvaranju panela i iz rute /api/saveti/objava — da istorija i stanje u bazi budu tačni.
 */

export class SavetiError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "SavetiError";
  }
}

export type Actor = Pick<PortalUser, "id" | "name" | "role"> & { permissions?: readonly string[] };
type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

const ENTITY = "Članak";
const TIPOVI = ["novost", "osnovni-vodic", "postupak", "resavanje-problema"] as const;
export const TIP_LABEL: Record<string, string> = {
  novost: "Novost",
  "osnovni-vodic": "Osnovni vodič",
  postupak: "Postupak",
  "resavanje-problema": "Rešavanje problema",
};

function need(actor: Actor, capability: string, message: string) {
  if (!can(actor as PortalUser, capability)) throw new SavetiError("forbidden", message);
}

const MAX = { naslov: 140, metaNaslov: 70, opis: 320, telo: 60_000, napomene: 8000, alt: 240 } as const;

export type Izvor = {
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

export type VerzijaUnos = {
  naslov: string;
  metaNaslov?: string;
  opis: string;
  telo: string;
  izvori: Izvor[];
  interneNapomene?: string;
  nepotvrdjeno?: string;
  slikaId?: string | null;
  slikaAlt?: string;
};

/* ------------------------------------------------------------------ provera unosa */

function cistIzvor(raw: Partial<Izvor>, i: number): Izvor {
  const id = String(raw.id ?? "").trim() || `izvor-${i + 1}`;
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) throw new SavetiError("izvor", `Oznaka izvora „${id}“ sme imati samo mala slova, brojeve i crtice.`);
  const naziv = String(raw.naziv ?? "").trim();
  if (!naziv) throw new SavetiError("izvor", `Izvor ${i + 1}: unesite naziv dokumenta ili stranice.`);
  const url = String(raw.url ?? "").trim();
  if (url && !/^https:\/\/[^\s]+$/.test(url)) throw new SavetiError("izvor", `Izvor ${i + 1}: adresa mora početi sa https://.`);
  const pristupljeno = String(raw.pristupljeno ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(pristupljeno)) throw new SavetiError("izvor", `Izvor ${i + 1}: unesite datum pristupa.`);
  const out: Izvor = { id, naziv: naziv.slice(0, 300), pristupljeno, tip: String(raw.tip ?? "stranica").slice(0, 40) || "stranica" };
  if (url) out.url = url.slice(0, 600);
  for (const key of ["verzija", "datumIzvora", "napomena", "dokument"] as const) {
    const value = String(raw[key] ?? "").trim();
    if (value) out[key] = value.slice(0, 400);
  }
  return out;
}

export function proveriUnos(input: VerzijaUnos) {
  const naslov = String(input.naslov ?? "").trim();
  const opis = String(input.opis ?? "").trim();
  const telo = String(input.telo ?? "").replace(/\r\n/g, "\n").trim();
  if (!naslov) throw new SavetiError("naslov", "Unesite naslov članka.");
  if (naslov.length > MAX.naslov) throw new SavetiError("naslov", `Naslov je duži od ${MAX.naslov} znakova.`);
  if (!opis) throw new SavetiError("opis", "Unesite kratak opis.");
  if (opis.length > MAX.opis) throw new SavetiError("opis", `Kratak opis je duži od ${MAX.opis} znakova.`);
  if (!telo) throw new SavetiError("telo", "Tekst članka je prazan.");
  if (telo.length > MAX.telo) throw new SavetiError("telo", "Tekst članka je predugačak.");
  const { blocks, errors } = parseArticleMarkdown(telo, "tekst") as { blocks: unknown[]; errors: string[] };
  if (errors.length) throw new SavetiError("telo", `Tekst nije moguće sačuvati: ${errors[0]}`);
  const izvori = (Array.isArray(input.izvori) ? input.izvori : []).map(cistIzvor);
  const ids = new Set<string>();
  for (const izvor of izvori) {
    if (ids.has(izvor.id)) throw new SavetiError("izvor", `Oznaka izvora „${izvor.id}“ se ponavlja.`);
    ids.add(izvor.id);
  }
  // Svaki citat u tekstu mora imati izvor.
  for (const m of telo.matchAll(/\[\^([a-z0-9][a-z0-9-]*)\]/g)) {
    if (!ids.has(m[1])) throw new SavetiError("izvor", `Tekst navodi izvor [${m[1]}], a on nije na spisku izvora.`);
  }
  const slikaId = input.slikaId || null;
  const slikaAlt = String(input.slikaAlt ?? "").trim();
  if (slikaId && !slikaAlt) throw new SavetiError("slika", "Unesite alternativni tekst naslovne slike (šta se na njoj vidi).");
  if (slikaAlt.length > MAX.alt) throw new SavetiError("slika", "Alternativni tekst je predugačak.");
  return {
    naslov,
    metaNaslov: String(input.metaNaslov ?? "").trim().slice(0, MAX.metaNaslov),
    opis,
    // Kanonski zapis: isti sadržaj uvek daje isti tekst (i otisak), bez obzira na razmake i nastavke redova.
    telo: blokoviUMarkdown(blocks),
    izvori,
    interneNapomene: String(input.interneNapomene ?? "").slice(0, MAX.napomene),
    nepotvrdjeno: String(input.nepotvrdjeno ?? "").slice(0, MAX.napomene),
    slikaId,
    slikaAlt: slikaId ? slikaAlt : "",
    blocks,
  };
}

/* ------------------------------------------------------------------ čitanje */

type VerzijaRed = typeof savetiVerzije.$inferSelect;
type DogadjajRed = typeof savetiDogadjaji.$inferSelect;

async function ucitajSve(db: Database | Tx, ids?: string[]) {
  const clanci = ids
    ? await db.select().from(savetiClanci).where(inArray(savetiClanci.id, ids))
    : await db.select().from(savetiClanci);
  const where = ids ? inArray(savetiVerzije.clanakId, ids) : undefined;
  const verzije = await db
    .select({
      id: savetiVerzije.id,
      clanakId: savetiVerzije.clanakId,
      broj: savetiVerzije.broj,
      naslov: savetiVerzije.naslov,
      opis: savetiVerzije.opis,
      otisak: savetiVerzije.otisak,
      slikaId: savetiVerzije.slikaId,
      napravljeno: savetiVerzije.napravljeno,
    })
    .from(savetiVerzije)
    .where(where)
    .orderBy(asc(savetiVerzije.clanakId), asc(savetiVerzije.broj));
  const dogadjaji = await db
    .select({ clanakId: savetiDogadjaji.clanakId, verzijaId: savetiDogadjaji.verzijaId, radnja: savetiDogadjaji.radnja, vreme: savetiDogadjaji.vreme, detalji: savetiDogadjaji.detalji })
    .from(savetiDogadjaji)
    .where(ids ? inArray(savetiDogadjaji.clanakId, ids) : undefined)
    .orderBy(asc(savetiDogadjaji.id));
  const zakazivanja = await db
    .select({ clanakId: savetiZakazivanja.clanakId, verzijaId: savetiZakazivanja.verzijaId, termin: savetiZakazivanja.termin, id: savetiZakazivanja.id })
    .from(savetiZakazivanja)
    .where(and(isNull(savetiZakazivanja.otkazano), isNull(savetiZakazivanja.izvrseno), ids ? inArray(savetiZakazivanja.clanakId, ids) : undefined));
  const by = <T extends { clanakId: string }>(rows: T[]) => {
    const m = new Map<string, T[]>();
    for (const r of rows) m.set(r.clanakId, [...(m.get(r.clanakId) ?? []), r]);
    return m;
  };
  return { clanci, verzije: by(verzije), dogadjaji: by(dogadjaji), zakazivanja: new Map(zakazivanja.map((z) => [z.clanakId, z])) };
}

function stanjeIz(all: Awaited<ReturnType<typeof ucitajSve>>, clanak: typeof savetiClanci.$inferSelect) {
  return stanjeClanka({
    clanak,
    verzije: all.verzije.get(clanak.id) ?? [],
    dogadjaji: (all.dogadjaji.get(clanak.id) ?? []) as never,
    zakazivanje: all.zakazivanja.get(clanak.id) ?? null,
  });
}

export type SpisakStavka = {
  id: string;
  slug: string;
  naslov: string;
  opis: string;
  tip: string;
  kategorija: string;
  kategorijaNaziv: string;
  status: string;
  radniStatus: string;
  imaIzmene: boolean;
  termin: string | null;
  strucnaPotvrda: boolean;
  javnoOd: string | null;
  izmenjeno: string | null;
  verzija: number;
  imaSliku: boolean;
};

export async function spisakClanaka(actor: Actor, filter: { pretraga?: string; status?: string; kategorija?: string } = {}) {
  need(actor, "view:clanci", "Članke vidi samo vlasnik.");
  await uskladiDospeleObjave();
  const db = getDb();
  const all = await ucitajSve(db);
  const trazi = (filter.pretraga ?? "").trim().toLowerCase();
  const rows: SpisakStavka[] = [];
  const brojac: Record<string, number> = {};
  for (const clanak of all.clanci) {
    const verzije = all.verzije.get(clanak.id) ?? [];
    const last = verzije[verzije.length - 1];
    if (!last) continue;
    const s = stanjeIz(all, clanak);
    for (const key of new Set([s.status, s.radniStatus])) brojac[key] = (brojac[key] ?? 0) + 1;
    if (filter.kategorija && clanak.kategorija !== filter.kategorija) continue;
    if (!odgovaraFilteru(s, filter.status || null)) continue;
    if (trazi && !`${last.naslov} ${clanak.slug} ${clanak.id} ${last.opis}`.toLowerCase().includes(trazi)) continue;
    rows.push({
      id: clanak.id,
      slug: clanak.slug,
      naslov: last.naslov,
      opis: last.opis,
      tip: clanak.tip,
      kategorija: clanak.kategorija,
      kategorijaNaziv: getSavetiKategorija(clanak.kategorija)?.naziv ?? clanak.kategorija,
      status: s.status,
      radniStatus: s.radniStatus,
      imaIzmene: s.imaIzmene,
      termin: s.termin,
      strucnaPotvrda: s.strucnaPotvrda.potrebna && !s.strucnaPotvrda.vazeca,
      javnoOd: clanak.javnoOd ? clanak.javnoOd.toISOString() : null,
      izmenjeno: last.napravljeno ? last.napravljeno.toISOString() : null,
      verzija: last.broj,
      imaSliku: Boolean(last.slikaId),
    });
  }
  rows.sort((a, b) => (b.izmenjeno ?? "").localeCompare(a.izmenjeno ?? "") || a.id.localeCompare(b.id));
  return { rows, brojac, ukupno: all.clanci.length };
}

export async function clanakZaUredjivanje(actor: Actor, id: string) {
  need(actor, "view:clanci", "Članke vidi samo vlasnik.");
  await uskladiDospeleObjave(new Date(), id);
  const db = getDb();
  const all = await ucitajSve(db, [id]);
  const clanak = all.clanci[0];
  if (!clanak) return null;
  const verzije = await db.select().from(savetiVerzije).where(eq(savetiVerzije.clanakId, id)).orderBy(asc(savetiVerzije.broj));
  const dogadjaji = await db.select().from(savetiDogadjaji).where(eq(savetiDogadjaji.clanakId, id)).orderBy(desc(savetiDogadjaji.id));
  const objave = await db.select().from(savetiObjave).where(eq(savetiObjave.clanakId, id)).orderBy(desc(savetiObjave.vreme));
  const stanje = stanjeIz(all, clanak);
  return { clanak, verzije, dogadjaji, objave, stanje };
}

/* ------------------------------------------------------------------ upis */

async function dogadjaj(tx: Tx, actor: Actor | null, clanakId: string, verzijaId: string | null, radnja: string, detalji: Record<string, unknown> = {}) {
  await tx.insert(savetiDogadjaji).values({
    clanakId,
    verzijaId,
    radnja,
    korisnik: actor?.id ?? null,
    korisnikIme: actor?.name ?? "Raspored objave",
    detalji,
  });
}

async function revizija(tx: Tx, actor: Actor, action: string, clanakId: string, label: string, after: Record<string, unknown>) {
  await recordAudit({ actor: { id: actor.id, name: actor.name, role: actor.role }, action, entityType: ENTITY, entityId: clanakId, entityLabel: label.slice(0, 160), after }, tx);
}

/**
 * Zaključava red članka za radnju. Termin koji je u međuvremenu prošao prvo se upisuje kao
 * objava, da radnja (npr. čuvanje koje otkazuje termin) ne bi poništila nešto što javnost već vidi.
 */
async function zakljucaj(tx: Tx, id: string) {
  const [row] = await tx.select().from(savetiClanci).where(eq(savetiClanci.id, id)).for("update");
  if (!row) throw new SavetiError("nema", "Članak ne postoji.");
  return (await upisiDospeluObjavu(tx, row, new Date())) ?? row;
}

/** Upis objave za termin članka koji je prošao (u transakciji, red već zaključan). */
async function upisiDospeluObjavu(tx: Tx, clanak: typeof savetiClanci.$inferSelect, sada: Date) {
  const [z] = await tx
    .select()
    .from(savetiZakazivanja)
    .where(and(eq(savetiZakazivanja.clanakId, clanak.id), isNull(savetiZakazivanja.otkazano), isNull(savetiZakazivanja.izvrseno), sql`${savetiZakazivanja.termin} <= ${sada.toISOString()}`));
  if (!z) return null;
  await tx.insert(savetiObjave).values({ termin: z.termin, zakazivanjeId: z.id, clanakId: clanak.id, verzijaId: z.verzijaId, ishod: clanak.javnaVerzijaId && !clanak.povuceno ? "objavljene_izmene" : "objavljeno", razlog: "odobrena verzija objavljena u zakazanom terminu", korisnik: z.zakazao });
  await tx.update(savetiZakazivanja).set({ izvrseno: sada }).where(eq(savetiZakazivanja.id, z.id));
  const [row] = await tx
    .update(savetiClanci)
    .set({ javnaVerzijaId: z.verzijaId, javnoOd: z.termin, prviPutObjavljeno: clanak.prviPutObjavljeno ?? z.termin, povuceno: null, povucenRazlog: null, povukao: null })
    .where(eq(savetiClanci.id, clanak.id))
    .returning();
  await dogadjaj(tx, null, clanak.id, z.verzijaId, "objavljeno", { termin: z.termin.toISOString() });
  await recordAudit({ actor: { name: "Objava u terminu", role: "system", kind: "system" }, action: AUDIT_ACTIONS.savetiObjavljeno, entityType: ENTITY, entityId: clanak.id, entityLabel: clanak.slug, after: { termin: z.termin.toISOString() } }, tx);
  return row;
}

/**
 * Upisuje objave za sve termine koji su prošli (ili za jedan članak). Bezbedno za ponavljanje:
 * zakazivanje dobija oznaku „izvršeno“ i jedinstven ključ dozvoljava jednu objavu po zakazivanju.
 */
export async function uskladiDospeleObjave(sada = new Date(), clanakId?: string): Promise<{ objavljeno: string[] }> {
  const db = getDb();
  const dospeli = await db
    .select({ clanakId: savetiZakazivanja.clanakId })
    .from(savetiZakazivanja)
    .where(and(isNull(savetiZakazivanja.otkazano), isNull(savetiZakazivanja.izvrseno), sql`${savetiZakazivanja.termin} <= ${sada.toISOString()}`, clanakId ? eq(savetiZakazivanja.clanakId, clanakId) : undefined));
  const objavljeno: string[] = [];
  for (const { clanakId: id } of dospeli) {
    const upisano = await db.transaction(async (tx) => {
      const [row] = await tx.select().from(savetiClanci).where(eq(savetiClanci.id, id)).for("update");
      return row ? upisiDospeluObjavu(tx, row, sada) : null;
    });
    if (upisano) objavljeno.push(upisano.slug);
  }
  return { objavljeno };
}

async function verzijeClanka(tx: Tx, id: string) {
  return tx.select().from(savetiVerzije).where(eq(savetiVerzije.clanakId, id)).orderBy(asc(savetiVerzije.broj));
}

async function dogadjajiClanka(tx: Tx, id: string) {
  return tx
    .select({ verzijaId: savetiDogadjaji.verzijaId, radnja: savetiDogadjaji.radnja, vreme: savetiDogadjaji.vreme, detalji: savetiDogadjaji.detalji })
    .from(savetiDogadjaji)
    .where(eq(savetiDogadjaji.clanakId, id))
    .orderBy(asc(savetiDogadjaji.id));
}

async function aktivnoZakazivanje(tx: Tx, id: string) {
  const [z] = await tx
    .select()
    .from(savetiZakazivanja)
    .where(and(eq(savetiZakazivanja.clanakId, id), isNull(savetiZakazivanja.otkazano), isNull(savetiZakazivanja.izvrseno)));
  return z ?? null;
}

async function stanjeU(tx: Tx, clanak: typeof savetiClanci.$inferSelect) {
  const verzije = await verzijeClanka(tx, clanak.id);
  const dogadjaji = await dogadjajiClanka(tx, clanak.id);
  const z = await aktivnoZakazivanje(tx, clanak.id);
  return { verzije, z, stanje: stanjeClanka({ clanak, verzije, dogadjaji: dogadjaji as never, zakazivanje: z }) };
}

async function sledeciId(tx: Tx) {
  const rows = await tx.select({ id: savetiClanci.id }).from(savetiClanci);
  const max = rows.reduce((m, r) => Math.max(m, Number(r.id.slice(3)) || 0), 0);
  return `SV-${String(max + 1).padStart(4, "0")}`;
}

async function slobodanSlug(tx: Tx, osnova: string, osimId?: string) {
  const base = ispravanSlug(osnova) ? osnova : "clanak";
  for (let i = 0; i < 50; i += 1) {
    const slug = i === 0 ? base : `${base}-${i + 1}`;
    const [c] = await tx.select({ id: savetiClanci.id }).from(savetiClanci).where(eq(savetiClanci.slug, slug));
    const [a] = await tx.select({ id: savetiAdrese.clanakId }).from(savetiAdrese).where(eq(savetiAdrese.slug, slug));
    if ((!c || c.id === osimId) && (!a || a.id === osimId)) return slug;
  }
  throw new SavetiError("adresa", "Nije pronađena slobodna adresa za članak.");
}

export async function napraviClanak(actor: Actor, input: VerzijaUnos & { tip: string; kategorija: string }) {
  need(actor, "articles:edit", "Članke uređuje samo vlasnik.");
  if (!TIPOVI.includes(input.tip as (typeof TIPOVI)[number])) throw new SavetiError("tip", "Izaberite vrstu članka.");
  if (!SAVETI_KATEGORIJE.some((k: { slug: string }) => k.slug === input.kategorija)) throw new SavetiError("kategorija", "Izaberite temu.");
  const unos = proveriUnos(input);
  return getDb().transaction(async (tx) => {
    const id = await sledeciId(tx);
    const slug = await slobodanSlug(tx, slugIzNaslova(unos.naslov));
    await tx.insert(savetiClanci).values({ id, slug, tip: input.tip, kategorija: input.kategorija, napravio: actor.id });
    const podaci = { podtema: "", publika: [], glavnoPitanje: "", dodatnaPitanja: [], brendovi: [], proizvodi: [], povezani: [] };
    const sadrzaj = { ...unos, podaci };
    const [v] = await tx
      .insert(savetiVerzije)
      .values({ clanakId: id, broj: 1, naslov: unos.naslov, metaNaslov: unos.metaNaslov, opis: unos.opis, telo: unos.telo, izvori: unos.izvori, podaci, interneNapomene: unos.interneNapomene, nepotvrdjeno: unos.nepotvrdjeno, slikaId: unos.slikaId, slikaAlt: unos.slikaAlt, otisak: otisakSadrzaja(sadrzaj), poreklo: "panel", napravio: actor.id })
      .returning({ id: savetiVerzije.id });
    await dogadjaj(tx, actor, id, v.id, "sacuvano", { broj: 1, novi: true });
    await revizija(tx, actor, AUDIT_ACTIONS.savetiSacuvano, id, unos.naslov, { verzija: 1, novi: true });
    return { id };
  });
}

/**
 * Čuvanje = nova verzija. `osnova` je broj verzije koju je urednik otvorio; ako je u međuvremenu
 * sačuvana novija, čuvanje se odbija (bez tihog gaženja tuđe izmene).
 */
export async function sacuvajVerziju(actor: Actor, id: string, input: VerzijaUnos & { osnova: number; novaAdresa?: string | null }) {
  need(actor, "articles:edit", "Članke uređuje samo vlasnik.");
  const unos = proveriUnos(input);
  return getDb().transaction(async (tx) => {
    const clanak = await zakljucaj(tx, id);
    const { verzije, z } = await stanjeU(tx, clanak);
    const last = verzije[verzije.length - 1];
    if (last && last.broj !== input.osnova) {
      throw new SavetiError("sukob", `Članak je u međuvremenu sačuvan kao verzija ${last.broj}. Otvorite ga ponovo pa unesite izmene.`);
    }
    const podaci = (last?.podaci as Record<string, unknown>) ?? {};
    const sadrzaj = { ...unos, podaci };
    const otisak = otisakSadrzaja(sadrzaj);
    const broj = (last?.broj ?? 0) + 1;
    const [v] = await tx
      .insert(savetiVerzije)
      .values({ clanakId: id, broj, naslov: unos.naslov, metaNaslov: unos.metaNaslov, opis: unos.opis, telo: unos.telo, izvori: unos.izvori, podaci, interneNapomene: unos.interneNapomene, nepotvrdjeno: unos.nepotvrdjeno, slikaId: unos.slikaId, slikaAlt: unos.slikaAlt, otisak, poreklo: "panel", napravio: actor.id })
      .returning({ id: savetiVerzije.id });
    const promenaSadrzaja = !last || last.otisak !== otisak;
    await dogadjaj(tx, actor, id, v.id, "sacuvano", { broj, promenaSadrzaja });
    // Izmena sadržaja zakazanog članka: zakazivanje se otkazuje (nova verzija traži novo odobrenje).
    if (promenaSadrzaja && z) {
      await tx.update(savetiZakazivanja).set({ otkazano: new Date(), otkazao: actor.id }).where(eq(savetiZakazivanja.id, z.id));
      await dogadjaj(tx, actor, id, z.verzijaId, "otkazano_zakazivanje", { termin: z.termin.toISOString(), razlog: "izmena sadržaja posle odobrenja" });
    }
    if (input.novaAdresa && input.novaAdresa !== clanak.slug) {
      await promeniAdresuU(tx, actor, clanak, input.novaAdresa);
    }
    await revizija(tx, actor, AUDIT_ACTIONS.savetiSacuvano, id, unos.naslov, { verzija: broj, promenaSadrzaja, odobrenjePonisteno: promenaSadrzaja && Boolean(last) });
    return { id, broj, promenaSadrzaja };
  });
}

/** Adresa se menja SAMO izričito; stara ostaje kao preusmerenje. */
async function promeniAdresuU(tx: Tx, actor: Actor, clanak: typeof savetiClanci.$inferSelect, nova: string) {
  if (!ispravanSlug(nova)) throw new SavetiError("adresa", "Adresa sme imati samo mala slova bez kvačica, brojeve i crtice.");
  const slobodna = await slobodanSlug(tx, nova, clanak.id);
  if (slobodna !== nova) throw new SavetiError("adresa", `Adresa „${nova}“ je zauzeta.`);
  await tx.insert(savetiAdrese).values({ slug: clanak.slug, clanakId: clanak.id }).onConflictDoNothing();
  await tx.update(savetiClanci).set({ slug: nova }).where(eq(savetiClanci.id, clanak.id));
  await dogadjaj(tx, actor, clanak.id, null, "promenjena_adresa", { od: clanak.slug, na: nova });
}

export async function posaljiNaPregled(actor: Actor, id: string) {
  need(actor, "articles:edit", "Članke uređuje samo vlasnik.");
  return getDb().transaction(async (tx) => {
    const clanak = await zakljucaj(tx, id);
    const { verzije, stanje } = await stanjeU(tx, clanak);
    const last = verzije[verzije.length - 1];
    if (!last) throw new SavetiError("nema", "Članak nema sačuvanu verziju.");
    if (stanje.radniStatus !== "nacrt") throw new SavetiError("stanje", "Na pregled se šalje samo nacrt.");
    await dogadjaj(tx, actor, id, last.id, "poslato_na_pregled", { broj: last.broj });
    await revizija(tx, actor, AUDIT_ACTIONS.savetiNaPregled, id, last.naslov, { verzija: last.broj });
  });
}

export async function vratiNaDoradu(actor: Actor, id: string, napomena: string) {
  need(actor, "articles:approve", "Na doradu vraća samo vlasnik.");
  return getDb().transaction(async (tx) => {
    const clanak = await zakljucaj(tx, id);
    const { verzije, stanje, z } = await stanjeU(tx, clanak);
    const last = verzije[verzije.length - 1];
    if (!last || !["za_pregled", "odobren", "zakazan"].includes(stanje.radniStatus)) throw new SavetiError("stanje", "Na doradu se vraća članak koji je na pregledu ili odobren.");
    if (z) {
      await tx.update(savetiZakazivanja).set({ otkazano: new Date(), otkazao: actor.id }).where(eq(savetiZakazivanja.id, z.id));
      await dogadjaj(tx, actor, id, z.verzijaId, "otkazano_zakazivanje", { termin: z.termin.toISOString(), razlog: "vraćeno na doradu" });
    }
    await dogadjaj(tx, actor, id, last.id, "vraceno_na_doradu", { broj: last.broj, napomena: napomena.slice(0, 1000) });
    await revizija(tx, actor, AUDIT_ACTIONS.savetiNaDoradu, id, last.naslov, { verzija: last.broj });
  });
}

/** Odobrenje važi za tačno poslednju verziju (proverava se i otisak koji je vlasnik video). */
export async function odobri(actor: Actor, id: string, verzijaBroj: number) {
  need(actor, "articles:approve", "Članke odobrava samo vlasnik.");
  return getDb().transaction(async (tx) => {
    const clanak = await zakljucaj(tx, id);
    const { verzije, stanje } = await stanjeU(tx, clanak);
    const last = verzije[verzije.length - 1];
    if (!last) throw new SavetiError("nema", "Članak nema sačuvanu verziju.");
    if (last.broj !== verzijaBroj) throw new SavetiError("sukob", `Pregledali ste verziju ${verzijaBroj}, a poslednja je ${last.broj}. Pogledajte izmene pa odobrite ponovo.`);
    if (stanje.odobrenje) throw new SavetiError("stanje", "Ova verzija je već odobrena.");
    if (stanje.javno && !stanje.imaIzmene) throw new SavetiError("stanje", "Javni tekst je isti kao ova verzija; nema šta da se odobri.");
    // Odobrenje vlasnika ne zamenjuje stručnu potvrdu (i obrnuto).
    if (stanje.strucnaPotvrda.potrebna && !stanje.strucnaPotvrda.vazeca) {
      throw new SavetiError("strucna-potvrda", "Ovaj tekst traži stručnu potvrdu. Prvo upišite potvrdu stručnjaka za ovu verziju, pa je odobrite.");
    }
    await dogadjaj(tx, actor, id, last.id, "odobreno", { broj: last.broj, otisak: last.otisak });
    await revizija(tx, actor, AUDIT_ACTIONS.savetiOdobreno, id, last.naslov, { verzija: last.broj, otisak: last.otisak });
  });
}

/**
 * Zakazivanje odobrene verzije za trenutak koji vlasnik izabere (datum i vreme po vremenu Srbije).
 * Važi i za izmene objavljenog članka i za ponovnu objavu povučenog: do termina javnost vidi
 * dosadašnju javnu verziju (ili ništa, ako je povučen).
 */
export async function zakazi(actor: Actor, id: string, unos: { datum: string; vreme: string }) {
  need(actor, "articles:publish", "Članke zakazuje samo vlasnik.");
  const sada = new Date();
  const t = terminIzUnosa(unos.datum, unos.vreme, sada);
  if (!t.ok) throw new SavetiError("termin", t.razlog);
  return getDb().transaction(async (tx) => {
    const clanak = await zakljucaj(tx, id);
    const { verzije, stanje, z } = await stanjeU(tx, clanak);
    const last = verzije[verzije.length - 1];
    if (!last || !stanje.odobrenje) throw new SavetiError("stanje", "Zakazuje se samo odobrena verzija.");
    if (stanje.javno && !stanje.imaIzmene) throw new SavetiError("stanje", "Ova verzija je već javna.");
    if (z) throw new SavetiError("stanje", "Članak je već zakazan; prvo otkažite termin.");
    await tx.insert(savetiZakazivanja).values({ verzijaId: last.id, clanakId: id, termin: t.termin, zakazao: actor.id });
    await dogadjaj(tx, actor, id, last.id, "zakazano", { broj: last.broj, termin: t.termin.toISOString() });
    await revizija(tx, actor, AUDIT_ACTIONS.savetiZakazano, id, last.naslov, { verzija: last.broj, termin: t.termin.toISOString() });
    return { termin: t.termin.toISOString(), slug: clanak.slug };
  });
}

export async function otkaziZakazivanje(actor: Actor, id: string) {
  need(actor, "articles:publish", "Termine menja samo vlasnik.");
  return getDb().transaction(async (tx) => {
    await zakljucaj(tx, id);
    const z = await aktivnoZakazivanje(tx, id);
    if (!z) throw new SavetiError("stanje", "Članak nije zakazan.");
    await tx.update(savetiZakazivanja).set({ otkazano: new Date(), otkazao: actor.id }).where(eq(savetiZakazivanja.id, z.id));
    await dogadjaj(tx, actor, id, z.verzijaId, "otkazano_zakazivanje", { termin: z.termin.toISOString(), razlog: "otkazao vlasnik" });
    await revizija(tx, actor, AUDIT_ACTIONS.savetiOtkazanTermin, id, id, { termin: z.termin.toISOString() });
  });
}

/**
 * Odobrena poslednja verzija postaje javna odmah: prva objava, objava izmena ili ponovna objava
 * povučenog članka. Termin koji čeka se otkazuje (objava ga je zamenila).
 */
export async function objaviOdmah(actor: Actor, id: string, verzijaBroj: number) {
  need(actor, "articles:publish", "Članke objavljuje samo vlasnik.");
  return getDb().transaction(async (tx) => {
    const clanak = await zakljucaj(tx, id);
    const { verzije, stanje, z } = await stanjeU(tx, clanak);
    const last = verzije[verzije.length - 1];
    if (!last || last.broj !== verzijaBroj) throw new SavetiError("sukob", "U međuvremenu je sačuvana novija verzija. Pogledajte je pa objavite.");
    if (!stanje.odobrenje) throw new SavetiError("stanje", "Objavljuje se samo odobrena verzija.");
    if (stanje.javno && !stanje.imaIzmene) throw new SavetiError("stanje", "Ova verzija je već javna.");
    const sada = new Date();
    if (z) {
      await tx.update(savetiZakazivanja).set({ otkazano: sada, otkazao: actor.id }).where(eq(savetiZakazivanja.id, z.id));
      await dogadjaj(tx, actor, id, z.verzijaId, "otkazano_zakazivanje", { termin: z.termin.toISOString(), razlog: "objavljeno odmah" });
    }
    const izmene = stanje.javno;
    await tx.insert(savetiObjave).values({ termin: null, clanakId: id, verzijaId: last.id, ishod: izmene ? "objavljene_izmene" : "objavljeno", razlog: "objavio vlasnik", korisnik: actor.id });
    await tx
      .update(savetiClanci)
      .set({ javnaVerzijaId: last.id, javnoOd: sada, prviPutObjavljeno: clanak.prviPutObjavljeno ?? sada, povuceno: null, povucenRazlog: null, povukao: null })
      .where(eq(savetiClanci.id, id));
    await dogadjaj(tx, actor, id, last.id, izmene ? "objavljene_izmene" : "objavljeno", { broj: last.broj, prethodna: clanak.javnaVerzijaId, odmah: true });
    await revizija(tx, actor, izmene ? AUDIT_ACTIONS.savetiObjavljeneIzmene : AUDIT_ACTIONS.savetiObjavljeno, id, last.naslov, { verzija: last.broj, odmah: true });
    return { slug: clanak.slug };
  });
}

export async function povuci(actor: Actor, id: string, razlog: string) {
  need(actor, "articles:publish", "Članak povlači samo vlasnik.");
  const r = razlog.trim();
  if (!r) throw new SavetiError("razlog", "Upišite razlog povlačenja.");
  return getDb().transaction(async (tx) => {
    const clanak = await zakljucaj(tx, id);
    const { stanje } = await stanjeU(tx, clanak);
    if (!stanje.javno) throw new SavetiError("stanje", clanak.povuceno ? "Članak je već povučen." : "Članak nije javan.");
    const z = await aktivnoZakazivanje(tx, id);
    if (z) {
      await tx.update(savetiZakazivanja).set({ otkazano: new Date(), otkazao: actor.id }).where(eq(savetiZakazivanja.id, z.id));
      await dogadjaj(tx, actor, id, z.verzijaId, "otkazano_zakazivanje", { termin: z.termin.toISOString(), razlog: "povlačenje" });
    }
    await tx.update(savetiClanci).set({ povuceno: new Date(), povucenRazlog: r.slice(0, 500), povukao: actor.id }).where(eq(savetiClanci.id, id));
    await dogadjaj(tx, actor, id, clanak.javnaVerzijaId, "povuceno", { razlog: r.slice(0, 500) });
    await revizija(tx, actor, AUDIT_ACTIONS.savetiPovuceno, id, clanak.slug, { razlog: r.slice(0, 500) });
    return { slug: clanak.slug };
  });
}

/** Vraćanje prethodne verzije = nova verzija sa njenim sadržajem (i ona traži odobrenje). */
export async function vratiVerziju(actor: Actor, id: string, broj: number, osnova: number) {
  need(actor, "articles:edit", "Članke uređuje samo vlasnik.");
  return getDb().transaction(async (tx) => {
    const clanak = await zakljucaj(tx, id);
    const { verzije, z } = await stanjeU(tx, clanak);
    const last = verzije[verzije.length - 1];
    if (!last || last.broj !== osnova) throw new SavetiError("sukob", "U međuvremenu je sačuvana novija verzija.");
    const izvor = verzije.find((v) => v.broj === broj);
    if (!izvor) throw new SavetiError("nema", "Ta verzija ne postoji.");
    if (izvor.broj === last.broj) throw new SavetiError("stanje", "To je već poslednja verzija.");
    const novi = last.broj + 1;
    const [v] = await tx
      .insert(savetiVerzije)
      .values({ clanakId: id, broj: novi, naslov: izvor.naslov, metaNaslov: izvor.metaNaslov, opis: izvor.opis, telo: izvor.telo, izvori: izvor.izvori, podaci: izvor.podaci, interneNapomene: izvor.interneNapomene, nepotvrdjeno: izvor.nepotvrdjeno, slikaId: izvor.slikaId, slikaAlt: izvor.slikaAlt, otisak: izvor.otisak, poreklo: `vracanje:${izvor.broj}`, napravio: actor.id })
      .returning({ id: savetiVerzije.id });
    if (z && izvor.otisak !== last.otisak) {
      await tx.update(savetiZakazivanja).set({ otkazano: new Date(), otkazao: actor.id }).where(eq(savetiZakazivanja.id, z.id));
      await dogadjaj(tx, actor, id, z.verzijaId, "otkazano_zakazivanje", { termin: z.termin.toISOString(), razlog: "vraćena ranija verzija" });
    }
    await dogadjaj(tx, actor, id, v.id, "vracena_verzija", { broj: novi, iz: izvor.broj });
    await revizija(tx, actor, AUDIT_ACTIONS.savetiVracenaVerzija, id, izvor.naslov, { verzija: novi, iz: izvor.broj });
    return { broj: novi };
  });
}

/* ------------------------------------------------------------------ stručna potvrda */

/**
 * Upis stručne potvrde za poslednju verziju. Potvrdu daje imenovani stručnjak (ne urednička
 * provera i ne odobrenje vlasnika); važi samo za isti sadržaj i poništava je svaka izmena teksta.
 */
export async function zabeleziStrucnuPotvrdu(
  actor: Actor,
  id: string,
  unos: { verzijaBroj: number; strucnjak: string; uloga: string; datum: string; obuhvat: string },
) {
  need(actor, "articles:approve", "Stručnu potvrdu upisuje samo vlasnik.");
  const strucnjak = unos.strucnjak.trim();
  const uloga = unos.uloga.trim();
  const obuhvat = unos.obuhvat.trim();
  if (!strucnjak) throw new SavetiError("strucna-potvrda", "Unesite ime stručnjaka koji je potvrdio tekst.");
  const neprihvatljiv = razlogNeprihvatljivogPotpisnika(strucnjak);
  if (neprihvatljiv) throw new SavetiError("strucna-potvrda", neprihvatljiv);
  if (!uloga) throw new SavetiError("strucna-potvrda", "Unesite stručnost ili funkciju stručnjaka.");
  if (!obuhvat) throw new SavetiError("strucna-potvrda", "Upišite šta je stručnjak potvrdio.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(unos.datum)) throw new SavetiError("strucna-potvrda", "Unesite datum potvrde.");
  if (unos.datum > new Date().toISOString().slice(0, 10)) throw new SavetiError("strucna-potvrda", "Datum potvrde ne može biti u budućnosti.");
  return getDb().transaction(async (tx) => {
    const clanak = await zakljucaj(tx, id);
    const { verzije, stanje } = await stanjeU(tx, clanak);
    const last = verzije[verzije.length - 1];
    if (!clanak.strucnaPotvrdaPotrebna) throw new SavetiError("stanje", "Ovaj tekst nije označen kao tekst koji traži stručnu potvrdu.");
    if (!last || last.broj !== unos.verzijaBroj) throw new SavetiError("sukob", "U međuvremenu je sačuvana novija verzija. Potvrda se upisuje za verziju koju je stručnjak pregledao.");
    if (stanje.strucnaPotvrda.vazeca) throw new SavetiError("stanje", "Za ovu verziju je stručna potvrda već upisana.");
    const detalji = { broj: last.broj, otisak: last.otisak, strucnjak: strucnjak.slice(0, 160), uloga: uloga.slice(0, 160), datum: unos.datum, obuhvat: obuhvat.slice(0, 1000) };
    await dogadjaj(tx, actor, id, last.id, "strucno_potvrdjeno", detalji);
    await revizija(tx, actor, AUDIT_ACTIONS.savetiStrucnaPotvrda, id, last.naslov, detalji);
  });
}

/** Označava da tekst traži stručnu potvrdu. Oznaka se ne uklanja (okidač u bazi), samo ispunjava. */
export async function oznaciZaStrucnuPotvrdu(actor: Actor, id: string, razlog: string) {
  need(actor, "articles:edit", "Članke uređuje samo vlasnik.");
  const r = razlog.trim();
  if (!r) throw new SavetiError("strucna-potvrda", "Upišite šta stručnjak treba da potvrdi.");
  return getDb().transaction(async (tx) => {
    const clanak = await zakljucaj(tx, id);
    if (clanak.strucnaPotvrdaPotrebna) throw new SavetiError("stanje", "Tekst je već označen kao tekst koji traži stručnu potvrdu.");
    await tx.update(savetiClanci).set({ strucnaPotvrdaPotrebna: true, strucnaPotvrdaRazlog: r.slice(0, 2000) }).where(eq(savetiClanci.id, id));
    const z = await aktivnoZakazivanje(tx, id);
    if (z) {
      await tx.update(savetiZakazivanja).set({ otkazano: new Date(), otkazao: actor.id }).where(eq(savetiZakazivanja.id, z.id));
      await dogadjaj(tx, actor, id, z.verzijaId, "otkazano_zakazivanje", { termin: z.termin.toISOString(), razlog: "tekst traži stručnu potvrdu" });
    }
    await dogadjaj(tx, actor, id, null, "oznaceno_za_strucnu_potvrdu", { razlog: r.slice(0, 2000) });
    await revizija(tx, actor, AUDIT_ACTIONS.savetiStrucnaPotvrda, id, clanak.slug, { oznaceno: true });
  });
}

/* ------------------------------------------------------------------ slike */

export const MAX_SLIKA_ULAZ = 8 * 1024 * 1024;
const MAX_SLIKA_IZLAZ = 2 * 1024 * 1024;

function vrstaSlike(b: Uint8Array): "jpeg" | "png" | "webp" | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (b.length > 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return "webp";
  return null;
}

/**
 * Naslovna slika: provera stvarnog tipa (potpis fajla, ne ime ni deklarisani tip), veličine i
 * dimenzija; čuva se kao WebP do 2000 px širine, bez EXIF/GPS podataka.
 */
export async function otpremiSliku(actor: Actor, file: { name: string; bytes: Uint8Array }) {
  need(actor, "articles:edit", "Slike otprema samo vlasnik.");
  if (file.bytes.length === 0) throw new SavetiError("slika", "Fajl je prazan.");
  if (file.bytes.length > MAX_SLIKA_ULAZ) throw new SavetiError("slika", "Slika je veća od 8 MB.");
  const vrsta = vrstaSlike(file.bytes);
  if (!vrsta) throw new SavetiError("slika", "Dozvoljene su JPG, PNG i WebP slike.");
  const sharp = (await import("sharp")).default;
  let meta;
  try {
    meta = await sharp(file.bytes, { limitInputPixels: 40_000_000 }).metadata();
  } catch {
    throw new SavetiError("slika", "Slika je oštećena ili nije podržana.");
  }
  if (!meta.width || !meta.height) throw new SavetiError("slika", "Slika nema čitljive dimenzije.");
  if (meta.width < 600 || meta.height < 300) throw new SavetiError("slika", "Slika je premala (najmanje 600 × 300 px).");
  const out = await sharp(file.bytes, { limitInputPixels: 40_000_000 }).rotate().resize({ width: 2000, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
  if (out.data.length > MAX_SLIKA_IZLAZ) throw new SavetiError("slika", "Slika je i posle sažimanja veća od 2 MB.");
  const sha = createHash("sha256").update(out.data).digest("hex");
  const db = getDb();
  const [postoji] = await db.select({ id: savetiSlike.id, sirina: savetiSlike.sirina, visina: savetiSlike.visina }).from(savetiSlike).where(eq(savetiSlike.sha256, sha));
  if (postoji) return postoji;
  const [row] = await db
    .insert(savetiSlike)
    .values({ sha256: sha, mime: "image/webp", sirina: out.info.width, visina: out.info.height, bajtova: out.data.length, sadrzaj: out.data, izvornoIme: file.name.replace(/[\\/\u0000-\u001f]/g, "_").slice(0, 160), napravio: actor.id })
    .onConflictDoNothing()
    .returning({ id: savetiSlike.id, sirina: savetiSlike.sirina, visina: savetiSlike.visina });
  if (row) return row;
  const [again] = await db.select({ id: savetiSlike.id, sirina: savetiSlike.sirina, visina: savetiSlike.visina }).from(savetiSlike).where(eq(savetiSlike.sha256, sha));
  return again;
}

/** Bajtovi slike: javno samo ako je slika u javnoj verziji nekog nepovučenog članka. */
export async function slikaZaPrikaz(id: string, smeNacrte: boolean) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const db = getDb();
  if (!smeNacrte) {
    // Javna je slika objavljene verzije ili verzije čiji je termin prošao (isto pravilo kao javni upit).
    const javna = await db
      .select({ id: savetiVerzije.id })
      .from(savetiVerzije)
      .where(
        and(
          eq(savetiVerzije.slikaId, id),
          sql`(EXISTS (SELECT 1 FROM ${savetiClanci} c WHERE c.javna_verzija_id = ${savetiVerzije.id} AND c.povuceno IS NULL)
            OR EXISTS (SELECT 1 FROM ${savetiZakazivanja} z WHERE z.verzija_id = ${savetiVerzije.id} AND z.otkazano IS NULL AND z.izvrseno IS NULL AND z.termin <= now()))`,
        ),
      )
      .limit(1);
    if (!javna.length) return null;
  }
  const [row] = await db.select({ sadrzaj: savetiSlike.sadrzaj, mime: savetiSlike.mime, sha256: savetiSlike.sha256 }).from(savetiSlike).where(eq(savetiSlike.id, id));
  return row ?? null;
}

/* ------------------------------------------------------------------ pomoćno za prikaz */

export async function imenaKorisnika(ids: string[]) {
  if (!ids.length) return new Map<string, string>();
  const rows = await getDb().select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, ids));
  return new Map(rows.map((r) => [r.id, r.name]));
}

export type { VerzijaRed, DogadjajRed };
