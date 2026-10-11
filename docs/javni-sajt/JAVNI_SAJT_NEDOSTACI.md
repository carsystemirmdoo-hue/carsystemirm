# Javni sajt — nedostaci i plan dopune

| | |
|---|---|
| Datum provere | 2026-10-11 (14:20–16:45) |
| Grana / commit | `plan/meni-i-kupovina-2026-10-11` @ `2516912` (= `company/main` d81267f + revizija portala 85cb04d + dva docs commita; javni deo identičan `company/main`) |
| Radno stablo pri buildu | čisto (`git status` prazan) |
| Pregledani URL | `http://localhost:3220` — lokalni produkcioni build istog koda (`npm run build:check` → `.next-verify`, `next start`), bez `VERCEL_ENV` |
| Production | `https://carsystemirm.com/` → **307 na `/site-u-pripremi`** (režim održavanja). Javni sadržaj danas nije dostupan posetiocu, pa je proveren lokalni build istog koda. |
| Izvori | Ovaj fajl + `JAVNI_SAJT_NEDOSTACI.csv` (1.024 nalaza, jedan red po URL-u i nalazu) + `JAVNI_SAJT_INVENTAR_PROIZVODA.csv` (svih 1.912 zapisa proizvoda) |

**Ispravke:** grana `fix/javni-sajt-2026-10-11` — stanje posle ispravki je u odeljku 0; odeljci 1–8 su snimak stanja PRE ispravki.

**Status pregleda: NIJE ZAVRŠEN u celini.** Automatski su proverene sve javne adrese i svi proizvodi; vizuelno su provereni svi jedinstveni šabloni. Ostaje neprovereno ono što je navedeno u odeljku 8 (tačnost tehničkih podataka prema TDS-u za svaki proizvod, prava na slike, Production posle otvaranja sajta).

Ranije postojećeg glavnog fajla za nedostatke javnog sajta nije bilo. Najbliži su `docs/CONTENT_GAPS_REQUIRING_OWNER_INPUT.md`, `docs/catalog/image-gaps-2026-10/`, `CARSYSTEM_IMAGE_AUDIT.csv` i paket `EXPERT_REVIEW_MASTER_FINAL.md` (postoji samo na grani `chore/expert-review-package-preservation`). Zato je napravljen ovaj fajl. Stari izveštaji su korišćeni kao tragovi: 158 tvrdnji je ponovo provereno (odeljak 7).

---

## 0. Stanje posle ispravki (2026-10-11; dopunjeno drugim, trećim i četvrtim krugom)

**Grana:** `fix/javni-sajt-2026-10-11` (od `company/main` d81267f), radno stablo `~/Carsystem/radno/javni-sajt-ispravke`. Nije pushovano, nema deploya.
**Provera:** izolovani produkcioni build iste grane (`NEXT_DIST_DIR=.next-javni`, port 3520). Pre ispravki je baza ponovo izmerena u istom buildu, pa su ključni browser nalazi potvrđeni nezavisno od `.next-verify` koji je druga sesija ponovo izgradila u 16:42.
**Tuđe izmene:** druga sesija je u međuvremenu komitovala svoj rad na `feat/kupovina-na-sajtu` (status i kupovina za prijavljenog kupca). Ništa od toga ne rešava ove nalaze i ništa nije dirano.

Stanje svakog reda je u CSV-u, u kolonama `stanje` i `resenje_i_provera`; za otvorene redove i `kategorija_preostalog` i `stranice_preostalog` (odeljak 0.4).

| Stanje | Redova | Napomena |
|---|---:|---|
| REŠENO | 536 | proveren konkretan prikaz u izolovanom buildu |
| DELIMIČNO | 5 | rešen tekst, ali ostaje odluka ili materijal |
| NIJE NEDOSTATAK | 53 | ponovo provereno: npr. različite vrednosti iste oznake, zvanični engleski nazivi SATA, pogrešno prebrojane kartice |
| OTVORENO | 430 | slike, prava, tvrdnje, odluke i stavke van ovog kruga |

Po radnom redu: red 1 — 446 rešeno, 45 nije nedostatak, 3 delimično, 93 otvoreno · red 2 — 88 rešeno, 8 nije nedostatak, 2 delimično, 33 otvoreno · red 3 — 2 rešeno (sušenje baslac 40-440/40-450 prema zvaničnom TDS-u), 304 otvoreno.

### 0.1 Šta je rešeno i kako je provereno

| Grupa | Rešenje | Dokaz posle ispravke |
|---|---|---|
| Car Fit lista (JS-0026) | `CarfitReveal` prag 0 umesto 0,08 | kartice #0, #40, #110: najmanja opacity u lancu predaka 1 (bilo 0) na 1.440 i 390 px |
| Interni i nedovršeni tekst (G10, G09, G19, G24-placeholder, G21) | uklonjene ili zamenjene rečenice na brend stranama, programima, kategorijama i PDP-u; placeholder stavke dokumenata uklonjene | crawl celog sajta: „U pripremi za javni katalog” 19 → 0 strana, „Fotografija u pripremi” 1 → 0, „dostavljen…” 73 → 1 (preostala je tvrdnja o Emil Frey, čeka Vas), „javni/lokalni katalog/zapis” 21 → 0, interna šifra `NORBIN-…` 4 → 0, „PDF str. 72” 1 → 0 |
| Dupli tehnički redovi (G05) | jedinstveno pravilo prikaza `lib/technical-facts-display.mjs`: red se izostavlja samo kad ima istu oznaku i sve brojeve već sadržane u ranijem redu; isto važi za JSON-LD | duplikat ISTOG podatka: R-M 81 → 0, Norbin 8 → 0 strana; na 2 R-M i 5 Norbin strana ostaju redovi iste oznake sa RAZLIČITIM vrednostima (npr. VOC uz napomenu o česticama, dva odnosa mešanja P 5540) — namerno se ne spajaju |
| Engleske vrednosti i format (G06, G07) | srpske jedinice („24 meseca”, „7 dana”, „na 20°C”), decimalni zarez, crta opsega | engleske vrednosti 12 → 0 strana (osim namerno doslovnih zvaničnih SATA naziva); decimalna tačka 185 → 1 („0.820 kg”, tri decimale — vidi JS-0324) |
| baslac 40-440 / 40-450 (G08) | `parser-correction` u `data/baslac-sync/technical-localization.json` prema zvaničnom TDS-u (str. 2, Drying) + ispravka `dryingText` | „Sušenje: 20°C: učvršćivač 50-415 10 h, 50-420 16 h, 50-430 16 h · 60°C: … 30/40/40 min …” (40-450: 6/10/16 h, 20/30/40 min — **razlikuje se od 40-440**, što GAP-009 nije naveo) |
| Brojevi proizvoda (G13, G24-broj) | brojevi iz stvarnog kataloga (`countCatalogCardsForProgramSlugs`); filter „Potrošni materijal” uključuje aerosole kao i program; Carsystem i Cosmos brojači | `/program`: 307 / 223 / 217 / 111 / 309 = isto kao `/katalog?program=…`; katalog „5 programa”; Cosmos „669 … u 25 linija” i „+124 varijante u 16 linija” |
| Norbin i SATA tamna tema (JS-0210, JS-0211) | tokeni tamne teme; posebni tokeni za površinu i tamnu traku da bela slova na plavom ostanu bela | udeo svetlih blokova u tamnoj temi: Norbin 48 %/87 % → 0 %/0 %, SATA 35 %/54 % → 0 %/0 % (1.440/390) |
| Katalog bez JavaScript-a (JS-0001) | spisak dokumenata se renderuje na serveru (`DocumentLibrarySections`), filter posle hidracije | statički HTML `/katalozi`: 0 → 50 PDF linkova |
| SATA PDF (G04) | 65 jedinstvenih zamena: isti naziv fajla na zvaničnoj stranici **istog artikla** (sourceUrl), svaka proverena kao PDF (`%PDF`); primenjeno kroz `data/sata-sync` i potvrđeno sa `sata:sync:check` (0 razlika), menjaju se samo URL-ovi | svih 670 spoljnih linkova 200 (bilo 47 × 404); spisak zamena: `provera-2026-10-11/posle-ispravki/sata-pdf-zamene.json` |
| SEO naslovi i opisi (JS-0166, JS-0474…JS-0515) | `trimAtWord` seče na kraju rečenice (ako je posle polovine limita) ili na granici reči sa „…”; R-M naslov nosi R-M oznaku kada je nema u nazivu | 1.167 PDP stranica: 0 duplih `<title>` (bilo 21 R-M par), 0 opisa koji se završavaju prekinutom rečenicom |
| JSON-LD jezik dokumenta (JS-0475) | `inLanguage` = jezik PDF-a (iz podataka ili adrese; „Engleski” → `en`), umesto jezika sajta | tehnički listovi: `en` 516, `de` 7; `sr-Latn` ostaje samo na samoj (srpskoj) stranici grupe |
| Navigacija (JS-0150, JS-0470) | RUPES u meniju „Brendovi” (tekstualna oznaka dok logo nije odobren) i u footeru; opis Norbin-a u meniju; `/korpa` → korpa kupca | meni prikazuje 9 brendova (snimak `posle-ispravki/zaglavlje-brendovi-rupes.png`); `/korpa` → `/kupac/korpa` → `/prijava/kupac?callbackUrl=/kupac/korpa`; korpa portala zaposlenih vodi direktno na `/portal/korpa` |
| Pretraga (JS-0471, JS-0472, JS-0628) | mera se ne traži fuzzy (`600ml` je bio na distanci 1 od `400ml`); srpski sinonimi boja, završnica i abraziva; validator indeksa proverava ključ, ne reč | „600 ml” 689 → 0 (pakovanja od 600 ml nema u katalogu), „sprej crni mat” 886 → 5, „brusni disk” 7 → 14, „brusna traka” 3 → 10, „brusni papir” 1 → 2 (delimično); zabranjenih ključeva u indeksu 0 („purpose” je bio pojam iz „Multi Purpose Cup”) |
| Cosmos alt (JS-0208, JS-0526) | alt = zvanični naziv (generator + 742 zapisa), bez „, zvanična Cosmos Lac ambalaža” | 0 pojava na brend strani i u katalogu; `cosmos:validate` i `cosmos-lac:sync:validate` prolaze |
| F.23 (JS-0165) | Interface Pad 150 mm i Excenter Back Pad T.19 kao „Koristi se zajedno sa” | preporuka je potvrđena u `recommendedProductUrls` zvanične F.23 stranice (carsystem sync); oba linka na PDP-u |
| baslac sistemi (JS-0625…JS-0627) | sekcija „Dokumentacija” sa zvaničnim TDS-om linije (30, 35, 45 i 30 CV) iz lokalne kopije baslac synca | sva 4 PDF-a 200 `application/pdf`; test vezuje link za `data/baslac-sync`; snimci `posle-ispravki/baslac-line-30-dokumentacija-*.png` (svetla 1.440 i tamna 390) |
| Ostalo usput | množina „varijanta/varijante/varijanti”; „RAL RAL” u nazivu (5 Cosmos zapisa, slug nepromenjen); javna šifra (`publicCode`/`publicSkuOf`) i u listing prikazima i u bloku „Aktivna varijanta”; „brendove koje zastupamo” → „brendove iz naše ponude” (sigurna formulacija) | crawl: „2–4 varijanti” 22 → 0 strana, „RAL RAL” 1 → 0 |

