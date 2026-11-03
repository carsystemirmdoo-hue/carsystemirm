# Naselja Srbije za pretragu najbližih lokacija

Pretraga mesta na početnoj (widget „Pronađite najbližu prodavnicu“ i odeljak mreže) i na `/prodavnice` koristi spisak svih naselja Srbije. Posetilac upiše mesto, izabere ga, i vidi **sve** javno odobrene partnerske lokacije poređane od najbliže.

## Izvor

| | |
|---|---|
| Izvor | OpenStreetMap — granice naselja (`boundary=administrative`, `admin_level=9`) unutar granice Srbije, sa RZS matičnim brojem naselja (`ref:RS:naselje`) i brojem stanovnika iz popisa 2022 (`population:census:2022`) |
| Preuzeto | 2026-11-03 (stanje OSM baze `2026-11-03T13:10:33Z`), preko Overpass API-ja |
| Licenca | [Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/1-0/) |
| Atribucija | „© OpenStreetMap saradnici“ — prikazana uz rezultate na `/prodavnice` i u mapi (atribucija pločica) |
| Skripta | `scripts/places/build-settlements.mts` (`npm run places:build`; sa `--preuzmi` ponovo preuzima) |
| Podaci | `public/podaci/naselja-srbije.json` (kompaktan skup, ≈ 230 KB, ≈ 90 KB gzip; pregledač ga učitava tek kada korisnik otvori izbor mesta) |
| Pokrivenost | `data/places/naselja-srbije.pokrivenost.json` (brojevi, upiti, izuzeci) |

Zašto ne RZS ili RGZ direktno: šifarnik naselja RZS nema koordinate, a granice prostornih jedinica RGZ-a (GeoSrbija) nisu objavljene kao otvoreni podaci. OSM granice naselja nose RZS matični broj, pa je spisak isti kao zvanični, a tačka i opština dolaze iz OSM-a. GeoNames je proveren i odbačen: ~9.500 tačaka sa duplikatima i zaseocima, bez opštine.

## Pokrivenost (2026-11-03)

- **4.721 naselje**, svako sa RZS matičnim brojem; 4.720 ima broj stanovnika iz popisa 2022, 24 su po popisu nenaseljena (ostaju u pretrazi, jer su zvanična naselja).
- **167 opština, gradskih opština i gradova** (opština ili gradska opština gde postoji, inače grad).
- AP Kosovo i Metohija nije obuhvaćena: popis 2022 tamo nije sproveden, pa OSM granice naselja tog područja nemaju RZS broj u ovom skupu. Partnerska mreža tamo nema lokacija.
- 413 naziva se ponavlja (npr. četiri „Lipovice“, više „Grabovaca“). Oznaka za izbor je „naziv, opština“ i jedinstvena je za ceo skup (proverava je i skripta i test).
- Reprezentativna tačka: centar naselja iz OSM-a (`admin_centre`, 4.640), inače oznaka (`label`, 77), inače središte granice (4).
- Opština 4 naselja određena je po najbližem susednom naselju, jer im centar u OSM-u leži na samoj granici (spisak u fajlu pokrivenosti).
- Isključen 1 zapis bez RZS broja (granica iz susedne države koja ulazi u upit).

## Pravila prikaza

- Pretraga prihvata latinicu, ćirilicu i unos bez dijakritike (`Cacak`, `Чачак`, `Čačak`); Đ/„dj“/„d“ se izjednačavaju. Logika: `lib/places/serbian-places.ts`, testovi: `npm run test:places`.
- Izbor mesta **ne filtrira** listu: prikazuju se sve javno odobrene lokacije (`isPubliclyListedStore`), od najbliže.
- Udaljenost je **vazdušnom linijom** od reprezentativne tačke mesta i uvek je označena kao približna; nije kilometraža vožnje (nema servisa za rutiranje).
- Lokacije bez koordinata nemaju broj km i idu u posebnu grupu na kraju liste. Oznaka „približna lokacija“ ostaje uz lokacije sa približnim koordinatama.
- Filter „Gde kupiti“ / „Servisi i lakirnice“ / „Sve“ postoji samo za vrste lokacija koje su potvrđene za javni prikaz (`data/public-location-decisions.json`); lokacije na čekanju se ne uključuju.
- Navigacija: veza ka OpenStreetMap uputstvima za vožnju od izabranog mesta do lokacije (besplatno, bez ključa).

## Uslovi korišćenja (ODbL) — šta to znači ovde

- Skup `public/podaci/naselja-srbije.json` je izvedena baza iz OSM-a i dostupan je pod ODbL 1.0 (repozitorijum je javan, a fajl se isporučuje uz sajt).
- Uz prikaz koji koristi skup stoji atribucija „© OpenStreetMap saradnici“.
- Broj stanovnika potiče od RZS (popis 2022) preko OSM oznaka.

## Osvežavanje

```bash
npx tsx scripts/places/build-settlements.mts --preuzmi
npm run test:places
```

Posle osvežavanja proveriti fajl pokrivenosti (broj naselja, izuzeci) i ažurirati datum u ovom dokumentu.
