import assert from "node:assert/strict";
import test from "node:test";

import {
  CSV_PDF_SUDAR,
  OGRADE,
  SEMANTIKA_DATUMA,
  nedostajuciDokazi,
  normalizujPeriod,
  oceniKriterijume,
  pokrivenost,
  pokrivenostTekst,
  problemiDokumenata,
  raspodelaFakturaPoKupcu,
} from "./dataReadiness.mjs";

/* =========================================================================
 * Pokrivenost i nulti imenitelj
 * ====================================================================== */

test("nulti imenitelj daje „nije dostupno“, ne 0% i ne 100%", () => {
  const p = pokrivenost({ potvrdjeno: 0, ukupno: 0, imenitelj: "uvezene šifre partnera" });

  assert.equal(p.procenat, null);
  assert.equal(p.dostupno, false);
  assert.equal(pokrivenostTekst(p), "nije dostupno");

  // Ovo je cela poenta: 0/0 ne sme da se pročita ni kao „ništa nije mapirano“
  // ni kao „sve je mapirano“.
  assert.notEqual(pokrivenostTekst(p), "0.0%");
  assert.notEqual(pokrivenostTekst(p), "100.0%");
});

test("pokrivenost se računa samo nad imenovanim imeniteljem", () => {
  assert.throws(
    () => pokrivenost({ potvrdjeno: 1, ukupno: 2, imenitelj: "" }),
    /imenovanog imenitelja/,
  );
  assert.throws(
    () => pokrivenost({ potvrdjeno: 1, ukupno: 2, imenitelj: "   " }),
    /imenovanog imenitelja/,
  );
});

test("pokrivenost odbija nemoguće brojeve umesto da ih prikaže", () => {
  assert.throws(
    () => pokrivenost({ potvrdjeno: 3, ukupno: 2, imenitelj: "x" }),
    /više od ukupnog/,
  );
  assert.throws(() => pokrivenost({ potvrdjeno: -1, ukupno: 2, imenitelj: "x" }), /negativan/);
  assert.throws(() => pokrivenost({ potvrdjeno: 1.5, ukupno: 2, imenitelj: "x" }), /celim/);
});

test("pokrivenost nad stvarnim imeniteljem daje procenat i broj nepotvrđenih", () => {
  const p = pokrivenost({ potvrdjeno: 3, ukupno: 4, imenitelj: "uvezene šifre partnera" });
  assert.equal(p.nepotvrdjeno, 1);
  assert.equal(pokrivenostTekst(p), "75.0%");
  assert.equal(p.dostupno, true);
});

/* =========================================================================
 * Period
 * ====================================================================== */

test("granice perioda su uključive i dokumentovane", () => {
  assert.match(SEMANTIKA_DATUMA, /issued_on/);
  assert.match(SEMANTIKA_DATUMA, /datum izdavanja/);
  assert.match(SEMANTIKA_DATUMA, /uključive/);
  // Izričito odbacuje tri pogrešna čitanja.
  assert.match(SEMANTIKA_DATUMA, /Nije datum uvoza, plaćanja ni isporuke/);
});

test("prazan period znači „sve što postoji“, bez greške", () => {
  const p = normalizujPeriod({});
  assert.deepEqual(p, { od: null, do: null, greske: [] });
});

test("neispravan datum se odbija, ne tumači", () => {
  const p = normalizujPeriod({ od: "1.1.2026.", do: "2026-13-45" });
  assert.equal(p.od, null);
  assert.equal(p.do, null);
  assert.equal(p.greske.length, 2);
});

test("tačan oblik nije dovoljan — datum mora postojati u kalendaru", () => {
  /*
   * `2026-13-45` prolazi svaku proveru oblika, a nijedan kalendar ga nema.
   * Da je propušten, otišao bi u upit i vratio se kao sirova greška drajvera.
   */
  for (const lose of ["2026-13-01", "2026-02-30", "2025-02-29", "2026-00-10", "2026-04-31"]) {
    const p = normalizujPeriod({ od: lose });
    assert.equal(p.od, null, `„${lose}“ je propušten kao datum`);
    assert.equal(p.greske.length, 1);
  }

  // Prestupna godina jeste stvaran datum i mora proći.
  assert.equal(normalizujPeriod({ od: "2024-02-29" }).od, "2024-02-29");
});

