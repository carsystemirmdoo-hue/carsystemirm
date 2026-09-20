# Norbin sync — pravila za srpski sadržaj

Važi za svaki unos u `data/norbin-sync/localization/*.json`. Sync ovaj vodič ne čita — čita
ga onaj ko piše sadržaj. Mašinski deo proverava
`node scripts/norbin-sync/check-localization.mjs` i `npm run norbin:sync:validate`.

Ulaz nastaje komandom `npm run norbin:sync:plan`:
`.cache/norbin-sync/localization-input/<uloga>.json` — samo zvanične činjenice sa
`norbin-paint.com` i iz tehničkih listova (izvučene tvrdnje sa stranom i SHA256 dokumenta).

## Princip

Zvanični tekst je izvor **činjenica**, ne tekst za prepisivanje. Piše se stručan, miran opis
na srpskom (ekavica, latinica), terminološki usklađen sa ostatkom sajta.

- Ništa se ne dodaje: nijedna osobina, broj, podloga ni tvrdnja koje nema u ulazu.
- **Pet proizvoda nema nijednu tehničku tvrdnju** (učvršćivači i razređivač nemaju objavljen
  tehnički list). Za njih se piše kratko i tačno: šta je proizvod, uz koje se proizvode koristi
  i u kom odnosu — to su jedine dokazane činjenice. `facts` je tada prazan niz.
- Ništa se ne pojačava: bez „najbolji", „revolucionaran", „vrhunski", „savršen".
- Brojevi, jedinice i oznake prenose se TAČNO: `4:1`, `20-24 s`, `1,5 h`, `419 g/l`, `50 μm`.
  Decimalni zarez (`1,5 h`), litar kao `l`.
- **Uloga se ne sme pomešati:** clearcoat → „bezbojni lak"; undercoat → „prajmer"/„punilo";
  bodyfiller → „kit"; hardener → „učvršćivač"; reducer → „razređivač"; cleaner →
  „sredstvo za čišćenje"/„odmašćivač".
- Zvanične oznake i nazivi se NE prevode: `N15-020 Clear`, `N75-V21 Clear Hardener VOC`.
- **Dostupnost se ne tvrdi.** Nijedan tekst ne sme reći da je proizvod na stanju; javni status
  je uvek „Na upit". Ne pominju se ni cene ni rokovi.
- **Brojeva artikala nema** na zvaničnom izvoru — ne izmišljaju se i ne prepisuju iz naših
  internih šifara.
- Kompatibilnost se NE prepisuje u tekst: sync je gradi iz `relations` kao odnose među zapisima.
  Odnos mešanja (`4:1`) je tehnička činjenica i sme u `facts`.
- Bez pravnih tvrdnji o odnosu sa brendom.

## Format unosa

Ključ je `sourceKey` iz ulaza (šifra malim slovima, npr. `n15-v20`). `sourceHash` se prepisuje
iz ulaza bez izmene.

```json
{
  "n15-v20": {
    "sourceHash": "…16 hex…",
    "productType": "2K VOC bezbojni lak",
    "subtype": "2K bezbojni lak · VOC",
    "shortDescription": "Jedna rečenica, najviše 170 znakova.",
    "longDescription": "2–4 rečenice, najviše 700 znakova.",
    "purpose": "Kratka fraza namene, bez tačke, najviše 90 znakova",
    "facts": [{ "label": "Odnos mešanja", "value": "4:1" }],
    "applications": ["Završno lakiranje posle bazne boje"],
    "benefits": [{ "title": "Brzo sušenje", "description": "…iz zvaničnih tvrdnji." }],
    "advice": null
  }
}
```

- `facts` — samo iz `technical.claims`, sa srpskim etiketama: „Odnos mešanja", „Viskozitet
  prskanja", „Vreme upotrebe smeše", „Mlaznica", „Broj slojeva", „Debljina filma", „Razmak
  između slojeva", „Sušenje", „Temperatura skladištenja", „Rok upotrebe", „VOC".
- `applications` — kratke stavke procesa (1–4).
- `benefits` — iz `keyFeatures`/`intendedUse`; naslov do 4 reči.
- `advice` — napomena proizvođača ili `null`.
