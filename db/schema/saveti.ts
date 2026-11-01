import { bigserial, boolean, customType, index, integer, jsonb, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

/*
 * „Saveti i vodiči“ — uređivanje u poslovnom panelu (migracija 0058).
 * Verzije, događaji, objave i slike se samo dodaju (okidači u bazi). Vidi lib/saveti/urednik.
 */

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

export const savetiSlike = pgTable(
  "saveti_slike",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sha256: text("sha256").notNull(),
    mime: text("mime").notNull(),
    sirina: integer("sirina").notNull(),
    visina: integer("visina").notNull(),
    bajtova: integer("bajtova").notNull(),
    sadrzaj: bytea("sadrzaj").notNull(),
    izvornoIme: text("izvorno_ime"),
    napravio: uuid("napravio").notNull().references(() => users.id, { onDelete: "restrict" }),
    napravljeno: timestamp("napravljeno", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("saveti_slike_sha_key").on(t.sha256)],
);

export const savetiClanci = pgTable(
  "saveti_clanci",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    tip: text("tip").notNull(),
    kategorija: text("kategorija").notNull(),
    napravio: uuid("napravio").references(() => users.id, { onDelete: "restrict" }),
    napravljeno: timestamp("napravljeno", { withTimezone: true }).notNull().defaultNow(),
    /** Verzija koju vidi javnost (null = nikad objavljen). FK u migraciji. */
    javnaVerzijaId: uuid("javna_verzija_id"),
    prviPutObjavljeno: timestamp("prvi_put_objavljeno", { withTimezone: true }),
    /** Trenutak od kog važi javna verzija (poslednja objava ili objava izmena). */
    javnoOd: timestamp("javno_od", { withTimezone: true }),
    povuceno: timestamp("povuceno", { withTimezone: true }),
    povucenRazlog: text("povucen_razlog"),
    povukao: uuid("povukao").references(() => users.id, { onDelete: "restrict" }),
    /** Tekst traži potvrdu stručnjaka pre odobrenja; zahtev se ne uklanja (okidač), samo ispunjava. */
    strucnaPotvrdaPotrebna: boolean("strucna_potvrda_potrebna").notNull().default(false),
    strucnaPotvrdaRazlog: text("strucna_potvrda_razlog").notNull().default(""),
  },
  (t) => [unique("saveti_clanci_slug_key").on(t.slug)],
);

export const savetiVerzije = pgTable(
  "saveti_verzije",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clanakId: text("clanak_id").notNull().references(() => savetiClanci.id, { onDelete: "restrict" }),
    broj: integer("broj").notNull(),
    naslov: text("naslov").notNull(),
    metaNaslov: text("meta_naslov").notNull().default(""),
    opis: text("opis").notNull(),
    /** Telo članka u Markdown podskupu rubrike (lib/saveti/markdown.mjs). */
    telo: text("telo").notNull(),
    izvori: jsonb("izvori").notNull().default([]),
    /** Ostali podaci zapisa (podtema, pitanja, brendovi, proizvodi, povezani, novost…). */
    podaci: jsonb("podaci").notNull().default({}),
    interneNapomene: text("interne_napomene").notNull().default(""),
    /** Tvrdnje koje još nisu tehnički potvrđene — nikad u javnom prikazu. */
    nepotvrdjeno: text("nepotvrdjeno").notNull().default(""),
    slikaId: uuid("slika_id").references(() => savetiSlike.id, { onDelete: "restrict" }),
    slikaAlt: text("slika_alt").notNull().default(""),
    otisak: text("otisak").notNull(),
    poreklo: text("poreklo").notNull(),
    napravio: uuid("napravio").references(() => users.id, { onDelete: "restrict" }),
    napravljeno: timestamp("napravljeno", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("saveti_verzije_broj_key").on(t.clanakId, t.broj)],
);

export const savetiDogadjaji = pgTable(
  "saveti_dogadjaji",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    clanakId: text("clanak_id").notNull().references(() => savetiClanci.id, { onDelete: "restrict" }),
    verzijaId: uuid("verzija_id").references(() => savetiVerzije.id, { onDelete: "restrict" }),
    radnja: text("radnja").notNull(),
    korisnik: uuid("korisnik").references(() => users.id, { onDelete: "restrict" }),
    korisnikIme: text("korisnik_ime"),
    vreme: timestamp("vreme", { withTimezone: true }).notNull().defaultNow(),
    detalji: jsonb("detalji").notNull().default({}),
  },
  (t) => [index("saveti_dogadjaji_clanak_idx").on(t.clanakId, t.vreme)],
);

export const savetiZakazivanja = pgTable("saveti_zakazivanja", {
  id: uuid("id").primaryKey().defaultRandom(),
  verzijaId: uuid("verzija_id").notNull().references(() => savetiVerzije.id, { onDelete: "restrict" }),
  clanakId: text("clanak_id").notNull().references(() => savetiClanci.id, { onDelete: "restrict" }),
  termin: timestamp("termin", { withTimezone: true }).notNull(),
  zakazao: uuid("zakazao").references(() => users.id, { onDelete: "restrict" }),
  zakazano: timestamp("zakazano", { withTimezone: true }).notNull().defaultNow(),
  otkazano: timestamp("otkazano", { withTimezone: true }),
  otkazao: uuid("otkazao").references(() => users.id, { onDelete: "restrict" }),
  /** Objava je upisana (javna verzija postavljena); javnost je članak videla već od `termin`. */
  izvrseno: timestamp("izvrseno", { withTimezone: true }),
});

export const savetiObjave = pgTable("saveti_objave", {
  id: uuid("id").primaryKey().defaultRandom(),
  termin: timestamp("termin", { withTimezone: true }),
  zakazivanjeId: uuid("zakazivanje_id").references(() => savetiZakazivanja.id, { onDelete: "restrict" }),
  clanakId: text("clanak_id").references(() => savetiClanci.id, { onDelete: "restrict" }),
  verzijaId: uuid("verzija_id").references(() => savetiVerzije.id, { onDelete: "restrict" }),
  ishod: text("ishod").notNull(),
  razlog: text("razlog").notNull(),
  korisnik: uuid("korisnik").references(() => users.id, { onDelete: "restrict" }),
  vreme: timestamp("vreme", { withTimezone: true }).notNull().defaultNow(),
});

export const savetiAdrese = pgTable("saveti_adrese", {
  slug: text("slug").primaryKey(),
  clanakId: text("clanak_id").notNull().references(() => savetiClanci.id, { onDelete: "restrict" }),
  do: timestamp("do", { withTimezone: true }).notNull().defaultNow(),
});