Regresija: `npm test` 77 grupa / 2.233 testa / 0 padova; `tsc`, `eslint` (izmenjeni fajlovi) i `content:check` čisti; svih 2.955 internih linkova i 3.022 slike 200; svih 670 spoljnih linkova 200; browser prolaz preko 1.271 stranice na 390 px (svetla tema) i 1.440 px (tamna tema): 0 horizontalnih preliva, 0 slika koje se ne učitaju, 0 grešaka u konzoli, 0 neuspelih zahteva (stranice sa timeout-om zbog poznatog AVIF zastoja lokalnog `next start` ponovljene posle restarta — sve prošle); provera skrivenog sadržaja na 41 stranici: Car Fit više nije skriven; footer na `/katalog` se otkriva tek na kraju beskonačne liste (provereno do 1.167. proizvoda — nije nedostatak); filteri `/katalog?program=…` 307/223/217/111/309 = brojevi na `/program`. Validatori kataloga i pretrage daju iste nalaze kao pre (postojeći dug: polje `purpose` u indeksu, 695 delta), bez novih. **Drugi krug:** `npm test` 77 grupa / 2.271 test / 0 padova (+ `lib/search/*.test.mjs` 54/0 i novi testovi za meru i baslac TDS); `validate-catalog-search-index` prolazi; `validate-search-deltas` 695 → 4 razlike koje potiču od ranijih syncova kataloga, ne od ovih izmena („ral” 130 → 131, „1 l” 79 → 82, „satajet” 1 → 31) — u trećem krugu pregledane po zapisu i zaključane uz obrazloženje (odeljak 0.3).

Commitovi na `fix/javni-sajt-2026-10-11`: `95fb06b` (izveštaj i dokazi), `e96a73d` Car Fit, `4a20bd1` tamna tema, `adbdc1a` /katalozi, `2c91b42` tehnički podaci i baslac sušenje, `86cb249` SATA PDF, `0b20dbd` sadržaj i brojevi, docs commitovi, i drugi krug (SEO, navigacija, pretraga, Cosmos alt, F.23, baslac TDS).

Dva postojeća testa su namerno zaključala stare tekstove i ažurirana su: RUPES uvod (`scripts/carsystem-sync/third-party.test.mjs`) i broj pravila lokalizacije TDS-a (`lib/content-qa/releaseRegression.test.mts`, dodata provera sušenja 40-440/40-450). Novi test: `lib/technical-facts-display.test.mjs` (u `npm test`).

### 0.2 Proizvodi bez fotografije

Poseban pregled: [`SLIKE_ZA_PRONALAZENJE.xlsx`](SLIKE_ZA_PRONALAZENJE.xlsx).

- List „Nedostaje fotografija” ima **189** proizvoda: R-M 17, baslac 4, Norbin 4, Cosmos Lac 11 i SATA 153. Kolone su naziv, šifra (samo potvrđena), pakovanje, link, upit za pretragu, napomena, poznat zvanični izvor, lokalni materijal i šta je potrebno od Vas, plus prazne kolone za Vaše beleške.
  - **Vaša fotografija (usklađeno sa glavnim Excel-om, 4. krug):** 21 artikal — R-M 13, baslac 3, Norbin 4 i SATA 187740 — i to samo ako potvrdite da je u ponudi; plus 7 generičkih baslac limenki (Line 30/35/45 po zapremini). **Nije** za fotografisanje: R-M H 2P80 (slika pronađena na rmpaint.com, čeka pravo ili isti fajl sa Surventis portala); AGILIS X-TREME i ONYX HD TROPICAL (sistemi bez jedne ambalaže — prvo odluka o prikazu); DIAMONT bezbojni lak, baslac 30-S510 i Cosmos FO-314 (prvo potvrda identiteta).
  - **SATA:** 140 čeka pisanu saglasnost, za 12 je placeholder ranije prihvaćen, a 1 artikal SATA ne objavljuje.
  - **Cosmos Lac:** 11 čeka dozvolu.
  - **Lokalni materijal:** ni za jedan od 189 ne postoji upotrebljiv fajl. Jedini nađen fajl, `baslac-30-s510-s-serija.webp`, prikazuje drugi proizvod.
- List „Čeka potvrdu prava” ima **31** sliku koju već imamo: Norbin 6 (na Production-u se kriju) i RUPES 25 (prikazuju se).
- **Preklapanje je provereno: 0.** Ovih 6 Norbin proizvoda nije među 189 (lokalno imaju sliku iz `pending-rights`). Na Production-u je zato bez slike 189 + 6 = 195 stranica.

### 0.3 Treći krug (pretraga, delte, naslovi)

| Zadatak | Rešenje | Provera |
|---|---|---|
| „brusni papir” (JS-0628) | Podloga abraziva se čita iz **zvaničnog podnaslova proizvođača** (`officialSubtitle`: „Paper / Film / Net / Foam abrasive”, „Sanding Fleece”) i dodaje kao pojam papir / film / mreža / sunđer / flis (`lib/search/abrasive-backing.mjs`); srpski sinonimi papir/papirni/paper, film/filmski, mreža/net, flis/runo/fleece. Ručni zapis F.19 150 mm dobija „film” iz istog zvaničnog podnaslova. Nijedan disk ne dobija „papir” samo zato što je brusni disk. | „brusni papir” 1 → **7**: Carsystem P.25 disk i traka, Soft-Roll, Tec Line Softflex, Topline WP S, Car Fit Gold Paper Disc i Wet Sanding Paper. Bez filmskih (F.19, F.23, Car Fit Red Film), mrežastih i sunđerastih — zaključano u `validate-search-deltas` (5 mora / 5 ne sme) i `abrasive-backing.test.mjs` (svaki „Paper abrasive” u sync podacima = papir, nijedan drugi). P.19 (papir) nije vraćen: u katalogu kupca je `BUSINESS_OUT_OF_PROGRAMME`. U pregledaču: `/katalog?q=brusni papir` „Prikazano 7 proizvoda” (`posle-ispravki/katalog-brusni-papir.png`). |
| Delte pretrage | Svaka razlika je proverena po zapisu, poređenjem sa indeksom iz commita koji je brojeve zaključao (7590a4a). | „ral” 130 → **131**: Cosmos „RAL 9003 Matt Signal White” (5f12d67), zaseban od sjajnog CL 426 — nije duplikat. „1 l” / „1l” 79 → **82**: tri Norbin pakovanja od 1 L (cb1a165); „Clearcoar matt” je samo preimenovan (84e8051). „satajet” 1 → **31**: SATA sync; 17 pištolja prvi, zatim 2 nastavka, pa 12 delova pribora gde je SATAjet pojam kompatibilnosti; bez duplikata. Obrazloženja su u `scripts/validate-search-deltas.mjs`; validator prolazi u celosti. |
| SEO naslovi (JS-0473) | Brend se više ne ponavlja: kada naziv već sadrži brend, otpada „– Brend proizvod”; inače ostaje samo „– Brend” (npr. SATA nazivi na srpskom); R-M kategorija ostaje („– R-M razređivač”). Naziv, šifra i varijanta su netaknuti. | naslova > 70 znakova **320 → 84**; 0 duplih na 1.216 stranica; preostalih 84 su dugi zvanični nazivi (SATA 50, porodice 15, Cosmos 12, Befar 4, ostalo 3) — preporuka, ne kvar. Test `lib/seo/productTitles.test.mts` (jedinstvenost, naziv na početku, brend prisutan). |

Testovi: `npm test` sada uključuje i `test:search-rules` (pravila pretrage, bez vremenskog benchmarka) i `test:seo-canonical` — **79 grupa / 2.336 testova / 0 padova**; `tsc` i `eslint` čisti; `validate-catalog-search-index` i `validate-search-deltas` prolaze na izolovanom buildu.

### 0.4 Četvrti krug — kategorija A (97 nalaza)

**Usklađivanje evidencije pre rada.**

- **512 → 515.** Nijedan nalaz nije dodat. U drugom krugu je „512” bio broj samo OTVORENIH redova, a u trećem „515” zbir OTVORENIH i DELIMIČNIH. Stvarno nerešenih (otvoreno + delimično) bilo je 516, pa 515: JS-0628 („brusni papir”) prešao je DELIMIČNO → REŠENO, a JS-0473 (dugi naslovi) OTVORENO → DELIMIČNO. Provereno poređenjem CSV-a u commitovima 23f7a38 i 03c34b6.
- **Lista za fotografisanje** usklađena je sa glavnim Excel-om (odeljak 0.2): H 2P80 je pronađen (čeka pravo), sistemi bez šifre nemaju jednu ambalažu (odluka o prikazu), a nejasni identiteti prvo traže potvrdu. U CSV-u ti redovi sada nose status iz Excel-a i odgovarajuću kategoriju (B ili C).
- **Stvarni kvarovi i preporuke** su razdvojeni u novoj koloni `vrsta_preostalog` (stvarni kvar / preporuka), nezavisno od toga ko ih otključava (`kategorija_preostalog`).

