# CARSYSTEM FAZA 5 — PRIKUPLJANJE PODATAKA PO BRENDOVIMA

Datum: 2026-08-08
Grana: `recovery/pre-claude-2026-08-07`

**Ova faza NIJE završena za sve brendove.** Odrađen je kompletan inventar i istraživanje izvora za svih 10 brendova, ali duboko prikupljanje je urađeno samo za baslac. Detalji i razlozi su u §7.

---

## 1. Inventar brendova (kompletno)

| Brend | Na sajtu | Slike | Dokumenti | Zvanični izvor | Izvodljivost |
| --- | ---: | ---: | ---: | --- | --- |
| **Cosmos Lac** | 742 | 744 | 0 | cosmoslac.com | samo katalog PDF |
| **R-M** | 64 | 75 | 117 | rmpaint.com | strukturiran portal |
| **Carsystem** | 9 | 13 | 6 | carsystem.org | stranice proizvoda |
| **Befar** | 8 | 8 | 0 | **nije nađen** | — |
| **baslac** | 4 | 4 | **102** | baslac.com | strukturiran portal |
| **Car Fit** | 2 | 1 | 0 | carfitrepair.com | samo katalog PDF |
| **Norbin** | 2 | 1 | 0 | norbin-paint.com | samo katalog PDF |
| **SATA** | 1 | 0 | 0 | sata.com | stranice proizvoda |
| **Rupes** | 0 | 0 | 0 | rupes.com | stranice proizvoda |
| **A.U.T.O. Fit** | 0 | 0 | 0 | **nije nađen** | — |
| **UKUPNO** | **832** | **846** | **225** | | |

Pre ove faze: 123 dokumenta. Posle: **225** (+102 baslac).

### Nalazi iz inventara

- **6 od 8 aktivnih brendova nije imalo nijedan tehnički dokument.** Sada je 5.
- **Cosmos Lac je najveća rupa**: 742 proizvoda (89% kataloga) i nula dokumentacije.
- `placeholder-tds.pdf` i `placeholder-msds.pdf` postoje u projektu i **nisu** izvor.

---

## 2. Istraživanje izvora (kompletno, 10/10)

Svi izvori su provereni stvarnim pristupom, ne pretpostavkom. Evidentirani u `data/knowledge/brand-sources.ts` sa datumom provere.

**Ključni nalaz:** baslac, R-M i Norbin su BASF brendovi i dele isti obrazac tehničkog portala (`techinfo.{brand}.com`). To je otvorilo baslac akviziciju.

**Dva brenda bez pronađenog izvora:**

| Brend | Stanje |
| --- | --- |
| **Befar** | Pretraga nije našla proizvođača tog imena u oblasti poliranja. Lokalni proizvodi su sunđeri u 4 boje × 2 dimenzije. Verovatno privatna robna marka ili regionalni dobavljač. **Traži podatak od Carsystem-a.** |
| **A.U.T.O. Fit** | Placeholder bez proizvoda; naziv previše generički za pouzdanu identifikaciju. **Traži podatak od Carsystem-a.** |

---

## 3. baslac — kompletno prikupljeno

| Metrika | Vrednost |
| --- | ---: |
| Dokumenata u zvaničnom indeksu | 101 |
| + iz Carsystem ponude, van indeksa | 1 |
| **Preuzeto ukupno** | **102** (32 MB) |
| — tehnički listovi | 94 |
| — karte nijansi / grafikoni | 8 |
| Neuspelih preuzimanja | **0** |
| **Tehničkih tvrdnji izvučeno** | **540** |
| Poklopljeno sa našim katalogom | 1 |
| **Kandidata kod proizvođača** | **93** |

### Pokrivenost po polju

| Polje | Dokumenata | Napomena |
| --- | ---: | --- |
| Zvanični opis | 71 | |
| Broj slojeva | 52 | |
| Dizna i pritisak | 51 | **96 vrednosti** — HVLP i gravity odvojeno |
| Odnos mešanja | 50 | |
| Debljina sloja | 49 | |
| Vreme upotrebljivosti | 47 | |
| Razređivač | 37 | uloga izvedena iz redosleda — označeno |
| Odzračivanje | 36 | |
| Sušenje | 35 | |
| Učvršćivač | 35 | uloga izvedena iz redosleda — označeno |
| VOC | 31 | |

**Za razliku od R-M**, baslac odvojeno označava HVLP i Compliant gravity-feed kolone, pa podatak o dizni **nije dvosmislen** — kod R-M je 28 dokumenata moralo da ostane nepopunjeno zbog spajanja kolona.

