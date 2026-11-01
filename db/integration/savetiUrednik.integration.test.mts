import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import sharp from "sharp";
import { cleanupQa, closeTestDatabase, ensureTestCryptoEnv, initTestDatabase, seedAccounts, skipReason, type TestDatabase } from "./harness.mts";

/**
 * „Saveti i vodiči“ — urednik u panelu (0058; zahtevi vlasnika 15. 10. i 1. 11. 2026).
 *
 * Ceo tok: nacrt → dorada → pregled → odobrenje → zakazivanje (datum i vreme po vremenu Srbije) →
 * javno od termina (bez zakazanog posla) → upis objave bez duplikata → izmena objavljenog (javna
 * ostaje stara verzija do novog odobrenja) → povlačenje i ponovna objava; stručna potvrda kao
 * zaseban uslov; zabrana drugim ulogama; slike; verzije i događaji se samo dodaju.
 */
const reason = skipReason();
const guard = (t: { skip: (m?: string) => void }) => (reason ? (t.skip(reason), true) : false);

let db: TestDatabase;
type Acc = { id: string; name: string; role: string };
let owner: Acc;
let office: Acc;
let rep: Acc;
const asUser = (a: Acc) => ({ id: a.id, email: `${a.id}@qa-saveti.invalid`, name: a.name, initials: "QA", role: a.role as "gazda" | "kancelarija" | "komercijalista", active: true, sessionVersion: 0, permissions: [] as string[] });

const IZVOR = { id: "tds", naziv: "Sintetički tehnički list", url: "https://example.com/tds.pdf", pristupljeno: "2026-10-15", tip: "tehnicki-list" };
const unos = (patch: Record<string, unknown> = {}) => ({
  naslov: "Kako se nanosi sintetički prajmer",
  metaNaslov: "",
  opis: "Probni članak za proveru urednika; ne objavljuje se na javnom sajtu.",
  telo: "## Priprema\n\nPovršina mora biti čista i suva[^tds].\n\n- odmastiti\n- izbrusiti\n\nVišе u [katalogu](/katalog).",
  izvori: [IZVOR],
  interneNapomene: "",
  nepotvrdjeno: "",
  slikaId: null,
  slikaAlt: "",
  ...patch,
});

/** Datum i vreme po vremenu Srbije, `dana` dana od danas (termin je uvek u budućnosti). */
function termin(dana: number, vreme = "09:00") {
  const d = new Date(Date.now() + dana * 86_400_000);
  const datum = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Belgrade", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  return { datum, vreme };
}
const posle = (iso: string) => new Date(new Date(iso).getTime() + 1000);
const pre = (iso: string) => new Date(new Date(iso).getTime() - 1000);

before(async () => {
  if (reason) return;
  ensureTestCryptoEnv();
  db = await initTestDatabase();
  const accounts = await seedAccounts(db, [{ key: "owner", role: "gazda" }, { key: "office", role: "kancelarija" }, { key: "rep", role: "komercijalista" }]);
  owner = accounts.owner;
  office = accounts.office;
  rep = accounts.rep;
});

after(async () => {
  if (!reason && db) {
    const tables = ["saveti_objave", "saveti_zakazivanja", "saveti_dogadjaji", "saveti_adrese"];
    for (const t of [...tables, "saveti_clanci", "saveti_verzije", "saveti_slike"]) await db.sql.unsafe(`ALTER TABLE ${t} DISABLE TRIGGER USER`);
    await db.sql`UPDATE saveti_clanci SET javna_verzija_id = NULL`;
    await db.sql`TRUNCATE saveti_objave, saveti_zakazivanja, saveti_dogadjaji, saveti_adrese, saveti_verzije, saveti_clanci, saveti_slike CASCADE`;
    for (const t of [...tables, "saveti_clanci", "saveti_verzije", "saveti_slike"]) await db.sql.unsafe(`ALTER TABLE ${t} ENABLE TRIGGER USER`);
    await cleanupQa(db);
  }
  await closeTestDatabase();
});

const svc = () => import("@/lib/saveti/urednik/servis");
const javni = () => import("@/lib/saveti");
const javniNaslovi = async (sada?: Date) => (await (await javni()).getPublicSaveti(sada)).map((c) => `${c.id}:${c.naslov}`);

