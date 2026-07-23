# Product detail content review

Ovaj dokument prati product relationships koje još ne smeju biti objavljene ili zahtevaju dodatnu lokalnu potvrdu. Javni product page prikazuje samo sekcije i stavke sa statusom `confirmed`.

## Pravilo objave

- `compatibleProducts` znači da zvanični izvor potvrđuje da se proizvodi koriste zajedno.
- `alternativeProducts` znači da proizvodi pripadaju istoj ili neposredno uporedivoj kategoriji i nameni.
- Zvanična preporuka nije dovoljna za javnu karticu ako odgovarajući proizvod nema potvrđen lokalni product zapis, naziv, sliku i rutu.
- Gitovi, prajmeri i drugi koraci pripreme ne povezuju se automatski sa abrazivom bez eksplicitnog zvaničnog izvora.

## Carsystem Sanding Disc F.23 Ceramic

### Kompatibilni proizvodi - `needs_confirmation`

| Kandidat | Zvanična potvrda | Lokalna potvrda | Odluka |
| --- | --- | --- | --- |
| Carsystem Interface Pad, 150 mm | Zvanična F.23 stranica ga navodi u delu "We recommend"; zvanična Interface Pad stranica eksplicitno navodi upotrebu sa F.23 diskom. | Ne postoji potvrđen lokalni product zapis. | Ne prikazivati javno. Kreirati i potvrditi lokalni zapis pre promene statusa u `confirmed`. |
| Carsystem Excenter Back Pad T.19, 150 mm | Zvanična F.23 stranica ga navodi u delu "We recommend"; isti raspored ima 25 rupa i ovalni centralni otvor. | Ne postoji potvrđen lokalni product zapis. | Ne prikazivati javno. Kreirati i potvrditi lokalni zapis pre promene statusa u `confirmed`. |

Nisu dodati gitovi, prajmeri ili druge podloge: pregledani F.23 TDS i zvanična product stranica ne daju eksplicitnu product-level preporuku za takve veze.

### Alternative - `confirmed`

| Proizvod | Osnov potvrde | Odluka |
| --- | --- | --- |
| Carsystem Sanding Disc F.19, 150 mm / 25 rupa | Zvanična F.23 stranica ga navodi među daljim proizvodima; zvanična F.19 stranica potvrđuje isti format filmskog abrazivnog diska i namenu od grubog do finog brušenja. Lokalni product zapis postoji. | Prikazati u `alternativeProducts`. |
| Carsystem Sanding Disc P.19, 150 mm / 25 rupa | Zvanična F.23 stranica ga navodi među daljim proizvodima; zvanična P.19 stranica potvrđuje papirni abrazivni disk iste dimenzije i rasporeda rupa za grubo do fino brušenje. Lokalni product zapis postoji. | Prikazati u `alternativeProducts`. |

## Carsystem Sanding Disc F.19

### Relationship onboarding - `needs_confirmation`

Zvanični izvori podržavaju Interface Pad i Excenter Back Pad T.19 kao kompatibilne dodatke za F.19, ali oba lokalna product zapisa još nedostaju. F.19 trenutno nema reviewed product-detail relationship sadržaj, pa se nijedna relationship sekcija ne prikazuje automatski. Kada F.19 dobije kompletan reviewed detail zapis, odnose treba uneti kroz `compatibleProducts` i `alternativeProducts`, bez korišćenja legacy `relatedProductSlugs` kao javne potvrde.

## Pregledani zvanični izvori

- [Carsystem Sanding Disc F.23 Ceramic](https://www.carsystem.org/en/products/detail/abrasives/sanding-disc-f23-ceramic-film-abrasive-150-mm-25-holes)
- [Carsystem F.23 Ceramic TDS, V01, 02/2024](https://www.carsystem.org/fileadmin/products/datasheets/tds-sanding-disc-f-23-ceramic-v01.pdf)
- [Carsystem Interface Pad, 150 mm](https://www.carsystem.org/en/products/detail/abrasives/interface-pad-interface-pad-150-mm)
- [Carsystem Excenter Back Pad T.19, 150 mm](https://www.carsystem.org/en/products/detail/abrasives/excenter-back-pad-t19-back-pad-150-mm)
- [Carsystem Sanding Disc F.19, 150 mm / 25 rupa](https://www.carsystem.org/en/products/detail/abrasives/sanding-disc-f19-film-abrasive-150-mm-25-holes.html)
- [Carsystem Sanding Disc P.19, 150 mm / 25 rupa](https://www.carsystem.org/en/products/detail/abrasives/sanding-disc-p19-paper-abrasive-150-mm-25-holes)
- Lokalna kopija zvaničnog TDS-a: `public/documents/products/carsystem/carsystem-f23-brusni-diskovi-tds.pdf`

Poslednja provera: 22. jul 2026.

## Product family i variant potvrde

Sledeće odluke ostaju otvorene i ne smeju se popunjavati pretpostavkama:

- Koje Cosmos kolekcije i boje trenutno stvarno držimo?
- Koje Easy Max boje ulaze u prvi katalog?
- Koje F.19 i F.23 granulacije držimo?
- Koje kombinacije dimenzije i rasporeda rupa postoje?
- Koje boje i tvrdoće sunđera imamo?
- Koje R-M serije predstavljamo jednom reprezentativnom karticom?
- Koje baslac serije predstavljamo jednom reprezentativnom karticom?
- Koji modeli i brojevi postoje unutar svake R-M i baslac serije?
- Koje varijante zaslužuju zasebnu SEO stranicu?
- Koje varijante ostaju samo izbor na product family stranici?

Trenutna javna implementacija koristi potvrđene F.23 šifre, zvanično generisane Cosmos Lac varijante i postojeće Befar boje/dimenzije. Tvrdoća Befar sunđera, R-M/baslac modeli i stvarna lokalna dostupnost nisu potvrđeni, pa se ne prikazuju kao izabrive vrednosti.
