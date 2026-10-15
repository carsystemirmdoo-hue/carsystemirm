# Istraživanje: Carsystem, C.A.R.FIT, RUPES (Novosti i edukacija)

> Napomena urednika (2026-10-08): Carsystem je robna marka firme VOSSCHEMIE GmbH (Uetersen) — potvrđeno u impresumu carsystem.org; C.A.R.FIT je August Handel GmbH (Trebbin). Ime fajla je ispravljeno da ne sugeriše zajedničkog vlasnika.

Datum istraživanja: 2026-10-08. Strukturisani spisak vesti je u `carsystem-carfit-rupes-news.json` (33 stavke).
Dopunjuje postojeće dokumente (`docs/CARSYSTEM_DOCUMENT_SOURCE_MAP.md`, `docs/CARSYSTEM_CATALOG_SYNC.md`, `docs/CARFIT_CATALOG_SYNC.md`, `data/knowledge/brand-sources.ts`) i ne ponavlja ih.

## 0. Važna ispravka: vlasništvo

**Carsystem i C.A.R.FIT nemaju istog vlasnika.**

| Brend | Pravno lice (impresum) | Izvor |
|---|---|---|
| Carsystem | **VOSSCHEMIE GmbH**, Esinger Steinweg 50, 25436 Uetersen (HRB 0265, AG Pinneberg). Katalog 2026/27 na strani 2: „As a trademark of VOSSCHEMIE“ | https://www.carsystem.org/impressum (otvoreno 2026-10-08) |
| C.A.R.FIT | **August Handel GmbH**, Ahornstraße 12, 14959 Trebbin (HRB 24775 P, AG Potsdam) | https://carfitrepair.com/en/impressum/ (otvoreno 2026-10-08) |

`data/knowledge/brand-sources.ts` (blok `carsystem.notes`) pogrešno navodi „Isti vlasnik kao C.A.R.FIT (August Handel GmbH)“. Ovo treba ispraviti pre nego što se bilo koji tekst iz rubrike „Saveti i vodiči“ pozove na vlasništvo. Na sajtovima ova dva brenda nisam našao nikakvu vezu među njima.

## 1. Kako izvori izgledaju (šta postoji, a šta ne)

### Carsystem (carsystem.org, TYPO3)
- **Vesti:** `/en/news` sadrži samo **4 vesti** (sitemap `?sitemap=news`). Nijedna ne prikazuje datum. Sitemap `lastmod` (2023-05 do 2025-11) nije datum objave. Tri vesti su iz 2023, a OEM vest je nedatirana i nije relevantna za srpsko tržište.
- **Pravi kanal za novitete** su zvanični YouTube kanal `youtube.com/carsystem_refinish` (RSS: `https://www.youtube.com/feeds/videos.xml?channel_id=UC_nE69BcrEUaTNm1mVLSg-w`, sa tačnim datumima), oznaka „New“ na stranicama proizvoda i katalog 2026/27.
- **Katalog 2026/27 (EN)** je objavljen na `/en/catalogues` (PDF CreationDate i Last-Modified su 2026-09-09). Sadrži 42 stavke sa oznakom NEW, od kojih je 36 u našem katalogu (spisak je u JSON stavci `cs-catalogue-2026-27`). Van našeg kataloga su Paint Arrestor II, Star Dust 2.0 FFP2/FFP3 (uklonjeni odlukom o maskama), Car Clean Multi II, Classic Coverall Pants Kneepadfit i Erlking Ltd. coverall (postoje samo u PDF-u).
- **Sajam:** Vosschemie GmbH je na zvaničnoj listi izlagača **Automechanika Frankfurt 2026**, hala 11.1, štand C23. Prema završnom izveštaju Messe Frankfurt od 12. 9. 2026, sajam je trajao pet dana, od 8. do 12. 9. 2026. Carsystem ovaj nastup nije objavio na svom sajtu. Učešće na Automechanici 2024 nisam proverio.
- Početna strana (2026-10-08) ističe: CC.26 ECO-X 15/60, AF.25 Primer Wet on Wet, katalog 2026/27, P.25 Ceramic („New“), Multi Stand, Bumper Stand, OEM i Explorer Ltd.

