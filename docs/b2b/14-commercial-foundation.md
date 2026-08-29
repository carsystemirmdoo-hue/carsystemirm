# 14 — Komercijalna i identitetska osnova

Oznake: 🟢 sprovedeno u kodu · 🔵 predloženo · 🔴 blokirano · 🟡 odluka vlasnika

Ovaj dokument opisuje šta je **stvarno u kodu** posle grane
`feature/b2b-commercial-foundation`. Sve što je i dalje predlog izričito nosi
oznaku 🔵.

---

## 1. Šta je uklonjeno 🟢

Dependency graph (`lib/authz/capabilityMatrix.test.mjs:reachableFromApp`) je
dokazao da sledeći moduli nisu dostižni ni iz jedne rute u `app/`:

| Uklonjeno | Zašto |
|---|---|
| `permissions/portal-permissions.ts` | drugi model uloga (`owner`/`sales`/`office`) i sopstvena `can()` |
| `services/portal/portal-service.ts` | `mockPortalService.applyMockPriceChange` je „primenjivao" cenu u memoriji |
| `features/portal/{Customers,Entity,IntegrationCenters,LegacyAccessGuard,OperationsAdmin,Orders,PortalDashboard,PortalLogin,Pricing}*` | potrošači gornja dva |
| `components/portal/PortalProvider.tsx`, `fixtures/dev/portal/**`, `types/portal.ts` | isključive zavisnosti gornjih |
| `PortalPrimitives`: `StateView`, `ModuleState` | jedini potrošači su bili gore |

**Zadržano netaknuto:** `ImportUpload`, `PermissionMatrix`, `PortalLoginForm`,
`SalesAnalytics`, `SalesFilters`, `ThresholdSettings`, `lib/authz/permissions.mjs`.

Test koji je ranije tvrdio „stari model je nedostižan" zamenjen je strožim:
fajl **ne sme postojati**. Izolacija je privremena mera; fajl koji postoji može
biti uvezen.

---

## 2. Model podataka 🟢

### Migracije (sve aditivne i idempotentne)

| # | Tabela / tip | Šta uvodi |
|---|---|---|
| 0008 | `customer_external_identifiers`, `article_catalog_mappings` | spoljni identitet kupca i veza artikla sa katalogom |
| 0009 | `customer_users` | kupčev nalog kao odvojen identitet |
| 0010 | `customer_groups`, `customer_group_members`, `price_rules` | grupe kupaca i pravila cene |
| 0011 | `notifications` | obaveštenja za gazdu i kancelariju |

Nijedna postojeća tabela nije izgubila kolonu ni ograničenje. `users.role`
ostaje **četiri interne uloge** — `kupac` NIJE dodat, i test to čuva.

### Ograničenja koja živе u bazi, ne u kodu

```
customer_external_identifiers
  UNIQUE (source_system, issuer_code, external_partner_code)
  CHECK   mapped ⇒ customer_id NOT NULL;  unmapped ⇒ customer_id IS NULL

article_catalog_mappings
  UNIQUE (article_id) WHERE status <> 'rejected'
  CHECK   mapped ⇒ catalog_product_slug NOT NULL

customer_users
  UNIQUE (email)                       — preko cele tabele, ne po kupcu
  CHECK   email = lower(email)
  CHECK   rejected|suspended ⇒ decision_reason NOT NULL

price_rules
  CHECK   value_kind ⇒ tačno jedno od (discount_percent, net_price)
  CHECK   customer_scope nosi tačno svoje polje
  CHECK   product_scope nosi tačno svoje polje
  CHECK   precedence_level = f(customer_scope, product_scope)   ← ista matrica kao u kodu
  CHECK   effective_to >= effective_from
  CHECK   rejected|revoked ⇒ decision_reason NOT NULL
  CHECK   confirmed ⇒ confirmed_by I confirmed_at NOT NULL

notifications
  CHECK   resolved ⇒ resolved_by, resolved_at, resolution_note NOT NULL
  CHECK   required_capability <> ''
```

> Matrica prvenstva namerno postoji **dvaput** — u `lib/pricing/precedence.mjs`
> i kao `CHECK` u bazi. Razilaženje se tada vidi kao **odbijen upis**, a ne kao
> pogrešna cena.

