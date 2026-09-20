# Norbin — audit izvora i modela (dry run)

Grana `feat/norbin-catalog-sync-2026`, osnova `main` `2383987`. **Nije rađen apply.**
Sveže preuzimanje izvora: 2026-09-20. Prethodna akvizicija (2026-08-08) je commitovana u
`data/knowledge/norbin-*.generated.json` i ovde služi kao drugi svedok.

## 1. Izvori i status

| Izvor | Status | Dokaz |
| --- | --- | --- |
| `norbin-paint.com/{en,tr,kz}/norbin-range.html` | **CURRENT_BUT_LEGACY_BRANDING** | HTTP 200; futer: „© BASF Coatings GmbH 2026", „NORBIN® is a registered Trademark of BASF Coatings GmbH" |
| `norbin-paint.com/files/TDS/*.pdf` | **CURRENT** | 29 jedinstvenih listova linkovano sa stranica |
| `norbin-paint.com/files/MSDS/*.pdf` | **CURRENT** | 72 bezbednosna lista, jedan po pakovanju |
| `norbin-paint.com/{me,de,pl}/norbin-range.html` | **UNCERTAIN** | stranica postoji, sadržaj je čuvar mesta („Inhalte ME/DE/PL") |
| `techinfo.norbin-paint.com` | **HISTORICAL** | 301 na samog sebe — tehnički portal ne postoji |
| `robots.txt`, `sitemap.xml` | — | 404, nikad nisu ni postojali |
| Zakomentarisani linkovi u HTML-u | **HISTORICAL** | 35 linkova je proizvođač sklonio sa stranice |

**Branding se ne menja.** Izvor i danas, skoro tri meseca posle izdvajanja BASF Coatings u
Surventis (1. jul 2026), objavljuje BASF vlasništvo. Brend ostaje `Norbin`, proizvođač
`BASF Coatings GmbH`; „by Surventis" se ne dodaje i Surventis logo se ne izmišlja.

**Bez drifta.** Sveže preuzimanje daje istih 24 šifre i istih 102 dokumenta kao snimak od
2026-08-08: 0 novih, 0 nestalih, 0 promenjenih imena fajlova.

## 2. Arhitektura izvora

Najjednostavnija do sada: statički HTML, bez CMS-a, **bez stranica proizvoda** i **bez ijedne
fotografije proizvoda**. Stranica opsega JESTE katalog:

```
<h3>Downloads</h3>  brošura, poster sivih tonova
<h4>TDS</h4>        jedan link po PROIZVODU  — „NORBIN® N15-020 Clear"
<h4>MSDS</h4>       jedan link po PAKOVANJU — „NORBIN® N15-020 Clear 1L"
```

Zvanični naziv postoji samo u TEKSTU LINKA. Za pet proizvoda bez tehničkog lista naziv nosi
MSDS link („N75-020 Hardener Fast 0,5L" → naziv „N75-020 Hardener Fast", pakovanje „0,5 L").

## 3. Model proizvoda

| Pitanje | Odgovor |
| --- | --- |
| Current product families | **13 u EMEA** (`en`), + 5 samo u TR programu |
| Current official codes | **13 EMEA** / 18 živih u bilo kom regionu / 30 poznatih šifara ukupno |
| Šifra = proizvod ili pakovanje | **proizvod**; pakovanje je varijanta |
| Jedan proizvod, više pakovanja | da — 4 od 13 (`N15-020`, `N60-V20`, `N75-021`, `N85-021`), ukupno 17 pakovanja |
| Učvršćivači/razređivači/aditivi | **zasebni proizvodi** sa svojom šifrom, SDS-om i nazivom |
| Mixing system | **NE postoji** |
| Toner linije | **NE postoje** |
| Toneri sa zvaničnim identitetom | **0** |
| System cards | **0** |
| Website-only proizvodi | 0 (sajt nema stranice proizvoda; „website-only" kategorija ovde nema smisla) |
| PDF-only proizvodi | **5** od 13 EMEA — postoje samo kroz MSDS link (`N75-020/021/022/V21`, `N85-021`) |
| Proizvodi bez zvanične slike | **13 od 13** — izvor ne objavljuje nijednu fotografiju |
| Discontinued u starim PDF-ovima | **12 šifara** postoji samo u zakomentarisanom sloju |

Sam izvor to i potvrđuje: „The NORBIN® brand in EMEA includes quality **clearcoats, primers and
other auxiliaries**". Nema bazne boje, nema sistema nijansiranja, nema tonera.

Porodice po prefiksu šifre: `N15` bezbojni lak · `N55` prajmer/filer · `N60` kit ·
`N75` učvršćivač · `N85` razređivač · `N95` sredstvo za čišćenje.

## 4. EMEA program (13 šifara)

| Šifra | Uloga | TDS | SDS | Pakovanja | Zvanični naziv |
| --- | --- | :-: | --: | --- | --- |
| N15-020 | clearcoat | ✅ | 6 | 1 L, 5 L | N15-020 Clear |
| N15-V20 | clearcoat | ✅ | 2 | 4 L | N15-V20 Clear VOC |
| N15-V25 | clearcoat | ✅ | 2 | 5 L | N15-V25 Fast Clear VOC |
| N55-015 | undercoat | ✅ | 1 | 1 L | N55-015 1K Plastic Primer |
| N55-V20 | undercoat | ✅ | 2 | 2,5 L | N55-V20 2K Primer Filler grey |
| N55-V29 | undercoat | ✅ | 2 | 2,5 L | N55-V29 2K Primer Filler black |
| N60-V20 | bodyfiller | ✅ | 4 | 1,95 kg + 0,05 kg | N60-V20 Multifunctional Body Filler + Hardener |
| N75-020 | hardener | ❌ | 2 | 0,5 L | N75-020 Hardener Fast |
| N75-021 | hardener | ❌ | 6 | 0,5 L, 2,5 L | N75-021 Hardener Normal |
| N75-022 | hardener | ❌ | 2 | 2,5 L | N75-022 Hardener Slow |
| N75-V21 | hardener | ❌ | 1 | 1 L | N75-V21 Clear Hardener VOC |
| N85-021 | reducer | ❌ | 4 | 1 L, 5 L | N85-021 Thinner |
| N95-060 | cleaner | ✅ | 2 | 5 L | N95-060 Silicone cleaner |

`N60-V20` je **komplet**: ista šifra pokriva kit (1,95 kg) i njegov učvršćivač (0,05 kg). To
nisu dva pakovanja istog materijala i ne modeluju se kao varijante iste materije.

## 5. Odnosi iz tehničkih listova (deklarisani, ne izvedeni)

| Proizvod | Odnos | Partner |
| --- | --- | --- |
| N15-020 | 2:1 | N75-021 · N75-022 |
| N15-V20 | 4:1 | N75-V21 |
| N15-V25 | 3:1 | N75-V21 · N85-021 |
| N55-V20 | 5:1 | N75-020 |
| N55-V29 | 5:1 | N75-020 · **N85-025** |

`N85-025` je jedina šifra koju tehnički list imenuje, a izvor je ne objavljuje ni u jednom
regionu — ostaje `UNCERTAIN`, bez kartice i bez pojma pretrage.

## 6. Dokumenti

| Mera | Broj |
| --- | --: |
| `TOTAL_LOCAL_NORBIN_FILES` (u repozitorijumu) | **0** |
| — pripremljeno van repozitorijuma (`assets/manufacturer/`, gitignore) | 99 (~44 MB), samo u glavnom worktree-u |
| `UNIQUE_OFFICIAL_PRODUCT_DOCS` | **103** |
| `CURRENT_LINKED_DOCS` | **68** |
| `UNLINKED_OFFICIAL_DOCS` | **35** |
| `HISTORICAL_DOCS` | 35 (isti skup — sklonjeni sa stranice) |
| `DUPLICATE_DOCS` | **0** (98 preuzetih, 98 jedinstvenih po sadržaju) |
| Pokvareni linkovi na izvoru (HTTP 404) | **4** — `N55-121_TR`, `N75-121_TR`, `N85-120_TR`, `N85-121_TR` |

Revizije: isti proizvod ima više fajlova samo zbog JEZIKA/REGIONA (EN/TR/RU), ne zbog revizije.
Godina u imenu postoji na 3 fajla (2022). Pravilo: referentni je engleski (EMEA) list.

## 7. Šta već postoji kod nas

| Sloj | Stanje |
| --- | --- |
| Runtime zapisi | **2** (`norbin-n15-020-1l`, `-5l`) — jedan proizvod u dva pakovanja |
| Vidljive kartice | **2** (nisu porodica, pa se prikazuju kao dva proizvoda) |
| Generisani datasetovi | 4 (`norbin-catalog`, `-documents`, `-match`, `-tds-claims`) + brend manifest |
| Lokalne slike | 1 packshot (`norbin-n15-020-1l.webp` + izvorni `.jpg`) |
| Poreklo slike | **kupčev fajl** iz `_incoming/` (isti SHA256) — proizvođač nema nijednu sliku |
| Lokalni zvanični PDF-ovi | **0** u `public/` |
| Brend stranica | `components/norbin-brand/` (5 fajlova) — već nosi tačan model |
| Skripte ranije akvizicije | 5 |
| Dokumentacija | 7 fajlova |

Klasifikacija: `EXACT_MATCH` **2** · ostalo **0**. Dvanaest EMEA šifara nema nijedan lokalni zapis.

**Zašto je Norbin tako mali:** nije greška uvoza. Izvor nikad nije ni imao stranice proizvoda
ni slike, a dokumentacija je rights-gated (`docs/NORBIN_DOCUMENT_SOURCE_MAP.md`, odluka od
2026-08-15), pa nijedan raniji korak nije smeo da objavi ni PDF-ove ni proizvode. Kreiran je
samo artikal koji imamo na zalihama i za koji postoji kupčeva fotografija.

## 8. Nerešeno

1. **Prava na dokumenta.** Bez potvrde prava, TDS/SDS se ne hostuju lokalno; plan ih vodi kao
   reference na `norbin-paint.com`.
2. **ERP lista (`8 od 13`)** postoji samo u `docs/NORBIN_PRODUCT_INVENTORY.md` §14.2, izvedena
   iz `lager 23.7.26.pdf` koji nije u repozitorijumu → nije deterministički ulaz.
3. **`N85-025`** — stvaran artikal u našem ERP-u (507127), bez ijednog traga kod proizvođača.
4. **Kontradikcija na brend stranici**: `norbinRatios` označava `N75-020` i `N75-021` kao
   `stocked`, a nijedan nema proizvodni zapis.
5. **Crna Gora / region**: nema regionalnog izvora za naše tržište.
