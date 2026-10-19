# Norbin: tehnički podaci i dokumentacija (istraživanje 2026-10-19)

Provereno nad worktree-om (lokalna radna kopija) (97d753b2) i živim fajlovima na www.norbin-paint.com (19.10.2026). Ništa u repou nije menjano. Mašinski čitljiva verzija je u `norbin-tehnicki.json` (isti direktorijum).

## 1. Zašto tabela nema vrednosti

Podaci **postoje u repou, ali stranica nije povezana sa njima**. Nije u pitanju CSS, animacija ni greška pri izvršavanju.

- `components/norbin-brand/NorbinBrandPage.tsx`, r. 370–410 (`TechnicalSection`): spisak šifara se pravi iz ručno pisanog niza `norbinRatios` (`norbinBrandData.ts`, r. 54–97). U `<dl>` se upisuju samo „Šifra" i „Odnos mešanja". `<details>` je podrazumevano zatvoren, pa se vidi samo šifra.
- Komponenta ne uvozi:
  - `data/norbin-catalog-products.generated.json`: `products[].technical.claims` (lokalizovano, sa stranom) i `documents[]` sa pravim URL-ovima;
  - `data/knowledge/norbin-tds-claims.generated.json`: 301 claim iz 24 TDS-a.
- Prop `products` već nosi `productDetail.technicalFacts` i `documents` (preko `lib/norbin-catalog-products.ts` r. 225–245 i 274–282), ali ga koristi samo `OurProgramSection`.
- `DocumentationSection` (r. 412–448): za svih 5 šifara oba dugmeta vode na početnu `https://www.norbin-paint.com/`, a ne na PDF.
- Rečenica „Za ostale proizvode proizvođač ne objavljuje poseban tehnički list" je **netačna** (vidi tačku 4). Pored toga, N55-015, N60-V20 i N95-060 imaju EN TDS koji je linkovan na zvaničnom sajtu.

Netačni podaci u `norbinRatios` (proverom TDS-a):
- **N15-V25**: TDS 05/2023 kaže **3:1:1** (100 % : 33 % N75-V21 : 33 % N85-021). Stranica prikazuje 3:1.
- **N55-V29**: TDS kaže **5:1:1** (100 % : 20 % N75-020 : 20 % razređivača). Stranica prikazuje 5:1 bez razređivača. Izvori se razilaze oko razređivača: EN 10/2022 navodi **N85-025**, a TR 12/2022 navodi **N85-021**.

Upozorenje za buduće povezivanje: `norbin-tds-claims.generated.json` ima mašinske greške, pa sirovi podaci nisu za prikaz. Primeri: `storageTemperature.range = {min:-40, max:5}` i `unit:"s"` na tekstualnim poljima. Bolje je koristiti `technical.claims` iz kataloga ili polja iz ovog izveštaja. N55-V20 claims u repou su izvučeni iz TR TDS-a, a EN TDS 12/2022 je sada dostupan.

## 2. Dokumenti po proizvodu (13 šifara našeg programa)

Svi URL-ovi su na `https://www.norbin-paint.com/files/`. Status je proveren 19.10.2026: svaki vraća **200 + application/pdf**. Proizvod je proveren na naslovnoj strani svakog SDS-a i u zaglavlju svakog TDS-a.