---

## 3. Identitet kupca 🟢

PIB ostaje jedinstven i koristan podatak. Ono što se promenilo je da PIB više
**nije jedini identitet**.

- `external_partner_code` je `text`. `"0012"` i `"12"` su **različiti**
  partneri. Nigde u lancu se nad tom vrednošću ne poziva `Number`, `parseInt`
  ni `replace(/^0+/)` — test čita izvor modula i pada ako se bilo koje od toga
  pojavi.
- Jedinstvenost je `(izvor, izdavalac, šifra)`. Ista šifra kod dva izdavaoca je
  legitimna i ne sme se spojiti.
- **Nema fuzzy povezivanja.** Modul ne sadrži nijednu funkciju poređenja naziva;
  test traži odsustvo `levenshtein`, `similarity`, `fuzzy`, `localeCompare`.
- `pibIsAutoMergeEvidence()` vraća `false` i pod testom je.
- Ista šifra ka drugom kupcu → `conflict`, nikad prepis.

Stanja: `unmapped` · `mapped` · `conflict` · `disabled`.

---

## 4. Artikal ↔ katalog 🟢

- Predlog se pravi **isključivo po tačnoj internoj šifri**. Dva kataloška
  proizvoda sa istom šifrom daju `conflict`, ne izbor.
- Predlog (`suggested`) **nije** potvrda: ne otvara ni sliku ni PDP.
- `UNIQUE (article_id) WHERE status <> 'rejected'` sprečava da jedan artikal
  tiho pokazuje dva kataloška proizvoda.
- **Nemapiran artikal ostaje potpuno vidljiv** kancelariji, gazdi i
  komercijalisti kao poslovni artikal. Ono što nema je kataloški identitet.

Bulk-import ugovor za buduću Excel listu stoji kao **vrednost**
(`MAPPING_IMPORT_CONTRACT`), ne kao tekst:

| Polje | Vrednost | Značenje |
|---|---|---|
| `maxProducedStatus` | `suggested` | uvoz sme da predloži, nikad da potvrdi |
| `matching` | `exact_internal_code` | poklapanje samo po tačnoj šifri |
| `neverOverwrites` | `["mapped", "rejected"]` | uvoz ne dira čovekovu odluku |
| `ambiguousBecomes` | `conflict` | dvosmislena šifra ide u konflikt, ne u izbor |

🔵 Katalog se u ovoj fazi **ne uvozi** i ne pokušava se mapiranje svih ~3.500
proizvoda.

---

## 5. Autorizacija 🟢

### Interni model — nepromenjen

`requireCapability()`, `requireCustomerAccess()`, `resolveCapabilities()` rade
isto što i pre. Dodate su samo nove sposobnosti i novi paketi.

### Kupčev model — odvojen

```
users          → INTERNI nalozi (gazda, komercijalista, kancelarija, magacioner)
customer_users → EKSTERNI nalozi, svaki nosi tačno jedan customer_id
```

Tri nezavisna sloja, svaki sposoban sam da odbije:

1. **Token** nosi `subject`. Kupcem se smatra samo **izričit** `"customer"`.
   Odsustvo claim-a je interni nalog — postojeći tokeni nastavljaju da važe, a
   podrazumevana vrednost vodi ka **manjem** pristupu, nikad većem.
2. **`requireCustomerSession()`** čita `customer_id` iz baze, po ID-u sesije.
   Nema parametra kojim bi pozivalac tražio drugog kupca — ne zato što bi bio
   odbijen, nego zato što takav parametar ne postoji.
3. **Upit** — `customer_id` ide u `WHERE`, nikad u filtriranje posle učitavanja.

Kupčev ID postoji **samo** u `customer_users`. `loadPortalUser()` gleda `users`,
pa kupčev token kroz internu kapiju ne dobija ništa čak i kada bi neko
zaboravio da proveri `subject`.

### Novi paketi dozvola

