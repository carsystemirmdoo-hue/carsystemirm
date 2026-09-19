# R-M sync — pravila za srpski sadržaj

Važi za svaki unos u `data/rm-sync/localization/*.json`. Sync ovaj vodič ne čita — čita
ga onaj ko piše sadržaj. Mašinski deo proverava
`node scripts/rm-sync/check-localization.mjs` i `npm run rm:sync:validate`.

Ulaz nastaje komandom `npm run rm:sync:plan`:
`.cache/rm-sync/localization-input/<uloga>.json` — samo zvanične činjenice sa
`info.rmpaint.com`, `rmpaint.com/en-int` i iz TDS-a (`techinfo.rmpaint.com`).

## Princip

Zvanični R-M tekst je izvor **činjenica**, ne tekst za prepisivanje. Piše se stručan,
miran opis na srpskom (ekavica, latinica), terminološki usklađen sa ostatkom sajta.

- Ništa se ne dodaje: nijedna osobina, broj, podloga ni tvrdnja koje nema u ulazu.
  Kada ulaz nema podatak (`documentationGap`), on se jednostavno ne pominje.
- Ništa se ne pojačava: bez „najbolji”, „revolucionaran”, „vrhunski”, „savršen”.
- Brojevi, jedinice i oznake prenose se TAČNO: `2:1 + 10%`, `40–60 μm`, `60°C`,
  `419 g/l`, `P400`. Decimalni zarez (`0,5 l`), litar kao `l`.
- **Uloga proizvoda se ne sme pomešati.** `productType` mora imati tačan termin:
  - basecoat → „bazna boja” (sistem za nijansiranje → „sistem baznih boja”)
  - clearcoat → „bezbojni lak”
  - primer / filler → „prajmer”, „punilo”, „prajmer-punilo”
  - body filler → „kit”
  - hardener → „učvršćivač” (za bazne boje: „aktivator”)
  - thinner / reducer → „razređivač”
  - additive → „aditiv”
  - cleaner → „sredstvo za čišćenje” / „odmašćivač”
- Zvanični nazivi se NE prevode: `AGILIS`, `ONYX HD`, `DIAMONT`, `GRAPHITE HD`,
  `UNO HD`, `Pioneer Series`, `Advance Series`, `GlossTOP+`, `CLEAR Harden-R`.
  Tip proizvoda ide u `productType`, ne u naziv.
- Kompatibilnost (učvršćivači, razređivači, aditivi) se NE prepisuje u tekst: sync je
  gradi iz `relations` kao odnose među zapisima.
- Bez pravnih tvrdnji o odnosu sa brendom, bez cena i rokova isporuke.
- Pakovanja nisu javno objavljena — ne pominju se.

## Format unosa

Ključ je `sourceKey` iz ulaza. `sourceHash` se prepisuje iz ulaza bez izmene.

```json
{
  "c-2a64": {
    "sourceHash": "…16 hex…",
    "productType": "2K bezbojni lak",
    "subtype": "2K bezbojni lak · Advance Series · visoki sjaj",
    "shortDescription": "Jedna rečenica, najviše 170 znakova: šta je i čemu služi.",
    "longDescription": "2–4 rečenice, najviše 700 znakova: uloga, primena, tehnička osobenost iz TDS-a.",
    "purpose": "Kratka fraza namene, bez tačke, najviše 90 znakova",
    "facts": [{ "label": "Odnos mešanja", "value": "2:1 + 10%" }],
    "applications": ["Završno lakiranje posle bazne boje"],
    "benefits": [{ "title": "Visok sjaj", "description": "…iz Key Features, mirno prepričano." }],
    "advice": null
  }
}
```

- `facts` — samo činjenice iz ulaza (odnos mešanja, VOC, debljina filma, sušenje,
  pot-life, mlaznica). Bez izmišljenih vrednosti; bez pakovanja.
- `applications` — kratke stavke procesa (1–4).
- `benefits` — iz `keyFeatures`; naslov do 4 reči. Prazan niz kada izvor nema ništa.
- `advice` — napomena proizvođača ili `null`.
