# 66 — Cene po kupcu, akcije, obaveštenja i uvoz VP cenovnika (2026-10-16)

Grana `feat/cene-po-kupcu-redizajn`, osnova firmin `main` 36e44a65. Vizuelna referenca: Design projekat
„Portal kupca i kancelarija — redizajn“ (paket `…-png.zip`); poslovna pravila iz odluka vlasnika od 16. 10. 2026
imaju prednost nad natpisima na slikama. Produkcija i produkcijska baza nisu dirane; migracija je proverena samo na
test bazi.

## 1. Pravila (sprovodi server)

| Pravilo | Gde |
|---|---|
| Pamti se rabat; unos cene samo izračunava rabat (najviše 3 decimale, kao u BizniSoftu; ako tačna cena ne postoji, prikazuje se najbliža) | `lib/pricing/rebateSheet.mjs` (`rabatFromPrice`, `evaluateEdit`), server ponovo računa na VP dana važenja |
| Avans i odloženo imaju odvojene rabate (pravilo kupac + artikal + `payment_condition`) | `customer-rebate-service.ts` `saveRebateChanges` |
| Komercijalista menja samo dodeljene kupce, vlasnik sve; kancelarija i magacioner samo pregled | `rebates:edit`, `rebates:edit_all`, `canEditCustomer` (dodela iz `customer_assignments`) |
| Vlasnik i kancelarija uvoze VP cenovnik; ručnu izmenu pojedinačne osnovne cene i dalje samo vlasnik | `pricelist:import` / `pricelist:manage` u `price-list-service.ts` |
| Izmena se čuva odmah, bez odobrenja; pravilo važi samo u portalu (`biznisoft_entry_required = false`) — portal ne tvrdi da je išta upisano u BizniSoft | `saveRebateChanges` |
| Akcija (`rule_kind = 'akcija'`) pobeđuje redovni rabat istog opsega dok važi; redovni se ne menja i posle isteka važi na tada važeću VP cenu | `precedence.mjs` (`pausedRegular`), `customer-price-service.ts` |
| Preklapanje akcija se ne čuva bez izričite zamene; zamena skraćuje staru akciju do dana pre nove (ili je opoziva ako počinje istog ili kasnijeg dana); posle nove akcije vraća se redovni rabat, ne stara akcija | `planReplacement` |
| Nov redovni rabat zatvara prethodni redovni istog opsega dan ranije; budući se opoziva | `planReplacement` |
| Prazan unos posebnog dogovora za artikal se odbija — osnovni ili grupni rabat se ne vraća sam; postoji izričito dugme „Upišite osnovni rabat X %“ | `evaluateEdit` |
| Nov artikal iz uvoza: podrazumevani rabat 30 % za sve opcije, dok ne postoji pravilo za sam artikal; izričit dogovor se ne prepisuje | `article_new_defaults`, `withNewArticleDefault` (isti put kao korpa i kancelarija) |
| Izmena komercijaliste → obaveštenje svim aktivnim vlasnicima; vlasnikova → komercijalistima dodeljenim kupcu; bez dodele → niko; kupac nikad | `noticeRecipients`, `rebate_change_notices` |
| Obaveštenja se brišu posle 10 dana (pri čitanju i pri čuvanju); tabela nema vezu ka pravilima, pa brisanje ne dira rabate ni akcije | `purgeOldNotices` |
| Uvoz menja samo VP cene; rabati se ne prepisuju; prepoznavanje samo po šifri (naziv je upozorenje); duplikati i neispravni redovi se ne primenjuju | `prepareTablePriceList`, `classifyPriceRows` |
| Cena po pakovanju se deli potvrđenom količinom JM u pakovanju; artikal bez potvrđenog pakovanja ide u neispravne redove | `buildTableRows` |
| Izričita veza šifre iz cenovnika sa postojećim artiklom se pamti i važi za sledeće uvoze | `article_code_aliases` |

Šifra artikla je jedinstvena u portalu (`articles.code`), pa je izbor dobavljača iz prototipa nepotreban: ista šifra
ne može pripadati dvama artiklima, a drugačija šifra se povezuje samo izričito.

## 2. Migracija 0057 (`db/migrations/0057_customer_rebate_sheet.sql`, povratak u `db/rollback/`)