test("obrnut period se odbija sa porukom umesto tihe zamene", () => {
  const p = normalizujPeriod({ od: "2026-06-01", do: "2026-01-01" });
  assert.equal(p.od, null);
  assert.equal(p.do, null);
  assert.match(p.greske[0], /posle kraja/);
});

test("period jednog dana je dozvoljen jer su granice uključive", () => {
  const p = normalizujPeriod({ od: "2026-03-04", do: "2026-03-04" });
  assert.deepEqual(p, { od: "2026-03-04", do: "2026-03-04", greske: [] });
});

/* =========================================================================
 * Kriterijumi
 * ====================================================================== */

/** Podrazumevane činjenice: prazna baza, opseg dostupan. */
function cinjenice(preko = {}) {
  return {
    efektivnihDokumenata: 0,
    parovaSaViseFaktura: 0,
    parovaSaViseDatuma: 0,
    mapiranjeKupaca: pokrivenost({ potvrdjeno: 0, ukupno: 0, imenitelj: "uvezene šifre" }),
    mapiranjeArtikala: pokrivenost({ potvrdjeno: 0, ukupno: 0, imenitelj: "artikli u prometu" }),
    korektivnihDokumenata: 0,
    korektivnihBezVeze: 0,
    opsegDostupan: true,
    ...preko,
  };
}

const po = (lista, kljuc) => lista.find((k) => k.kljuc === kljuc);

test("prazna baza ne proglašava nijedan kriterijum potvrđenim", () => {
  const k = oceniKriterijume(cinjenice());
  assert.equal(k.length, 7);
  assert.equal(
    k.filter((x) => x.status === "potvrdjeno").length,
    0,
    "prazna baza ne sme imati nijedan potvrđen kriterijum",
  );
});

test("tri kriterijuma ostaju „nije provereno“ bez obzira na podatke", () => {
  // Najbogatiji mogući ulaz: sve što se meri je potvrđeno.
  const bogato = cinjenice({
    efektivnihDokumenata: 5000,
    parovaSaViseFaktura: 900,
    parovaSaViseDatuma: 850,
    mapiranjeKupaca: pokrivenost({ potvrdjeno: 40, ukupno: 40, imenitelj: "uvezene šifre" }),
    mapiranjeArtikala: pokrivenost({
      potvrdjeno: 300,
      ukupno: 300,
      imenitelj: "artikli u prometu",
    }),
  });
  const k = oceniKriterijume(bogato);

  for (const kljuc of [
    "pokrivenost_perioda_i_kupaca",
    "kancelarijska_prihvatna_provera",
    "aktuelne_cene_valuta_pdv_lager",
  ]) {
    assert.equal(
      po(k, kljuc).status,
      "nije_provereno",
      `„${kljuc}“ se ne sme potvrditi iz baze ni pri najboljim podacima`,
    );
    assert.equal(po(k, kljuc).osnov, "spoljna_evidencija");
  }
});

test("prolazak testova ne potvrđuje kancelarijsku prihvatnu proveru", () => {
  const k = oceniKriterijume(cinjenice({ efektivnihDokumenata: 100 }));
  const kancelarija = po(k, "kancelarijska_prihvatna_provera");
  assert.equal(kancelarija.status, "nije_provereno");
  assert.match(kancelarija.objasnjenje, /automatizovanih testova to NE menja/);
});

test("aktuelne cene i lager se izričito ne izvode iz istorijskih faktura", () => {
  const cene = po(oceniKriterijume(cinjenice({ efektivnihDokumenata: 999 })), "aktuelne_cene_valuta_pdv_lager");
  assert.match(cene.objasnjenje, /NE smeju izvoditi iz istorijskih/);
});

test("istorija prodaje je merljiva iz baze u oba smera", () => {
  const nema = po(oceniKriterijume(cinjenice()), "istorija_prodaje");
  assert.equal(nema.status, "nedostaje");
  assert.equal(nema.osnov, "baza");
  // „Nema podataka“ se ne sme pročitati kao „kupac nikada nije kupovao“.
  assert.match(nema.objasnjenje, /NIJE „kupac nikada nije kupovao“/);

  const ima = po(oceniKriterijume(cinjenice({ efektivnihDokumenata: 12 })), "istorija_prodaje");
  assert.equal(ima.status, "potvrdjeno");
  assert.match(ima.objasnjenje, /12 dokumenata/);
});

