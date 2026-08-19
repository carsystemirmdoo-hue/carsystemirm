# CARSYSTEM PHASE 3 — TECHNICAL KNOWLEDGE EXTRACTION REPORT

Datum: 2026-08-08
Grana: `recovery/pre-claude-2026-08-07`

Sve mere su iz stvarno pokrenutih skripti i izgrađenog produkcionog izlaza.

---

## 1. Sources processed

| Metrika | Vrednost |
| --- | ---: |
| R-M proizvoda | 59 |
| Dokumenata ukupno | 117 |
| Tehničkih listova (TDS) | 58 |
| — sa punim setom sekcija (premazi) | 42 |
| — komponentnih listova | 16 |
| **Podobno za ekstrakciju** | **58** |
| Nečitljivih TDS-ova | **0** |
| Ukupno strana | 265 |
| Jezik | engleski |
| Revizija | 07/2026 (jedinstvena) |

Alat: `pypdf`. Detalji u `RM_SOURCE_INVENTORY.md` i `RM_EXTRACTION_METHOD.md`.

---

## 2. Sources rejected / problematic

| Kategorija | Broj | Razlog |
| --- | ---: | --- |
| `product-information` PDF-ovi | 59 | Nisu tehnički izvor. Provera sadržaja: sačuvane veb-stranice sa linkom ka TDS-u, ~177 znakova, bez tehničkih vrednosti. |
| Proizvod bez TDS-a | 1 | `hb-032-hydromix` nema tehnički list u projektu. |
| Nečitljivi TDS | 0 | — |

**Delimično upotrebljivi izvori**

| Problem | Pogođeno | Postupak |
| --- | ---: | --- |
| Dve kolone pištolja se spajaju pri ekstrakciji | 28 dokumenata | Strukturirana vrednost **nije** dodeljena; zadržan izvorni tekst, označeno kao nejasno |
| Opisno odzračivanje umesto brojčanog | 37 izjava | Zadržan tekst, bez normalizacije |
| Komponentni listovi bez parametara | 16 | Obrađeni, ali malo strukturiranih vrednosti |

---

## 3. Claims extracted

| Metrika | Vrednost |
| --- | ---: |
| **Tvrdnji izvučeno** | **470** |
| Sa strukturiranom vrednošću | 377 |
| Nejasnih (vrednost namerno prazna) | 96 |
| **Sa tačnom stranom izvora** | **470 (100%)** |
| Sa citatom iz izvora | 470 (100%) |
| Označenih `expert-verified` | **0** |

Svaka tvrdnja nosi: proizvod, polje, vrednost, dokument, stranu, sekciju, kratak citat, status i pouzdanost.

---

## 4. Substrate coverage

Najveći AEO blokator iz Faze 1 — podataka o podlozi nije bilo uopšte.

| Podloga | Podržano | Uz temeljenje | Nije navedeno |
| --- | ---: | ---: | ---: |
| Stari lak | 14 | 0 | 44 |
| E-coat (OEM) | 12 | 0 | 46 |
| GRP / SMC | 10 | 0 | 48 |
| Čelik | 9 | 5 | 44 |
| Aluminijum | 9 | 5 | 44 |
| Pocinkovani lim | 8 | 5 | 45 |
| Plastika | 1 | 0 | 57 |
| Kit | 0 | 0 | 58 |
| Temeljni sloj | 0 | 0 | 58 |

**14 od 58 proizvoda** ima eksplicitnu izjavu o podlozi. Puna matrica: `RM_SUBSTRATE_MATRIX.md`.

Ključna razlika, sprovedena kroz ceo skup podataka:

> `–` (nije navedeno) **nije** `✗` (zabranjeno).

44 proizvoda nema izjavu o podlozi. To nije podatak o nekompatibilnosti i nigde se tako ne tretira.

