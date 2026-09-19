# BEFAR sync — pravila za srpski sadržaj

Važi za svaki unos u `data/befar-sync/localization/*.json`. Mašinski proverljiv deo
proverava `node scripts/befar-sync/check-localization.mjs` i `npm run befar:sync:validate`.

Ulaz nastaje komandom `npm run befar:sync:plan`:
`.cache/befar-sync/localization-input/<linija>.json`.

## Najvažnije: Befar ne objavljuje opise

Zvanični sajt (befar.com.tr) za svaki proizvod daje samo NAZIV, TABELU ŠIFARA
(boja / dimenzija / broj rupa) i SLIKE. Digitalni katalog dodaje legendu tvrdoće po
boji (`hardnessStars`, 1–5), preporuku sredstva (`applyWith`) i napomene tipa
„USE WITH 150 MM VELCRO BASIC PAD” (`cataloguePageText`). Drugog zvaničnog teksta nema.

Zato je opis KRATAK i sme da sadrži samo:

1. šta je proizvod — ono što sledi iz zvaničnog EN naziva i turskog originala
   (`officialNameTr`), npr. „Cırtlı Polisaj Süngeri” = sunđer za poliranje sa čičkom;
2. kojoj liniji pripada (`line`: Befar, Befar Plus, Leo, Turkuaz);
3. u kojim bojama, dimenzijama i sa koliko rupa postoji (iz `variants`);
4. tvrdoću po boji i preporučeno sredstvo — SAMO ako ih ulaz nosi (`hardnessStars`, `applyWith`);
5. napomene sa strana kataloga (`cataloguePageText`), npr. sa kojom podloškom se koristi,
   ili sadržaj seta ako ga katalog navodi;
6. opštu funkciju koja je sadržana u samom tipu proizvoda („podloška nosi sunđer na
   polirki”, „maskirna folija štiti površine tokom lakiranja”) — jednom rečenicom, bez tvrdnji o kvalitetu.

Zabranjeno: osobine, materijali, otpornosti, trajnost, rezultati, brojevi i namene kojih
nema u ulazu; superlativi; cene, dostupnost, rokovi; pravne tvrdnje o odnosu sa brendom.
`benefits` je po pravilu PRAZAN niz — popunjava se samo činjenicom iz ulaza (npr.
„16 rupa” iz naziva, tvrdoća iz legende).

Zvanični naziv proizvoda i linije se NE prevodi. `displayName` se upisuje samo kada
zvanični EN naziv ima očiglednu slovnu grešku (i samo se ona ispravlja):
„Aplication” → „Application”, „Aplicatior” → „Applicator”, „Non Wowen” → „Non Woven”,
„Mikrofiber Clothes” → „Microfiber Cloths”, „Static Fail” → „Static Foil”,
„Headligh” → „Headlight”. Oznaka iza „ · ” (npr. „· Hard Red”) ostaje.

## Format unosa

Ključ je `sourceKey` iz ulaza. `sourceHash` se prepisuje bez izmene.

```json
{
  "velcro-polishing-pad": {
    "sourceHash": "…16 hex…",
    "productType": "Sunđer za poliranje sa čičkom",
    "subtype": "sunđer za poliranje · čičak · 3 dimenzije · 7 boja",
    "shortDescription": "Jedna rečenica, najviše 160 znakova.",
    "longDescription": "2–4 rečenice, najviše 600 znakova.",
    "purpose": "Kratka fraza namene, bez tačke, najviše 90 znakova",
    "facts": [{ "label": "Linija", "value": "Befar" }, { "label": "Dimenzije", "value": "80 × 25 mm, 150 × 25 mm, 180 × 35 mm" }],
    "applications": [],
    "benefits": [],
    "advice": "Napomena iz kataloga proizvođača o podlošci sa kojom se sunđer koristi — prepisana tačno kako je ulaz navodi, ili null.",
    "setContents": []
  }
}
```

| Polje | Pravilo |
|---|---|
| `productType` | tip proizvoda na srpskom, 1–6 reči, bez dimenzija i bez naziva modela |
| `subtype` | 2–4 dela razdvojena sa ` · ` |
| `shortDescription` | 1 rečenica, ≤ 160 znakova |
| `longDescription` | 2–4 rečenice, ≤ 600 znakova; boja se navodi kao FUNKCIJA (tvrdoća) samo kada ulaz nosi `hardnessStars` |
| `purpose` | fraza, ≤ 90 znakova |
| `facts` | „Linija”, „Dimenzije”, „Boje”, „Broj rupa”, „Tvrdoća po boji” (npr. „narandžasta 5/5, bela 3/5, crna 1/5”), „Preporučeno sredstvo” — samo iz ulaza |
| `applications` | samo ako ulaz daje namenu (`applyWith`, tekst kataloga); inače `[]` |
| `benefits` | `{title, description}`; po pravilu `[]` |
| `advice` | napomena iz `cataloguePageText` (sa kojom podloškom/adapterom), ili `null` |
| `setContents` | za setove: stavke koje katalog/naziv navodi; inače `[]` |

Oznake varijanti se NE pišu — sync ih gradi sam iz boje, dimenzije i broja rupa.
Šifre artikala se u tekstu navode samo ako su u ulazu. Svaki broj u tekstu mora postojati u ulazu.

## Rečnik

| EN / TR | SR |
|---|---|
| polishing pad / compounding pad (polisaj süngeri) | sunđer za poliranje |
| velcro (cırtlı) | sa čičkom |
| with applicator (aplikatörlü) | sa aplikatorom (nosačem sa navojem) |
| waffle / carved / corrugated | vafl profil / urezani profil / rebrasti profil |
| hand compounding pad (el tipi) | ručni sunđer za poliranje |
| wool pad (kuzu yünü / yün) | krzno (vuna) za poliranje |
| backing pad (taban) | podloška (tanjir) |
| interface / intermediate pad (ara taban) | međupodloška |
| sanding block (zımpara takozu) | brusni blok |
| non woven abrasive (brite keçe) | netkani abraziv (brusno runo) |
| liquid compound / cream compound (likit / krem pasta) | tečna / krem polir pasta |
| auto polish (cila) | polir (završni polir) |
| anti hologram (hare giderici) | antihologram polir |
| paint protector (boya koruma) | zaštita laka |
| ceramic coating (seramik kaplama) | keramički premaz |
| static masking foil (maskeleme folyosu) | statička maskirna folija |
| tack cloth (toz bezi) | lepljiva krpa za prašinu |
| microfiber cloth | mikrofiber krpa |
| set | set |
| hardness | tvrdoća |
| boje | white bela, orange narandžasta, black crna, yellow žuta, blue plava, cream krem, burgundy / claret red / cherry bordo, red crvena, grey siva, turquoise tirkizna |
