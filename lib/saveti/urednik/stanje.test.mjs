import assert from "node:assert/strict";
import test from "node:test";
import {
  javnaVerzijaU,
  lanacPoslednjeg,
  odgovaraFilteru,
  otisakSadrzaja,
  slugIzNaslova,
  stanjeClanka,
  terminIzUnosa,
  vazeceOdobrenje,
  vazecaStrucnaPotvrda,
  vremeSrbije,
} from "./stanje.mjs";

const baza = { naslov: "Naslov", metaNaslov: "", opis: "Opis", telo: "Tekst.", izvori: [], podaci: {}, slikaId: null, slikaAlt: "" };
const v = (id, broj, sadrzaj = baza) => ({ id, broj, otisak: otisakSadrzaja(sadrzaj) });
const d = (verzijaId, radnja, detalji = {}) => ({ verzijaId, radnja, vreme: new Date(), detalji });
const clanak = (javnaVerzijaId = null, povuceno = null, strucnaPotvrdaPotrebna = false) => ({ javnaVerzijaId, povuceno, strucnaPotvrdaPotrebna });
// Fiksan „sada“: rezultat ne zavisi od dana kada se test pokreće.
const SADA = new Date("2026-11-01T10:00:00.000Z");

test("otisak zavisi samo od javnog sadržaja", () => {
  const a = otisakSadrzaja(baza);
  assert.equal(a, otisakSadrzaja({ ...baza, interneNapomene: "drugo", nepotvrdjeno: "x" }));
  assert.notEqual(a, otisakSadrzaja({ ...baza, telo: "Tekst!" }));
  assert.notEqual(a, otisakSadrzaja({ ...baza, slikaId: "11111111-1111-1111-1111-111111111111", slikaAlt: "alt" }));
  // redosled ključeva ne menja otisak
  assert.equal(otisakSadrzaja({ ...baza, podaci: { b: 1, a: 2 } }), otisakSadrzaja({ ...baza, podaci: { a: 2, b: 1 } }));
});

test("tok statusa: nacrt → za pregled → odobren → zakazan → objavljen", () => {
  const verzije = [v("v1", 1)];
  const ev = [];
  assert.equal(stanjeClanka({ clanak: clanak(), verzije, dogadjaji: ev }).status, "nacrt");
  ev.push(d("v1", "poslato_na_pregled"));
  assert.equal(stanjeClanka({ clanak: clanak(), verzije, dogadjaji: ev }).status, "za_pregled");
  ev.push(d("v1", "odobreno", { otisak: verzije[0].otisak }));
  assert.equal(stanjeClanka({ clanak: clanak(), verzije, dogadjaji: ev }).status, "odobren");
  const z = { verzijaId: "v1", termin: "2026-11-02T08:00:00.000Z" };
  const s = stanjeClanka({ clanak: clanak(), verzije, dogadjaji: ev, zakazivanje: z, sada: SADA });
  assert.equal(s.status, "zakazan");
  assert.equal(s.javno, false);
  assert.equal(s.termin, "2026-11-02T08:00:00.000Z");
  // u trenutku termina članak je javan, i pre nego što usklađivanje upiše objavu
  const uTerminu = stanjeClanka({ clanak: clanak(), verzije, dogadjaji: ev, zakazivanje: z, sada: new Date("2026-11-02T08:00:00.000Z") });
  assert.equal(uTerminu.status, "objavljen");
  assert.equal(uTerminu.javnaVerzijaId, "v1");
  assert.equal(uTerminu.termin, null);
  assert.equal(stanjeClanka({ clanak: clanak("v1"), verzije, dogadjaji: ev, sada: SADA }).status, "objavljen");
});

test("izmena teksta posle odobrenja poništava odobrenje; izmena napomena ne", () => {
  const verzije = [v("v1", 1)];
  const ev = [d("v1", "poslato_na_pregled"), d("v1", "odobreno", { otisak: verzije[0].otisak })];
  // samo interne napomene: isti otisak → odobrenje važi
  const samoNapomene = [...verzije, v("v2", 2)];
  assert.ok(vazeceOdobrenje(samoNapomene, ev));
  // izmenjen tekst → novo odobrenje
  const izmenjen = [...verzije, v("v2", 2, { ...baza, telo: "Drugi tekst." })];
  assert.equal(vazeceOdobrenje(izmenjen, ev), null);
  assert.equal(stanjeClanka({ clanak: clanak(), verzije: izmenjen, dogadjaji: ev }).status, "nacrt");
  // povratak na isti tekst posle izmene ne vraća staro odobrenje (lanac je prekinut)
  const vracen = [...izmenjen, v("v3", 3)];
  assert.equal(lanacPoslednjeg(vracen).length, 1);
  assert.equal(vazeceOdobrenje(vracen, ev), null);
});