test("ponovljene kupovine su potvrđene, ali bez tvrdnje o dovoljnosti", () => {
  const k = po(
    oceniKriterijume(cinjenice({ parovaSaViseFaktura: 7, parovaSaViseDatuma: 5 })),
    "ponovljene_kupovine",
  );
  assert.equal(k.status, "potvrdjeno");
  assert.match(k.objasnjenje, /NE dokazuje da ih ima dovoljno/);
  assert.match(k.objasnjenje, /dovoljnost nije merena/);
});

test("nulti imenitelj mapiranja daje „nije provereno“, ne potvrdu", () => {
  const k = po(oceniKriterijume(cinjenice()), "mapiranja_potvrdjena");
  assert.equal(k.status, "nije_provereno");
  assert.match(k.objasnjenje, /nije dostupno/);
});

test("mapiranja se potvrđuju samo u poznatom uvezenom opsegu", () => {
  const k = po(
    oceniKriterijume(
      cinjenice({
        mapiranjeKupaca: pokrivenost({ potvrdjeno: 5, ukupno: 5, imenitelj: "uvezene šifre" }),
        mapiranjeArtikala: pokrivenost({
          potvrdjeno: 9,
          ukupno: 9,
          imenitelj: "artikli u prometu",
        }),
      }),
    ),
    "mapiranja_potvrdjena",
  );
  assert.equal(k.status, "potvrdjeno");
  assert.match(k.objasnjenje, /poznat uvezen opseg/);
  // Ne sme se pročitati kao tvrdnja o svim kupcima firme.
  assert.match(k.objasnjenje, /nikad nije uvezen se ovde ne broji/);
});

test("jedno nepotvrđeno mapiranje obara ceo kriterijum", () => {
  const k = po(
    oceniKriterijume(
      cinjenice({
        mapiranjeKupaca: pokrivenost({ potvrdjeno: 4, ukupno: 5, imenitelj: "uvezene šifre" }),
        mapiranjeArtikala: pokrivenost({
          potvrdjeno: 9,
          ukupno: 9,
          imenitelj: "artikli u prometu",
        }),
      }),
    ),
    "mapiranja_potvrdjena",
  );
  assert.equal(k.status, "nedostaje");
});

test("nula uvezenih povrata nije „povrata nije bilo“", () => {
  const k = po(oceniKriterijume(cinjenice({ efektivnihDokumenata: 50 })), "korektivni_dokumenti");
  assert.equal(k.status, "nije_provereno");
  assert.match(k.objasnjenje, /NIJE „povrata nije bilo“/);
});

test("poznati korektivni dokumenti bez veze ostaju nedostatak, ne potvrda", () => {
  const k = po(
    oceniKriterijume(cinjenice({ korektivnihDokumenata: 3, korektivnihBezVeze: 3 })),
    "korektivni_dokumenti",
  );
  assert.equal(k.status, "nedostaje");
  assert.match(k.objasnjenje, /NE umanjuje neto promet/);
});

test("korektivni dokumenti se nikad ne potvrđuju iz baze", () => {
  // Ni kada su svi navodno povezani — veza se danas ne može dokazati.
  for (const c of [
    cinjenice({ korektivnihDokumenata: 0 }),
    cinjenice({ korektivnihDokumenata: 4, korektivnihBezVeze: 0 }),
    cinjenice({ korektivnihDokumenata: 4, korektivnihBezVeze: 4 }),
  ]) {
    assert.notEqual(po(oceniKriterijume(c), "korektivni_dokumenti").status, "potvrdjeno");
  }
});

/* =========================================================================
 * Prazan opseg
 * ====================================================================== */

test("prazan opseg ne tvrdi ništa o prometu firme", () => {
  const k = oceniKriterijume(cinjenice({ opsegDostupan: false }));

  const istorija = po(k, "istorija_prodaje");
  assert.equal(istorija.status, "nije_provereno");
  assert.match(istorija.objasnjenje, /nije tvrdnja o prometu firme/i);

  assert.equal(po(k, "ponovljene_kupovine").status, "nije_provereno");

  // I dalje nijedan kriterijum nije „potvrđen“.
  assert.equal(k.filter((x) => x.status === "potvrdjeno").length, 0);
});

test("prazan opseg se razlikuje od prazne baze u objašnjenju", () => {
  const prazanOpseg = po(
    oceniKriterijume(cinjenice({ opsegDostupan: false })),
    "istorija_prodaje",
  );
  const praznaBaza = po(oceniKriterijume(cinjenice()), "istorija_prodaje");

  assert.notEqual(prazanOpseg.status, praznaBaza.status);
  assert.notEqual(prazanOpseg.objasnjenje, praznaBaza.objasnjenje);
});

