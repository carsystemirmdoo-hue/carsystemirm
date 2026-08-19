# baslac PDP Document Map

Per-SKU dokumentacija ↔ product detail stranice. Prati
`docs/BASLAC_DOCUMENT_SOURCE_MAP.md`, koji pokriva brand-library stranu istog
materijala (15 sistemskih vodiča objavljenih kroz `/katalozi`).

Izvor odluka: `scripts/match-baslac-documents.mjs` →
`data/knowledge/baslac-document-match.generated.json`. Izveštaj se
regeneriše sa:

```bash
npm run brands:match-baslac-documents
```

## Polazno stanje (potvrđeno u runtime kodu, ne prepisano iz audita)

| Činjenica | Vrednost | Kako je potvrđena |
| --- | --- | --- |
| baslac PDF-ova na disku | 102 | `public/documents/products/baslac/` |
| Objavljeno kao brand/system vodiči | 15 | `lib/documents.ts`, kopije MD5-identične originalima |
| Per-SKU tehničkih listova | 87 | 102 − 15, potvrđeno klasifikacijom po oznaci artikla |
| baslac proizvoda u javnom modelu | 4 | `productRecords` u `lib/carsystem-data.ts` |
| baslac per-SKU dokumenata povezanih sa PDP-om (pre) | 0 | grep: nula referenci na `documents/products/baslac` |
| baslac per-SKU dokumenata povezanih sa PDP-om (posle) | 1 | `baslac-60-20-razredjivac` |

`baslac-900-basecoat` postoji u `legacyProducts`, ali nikada nije uvučen u
`productRecords` — nema javnu stranicu i zato nije predmet matchinga. (Nekoliko
proizvoda ga i dalje navodi u `relatedProductSlugs`; to je zaseban, postojeći
problem i nije menjano ovde.)

## Dokazna lestvica

1. tačna proizvođačeva oznaka artikla,
2. tačan zvanični naziv proizvoda,
3. jak normalizovan naziv uz dodatni family/product dokaz,
4. postojeći, proverljiv pipeline rezultat
   (`data/knowledge/baslac-documents.generated.json` — nosi oznaku koju
   proizvođač sam kodira u ime fajla, plus `sha256` i `sourceUrl`).

Automatski se povezuju samo `EXACT` i `HIGH CONFIDENCE`.

**Zajednički prefiks linije nije identitet.** `35-M214` i `35-M331` su
komponente unutar sistema `35 Line`; `35_Line.pdf` opisuje liniju, ne ni jednu
od te dve konzerve. Kačenje tog lista na komponentu objavilo bi dokument koji
može pripadati drugoj varijanti, pakovanju ili proizvodu.

## Rezultat

| Klasa | Broj kandidata |
| --- | --- |
| EXACT | 1 |
| HIGH CONFIDENCE | 0 |
| REVIEW | 0 |
| AMBIGUOUS | 7 |
| UNMATCHED | 0 |
| CONFLICT | 2 |

Deset kandidata na četiri proizvoda; jedan je povezan.

### Povezano