### C.A.R.FIT (carfitrepair.com, WordPress)
- **Nema sekcije vesti ni bloga.** WP kategorije su samo proizvodne i slajderi. Jedini pokazatelj novosti je datum objave stranice proizvoda (polje `date` u REST API-ju; datum se ne prikazuje na stranici).
- Stranice proizvoda nove od 2024: 2K Clearcoat Spray i Silicone Remover „Strawberry“ Spray (2024-07-09), Sponge Cut (2024-11-25) i **Masking Tape (Crepe) (2026-10-01)**. Sve osim krep trake su u našem katalogu.
- **Konflikt za carfit:sync:** nova stranica „Masking Tape (Crepe)“ koristi iste šifre 9-100-0019/0025/0038/0050 kao postojeća „Cover tape up to 80°C“ (`carfit-cover-tape-up-to-80c`), ali sa dužinom 40 m umesto 45 m i drugom namenom (0–60 °C, unutrašnje farbanje i signalizacija). Obe stranice su aktivne (HTTP 200). Ne znamo da li je reč o zameni ili o grešci na sajtu proizvođača.
- Katalog 2026 (PDF, Last-Modified 2025-09-25) je i dalje aktuelni katalog na `/en/katalog/`.
- Društvene mreže su Instagram i Facebook (sa sajta). Zahtevaju prijavu, pa ih nisam otvarao. YouTube kanal nije naveden na sajtu.

### RUPES (rupes.com, WordPress; samo modeli iz Carsystem programa)
- Od 2024-01 do danas na rupes.com postoji 26 vesti. Samo **4 se tiču modela iz našeg programa** (sve su u JSON-u):
  - iBrid Nano LUX kompleti bez četki 9.BF3000/9.BF3030 od proizvodnje 2025 (`carsystem-rupes-ibrid-nano`);
  - LHR15 **MarkV** (2024-10). Mi vodimo LHR15 **Mark III**. MarkV nije u programu i ne sme se predstaviti kao naš novitet;
  - D-A INTERMEDIATE padovi za iBrid Nano (pad nije u programu, mašina jeste);
  - ažurirana RUPES Paint Correction Web App.
- Ostale 22 vesti se ne odnose na naše modele i izostavljene su prema pravilu opsega: TA156A, HSE73L, MICROFINISH diskovi, boce od 500 ml, Autopromotec 2025, zaštitni štitnik za LH31N/LH32EN, keramičko sečivo za skidanje grešaka, MARINE, D-A Coarse vuneni pad (2026-07-24), Supercheap Auto (Australija), merchandise, BigFoot centri i drugo.
- Podsetnik iz `third-party-manufacturers.json`: **LHR75E** je kod RUPES-a ukinut, ali ga Carsystem i dalje vodi. Slike sa rupes.com se ne koriste (RUPES_IMAGE_RIGHTS_REVIEW).

## 2. Dostupnost u Srbiji

Nijedan izvor ne potvrđuje dostupnost u Srbiji. Sve stavke imaju `serbiaAvailability: "not-confirmed"`. Carsystem navodi „62 partners, 64 countries“, ali bez spiska zemalja.

## 3. Edukativni materijal

