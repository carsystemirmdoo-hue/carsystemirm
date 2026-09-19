# C.A.R.FIT sync — pravila za srpski sadržaj

Ovaj vodič važi za svaki unos u `data/carfit-sync/localization/*.json` (ručni ili
pripremljen uz pomoć AI). Sync ga ne čita — čita ga onaj ko piše sadržaj.
Mašinski proverljiv deo proverava `npm run carfit:sync:validate` i
`node scripts/carfit-sync/check-localization.mjs <fajl>`.

Ulaz za pisanje nastaje komandom `npm run carfit:sync:plan`:
`.cache/carfit-sync/localization-input/<zvanična-kategorija>.json` (samo zvanične
činjenice sa carfitrepair.com + red iz PDF kataloga za šifre kojih na sajtu nema).

## Princip

Zvanični C.A.R.FIT tekst je izvor **činjenica**, ne tekst za kopiranje. Piše se
stručan, miran, prodajno koristan opis na srpskom (ekavica, latinica),
terminološki usklađen sa ostatkom sajta i sa Carsystem uvozom.

- Ništa se ne dodaje: nijedna osobina, broj, namena ni tvrdnja koje nema u ulazu.
- Ništa se ne pojačava: bez „najbolji”, „revolucionaran”, „vrhunski”, „savršen”.
  „Excellent/perfect” iz izvora se piše mirno („veoma dobar”) ili se izostavlja.
- Brojevi, jedinice, šifre i temperature prenose se TAČNO (`60°C`, `< 420 g/l`, `P80`).
  Decimalni zarez: `0,5 l`, `2,5 l`, `1,8 kg`. Litar se piše `l`.
- Zvanični naziv proizvoda/modela se NE prevodi (`Rapid air clear coat VOC`,
  `Gold Paper Disc`, `Perfect Multi Green Putty`). Tip proizvoda se piše u `productType`.
- `displayName` se upisuje SAMO kada zvanični EN naziv ima očiglednu slovnu grešku
  ili neujednačena velika slova (npr. „Clearcoar matt” → „Clearcoat matt”,
  „Silikone Remover” → „Silicone Remover”). Inače se polje izostavlja.
- Deo ulaza je ostao na nemačkom (TranslatePress ga nije preveo: „Stk.”, „Sehr fein”,
  „Innenbecher”). To su iste činjenice — prevode se na srpski kao i engleske.
- Bez pravnih tvrdnji o odnosu sa brendom („zvanični distributer”, „ovlašćeni”, „ekskluzivni”).
- Bez cena, dostupnosti i rokova isporuke.
- Zaštićeni nazivi ostaju: `SONTARA®`, `Velcro` → „čičak”.

## Format unosa

Ključ je `sourceKey` iz ulaza. `sourceHash` se prepisuje iz ulaza bez izmene.

```json
{
  "rapid-air-klarlack-voc": {
    "sourceHash": "…16 hex…",
    "productType": "2K bezbojni lak",
    "subtype": "2K bezbojni lak · sušenje na vazduhu · VOC",
    "shortDescription": "Jedna rečenica, najviše 160 znakova: šta je proizvod i čemu služi.",
    "longDescription": "2–4 rečenice, najviše 600 znakova. Šta je, gde se koristi, šta ga odlikuje.",
    "purpose": "Kratka fraza namene, bez tačke, najviše 90 znakova",
    "facts": [{ "label": "Gustina", "value": "oko 1000 g/l" }],
    "applications": ["Dvoslojno lakiranje pri reparaturi vozila"],
    "benefits": [{ "title": "Brzo sušenje na vazduhu", "description": "Suši se 50–60 minuta na 20°C, što štedi energiju." }],
    "substrates": ["konvencionalna bazna boja", "vodorazrediva bazna boja", "OEM premazi"],
    "advice": null,
    "variants": { "7-325-1000": "Lak · 1 l", "7-336-1000": "Učvršćivač · 1 l" }
  }
}
```

| Polje | Izvor u ulazu | Pravilo |
|---|---|---|
| `productType` | naziv + `content.description` | tip proizvoda na srpskom, 1–5 reči, bez dimenzija i bez naziva modela |
| `subtype` | naziv + ključne činjenice | 2–4 dela razdvojena sa ` · ` |
| `shortDescription` | `content.description` | 1 rečenica, ≤ 160 znakova |
| `longDescription` | `content.description` + sekcije | 2–4 rečenice, ≤ 600 znakova |
| `purpose` | `content.application` | fraza, ≤ 90 znakova; kada sekcije nema, izvodi se iz opisa |
| `facts` | `content.additionalInformation` + `technicalData` | SVAKI red → `label` (srpski, 1–4 reči) + `value` (tačna vrednost, prevedene reči). Redovi čija je vrednost samo lista boja/granulacija koje su već u varijantama smeju ostati. |
| `applications` | `content.application` | jedna stavka po rečenici/nameni; prazna sekcija → `[]` |
| `benefits` | `content.features` | jedna stavka po bullet-u; `title` ≤ 6 reči, `description` puna rečenica iste činjenice |
| `substrates` | `content.substrates` | jedna stavka po podlozi; prazno → `[]` |
| `advice` | `content.otherSections`, `scopeOfDelivery`, skladištenje | 1–3 rečenice ili `null` |
| `variants` | `variants[]` | SVAKA šifra iz ulaza, tačno jednom. Oznake unutar proizvoda moraju biti RAZLIČITE. |

### Oznake varijanti

- Pakovanje: `1 l`, `5 l`, `0,5 kg`, `400 ml`. Dimenzije: `19 mm × 45 m`, `4 m × 5 m`.
- Granulacija: `P80`. Kada proizvod ima blokove „Discs” i „Stripes”, oblik ulazi u oznaku:
  `Disk · P80`, `Traka 70 × 420 mm · P80` (dimenzija samo ako je ulaz navodi), a razlike
  kao „14 holes” ulaze u oznaku (`Traka · P80 · 14 rupa`) jer inače oznake nisu jedinstvene.
