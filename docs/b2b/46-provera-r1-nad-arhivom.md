# 46 — Provera redosleda R1 nad celom arhivom (lokalno)

**Status (2026-10-02): urađeno lokalno nad već dostavljenom arhivom; ništa
nije upisano u bazu (ni lokalnu ni Neon), nema deploymenta. R1 ostaje
eksperiment; `cadence_v1` nije menjan.** Prethodni korak: [45](45-predlozi-za-razgovor-i-filter.md).

## 1. Šta se poredi

- **Dosadašnji redosled (R0):** spisak „Vredi pomenuti" pre R1 — ranije
  redovni artikli (po broju kupovina), pa oni koji kasne (najveće kašnjenje u
  ciklusima prvo), pa sada/uskoro (po roku); bez obzira na pouzdanost i
  starost poslednje kupovine; bez artikala sa dve kupovine.
  `legacySuggestions()` u `lib/recommendations/suggestionRanking.mjs`.
- **R1 (eksperiment):** kratka lista iz `rankSuggestions()` — srednja/visoka
  pouzdanost, aktuelan termin ili nedavno prestao (≤ 365 dana), redosled
  termin × pouzdanost × istorija. Slabiji signali odvojeno.

Oba rade nad ISTIM rezultatom `cadence_v1`; razlikuju se samo izbor i redosled.

## 2. Metod

