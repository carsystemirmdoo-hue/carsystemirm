# Carsystem sync — pravila za srpski sadržaj

Ovaj vodič važi za svaki unos u `data/carsystem-sync/localization/*.json`
(ručni ili pripremljen uz pomoć AI). Sync ga ne čita — čita ga onaj ko piše
sadržaj. Validator (`npm run carsystem:sync:validate`) proverava ono što se može
proveriti mašinski: šifre, brojeve, dužine, `sourceHash`.

## Princip

Zvanični Carsystem tekst je izvor **činjenica**, ne tekst za kopiranje.
Piše se stručan, miran, prodajno koristan opis na srpskom (ekavica, latinica),
terminološki usklađen sa ostatkom sajta.

- Ništa se ne dodaje: nijedna osobina, broj, namena ni tvrdnja koje nema u ulazu.
- Ništa se ne pojačava: bez „najbolji”, „revolucionaran”, „vrhunski”, „savršen”.
  Ako izvor kaže „extremely good”, piše se mirno („veoma dobro”) ili se izostavlja.
- Brojevi, jedinice, šifre i temperature prenose se TAČNO (`110°C`, `13 µm`, `P 80` → `P80`).
- Naziv proizvoda/modela se NE prevodi (`Sanding Disc F.23 Ceramic`, `Multi Green Changer`, `UNIFLEX MS`).
- Zaštićeni nazivi ostaju (`Velcro®` → „čičak (Velcro®)” pri prvom pominjanju je u redu).
- Bez pravnih tvrdnji o odnosu sa brendom („zvanični distributer”, „ovlašćeni”, „ekskluzivni”).
- Bez cena, dostupnosti i rokova isporuke.

## Format unosa

Ključ je `sourceKey` iz ulaza. `sourceHash` se prepisuje iz ulaza bez izmene.

```json
{
  "abrasives/sanding-disc-f19-film-abrasive-150-mm-25-holes": {
    "sourceHash": "…16 hex…",
    "productType": "Filmski abraziv",
    "subtype": "Filmski abraziv · 150 mm · 25 rupa",
    "shortDescription": "Jedna rečenica, najviše 160 znakova: šta je proizvod i čemu služi.",
    "longDescription": "2–4 rečenice. Šta je, od čega je, gde se koristi. Bez ponavljanja naziva u svakoj rečenici.",
    "purpose": "Kratka fraza namene, bez tačke (npr. „Brušenje od grube do fine obrade”)",
    "facts": [{ "label": "Zrno", "value": "Aluminijum-oksid" }],
    "applications": ["Pogodan za grubo do fino brušenje"],
    "benefits": [{ "title": "Dug radni vek", "description": "Visoka i dugotrajna rezna moć." }],
    "advice": null,
    "variants": { "156.046": "P80", "156.048": "P120" }
  }
}
```

| Polje | Izvor u ulazu | Pravilo |
|---|---|---|
| `productType` | prvi deo `subtitle` | tip proizvoda na srpskom, 1–5 reči, bez dimenzija |
| `subtype` | ceo `subtitle` | srpski, delovi razdvojeni sa ` · ` |
| `shortDescription` | `officialDescription` + sekcije | 1 rečenica, ≤ 160 znakova |
| `longDescription` | `officialDescription` + sekcije | 2–4 rečenice, ≤ 600 znakova |
| `purpose` | `AREA OF APPLICATION` | fraza, ≤ 90 znakova |
| `facts` | `DESCRIPTION` | svaka stavka → `label` (1–3 reči) + `value`. Kada stavka nije „osobina: vrednost”, `label` je „Karakteristika”. |
| `applications` | `AREA OF APPLICATION` | jedna stavka po bullet-u |
| `benefits` | `BENEFIT` | jedna stavka po bullet-u; `title` sažeto (≤ 6 reči), `description` puna rečenica iste činjenice |
| `advice` | `APPLICATION ADVICE` | jedna do tri rečenice, ili `null` kada sekcije nema |
| `variants` | `variants[].specification` | SVAKA šifra iz ulaza, srpski zapis specifikacije; `null` specifikacija → `"Standardno pakovanje"` |

Sekcija koje u ulazu nema → prazan niz (`[]`), nikad izmišljen sadržaj.

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