### Otkriće: proizvod u ponudi bez lista u indeksu

Držimo **baslac 60-20 Reducer**, ali ga zvanični indeks ne objavljuje — iako ga drugi listovi navode kao komponentu. PDF postoji na dokumentovanom URL obrascu.

Preuzet je uz proveru: dokument se odbacuje ako mu sadržaj ne potvrđuje traženu šifru. Za preostala 3 naša baslac proizvoda (`30-S510`, `35-M214`, `35-M331`) obrazac vraća **404** — za njih dokumentacija nije javno dostupna.

---

## 4. Model podataka i poreklo

Novi tipovi u `lib/knowledge/manufacturer-catalog.ts`, uz postojeći provenance model iz Faze 2 bez izmena.

**Ključno bezbednosno svojstvo — `catalogStatus`:**

```
carsystem-offered              u našem katalogu (59)
manufacturer-catalog-candidate kod proizvođača, NIJE naše (93)
discontinued / rejected        ljudska odluka
```

Nijedan pronađeni proizvod nije prikazan kao nešto što Carsystem prodaje. Poklapanje ide po šifri proizvoda u odnosu na naše slugove.

Svaki asset nosi: `sourceUrl`, `localPath`, `bytes`, `sha256`, `accessedAt`, `version`, i način pribavljanja (`official-index` ili `url-pattern-verified-by-content`).

Svaka tvrdnja nosi: izvorni URL, naziv i verziju dokumenta, stranu, sekciju, doslovan citat, datum pristupa, status i pouzdanost.

---

## 5. Šta je izvučeno bez zaključivanja

Ista disciplina kao u Fazi 3 — **IZVUCI, NE ZAKLJUČUJ**:

- **Skraćenice su razrešene, ne odsečene.** baslac piše `50-15, -20` misleći na dva proizvoda; čitanje samo prvog tiho gubi alternativu koju list nudi.
- **Uloga učvršćivač/razređivač je označena kao izvedena.** baslac je ne imenuje eksplicitno — izvedena je iz redosleda u tabeli i svih 78 takvih tvrdnji nosi upozorenje.
- **Matrica podloga nije pogađana.** `Plastic_metallic_repair.pdf` sadrži tabelu proizvod × podloga, ali su oznake u ćelijama grafičke i ne preživljavaju tekstualnu ekstrakciju. Vidljivi su proizvodi (12-20, 20-24, 20-34, 20-94, 25-30, 27-10, 20-35/95), podloge i legenda — **ali ne i koja ćelija nosi koju oznaku**. Zahteva ručno očitavanje.

---

## 6. Zaštita od objavljivanja — provereno

Sve prikupljeno ima status `machine-extracted`.

| Provera | Rezultat |
| --- | ---: |
| baslac tvrdnji sa `expert-verified` | **0** |
| R-M tvrdnji sa `expert-verified` | **0** |
| baslac vrednosti × stranica | 19 × 832 → **0 curenja** |
| R-M markera × stranica | 12 × 832 → **0 curenja** |
| Izjave o podlozi × R-M stranica | 8 × 58 → **0 curenja** |
| JSON-LD | **0 propusta** |

Validator je proširen da pokriva svaki prikupljeni brend, ne samo R-M.

| Provera | Rezultat |
| --- | --- |
| `npm run typecheck` | ✓ |
| `npm run lint` | ✓ |
| `npm run build` | ✓ 954/954 |
| `npm run knowledge:validate` | ✓ sve prolazi |
| `npm run seo:validate` | ✓ 0 grešaka |

Sitemap i dalje 198 URL-ova, ProductGroup konsolidacija netaknuta, sajt prikazuje isto što i pre.

---

## 7. Šta NIJE urađeno

Ovo je najvažniji deo izveštaja.

| Brend | Šta nedostaje | Zašto |
| --- | --- | --- |
| **Cosmos Lac** | Kompletan portfolio, TDS, SDS | Nema strukturiran TDS portal. Postoji katalog PDF i `/products/`. Zahteva zaseban parser ili kontakt sa proizvođačem. **742 proizvoda — najveći prioritet.** |
| **Carsystem** | ~2.000 proizvoda kod proizvođača (imamo 9) | 10 kategorija sa zasebnim stranicama; traži scraper po kategorijama. |
| **C.A.R.FIT** | Portfolio iz kataloga 2026 | Katalog PDF je lociran, nije parsiran. |
| **Norbin** | Portfolio iz BASF PDF-a | PDF lociran, nije parsiran. |
| **SATA** | Portfolio opreme | Drugačiji tehnički model (protok, dizne) — traži zaseban model. |
| **Befar / A.U.T.O. Fit** | Sve | Zvanični izvor nije identifikovan. |
| **Svi brendovi** | **Fotografije proizvoda** | Nijedna slika nije preuzeta sa izvora proizvođača. |
| **Svi brendovi** | **SDS (bezbednosni listovi)** | Nijedan SDS nije prikupljen. |