**Ishod 97 nalaza kategorije A:** 65 rešeno · 14 posle provere nije nedostatak · 14 premešteno u C (odluka) · 2 u D (preporuka) · 1 delimično · 1 ostaje otvoreno (zvanični izvori se ne slažu). Obrazloženje i dokaz za svaki red su u CSV-u (`resenje_i_provera`).

| Šta | Rešenje | Dokaz |
|---|---|---|
| 36 slika Carsystem (G17) | Prvo su provereni zvanični originali (`originalUrl`, sačuvani sa SHA u privatnom kešu van git-a). Za 29 PNG originala carsystem.org servira 660 px `_processed_` derivat koji je **≈ original^2,2** (eksponent 2,09–2,28 na svih 29), sa zgnječenom crnom i širim poluprovidnim rubom. WebP originali su verni (eksponent 1,00). Prikaz za 29 slika je ponovo izvezen iz originala: ICC → sRGB (dva originala su Adobe RGB), premultiplied resize na **istu veličinu**, bez tonske korekcije i bez generativne obrade. Zatečena pregledana obrada ivice (senka, okvir) primenjena je posle izvoza. Original u `public/` se ne menja (SHA je dokaz identiteta u syncu); izvoz je derivat za prikaz (`public/remastered/`, `plan.json` + `display-map.json`, `remaster.py` proširen izvorom „official-original”). | Silueta IoU ≥ 0,996 na svih 29; ravna crna npr. 0,75 → 0,35 (Can Scraper), 0,45 → 0,04 (Pad Saver), 0,25 → 0,003 (Dispenser 5 kg); gAMA oznake originala su standardne 1/2,2 (nije linearni PNG). Pregled pre/posle na tamnoj, sivoj i svetloj podlozi uz isečak etikete: `posle-ispravki/slike-carsystem/pre-posle-1.png`, `-2.png`, `merenja.json`; PDP u obe teme: `pdp-*-light/dark.png`. Od 7 WebP slika: 3 su ranije rešene pregledanom obradom senke, 4 nisu nedostatak (bela KS 50, crni štapić i ogledalski odrazi postoje u originalu). Nivoi nisu menjani nigde. |
| R-M faze komponenti | Komponenta dobija fazu VEĆINE proizvoda koji je zvanično koriste (`usedBy`, info.rmpaint.com), ne prve uloge po redosledu pravila | H 2A14/2A24/2A34 TopCURE i H 2P15/25/35 CLEAR Harden-R → Lak; HB 032 → Boja; RA 050 i GHD učvršćivači → Boja; H 380 ostaje Podloga; test u `rm-sync.test.mjs` |
| RUPES nazivi | Pisanje proizvođača u Carsystem syncu (`plan.mjs`) | „RUPES Holder BigFoot”, „RUPES iBrid Nano”, „RUPES iBrid Nano Q-MAG”; slug nepromenjen |
| Srpski zapis brojeva | 168 vrednosti u Carsystem i 3 u C.A.R.FIT lokalizaciji | „2,5 mm”, „1,9–2,2 mm”, „1.000 listova”, „0,820 kg”, „88 µm”; sync check 0 razlika |
| Programi | Brendovi i redosled iz stvarnih proizvoda programa | „Pištolji i oprema” počinje SATA pištoljima; Poliranje više ne navodi R-M/baslac bez proizvoda |
| Cosmos `?varijanta=` | Deljena Cosmos šifra (npr. „10” za 5 nijansi) više nije ključ; varijanta nosi jedinstvenu katalošku šifru, stara adresa i dalje radi | `validate-product-identity --strict` 0 konflikata (bilo 6, stvarno 9 grupa); Antigravel, Filler i Primer sada rade kao varijantni PDP (prema zaključanom pravilu bez međustranice) |
| Tekst | RUPES i Norbin brojači, Befar (pene, Likit Pasta, Tack Cloth, prečnici 220 mm, numeracija 01–09, zapis 150 × 25 mm), SATA „evidentirano”, Cosmos Lac pisanje, baslac poster kao link, opisi programa bez „automotive”, R-M zvanični nazivi C 2P15/C 2A84, „pretpremaz”, telefon u kartici prodavnice, alt „fotografija proizvoda nije dostupna” umesto „ilustrativni prikaz” | provereno na buildu: stari oblici 0 pojava |

**Premešteno iz A u C (posle provere izvora — bez Vaše odluke bilo bi pogađanje):** faze/programi RUPES i Car Fit prate ZVANIČNU kategoriju proizvođača (JS-0637, JS-0640, JS-0648); identitet „R-M Pasta 190” (JS-0206, JS-0654 — opisana kao pasta za poliranje, a po beleškama je DIAMONT BC 190, a fotografija nosi BC 605); 8 starih Befar sunđera odgovaraju više zvaničnih proizvoda različite tvrdoće (JS-0517–0524); GHD TOPCOAT u „Baznim bojama” prati zvaničnu R-M grupu „Basecoat/Topcoat” (JS-0639).

**Ostaje u A, nerešeno:** JS-0633 — TDS kaže N55-V20 „grey”, poster sivih tonova „Dark Grey”; iz teksta postera nije pouzdano koja oznaka pripada kom redu, pa tekst nije menjan.

Regresija: `npm test` **79 grupa / 2.340 testova / 0 padova** (posle završnih provera); `tsc` i `eslint` (izmenjeni fajlovi) čisti; `remaster.py --check` 86 / 0 problema; Carsystem, R-M i C.A.R.FIT sync check 0 razlika; `validate-product-identity --strict`, `validate-search-deltas` i `validate-catalog-search-index` prolaze na izolovanom buildu.

### 0.4a Završne provere (2026-10-12)

**1. R-M komponente sa više namena.** Promena glavne faze prema većini primena NE sme da ih sakrije iz drugih filtera. Provera je pokazala da bi ih sakrila, jer filter `?faza=` poredi jednu fazu (`CatalogExplorer`, `EntityProductFilters`, brojevi na R-M strani). To je postojalo i pre (H 2A14 je ranije falio u „Lak”), ali je promena samo premestila prazninu. Ispravka: komponenta nosi i `secondaryPhaseSlugs` iz ostalih zvaničnih primena, a filteri traže glavnu ILI dodatnu fazu (`lib/catalog/phase-match.mjs`). Dodatne faze ima 26 R-M komponenti sa više primena. Kartica i PDP i dalje prikazuju samo glavnu fazu.

| Šifra | Naziv | Faza pre | Glavna faza sada | Dodatno u filteru | Zvanične primene (`usedBy`) | Efekat na filter | Zapis |
|---|---|---|---|---|---|---|---|
| GV 200 | GV 200 GHD THINNER | Podloga | **Boja** | Podloga, Lak | basecoat-topcoat 4, clearcoat 1, undercoat 1 | ostaje u Podloga; dodato: Boja, Lak | `rm-gv-200-ghd-thinner` |
| H 2A24 | H 2A24 TopCURE | Boja | **Lak** | Boja | clearcoat 7, basecoat-topcoat 3 | ostaje u Boja; dodato: Lak | `rm-h-2a24-topcure` |
| H 2A34 | H 2A34 TopCURE | Boja | **Lak** | Boja | clearcoat 7, basecoat-topcoat 2 | ostaje u Boja; dodato: Lak | `rm-h-2a34-topcure` |
| H 2P25 | H 2P25 CLEAR Harden-R | Boja | **Lak** | Boja | clearcoat 8, basecoat-topcoat 3, thinner 1 | ostaje u Boja; dodato: Lak | `rm-h-2p25-clear-harden-r` |
| H 2P35 | H 2P35 CLEAR Harden-R | Boja | **Lak** | Boja | clearcoat 8, basecoat-topcoat 2, thinner 1 | ostaje u Boja; dodato: Lak | `rm-h-2p35-clear-harden-r` |
| H 700 | H 700 GHD HARDENER | Podloga | **Boja** | Podloga, Lak | basecoat-topcoat 4, clearcoat 1, undercoat 1 | ostaje u Podloga; dodato: Boja, Lak | `rm-h-700-ghd-hardener` |
| H 750 | H 750 GHD HARDENER | Podloga | **Boja** | Podloga, Lak | basecoat-topcoat 4, clearcoat 1, undercoat 1 | ostaje u Podloga; dodato: Boja, Lak | `rm-h-750-ghd-hardener` |
| H 770 | H 770 GHD HARDENER | Podloga | **Boja** | Podloga, Lak | basecoat-topcoat 3, clearcoat 1, undercoat 1 | ostaje u Podloga; dodato: Boja, Lak | `rm-h-770-ghd-hardener` |
| RA 050 | RA 050 AGILIS MIX | Podloga | **Boja** | Podloga | basecoat-topcoat 3, undercoat 1, thinner 1 | ostaje u Podloga; dodato: Boja | `rm-ra-050-agilis-mix` |
| H 2A14 | H 2A14 TopCURE | Boja | **Lak** | Boja | clearcoat 7, basecoat-topcoat 2 | ostaje u Boja; dodato: Lak | `h-2a14-topcure` |
| H 2P15 | H 2P15 CLEAR Harden-R | Boja | **Lak** | Boja | clearcoat 8, basecoat-topcoat 2 | ostaje u Boja; dodato: Lak | `h-2p15-clear-harden-r` |
| HB 032 | HB 032 HYDROMIX | Podloga | **Boja** | Podloga, Lak | basecoat-topcoat 4, clearcoat 1, undercoat 1 | ostaje u Podloga; dodato: Boja, Lak | `hb-032-hydromix` |

Provereno u pregledaču na `/katalog?brend=rm&faza=…`: H 2A14 i H 2P15 se nalaze u „Boja” i „Lak”; HB 032 i GV 200 u „Podloga”, „Boja” i „Lak”; RA 050 u „Podloga” i „Boja”. Testovi: `rm-sync.test.mjs` (svaka komponenta je u filteru svake faze u kojoj je zvanično koriste) i `lib/catalog/phase-match.test.mjs`.

