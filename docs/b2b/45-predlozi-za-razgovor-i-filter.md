# 45 — Predlozi za razgovor na kartici kupca i zamrzavanje filtera

**Status (2026-10-02): lokalni predlog, proveren na lokalnom prikazu jednog
stvarnog kupca. `cadence_v1` (statusi, pouzdanost, pragovi) nije menjan.**
Pilot (Neon), Preview i produkcija nisu dirani.

## 1. Zamrzavanje posle filtera u preporukama

**Simptom:** posle „Primenite" u filterima `/portal/preporuke` strana se ne
može skrolovati.

**Izmereno u pravom pregledaču (desktop 1280 i telefon), ne pretpostavljeno:**

| Korak | `html[data-route-transition]` | skrol |
|---|---|---|
| ulazak u portal klijentskom navigacijom (link) | nema | radi |
| otvaranje selecta, Escape, klik van, izbor bez slanja | nema | radi |
| „Primenite" (GET forma = puno učitavanje strane) | `booting`, `body[aria-busy=true]` | **zaključan** |
| isto, +7 s | `fallback` | radi |

Glavna nit nije bila zauzeta (bez dugih zadataka, `evaluate` ≈ 9 ms) — nije
bilo ni menija ni overlay-a preko strane. Zaključan je bio samo skrol.

**Uzrok:** koreni layout server-renderuje `data-route-transition="booting"` i
`aria-busy`, a globalni CSS u tom stanju drži `overflow: hidden` na `html` i
`body`. Stanje skida mašina prelaza stranica (`useRouteTransition`), koja se
na `/portal` namerno ne montira (`MotionSystem`). Klijentska navigacija u
portal je čista, ali svako puno učitavanje portalske strane (GET forma,
osvežavanje, direktan link) ostajalo je zaključano dok rezervni tajmer od 6 s
ne bi skinuo stanje.

**Ispravka:** `lib/portalRouteTransition.mjs` — inline skript u `<head>` skida
stanje za `/portal` pre prvog prikaza; `MotionSystem` u portalskoj grani to
ponavlja iz React-a (rezerva).

**Provere:**
- `lib/portalRouteTransition.test.mjs` (u `npm test`);
- korak 22 u `qa:pg:browser`: prijava, select (fokus, Escape, klik van),
  izbor, „Primenite", merenje ~300 ms posle učitavanja (pre tajmera od 6 s),
  točkić i ponovna promena filtera, desktop i telefon. Korak **pada** na buildu
  bez ispravke i **prolazi** sa njom (§6).

## 2. Izvori za prikaz (ne dokaz da algoritam radi)

Provereni izvori (2026-10-02). Govore **kako prikazati** rangiranu listu,
razlog i pouzdanost — nijedan ne dokazuje da je naš `cadence_v1` tačan.

