# Cosmos Lac catalog sync

| | |
|---|---|
| Izvor | `https://cosmoslac.com/` (engleski je referentni jezik; ostali jezici su dokaz regionalne objave) |
| Komanda | `npm run cosmos-lac:sync` (mreža) · `npm run cosmos-lac:sync:check` (bez mreže, iz commitovanog `raw/`) |
| Model | HIBRIDNI — linija boja = jedna kartica; različiti zvanični proizvodi = različite kartice |
| Pokrivenost | A = B (zvanični proizvodi u opsegu) · C = D (identiteti nijansi/varijanti) — brojevi se RAČUNAJU, vidi `scope-lock.json` |

## Tri nivoa proizvođača

| Nivo | Dokaz na zvaničnom sajtu |
|---|---|
| Linija | segment adrese `/products/{category}/{family}/` + naziv iz breadcrumb-a |
| Proizvod | zvanični dokument „Product info" / TDS — isti PDF dele sve nijanse jednog proizvoda (`bumper-paint.pdf`) |
| Nijansa / varijanta | zasebna stranica sa šifrom u nazivu i adresi (RAL 1007, FB-100, N01, 260) |

Cosmos Lac ne objavljuje EAN ni brojeve artikala; zvanična „šifra" je oznaka u nazivu i adresi.

## Šta sync radi, a šta ne dira

Postojeći `data/cosmos-lac-products.generated.json` (742 zapisa iz **zvaničnog Brand Kit-a**, sa slikama i SHA
poreklom) se **ne prepisuje i ne regeneriše** — njegov generator zavisi od `tmp/cosmos-lac-assets/`, kojeg u
čistom checkout-u nema. Sync preko tih zapisa polaže dopunu u
`data/cosmos-lac-catalog-products.generated.json`:

- zvanični identitet (adresa, naziv, šifre, zvanični proizvod) i status (`CURRENT` / `CURRENT_REGION_SPECIFIC` / `LEGACY_LOCAL_ONLY`);
- zvanični dokument proizvoda (isti svim njegovim nijansama);
- status pakovanja;
- grupu (karticu) — menja se samo tamo gde je stara kartica mešala različite proizvode;
- nove zapise za zvanične stranice koje nismo imali (placeholder slika);
- preusmerenja za porodične adrese koje podela gasi (`next.config.ts` ih učitava iz dataseta).

## Poklapanje — determinističko, bez sličnosti naziva

1. **Naziv fajla u Brand Kit-u = zvanična adresa** (`ral-9003-signal-white-v2.png` → `/ral-9003-signal-white/`). Najjači ključ.
2. Šifra (ili RAL) u adresi, unutar očekivane linije; istu šifru u dva završna sloja razdvaja zvanična reč (gloss / matt / semigloss).
3. Naziv nijanse u adresi — samo kada zapis nema šifru.
4. Ista šifra u istoj liniji na drugom jeziku zvaničnog sajta → `CURRENT_REGION_SPECIFIC`, uz adrese kao poreklo.