test("zabrana: kancelarija i komercijalista ne vide, ne uređuju, ne odobravaju ni ne objavljuju", async (t) => {
  if (guard(t)) return;
  const s = await svc();
  for (const who of [office, rep]) {
    const u = asUser(who);
    const forbidden = (e: { code?: string }) => e.code === "forbidden";
    await assert.rejects(s.spisakClanaka(u), forbidden);
    await assert.rejects(s.clanakZaUredjivanje(u, "SV-0001"), forbidden);
    await assert.rejects(s.napraviClanak(u, { ...unos(), tip: "postupak", kategorija: "priprema-povrsine" }), forbidden);
    await assert.rejects(s.odobri(u, "SV-0001", 1), forbidden);
    await assert.rejects(s.vratiNaDoradu(u, "SV-0001", "x"), forbidden);
    await assert.rejects(s.zakazi(u, "SV-0001", termin(2)), forbidden);
    await assert.rejects(s.objaviOdmah(u, "SV-0001", 1), forbidden);
    await assert.rejects(s.povuci(u, "SV-0001", "x"), forbidden);
    await assert.rejects(s.zabeleziStrucnuPotvrdu(u, "SV-0001", { verzijaBroj: 1, strucnjak: "X", uloga: "Y", datum: "2026-10-01", obuhvat: "Z" }), forbidden);
    await assert.rejects(s.oznaciZaStrucnuPotvrdu(u, "SV-0001", "x"), forbidden);
  }
  const [{ n }] = await db.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM saveti_clanci`;
  assert.equal(n, 0);
});

let id = "";
let t1 = "";

test("nacrt → dorada → pregled → odobrenje → zakazivanje; pre termina nije javan", async (t) => {
  if (guard(t)) return;
  const s = await svc();
  const u = asUser(owner);
  id = (await s.napraviClanak(u, { ...unos(), tip: "postupak", kategorija: "priprema-povrsine" })).id;
  assert.match(id, /^SV-\d{4}$/);
  await assert.rejects(s.sacuvajVerziju(u, id, { ...unos({ telo: "Tekst[^nema]." }), osnova: 1 }), /nije na spisku izvora/);
  await assert.rejects(s.zakazi(u, id, termin(2)), /samo odobrena/);
  await assert.rejects(s.objaviOdmah(u, id, 1), /samo odobrena/);
  await s.posaljiNaPregled(u, id);
  await s.vratiNaDoradu(u, id, "dopuniti uvod");
  assert.equal((await s.clanakZaUredjivanje(u, id))?.stanje.status, "nacrt");
  await s.posaljiNaPregled(u, id);
  await assert.rejects(s.odobri(u, id, 7), /Pregledali ste verziju 7/);
  await s.odobri(u, id, 1);
  await assert.rejects(s.zakazi(u, id, { datum: "2020-01-01", vreme: "09:00" }), /prošao/);
  await assert.rejects(s.zakazi(u, id, { datum: termin(2).datum, vreme: "9h" }), /vreme/);
  t1 = (await s.zakazi(u, id, termin(2, "09:00"))).termin;
  // 09:00 po vremenu Srbije je 07:00 ili 08:00 UTC, zavisno od letnjeg/zimskog vremena.
  assert.match(t1, /T0[78]:00:00\.000Z$/);
  await assert.rejects(s.zakazi(u, id, termin(3)), /već zakazan/);
  const d = await s.clanakZaUredjivanje(u, id);
  assert.equal(d?.stanje.status, "zakazan");
  assert.deepEqual(await javniNaslovi(), []);
  assert.deepEqual(await javniNaslovi(pre(t1)), []);
});

test("u terminu je javan bez zakazanog posla; upis objave je jednokratan", async (t) => {
  if (guard(t)) return;
  const s = await svc();
  assert.deepEqual(await javniNaslovi(posle(t1)), [`${id}:Kako se nanosi sintetički prajmer`]);
  const r1 = await s.uskladiDospeleObjave(posle(t1));
  assert.equal(r1.objavljeno.length, 1);
  const r2 = await s.uskladiDospeleObjave(posle(t1));
  assert.deepEqual(r2.objavljeno, []);
  const [{ n }] = await db.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM saveti_objave WHERE clanak_id = ${id}`;
  assert.equal(n, 1);
  const pub = await (await javni()).getPublicSaveti();
  assert.deepEqual(pub.map((c) => c.id), [id]);
  assert.equal(pub[0].datumObjave, t1, "datum objave je termin, ne trenutak upisa");
  assert.equal((await s.clanakZaUredjivanje(asUser(owner), id))?.stanje.status, "objavljen");
});

