# SATA — predlog nove brend stranice (2026-10-20)

Lokalni pregled: `/interaction-demo/sata-predlog` (na Vercelu 404, `noindex`).
Kod: `components/brand/sata/SataProgramPreview.tsx`, podaci
`lib/sata-program-preview.ts`. Postojeća stranica `/brendovi/sata` nije
menjana.

## Fotografije

Nijedna SATA fotografija nema potvrđeno pravo korišćenja (sata.com ima samo
„Copyright © SATA GmbH & Co. KG, All rights reserved“; nema press centra ni
licence za distributere). Kandidati su preuzeti 2026-10-20 samo za interni
pregled, stoje u `public/_lokalno/sata-kandidati/` (u .gitignore) i prikazuju se
samo uz `SATA_PREVIEW_MEDIA=1`. Bez te promenljive stranica je bez SATA
fotografija.

| Kandidat | Izvor | Sekcija |
|---|---|---|
| jet X u ruci (1640 × 2912) | https://www.sata.com/media/df/6d/8c/1787319056/jetx-highlight-01_019b46f3e0fc71698262f3ed4a0d8516.webp | uvod (desktop) |
| jet X detalj (1640 × 2912) | https://www.sata.com/media/f1/a0/5e/1787319056/jetx-highlight-02_019b46f5ad807a90a76afc46b39077d4.webp | uvod (telefon) |
| jet X baner (1920 × 420) | https://www.sata.com/media/09/3a/12/1784289980/banner-pdp-jetX.png | traka posle uvoda |
| jet X 1200394 | https://www.sata.com/media/99/89/71/1791809354/1200394_MAIN.WEBP.WEBP?ts=1791809354 | završni sloj |
| SATAjet X 5500 1061697 | https://www.sata.com/media/1c/06/79/1791809354/1061697_MAIN.WEBP.WEBP?ts=1791809354 | (rezerva) |
| SATAminijet 4400 B 198226 | https://www.sata.com/media/ae/35/af/1791809356/198226_MAIN.WEBP.WEBP?ts=1791809356 | spot reparatura |
| SATAjet 100 B F 145193 | https://www.sata.com/media/e7/7b/9c/1791809355/145193_MAIN.WEBP.WEBP?ts=1791809355 | podloga |
| jet K 1238874 | https://www.sata.com/media/3a/9a/02/1791809357/1238874_MAIN.WEBP.WEBP?ts=1791809357 | velike površine |
| RPS 1202100 | https://www.sata.com/media/21/cb/ae/1791809358/1202100_MAIN.WEBP.WEBP?ts=1791809358 | čaše |
| LCS 1195834 | https://www.sata.com/media/48/1e/7e/1791809358/1195834_MAIN.WEBP.WEBP?ts=1791809358 | čaše |
| multi clean 2 38257 | https://www.sata.com/media/10/a8/3b/1791809360/38257_MAIN.WEBP.WEBP?ts=1791809360 | čišćenje |
| clean RCS 145581 | https://www.sata.com/media/e3/18/ae/1791809360/145581_MAIN.WEBP.WEBP?ts=1791809360 | čišćenje |

## Izvori za tekst (pristup 2026-10-20)

| Oznaka | Izvor | Šta je preuzeto |
|---|---|---|
| S1 | https://www.sata.com/en/spray-guns/ | aktuelna lista pištolja |
| S2 | SATA katalog 2025 (EN), https://www.sata.com/media/1d/fa/b1/1771494954/EN---SATA-Product-Catalogue-2025_uid_6788ce1e8b007.pdf?ts=1771937806 | jet X verzije, mlaz I/O, statusi modela |
| S3 | brošura „Spray Guns“, https://www.sata.com/media/83/7b/84/1771494668/EN-SATA-Brochure-Spray-Guns-3890-220829-9.pdf?ts=1772187791 | 100 B F/P, SR dizne |
| S4 | brošura „Cup Systems“, https://www.sata.com/media/58/53/f7/1772185942/EN-SATA-Brochure-Cup-System-3901-220829-6.pdf?ts=1772187571 | RPS veličine, sita, nagib |
| S5 | https://www.sata.com/en/service/professional-knowledge/practical-advice/ | redosled podešavanja, creva |
| S6 | https://www.sata.com/en/service/professional-knowledge/faq/ | RP/HVLP, čišćenje |
| S8, S9 | stranice artikala SATAjet X 5500 RP / HVLP 1.3 I | potrošnja vazduha, rastojanje, pritisak |
| S10 | tablica primene R-M, https://www.sata.com/media/42/93/a8/1772450421/Hersteller_R-M_metrisch_en.pdf?ts=1772453900 | dizne i pritisci za R-M |
| S12 | brošura „Cleaning Systems“, https://www.sata.com/media/e5/e1/71/1772186609/EN-SATA-Brochure-Cleaning-Systems-3911-220829-3.pdf?ts=1772187894 | clean RCS, multi clean 2 |
| S13 | https://www.sata.com/en/service/downloads/ | centar za preuzimanje |

## SATAjet 5000 B, 1500 B i 3000 B — postojeće stanje

Odluka (2026-10-20): sva tri modela ostaju kao do sada. Ne ističu se u novoj
prezentaciji i nigde se ne tvrdi da su na lageru.

- **5000 B:** proizvođač ga gasi (katalog 2025: „discontinued“, ostaju dizne i
  delovi). Kartica ostaje sa javnim statusom „Na upit“.
- **1500 B i 3000 B:** nema ih na aktuelnoj listi pištolja ni u katalogu 2025.
  Kartice ostaju „Na upit“.
- „Na upit“ nije potvrda dostupnosti: kancelarija je proverava pri upitu.
- Predlog stranice (`SataProgramPreview`) ih ne pominje.

## Pravila sadržaja

- Prikazuju se samo proizvodi vidljivi u našem katalogu (svaki slug proveren).
- Zaštita disanja, filteri vazduha i automatski/industrijski pištolji se ne
  pominju. SATAjet 5000 B (proizvođač ga gasi), 1500 B i 3000 B (van glavnog
  programa) se ne ističu.
- Bez „zvanični/ovlašćeni distributer“ — status nije potvrđen.
- Dokumenti se samo linkuju sa sata.com, ništa se ne hostuje kod nas.