- `lib/recommendations/rankingBacktest.mjs` (čista funkcija, sa testovima):
  na svakom preseku `cadence_v1` se računa **samo nad kupovinama do tog dana**;
  budući događaji ulaze samo u ocenu pogotka (test „presek ne vidi budućnost").
- Preseci: prvi dan svakog meseca od 2022-01 do (poslednji datum u arhivi −
  horizont) — 56 preseka za H = 45.
- Pogodak: artikal iz prvih 5 kupljen u narednih H dana (30 / 45 / 60).
- **Makro po kupcu:** prosek kupca preko njegovih preseka, pa prosek i medijana
  preko kupaca — svaki kupac ima jednu težinu. Upoređuju se **pareni** preseci
  (oba pravila imaju bar jedan predlog); kupac ulazi u poređenje sa ≥ 3 parena
  preseka. Mikro (svi predlozi zajedno) prikazan je samo uz njega.
- Grupa kupca se određuje **na dan preseka**, samo iz tada poznatih kupovina:
  novi (prva kupovina ≤ 180 dana) → neaktivan (poslednja > 180 dana) →
  sezonski (≥ 2 god. istorije, ≥ 8 dana kupovine u 24 meseca, ≥ 70% tih dana u
  4 kalendarska meseca) → redovan (≥ 9 od 12 meseci) → povremen.
- Veličina kupca (broj računa u arhivi) služi samo za podelu izveštaja, ne
  utiče na izbor.

## 3. Ulaz — ista pravila kao `recommendation_input_lines`

Arhiva je ponovo pročitana istim parserom (`biznisoft-pdf-2`), u memoriji;
izvedene stavke su samo u `~/.carsystem-private/analiza-r1/` (600).

| Pravilo | Dokumenata |
|---|---|
| važeće fakture u ulazu | 11.490 (75.064 stavke) |
| storno dokumenti — nisu kupovina | 28 izuzeto |
| **sporne revizije** (isti poslovni broj, različit sadržaj) — **sve verzije izuzete**, kao u portalu (nisu `original`) | 24 izuzeto (12 parova) |
| isti bajtovi — zadržan jedan | 2 izuzeto |
| stavke sa količinom ≤ 0, negativnim iznosom ili bez šifre | izuzete |
| nevažeći, nepoznati i nečitljivi dokumenti | nisu ni čitani kao ulaz (kao u portalu) |

**Storna — dve varijante:**
- **A (kao portal danas):** storno se izuzima, ali originalna faktura ostaje
  kupovina (portal ne prebija storno sa originalom).
- **B (storno poništava):** potpuno stornirani original (27) važi u istoriji
  samo do dana storna i **nikad** nije pogodak.

Razlika A/B je najviše 2 procentna poena (medijana u grupi „novi", 8 kupaca),
a u ukupnom proseku nula — 27 originala od 11.490 ne menja zaključak. Tabele
ispod su varijanta A.

## 4. Rezultati (H = 45, 265 kupaca, makro po kupcu)

| Grupa | Kupaca (uporedivo / ukupno) | R0 prosek (med.) | R1 prosek (med.) | R1 bolji / isto / lošiji |
|---|---|---|---|---|
| **svi** | 167 / 264 | 17% (12%) | **32% (30%)** | 120 / 43 / 4 |
| redovan | 86 / 94 | 18% (13%) | **46% (48%)** | 79 / 5 / 2 |
| povremen | 130 / 187 | 18% (13%) | **26% (26%)** | 83 / 40 / 7 |
| sezonski | 35 / 52 | 11% (8%) | **24% (20%)** | 22 / 11 / 2 |
| novi | 8 / 105 | 32% (39%) | 43% (44%) | 5 / 3 / 0 |
| neaktivan | 74 / 178 | 7% (0%) | 9% (0%) | 16 / 53 / 5 |
| veliki (≥ 50 računa) | 71 / 71 | 16% (12%) | **45% (47%)** | 69 / 1 / 1 |
| srednji (10–49) | 70 / 72 | 20% (12%) | **26% (21%)** | 48 / 21 / 1 |
| mali (< 10) | 26 / 121 | 9% (4%) | 10% (5%) | 3 / 21 / 2 |

Osnovna stopa (bilo koji artikal sa ≥ 2 kupovine kupljen u prozoru): 16%.
Isti smer na H = 30 (svi: 13% → 24%) i H = 60 (20% → 37%).

**Kada R1 ćuti, a R0 predlaže** (2.333 preseka; 1.764 neaktivni, 463
povremeni): R0 tamo pogađa 3%, slabiji signali R1 7%, osnovna stopa 2%. Tišina
R1 je u tim slučajevima opravdana — R0 je tu nudio uglavnom davno prestale
artikle kupcima koji ne kupuju.

**Lošiji kod 4 kupca:** razlika do 2 procentna poena; dva mala kupca su na
≈ 0% u oba pravila. Nema grupe ni veličine u kojoj je R1 sistematski lošiji.

**Gde provera malo govori:**
- novi kupci: samo 8 uporedivih (kratka istorija → malo procena);
- mali kupci: 26 od 121 uporedivo; R1 ≈ R0;
- neaktivni: medijana 0% u oba — redosled artikala ne rešava kupca koji ne kupuje.

**Pouzdanost NIJE verovatnoća.** Nad arhivom su predlozi visoke pouzdanosti
pogođeni u 46%, srednje u 29% — nivoi razdvajaju, ali to je stopa iz prošlosti
za grupu predloga, ne verovatnoća da će ovaj kupac kupiti ovaj artikal. Ekran
prikazuje samo nivo i šta on znači.

## 5. Ograničenja

- Pogodak ≠ uticaj razgovora; kupovina kod drugog dobavljača se ne vidi.
- Dokumenti koje parser ne podržava (1.194 „unsupported", 147 nečitljivih)
  nisu u ulazu — kod nekih kupaca istorija je nepotpuna. Isto važi i u portalu.
- Kupac = šifra partnera sa dokumenta (bez veze sa šifarnikom); u portalu
  ulaze samo potvrđeno mapirani kupci.
- Preseci istog kupca nisu nezavisni; rezultat je opis prošlosti, ne garancija.

## 6. Šta je u prikazu

- R1 je označen „Redosled R1 · eksperiment" na kartici kupca i na „Za razgovor";
- „Uporedite sa dosadašnjim" (`?redosled=dosadasnji`) prikazuje R0 nad istim
  podacima; „Vratite R1" vraća eksperiment. `cadence_v1` je isti u oba;
- tekst kaže da pouzdanost nije verovatnoća kupovine.

## 7. Pre Neon pilota

- Ista provera nad pilot bazom posle uvoza (samo mapirani kupci), istim
  modulom — rezultat treba da bude u istom smeru; ako nije, R1 ostaje iza
  prekidača.
- Otvorene odluke iz [45 §6](45-predlozi-za-razgovor-i-filter.md) i dalje
  važe (status „Traži pažnju", sezonska oznaka, prag 365 dana, storna).