**2. Stari Cosmos linkovi sa zajedničkim kodom.** I dalje rade, ali **nisu jednoznačni**: šifra je ista za više nijansi/završnica, pa link bira PRVU varijantu te šifre u redosledu porodice. Ponašanje je isto kao pre izmene. Ko je ranije podelio takav link za drugu nijansu, dobija prvu; adresa ne nosi podatak koji bi to razrešio.

| Porodica | Stari link | Bira | Varijante sa istom šifrom |
|---|---|---|---|
| `cosmos-lac-master-mechanic-antigravel-paintable` | `?varijanta=13` | Master Mechanic Antigravel Paintable 13 Black | 3: Master Mechanic Antigravel Paintable 13 Black; Master Mechanic Antigravel Paintable 13 Grey; Master Mechanic Antigravel Paintable 13 White |
| `cosmos-lac-master-mechanic-brake-caliper-paint` | `?varijanta=15` | Master Mechanic Brake Caliper Paint 15 Blue | 3: Master Mechanic Brake Caliper Paint 15 Blue; Master Mechanic Brake Caliper Paint 15 Red; Master Mechanic Brake Caliper Paint 15 Yellow |
| `cosmos-lac-master-mechanic-filler` | `?varijanta=02` | Master Mechanic Filler 02 Black | 2: Master Mechanic Filler 02 Black; Master Mechanic Filler 02 Grey |
| `cosmos-lac-master-mechanic-heat-resistant-paint` | `?varijanta=12` | Master Mechanic Heat Resistant Paint 12 Black | 2: Master Mechanic Heat Resistant Paint 12 Black; Master Mechanic Heat Resistant Paint 12 Silver |
| `cosmos-lac-master-mechanic-primer` | `?varijanta=01` | Master Mechanic Primer 01 Grey | 2: Master Mechanic Primer 01 Grey; Master Mechanic Primer 01 White |
| `cosmos-lac-master-mechanic-ral` | `?varijanta=10` | Master Mechanic RAL 10 Black — mat | 5: Master Mechanic RAL 10 Black — mat; Master Mechanic RAL 10 Black — sjaj; Master Mechanic RAL 10 Silver; Master Mechanic RAL 10 White — mat; Master Mechanic RAL 10 White — sjaj |
| `cosmos-lac-master-mechanic-wheel-paint` | `?varijanta=14` | Master Mechanic Wheel Paint 14 Black | 2: Master Mechanic Wheel Paint 14 Black; Master Mechanic Wheel Paint 14 Silver |
| `cosmos-lac-ral` | `?varijanta=CL-301` | RAL CL 301 RAL 9010 White — mat | 2: RAL CL 301 RAL 9010 White — mat; RAL CL 301 RAL 9010 White — sjaj |
| `cosmos-lac-ral` | `?varijanta=CL-304` | RAL CL 304 RAL 9005 Black — mat | 3: RAL CL 304 RAL 9005 Black — mat; RAL CL 304 RAL 9005 Black — polusjaj; RAL CL 304 RAL 9005 Black — sjaj |

Sajt takve linkove više ne generiše: sitemap 0, HTML builda 0, indeks pretrage 0. Provera je otkrila da je pretraga do sada za ovih 29 varijanti davala baš deljenu šifru, pa je klik na „Primer 01 White” otvarao Grey. Ispravljeno je u `lib/catalog-listing.ts`, a test u `catalogRevision2026.test.mjs` pada bez ispravke. U pregledaču „master mechanic primer 01 white” sada otvara White.
Zatečeno i nepromenjeno (izvan ovog obima): 35 linkova iz pretrage (Fast Acrylic 27, RAL 6, Norbin N15-020 2) nose prikazanu šifru umesto ključa sa PDP-a. Vode na ISTU, tačnu varijantu kroz alias, ali je to druga adresa iste varijante.

**3. Preostali delimični nalaz iz kategorije A: JS-0642.**
- **Rešeno:** HB 032 HYDROMIX ima glavnu fazu „Boja” (ONYX HD baze, 4 od 6 zvaničnih primena) i i dalje se vidi u „Podloga” i „Lak”.
- **Ostaje:** GHD TOPCOAT je u `/kategorije/bazne-boje` jer ga R-M vodi u grupi „Basecoat/Topcoat”. Da li „Bazne boje” treba da ga obuhvate ili se kategorija proširuje/preimenuje, odlučujete Vi (pitanje o kategorijama).
- Jedini drugi nerešen nalaz iz A je JS-0633: otvoren, ne delimičan (TDS „grey”, a poster „Dark Grey”).

### 0.5 Razvrstani preostali nalazi

435 otvorenih i delimičnih nalaza pogađa **832 jedinstvene stranice**. Stranica se broji jednom i kada na njoj ima više nalaza, pa je zbir po redovima veći od ukupnog.

| Kategorija | Stvarni kvar | Preporuka | Ukupno nalaza | Jedinstvenih stranica |
|---|---:|---:|---:|---:|
| **A — mogu sam** | 1 | 0 | 1 | 1 |
| **B — čeka sliku, dokument ili pravo** | 251 | 0 | 251 | 546 |
| **C — Vaša odluka** | 92 | 11 | 103 | 294 |
| **D — preporuka** | 0 | 80 | 80 | 108 |
| **Ukupno** | **344** (577 stranica) | **91** (361 stranica) | **435** | **832** |

„Stvarni kvar” znači da je na sajtu nešto netačno, nedostaje ili je interno (slika, dokument, podatak, tvrdnja koja čeka potvrdu); „preporuka” je poboljšanje teksta, dizajna ili SEO-a. Kolone u CSV-u: `kategorija_preostalog`, `vrsta_preostalog`, `stranice_preostalog`.

### 0.6 Pitanja za Vas (poređano po obimu posla koji odgovor otključava)

| # | Pitanje | Otključava |
|---|---|---|
| 1 | **SATA slike:** imate li pisanu saglasnost SATA za fotografije sa sata.com, ili šaljemo zahtev (nacrt postoji)? | 154 nalaza / 153 stranice |
| 2 | **Bezbednosni listovi R-M i baslac:** objavljujemo ih ili ostaju „na upit”, bez oznake „U pripremi”? | 2 nalaza / 246 stranica |
| 3 | **Stručni pregled:** ko i kada prolazi 43 otvorene odluke o identitetu, izvoru i asortimanu (grupa G23)? | 43 nalaza / 15 stranica |
| 4 | **RUPES:** smemo li da koristimo slike sa carsystem.org, imate li odobren RUPES logo i smemo li da linkujemo uputstva sa rupes.com? | 34 nalaza / 26 stranica |
| 5 | **Fotografije:** koji od 21 artikla (R-M 13, baslac 3, Norbin 4, SATA 187740) su u ponudi i možete li njih da fotografišete, uz 7 generičkih baslac limenki? | 25 nalaza / 25 stranica |
| 6 | **Tvrdnje o brendovima:** potvrđujete li ili uklanjamo 20 tvrdnji (Emil Frey Racing, Surventis/Glasurit, baslac „20 godina”, SATA garancija 3 godine, Befar „od 2002.”, „držimo na zalihama”)? | 20 nalaza / 10 stranica |
| 7 | **C.A.R.FIT dokumenti:** smemo li da objavimo 302 već preuzeta TDS/SDS fajla? | 1 nalaz / 61 stranica |
| 8 | **Identitet artikala:** (a) „R-M Pasta 190 1 L / 5 L” — pasta za poliranje ili DIAMONT BC 190, i koji je artikal na fotografiji 5 L (BC 605)? (b) 8 starih „Befar sunđer <boja> 25x150/50x150” — koji su to zvanični Befar artikli? (c) DIAMONT bezbojni lak, baslac 30-S510, Cosmos FO-314. | 13 nalaza / 12 stranica |
| 9 | **Cosmos Lac:** tražimo li pisanu dozvolu za Brand Kit? Odnosi se i na 742 već objavljene slike. | 11 nalaza / 7 stranica |
| 10 | **Razvrstavanje:** (a) da li RUPES mašine idu u Poliranje/Pripremu umesto u „Pištolji i oprema”, i da li faze prate zvaničnu kategoriju proizvođača (RUPES, Car Fit) ili posao? (b) `/kategorije/*` na sve brendove ili „R-M …”? | 12 nalaza / 10 stranica |

Posebno, bez obzira na obim: **otvaranje sajta** — ko odobrava politiku privatnosti, kada se gasi režim održavanja i da li želite stranicu „O nama” (3 nalaza, ali bez toga nijedna stranica nije javna). Manja pitanja: Norbin renderi sa Väritikka, Carsystem/VOSSCHEMIE packshot (8), pisanje „baslac/Baslac” i „C.A.R.FIT/Car Fit”, prikaz sistema AGILIS X-TREME i ONYX HD TROPICAL, radno vreme prodavnica, katalozi, vodiči.

Napomena o GAP-009: ispravka sušenja 40-440/40-450 je urađena isključivo prema zvaničnom TDS-u. Izvod je u `provera-2026-10-11/posle-ispravki/baslac-40-4x0-tds-susenje.txt`. Vrednosti za 40-450 su drugačije od 40-440, pa je tabela GAP-009 („isto kao 40-440”) u tom delu bila netačna.


## 1. Zbirni brojevi (stanje pre ispravki)

**Statusi:** 777 potvrđenih nedostataka · 102 preporuke · 145 neproverenih stavki · **306 redova je u radnom redu 3 (Vaš podatak ili odluka); 308 redova ima oznaku `potrebna_odluka = DA`**.
**Prioritet:** P1 = 284 (vidljivo pokvareno, prazno ili pravno rizično) · P2 = 304 · P3 = 436.

### 1.1 Po brendu i oblasti

