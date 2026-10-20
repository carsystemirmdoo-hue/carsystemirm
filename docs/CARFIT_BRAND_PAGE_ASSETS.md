# C.A.R.FIT brend stranica — izvori fotografija

Stanje: 2026-10-20. Sve fotografije su zvanični materijali proizvođača
(August Handel GmbH, brend C.A.R.FIT). Nijedna nije generisana ni menjana
osim izvoza iz PDF-a u JPEG.

| Fajl u `public/` | Gde na stranici | Izvor | Napomena |
|---|---|---|---|
| `images/brands/carfit/hero/carfit-rebel-flair-asortiman-3155x1329.jpg` | Uvod, preko cele širine | prilog vlasnika (`477384489_…_n.jpg`, zvanična objava C.A.R.FIT), isti kadar kao `carfit-test-1.webp` na carfitrepair.com | bajt-identičan prilogu |
| `images/brands/carfit/primena/carfit-brusenje-blokom-983x1435.jpg` | Gradacija (`#abrazivi`) | C.A.R.FIT katalog 2026, PDF str. 43 (str. 83 kataloga) — uvodna fotografija poglavlja Abrasives; https://carfitrepair.com/wp-content/uploads/2025/09/CARFIT-FINAL-2026.pdf | ugrađena slika izvezena u punoj rezoluciji (983 × 1435) |
| `images/brands/carfit/primena/carfit-maskirna-traka-983x1435.jpg` | Maskiranje | isti katalog, PDF str. 33 (str. 63 kataloga) — uvodna fotografija poglavlja Masking | isto |
| `images/brands/carfit/primena/carfit-poliranje-983x1435.jpg` | Završna obrada | isti katalog, PDF str. 30 (str. 56 kataloga) — uvodna fotografija poglavlja Polishing | na kadru je mašina RUPES (brend iz našeg programa) |

Proveren je i sajt carfitrepair.com (stranice kategorije Schleifmittel i
pojedinačnih abraziva): tamo postoje samo fotografije pakovanja na beloj
podlozi, bez fotografija iz rada. Zato je za blok gradacije uzet kadar iz
kataloga.

## Gradacija

Raspon granulacija uz svaki abraziv računa `lib/carfit-abrasives.ts` iz
zvaničnih tabela varijanti (`officialDescriptor`, npr. „P40, 50 pcs.“) u
`data/carfit-catalog-products.generated.json`. To je raspon u kojem
proizvođač nudi proizvod, ne preporuka za korak. Proizvođač ne objavljuje
tabelu „granulacija → korak“, pa je opšta skala (P80–P180 skidanje …
P1000–P2000 finiš) uklonjena sa stranice.

## Prava korišćenja

Katalog je javno objavljen na sajtu proizvođača za kupce i distributere.
Pisana potvrda prava za veb upotrebu nije pribavljena; ista je situacija i sa
ostalim C.A.R.FIT slikama na sajtu. Ako proizvođač zatraži uklanjanje,
fotografije se menjaju u `lib/carfit-brand-data.ts` (masking/finish) i
`components/brand/carfit/CarfitBrandPage.tsx` (gradacija).