**Uslovne izjave.** 5 proizvoda razdvaja bezuslovnu listu od uslovne („If bare metal areas are primed…"). Te dve liste su različite tvrdnje i čuvaju se odvojeno — `suitable` vs `requires-primer`.

---

## 5. Technical-field coverage

Od 58 proizvoda sa čitljivim listom:

| Polje | Proizvoda | Strukturirano | Nejasno |
| --- | ---: | ---: | ---: |
| Izjava o primeni | 58 | 58 | 0 |
| VOC | 43 | 43 | 0 |
| Broj slojeva | 41 | 41 | 0 |
| Odzračivanje | 39 | **2** | 37 |
| Dizna / pritisak | 39 | **11** | 28 |
| Debljina sloja | 37 | 37 | 0 |
| Potlife | 36 | 36 | 0 |
| Odnos mešanja | 35 | 34 | 1 |
| Učvršćivač | 35 | 16 | 19 |
| Razređivač | 30 | 23 | 7 |
| Sušenje | 29 | 29 | 0 |
| Brušenje | 15 | 14 | 1 |
| **Podloge** | **14** | **14** | 3 |
| Upozorenja | 13 | 13 | 0 |
| Redosled primene | 6 | 6 | 0 |

Niska strukturiranost kod odzračivanja i dizne je **namerna** — vidi §2.

---

## 6. Product relationships discovered

| Tip veze | Broj |
| --- | ---: |
| proizvod → učvršćivač | 21 |
| proizvod → razređivač | 26 |
| jedinstvenih razrešenih veza | **47** |
| eksplicitne izjave o redosledu | 6 |
| — od toga zabrana prekrivanja | 1 |
| **UKUPNO** | **53** |

Sve veze potiču iz sekcija `Hardener`, `Thinner` i eksplicitnih rečenica tipa „Clean the surface with X before applying Y" ili „Do not overcoat X directly with Y".

Nijedna veza nije izvedena iz blizine u katalogu, sličnosti naziva ni uobičajene prakse.

---

## 7. Conflicts detected

**62 konflikta, nijedan automatski razrešen.**

| Tip | Broj | Značenje |
| --- | ---: | --- |
| `referenced-product-not-in-catalogue` | 60 | List navodi šifru koju Carsystem ne drži |
| `differing-mixing-ratio-within-system` | 2 | Ista kategorija i sistem, različiti odnosi |
| `duplicate-source-document` | 0 | — |
| `conflicting-substrate-state` | 0 | — |

Dominantan obrazac: R-M listovi po pravilu nude tri brzine učvršćivača (`H 2A14` / `H 2A24` / `H 2A34`) i razređivača, a Carsystem drži deo njih. To nije greška u izvoru nego poslovna odluka za vlasnika.

Za 2 razlike u odnosu mešanja sistem izričito beleži da je razlika **verovatno legitimna** (različiti proizvodi), ali to nije potvrđeno izvorom, pa se ne razrešava.

---

## 8. Answer-intent BEFORE / AFTER

| Spremnost | PRE | POSLE |
| --- | ---: | ---: |
| ODGOVORIVO SADA | 0 | **0** |
| DELIMIČNO ODGOVORIVO | 11 | 1 |
| BLOKIRANO TEHNIČKIM PODACIMA | 1 | 1 |
| BLOKIRANO STRUČNOM VALIDACIJOM | 8 | **18** |

**10 od 20 pitanja** je promenilo status. Svih 10 se pomerilo ka „blokirano stručnom validacijom" — dokazi sada postoje, čeka se čovek.

**ODGOVORIVO SADA je ostalo 0, i to je zahtev, ne propust.** Mašinski izvučen podatak ne sme sam da učini pitanje objavljivim. `resolveAnswerIntentReadiness()` prima dokaze kao ulaz, ali dokaz može najviše da pomeri pitanje na „blokirano stručnom validacijom".

Primeri:

| Pitanje | Dokaz nađen |
| --- | --- |
| Koji prajmer na aluminijum? | 14 proizvoda (9 direktno, 5 uz temeljenje) |
| Koji prajmer na pocinkovani lim? | 13 proizvoda (8 direktno, 5 uz temeljenje) |
| Odnos mešanja za bezbojni lak? | 34 proizvoda + 16 učvršćivača + 23 razređivača |
| Koliko slojeva bezbojnog laka? | 41 proizvod (slojevi) + 37 (debljina) |
| Koliko se suši lak? | 29 proizvoda |
| Koja dizna za bezbojni lak? | 11 proizvoda (28 nejasno) |

Za pitanje o kitu dokazi su prikazani sa razbijanjem po kategoriji (`primer-filler 13, bodyfiller 1`) — brojka sama bi sugerisala jaču podršku nego što postoji.

Puni podaci: `RM_INTENT_READINESS.json`.

---

## 9. Human review item count

`CARSYSTEM_TECHNICAL_CONTENT_REVIEW.md`:

| Sekcija | Stavki |
| --- | ---: |
| A — Pitanja visokog prioriteta | 11 |
| B — Kompatibilnost podloga | 6 |
| C — Odnosi u sistemu proizvoda | 21 |
| D — Mešanje i nanošenje | 19 |
| E — Sušenje i brušenje | 19 |
| G — Konflikti i nejasnoće | 3 |
| **Stavki ukupno** | **79** |
| F — Terminologija (tabela) | 35 izraza |

**470 tvrdnji → 79 odluka.** Identične tvrdnje iz istog tipa izvora spojene su u jednu stavku sa listom pogođenih proizvoda, pa jedna odluka pokriva ceo skup — npr. jedna izjava o podlozi važi za 5 proizvoda odjednom.

Bez grupisanja dokument bi imao 470 stavki.

---

## 10. Estimated expert review burden

| Sekcija | Stavki | Procena po stavci | Ukupno |
| --- | ---: | --- | --- |
| A — Pitanja | 11 | 5–10 min (pisanje odgovora) | 1–2 h |
| B — Podloge | 6 | 3–5 min | 20–30 min |
| C — Odnosi | 21 | 1–2 min | 25–45 min |
| D — Mešanje | 19 | 1–2 min | 20–40 min |
| E — Sušenje | 19 | 1–2 min | 20–40 min |
| F — Terminologija | 35 izraza | ~20 s | 10–15 min |
| G — Konflikti | 3 | 5–15 min (poslovna odluka) | 15–45 min |
| **UKUPNO** | | | **≈ 3–5 sati** |

Procena pretpostavlja da stručnjak ima listove pri ruci; svaka stavka nosi dokument, stranu i citat, pa provera ne zahteva pretragu.

**Preporuka:** ne raditi odjednom. Sekcije A i B nose gotovo svu vrednost — oko 1,5–2,5 h otključava 3 pitanja najvišeg prioriteta i celu matricu podloga.

---

## 11. Remaining knowledge gaps

| Praznina | Stanje | Uzrok |
| --- | --- | --- |
| Podloge za 44 proizvoda | Nema izjave | Izvorni listovi ih ne navode |
| Dizna/pritisak za 28 proizvoda | Nejasno | Spojene kolone dva pištolja |
| Odzračivanje kao broj | 37 opisnih | Listovi navode opisno |
| Uzroci i sanacija defekata | 0 od 8 | **Nema u R-M listovima uopšte** |
| Izdašnost (coverage) | 0 | Nema u listovima |
| Temperatura okruženja / vlažnost | 0 | Nema kao zasebno polje |
| Podaci za Cosmos Lac (742 proizvoda) | 0 | Nema TDS-ova u projektu |
| Tekstovi vodiča | 0 od 3 | Piše stručnjak |
| Potvrda 35 izraza | 0 | Čeka stručnjaka |

**Najvažnije:** defekti (pomorandžina kora, krateri…) se **ne mogu** rešiti iz postojeće dokumentacije. R-M tehnički listovi ne obrađuju dijagnostiku grešaka. To znanje mora doći od Carsystem stručnjaka ili iz zasebnog R-M priručnika koji nije u projektu.

**Ispravka nalaza iz Faze 1.** Audit je naveo „0 zapisa o odnosu mešanja". Tačnije: jedan proizvod (`c-2p42-race-finish-r`) ima tri ručno unete, `confirmed` tehničke činjenice u `lib/rm-imported-products.ts:333` (odnos mešanja 3:1:1, viskozitet, pot life), sa citiranom stranom TDS-a. To je jedini tehnički podatak koji je bio objavljen pre Faze 3. Otkriveno tokom testiranja zaštite od curenja.

---

## 12. Exact files changed

### Novi fajlovi (9)

| Fajl | Uloga |
| --- | --- |
| `scripts/lib/rm-pdf-text.mjs` | Čitanje PDF-a + normalizacija ligatura |
| `scripts/inventory-rm-documents.mjs` | Inventar izvora |
| `scripts/extract-rm-technical-data.mjs` | Ekstrakcija tvrdnji |
| `scripts/analyze-rm-extraction.mjs` | Matrica podloga + konflikti |
| `scripts/report-intent-readiness.mjs` | BEFORE/AFTER za intente |
| `lib/knowledge/answer-intent-evidence.ts` | Izvođenje postojanja dokaza |
| `data/knowledge/rm-technical-extraction.generated.json` | **Skup podataka (470 tvrdnji)** |
| `docs/seo/RM_EXTRACTION_METHOD.md` | Metodologija i ograničenja |
| `docs/seo/PHASE3_EXTRACTION_REPORT.md` | Ovaj izveštaj |

### Generisani izveštaji (5)

`RM_SOURCE_INVENTORY.json` + `.md`, `RM_SUBSTRATE_MATRIX.md`, `RM_EXTRACTION_CONFLICTS.json`, `RM_INTENT_READINESS.json`

### Izmenjeni fajlovi (6)

| Fajl | Izmena |
| --- | --- |
| `lib/knowledge/provenance.ts` | Dodato `excerpt` u `KnowledgeSource` |
| `lib/knowledge/product-knowledge.ts` | Učitavanje ekstrakcije, `getSubstrateEvidence()` |
| `lib/knowledge/answer-intents.ts` | `requiredTechnicalFields`, dokazi u `resolveAnswerIntentReadiness()` |
| `data/knowledge/answer-intents.ts` | Označeno 6 intenata sa potrebnim poljima |
| `scripts/validate-knowledge.mjs` | Zaštita od curenja + negativan test |
| `scripts/export-technical-review.mjs` | Prepisano — sekcije A–G sa grupisanjem |
| `package.json` | 5 novih skripti + `knowledge:pipeline` |

**Nije dirano:** nijedan vizuelni komponent, nijedan CSS, nijedna SEO ruta, nijedan proizvodni zapis, nijedna postojeća objavljena vrednost.

---

## 13. Validation

| Provera | Rezultat |
| --- | --- |
| `npm run typecheck` | ✓ čisto |
| `npm run lint` | ✓ čisto |
| `npm run build` | ✓ 954/954 stranica |
| `npm run knowledge:validate` | ✓ sve provere prolaze |
| `npm run seo:validate` | ✓ 0 grešaka, 0 upozorenja |

### Zaštita od curenja — eksplicitno testirana

| Provera | Rezultat |
| --- | ---: |
| Tvrdnji sa statusom `machine-extracted` | 470 / 470 |
| Tvrdnji sa `expert-verified` | **0** |
| Markera × stranica provereno | 12 × 832 |
| Formulacija podloga × R-M stranica | 8 × 58 |
| **Procurelih vrednosti** | **0** |
| Propusta u JSON-LD | 0 |

**Negativan test.** U izgrađeni HTML je ubačeno veštačko curenje (`Product is suitable on Sheet steel`); validator ga je prijavio kao 3 greške, a nakon uklanjanja ponovo prošao. Provera dokazano radi u oba smera.

Dve verzije provere su odbačene tokom rada jer su davale lažne pozitive — poređenje golih brojeva (`1:1` se poklapa unutar `3:1:1`, a serijalizovani RSC payload povezanih proizvoda nosi vrednosti drugog proizvoda) i jednorečne formulacije (`Aluminium` je legitiman deo Cosmos naziva). Konačna provera koristi višerečne engleske formulacije i ograničena je na R-M stranice.

Sajt prikazuje isto što i pre Faze 3.

---

## 14. Recommended Phase 4

| # | Rad | Zavisi od |
| --- | --- | --- |
| 1 | **Sesija sa stručnjakom: sekcije A i B** (~2 h) — otključava 3 pitanja najvišeg prioriteta i matricu podloga | — |
| 2 | Objaviti prva 2–3 vodiča iz odobrenih odgovora | 1 |
| 3 | Ručno očitati diznu/pritisak za 28 proizvoda sa dve kolone | stručnjak |
| 4 | Poslovna odluka o 60 šifara van kataloga (nabaviti / zameniti / ne prikazivati) | vlasnik |
| 5 | Rute `/podloge/[slug]` — tek kada su podloge `expert-verified` | 1 |
| 6 | Uzroci i sanacija defekata — traži zaseban izvor ili znanje stručnjaka | stručnjak |
| 7 | Objaviti `substrates` u Product schema tek nakon odobrenja | 1 |
| 8 | Preostalo iz Faze 1: kategorije van R-M, `lastModified`, hijerarhija naslova, provera `MAINTENANCE_MODE` | — |

**Kritični put je stavka 1.** Sve ostalo od vrednosti zavisi od nje, a traje oko dva sata.