/* =========================================================================
 * Nema zelenog svetla
 * ====================================================================== */

test("nijedna kombinacija ne daje zbirno zeleno svetlo", () => {
  const k = oceniKriterijume(
    cinjenice({
      efektivnihDokumenata: 100000,
      parovaSaViseFaktura: 50000,
      parovaSaViseDatuma: 49000,
      mapiranjeKupaca: pokrivenost({ potvrdjeno: 99, ukupno: 99, imenitelj: "uvezene šifre" }),
      mapiranjeArtikala: pokrivenost({
        potvrdjeno: 3000,
        ukupno: 3000,
        imenitelj: "artikli u prometu",
      }),
      korektivnihDokumenata: 0,
    }),
  );

  // Uvek ostaju najmanje četiri neproverena: tri spoljna + korektivni.
  const otvoreno = k.filter((x) => x.status !== "potvrdjeno");
  assert.ok(otvoreno.length >= 4, `očekivano ≥4 otvorenih, nađeno ${otvoreno.length}`);

  // I spisak nedostajućih dokaza nikad nije prazan.
  assert.ok(nedostajuciDokazi(k).length > 0);
});

test("nema praga „N faktura = spremno“", () => {
  // Ista ocena za 1 i za milion dokumenata: status zavisi od postojanja, ne od broja.
  const jedan = po(oceniKriterijume(cinjenice({ efektivnihDokumenata: 1 })), "istorija_prodaje");
  const mnogo = po(
    oceniKriterijume(cinjenice({ efektivnihDokumenata: 1_000_000 })),
    "istorija_prodaje",
  );
  assert.equal(jedan.status, mnogo.status);
  assert.equal(jedan.status, "potvrdjeno");
});

test("ograde izričito zabranjuju preporuke i pragove", () => {
  const tekst = OGRADE.join(" ");
  assert.match(tekst, /Nema predloga kupovine/);
  assert.match(tekst, /rejtinga kupca/);
  assert.match(tekst, /Nema praga/);
  assert.match(tekst, /recommendation engine/);
  assert.match(tekst, /Nulti imenitelj/);
});

/* =========================================================================
 * Nedostajući dokazi
 * ====================================================================== */

test("spisak dokaza prati stvarne statuse, nije statičan tekst", () => {
  const sve = nedostajuciDokazi(oceniKriterijume(cinjenice()));
  const kljucevi = sve.map((d) => d.kljuc);

  assert.ok(kljucevi.includes("istorija_fakturisanja"));
  assert.ok(kljucevi.includes("korektivni_uzorci"));
  assert.ok(kljucevi.includes("nastavak_tabele"));
  assert.ok(kljucevi.includes("aktuelne_cene_i_lager"));
  assert.ok(kljucevi.includes("fizicka_provera"));

  // Mapiranja su „nije provereno“ pri nultom imenitelju, pa se dokaz i dalje traži.
  assert.ok(kljucevi.includes("partner_artikal_potvrda"));
});

test("potvrđeno mapiranje uklanja svoj dokaz iz spiska", () => {
  const sa = nedostajuciDokazi(
    oceniKriterijume(
      cinjenice({
        mapiranjeKupaca: pokrivenost({ potvrdjeno: 5, ukupno: 5, imenitelj: "uvezene šifre" }),
        mapiranjeArtikala: pokrivenost({
          potvrdjeno: 5,
          ukupno: 5,
          imenitelj: "artikli u prometu",
        }),
      }),
    ),
  ).map((d) => d.kljuc);

  assert.ok(!sa.includes("partner_artikal_potvrda"));
  // Fizička provera ostaje uvek.
  assert.ok(sa.includes("fizicka_provera"));
});

test("svaki nedostajući dokaz nosi razlog zašto je potreban", () => {
  for (const d of nedostajuciDokazi(oceniKriterijume(cinjenice()))) {
    assert.ok(d.naslov && d.naslov.length > 5, `dokaz ${d.kljuc} bez naslova`);
    assert.ok(d.zasto && d.zasto.length > 20, `dokaz ${d.kljuc} bez razloga`);
  }
});

/* =========================================================================
 * Raspodela faktura po kupcu
 * ====================================================================== */