| Brend | Slike | Tekst | Informacije za posetioca | Stranice, linkovi, dokumenti, pretraga | SEO/alt | Tvrdnje i odluke | Ukupno | od toga potvrđeno |
|---|---|---|---|---|---|---|---|---|
| R-M | 19 | 203 | 3 | 1 | 45 | 3 | 274 | 263 |
| Carsystem | 46 | 88 | 3 | 1 | 1 | 5 | 144 | 99 |
| baslac | 9 | 29 | 4 | 4 | 2 | 3 | 51 | 38 |
| Norbin | 12 | 34 | 3 | 1 | 2 | 2 | 54 | 46 |
| Cosmos Lac | 12 | 7 | 3 | 1 | 2 | 5 | 30 | 18 |
| Befar | 0 | 27 | 4 | 2 | 1 | 3 | 37 | 10 |
| C.A.R.FIT | 0 | 15 | 3 | 2 | 2 | 10 | 32 | 8 |
| SATA | 155 | 64 | 1 | 40 | 2 | 2 | 264 | 220 |
| RUPES | 32 | 10 | 3 | 1 | 0 | 0 | 46 | 39 |
| Zajedničko (ceo sajt) | 4 | 25 | 22 | 10 | 0 | 30 | 91 | 36 |
| više brendova (SEO) | 0 | 0 | 0 | 0 | 1 | 0 | 1 | 0 |
| **Ukupno** | **289** | **502** | **49** | **63** | **58** | **63** | **1.024** | **777** |

Visok broj kod R-M i SATA potiče od nalaza koji se ponavljaju po stranici proizvoda (format broja, dupli tehnički red, slika bez prava). Na isti problem se primenjuje jedna ispravka, pa je stvarni posao manji nego što broj redova sugeriše (odeljak 2).

### 1.2 Po vrsti nedostatka (najčešće)

| Vrsta nedostatka | Potvrđeno | Preporuka | Neprovereno | Ukupno |
|---|---:|---:|---:|---:|
| Slika: nema fotografije proizvoda | 189 | 0 | 0 | 189 |
| Tekst: format broja (decimalna tačka) | 185 | 0 | 0 | 185 |
| Tekst: dupliran tehnički podatak | 89 | 0 | 0 | 89 |
| Tekst: jezik/pravopis | 24 | 25 | 9 | 58 |
| Slika: kvalitet (ton/okvir/izvor) | 49 | 0 | 0 | 49 |
| Tekst: neprevedena (engleska) vrednost | 10 | 34 | 0 | 44 |
| Odluka: stručni pregled (identitet/izvor/asortiman) | 0 | 0 | 43 | 43 |
| SEO: dupli naslov stranice | 41 | 0 | 0 | 41 |
| Tekst: moguće dupliran tehnički podatak | 0 | 0 | 38 | 38 |
| Dokument: neispravan link (404) | 37 | 0 | 0 | 37 |
| Tekst: nedovršen ili interni | 24 | 7 | 5 | 36 |
| Slika: pravo korišćenja nije potvrđeno | 31 | 0 | 0 | 31 |
| Informacija za posetioca | 2 | 6 | 14 | 22 |
| Pravna/brend tvrdnja | 0 | 0 | 20 | 20 |
| Tekst: placeholder dokumenta | 19 | 0 | 0 | 19 |
| Informacija: netačan ili neusklađen broj | 9 | 0 | 8 | 17 |
| Tekst: interni opis umesto namene | 12 | 0 | 0 | 12 |
| Slika: alt/prikaz | 4 | 4 | 3 | 11 |
| ostale vrste (34) | 56 | 25 | 5 | 86 |

Potpuna tabela je u CSV-u (kolona `vrsta_nedostatka`).

### 1.3 Stanje proizvoda (inventar, svih 1.912 zapisa)

| Brend | Zapisa | Sopstvenih stranica* | Bez prave fotografije | Stranica bez ijednog dokumenta sa linkom | Dokument 404 |
|---|---:|---:|---:|---:|---:|
| R-M | 223 | 223 | 17 | 4 | 0 |
| Carsystem | 426 | 426 | 0 | 191 | 0 |
| baslac | 205 | 49 + 4 sistemske | 4 + 156 baza sa generičkom limenkom linije | 1 (+ 3 sistemske strane bez TDS-a) | 0 |
| Norbin | 14 | 12 | 4 (+ 6 samo na Production-u) | 0 | 0 |
| Cosmos Lac | 680 | 53 + porodice | 11 | 2 | 0 |
| Befar | 64 | 64 | 0 | 64 | 0 |
| C.A.R.FIT | 120 | 120 | 0 | 61 | 0 |
| SATA | 155 | 155 | 153 | 118 | 37 stranica / 47 PDF-ova |
| RUPES | 25 | 25 | 0 (pravo nepotvrđeno za svih 25) | 25 | 0 |

\* Ostali zapisi su varijante koje se prikazuju na stranici porodice (`?varijanta=`). Sve adrese odgovaraju sa 200 ili namernim 307 ka porodici.

---

## 2. Najvažniji nedostaci

1. **Car Fit: lista od 120 proizvoda je nevidljiva** (JS-0026, P1). Na `/brendovi/carfit` sekcija „Car Fit proizvodi dostupni kod nas” ostaje providna i posle skrolovanja. Na desktopu je to ~28.000 px praznog prostora, na mobilnom ~55.000 px. Uzrok je u `components/brand/carfit/CarfitReveal.tsx`: blok se otkriva tek kada je vidljivo 8 % njegove visine (`threshold: 0.08`), a 8 % ovog bloka je više od celog ekrana. Ispravka je u kodu i ne traži nikakav materijal.
2. **Sajt na Production-u je zatvoren** (JS-0919): `carsystemirm.com` → `/site-u-pripremi`. Sve ostalo važi tek kada se sajt otvori.
3. **189 stranica proizvoda bez fotografije** („Vizuel u pripremi”): SATA 153, R-M 17, Cosmos Lac 11, Norbin 4, baslac 4. Na Production-u ima još 6 Norbin stranica, jer se slike bez potvrđenog prava tamo kriju. Za sve treba odluka o pravu ili fotografija od Vas (JS-0719…JS-0913).
4. **47 SATA PDF dokumenata vraća 404** na 37 stranica proizvoda (JS-0588…JS-0624). sata.com je promenio putanje `/media/…/<ts>/`; aktuelni linkovi se preuzimaju sa stranice artikla.
5. **Dupli tehnički podaci na 81 R-M i 8 Norbin stranica** (JS-0027…JS-0115). Primer: „Mlaznica (mm): 1–1,2” i odmah ispod „Mlaznica: 1 -1.2 mm”. Isto važi za VOC i sušenje. Neprevedene vrednosti „24 months”, „(at 20°C)” i „7 days” javljaju se na Norbin i R-M stranicama.
6. **baslac 40-440 i 40-450 prikazuju netačno „Sušenje”**: umesto vremena stoje šifre učvršćivača „50-415” (JS-0916, JS-0917). Ispravka je pripremljena u GAP-009 i čeka Vaše odobrenje.
7. **Interni i nedovršeni tekst vidljiv posetiocu** (P1, 24 potvrđena reda u JS-0002…, plus 19 + 12 redova):
   - „U pripremi za javni katalog.” na 19 stranica;
   - „dokumentovan kroz dostavljeni zvanični R-M materijal” kao opis 12 R-M proizvoda;
   - „426 javnih Carsystem zapisa”, ID-jevi `carfit-task-preparation` i slični, „NORBIN-N15-020-5L”;
   - „Fotografija u pripremi” 2× na Norbin strani, prazne CRYSTAL BASE kartice na R-M strani, brojač „0 bez sistema boje”.
8. **Nema stranice o privatnosti** (JS-0918), iako kontakt forma traži ime, telefon i e-poštu. Nema ni stranice „O nama” (`/o-nama` → 404, JS-0944).
9. **`/katalozi` bez JavaScript-a ne prikazuje nijedan dokument** (JS-0001, SEO). Spisak od 25 kataloga se renderuje tek u pregledaču. R-M, Norbin, SATA, Befar i RUPES nemaju nijedan katalog (JS-0943).
10. **Norbin i SATA strane ne podržavaju tamnu temu**: u tamnoj temi ostaju bele (JS-0210, JS-0211).
11. **Neusklađeni brojevi**:
    - `/program` prikazuje 467/241/217/111/876 proizvoda, a katalog za iste programe 307/223/217/111/209;
    - katalog piše „7 programa”, a programa ima 5;
    - Cosmos Lac: „7 + 16 linija ≠ 25”;
    - Carsystem: „07 celina” naspram „četiri celine”.
12. **RUPES nije u meniju ni u footeru** (JS-0150). Ima 25 proizvoda i stranicu brenda, ali do njega se stiže samo preko `/brendovi`.
13. **20 tvrdnji o brendovima čeka potvrdu** (P1, JS-0920…JS-0939):
    - Norbin „deo Surventis porodice”, „lansiran 2015.” i poređenje sa Glasuritom (3×);
    - baslac „20 godina” i Surventis;
    - partnerstvo R-M i Emil Frey Racing, spisak marki vozila sa američkog sajta;
    - SATA garancija 3 godine;
    - Befar „od 2002., porodična firma”;
    - Cosmos Lac „držimo na zalihama”;
    - „Carsystem/Vosschemie”.

Bez nalaza:
- **Persiranje** je dosledno: nema „ti” oblika, „Vi/Vam/Vaš” je svuda sa velikim slovom.
- **Ćirilice** nema.
- **3M, sia, Molotow i A.U.T.O. Fit** se ne pojavljuju kao aktivni brendovi. Pretraga „sia” i „Molotow” daje 0 rezultata; „3M” pogađa samo creva dužine 3 m.

---

## 3. Redosled rada za danas

### 3.1 Odmah, postojećim proverenim materijalom (radni red 1 — 587 redova, od toga 26 P1)

Ovo su izmene teksta i koda. Ne traže novi materijal ni Vašu odluku.