| Tema | URL | Datum | Napomena |
|---|---|---|---|
| X-serija za poliranje (Compound X1500 HC → Polish X8000 AH, padovi, X300 Duo) | https://www.youtube.com/watch?v=fK6wuS7TRts | 2026-06-30 | Video na nemačkom. Brošura: https://www.carsystem.org/fileadmin/user_upload/carsystem-politursystem-x1500-x8000-x300.pdf (Last-Modified 2026-07-15) |
| Izbor abraziva i gitova (F.23 C nasuprot klasičnim abrazivima; Multi nasuprot Multi Black Rapid) | https://www.youtube.com/watch?v=wgz-MoCSV_Q | 2025-04-28 | Praktično poređenje, DE |
| Filer za više podloga: AF.21 X-PERT | https://www.youtube.com/watch?v=fI-whVLMQLE | 2025-11-03 | DE |
| Kratki videi o proizvodima (P.25 Ceramic, V.19, CSH-COS01, Multi Black Rapid ×2, Mixing Stick Fast, Can Scraper, ProFlex Styx, F.23 C, All In One Covers) | vidi JSON | 2024-05 → 2025-09 | Dvojezični opisi DE/EN |
| Sistem ručnih brusnih blokova (koji blok ide uz koju traku) | https://www.carsystem.org/fileadmin/user_upload/sanding_block-a4-quer-v4.pdf | LM 2026-07-15 | |
| Abrazivi P.19/F.19/V.19 | https://www.carsystem.org/fileadmin/user_upload/Carsystem-schleifmittel-P19-F19-V19-DE-EN-157101.pdf | LM 2023-07-19 | |
| Abrazivi „New Collection“ | https://www.carsystem.org/fileadmin/user_upload/Carsystem-schleifmittel-new-collection-2020-EN.pdf | LM 2023-07-19 (izdanje 2020 prema nazivu fajla) | |
| Multi-Changer (vizuelni signal promene boje) | https://www.carsystem.org/fileadmin/user_upload/Carsystem-multi-changer-EN.pdf | LM 2023-07-19 | Ne tvrditi da promena boje znači potpuno stvrdnjavanje (vidi SOURCE_MAP) |
| Katalog 2026/27: uvodi poglavlja (abrazivi, maskiranje, poliranje, čišćenje…); str. 4 navodi da Carsystem program uključuje „random orbital sanders from Rupes“ | https://www.carsystem.org/fileadmin/CS-Kataloge-2026/Carsystem-product-catalogue-HQ-2026-27-EN.pdf | 2026-09-09 | 110 strana; Quickfinder na str. 107–108 |
| Carsystem bezbednosni listovi (SDS) | na svakoj stranici proizvoda, tabela „Article numbers and download table“ → padajući meni „Select language“ (`…/safetydatasheets/<šifra>/<JEZIK>`) | — | **Bez prijave.** 24 jezika, uključujući HR i SL; **nema SR**. TDS i flajeri su direktni PDF fajlovi u `/fileadmin/products/…` |
| Carsystem bezbednost proizvoda: obavezna obuka za diizocijanate (REACH) | https://www.vosschemie.de/en/company/product-safety | — | Upućuje na https://www.safeusediisocyanates.eu. Dobra tema za vodič uz 2K proizvode |
| Carsystem proces dezinfekcije | već u `/katalozi` (`carsystem-desinfektionsprozess`) | — | iz SOURCE_MAP |
| C.A.R.FIT: SDS i TDS po proizvodu | stranice proizvoda (WP uploads, javni PDF fajlovi) | — | Bez prijave. 66 SDS i 58 TDS (iz `data/carfit-sync/document-manifest`) |
| C.A.R.FIT podrška i obuke | https://carfitrepair.com/en/support/ | — | Opšti tekst o obukama „sa partnerima“; nema konkretnih termina |
| RUPES BigFoot Paint Correction Web App | https://www.rupes.com/web-app/ | LM 2026-10-07 | Preporučuje i proizvode van našeg programa, pa link ide samo uz napomenu |

FAQ stranice nisam našao ni na carsystem.org ni na carfitrepair.com.

## 4. Ograničenja pristupa (ništa nije zaobiđeno)
- Instagram i Facebook (Carsystem i C.A.R.FIT) zahtevaju prijavu, pa ih nisam otvarao.
- YouTube: pojedinačne short/video stranice nisam otvarao (osim fK6wuS7TRts). Podaci su iz zvaničnog RSS feeda, pa takve stavke u JSON-u imaju `accessedAt: null`.
- Stranica izlagača Messe Frankfurt sada u zaglavlju prikazuje izdanje 2028. Podaci o hali i štandu su pod naslovom „Exhibitor Automechanika Frankfurt 2026“.
- Geo-blokade nisam primetio.

## 5. Sekundarni izvori
Pretraga stručne štampe (Lackiererblatt, Fahrzeug+Karosserie i slično) nije dala nijedan upotrebljiv rezultat o Carsystem ili C.A.R.FIT novitetima. Ne koristim nijedan sekundarni izvor. Stavka o Automechanici se oslanja na organizatora sajma, koji je zvaničan izvor za sam sajam, ali nije izjava brenda.

## 6. Preporuke za uredništvo
- Kandidati za „Novosti“: katalog 2026/27; X-serija za poliranje; CC.26 ECO-X 15/60; P.25 Ceramic; AF.25; Automechanika 2026 (bez navoda o izloženim proizvodima); krep traka C.A.R.FIT (tek kada se razreši sukob šifara).
- Kandidati za vodiče: sistem poliranja u dva koraka (X1500 → X8000); izbor abraziva (P.25/F.23 C/V.19/Styx/Callisto); ručni brusni blokovi; obuka za diizocijanate.
- Uz svaki tekst stoji napomena „Dostupnost u Srbiji proverite kod partnerske prodavnice“. Ne koristiti formulacije kao „zvanični distributer“.
- U `docs/CARSYSTEM_DOCUMENT_SOURCE_MAP.md` deo „Missing product coverage“ je zastareo. X-serija i CC.26 sada imaju svoje stranice proizvoda. U katalogu postoji Multi Blue Rapid Changer SF, ali nisam proverio da li je to isti artikal kao Multi Blue Changer 157.623.
