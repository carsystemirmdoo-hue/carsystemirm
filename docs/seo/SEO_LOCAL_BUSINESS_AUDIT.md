# Local SEO i poslovni podaci

## Provereni podaci

- Javno prikazanih lokacija: 91.
- Lokacija sa statusom verified: 9.
- Lokacija sa statusom pending: 82.
- Store/LocalBusiness JSON-LD se generiše samo za devet verified lokacija.
- Svaki schema objekat koristi isti vidljivi naziv, adresu, grad, telefon i koordinate kao kartica lokacije.
- Pending lokacije ostaju vidljive u postojećem lokatoru, ali ne dobijaju LocalBusiness schema tvrdnju.
- Mapa koristi OpenStreetMap vezu; nije dodat plaćeni map servis.

## Organization odluka

Početna koristi minimalni Organization + WebSite + WebPage graf sa potvrđenim nazivom sajta, produkcionim URL-om i postojećim logotipom. U Organization schema nisu dodati:

- placeholder telefon +381 22 000 000;
- placeholder email office@carsystemirm.com;
- gradske koordinate kao tačna adresa centrale;
- neprovereni društveni profili;
- neprovereno radno vreme.

Ti podaci i dalje postoje u prethodno napravljenom UI contact modelu i zahtevaju poslovnu potvrdu; SEO implementacija ih nije predstavljala kao potvrđene structured-data činjenice.

## Ručne radnje

1. Potvrditi pravni naziv, ulicu, poštanski broj, telefon, email i radno vreme centrale.
2. Tek posle potvrde dopuniti Organization/ContactPoint schema i vidljivi kontakt UI istim NAP vrednostima.
3. Vlasnik svake lokacije treba da potvrdi naziv, kategoriju, adresu, telefon, radno vreme i Google Business Profile URL.
4. Uskladiti NAP na sajtu, fakturama, registrima i Google Business Profile profilima.
5. Prebaciti lokaciju iz pending u verified tek nakon dokumentovane provere.
6. Ne praviti city landing stranice bez jedinstvenog sadržaja i stvarne lokalne ponude.