test("izmena objavljenog: javna ostaje odobrena verzija do novog odobrenja; zakazane izmene važe od termina", async (t) => {
  if (guard(t)) return;
  const s = await svc();
  const u = asUser(owner);
  const r = await s.sacuvajVerziju(u, id, { ...unos({ naslov: "Kako se nanosi sintetički prajmer (dopunjeno)" }), osnova: 1 });
  assert.equal(r.promenaSadrzaja, true);
  assert.deepEqual(await javniNaslovi(), [`${id}:Kako se nanosi sintetički prajmer`]);
  await assert.rejects(s.objaviOdmah(u, id, 2), /samo odobrena/);
  await s.posaljiNaPregled(u, id);
  await s.odobri(u, id, 2);
  // Samo interne napomene: nova verzija, isti otisak → odobrenje važi.
  const n = await s.sacuvajVerziju(u, id, { ...unos({ naslov: "Kako se nanosi sintetički prajmer (dopunjeno)", interneNapomene: "proveriti TDS v3" }), osnova: 2 });
  assert.equal(n.promenaSadrzaja, false);
  assert.equal((await s.clanakZaUredjivanje(u, id))?.stanje.radniStatus, "odobren");
  const t2 = (await s.zakazi(u, id, termin(4, "10:30"))).termin;
  assert.deepEqual(await javniNaslovi(pre(t2)), [`${id}:Kako se nanosi sintetički prajmer`]);
  assert.deepEqual(await javniNaslovi(posle(t2)), [`${id}:Kako se nanosi sintetički prajmer (dopunjeno)`]);
  // Otkazan termin: izmene se ne objavljuju; „Objavite odmah“ ih odmah objavljuje.
  await s.otkaziZakazivanje(u, id);
  assert.deepEqual(await javniNaslovi(posle(t2)), [`${id}:Kako se nanosi sintetički prajmer`]);
  await s.objaviOdmah(u, id, 3);
  assert.deepEqual(await javniNaslovi(), [`${id}:Kako se nanosi sintetički prajmer (dopunjeno)`]);
});

