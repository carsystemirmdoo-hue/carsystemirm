# 15 — Otvrdnjavanje osnove (postflight F-1 … F-12)

Oznake: 🟢 sprovedeno u kodu · 🔵 predloženo · 🔴 blokirano · 🟡 odluka vlasnika

Ovaj dokument nastavlja `14-commercial-foundation.md` i opisuje šta je urađeno
po nalazima evidence-only postflight audita.

---

## 1. Nalaz → popravka

| # | Nalaz | Popravka | Gde |
|---|---|---|---|
| F-1 | `confirmed` se postavljao ljudskom tvrdnjom, bez dokaza sa fakture | Uvedeno stanje `office_recorded`; `confirmed` i `reconciliation_failed` rezervisani za budući reconciliation servis, uz **tri nezavisna sloja** zabrane | `0012`, `workflow.mjs`, `cene/actions.ts` |
| F-2 | Pricing ekrani bez assignment scope-a | `resolvePricingScope` u servisnom sloju; `previewPricing` traži `viewer`; `listPriceRules`/`listRuleConflicts` traže opseg | `pricing-scope.ts`, `360f04b` |
| F-3 | `isInternalSubject` testiran a nigde pozvan | Pozvan u internom session putu; fail-closed | `lib/authz/session.ts` |
| F-4 | Neuspela prijava kupca bez audita | `customerLoginFailed`, `customerLoginLocked`, `customerLoginSucceeded` | `auth.ts`, `3fc6b25` |
| F-5 | `failed_login_attempts` / `locked_until` mrtvi | Inkrementiraju se za kupčev nalog; uspeh resetuje | `account-service.ts` |
| F-6 | Kancelarija postavlja trajnu lozinku | Invitation token (hash, jednokratan, 48h) + reset (60 min) + promena iz sesije | `invitation-service.ts`, `0013` |
| F-7 | Četiri `notification_kind` vrednosti se ne emituju | Sve četiri emitovane iz **mutation** puteva, idempotentno preko `dedupe_key` | `0015`, `87b896c` |
| F-8 | QA je merio reč „cena", pa suženo na `main` | Semantička provera **cenovnog oblika** nad `main` + topbar + otvoren dialog; nov korak 14b | `pg-browser-qa.mts`, `2d90683` |
| F-9 | Mrtvi security helperi | Tri uklonjena (`resolveCustomerScope`, `assertCustomerScope`, `requireCustomerApiSession`); `customerIdScopeFor` **spojen u produkciju** (`pricing-scope.ts:52`) umesto brisanja — tamo i pripada. Integracioni test prepravljen da meri živu zaštitu | `360f04b`, `eab6a21` |
| F-10 | `rejected` značilo dve stvari; prethodni slug se brisao | `revoked` kao zasebno stanje; `previous_catalog_product_slug` + potpis + razlog | `0016`, `ee08c9b` |
| F-11 | `next-env.d.ts` generisani drift | Vraćen na projektni oblik (`.next-dev`) | vidi §6 |
| F-12 | QA popravka i semantički rename spojeni | Razdvojeno ovde, §5 | ovaj dokument |

---

## 2. Pristup komercijaliste (sekcija 5) 🟢

### Šta je tajna, a šta nije

| Podatak | Priroda | Ko ga vidi |
|---|---|---|
| interni `customers.id` | tehnički ključ | interno |
| BizniSoft `external_partner_code` | **poslovni identitet, nije tajna** | dodeljeni komercijalista, kancelarija, gazda |
| e-pošta kupčevog naloga | login identitet | kancelarija, gazda; komercijalista samo za dodeljene |
| `password_hash` | tajna | **niko** — ni kancelarija ni gazda ga ne vide |
| invite/reset token | tajna, jednokratna | prikazuje se **jednom**, pa više nikad |

Šifra partnera se namerno **ne tretira kao lozinka**. Ona je poslovni broj koji
stoji na fakturi; skrivanje bi otežalo posao bez ijedne dobiti u bezbednosti.

### Pravila 🟢

- Komercijalista koristi **isključivo svoj interni nalog**.
- Nikada se ne prijavljuje kao kupac i nikada ne zna kupčevu lozinku.
- Vidi kontakt i poslovne podatke **samo dodeljenih** kupaca
  (`customer_assignments` → `resolvePricingScope`).
- Sme da **predloži** kontakt-osobu za dodeljenog kupca; ne sme da izda poziv,
  aktivira nalog, ni da vidi token. Izdavanje poziva traži
  `customer_accounts:manage`.

### „Pogled kupca" — ugovor, ne implementacija 🔵

Simulirani prikaz onoga što kupac vidi **nije napravljen** u ovoj fazi. Procena:
uraditi ga polovično znači napraviti impersonation sistem bez njegovih zaštita,
što je gore od nepostojanja. Ugovor za kasnije:

| Zahtev | Vrednost |
|---|---|
| Sesija | **interna**, nikad kupčeva; bez impersonation kolačića |
| Pristup | isključivo **read-only**; nijedna kupčeva mutacija |
| Opseg | samo dodeljeni kupci, kroz isti `resolvePricingScope` |
| Vidljivost | trajno upozorenje „simulirani prikaz", ne diskretna oznaka |
| Audit | **svaki ulazak** se beleži, sa kupcem i razlogom |
| Saglasnosti | nevidljive i neizmenjive iz ovog pogleda |

🟡 Odluka vlasnika: da li je ovo uopšte potrebno, ili je dovoljan postojeći
ekran kupca u portalu.

---

## 3. Saglasnosti (sekcija 6) 🟢

Detalji u kodu i migraciji `0014`. Ključne odluke:

- **Dve odvojene svrhe**: `email_marketing` i `ad_personalization`. Kupac sme da
  pristane na jedno bez drugog.
- **Append-only**: povlačenje dodaje nov red. Trenutno stanje se izvodi iz
  poslednjeg događaja po (nalog, svrha), a merodavan je **redni broj upisa**, ne
  `occurred_at` — vreme sme da stigne van redosleda kod offline evidentiranja.
- **Podrazumevano bez pristanka.** Checkbox nije unapred označen; UI uopšte ne
  koristi checkbox nego zaseban obrazac po svrsi, pa neoznačeno polje ne može
  da se pošalje kao pristanak.
- **Nije uslov za nalog** (`consentRequiredForAccount()` → `false`, pod testom).
- Kancelarija sme da **evidentira** pristanak dat van sistema (uz potpis), ali
  **ne sme da evidentira povlačenje** — to kupac radi sam. Baza to sprovodi.
- Poruke o nalogu (poziv, reset, bezbednost) **nisu marketing** i stižu bez
  obzira na saglasnost.

**Nije implementirano i nije započeto:** kampanje, slanje newslettera,
Meta/Google audience upload. Nijedna nova zavisnost.

🟡 Pravni pregled: tekst saglasnosti (`CURRENT_CONSENT_TEXT_VERSION`) je
radna verzija i traži pravnu potvrdu pre prve upotrebe.

---

## 4. Lista kupaca — samo inventar (sekcija 11) 🟢

`_incoming/Klijenti.csv` je pregledan **read-only**. Fajl je pokriven
`.gitignore` pravilom `/_incoming/*.csv` i **nije praćen u Gitu**; nijedan
stvarni podatak nije ušao u repozitorijum, i neće.

### Struktura (bez ijedne stvarne vrednosti)

| Osobina | Vrednost |
|---|---|
| Veličina | 7.560 bajtova, UTF-8 sa BOM |
| Redova sa sadržajem | 110 |
| Razdvajač | zarez |
| Redova sa 8+ uzastopnih cifara (PIB-oblik) | 109 |
| Redova sa `@` | **0** |

**Najvažniji nalaz: lista nema nijednu e-poštu.** Iz nje se, dakle, ne može
otvoriti nijedan nalog — poziv traži potvrđen poslovni kontakt, koji se
prikuplja odvojeno.

### Ugovor budućeg lokalnog uvoza 🔵

1. Početna lista je **seed/kandidat lista**, ne registar kupaca.
2. **BizniSoft šifra partnera je kanonski poslovni identitet.** PIB i naziv
   služe kancelariji za pregled — nikada za fuzzy automatsko spajanje.
3. Faktura sa nepoznatom šifrom pravi `unmapped` kandidata, ne novog kupca.
4. Nalog se **ne aktivira** dok firma i kontakt e-pošta nisu ručno potvrđeni.
5. Recommendation algoritam kasnije sme da koristi istorijskog kupca **i bez**
   aktivnog portal naloga — kupovna istorija i pristup su različite stvari.
6. Uvoz se izvršava **lokalno**; ni lista ni izvedeni podaci ne ulaze u Git.

---

## 5. F-12 — šta je bila QA popravka, a šta semantički rename

Ove dve izmene su ranije spojene u jedan commit i to je otežavalo čitanje.
Razdvojeno:

| Izmena | Motiv | Da li je bila nužna za test |
|---|---|---|
| Sužavanje selektora `body` → `main` | **QA popravka.** Skener je hvatao bočnu navigaciju | **Da** — jedina izmena koja je popravila pad |
| Preimenovanje „Istorija cena" → „Istorija pravila" | **Semantičko poboljšanje.** Ekran prikazuje istoriju *pravila*, ne cena | **Ne** |

Dokaz da rename nije bio dovoljan: stavka „Odobravanje cena" i dalje sadrži reč
„cena", pa bi skener nad `body` i dalje padao. Provereno izvršavanjem.

Obe izmene su u međuvremenu nadmašene: F-8 je zamenio skeniranje reči
semantičkom proverom cenovnog oblika, pa naziv navigacije više uopšte ne
učestvuje u odluci da li test prolazi.

---

## 6. F-11 — `next-env.d.ts` 🟢

Fajl je Next.js generisan i naveden u `.gitignore` (`next-env.d.ts`, linija 43),
ali je bio **praćen u Gitu** — dodat pre nego što je pravilo uvedeno. Zato ga je
svaki `next build` ponovo prljao (`.next-dev` → `.next`), jer `.gitignore` na
praćen fajl ne deluje.

Sadržaj je vraćen na projektni oblik (`./.next-dev/types/routes.d.ts`), isti
koji proizvodi `npm run dev` — dokumentovana razvojna komanda.

🟢 **Sprovedeno:** `git rm --cached next-env.d.ts` izvršen je commit-om
`8ec1cec`; `.gitignore` pravilo sada važi i drift je prestao. Fajl **nije
praćen u Gitu** — to ne znači da ne postoji na disku: Next.js ga i dalje
lokalno generiše pri `next dev`/`next build`, kao ignorisan fajl.

---

## 7. Otvoreno

| Tema | Stanje |
|---|---|
| MFA za kupčeve naloge | 🟡 politika drugog faktora je pisana za interne naloge |
| Slanje e-pošte | 🔵 provider-neutralan outbox postoji; nema provajdera |
| Tekst saglasnosti | 🟡 traži pravnu potvrdu |
| „Pogled kupca" | 🟡 samo ugovor, §2 |
| Automatski prelaz u `expired` | 🔵 danas ručna radnja |
| Reconciliation servis | 🔵 jedini koji sme da postavi `confirmed`; van dometa ove faze |