| # | Šta | ID-jevi | Fajl |
|---|---|---|---|
| 1 | Car Fit lista proizvoda: reveal sa `threshold: 0` ili reveal po kartici | JS-0026 | `components/brand/carfit/CarfitReveal.tsx`, `CarfitBrandPage.tsx` |
| 2 | Ukloniti interne i placeholder rečenice sa brend strana, programa i kategorija („javni katalog”, „lokalni zapisi”, ID-jevi slotova, „426 javnih zapisa”, „0 bez sistema boje”, CRYSTAL BASE tekst, „Prikazujemo samo potvrđene fotografije…”) | G24-placeholder JS-0002…, G10 JS-0131…JS-0149, G09 JS-0126…JS-0130 | navedeni u CSV-u po redu |
| 3 | Opis za 12 R-M učvršćivača/razređivača/HYDROMIX umesto „dokumentovan kroz dostavljeni…” — iz već povezanog TDS-a | G19 JS-0153… | `data/rm-imported-products.generated.json` |
| 4 | Jedan red po tehničkom podatku (R-M 81, Norbin 8) i ista ispravka u JSON-LD | G05 JS-0027…JS-0115 | `lib/rm-catalog-products.ts` (`technicalFacts`), `lib/norbin-catalog-products.ts` |
| 5 | Prevod preostalih engleskih vrednosti („24 months”, „at 20°C”, „7 days”) | G06 (10 potvrđenih) | `data/<brend>-sync/technical-localization.json` |
| 6 | Pravopisne greške: „Opremljam”, „poliru”, „učvršđivač”, „GRAFIT”, „primeri”, „RAL RAL”, „3 varijanti”, „88 µ”, „mebl”, glagolska vremena | G24-jezik (24 potvrđena) | `carsystemBrandData.ts:578/776`, `NorbinBrandPage.tsx:213`, `cosmos-lac-brand-data.ts:224`, `lib/documents.ts:223`, `lib/catalog-listing.ts:320` … |
| 7 | Brojevi: `/program` prema katalogu, „7 programa” → 5, Cosmos 7+16/25, Carsystem 7/4, „21” naspram 22 kartice | G13 JS-0151/0152, G24-broj | `ProgramHero.tsx`, `CatalogPage.tsx`, brend data fajlovi |
| 8 | RUPES u meni i footer | JS-0150 | `Footer.tsx`, `navigation-data.ts` |
| 9 | Meta opisi prekinuti usred rečenice (Car Fit, RUPES, SATA, Befar) | G24-SEO | `lib/seo/metadata-builders.ts` (`trimAtWord`) |
| 10 | Norbin i SATA tokeni tamne teme | JS-0210, JS-0211 | `components/norbin-brand/*`, `components/brand/sata/*` |
| 11 | `/katalozi` renderovati na serveru | JS-0001 | `components/documents/DocumentLibraryPage.tsx` |
| 12 | F.23: povezati postojeće Interface Pad i Back Pad T.19 kao kompatibilne | JS-0165 | `lib/carsystem-catalog-products.ts` |
| 13 | Format brojeva po srpskom standardu („1,3–1,4 mm”, „2,5 bar”) | G07 JS-0284…JS-0468 | formatiranje vrednosti po brendu |
| 14 | Alt tekst bez internih dodataka („, dostavljeni prikaz proizvoda” ×59, „, ilustrativni prikaz” ×82, „, zvanična Cosmos Lac ambalaža” ×669) | G20, G24-slika-alt | `lib/<brend>-catalog-products.ts` |
| 15 | SEO: šifra u naslovu za 17 grupa duplih naslova; `inLanguage` dokumenta „en”; `/korpa` ka prijavi kupca | G15, JS-0470 | `lib/seo/*`, `next.config.ts` |

### 3.2 Istraživanje ili preuzimanje iz zvaničnog izvora (radni red 2 — 131 red, od toga 37 P1)

| # | Šta | ID-jevi | Izvor |
|---|---|---|---|
| 1 | Aktuelni SATA PDF linkovi (47 mrtvih) | G04 JS-0588…JS-0624 | stranica artikla na sata.com (`product_page_url` u `docs/catalog/image-gaps-2026-10/sata-current-official-urls.csv`) |
| 2 | TDS linije za baslac sistemske strane 30/35/45 | G11 JS-0625…JS-0627 | techinfo.baslac.com (`*_Line.pdf`) |
| 3 | Srpski sinonimi za pretragu abraziva („brusni papir” daje 1 rezultat) i preširoka pretraga („sprej crni mat” daje 886) | JS-0628, JS-0471/0472 | postojeći katalog |
| 4 | Provera brojeva i oznaka iz pregleda teksta: Befar 45/50 mm i 80–220 mm, baslac „40-40”, SATA „155” i oznake faza (R-M HB 032 „Podloga”, RUPES „Boja”) | G24-broj/informacija (NEPROVERENO) | katalog proizvođača / TDS |
| 5 | Ponovni izvoz Carsystem slika lošeg tona ili okvira (B 40, E 8, D 1). Fajlovi nisu menjani posle merenja 2026-09-22. | G17 JS-0670…JS-0718 | zvanični originali sa carsystem.org (`officialOriginalUrl`) |
| 6 | Stranice bez dokumenta gde je dokument primenljiv: Carsystem hemija (191 stranica bez dokumenta), SATA 118, Befar paste | G25 | carsystem.org, sata.com, befar.com.tr |

### 3.3 Potreban Vaš podatak ili odluka (radni red 3 — 306 redova, od toga 221 P1)

Grupisano po pitanju. Jedan odgovor zatvara sve redove u grupi.

1. **Otvaranje sajta** (JS-0919): kada gasimo režim održavanja i koje P1 stavke moraju biti zatvorene pre toga?
2. **SATA slike** (153 proizvoda + brend strana, JS-0761…JS-0913, JS-0942): imate li, ili da tražimo, pisanu saglasnost SATA za fotografije proizvoda? Ko šalje zahtev?
3. **Cosmos Lac slike** (11, JS-0723…JS-0733): da li tražimo od Cosmos Lac-a pisanu dozvolu ili dopunu Brand Kit-a?
4. **Fotografije iz magacina**:
   - 17 R-M (JS-0744…JS-0760);
   - 4 Norbin (JS-0734…JS-0737);
   - 4 baslac (JS-0719…JS-0722);
   - generička limenka baslac baze u 1 L / 0,5 L / 0,1 L / 5 L (JS-1015…JS-1018).
   
   Možete li ih fotografisati ili potvrditi da te artikle ne držimo? Za baslac 30-S510: da li je to Line 30 Topcoat ili 30 CV?
5. **Norbin renderi sa sajta distributera Väritikka** (6, JS-0738…JS-0743): potvrđujete li pravo korišćenja? Bez potvrde ostaje „Vizuel u pripremi” na Production-u.
6. **RUPES slike i logo** (25 + logo, JS-0945…JS-0969, JS-0941): da li je dozvoljeno koristiti slike RUPES proizvoda sa carsystem.org i imate li odobren RUPES logo?
7. **Fotografije za brend strane**:
   - Norbin: sakriti prazna polja ili tražiti pravo na zvaničnu grupnu sliku (JS-0914);
   - Carsystem: dozvola VOSSCHEMIE ili sopstveno fotografisanje (JS-0940);
   - R-M: da li je CRYSTAL BASE u programu? Ako nije, uklanjamo dve prazne kartice (JS-0915).
8. **Tabela GAP-009** (JS-0916, JS-0917): odobravate li 17 ispravki i prevoda TDS teksta, uključujući sušenje baslac 40-440/40-450?
9. **Tvrdnje o brendovima** (20, JS-0920…JS-0939): za svaku je naveden tačan citat. Potvrdite, dajte izvor ili odobrite ublažavanje. Najvažnije:
   - Norbin/Surventis/Glasurit;
   - baslac „20 godina”;
   - Emil Frey Racing;
   - SATA garancija 3 godine;
   - Befar „od 2002.”;
   - „držimo na zalihama” (Cosmos);
   - „Carsystem/Vosschemie”.
10. **Pisanje naziva brendova** (JS-1011, JS-1012): „baslac” ili „Baslac”? „C.A.R.FIT” ili „Car Fit”? Cosmos Lac se sada piše na 4 načina.
11. **Politika privatnosti** (JS-0918): ko priprema ili odobrava tekst? Koristi li sajt analitiku ili kolačiće osim neophodnih?
12. **Stranica „O nama”** (JS-0944): želite li je? Ako da: godina osnivanja, kratka istorija, delatnost, da li prikazujemo tim i fotografiju centrale.
13. **Katalozi** (JS-0943): imate li, ili smemo li da objavimo, kataloge R-M, Norbin, SATA, Befar i RUPES, i noviji Cosmos Lac katalog? Carsystem brošure su na nemačkom.
14. **Bezbednosni listovi R-M i baslac** (JS-1019, JS-1020): da li ih objavljujemo (dobijamo ih od lokalnog predstavnika) ili ostaju „na upit”? Ako ostaju „na upit”, uklanjamo oznaku „U pripremi” sa 203 stranice.
15. **C.A.R.FIT TDS/SDS** (302 preuzeta fajla, JS-1013) i **RUPES uputstva** (JS-1014): smemo li da ih objavimo ili linkujemo?
16. **Prodajna mesta** (JS-0970): možete li potvrditi radno vreme 9 javnih prodavnica i pune adrese (BAST DOO, Markus Professional)? Da li objavljujemo još neke od 82 lokacije na čekanju?
17. **Vodiči** (JS-1021): da li je potvrđeno 40 preostalih vodiča i ko imenovano odobrava objavu? U suprotnom `/vodici` sakrivamo do objave.
18. **Stručni pregled, 43 otvorene odluke** (CS/CF/CL/NB, JS-0971…): nijedan odgovor nije primenjen; ID-jevi se ne pojavljuju u kodu. Sajt i dalje prikazuje sporne vrednosti:
    - WR Lifting Tape „do 120°C/1 h” (CS-05);
    - Car Fit Universal Thinner „900 g/l” naspram 880 u TDS-u (CF-05);
    - Plastic Putty 1854, Carbon Putty 1820–1840, PU Adhesive 1260 (CF-07…09).
    
    Paket je na grani `chore/expert-review-package-preservation`.
