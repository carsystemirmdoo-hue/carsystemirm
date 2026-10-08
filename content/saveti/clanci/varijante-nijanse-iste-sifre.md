---
id: SV-0084
slug: varijante-nijanse-iste-sifre
naslov: Varijante nijanse iste šifre boje
metaNaslov: "Varijante nijanse iste šifre: kako izabrati pravu"
opis: "Zašto ista fabrička šifra boje ima više varijanti, kako su varijante označene u bazi recepata i kako se pravilno bira i proverava prava varijanta."
kategorija: boje-i-nijanse
podtema: varijante nijansi
tip: resavanje-problema
publika:
  - hobista
  - profesionalac
glavnoPitanje: Zašto ista fabrička šifra boje ima više varijanti i kako se bira prava?
namera: rešavanje problema
dodatnaPitanja:
  - Gde se nalaze varijante u alatu za nijanse?
poreklopitanja:
  tip: pronadjeno-u-izvoru
  napomena: "Na domaćem forumu se pita kako pogoditi nijansu kada ista šifra ima više varijanti (primer vozila Renault); isto pitanje postoji i na stranim forumima."
  izvori:
    - https://www.samsvojmajstor.com/portal/forums/uradi-sam/popravka-automobila/farbanje-auta?page=3
    - https://fiatforum.com/threads/bossa-nova-white-paint-codes.430475/latest
brendovi:
  - rm
  - baslac
proizvodi:
  - rm-onyx-hd
  - rm-agilis
  - grupa:baslac-line-45
  - grupa:baslac-line-35
povezani:
  - SV-0082
  - SV-0083
  - SV-0096
  - SV-0093
  - SV-0005
izvori:
  - id: baslac-color-chips
    naziv: "baslac, Color Chips (baslac Effective Color Finder i postupak provere nijanse)"
    url: https://www.baslac.com/en-emea/color-chips
    pristupljeno: 2026-10-08
    tip: sajt-proizvodjaca
  - id: rm-color-competence
    naziv: "R-M, Color Competence"
    url: https://www.rmpaint.com/en-int/color-competence
    pristupljeno: 2026-10-08
    tip: sajt-proizvodjaca
  - id: rm-digital-color-search
    naziv: "R-M, Digital color search (Colortronic 12/6)"
    url: https://www.rmpaint.com/en-int/digital-color-search
    pristupljeno: 2026-10-08
    tip: sajt-proizvodjaca
  - id: baslac-efinder-star
    naziv: "baslac, A perfect finish with baslac® e-finder star"
    url: https://www.baslac.com/en-emea/news/perfect-finish-baslacr-e-finder-star
    datumIzvora: 2023-04-17
    pristupljeno: 2026-10-08
    tip: vest-proizvodjaca
  - id: inform-basic-color
    naziv: "Info R-M, Basic Knowledge „Color“ (javni opis modula 2026-0002-RM)"
    url: https://info.rmpaint.com/processes/basic-knowledge-color
    pristupljeno: 2026-10-08
    tip: edukacija-proizvodjaca
prioritet: 215
razlogPrioriteta: Rešava konkretan problem iz prakse; raspoređeno naizmenično sa drugim temama.
status:
  istrazivanje: zavrseno
  pisanje: napisano
  tehnickaProvera: provereno
  jezickaProvera: provereno
napomenaProvere: "urednička provera (AI-asistirana) 2026-10-08: otvorene stranice baslac Color Chips i e-finder star, R-M Color Competence i Digital color search, Info R-M Basic Knowledge Color; navodi o varijantama i alatima se poklapaju; preklapanje sa SV-0082 prihvatljivo (SV-0082 je pregled i linkuje ovde). Bez izmena u sadržaju."
strucnaPotvrda:
  potrebna: false
  status: nije-potrebno
poslednjaProvera: 2026-10-08
ponovniPregled: 2027-04-08
---
Šifra boje označava nijansu koju je propisao proizvođač vozila, ali boja na pojedinačnim vozilima sa istom šifrom ne mora biti potpuno ista. Zato baze recepata uz standardnu recepturu vode i varijante, opisane kao odstupanje od standarda u određenom smeru: tamnije, plavlje, sitnije ili krupnije metalik čestice[^baslac-color-chips]. Prava varijanta se ne bira po šifri, nego poređenjem sa vozilom i probnim limom.

## Kako izgleda problem