- `price_rules.rule_kind` (`redovni` | `akcija`; akcija mora imati kraj);
- `article_new_defaults`, `article_code_aliases` (samo dodavanje; uloga aplikacije bez UPDATE/DELETE);
- `rebate_change_notices` (UPDATE za „pročitano“, DELETE za brisanje posle 10 dana);
- `price_list_imports`: `source_format`, `price_unit`, `column_map`, `decisions`; `price_list_import_rows`:
  `raw_price`, `file_unit`, `file_pack`.

Pre povratka migracije pravila tipa „akcija“ treba opozvati — posle povratka bi postala redovna pravila u sukobu.

## 3. Ekrani

- `/portal/cene/kupci` — izbor kupca (pretraga, nedavno otvarani u ovom pregledaču, opseg po ulozi).
- `/portal/cene/kupci/[id]` — tabela rabata i cena po opciji plaćanja; upisano polje žuto, izračunato u sivom
  kurzivu; detalji po redu (izvor rabata, akcija i rabat koji se vraća, zakazane izmene, nova VP, cena pakovanja,
  poslednja faktura); pregled pre čuvanja sa periodom (od danas / od datuma / akcija od–do) i izričitom zamenom
  akcije; kancelarija vidi samo vrednosti i kolonu „Poslednja faktura“. Ispod 720 px tabela postaje kartice bez
  vodoravnog pomeranja.
- `/portal/cene/obavestenja` — interna obaveštenja (pre/posle, opcija, period, autor, napomena; pročitano/novo).
- `/portal/cene/uvoz` i `/portal/cene/uvoz/[id]` — tabela (CSV/XLSX, izbor kolona i jedinice cene) ili BizniSoft
  PDF; prepoznavanje po šifri sa grupama; neispravni redovi; novi artikli (JM, pakovanje, preračun) ili izričita
  veza; završni pregled i potvrda (sveža potvrda drugog faktora).

Postojeći ekrani (`/portal/cene`, odobravanje, rabati iz faktura, cenovnik) ostaju; novi tok ne prolazi kroz
odobravanje.

## 4. Provere

- `npm test` (svi jedinični, uključujući `rebateSheet.test.mjs`, `tablePriceList.test.mjs`, dozvole i čuvar teksta);
- `test:integration` 602/602 na test bazi (nova: `customerRebateSheet`, `priceListTable`; izmenjen `priceList` —
  kancelarija sme da uvozi);
- `typecheck`, `lint`, `build:check`;
- pregledač nad sintetičkom bazom (`seed-synthetic-portal.mts` + `seed-synthetic-cene-kupca.mts`, server iz
  `.next-verify`): `scripts/qa/cene-kupca-ui.mjs` 24/24 — kancelarija bez polja i sa „Poslednja faktura“, uvoz po
  pakovanju (11.700,00 ÷ 5 = 2.340,00), neispravan red, nova šifra; magacioner samo pregled i bez uvoza; komercijalista
  samo svoji kupci (tuđi 403), rabat iz cene, čuvanje (u bazi rabat, bez cene, `biznisoft_entry_required = false`),
  preklapanje akcije blokira čuvanje do izričite zamene, stara akcija skraćena; vlasnik dobija obaveštenje; kupac bez
  komercijaliste — obaveštenje nikome; telefon 390 px bez vodoravnog pomeranja; bez JS grešaka;
- postojeći tok kupca i kancelarije (`synthetic-portal-flow.mjs`) na čistoj sintetičkoj bazi: 78/79 (pad: skripta je
  čitala pogrešan fajl sa kodom sajta; sa ispravnim fajlom otključavanje prolazi);
- štampa A4 sa 62 stavke (umnožene u pregledaču): 4 strane, zaglavlje tabele na svakoj, zbir na kraju, „Strana N od 4“.
- Ispravljeno usput: u meniju je bila aktivna i nadređena stavka („Cene i rabati“ uz „Cene po kupcu“) — sada samo najuža.

## 5. Preview

Nije objavljen. Za granu na Vercelu nema Preview promenljivih (postoje samo za `pilot/istorija`, koja koristi produkcionu
bazu), sintetička Neon baza (`ep-weathered-lake`) je na 33 migracije i vraćena je odlukom vlasnika 10. 10. 2026, a
pristup Vercelu (token, CLI) nije važeći. Potrebni koraci su u završnom izveštaju.