19. **Klasifikacija baslac proizvoda** (JS-0530): odobravate li da 123 baslac zapisa izađu iz „Sprejevi” i da se razvrsta 25 neklasifikovanih?
20. **Adresa `/proizvodi/sata-coupling-with`** (JS-0532): odobravate li preimenovanje uz trajno preusmerenje?

---

## 4. Grupe nalaza

| Grupa | Opis | Redova | Status | Radni red |
|---|---|---:|---|---|
| G01 | Fotografija proizvoda nedostaje („Vizuel u pripremi”) — SATA/R-M/Cosmos/Norbin/baslac + Norbin samo na Production-u | 195 | potvrđeno | 3 |
| G02 | baslac sistemske strane: generička limenka linije umesto tačne zapremine (148 adresa varijanti) | 4 | potvrđeno | 3 |
| G03 | Brend strane: placeholder ili bez fotografija/logotipa (Norbin, R-M, Carsystem, SATA, RUPES) | 5 | potvrđeno | 3 |
| G04 | SATA PDF linkovi 404 | 37 | potvrđeno | 2 |
| G05 | Dupli tehnički podaci (R-M, Norbin); G05-PROVERA: moguće duple liste (Carsystem, C.A.R.FIT, RUPES) | 89 + 38 | potvrđeno / neprovereno | 1 |
| G06 | Neprevedene vrednosti (Norbin, R-M); zvanični engleski SATA nazivi = preporuka | 44 | 10 potvrđeno, 34 preporuka | 1 |
| G07 | Decimalna tačka i razmak oko crte | 185 | potvrđeno | 1 |
| G08 | baslac 40-440/40-450 sušenje | 2 | potvrđeno | 3 (odobrenje GAP-009) |
| G09 | Kontradiktoran status dokumenta (Norbin); G09-SDS: SDS „na upit” uz oznaku „U pripremi” | 5 + 2 | potvrđeno / preporuka | 1 / 3 |
| G10 | „Uputstvo za upotrebu — U pripremi za javni katalog.” | 19 | potvrđeno | 1 |
| G11 | baslac sistemske strane bez TDS-a | 3 | potvrđeno | 2 |
| G12 | Stranice i navigacija: /katalozi SSR, katalozi brendova, O nama, privatnost, /vodici, RUPES u meniju, /korpa, sata.com en-us, Production zatvoren | 9 | potvrđeno | 1/3 |
| G13 | Neusklađeni brojevi programa | 2 | potvrđeno | 1 |
| G14 | Pretraga | 3 | potvrđeno | 1/2 |
| G15 | SEO: dupli naslovi (17 grupa), predugački naslovi (318), jezik dokumenta u JSON-LD | 43 | potvrđeno | 1 |
| G16 | Varijante: serverski HTML prikazuje podrazumevanu varijantu do hidracije (734/774 adrese); dvosmisleni ključevi Cosmos | 2 | preporuka / potvrđeno | 1/2 |
| G17 | Kvalitet Carsystem slika (image audit, klase B/E/D) | 49 | potvrđeno merenjem 2026-09-22, fajl nepromenjen | 2 |
| G18 | RUPES slike bez potvrđenog prava (prikazuju se) | 25 | potvrđeno | 3 |
| G19 | Interni ili generički opisi proizvoda (R-M 12, Befar 8) | 20 | potvrđeno / preporuka | 1 |
| G20 | Alt tekst sa internom napomenom | 5 (zbirno, 810 zapisa) | potvrđeno | 1 |
| G21 | Ostalo: F.23 kompatibilni, napomena „PDF str. 72”, odsečen slug, taksonomija | 4 | potvrđeno | 1/3 |
| G22 | Prodajna mesta (radno vreme, adrese, 82 na čekanju) | 1 | potvrđeno | 3 |
| G23 | Otvorene odluke stručnog pregleda (44; 43 u CSV-u, NB-02 je delom prevaziđena) | 43 | neprovereno | 3 |
| G24-* | Urednički pregled teksta brend strana, programa i kategorija (180 nalaza) | 180 | 68 potvrđeno · 53 preporuka · 59 neprovereno | 1/2/3 |
| G25 | Stranice bez ijednog dokumenta (zbirno po brendu) | 5 | neprovereno (primenljivost) | 2/3 |
| G26 | Vizuelno: Car Fit nevidljiva lista, Norbin i SATA bez tamne teme, svetli blokovi Befar/Cosmos, telefon prodavnice tek posle izbora | 5 | potvrđeno / preporuka | 1 |

---

## 5. Obuhvat provere

| Oblast | Kako | Obuhvat |
|---|---|---|
| Sve javne adrese | HTTP crawl lokalnog produkcionog builda | 2.791 adresa: 1.216 iz sitemap-a (100 % 200), 781 kanonska adresa varijanti (`?varijanta=`, 200), 785 sopstvenih slugova varijanti (307 → porodica), dodatno `/vodici`, `/prijava`, `/korpa`, `/o-nama`, 404 |
| Inventar proizvoda | skripta nad `getAllCarsystemProducts()` + upoređivanje sa renderovanim HTML-om | svih 1.912 zapisa i 47 porodica → `JAVNI_SAJT_INVENTAR_PROIZVODA.csv` |
| Tehnički podaci | parsiranje `<dl>` na svakoj stranici proizvoda i porodice | 1.174 stranice |
| Interni linkovi | provera statusa | 2.938 jedinstvenih internih linkova — svi 200 |
| Slike | provera statusa svakog `src` i `og:image` | 3.003 jedinstvene — sve 200; + `data-product-has-image` po stranici |
| Spoljni dokumenti | HEAD/GET + provera da je odgovor zaista PDF | 670 spoljnih linkova: 623 ispravna, 47 SATA 404; 5 linkova vodi na HTML stranice (namerno, brend strane) |
| Dokumenti biblioteke | postojanje fajla | 25/25 fajlova u `public/documents` postoji |
| SEO | title, description, canonical, robots, H1, og:image, JSON-LD, `lang` | sve 200 stranice |
| Jezik | regex: ćirilica, „ti” oblici, malo „vi/vam”, engleske jedinice, placeholder izrazi | svih 2.001 HTML stranica |
| Urednički pregled | ručno čitanje vidljivog teksta (SSR) | 9 brend strana, 5 programa, 4 kategorije, početna, /brendovi, /katalog, /katalozi, /kontakt, /prodavnice, /program, /vodici |
| Mobilni i desktop prikaz, svetla i tamna tema | Playwright, svaka stranica je skrolovana do kraja | **mobilni 390 px, svetla tema**: 1.271 stranica (sve osim duplih `?varijanta=`, uz jednu varijantu po porodici) + 201 varijanta · **desktop 1.440 px, tamna tema**: 1.271 stranica. Provereno: horizontalni preliv, slike koje se ne učitaju, greške u konzoli, neuspeli zahtevi → **0 nalaza** |
| Vizuelno po šablonu | celostranični snimci 1.440/390 × svetla/tamna + ručni pregled | 34 šablona (početna, /brendovi, 9 brend strana, /program, program, kategorija, katalog, katalog str. 2, /katalozi, /prodavnice, /kontakt, /vodici, 404, PDP za R-M, R-M bez slike, SATA bez slike, Carsystem, C.A.R.FIT, Befar, RUPES, Norbin, baslac, porodice Cosmos, Cosmos bez slike, baslac sistem, Norbin) = 136 snimaka |
| Skriveni sadržaj | provera elemenata sa `opacity: 0` posle skrolovanja | 41 stranica × 2 širine → Car Fit (potvrđeno), Befar slojevi skale tvrdoće (namerno) |
| Filteri i pretraga | pregledač: `?brend=` ×12, `?kategorija=` ×12, `?program=` ×5, 29 upita (URL i kucanje u polje), pretraga u zaglavlju | svi filteri vraćaju rezultate; nepostojeći brend se tiho vraća na ceo katalog |
| Validatori repoa | `content:check` (0 nalaza), `identity:validate`, `taxonomy:validate`, `documents:validate`, `catalog:image-supply:check`, `validate-catalog-payload/search-index/search-deltas` nad 3220 | nalazi uneti u G14, G16, G21 |

**Napomena o lokalnom serveru:** posle oko 2.000 učitavanja `next start` je prestao da odgovara na AVIF optimizaciju pojedinih slika (širina 640). To je od ranije poznata zamka lokalnog servera. Posle restarta su sve ponovljene stranice prošle. Na Vercel-u se to ne očekuje, ali nije provereno.

---

## 6. Šta je provereno samo automatski, a šta vizuelno

- **Samo automatski** (bez gledanja svake stranice): svih 1.912 zapisa proizvoda, sve varijante, linkovi, dokumenti, SEO, tekst i preliv na mobilnom i desktopu. Za proizvode je dovoljno pogledati jednu stranicu po šablonu i problematične stranice, jer svi proizvodi istog brenda koriste isti šablon.
- **Vizuelno**: 34 jedinstvena šablona u 4 kombinacije (širina × tema), Car Fit lista (snimak + stanje elemenata), tamna tema po šablonu (udeo svetlih piksela: Norbin 84 %, SATA 69 %, Befar 31 %, Cosmos 25 %, ostali do 18 %), početna u stvarnom skrolu, prodavnice (telefon tek posle izbora).
- **Lažni nalazi odbačeni posle vizuelne provere**: prazan prostor na početnoj posle „BOJA JE POKRET.” i dno strane na celostraničnim snimcima posledica su sticky sekcije i footer-reveal efekta. U stvarnom skrolu sadržaj se vidi.

---

## 7. Ponovna provera starih izveštaja (158 tragova)

Tragovi su izvučeni iz `docs/CONTENT_GAPS_REQUIRING_OWNER_INPUT.md`, `docs/catalog/image-gaps-2026-10/UNRESOLVED_IMAGES.csv`, `docs/catalog/FINAL_IMAGE_AUDIT.md`, `data/catalog/image-quality/evidence/CARSYSTEM_IMAGE_AUDIT.csv`, `PRODUCT_DETAIL_CONTENT_REVIEW.md`, `BASLAC-CONTENT-AND-MEDIA-GAPS.md`, `docs/CONTENT_ASSET_GAP_AUDIT.md`, `docs/seo/*`, `TODO.md` i paketa `EXPERT_REVIEW_MASTER_FINAL.md`. Polazna lista je u `tmp/javni-sajt-provera-2026-10-11/podaci/old-reports-tracks.csv`.