Boja je zamešana po šifri, naneta pravilno, a ipak se razlikuje od susednog dela: malo tamnija, toplija ili drugačijeg metalik efekta. To ne znači obavezno da je receptura pogrešna ili da je boja loše zamešana. Moguće je da vozilo jednostavno odgovara nekoj drugoj varijanti iste šifre.

## Mogući uzroci razlike

Razlika između nove boje i vozila sa istom šifrom može imati više uzroka. Konačan uzrok zavisi od vozila, materijala i postupka, pa se proverava redom:

- **Vozilo odgovara drugoj varijanti.** Standardna receptura je polazna tačka, a baza nudi i varijante[^baslac-color-chips].
- **Boja na vozilu se promenila.** Stariji lak može da izgleda drugačije od nove boje iste recepture. O tome je vodič [Nijansa na izbledelom vozilu](/vodici/nijansa-i-izbledeli-lak).
- **Postupak nanošenja.** Broj slojeva, odzračivanje i završni sloj za efekat menjaju izgled, posebno kod metalika. Vidi vodič [Koliko slojeva bazne boje treba](/vodici/koliko-slojeva-bazne-boje).
- **Uslovi poređenja.** Neispolirana površina ili samo jedan izvor svetla mogu da zavaraju.

## Kako se bira prava varijanta

1. **Standard prvo.** Kartica standardne recepture se prisloni uz očišćen i ispoliran deo vozila, na dnevnom svetlu ili pod lampom dnevnog svetla[^baslac-color-chips].
2. **Smer odstupanja.** Ako postoji razlika, odredite kakva je: da li je vozilo tamnije, svetlije, plavlje, žuće, ima li krupniji ili sitniji metalik. To je jezik kojim baza opisuje varijante.
3. **Varijanta u bazi.** baslac navodi da se u bazi Formula Finder proveri da li postoje varijante, i da se za varijantu koja odstupa u potrebnom smeru napravi probni lim[^baslac-color-chips]. Kod R-M sistema baze i alati za nijanse su Color Explorer, Colormaster i Refinity[^rm-color-competence].
4. **Merenje uređajem**, ako je dostupno. Spektrofotometar predlaže recepturu na osnovu merenja. Za baslac e-finder star proizvođač navodi merenje iz pet uglova i vezu sa bazom Formula Finder[^baslac-efinder-star], a za R-M Colortronic 12/6 vezu sa bazom i mešaonom[^rm-digital-color-search].
5. **Probni lim.** Izabrana varijanta se proverava na probnom limu, istim postupkom kao na delu. Postupak je u vodiču [Probni lim: zašto se radi pre lakiranja](/vodici/probni-lim-pre-lakiranja).

Ako nijedna varijanta ne odgovara dovoljno, pomoć može da da tehnička podrška proizvođača ili prodavca boje. R-M u edukativnom modulu o boji obrađuje i alate za procenu nijanse[^inform-basic-color]. Prelaz na susedni deo može dodatno da sakrije malu razliku, o čemu govori vodič [Utapanje metalika u susedni deo](/vodici/utapanje-metalika).

## Šta ne treba raditi

- Ne birati varijantu samo po opisu, bez poređenja sa vozilom.
- Ne „popravljati“ nijansu menjanjem broja slojeva ili razređenja izvan tehničkog lista. Tako se menja i kvalitet sloja, a ne samo nijansa.
- Ne upoređivati sa delom koji nije očišćen i ispoliran.

## Pitanja i odgovori

### Gde se nalaze varijante u alatu za nijanse?

Varijante se nalaze u bazi recepata, uz standardnu recepturu iste šifre. Kod baslac sistema to je Formula Finder, a kartica u kolekciji baslac Effective Color Finder predstavlja standardnu recepturu[^baslac-color-chips]. Kod R-M sistema traži se kroz Color Explorer ili Refinity[^rm-color-competence]. Novu funkciju prikaza u Refinity platformi opisuje vest [R-M LightAssist u Refinity](/vodici/rm-lightassist-u-refinity).

### Da li je standardna receptura uvek prava?

Ne mora biti. Standard je polazna tačka i opis svake varijante se odnosi na njega[^baslac-color-chips], ali da li vozilo odgovara standardu ili varijanti, pokazuje samo poređenje.

### Koliko varijanti može da ima jedna šifra?

Zavisi od šifre i od baze proizvođača boje. Neke šifre nemaju varijante, druge ih imaju više. Broj vidite tek u bazi za konkretnu šifru.