| Proizvod | Oznaka | Dokument | Tip | Dokaz |
| --- | --- | --- | --- | --- |
| `baslac-60-20-razredjivac` | `60-20` | `/documents/products/baslac/60-20.pdf` | TDS | Tačna oznaka artikla; naslov dokumenta („60-20 Reducer Universal Normal") potvrđuje i tip — naš zapis je razređivač |

Provenijencija: `acquisitionMethod: url-pattern-verified-by-content`. Dokument
nije bio u baslac-ovom javnom indeksu, pa ga je
`scripts/acquire-baslac-documents.mjs` preuzeo po dokumentovanom URL obrascu i
**odbio bi ga da tekst PDF-a ne sadrži oznaku `60-20`**. sha256
`541f2cdcc69b40510fb9ab2c99930069e0cb0860c3028567f78afe4f48a2ec5b`.

Na PDP-u se prikazuje kao `TDS` (`title: "Tehnički list"` → `kind: "tds"` kroz
`getLegacyDocumentKind`), uz nepromenjene SDS i uputstvo slotove.

### Nije povezano — traži ljudsku odluku

| Proizvod | Oznaka | Klasa | Kandidati | Zašto stoji |
| --- | --- | --- | --- | --- |
| `baslac-35-m214` | `35-M214` | AMBIGUOUS | `35_Line.pdf`, `35_Line_variant_49.pdf` | Nijedan dokument ne nosi oznaku `35-M214`. Postoje dva paralelna lista linije 35 i nema dokaza koji važi za ovu komponentu |
| `baslac-30-s510-s-serija` | `30-S510` | AMBIGUOUS | `30_Line.pdf`, `30_Line_CV.pdf`, `30_Line_CV_variant_81-30_DTM.pdf`, `30_Line_CV_variant_81-30_Tinted_PF.pdf`, `30_CV_Gloss_levels.pdf` | Linija 30 ima dva različita sistema (standardni Topcoat i CV Topcoat) sa različitim učvršćivačima (`50-15/-20/-30` naspram `51-515/-520`). Izbor pogrešnog lista dao bi pogrešan recept mešanja |
| `baslac-35-m331-pasta` | `35-M331` | CONFLICT | `35_Line.pdf`, `35_Line_variant_49.pdf` | Oznaka `35-` upućuje na basecoat liniju, ali naš zapis proizvod opisuje kao pastu za poliranje (`programSlug: "poliranje"`). Jedan od dva podatka je pogrešan i to nije stvar dokumentacije nego product zapisa |

### Dodatni dokaz sa packshot-ova (nađen tokom verifikacije, nije menjan)

Etikete na postojećim slikama proizvoda protivreče trima od četiri zapisa:

| Proizvod | Šta piše na konzervi na slici |
| --- | --- |
| `baslac-60-20-razredjivac` | `45-W1150 Yellow Basecoat` |
| `baslac-35-m331-pasta` | `35-M … Basecoat` |
| `baslac-30-s510-s-serija` | `35-M1020 White Blue Flip Basecoat` |

Dve posledice:

1. Za `35-M331` ovo pomera krivicu: oznaka `35-` i etiketa „Basecoat" se slažu
   međusobno, a **naš zapis** ga vodi kao pastu za poliranje. Konflikt je
   najverovatnije greška product zapisa, ne dokumentacije. Ipak se ne povezuje
   automatski — slike su dokazano nepouzdane (ista fotografija stoji na dva
   proizvoda, `docs/CONTENT_ASSET_GAP_AUDIT.md` §4.2), a i dalje postoje dva
   paralelna lista linije 35.
2. Za `60-20` ovo **ne dira** povezani dokument. Dokument je potvrđen oznakom
   artikla i sadržajem PDF-a; pogrešna je fotografija, ne tehnički list.

Slike nisu menjane u ovom zadatku — to je asset zadatak, već evidentiran kao
`P04` u `docs/CONTENT_ASSET_GAP_AUDIT.md`.

## Šta ovo NIJE rešilo

86 od 87 per-SKU listova i dalje nije dostupno ni sa jedne stranice —
**ne zato što matching nije uspeo, nego zato što javni katalog ima četiri
baslac proizvoda za 87 dokumenata.** Dokumentacija daleko prestiže katalog.
Ovo se rešava dodavanjem stvarnih baslac artikala u katalog (`20-22`, `25-30`,
`27-10`, `40-40`, `40-450`, clearcoat i primer grupe koje baslac brand stranica
već nabraja), ne agresivnijim matchingom.

Otvorena pitanja za vlasnika podataka, redom po posledici:

1. **Šta je stvarno `35-M331`?** Pasta za poliranje ili mixing komponenta
   linije 35? Od odgovora zavisi i faza i program na javnoj stranici.
2. **Koji sistem linije 30 je `30-S510`** — standardni Topcoat ili CV Topcoat?
3. **Da li je `35-M214` mixing baza linije 35?** Naš zapis ga vodi u fazi
   „lak", `docs/CONTENT_ASSET_GAP_AUDIT.md` ga na jednom mestu naziva
   hardener-om, a oznaka upućuje na basecoat. Tri različite tvrdnje.
4. **Koji baslac artikli se stvarno drže na stanju?** To određuje koji od 87
   listova uopšte treba da dobiju stranicu.

Do odgovora ta tri proizvoda ostaju bez per-SKU dokumenta. Prikazivanje lista
linije kao da je list artikla bilo bi tačno izgledajuća netačna informacija.

## Validacija

`npm run documents:validate` proverava, za oba izvora dokumenata
(`lib/carsystem-data.ts` i `data/rm-imported-products.generated.json`):

- svaki referencirani fajl postoji i počinje sa `%PDF`,
- nijedan proizvod ne linkuje isti fajl dvaput (uz poštovanje pravila da
  `detail.documents` zamenjuje legacy `documents` niz),
- nijedan fajl nije povezan sa dva različita proizvoda,
- R-M mapiranje i dalje ima 59 proizvoda i 117 fajlova.

Izveštaj razdvaja javne dokumente od placeholder zapisa:
`productsWithPublicDocuments` broji samo proizvode koji na PDP-u stvarno
prikazuju otvoriv dokument (66 = 59 R-M + 6 Carsystem + 1 baslac), dok
`productsWithPlaceholderOnlyReferences` (2) evidentira zapise čiji je jedini
href deljeni stub koji se nikada ne renderuje.

## Konflikti sa postojećim zapisima

Nema. Objavljenih 15 brand-library zapisa nije menjano — MD5 provera potvrđuje
da su kopije u `public/documents/baslac/guides/` byte-identične originalima u
`public/documents/products/baslac/`.