| Paket | Sposobnosti | Zašto odvojen |
|---|---|---|
| `mapiranja` | `view:mapiranja`, `mappings:manage` | pogrešno razrešena šifra pokazuje tuđu istoriju |
| `kupacki_nalozi` | `view:kupacki_nalozi`, `customer_accounts:manage` | otvara pristup cenama jedne firme spolja |
| `cene_predlog` | `view:cene`, `prices:propose` | — |
| `cene_odobravanje` | `view:cene`, `prices:approve`, `prices:audit` | ko predlaže i odobrava ne prolazi kroz kontrolu |
| `cene_primena` | `view:cene`, `prices:apply` | ko odobrava odluku firme ne mora biti onaj ko vidi BizniSoft |
| `obavestenja_pregled` | `view:obavestenja`, `notifications:review` | — |

Test dokazuje da **nijedan pojedinačni paket** ne daje više od jednog od tri
koraka toka cene.

---

## 6. Dokaz prvenstva cene 🟢

Dvanaest klasa, od najužeg opsega ka najširem:

| # | Kupac | Proizvod |
|---|---|---|
| 1 | konkretan | konkretan artikal |
| 2 | konkretan | grupa proizvoda |
| 3 | konkretan | proizvođač |
| 4 | konkretan | svi |
| 5 | grupa | konkretan artikal |
| 6 | grupa | grupa proizvoda |
| 7 | grupa | proizvođač |
| 8 | grupa | svi |
| 9 | svi | konkretan artikal |
| 10 | svi | grupa proizvoda |
| 11 | svi | proizvođač |
| 12 | svi | svi (globalno) |

**Konflikt, ne izbor.** Dva aktivna pravila iste klase za isti dan i isti opseg
daju konflikt. `created_at` se ne koristi **ni kao sekundarni kriterijum** —
test čita izvor modula i pada ako se reč `createdAt` uopšte pojavi u izvršnom
kodu.

Kako se to dokazuje (`lib/pricing/precedence.test.mjs`): skup kreće sa svih
dvanaest pravila; posle svakog skidanja najuže klase pobednik mora biti **tačno
sledeća** klasa. Isti lanac se ponavlja kroz pravi SQL upit u
`db/integration/pricingRules.integration.test.mts`.

Evaluacija vraća **objašnjenje**: pobedničko pravilo, sva razmatrana pravila,
razlog prvenstva, konflikt i period važenja.

### Šta se NE računa

**Marža se ne računa i rabat se tako ne naziva.** Marža traži nabavnu cenu,
koju portal nema i koja po AD-4 ne ide u cloud. Test pada ako se u izvršnom kodu
pojavi `margin` ili `marža`.

Rabatno pravilo bez cenovničke cene **ne daje broj** — vraća `null` sa
objašnjenjem. Izvedena cena bez izvora je pogodak predstavljen kao činjenica.

---

## 7. Tok promene cene 🟢

```
draft ──▶ pending_approval ──▶ approved_pending_biznisoft ──▶ confirmed
              │                        │           │
              ├─▶ rejected             │           └─▶ reconciliation_failed ─▶ confirmed
              └─▶ revoked              ├─▶ revoked
                                       └─▶ expired
```

**`approved_pending_biznisoft` ≠ `confirmed`.** Odobrenje je odluka gazde;
potvrda je izjava kancelarije da je uslov upisan u BizniSoft. Dok potvrde nema,
pravilo **nije garantovana fakturisana cena**.

- Predlagač ne odobrava sopstveni predlog (osim nosioca `prices:audit`).
- Komercijalista predlaže **samo za dodeljene kupce**, kroz isti
  `canAccessCustomer` kojim je već zaštićen ekran kupca.
- Grupno i globalno pravilo traže `customers:view_all`.
- Odbijanje, opoziv i neuspelo usaglašavanje traže obrazložen razlog.
- Završna stanja (`rejected`, `revoked`, `expired`) nemaju izlaz.

### Šta kupac vidi

`customerFacingDisclosure()` vraća `visibleToCustomer: false` za **svih osam**
stanja. Kupcu se u ovoj fazi ne prikazuje odobrena buduća cena.

Kasnije je dozvoljeno prikazati poslednju fakturisanu cenu, i ograda je deo
samog teksta (`lastInvoicedPriceLabel`), da se ne izgubi u prosleđivanju:

> Poslednja fakturisana cena od {datum} — informativno, nije potvrda buduće cene.

---

## 8. Audit i obaveštenja 🟢