test("zakazivanje važi samo za odobren lanac; izmena zakazanog članka vraća ga u nacrt", () => {
  const verzije = [v("v1", 1)];
  const ev = [d("v1", "odobreno", { otisak: verzije[0].otisak })];
  const z = { verzijaId: "v1", termin: "2026-11-02T08:00:00.000Z" };
  const izmenjen = [...verzije, v("v2", 2, { ...baza, naslov: "Novi naslov" })];
  const s = stanjeClanka({ clanak: clanak(), verzije: izmenjen, dogadjaji: ev, zakazivanje: z, sada: SADA });
  assert.equal(s.status, "nacrt");
  assert.equal(s.termin, null);
});

test("vraćeno na doradu opoziva pregled i odobrenje", () => {
  const verzije = [v("v1", 1)];
  const ev = [d("v1", "poslato_na_pregled"), d("v1", "odobreno", { otisak: verzije[0].otisak }), d("v1", "vraceno_na_doradu")];
  assert.equal(stanjeClanka({ clanak: clanak(), verzije, dogadjaji: ev }).status, "nacrt");
});

test("objavljen članak sa izmenama: javno ostaje, radni status prati izmene; filter nalazi oba", () => {
  const verzije = [v("v1", 1), v("v2", 2, { ...baza, telo: "Ispravka." })];
  const ev = [d("v1", "odobreno", { otisak: verzije[0].otisak }), d("v2", "poslato_na_pregled")];
  const s = stanjeClanka({ clanak: clanak("v1"), verzije, dogadjaji: ev });
  assert.equal(s.status, "objavljen");
  assert.equal(s.radniStatus, "za_pregled");
  assert.ok(s.imaIzmene && s.javno);
  assert.ok(odgovaraFilteru(s, "objavljen") && odgovaraFilteru(s, "za_pregled"));
  assert.ok(!odgovaraFilteru(s, "nacrt"));
});

test("povučen članak nije javan", () => {
  const verzije = [v("v1", 1)];
  const s = stanjeClanka({ clanak: clanak("v1", new Date()), verzije, dogadjaji: [] });
  assert.equal(s.status, "povucen");
  assert.equal(s.javno, false);
});

test("povučen pa ponovo zakazan članak je javan od termina", () => {
  const povucen = clanak("v1", new Date("2026-10-30T10:00:00.000Z"));
  const z = { verzijaId: "v2", termin: "2026-11-01T09:00:00.000Z" };
  assert.equal(javnaVerzijaU(povucen, null, SADA), null);
  assert.equal(javnaVerzijaU(povucen, z, SADA), "v2");
  assert.equal(javnaVerzijaU(povucen, { ...z, izvrseno: SADA }, SADA), null, "izvršeno zakazivanje ne vraća povučen članak");
});

test("stručna potvrda: važi za isti sadržaj, poništava je izmena i vraćanje na doradu", () => {
  const verzije = [v("v1", 1)];
  const ev = [d("v1", "strucno_potvrdjeno", { otisak: verzije[0].otisak, strucnjak: "Ime Prezime" })];
  assert.ok(vazecaStrucnaPotvrda(verzije, ev));
  const s = stanjeClanka({ clanak: clanak(null, null, true), verzije, dogadjaji: ev, sada: SADA });
  assert.deepEqual([s.strucnaPotvrda.potrebna, Boolean(s.strucnaPotvrda.vazeca)], [true, true]);
  const izmenjen = [...verzije, v("v2", 2, { ...baza, telo: "Drugo." })];
  assert.equal(vazecaStrucnaPotvrda(izmenjen, ev), null);
  assert.equal(vazecaStrucnaPotvrda(verzije, [...ev, d("v1", "vraceno_na_doradu")]), null);
  // članak koji ne traži potvrdu: polje je informativno, bez važeće potvrde
  assert.equal(stanjeClanka({ clanak: clanak(), verzije, dogadjaji: ev, sada: SADA }).strucnaPotvrda.vazeca, null);
});

test("termin iz unosa: vreme Srbije, i preko promene sata", () => {
  const sada = new Date("2026-10-20T06:00:00.000Z");
  const leto = terminIzUnosa("2026-10-20", "09:00", sada);
  assert.ok(leto.ok && leto.termin.toISOString() === "2026-10-20T07:00:00.000Z"); // CEST
  const zima = terminIzUnosa("2026-10-29", "09:00", sada);
  assert.ok(zima.ok && zima.termin.toISOString() === "2026-10-29T08:00:00.000Z"); // CET posle 25. 10.
  assert.equal(terminIzUnosa("2026-10-20", "06:30", sada).ok, false, "prošao trenutak");
  assert.equal(terminIzUnosa("2026-10-20", "08:00:30", sada).ok, false);
  assert.equal(terminIzUnosa("2026-02-30", "09:00", sada).ok, false, "nepostojeći datum");
  assert.equal(terminIzUnosa("2026-10-20", "24:00", sada).ok, false);
  assert.equal(terminIzUnosa("2028-10-20", "09:00", sada).ok, false, "predaleko");
  assert.equal(vremeSrbije("2026-10-26T08:00:00.000Z"), "26. 10. 2026. u 09:00");
});

test("adresa iz naslova", () => {
  assert.equal(slugIzNaslova("Đon i čađ: šta 2K znači?"), "djon-i-cadj-sta-2k-znaci");
});