| Tragovi | Tvrdnja | Danas | Novi ID |
|---|---|---|---|
| OLD-001/002 | baslac 40-440/450 sušenje bez vremena | **i dalje važi** | JS-0916/0917 |
| OLD-003…005 | 82 lokacije na čekanju, tačka centrale | **i dalje važi** (9 javnih) | JS-0970 |
| OLD-006 | SATA 153 bez slike | **i dalje važi** | G01-SATA |
| OLD-007…042 | baslac 4, Cosmos 11, Norbin 4, R-M 17 bez slike | **i dalje važi** (189 lokalno) | G01 |
| OLD-043…049 | baslac pakovanja bez slike tačne zapremine | **i dalje važi** | G02 |
| OLD-050…052, 093 | Carsystem brend strana bez fotografija | **i dalje važi** | JS-0940 |
| OLD-053/054/104 | Norbin brend „Fotografija u pripremi” | **i dalje važi** (2×) | JS-0914 |
| OLD-055 | R-M CRYSTAL BASE prazni slotovi | **i dalje važi** | JS-0915 |
| OLD-056/096 | Cosmos parovi varijanti sa istom fotografijom | **neprovereno** — putanje su različite, a sadržaj piksela nije upoređivan | — |
| OLD-057, 092, 094, 095 | opciona poboljšanja kampanjskih slika | nisu nedostaci; izostavljeno | — |
| OLD-058…063 | Norbin slike samo na Production-u (pravo) | **i dalje važi** (kod krije na Production-u) | G01-NORBIN-PROD |
| OLD-064 | RUPES pravo na slike | **i dalje važi** | G18 |
| OLD-068…080 | kvalitet Carsystem/R-M/Befar slika | 49 identiteta klase B/E/D ima isti runtime fajl kao pri merenju → važi; ostale vizuelne tvrdnje (Befar studijska pozadina, mala rezolucija R-M) nisu ponovo merene | G17 |
| OLD-081 | baslac sistemske strane bez dokumentacije | **i dalje važi** | G11 |
| OLD-082 | SDS se ne prikazuje gde nema detail bloka | **neprovereno** | — |
| OLD-083 | `brand`/`brend` alias | zatvoreno (interni linkovi koriste `brend`) | — |
| OLD-084/085 | F.23 / F.19 kompatibilni proizvodi | F.23 **i dalje važi**; F.19 neprovereno | JS-0165 |
| OLD-086…091 | otvorena pitanja o porodicama i identitetu baslac 35-M331/35-M214/30-S510 | 30-S510 važi (G01-BASLAC); ostala nisu ponovo proverena | — |
| OLD-090 | baslac 60-20 pogrešna slika | zatvoreno (ADDED_IMAGES 2026-10-06) | — |
| OLD-097 | baslac packshotovi sa šahovnicom | delimično zatvoreno; preostalo nije ponovo provereno | — |
| OLD-098 | Carsystem metrika „09” | zatvoreno, ali sada stoji „426 javnih Carsystem zapisa” (interni izraz) | G24 |
| OLD-099 | C.A.R.FIT dokumentacija bez linka | katalog 2026 je objavljen; pojedinačni TDS/SDS i dalje nisu | JS-1013 |
| OLD-100/101 | Cosmos i R-M color chart se ne prikazuju | važi; preporuka, nije uneto kao nedostatak | — |
| OLD-102 | SDS ne postoji ni za jedan brend | važi: R-M i baslac „na upit”, ostali bez SDS-a | G09-SDS |
| OLD-103 | placeholder pasusi C01–C04 | zatvoreno | — |
| OLD-105 | Norbin opisan kao „color programme” | zatvoreno („bez sopstvenog sistema boje”) | — |
| OLD-106, 113, 114, 118 | odluke za zapise koji više ne postoje | prevaziđeno | — |
| OLD-107 | 302 C.A.R.FIT TDS/SDS čekaju pravo | **i dalje važi** | JS-1013 |
| OLD-108 | SATA bez dokumenata | **promenjeno**: 37 stranica sada linkuje sata.com, ali su svi ti PDF-ovi 404; 118 stranica nema dokument | G04, G25 |
| OLD-109 | RUPES bez dokumenata | **i dalje važi** (25/25) | JS-1014 |
| OLD-110 | odsečen slug `sata-coupling-with` | **i dalje važi** | JS-0532 |
| OLD-111 | stari SEO nalazi (prazan alt 54.630, `/vodici` noindex) | zastarelo; `/vodici` je namerno noindex | — |
| OLD-112…154 | 44 odluke stručnog pregleda | **otvorene**; CS-01 delom rešen syncom (157.721 prikazan kao „prethodna šifra”) | G23 |
| OLD-155 | nema politike privatnosti | **i dalje važi** | JS-0918 |
| OLD-156 | nema O nama, stranica partnera, gradskih strana | **i dalje važi** | JS-0944 |
| OLD-157 | demo obračun cene | za neprijavljenog posetioca nema cene („Javne B2B cene nisu prikazane”) → u redu za javni deo | — |
| OLD-158 | sajt u režimu održavanja | **i dalje važi** | JS-0919 |

Interne nedoslednosti starih dokumenata nisu nedostaci javnog sajta: OLD-067 (naslov vodiča „115”) i zastareli `TODO.md`.

---

## 8. Šta nije provereno ili nije bilo dostupno

1. **Production uživo.** Sajt je u režimu održavanja. Firmin Vercel deployment je iza Vercel SSO tima `carsystem1`. Proveren je lokalni build istog koda. Razlike Production-a koje su poznate iz koda: 6 Norbin slika se tamo krije, a demo rute vraćaju 404.
2. **Tačnost tehničkih podataka prema TDS-u za svaki proizvod.** Proverena je forma (duplikati, jezik, format), a ne vrednosti prema PDF-u proizvođača. Izuzetak su stavke iz starih izveštaja (baslac 40-440/450, CS/CF odluke).
3. **Prava korišćenja slika i dokumenata.** Ništa nije izmišljeno ni pretpostavljeno. Svi predmeti sa otvorenim pravom su označeni kao odluka.
4. **Primenljivost dokumenta po proizvodu** (G25). Navedena je zbirno po brendu, nije ocenjivana proizvod po proizvod.
5. **Vizuelna provera svake od 1.912 stranica proizvoda.** Nije rađena; pokrivaju je šabloni i automatske provere preliva, slika i skrivenog sadržaja.
6. **Tamna tema na mobilnom** je pregledana samo po šablonu. Automatski prolaz na 390 px je urađen u svetloj, a na 1.440 px u tamnoj temi.
7. **Spoljni sajtovi koji odbijaju HEAD** su provereni GET-om. Linkovi koji danas rade mogu se kasnije pokvariti; SATA menja putanje.
8. **Rad sa formom za upit** (otvara program za e-poštu). Nije poslat nijedan upit.
9. **Isključeno po zadatku:** nalog kupca (`/kupac`), interni portal (`/portal`), prijava zaposlenih (`/prijava` — samo je zabeleženo da je javno dostupna i `noindex`).
10. **Tuđe nekomitovane izmene u radnom stablu.** Posle builda (16:39–16:42) u ovom checkout-u su se pojavile izmene druge sesije (`components/product/ProductHero.tsx`, `ProductIdentity.tsx`, `ProductInquiryCard.tsx`, `ProductVariantOptions.tsx`, `components/customer-buy/*`, portal štampa, `package.json`) i `.next-verify` je ponovo izgrađen u 16:42. Svi nalazi su sa builda čistog `2516912`; te izmene nisu pregledane niti dirane.

---

## 9. Fajlovi

| Fajl | Sadržaj |
|---|---|
| `docs/javni-sajt/JAVNI_SAJT_NEDOSTACI.md` | ovaj izveštaj |
| `docs/javni-sajt/JAVNI_SAJT_NEDOSTACI.csv` | 1.024 nalaza. Kolone: `id, status, radni_red, prioritet, grupa, url, stranica_ili_proizvod, brend, vrsta_nedostatka, dokaz, fajl_u_kodu, predlog_dopune, izvor_materijala, potrebna_odluka, pitanje_za_vlasnika, nacin_provere, trag, stanje, resenje_i_provera` (poslednje dve dodate posle ispravki) |
| `docs/javni-sajt/JAVNI_SAJT_INVENTAR_PROIZVODA.csv` | 1.912 zapisa: URL, HTTP, stanje slike, alt, dužine opisa, pakovanje, dokumenti sa linkom, dokumenti 404, dupli/engleski/format tehničkih podataka, SEO naslov i opis, H1, JSON-LD, klasa iz image audita |
| `docs/javni-sajt/SLIKE_ZA_PRONALAZENJE.xlsx` | 189 proizvoda bez fotografije + 31 slika koja čeka potvrdu prava (odvojeni listovi, bez preklapanja) |
| `docs/javni-sajt/provera-2026-10-11/` | `snimci/` (šabloni 1.440/390 × svetla/tamna, mreže, dokaz Car Fit), `podaci/` (sirovi podaci prve provere, veliki JSON-i u gzip-u), `posle-ispravki/` (provera pre/posle, SATA zamene, tehnički podaci posle, linkovi posle, izvod iz baslac TDS-a), `skripte/` (sve skripte provere, `verify.mjs` za ponavljanje ključnih nalaza, `status.py`, `xlsx.py`, `sata-docs.mjs`) |

Ponavljanje ključne provere: build grane (`NEXT_DIST_DIR=.next-javni npx next build` → `next start --port 3520`) pa `node provera-2026-10-11/skripte/verify.mjs http://localhost:3520`. Potpun crawl: `crawl.mjs`, `links.mjs ext`, `dl.mjs`, `dl2.mjs`, `browse.mjs` (sa adresom servera u skripti).

Bez deploya. Ispravke su komitovane na lokalnoj grani `fix/javni-sajt-2026-10-11` (nije pushovano).