**Audit** je postojeći `audit_log`, proširen novim `action` vrednostima. Izmena,
audit zapis i obaveštenje idu u **istoj transakciji**: ne može ostati promena bez
traga, ni obaveštenje o promeni koja se nije desila. Append-only je i dalje
sprovedeno okidačima u bazi — integracioni test to dokazuje pokušajem `UPDATE`
i `DELETE` nad zapisom o ceni.

**Obaveštenja** su zasebna tabela. Nije audit i ne zamenjuje ga: obaveštenje se
čita i zatvara, trag se ne menja. Zato tabela nosi referencu na entitet i
`correlation_id` ka audit zapisu iste radnje — dve kopije istorije bi se
razišle.

Vidljivost se vezuje za **sposobnost**, ne za ulogu, i uslov stoji u samom
`UPDATE`-u — bez toga bi se tuđe obaveštenje moglo zatvoriti pogađanjem ID-a.

Usmeravanje:

| Događaj | Ide ka | Ozbiljnost |
|---|---|---|
| predlog cene | `prices:approve` (gazda) | info |
| odobrenje | `prices:apply` (kancelarija) | info |
| odbijanje | `prices:propose` (predlagač) | info |
| **reconciliation_failed** | `prices:approve` (gazda) | **critical** |
| opoziv | `prices:approve` | warning |

`confirmed` i `expired` ne šalju obaveštenje: prvo je očekivan ishod radnje koju
je čovek upravo izvršio, drugo je protek vremena.

### Osetljivi podaci

`assertSafeContext()` odbija `context` sa poljima `pib`, `adresa`, `email`,
`telefon`, `token`, `secret`, `ip` i sličnima. Trag revizije nosi šifru partnera
i šifru artikla — poslovne identifikatore — ali **ne PIB, adresu ni kontakt**.

---

## 9. UI rute 🟢

| Ruta | Sposobnost | Šta radi |
|---|---|---|
| `/portal/kupci/mapiranja` | `view:mapiranja` | šifre partnera, ručno razrešavanje |
| `/portal/kupci/nalozi` | `view:kupacki_nalozi` | nalozi kupaca |
| `/portal/proizvodi/mapiranja` | `view:mapiranja` | veze artikala sa katalogom |
| `/portal/cene` | `view:cene` | matrica prvenstva, konflikti, provera para |
| `/portal/cene/pravila` | `view:cene` | predlog + spisak |
| `/portal/cene/odobravanje` | `view:cene` | red čekanja odluka |
| `/portal/cene/istorija` | `view:cene` | sva pravila, u svakom stanju |
| `/portal/obavestenja` | `view:obavestenja` | stvarna obaveštenja |
| `/prijava/kupac` | javna | prijava kupca |
| `/kupac` | kupčeva sesija | kupčev prostor |

Popunjene su **postojeće** rute. `/portal/cene`, `/portal/cene/pravila` i
`/portal/cene/istorija` bile su `redirect` zaglavlja iz prve verzije portala.

Nigde nema mock podataka. Prazan ekran kaže šta nedostaje i **namerno ne
prikazuje primer**.

---

## 10. Šta ova faza NIJE uradila

Izričito van dometa, po dogovoru:

- PDF parser i Windows konektor
- invoice revision algoritam
- preporuke kupcima i prognoza potražnje
- automatska porudžbina
- obračun stvarne marže
- BizniSoft write-back
- uvoz kataloga i mapiranje svih ~3.500 proizvoda

## 11. Otvoreno 🟡

- **MFA za kupčeve naloge.** Politika drugog faktora je pisana za interne
  naloge. Primeniti je na kupce bez odluke vlasnika značilo bi ili zaključati
  sve kupce napolju ili tiho oslabiti internu politiku.
- **Invite tok e-poštom.** Nalog danas otvara kancelarija sa početnom lozinkom
  koja se predaje van sistema — isti obrazac kao interni reset. Jednokratni link
  sa TTL-om je sledeći korak (`02-auth-roles-tenancy.md`, §5).
- **Cenovnička cena.** Rabatno pravilo bez nje ne daje neto cenu. Izvor
  cenovničke cene još nije definisan.
- **Automatsko prelaženje u `expired`.** Danas je ručna radnja; posao koji to
  radi po datumu još ne postoji.