test("izmena posle odobrenja poništava odobrenje i otkazuje termin; vraćanje na doradu takođe", async (t) => {
  if (guard(t)) return;
  const s = await svc();
  const u = asUser(owner);
  const drugi = (await s.napraviClanak(u, { ...unos({ naslov: "Drugi sintetički članak" }), tip: "osnovni-vodic", kategorija: "priprema-povrsine" })).id;
  await s.posaljiNaPregled(u, drugi);
  await s.odobri(u, drugi, 1);
  const tz = (await s.zakazi(u, drugi, termin(5))).termin;
  await s.sacuvajVerziju(u, drugi, { ...unos({ naslov: "Drugi sintetički članak", telo: "Izmenjen tekst posle odobrenja.", izvori: [] }), osnova: 1 });
  const d = await s.clanakZaUredjivanje(u, drugi);
  assert.equal(d?.stanje.status, "nacrt");
  assert.equal(d?.stanje.odobrenje, null);
  assert.equal(d?.stanje.termin, null);
  assert.ok(!(await javniNaslovi(posle(tz))).some((x) => x.startsWith(drugi)));

  const treci = (await s.napraviClanak(u, { ...unos({ naslov: "Treći sintetički članak" }), tip: "osnovni-vodic", kategorija: "priprema-povrsine" })).id;
  await s.posaljiNaPregled(u, treci);
  await s.odobri(u, treci, 1);
  const t3 = (await s.zakazi(u, treci, termin(5, "11:00"))).termin;
  await s.vratiNaDoradu(u, treci, "dopuniti izvor");
  assert.ok(!(await javniNaslovi(posle(t3))).some((x) => x.startsWith(treci)));
  const [{ n }] = await db.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM saveti_zakazivanja WHERE clanak_id IN (${drugi}, ${treci}) AND otkazano IS NULL`;
  assert.equal(n, 0, "oba termina su otkazana");
});

test("stručna potvrda: zaseban uslov pre odobrenja, vezan za tačnu verziju; zahtev se ne uklanja", async (t) => {
  if (guard(t)) return;
  const s = await svc();
  const u = asUser(owner);
  const cetvrti = (await s.napraviClanak(u, { ...unos({ naslov: "Četvrti sintetički članak" }), tip: "osnovni-vodic", kategorija: "zastita-na-radu" })).id;
  await s.oznaciZaStrucnuPotvrdu(u, cetvrti, "Potvrditi izbor zaštite disanja.");
  await s.posaljiNaPregled(u, cetvrti);
  await assert.rejects(s.odobri(u, cetvrti, 1), /stručnu potvrdu/);
  await assert.rejects(s.zabeleziStrucnuPotvrdu(u, cetvrti, { verzijaBroj: 1, strucnjak: "", uloga: "x", datum: "2026-10-30", obuhvat: "x" }), /ime stručnjaka/);
  await assert.rejects(s.zabeleziStrucnuPotvrdu(u, cetvrti, { verzijaBroj: 1, strucnjak: "Tehnička podrška", uloga: "x", datum: "2026-10-30", obuhvat: "x" }), /imenovana osoba/);
  await s.zabeleziStrucnuPotvrdu(u, cetvrti, { verzijaBroj: 1, strucnjak: "Sintetički Stručnjak", uloga: "lice za BZR", datum: "2026-10-30", obuhvat: "Ceo tekst." });
  await s.odobri(u, cetvrti, 1);
  // Izmena teksta poništava i odobrenje i stručnu potvrdu.
  await s.sacuvajVerziju(u, cetvrti, { ...unos({ naslov: "Četvrti sintetički članak", telo: "Dopunjen tekst.", izvori: [] }), osnova: 1 });
  await s.posaljiNaPregled(u, cetvrti);
  await assert.rejects(s.odobri(u, cetvrti, 2), /stručnu potvrdu/);
  const d = await s.clanakZaUredjivanje(u, cetvrti);
  assert.equal(d?.stanje.strucnaPotvrda.potrebna, true);
  assert.equal(d?.stanje.strucnaPotvrda.vazeca, null);
  await assert.rejects(db.sql`UPDATE saveti_clanci SET strucna_potvrda_potrebna = false WHERE id = ${cetvrti}`, /ne uklanja/);
});

test("vraćanje prethodne verzije: nova verzija sa starim sadržajem, traži odobrenje, pa se objavljuje", async (t) => {
  if (guard(t)) return;
  const s = await svc();
  const u = asUser(owner);
  const d0 = await s.clanakZaUredjivanje(u, id);
  const last = d0!.verzije.at(-1)!.broj;
  const { broj } = await s.vratiVerziju(u, id, 1, last);
  const d = await s.clanakZaUredjivanje(u, id);
  assert.equal(d?.verzije.at(-1)?.otisak, d?.verzije[0].otisak);
  assert.equal(d?.stanje.radniStatus, "nacrt");
  await s.posaljiNaPregled(u, id);
  await s.odobri(u, id, broj);
  await s.objaviOdmah(u, id, broj);
  assert.equal((await (await javni()).getPublicSaveti()).find((c) => c.id === id)?.naslov, "Kako se nanosi sintetički prajmer");
});

test("promena adrese samo izričito; stara adresa preusmerava", async (t) => {
  if (guard(t)) return;
  const s = await svc();
  const u = asUser(owner);
  const d = await s.clanakZaUredjivanje(u, id);
  const stara = d!.clanak.slug;
  const last = d!.verzije.at(-1)!.broj;
  await s.sacuvajVerziju(u, id, { ...unos({ naslov: "Potpuno nov naslov" }), osnova: last });
  assert.equal((await s.clanakZaUredjivanje(u, id))?.clanak.slug, stara, "naslov ne menja adresu");
  await s.sacuvajVerziju(u, id, { ...unos({ naslov: "Potpuno nov naslov" }), osnova: last + 1, novaAdresa: "sinteticki-prajmer" });
  const p = await (await javni()).getPublicSavetBySlug(stara);
  assert.equal(p.preusmerenje, "sinteticki-prajmer");
});

test("povlačenje: članak odmah nestaje iz javnog prikaza; ispravljen i odobren može ponovo da izađe", async (t) => {
  if (guard(t)) return;
  const s = await svc();
  const u = asUser(owner);
  await assert.rejects(s.povuci(u, id, "  "), /razlog/);
  await s.povuci(u, id, "probni članak");
  assert.ok(!(await (await javni()).getPublicSaveti()).some((c) => c.id === id));
  assert.equal((await s.clanakZaUredjivanje(u, id))?.stanje.status, "povucen");
  await assert.rejects(s.povuci(u, id, "opet"), /već povučen/);
  const last = (await s.clanakZaUredjivanje(u, id))!.verzije.at(-1)!.broj;
  await s.sacuvajVerziju(u, id, { ...unos({ naslov: "Potpuno nov naslov (ispravljeno)" }), osnova: last });
  await s.posaljiNaPregled(u, id);
  await s.odobri(u, id, last + 1);
  const tp = (await s.zakazi(u, id, termin(6))).termin;
  assert.ok(!(await javniNaslovi(pre(tp))).some((x) => x.startsWith(id)), "povučen do termina");
  assert.ok((await javniNaslovi(posle(tp))).includes(`${id}:Potpuno nov naslov (ispravljeno)`));
  await s.uskladiDospeleObjave(posle(tp));
  const d = await s.clanakZaUredjivanje(u, id);
  assert.equal(d?.stanje.status, "objavljen");
  assert.equal(d?.clanak.povuceno, null);
});

test("slike: proverava se stvarni tip i veličina; nacrt slika nije javna", async (t) => {
  if (guard(t)) return;
  const s = await svc();
  const u = asUser(owner);
  await assert.rejects(s.otpremiSliku(u, { name: "x.jpg", bytes: new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>") }), /JPG, PNG i WebP/);
  const mala = await sharp({ create: { width: 200, height: 120, channels: 3, background: "#c00" } }).png().toBuffer();
  await assert.rejects(s.otpremiSliku(u, { name: "mala.png", bytes: mala }), /premala/);
  const png = await sharp({ create: { width: 1600, height: 900, channels: 3, background: "#346" } }).png().toBuffer();
  const slika = await s.otpremiSliku(u, { name: "proba.png", bytes: png });
  assert.equal(slika.sirina, 1600);
  const again = await s.otpremiSliku(u, { name: "isto.png", bytes: png });
  assert.equal(again.id, slika.id, "ista slika se ne duplira");
  await assert.rejects(s.otpremiSliku(asUser(rep), { name: "p.png", bytes: png }), (e: { code?: string }) => e.code === "forbidden");
  assert.equal(await s.slikaZaPrikaz(slika.id, false), null, "slika nacrta nije javna");
  assert.ok(await s.slikaZaPrikaz(slika.id, true));
  const [{ mime }] = await db.sql<{ mime: string }[]>`SELECT mime FROM saveti_slike WHERE id = ${slika.id}`;
  assert.equal(mime, "image/webp");
  await assert.rejects(s.napraviClanak(u, { ...unos({ slikaId: slika.id, slikaAlt: "" }), tip: "postupak", kategorija: "priprema-povrsine" }), /alternativni tekst/);
});

test("verzije, događaji i objave se samo dodaju; članak se ne briše", async (t) => {
  if (guard(t)) return;
  await assert.rejects(db.sql`UPDATE saveti_verzije SET naslov = 'x'`, /samo dodaje/);
  await assert.rejects(db.sql`DELETE FROM saveti_dogadjaji`, /samo dodaje/);
  await assert.rejects(db.sql`DELETE FROM saveti_objave`, /samo dodaje/);
  await assert.rejects(db.sql`DELETE FROM saveti_clanci WHERE id = ${id}`, /ne briše/);
  const [{ n }] = await db.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM audit_log WHERE entity_type = 'Članak'`;
  assert.ok(n >= 10, "radnje su u tragu revizije");
});