| Šifra | TDS (jezik, verzija) | SDS (jezik, verzija / revizija) |
|---|---|---|
| N15-020 | `TDS/NORBIN_TDS_N15-020_Clear_2022.pdf`, en, 01/2022 (+ TR, + RUS) | `MSDS/N15-020_Clear_1L.PDF` i `_5L.PDF`, en, v3.0 / 30.10.2021 |
| N15-V20 | `TDS/NORBIN_TDS_N15-V20_Clear_VOC_2022.pdf`, en, 01/2022 | `MSDS/MSDS_N15-V20_4L_en.PDF`, en, v3.0 / 24.06.2021 |
| N15-V25 | `TDS/N15-V25_Fast_Clear_VOC_2.pdf`, en, 05/2023 | `MSDS/SDS_N15-V25_5L_en.PDF`, en, v3.1 / 04.08.2021 |
| N55-015 | `TDS/N55-015_1K_Plastic_Primer.pdf`, en, 01/2023 | `MSDS/SDS_N55-0151KPlasticPrimer_1L_en.PDF`, en, v2.3 / 14.11.2022 |
| N55-V20 | `TDS/N55-V20_2K_Primer_Filler_grey.pdf`, en, 12/2022 (radi i bez `?asdb213ffe`) | `MSDS/SDS_N55-V20_2_5L_en.PDF`, en, v3.1 / 14.06.2021 |
| N55-V29 | `TDS/N55-V29_2K_Primer_Filler_black.pdf`, en, 10/2022 (TR 12/2022 je novija) | `MSDS/SDS_N55-V29_2-5L_en.PDF`, en, v3.1 / 05.07.2022 |
| N60-V20 | `TDS/N60-V20_Multifunctional_Body_Filler_Hardener.pdf`, en, 01/2023 | `MSDS/SDS_N60-V20_1.95KG_bodyfiller_en.PDF` v1.1 / 01.01.2023 + učvršćivač 0,05 kg v2.0 / 05.12.2022 |
| N75-020 | `TDS/TR/N75-020.pdf`, **tr, nelinkovan**, 01/2022 | `MSDS/SDS_N75-020_0_5L_en.PDF`, en, v4.0 / 25.06.2021 |
| N75-021 | `TDS/TR/N75-021.pdf`, **tr, nelinkovan**, 01/2022 | `MSDS/SDS_N75-021_new_0_5L_en.PDF` i `_2_5L_en.PDF`, en, v3.1 / 02.06.2021 |
| N75-022 | `TDS/TR/N75-022.pdf`, **tr, nelinkovan**, 01/2022 | `MSDS/SDS_N75-022_0_5L_en.PDF`, en, v4.0 / 06.04.2021. Sadržaj je za **2,5 L**, iako ime fajla kaže 0_5L. |
| N75-V21 | `TDS/TR/N75-V21.pdf`, **tr, nelinkovan**, 01/2022 | `MSDS/MSDS_N75-V21_1L_en.PDF`, en, v1.0 / 26.10.2020 |
| N85-021 | `TDS/TR/N85-021.pdf`, **tr, nelinkovan**, 02/2022 | `MSDS/SDS_N85-021_1L_en.PDF` v4.0 / 14.10.2021; `MSDS/MSDS_N85-021_thinner_5L_en.pdf` v3.0 / 13.06.2024 |
| N95-060 | `TDS/N95-060_Silicone_Cleaner.pdf`, en, 01/2023 | `MSDS/SDS_N95-060SiliconeCleaner_5L_en.PDF`, en, v3.3 / 16.12.2022 |

Svi URL-ovi iz `data/norbin-catalog-products.generated.json` su živi i odgovaraju proizvodu i pakovanju. Jedini izuzetak je oznaka pakovanja za N75-022, koja je u katalogu ispravno navedena kao 2,5 L. Srpska ili crnogorska verzija dokumenata ne postoji: ME, DE i PL su u jezičkom meniju sajta zakomentarisani.

## 3. Ključna polja iz TDS-a (u zagradi je strana dokumenta)

