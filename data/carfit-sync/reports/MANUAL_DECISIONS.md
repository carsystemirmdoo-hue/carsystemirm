# C.A.R.FIT sync — šta vlasnik treba da zna (2026-09-19)

Svaki aktivan naručiv proizvod sa carfitrepair.com je u našem katalogu:
**123 / 123 porodice, 357 / 357 šifara** (`npm run carfit:sync:reconcile`).
Ništa odavde ne blokira paritet. Odluke se upisuju u
`data/carfit-sync/manual-decisions.json`, pa `npm run carfit:sync:apply`.

## 1. Naši raniji ručni zapisi

| Zapis | Ishod | Dokaz |
|---|---|---|
| `carfit-maskirna-folija-4x5m` | HIGH_CONFIDENCE_MATCH → dopunjen šiframa 1-201-0450 / -0470 / -0570; nije uvezen drugi put. Od 2026-09-19 (odluka vlasnika, `useOfficialPresentation`) prikazuje se kao porodica **„Car Fit Masking film 7 μm with electrostatic effect”**; slug i URL su isti, dimenzije su varijante, prikazana šifra je 1-201-0450 umesto placeholdera | naša slika je bajt-identična zvaničnoj slici „Masking film 7mm with electrostatic effect”, a ručno pakovanje 4 × 5 m = zvanična varijanta 1-201-0450. „7mm” u zvaničnom nazivu je greška jedinice (zvanična debljina je 7 μm), pa naziv nosi „7 μm” |
| `carfit-maskirna-folija-4x150m` | LOCAL_ONLY_UNKNOWN → ostaje legacy, nije diran, bez šifre proizvođača | dimenzija 4 × 150 m ne postoji ni na sajtu ni u PDF-u (postoje 4 × 200 m i 4 × 300 m); placeholder SKU, placeholder slika. Status se vodi u izveštajima synca jer model nema polje porekla nevidljivo kupcu |

Predlog: zapis `…-4x150m` povući ili zameniti kada se potvrdi koja je dimenzija stvarno u prodaji.

## 2. Greške na sajtu / u katalogu proizvođača (razrešene pravilom, vredi javiti proizvođaču)

| Šifra | Nalaz | Šta prikazujemo |
|---|---|---|
| 6-500-1000 / -1500 / -2000 (Red Film) | sajt piše P500 / P600 / P800, PDF i sama šifra P1000 / P1500 / P2000 | P1000 / P1500 / P2000 |
| 4-205-3600 (2K HS Acryl Primer Filler) | sajt „0,8 l, white”, PDF i šifra 3,6 l | 3,6 l, bela |
| 4-304-3600 ↔ 4-204-3600 | sajt: 4-304-3600 „0,8 l, black”; PDF str. 11: 4-204-3600 „3.6 L black” — jedna cifra razlike, ista boja, prefiks 4-304 ne postoji nigde drugde → verovatna slovna razlika | JEDNA varijanta „Punilac · 3,6 l, crna”: red nosi šifru sa sajta 4-304-3600, a 4-204-3600 je alternativni zapis (pretraživ, naveden u napomeni tabele), ne druga varijanta |
| 7-437-2501, 7-321-0501, 7-321-2501 | PDF red ima pogrešnu zapreminu/brzinu | vrednost sa sajta (potvrđuje je šifra) |
| 4-420-3000 (2K Fast Air Primer Filler) | ista šifra uz „3 l, grey” i „3 l, black” na istoj stranici | jedan red „3 l, siva / crna” |
| 6-901-0002, 6-902-0001 (Abrasive Fleece) | sajt kopira opis susedne šifre; PDF ih razlikuje (ultra fine grey / very fine red) | prema PDF-u |
| 4-242-1000, 7-322-0501 | u PDF-u ista šifra dva puta sa različitim tekstom | šifra se ne koristi za atribute iz PDF-a |
| 7-401-1000 / -5000 | lak naveden na stranicama „2K Ultra HS Clearcoat” i „2K UHS low VOC Clearcoat” | vlasnik je Ultra HS (ista PDF porodica); low VOC ih vodi kao „šifra u sistemu” |
| 9-171-1905 | na stranicama „PE mounting tape” i „Double-sided adhesive tape” | vlasnik je PE mounting tape (serija 9-171-xxxx); druga stranica nema svoju karticu — isti artikal |
| Fast Paint System | skraćenica „3-225-0125/2125/4125/8125”; PDF iste posude vodi kao 3-227-2125… | sve šifre sa sajta + PDF šifre kao varijante |
| Ozone Generators | stranica ne navodi šifru | 6-980-0001 iz PDF porodice istog naziva |

## 3. U PDF katalogu 2026, a bez stranice na sajtu — `CATALOGUE_ONLY_NOT_ON_CURRENT_WEBSITE` (20 porodica, 56 šifara)

Nisu uvezene (nema zvaničnog opisa ni slike); spisak je u `SYNC_DRY_RUN.md`.
Najvažnije: Premium Soft Plus Putty, Antirust Primer, 2K Clearcoat Spray 400 ml,
1K Epoxy Primer Spray, Stone Chip Protection 5-603/5-604, Electrostatic Masking
Film 1-200/1-204, Masking Paper 1-220, Disposable Coverall 3-266, Half Mask 3-268,
Nitrile Gloves 3-260, Touch Up Bottles 3-115-0002/3, Grey Matt P3000/P5000, Hand
Block Kit. Sledeći `carfit:sync` ih uvozi čim proizvođač objavi stranicu.

## 4. Sadržaj koji traži pogled vlasnika

- **Ozone Generators**: zvanični tekst tvrdi „uništava sve poznate viruse”, „3000 puta brže”.
  Te tvrdnje NISU prenete; opis je neutralan.
- **PE mounting tape**: zvanični tekst pominje brend treće strane — nije prenet.
- **Express Clearcoat / Cavity preservation / Finishing compound**: zvanični EN opis se
  završava ostatkom mašinskog prevoda („Translated with DeepL”) — nije prenet.
- Zvanični nazivi sa slovnom greškom dobili su `displayName`: „Clearcoar matt” → Clearcoat matt,
  „Scratch resistent” → Scratch resistant, „Silikone Remover” → Silicone Remover, „super wave” → „Super Wave”.
- 3 mrtva linka na dokumente na sajtu proizvođača (`https://./#…`) nisu objavljena.
- 65 proizvoda nosi boju brenda (`KEEP_BRAND`): hemija u ambalaži bez navedene boje, bezbojni
  materijali i porodice sa više boja. Spisak: `colour-decisions.generated.json`.
- Kategorije: `taxonomy-map.json`. Generator ozona je u „Oprema”, stalci za lakiranje u „Radionica”,
  brendirane stavke ne postoje. Nijedna nova kategorija nije uvedena.