test("raspodela grupiše kupce bez ocene i bez praga", () => {
  const r = raspodelaFakturaPoKupcu([
    { faktura: 1, kupaca: 10 },
    { faktura: 2, kupaca: 4 },
    { faktura: 3, kupaca: 2 },
    { faktura: 7, kupaca: 1 },
    { faktura: 42, kupaca: 3 },
  ]);

  assert.deepEqual(r, [
    { oznaka: "1 faktura", kupaca: 10 },
    { oznaka: "2–3 fakture", kupaca: 6 },
    { oznaka: "4–9 faktura", kupaca: 1 },
    { oznaka: "10 i više faktura", kupaca: 3 },
  ]);

  // Nijedna oznaka ne nosi ocenu kupca.
  for (const kanta of r) {
    assert.doesNotMatch(kanta.oznaka, /dobar|loš|spreman|aktivan|rejting/i);
  }
});

test("prazna raspodela daje nule, ne prazan spisak", () => {
  const r = raspodelaFakturaPoKupcu([]);
  assert.equal(r.length, 4);
  assert.equal(
    r.reduce((a, x) => a + x.kupaca, 0),
    0,
  );
});

test("besmislen broj faktura se preskače umesto da razbije kantu", () => {
  const r = raspodelaFakturaPoKupcu([
    { faktura: 0, kupaca: 5 },
    { faktura: -3, kupaca: 5 },
    { faktura: 1.5, kupaca: 5 },
    { faktura: 2, kupaca: 1 },
  ]);
  assert.equal(
    r.reduce((a, x) => a + x.kupaca, 0),
    1,
  );
});

/* =========================================================================
 * Problemi dokumenata — kategorije se ne sabiraju
 * ====================================================================== */

test("preklapajuće kategorije se ne sabiraju kao isključive", () => {
  /*
   * Realan slučaj: jedan CSV/PDF sudar. Isti dokument je i sudar, i ručni
   * pregled, i čeka mapiranje — tri kategorije, jedan dokument.
   */
  const p = problemiDokumenata({
    cekaMapiranje: 1,
    sudar: 1,
    rucniPregled: 1,
    bezPodrskeZaFormat: 0,
    ukupnoRazlicitih: 1,
  });

  assert.equal(p.ukupnoRazlicitih, 1);
  assert.equal(p.preklapaSe, true);

  const zbir = p.kategorije.reduce((a, k) => a + k.broj, 0);
  assert.equal(zbir, 3);
  assert.notEqual(
    zbir,
    p.ukupnoRazlicitih,
    "zbir kategorija se namerno razlikuje od broja dokumenata",
  );
  assert.match(p.napomena, /ne smeju se sabirati/);
});

test("kategorije bez preklapanja to i kažu", () => {
  const p = problemiDokumenata({
    cekaMapiranje: 2,
    sudar: 0,
    rucniPregled: 0,
    bezPodrskeZaFormat: 0,
    ukupnoRazlicitih: 2,
  });
  assert.equal(p.preklapaSe, false);
});

test("prazno stanje problema je nula u svakoj kategoriji", () => {
  const p = problemiDokumenata({
    cekaMapiranje: 0,
    sudar: 0,
    rucniPregled: 0,
    bezPodrskeZaFormat: 0,
    ukupnoRazlicitih: 0,
  });
  assert.equal(p.kategorije.length, 4);
  assert.equal(p.preklapaSe, false);
  assert.equal(p.ukupnoRazlicitih, 0);
});

test("CSV/PDF sudar je otvoren problem porekla, ne potvrda istog sadržaja", () => {
  assert.match(CSV_PDF_SUDAR, /ne knjiži drugi put/);
  assert.match(CSV_PDF_SUDAR, /promet se ne udvostručuje/);
  assert.match(CSV_PDF_SUDAR, /NIJE potvrda da je sadržaj identičan/);
  assert.match(CSV_PDF_SUDAR, /otvoren problem porekla/);
});

/* =========================================================================
 * Ograde
 * ====================================================================== */

test("raspon datuma se izričito ne čita kao potpunost", () => {
  const tekst = OGRADE.join(" ");
  assert.match(tekst, /ne dokazuju\s+da je istorija između njih potpuna/);
  assert.match(tekst, /Lista ranijih kupaca ne dokazuje/);
  assert.match(tekst, /nije „kupac nikada nije kupovao“/);
  assert.match(tekst, /nije „povrata nije bilo“/);
});