| Izvor | Šta kaže (prepričano) | Za šta nam služi |
|---|---|---|
| [Microsoft Dynamics 365 — predictive opportunity scoring](https://learn.microsoft.com/en-us/dynamics365/sales/work-predictive-opportunity-scoring) | ocena + razred A–D; u widgetu do 5 glavnih razloga, „Details" za sve; stanje „Not enough info" | kratka lista + „Prikažite sve"; razlog po stavci; stanje „premalo podataka" |
| [Dynamics 365 — lead scoring FAQ](https://learn.microsoft.com/en-us/dynamics365/sales/faq-lead) | razred je samo grupisana ocena; model traži minimum istorije | pouzdanost kao nivo, prag istorije |
| [Dynamics 365 — work list](https://learn.microsoft.com/en-us/dynamics365/sales/prioritize-sales-pipeline-through-work-list) | radna lista po prioritetu, sledeći korak po stavci | rang po oceni, ne po datumu |
| [Dynamics 365 — scoring model accuracy](https://learn.microsoft.com/en-us/dynamics365/sales/scoring-model-accuracy) | trening na starijim, provera na najnovijih 20%; metrike tačnosti | **jedini izvor o dokazu**: vremenska provera unazad |
| [Salesforce Einstein Opportunity Scoring — how it works](https://help.salesforce.com/apex/HTViewHelpDoc?id=einstein_sales_opportunity_scoring_how_it_works.htm) | ocena 1–99 sa glavnim pozitivnim/negativnim činiocima; ponekad bez činilaca | razlog po stavci; poštenje kad razloga nema |
| [NN/g — Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/) | prvo nekoliko najvažnijih, ostalo na zahtev, jasno označeno | 3–5 pa „Prikažite sve"; pun spisak jedan korak dalje |
| [NN/g — Crafting AI explanations](https://www.nngroup.com/articles/crafting-ai-explanations/) | objašnjenje jezikom posla korisnika, ne unutrašnjost modela | razlog rečima komercijaliste |
| [NN/g — Explainable AI](https://www.nngroup.com/articles/explainable-ai/) | ne predstavljati rad sistema drugačijim nego što jeste; ograničenje jasno i neutralno | „osnova procene", oznaka ograničenja |
| [Google PAIR — Explainability + Trust](https://pair.withgoogle.com/guidebook-v2/chapter/explainability-trust/) | pouzdanost u kategorijama, ne procenat; reći koji su podaci korišćeni | visoka/srednja/niska + značenje; „N kupovina" |
| [Google PAIR — Errors + Graceful Failure](https://pair.withgoogle.com/guidebook-v2/chapter/errors-failing/) | „greške konteksta": sistem radi kako je zamišljen, ali ne zna stanje korisnika | lager i potrošnja kupca se ne vide |
| [Microsoft Research — Guidelines for Human-AI Interaction](https://www.microsoft.com/en-us/research/blog/guidelines-for-human-ai-interaction-design/) | G2: koliko dobro sistem radi; G11: zašto je uradio to što je uradio | pouzdanost + razlog |
| [Microsoft HAX — G2 patterns](https://www.microsoft.com/en-us/haxtoolkit/guideline/make-clear-how-well-the-system-can-do-what-it-can-do/) | preciznost izraza u skladu sa stvarnom tačnošću | „~3 nedelje", ne „23 dana"; bez obećanog datuma |

Nisu uvršteni (nisu mogli da se provere): Salesforce Next Best Action stranice,
Amazon „Buy It Again" (KDD 2018, 403), HubSpot/SAP/Oracle.

## 3. Šta je promenjeno u prikazu

`lib/recommendations/suggestionRanking.mjs` — sloj prikaza nad rezultatom
`cadence_v1`:

- **kratka lista (do 5):** status u terminu, uskoro, prošao termin ili nedavno
  prestao (≤ 365 dana), **i** srednja ili visoka pouzdanost;
- **„Prikažite sve (N)":** ostatak iste liste;
- **„Slabiji signali":** dve kupovine (`provisional`) ili niska pouzdanost —
  odvojeno, sklopljeno;
- **van liste predloga:** premalo istorije, nije obračunato, u ritmu, kupljeno
  posle obračuna, prestao pre više od 365 dana — svi ostaju u „Svi artikli po
  grupama", sa punom istorijom datuma;
- **redosled:** termin × pouzdanost × istorija (vidi zaglavlje modula); ne
  samo proteklo vreme. Artikal koji kasni više ciklusa slabi, jer je manje
  verovatno da je to „sada";
- **po predlogu:** razlog rečenicom, poslednja kupovina, osnova (broj
  kupovina, od kada, uobičajen razmak zaokružen), pouzdanost sa značenjem,
  ograničenja (grupa nije potvrđena, bez veze sa katalogom, bez važeće cene).
  Cena se ne prikazuje;
- **sažetak kupca i „Za razgovor":** imena u „Predlog za razgovor" dolaze iz
  kratke liste; „Za razgovor" pokazuje najviše 3 uz „još N na kartici";
  neograničen spisak „Vredi pomenuti" je uklonjen sa kartice.

## 4. Provera unazad (jedan kupac — indikacija, ne dokaz)

Lokalni prikaz, 59 računa 2021–2026. Mesečni preseci od 2023-01 (45),
`cadence_v1` nad kupovinama do preseka, pogodak = artikal kupljen u narednih
H dana. Top 5 po pravilu. Težine predloga postavljene jednom, unapred; nisu
podešavane prema rezultatu.

| Pravilo | H = 30 | H = 45 | H = 60 |
|---|---|---|---|
| osnovna stopa (bilo koji artikal sa ≥ 2 kupovine) | 18% | 25% | 31% |
| samo proteklo vreme | 10% | 16% | 18% |
| dosadašnji redosled (prestali, pa kasne, pa uskoro) | 26% | 33% | 40% |
| **predlog — kratka lista** | **38%** | **48%** | **56%** |
| predlog — slabiji signali (H = 45) | | 21% | |
| kratka lista, samo visoka / samo srednja (H = 45) | | 45% / 44% | |

Čitanje:
- kratka lista je bolja i od dosadašnjeg redosleda i od proteklog vremena;
- slabiji signali su na nivou nasumičnog artikla — zato su odvojeni;
- visoka i srednja pouzdanost se kod ovog kupca ne razlikuju; nad celom
  arhivom razdvajaju (46% / 29%) — vidi [46](46-provera-r1-nad-arhivom.md);
- **ograničenja:** jedan kupac; preseci nisu nezavisni; „pogodak" znači da je
  kupac kupio, ne da je razgovor pomogao; kupovina kod drugog dobavljača se ne
  vidi. Pre oslanjanja: ista provera nad celom arhivom (svi mapirani kupci), sa
  vremenskim izdvajanjem kao kod Dynamics provere tačnosti.

## 5. Kvalitet logike — nalazi (ovaj kupac, zbirno)

| Tema | Nalaz | Odluka |
|---|---|---|
| ponovljene kupovine istog dana | 0 slučajeva; jezgro ih ionako sažima u jedan dan | bez promene |
| kupovine u razmaku ≤ 7 dana (dopuna) | 1 od 370 razmaka; spajanje u „epizode" pomera medijanu tog para 2% | bez promene formule; ponovo proveriti nad celom arhivom |
| sezonske kupovine | 2 artikla sa ≥ 4 kupovine u ≤ 3 kalendarska meseca; medijana ih ne razume (posle sezone izgledaju kao „kasni/prestao") | predlog: oznaka „sezonski" iz meseci kupovine — **nije uvedeno**, traži poređenje nad arhivom |
| veoma stari artikli | 15 „uspavanih": 10 bez kupovine > 1 god., 2 > 2 god., 1 > 3 god. | iz kratke liste ispadaju posle 365 dana (prikaz); status ostaje |
| nepravilan ritam | 6 artikala sa stabilnošću < 0,4 → niska pouzdanost → slabiji signali | bez promene |
| storna | ulaz uzima samo `faktura` sa `valid` proverom; storno se **ne prebija** sa originalnom fakturom, a parser storna drži kao `unsupported_requires_sample` | ograničenje: stornirana faktura se i dalje broji kao kupovina; rešenje posle pravila za storna (kancelarija) |
| lager i potrošnja kupca | nisu u fakturama | prikaz nikad ne obećava datum potrebe; tekst to kaže |
| grupa, cena, katalog | 0/122 artikla sa grupom, 0 veza sa katalogom, nema aktivnog cenovnika | izričito „Ograničenje: …" na svakom predlogu |

## 6. Otvorene odluke (ne uvoditi bez poređenja)

1. **Status kupca „Traži pažnju"** i dalje se pali i zbog artikla prestalog pre
   više godina (pravilo u `customerSummary.mjs`). Predlog: računati samo
   nedavno prestale (≤ 365 dana). Menja raspored kupaca na „Za razgovor" —
   traži poređenje nad svim kupcima.
2. **Sezonska oznaka** (§5).
3. **Kalibracija nivoa pouzdanosti** — visoka i srednja daju isti pogodak.
4. **Prag „nedavno prestao" = 365 dana i težine** — postavljeni razumno, ne
   kalibrisani; ponoviti proveru unazad nad celom arhivom.
5. **Storna** — tek posle pravila kancelarije.
