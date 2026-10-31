# Interaktivni predlog „Sistemi i programi“ (2026-10-31)

Grana `feat/sistemi-interaktivno-2026-10-31`. Na Preview-u do pregleda vlasnika; ne objavljuje se na Production bez odobrenja.

## Zajednički model (pet stručnih stranica)

Kod: `lib/sistemi/guide.ts` (model), `components/sistemi/ProgramGuide.tsx` (prikaz), `components/sistemi/ProgramExplorer.tsx` (stanje i adresa). Isti model važi za Pripremu, Boje i lakove, Pištolje, Poliranje i Potrošni materijal, jer sve koriste isti šablon i isti oblik podataka (`content/sistemi/*.json`).

Tok:
1. **Kartice poslova** sa slikom proizvoda iz tog posla (prva odobrena slika koju nije uzela prethodna kartica; bez slike je znak) i brojem koraka.
2. **Pitanje samo kada posao ima izbor** (`choice`). Rezultat se ne prikazuje dok nema odgovora. Odgovor se menja na istom mestu, bez ponovnog početka.
3. **Rezultat:** naslov posla, kratak uvod, broj koraka, pa koraci. Na širini od 1100 px pored koraka stoji lepljiv pregled: postupak (veze do koraka), potreban materijal (sa brojem koraka) i proizvodi (sa brojem koraka). Uže je pregled iznad koraka, bez spiska proizvoda (proizvodi su uz korake).
4. **Korak:** naziv, jedna kratka instrukcija (`what`, doslovno), **„Važno:“** sa uslovima primene, materijal, proizvodi kao male veze. Na otvaranje: „Zašto“, vrednosti (skala), izvor i tehnički listovi proizvoda.
5. Izbor je u adresi: `?posao=<id>&izbor=<id>`. Veza sa izabranim poslom otvara rezultat.

### Odluke (reverzibilne)
- **Sažet pregled svih koraka umesto jednog koraka odjednom.** Postupci imaju 3–8 koraka sa kratkom instrukcijom; svi koraci odjednom omogućavaju poređenje i povratak bez klikanja. Detalji su po koraku, uz dugme „Otvorite sve detalje“.
- **Uslovi primene se ne skrivaju.** Rečenica iz objašnjenja koja sadrži temperaturu (°C), vreme (min, h, s), „temperatur…“, „obavezno“, „mora“, „ne sme“ ili „ne smeju“ prikazuje se odmah kao „Važno:“. Rečenice se ne menjaju, samo se razdvajaju (test `lib/sistemi/guide.test.mts`). Ostatak objašnjenja je „Zašto“.
- **Nijedan posao nije unapred izabran**, da posetilac ne bi čitao postupak koji ne radi.
- **Pitanja bez teksta dobila su kratku oznaku** (Priprema: „Šta se lakira“, „Podloga“). To je oznaka interfejsa, nije stručni sadržaj.
- Odeljci „Izbor materijala“ i „Česte greške“ ostaju kao do sada (kartice i harmonika).

## Biblioteka dokumentacije
- Pretraga po nazivu, šifri ili brendu i brend kao padajući izbor, u istom redu.
- Vrsta u tri jasne grupe: **Tehnički list**, **Bezbednosni list**, **Ostali dokumenti** (uz kratak opis čemu služi). Unutar „Ostalih“ se bira uputstvo, informacije, izjava ili katalog.
- Red dokumenta: oznaka vrste (bezbednosni list je istaknut), naziv i proizvodi, brend, veza.
- Izbor je u adresi (`?q=&vrsta=&brend=`); „Poništite filtere“.
- Odeljak „Koji dokument mi treba?“ je uklonjen: isti opisi su sada na izboru vrste.

## B2B saradnja
- Tri koraka: **Vrsta firme → Podaci → Slanje iz Vašeg programa za e-poštu**. Formular se pojavljuje tek posle izbora vrste firme, sa poljem i spiskom „Pripremite“ za tu vrstu.
- Treći korak postaje aktivan kada je poruka pripremljena. Obaveštenje „Poruka još nije poslata“ i kopiranje poruke ostaju nepromenjeni.
- Uklonjen je blok „Šta da pripremite / Prvi korak / Program“; „Pripremite“ je uz formular, „Uslove saradnje dogovarate sa timom“ ostaje.

## Pregledni ulaz
- `/sistemi-i-programi`: sedam kartica sa vezama direktno na poslove (`?posao=…#poslovi`), na tehničke i bezbednosne listove i na korake B2B toka.
- Podmeni dobija stavku „Pregled“. Zaglavlje sajta (zaključana početna) nije menjano.

## Uklonjeni interni tekstovi (objavljeno, PR #48)
Vrste: statusi odobravanja fotografija, pominjanje internog fajla kandidata i izvora slika (Surventis), statistika pokrivenosti biblioteke, opis procesa provere tekstova, „u pripremi“ napomene praznih stanja, engleske oznake na stranici „sajt u pripremi“, uputstva koja samo opisuju interfejs („Izaberite…“, „Pređite mišem…“, „Osnovni koraci su odmah vidljivi…“, „Upit stiže timu…“).

Zadržano namerno: stručne i bezbednosne napomene, oznake formulara, poruke greške, „Poruka još nije poslata“, „Na upit“, „Vizuel u pripremi“ (stanje slike), pravno oprezne formulacije (Carsystem primeri kombinacija, R-M paste).

### Otvoreno za odluku (nije menjano)
- Baslac nazivi baza „Naziv nije objavljen“ u biraču i katalogu (prikazati samo šifru?).
- R-M paste: „linija nije potvrđena“ u nazivu sistema i navigaciji (pravno oprezno; predlog „R-M paste za mešanje“).
- „Približna lokacija — tačna pozicija još nije potvrđena.“ na /prodavnice (predlog „Približna lokacija na mapi.“).
- Dugme za temu ne postoji na širini do 900 px (zaglavlje); ostavljeno za mobilnu fazu.