`SOURCE_TITLE_INCONSISTENCY`: dve zvanične stranice nose pogrešan naslov (RAL 9003 pod „Ral 9002 – Grey White",
Fast Acrylic 8017 pod „8011 – Nut Brown"). Adresa + šifra u adresi + Brand Kit imaju prednost nad naslovom.

## Opseg

- **U opsegu:** svi zvanični proizvodi osim navedenih ispod; uključeni su i novi Acrylic Varnish, Chrome Effect Container, Effect Container i High Heat Container.
- **`CURRENT_OUT_OF_SCOPE`** (aktuelno kod proizvođača, nije uvezeno, ne broji se kao „nedostaje"): SportPens, Wood Glue, Acryl Fresh, Plastic Paint Fresh, Wood Varnish.
- **`CURRENT_REGION_SPECIFIC`:** zapisi koje engleski sajt nema, a `bg/de/da/fi/sv/hu` imaju (Antichip 250/252 i devet Spray.Bike nijansi). Aktuelni su i nose `sourceLocales`.
- **`LEGACY_LOCAL_ONLY`** (netaknuto): Molotow Premium/Burner (73 zapisa, 2 kartice — linija koje na cosmoslac.com nema) i šest zapisa bez ijedne zvanične stranice (Backlight 712, Forest Marking 574/575, Radiator Lacquer 403, Metallic 334, Spray.Bike 231).

Opseg se zaključava u `data/cosmos-lac-sync/scope-lock.json` (`plan.mjs --write-lock`, posle odobrenja). Plan pada na
svaku razliku: `SCOPE_DRIFT_WITHOUT_SOURCE_CHANGE` (greška u pravilima) ili `SCOPE_CHANGED_WITH_SOURCE` (traži novo odobrenje).

## Podela sedam kartica (+14)

| Stara kartica | Naslednici | Stara porodična adresa |
|---|---|---|
| lubricants-oil | 6 samostalnih | → katalog `q=Lubricants Oil` |
| lubricants-grease | 4 samostalne | → katalog `q=Lubricants Grease` |
| putties-filler | 3 samostalne | → katalog `q=Putties Filler` |
| varnishes | Tinted Wood Varnish (porodica) + Metal Varnish | → katalog `q=Varnishes` |
| w-wood-care | W Wood Impregnating Varnish + W Water Based Varnish (porodice) | → katalog `q=W Wood Care` |
| wheel-rim | Wheel Rim (ZADRŽAVA adresu) + Wheel Rim Deluxe | bez preusmerenja |
| zinc | 2 samostalne | → katalog `q=Zinc` |

Duboka veza `…/grupa/<stara>?varijanta=<šifra>` vodi na TU varijantu. Upiti su izabrani merenjem nad stvarnim
indeksom: svi naslednici su na vrhu rezultata. `data/cosmos-lac-sync/baseline-urls.json` čuva adrese iz stanja pre
synca; reconcile i test dokazuju **0 polomljenih adresa**.

## Pakovanja

Status kaže ŠTA KUPAC VIDI i odakle to dolazi:

| Status | Kada | Kupac vidi |
|---|---|---|
| `OFFICIAL_CURRENT` | zvanična stranica navodi pakovanje | zvanično pakovanje |
| `LOCAL_EXISTING` | zvanična stranica ga ne navodi, katalog ga ima | postojeći podatak, neizmenjen |
| `SOURCE_UNSPECIFIED` | nema ga ni izvor ni katalog | ništa (ne izmišlja se) |

Lokalni podatak se **nikad ne briše**: i kada se razlikuje od zvaničnog ostaje u datasetu (`packaging.local`,
`localDiverges`), samo se ne prikazuje uporedo. Više lokalnih zapisa na jednoj zvaničnoj stranici su varijante
pakovanja (Fiberglass 1 kg / 5 kg) — svaki prikazuje svoje.

**Data binding (bez promene layouta).** `catalogMetadata.volume` ostaje podatak kataloga, jer na njega naležu razmera
ambalaže, ose varijanti i pretraga. Potvrđeno pakovanje ide u generičko, opciono `catalogMetadata.customerPackage`, a
`getProductPackageLabel()` (`lib/carsystem-data.ts`) je jedino mesto odluke za oba mesta na kojima PDP ispisuje
„Pakovanje" aktivne varijante (birač varijanti i pogled varijante). Bez tog polja vraća isto što i ranije, pa se
nijedan drugi brend ne menja. Kada je potvrđeno pakovanje jedna mera različita od `volume`, i oznaka količine na
ambalaži (`size`) dobija potvrđenu meru, da ne protivreči redu „Pakovanje".

**Tehnički podaci prate aktivnu varijantu.** Tabela se ranije računala jednom, iz predstavnika porodice, pa su
„Pakovanje", „Nijansa", „RAL" i šifra ostajali predstavnikovi i kada kupac izabere drugu nijansu. Sada ih nosi svaki
`ProductVariantView` (`productTechnicalFactList.ts`), isti obrazac kao za dokumente. Generička ispravka: važi i za
baslac i Norbin porodice; proizvodi čije su varijante redovi jedne tabele (Carsystem, C.A.R.FIT, Befar, SATA) dele
iste podatke, pa se za njih ništa ne menja.

## Dokumenti i slike

- Dokument je na nivou PROIZVODA. SDS proizvođač ne objavljuje — ne izmišlja se. Dokument koji zvanični sajt ne
  isporučuje (`Penetrating-Oil-V01_tds.pdf`, 404) se ne prikazuje; ostaje zabeležen kao `documentSourceBroken`.
- 742 lokalne Brand Kit slike se ne menjaju. Nijedna slika se ne preuzima sa sajta ni od trećih strana; novi zapisi
  koriste placeholder. Brand Kit fajlovi koji postoje za nove stranice pripadaju isključivo proizvodima van opsega.

## Zamke za sledeće pokretanje

1. Relativan `href="/pdfs/products/en/…"` — u avgustu 2026 je zbog toga zaključeno da dokumenata nema.
2. Engleski sajt je PODSKUP: drugi jezici imaju više stranica; segment linije je preveden, pa se linija prepoznaje po šiframa.
3. Naslov stranice nije pouzdan ključ (vidi `SOURCE_TITLE_INCONSISTENCY`); adresa jeste.
4. Porodična adresa se izvodi iz zajedničkog naziva varijanti — nova varijanta može da je pomeri. Nove i nasleđene
   porodice zato nose `familyIdentity`, a `baseline-urls.json` hvata svaku promenu.
5. `npm run cosmos:validate` radi iz čistog checkout-a: proverava Brand Kit dataset + 742 objavljene slike (SHA) i
   dopunu synca; SHA IZVORNIH fajlova proverava samo kada je Brand Kit prisutan. `cosmos:build`/`cosmos:update`
   regenerišu dataset iz Brand Kit-a, pa ga po prirodi traže (strogi režim `--require-source-assets`).