- Komponente (`component`): `Lak · 1 l`, `Učvršćivač · 2,5 l`, `Punilac · 3 l, siva`,
  `Učvršćivač brzi · 0,5 l`. Brzina učvršćivača (fast/standard/slow → brzi/standardni/spori) ostaje u oznaci.
- Broj komada iz opisa ostaje kada razlikuje varijante (`15 kom.` naspram `100 kom.`), inače se izostavlja.
- `descriptor: null` (stranica navodi samo šifru) → `"Standardno pakovanje"`; ako činjenice stranice
  („Packaging: 400 ml”) jasno daju pakovanje jedine šifre, koristi se ono.
- `onWebsite: false` → šifra je iz PDF kataloga; oznaka se izvodi iz `catalogueRowText`
  (red je trojezičan EN/DE/FR — koristi se engleski deo).
- Ista šifra sa dva zvanična opisa (`„3 l, grey / 3 l, black”`) → oznaka navodi oba: `Punilac · 3 l, siva / crna`.

## Rečnik (obavezan, radi doslednosti sa sajtom)

| EN | SR |
|---|---|
| putty (polyester putty) | git (poliesterski git) |
| fine putty / fill putty | fini git / git za popunjavanje |
| glass fibre reinforced putty | git ojačan staklenim vlaknima |
| filler (2K acrylic filler, primer filler) | punilac (2K akrilni punilac) |
| primer / epoxy primer / plastic primer | prajmer / epoksi prajmer / prajmer za plastiku |
| clear coat | bezbojni lak |
| hardener / thinner / additive | učvršćivač / razređivač / aditiv |
| wet on wet | mokro na mokro |
| sanding disc / sanding strips / sanding block | brusni disk / brusne trake / brusni blok |
| film / paper / net / foam abrasive | filmski / papirni / mrežasti / sunđerasti abraziv |
| sanding fleece | brusno runo |
| grit | granulacija |
| back pad / interface pad | podloška (tanjir) / međupodloška |
| random orbital sander / orbital sander | ekscentrična brusilica / vibraciona brusilica |
| holes / multihole | rupa / multihole raspored rupa |
| Velcro® | čičak (Velcro®) |
| masking tape / film / paper | maskirna traka / folija / papir |
| fine line tape | traka za konture (fine line) |
| polish / cutting compound / anti-hologram polish | polir pasta / abrazivna polir pasta / antihologram polir pasta |
| polishing pad / lamb wool pad | sunđer za poliranje / krzno za poliranje |
| micro fiber cloth | mikrofiber krpa |
| stone chip protection | zaštita od udara kamena |
| underbody protection / cavity wax | zaštita podvozja / vosak za šupljine |
| seam sealer / bonding and sealing compound | zaptivna masa za šavove / masa za lepljenje i zaptivanje |
| glass bonding glue | lepak za stakla |
| silicone remover | sredstvo za uklanjanje silikona |
| tack cloth | lepljiva krpa za prašinu |
| cleaning cloth / wipes | krpa za čišćenje / maramice za čišćenje |
| coverall | zaštitni kombinezon |
| respirator / dust mask / protective gloves | zaštitna maska / maska za prašinu / zaštitne rukavice |
| spray gun | pištolj za lakiranje |
| mixing cup / paint strainer / mixing stick | posuda za mešanje / cediljka za boju / štapić za mešanje |
| paint stand / trolley | stalak za lakiranje / kolica |
| tin / cartridge / can / bottle / canister / roll / box | limenka / kartuša / doza / boca / kanister / rolna / kutija |
| incl. hardener | sa učvršćivačem |
| spray / aerosol | sprej |
| bodyshop / workshop | karoserijska i lakirerska radionica / radionica |
| substrate / surface | podloga / površina |
| blending / matting | prelaz (blending) / matiranje |
| very fine / ultra fine / extra fine / micro fine / coarse / medium | veoma fino / ultra fino / ekstra fino / mikro fino / grubo / srednje |
| boje | white bela, black crna, grey siva, red crvena, blue plava, green zelena, yellow žuta, gold zlatna, beige bež, orange narandžasta, anthracite antracit, transparent providna |

| Dodatno za C.A.R.FIT | |
|---|---|
| clearcoat / scratch resistant / matt | bezbojni lak / otporan na ogrebotine / mat |
| primer filler / washprimer / etch primer | prajmer-punilac / wash prajmer / reaktivni (etch) prajmer |
| air drying / forced drying | sušenje na vazduhu / ubrzano sušenje |
| cover tape / masking tape up to 80°C | maskirna traka do 80°C |
| blending tape / foam tape / lifting tape | traka za prelaze / sunđerasta traka / traka za podizanje gumica |
| double-sided tape / mounting tape | dvostrano lepljiva traka / montažna traka |
| rubbing / cutting / finishing compound | gruba polir pasta / abrazivna polir pasta / završna polir pasta |
| interface pad | međupodloška |
| sanding control powder | kontrolni prah za brušenje |
| stirring stick / mixing lid / strainer | štapić za mešanje / poklopac za mešanje / cediljka |
| touch-up bottle / micro applicator | bočica za korekcije / mikro aplikator |
| seat cover / floor mat / car cover | navlaka za sedište / zaštitna podna prostirka / zaštitna cerada za vozilo |
| tack coating for spray booth | lepljivi zaštitni premaz za kabinu |
| gun cleaner | sredstvo za pranje pištolja |
| ozone generator | generator ozona |
| pcs. / Stk. | kom. |