| Šifra | Odnos (zapremina) | Učvršćivač / razređivač | Viskozitet DIN 4, 20 °C | Pot life 20 °C | Slojevi | Suvi film | 20 °C | 60 °C | VOC |
|---|---|---|---|---|---|---|---|---|---|
| N15-020 | 2:1 (1) | N75-021 ili N75-022 | 16–18 s | 2 h | 2, 3 min između | 50–60 µm | 5 h do montaže (2) | 30 min (2) | nije navedeno |
| N15-V20 | 4:1 (1) | N75-V21 | 20–24 s | 1,5 h | 2, 3 min | 50 µm | 5 h do montaže (2) | 30 min (2) | 419 g/l (lim. 420, IIB.d) |
| N15-V25 | 3:1:1 (1) | N75-V21 + N85-021 | 23–25 s | 1,5 h | 2 × 3 min ili 1 tanak + 1 pun (2) | 40–60 µm (2) | 2 h bez prašine / 3 h do montaže (2) | 20 min (2) | 419 g/l |
| N55-015 | spreman za upotrebu (1K) | nema | nije navedeno | nije navedeno | 1–2 tanka | 10 µm | 15 min pre filera | nije navedeno | nije navedeno |
| N55-V20 | 5:1:1 (1) | N75-020 + N85-021 | 25–29 s | 1 h | 2 (high build 3–4) (2) | 50–70 µm (HB 70–160) (2) | 3 h (2) | 30 min (2) | 539 g/l (lim. 540, IIB.c I) |
| N55-V29 | 5:1:1 (1) | N75-020 + N85-025 (EN) / N85-021 (TR) | 25–29 s | 1 h | 2 (HB 3–4) (2) | 50–70 µm (HB 70–160) (2) | 3 h (2) | 30 min (2) | 539 g/l |
| N60-V20 | 100 : 2–3 **po masi** (1) | Body Filler Hardener | nije navedeno | 4–6 min | nije navedeno | nije navedeno | 20–30 min | 10 min | 249 g/l (lim. 250, IIB.b) |
| N95-060 | nije navedeno | nema | nije navedeno | nije navedeno | nije navedeno | nije navedeno | nije navedeno | nije navedeno | nije navedeno |

Dodatna polja (dizna, pritisak, brusni papir, skladištenje, rok trajanja) su u JSON-u. Brušenje filera (N55-V20/V29): mokro P800, orbitalno suvo P400/P500 (str. 2). Za N60-V20 orbitalno suvo P80/P120/P240/P320.

TR TDS-ovi za N75-020/021/022/V21 i N85-021 sadrže samo:
- namenu: „Fast" za niske temperature, „Normal" za sobnu, „Slow" za visoke, V21 kao VOC učvršćivač za lakove;
- skladištenje na 5–40 °C;
- rok trajanja: 12 meseci za učvršćivače, 60 meseci za razređivač.

Odnos, viskozitet, sušenje i VOC u njima ne postoje.

## 4. Da li zaista ne postoji TDS za ostale proizvode?

**Postoji, ali samo na turskom i nije linkovan.** Na EN stranici asortimana TDS imaju samo N15-020, N15-V20, N15-V25, N55-015, N55-V20, N55-V29, N60-V20 i N95-060.

Za N75-020, N75-021, N75-022, N75-V21 i N85-021 postoje TR TDS-ovi na `files/TDS/TR/<šifra>.pdf`, iz 2022. Pronađeni su po obrascu URL-a, a nijedna jezička stranica sajta ne linkuje na njih. Zaglavlje je na engleskom, a tekst na turskom. Za iste šifre EN TDS ne postoji: `files/TDS/<šifra>.pdf` vraća 404. Postoji i nelinkovan `TDS/TR/N85-025.pdf`, ali N85-025 nije u našem programu.

Predlog za tekst: „Za učvršćivače i razređivač proizvođač ne objavljuje tehnički list na engleskom; odnosi mešanja su u listu osnovnog proizvoda."

## Nedostupni dokumenti

- EN TDS za N75-020, N75-021, N75-022, N75-V21 i N85-021: ne postoji (404). Postoji samo nelinkovan TR.
- Dokumenti na srpskom jeziku: nisu pronađeni ni za jedan proizvod.
- BASF US (`basfrefinish.com/norbin` → `refinish.basf.us`): 403, a odnosi se na USA program.
- Surventis izvor za Norbin TDS/SDS: nije pronađen.
- Vrednost VOC u TDS-u za N15-020 i N55-015: nije navedena u dokumentu.