**Iskrena ocena:** zadatak je tražio iterativni prolaz kroz sve brendove. Urađen je kompletan inventar i istraživanje izvora za svih 10, ali duboko prikupljanje samo za baslac. baslac je odabran jer je jedini imao strukturiran portal koji daje pouzdan rezultat bez nagađanja; ostali traže po jedan namenski parser i realno su zaseban posao po brendu.

---

## 8. Paketi za stručni pregled

| Dokument | Proizvoda | Sadržaj |
| --- | ---: | --- |
| `EXPERT_REVIEW_BASLAC.md` | 94 | 1 iz ponude + 93 kandidata |
| `EXPERT_REVIEW_RM.md` | 58 | svi iz ponude |

Svaki proizvod prikazuje: naziv, šifru, status, tehnički list sa linkom i verzijom, tabelu tehničkih podataka sa stranom, citate iz izvora, i 4 polja za odluku. Kandidati imaju dodatno polje **„DODATI U CARSYSTEM PONUDU“**.

Fotografija je eksplicitno označena kao neprikupljena, da se ne bi steklo utisak da postoji.

---

## 9. Izmenjeni i novi fajlovi

**Novi (12)**

| Fajl | Uloga |
| --- | --- |
| `lib/knowledge/manufacturer-catalog.ts` | Tipovi kandidata, assets, catalogStatus |
| `data/knowledge/brand-sources.ts` | Provereni izvori za 10 brendova |
| `scripts/inventory-brands.mjs` | Lokalni inventar |
| `scripts/acquire-baslac-documents.mjs` | Preuzimanje baslac dokumentacije |
| `scripts/extract-baslac-technical-data.mjs` | baslac parser |
| `scripts/build-brand-manifests.mjs` | Manifesti + GAP report |
| `scripts/export-brand-expert-review.mjs` | Paket po brendu |
| `data/knowledge/brands/*.manifest.generated.json` | 10 manifesta |
| `data/knowledge/baslac-documents.generated.json` | 102 dokumenta sa poreklom |
| `data/knowledge/baslac-technical-extraction.generated.json` | 540 tvrdnji |
| `public/documents/products/baslac/*.pdf` | **102 nova dokumenta (32 MB)** |
| `docs/seo/BRAND_INVENTORY.*`, `BRAND_GAP_REPORT.md`, `EXPERT_REVIEW_*.md` | Izveštaji |

**Izmenjeni (3)**

| Fajl | Izmena |
| --- | --- |
| `scripts/lib/rm-pdf-text.mjs` | Uklanjanje nemapiranih glifova (U+FFFD) |
| `scripts/validate-knowledge.mjs` | Zaštita proširena na sve prikupljene brendove |
| `package.json` | 5 novih skripti |

**Nije dirano:** nijedan vizuelni komponent, CSS, brand stranica, SEO ruta, ProductGroup konsolidacija ni ijedna objavljena vrednost.

---

## 10. Preporuka za nastavak

| # | Rad | Napomena |
| --- | --- | --- |
| 1 | **Cosmos Lac** — parser kataloga + kontakt sa proizvođačem za TDS/SDS | 742 proizvoda bez ijednog dokumenta; najveći efekat |
| 2 | **Carsystem** — scraper po 10 kategorija | ~2.000 proizvoda kod proizvođača, 9 kod nas |
| 3 | **Ručno očitavanje baslac matrice podloga** | Jedan dokument, otključava podloge za 7 grupa proizvoda |
| 4 | **Fotografije proizvoda** sa zvaničnih izvora | Nijedna nije preuzeta; traži odluku o obimu i pravima |
| 5 | **SDS za sve brendove** | Nijedan nije prikupljen |
| 6 | **Befar i A.U.T.O. Fit** — utvrditi proizvođača | Blokirano; traži podatak od Carsystem-a |
| 7 | C.A.R.FIT i Norbin — parsirati locirane kataloge | PDF-ovi su locirani |

Stavke 1 i 2 su realno zaseban posao po brendu, sličnog obima kao baslac akvizicija.
