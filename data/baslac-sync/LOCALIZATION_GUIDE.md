# baslac sync — pravila za srpski sadržaj

Važi za svaki unos u `data/baslac-sync/localization/*.json`. Sync ovaj vodič ne čita — čita
ga onaj ko piše sadržaj. Mašinski deo proverava
`node scripts/baslac-sync/check-localization.mjs` i `npm run baslac:sync:validate`.

Ulaz nastaje komandom `npm run baslac:sync:plan`:
`.cache/baslac-sync/localization-input/<uloga>.json` — samo zvanične činjenice sa
`baslac.com/en-emea` (kartice kategorija) i iz tehničkih listova
(`techinfo.baslac.com`, čitani doslovno iz PDF-a).

## Princip

Zvanični baslac tekst je izvor **činjenica**, ne tekst za prepisivanje. Piše se stručan,
miran opis na srpskom (ekavica, latinica), terminološki usklađen sa ostatkom sajta.

- Ništa se ne dodaje: nijedna osobina, broj, podloga ni tvrdnja koje nema u ulazu.
  Kada ulaz nema podatak, on se jednostavno ne pominje.
- Ništa se ne pojačava: bez „najbolji”, „revolucionaran”, „vrhunski”, „savršen”.
- Brojevi, jedinice i oznake prenose se TAČNO: `2:1+10 %`, `50-70 μm`, `60°C`, `180 g/l`,
  `P400`. Decimalni zarez (`0,5 l`), litar kao `l`.
- **Uloga proizvoda se ne sme pomešati.** `productType` mora nositi tačan termin:
  - clearcoat → „bezbojni lak”
  - undercoat (primer/filler/washprimer) → „prajmer”, „punilo”, „prajmer-punilo”
  - bodyfiller → „kit”
  - hardener → „učvršćivač” (za bazne boje: „aktivator”)
  - reducer → „razređivač”
  - additive → „aditiv”
  - cleaner → „sredstvo za čišćenje” / „odmašćivač”
  - system → „sistem” (sistem baznih boja / sistem završnih boja)
- Zvanične oznake i nazivi se NE prevode: `40-40`, `2K Universal Clear`, `Topcoat 30`,
  `Basecoat 45`. Tip proizvoda ide u `productType`, ne u naziv.
- Kompatibilnost (učvršćivači, razređivači, aditivi) se NE prepisuje u tekst: sync je
  gradi iz `relations` kao odnose među zapisima.
- Brojevi artikala se ne objavljuju. Pojavljuju se samo u imenima zvaničnih slika i
  nisu potvrđeni kao javni podatak — ne ulaze ni u jedno polje.
- Pakovanja nisu javno objavljena — ne pominju se; dostupnost je „Na upit”.
- Bez pravnih tvrdnji o odnosu sa brendom, bez cena i rokova isporuke.

## Format unosa

Ključ je `sourceKey` iz ulaza (šifra malim slovima, npr. `40-40`, ili ključ sistema
`line-30`). `sourceHash` se prepisuje iz ulaza bez izmene.

```json
{
  "40-40": {
    "sourceHash": "…16 hex…",
    "productType": "2K bezbojni lak",
    "subtype": "HS bezbojni lak · visok sjaj",
    "shortDescription": "Jedna rečenica, najviše 170 znakova: šta je i čemu služi.",
    "longDescription": "2–4 rečenice, najviše 700 znakova: uloga, primena, tehnička osobenost iz tehničkog lista.",
    "purpose": "Kratka fraza namene, bez tačke, najviše 90 znakova",
    "facts": [{ "label": "Odnos mešanja", "value": "2:1+10 %" }],
    "applications": ["Završno lakiranje posle bazne boje"],
    "benefits": [{ "title": "Visok sjaj", "description": "…iz zvaničnih osobina, mirno prepričano." }],
    "advice": null
  }
}
```

- `facts` — samo činjenice iz ulaza (`tds.facts`, `tds.drying`, `tds.voc`). Bez izmišljenih
  vrednosti; bez pakovanja. Etikete na srpskom: „Odnos mešanja”, „Viskozitet prskanja”,
  „Vreme upotrebe smeše”, „Mlaznica”, „Broj slojeva”, „Debljina filma”, „Razmak između
  slojeva”, „Sušenje”, „Brušenje”, „VOC”.
- `applications` — kratke stavke procesa (1–4).
- `benefits` — iz `features`/`tds.introduction`; naslov do 4 reči. Prazan niz kada izvor
  nema ništa.
- `advice` — napomena proizvođača iz lista ili `null`.

## Sistemi za nijansiranje

`line-30`, `line-30-cv`, `line-35`, `line-45` su SISTEMI: nijansa se meša po formuli, a
pojedinačni toneri se zvanično ne objavljuju. Tekst opisuje sistem, ne jednu nijansu.
`existingSiteCopy` je već odobren tekst na sajtu — zadržati ton i terminologiju, a
zvanični naziv (`baslac Topcoat 30`) koristiti kao ime sistema.
