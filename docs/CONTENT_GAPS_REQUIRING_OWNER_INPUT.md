# Sadržaj koji čeka odgovor vlasnika

Jedini dokument koji vlasnik treba da pročita i popuni posle provere sadržaja,
kontakt podataka, placeholder tekstova i obraćanja korisniku (2026-10-01,
grana `chore/content-qa-2026-10`, polazni `origin/main` = `f1bd389`).

Odgovor upišite u red **ODGOVOR VLASNIKA** ispod svakog pitanja. Ništa iz ovog
dokumenta nije pogađano: gde postoji kandidat iz javnog izvora, naveden je kao
**nepotvrđen**.

## Rezime

| | Broj |
|---|---|
| Ukupno stavki | 13 |
| Blokiraju produkciju (BLOCKER) | 3 |
| HIGH / MEDIUM / LOW | 2 / 3 / 5 |
| Kontakt podaci koji nedostaju ili nisu potvrđeni | 3 (telefon, e-pošta, radno vreme) |
| Tekstovi i prikazi za koje je potrebna poslovna odluka | 8 (GAP-003, 005, 006, 007, 009, 011, 012, 013) |
| Konflikti između izvora | 3 (GAP-001, GAP-002, GAP-005) |

### Šta je već ispravljeno bez Vašeg odgovora

- **Lažni telefon `+381 22 000 000` uklonjen.** Stajao je kao klikabilan
  `tel:` link na 1233 prerenderovane strane (footer, kontakt, početna, svaki
  PDP, brend strane). Do Vašeg odgovora (GAP-001) red za telefon se ne
  prikazuje, a dugme „Pozovite" ostaje samo „Pošaljite upit".
- **Neprovereno radno vreme `Pon-Pet 08:00-16:00` uklonjeno** (GAP-004).
- **Dodata adresa centrale „Ive Andrića 3, 22320 Inđija, Srbija"** — saglasna u
  četiri nezavisna izvora (registar privrednih subjekata, firmin BEX adresar,
  spisak partnera na carsystem.org, poslovni agregator).
- **Persiranje svuda:** čuvar teksta nad polaznim `origin/main` nalazi 245
  fragmenata sa neformalnim imperativom („Pronađi", „Pošalji", „Sačuvaj",
  „Zatvori meni"…) i 55 sa zamenicom obraćanja malim slovom, na javnom sajtu,
  u prijavi, nalogu kupca i portalu; na ovoj grani 0. Oblik je „Pronađite",
  „Pošaljite"…, a zamenice se pišu velikim slovom (Vi, Vam, Vas, Vaš).
  Izuzetak: novogodišnje i uskršnje čestitke se obraćaju radionicama i
  partnerima zajedno, pa ostaje „vam".
- **Razvojni žargon uklonjen sa javnih strana:** „backend slanje nije
  povezano", „Crawlable pregled", „interni preview prikaz", „javni markeri",
  „lokalni product zapisi", „asseti/tehnički slotovi", „sačuvana R-M product
  stranica iz foldera", „dostavljeni ZIP", naziv env promenljive na
  `/site-u-pripremi`.
- **SEO:** sistemska slika „vizuel u pripremi" više se ne deli kao
  `og:image`/`twitter:image` (bilo je 321 PDP) niti kao slika varijante u
  JSON-LD-u (10 porodica).
- **Automatska zaštita:** `npm run content:check` i `npm run test:content-copy`
  (deo `npm test`) obaraju build ako se vrati šablonski telefon, primer-adresa,
  neformalno obraćanje ili ovaj žargon.

---

## GAP-001 — Telefon centrale

- Status: `POTREBAN ODGOVOR VLASNIKA`
- Prioritet: `BLOCKER`
- Oblast: `kontakt`
- Vidljivost: `javno`
- Putanja: `lib/company-contact.ts`
- Linija ili identifikator: `companyContact.phone`, `companyContact.phoneHref` (linije 61–62)
- Ruta/strana: sve javne strane (footer), `/kontakt`, `/`, svaki `/proizvodi/*`, `/brendovi/*`, `/katalog`
- Komponenta ili polje — potrošači (svi čitaju isti izvor):
  1. `components/layout/Footer.tsx:83` — red telefona u footeru
  2. `components/ui/SplitContactCta.tsx:10` — dugme „Pozovite …"; ga koriste:
     `components/layout/Footer.tsx:55`, `components/product/ProductHero.tsx:81`,
     `components/product/ProductInquiryCard.tsx:42`, `components/brand-program/SupportBand.tsx:28`,
     `components/catalog/CatalogSupportCta.tsx:17`, `components/contact/ContactPage.tsx:63`,
     `components/home/CarsystemHomePage.tsx:520`
  3. `components/contact/ContactInfoCard.tsx:9` — red „Telefon" na `/kontakt`
  4. `components/contact/ContactForm.tsx:224` — dugme „Pozovite" za teme „Tehnička podrška", „B2B saradnja", „Opšti upit"
  5. `components/product/ProductInquiryCard.tsx:32` — red „Telefon" na PDP
  6. `components/home/CarsystemHomePage.tsx:624` — red „Kontakt" na početnoj (bez telefona prikazuje e-poštu)
- Trenutni tekst/vrednost: `null` (ne prikazuje se). Ranije: `+381 22 000 000` / `tel:+38122000000`.
- Zašto nije bezbedno automatski ispraviti: javni izvori daju tri različita broja; nijedan nije sa firminog sajta ni potvrđen od firme.
- Šta je provereno: kod, `docs/seo/SEO_LOCAL_BUSINESS_AUDIT.md` (već beleži broj kao placeholder), firmin BEX adresar (`_incoming/Klijenti.csv`, red firme nema telefon), registar, carsystem.org, keš pretraživača starog sajta `carsystemirm.com/kontakt` (domen danas servira „sajt u pripremi" ovog projekta).
- Pronađeni izvori i konflikt:
  - `+381 22 367 139` — spisak partnera na carsystem.org (`docs/CARSYSTEM_ORG_COMPARATIVE_AUDIT.md:211`)
  - `022/558 501` — keš pretraživača starog sajta i poslovni imenik (isti broj naveden i kao faks)
  - `+381 62 8810895` — agregator kolikajeplata.com (nejasno da li je broj firme)
- Tačno pitanje za vlasnika: Koji broj (ili brojevi) treba da stoje javno kao telefon centrale, i da li je neki od njih mobilni ili poseban broj za tehničku podršku?
- Očekivani format odgovora: broj u obliku `+381 22 123 456` (može više brojeva sa namenom, npr. „centrala", „tehnička podrška").
- Predlog (NEPOTVRĐENO): `+381 22 367 139` jer ga navodi zvaničan spisak partnera proizvođača Carsystem.
- ODGOVOR VLASNIKA: `[upišite ovde]`

## GAP-002 — E-pošta centrale (adresa na koju stižu upiti)

- Status: `POTREBAN ODGOVOR VLASNIKA`
- Prioritet: `BLOCKER`
- Oblast: `kontakt`
- Vidljivost: `javno`
- Putanja: `lib/company-contact.ts`
- Linija ili identifikator: `companyContact.email`, `companyContact.emailHref` (linije 64–65)
- Ruta/strana: footer svih strana, `/kontakt`, `/`
- Komponenta ili polje — potrošači:
  1. `components/layout/Footer.tsx:94` — link e-pošte u footeru
  2. `components/contact/ContactInfoCard.tsx:14` — red „E-pošta" na `/kontakt`
  3. `components/contact/ContactForm.tsx:177` — **forma za upit otvara poruku upravo na ovu adresu**
  4. `components/home/CarsystemHomePage.tsx:627` — red „Kontakt" na početnoj (dok nema telefona)
  5. `scripts/geocode-location-review.mjs:19` — kontakt adresa u zahtevima ka OpenStreetMap geokoderu (nije javni prikaz)
- Trenutni tekst/vrednost: `office@carsystemirm.com` (ostavljena jer forma bez nje ne radi; na domenu firme je, ali nije potvrđeno da sanduče postoji).
- Zašto nije bezbedno automatski ispraviti: četiri različite adrese u izvorima; ako sanduče ne postoji, upiti kupaca se gube bez greške.
- Šta je provereno: kod, `docs/seo/SEO_LOCAL_BUSINESS_AUDIT.md:18` (adresa zabeležena kao placeholder), registar, keš starog sajta.
- Pronađeni izvori i konflikt:
  - `office@carsystemirm.com` — u kodu od početka, bez izvora
  - `carsystemirmdoo@gmail.com` — keš pretraživača starog sajta `carsystemirm.com/kontakt`
  - `eurospektar@blic.net` — registar (pretraga.cubepartner.rs)
  - `info@carsystem-rm.rs` — bila u mrtvom fajlu `components/ContactForm.tsx` (uklonjen; nije se prikazivao)
- Tačno pitanje za vlasnika: Na koju adresu treba da stižu upiti sa sajta, i da li sanduče `office@carsystemirm.com` postoji i da li ga neko čita?
- Očekivani format odgovora: jedna adresa (`ime@domen`), uz „da/ne" da li `office@carsystemirm.com` postoji.
- Predlog (NEPOTVRĐENO): adresa na domenu `carsystemirm.com`, jer je to domen sajta.
- ODGOVOR VLASNIKA: `[upišite ovde]`

## GAP-003 — Objava partnerskih lokacija preuzetih iz BEX adresara

- Status: `POTREBAN ODGOVOR VLASNIKA`
- Prioritet: `BLOCKER`
- Oblast: `drugo` (javni podaci trećih lica)
- Vidljivost: `javno`
- Putanja: `data/store-locations.json`
- Linija ili identifikator: 91 zapis sa `"isPublic": true`; 82 sa `"verificationStatus": "pending"`, 9 `verified`; samo 9 ima telefon
- Ruta/strana: `/prodavnice`, mapa i lista na `/`, „Najbliža prodavnica" na `/kontakt`
- Komponenta ili polje: `components/stores/StoreLocator.tsx`, `components/home/CarsystemHomePage.tsx` (StorePreview), `components/contact/StoreLocatorTeaser.tsx`
- Trenutni tekst/vrednost: 91 naziv i adresa iz BEX kontakata za isporuku, prikazani kao „Prodajna i partnerska mreža".
- Zašto nije bezbedno automatski ispraviti: `docs/LOCATION_IMPORT_WORKFLOW.md` beleži da je ovo „preview import" BEX kontakata za isporuku, prikazan pre komercijalne provere; da li je neko kupac, partner ili prodajno mesto — i da li pristaje da bude javno naveden — zna samo firma.
- Šta je provereno: izvor podataka, status provere po zapisu, tekst lokatora (uklonjeno „interni preview prikaz").
- Pronađeni izvori i konflikt: nema konflikta; nedostaje potvrda.
- Tačno pitanje za vlasnika: Koje od 91 lokacije smeju biti javno prikazane kao prodajna/partnerska mesta pre otvaranja sajta?
- Očekivani format odgovora: „sve 91" / „samo 9 proverenih" / spisak ID-jeva iz `data/store-locations.json` koje treba sakriti ili potvrditi.
- Predlog (NEPOTVRĐENO): do provere javno prikazati samo 9 lokacija sa statusom `verified`.
- ODGOVOR VLASNIKA: `[upišite ovde]`

## GAP-004 — Radno vreme centrale

- Status: `POTREBAN ODGOVOR VLASNIKA`
- Prioritet: `HIGH`
- Oblast: `kontakt`
- Vidljivost: `javno`
- Putanja: `lib/company-contact.ts`
- Linija ili identifikator: `companyContact.workingHours` (linija 67)
- Ruta/strana: footer svih strana, `/kontakt`
- Komponenta ili polje: `components/layout/Footer.tsx:99`, `components/contact/ContactInfoCard.tsx:23` (red „Radno vreme")
- Trenutni tekst/vrednost: `null` (ne prikazuje se). Ranije: `Pon-Pet 08:00-16:00` bez ikakvog izvora.
- Zašto nije bezbedno automatski ispraviti: nijedan izvor (registar, BEX, carsystem.org, keš starog sajta) ne navodi radno vreme.
- Šta je provereno: svi izvori iz GAP-001.
- Pronađeni izvori i konflikt: nema izvora.
- Tačno pitanje za vlasnika: Koje je radno vreme centrale (radni dani, subota, praznici)?
- Očekivani format odgovora: npr. `Pon–Pet 08:00–16:00, Sub 08:00–13:00`.
- Predlog (NEPOTVRĐENO): nema.
- ODGOVOR VLASNIKA: `[upišite ovde]`

## GAP-005 — Zvaničan naziv firme i podaci o pravnom licu na sajtu

- Status: `POTREBAN ODGOVOR VLASNIKA`
- Prioritet: `HIGH`
- Oblast: `pravni podatak`
- Vidljivost: `javno`
- Putanja: `lib/company-contact.ts`, `components/home/CarsystemHomePage.tsx`, `lib/seo.ts`
- Linija ili identifikator: `companyContact.name` (linija 50); naslov `components/home/CarsystemHomePage.tsx:612`; `organizationJsonLd()` `lib/seo.ts:67`
- Ruta/strana: footer svih strana, `/` (blok „Centrala, Inđija"), JSON-LD početne
- Komponenta ili polje: `components/layout/Footer.tsx:81`, naslov kontakt bloka na početnoj, schema.org `Organization`
- Trenutni tekst/vrednost: footer „Carsystem i R-M Inđija"; početna „Carsystem i R-M Inđija d.o.o."; JSON-LD `name: "Carsystem i R-M Inđija"` bez adrese, telefona i e-pošte.
- Zašto nije bezbedno automatski ispraviti: registar vodi naziv „CAR SYSTEM I R-M d.o.o. Inđija"; koji naziv se prikazuje i koje podatke pravnog lica (PIB, matični broj) treba objaviti je odluka firme. Telefon i e-pošta u schema.org čekaju GAP-001 i GAP-002.
- Šta je provereno: registar (cubepartner/APR), BEX red firme, `docs/seo/SEO_LOCAL_BUSINESS_AUDIT.md` (već predviđa dopunu Organization schema posle potvrde).
- Pronađeni izvori i konflikt: „Carsystem i R-M Inđija" (sajt) / „Carsystem i R-M Inđija d.o.o." (početna) / „CAR SYSTEM I R-M d.o.o. Inđija" (registar).
- Tačno pitanje za vlasnika: Koji tačan naziv firme želite na sajtu, i da li u footeru treba prikazati pun pravni naziv sa PIB-om i matičnim brojem?
- Očekivani format odgovora: naziv za prikaz + pun pravni naziv + „da/ne" za PIB i MB u footeru.
- Predlog (NEPOTVRĐENO): prikaz „Carsystem i R-M Inđija", a u footeru pun pravni naziv iz registra.
- ODGOVOR VLASNIKA: `[upišite ovde]`

## GAP-006 — Kako forma za upit šalje poruku

- Status: `POTREBAN ODGOVOR VLASNIKA`
- Prioritet: `MEDIUM`
- Oblast: `CTA`
- Vidljivost: `javno`
- Putanja: `components/contact/ContactForm.tsx`
- Linija ili identifikator: `handleSubmit` (linija 177, `window.location.href = mailto:…`)
- Ruta/strana: `/kontakt` (sve teme upita)
- Komponenta ili polje: dugme „Pripremite upit" i poruka posle slanja
- Trenutni tekst/vrednost: forma otvara program za e-poštu kupca sa pripremljenom porukom; sajt ništa ne šalje sam. Tekst je ispravljen da to pošteno kaže („…odakle je šaljete").
- Zašto nije bezbedno automatski ispraviti: slanje sa servera traži servis za e-poštu (moguć mesečni trošak — pravilo `COST_CONTROL.md`) i potvrđenu adresu (GAP-002).
- Šta je provereno: nema API rute ni servisa za e-poštu u projektu.
- Pronađeni izvori i konflikt: nema.
- Tačno pitanje za vlasnika: Da li je prihvatljivo da upit ide kroz program za e-poštu kupca, ili želite da sajt sam šalje poruku (uz izbor servisa i eventualni trošak)?
- Očekivani format odgovora: „ostaje kako jeste" ili „sajt šalje sam" + odobren servis.
- Predlog (NEPOTVRĐENO): zadržati sadašnji način do otvaranja sajta.
- ODGOVOR VLASNIKA: `[upišite ovde]`

## GAP-007 — Interne demo strane dostupne na javnom domenu

- Status: `POTREBAN ODGOVOR VLASNIKA`
- Prioritet: `MEDIUM`
- Oblast: `drugo`
- Vidljivost: `javno`
- Putanja: `app/interaction-demo/**` (17 ruta), `app/social-exports/**` (3 rute), `middleware.ts:105-116`
- Linija ili identifikator: `shouldNoindexInternalRoute()` — rute dobijaju samo `noindex`, ne i zabranu pristupa
- Ruta/strana: npr. `/interaction-demo/cursor-states`, `/interaction-demo/split-contact-cta`, `/social-exports/spray-reveal`
- Komponenta ili polje: `components/interaction-demo/**`, `components/social-exports/**`
- Trenutni tekst/vrednost: razvojne demonstracije sa neformalnim i engleskim tekstom (npr. „Pređi mišem preko elemenata ispod da vidiš…", dugme „CALL US").
- Zašto nije bezbedno automatski ispraviti: uklanjanje ili zaključavanje ruta menja rutiranje/infrastrukturu, što je van ovog kruga; tekst nije prepravljan jer strane nisu namenjene kupcima. Čuvar teksta ih preskače sa pozivom na ovu stavku.
- Šta je provereno: middleware, prerenderovani HTML, da nijedna javna strana ne linkuje na ove rute.
- Pronađeni izvori i konflikt: nema.
- Tačno pitanje za vlasnika: Da li `/interaction-demo/*` i `/social-exports/*` treba da budu nedostupni na produkcionom domenu?
- Očekivani format odgovora: „zatvoriti u produkciji" / „ostaviti".
- Predlog (NEPOTVRĐENO): zatvoriti u produkciji (posebna izmena middleware-a).
- ODGOVOR VLASNIKA: `[upišite ovde]`

## GAP-008 — Neprevedena tehnička uputstva iz tehničkih listova (TDS)

- Status: `POTREBAN ODGOVOR VLASNIKA`
- Prioritet: `MEDIUM`
- Oblast: `tekst`
- Vidljivost: `javno`
- Putanja (generisani izvori iz sync-a proizvođača; menjaju se samo kroz sync, ne ručno):
  - `data/norbin-sync/source-products.generated.json:542, 641, 762, 834, 2510`
  - `data/baslac-sync/source-products.generated.json:2172`
  - `data/rm-sync/source-products.generated.json:12118, 12205`
- Linija ili identifikator: tehnička polja proizvoda (`value`, `flashOff`, sušenje)
- Ruta/strana (6):
  - `/proizvodi/norbin-n15-v20-clear-voc`, `/proizvodi/norbin-n15-v25-fast-clear-voc`, `/proizvodi/norbin-n60-v20-multifunctional-body-filler-hardener`
  - `/proizvodi/baslac-40-620-2k-clear-mat-voc`
  - `/proizvodi/rm-onyx-hd`, `/proizvodi/rm-onyx-hd-tropical`
- Komponenta ili polje: tehnički podaci na PDP
- Trenutni tekst/vrednost:
  - „The VOC content of this product is 419 g/l (249 g/l). It cannot be ruled out that this product contains particles < 0.1 μm."
  - „Flash off until completely mat after the first spray coat and before drying. Do not flash off for more than 25 min."
  - „20°C: 15 min Possibility to speed up the process · 40°C: 10 min"
- Zašto nije bezbedno automatski ispraviti: to su regulatorni i tehnički iskazi proizvođača; prevod menja tvrdnju i mora ga odobriti stručno lice. Izvori su generisani sync-om proizvođača (van ovog kruga).
- Šta je provereno: renderovani HTML svih 2015 prerenderovanih strana; ostali engleski tekst su zvanični nazivi proizvoda (SATA, baslac), što je postojeća politika kataloga.
- Pronađeni izvori i konflikt: nema.
- Tačno pitanje za vlasnika: Da li ove rečenice treba prevesti na srpski (i ko odobrava prevod), ili ostaju na engleskom kao citat iz TDS-a?
- Očekivani format odgovora: „prevesti — odobrava [ime/uloga]" ili „ostaje original".
- Predlog (NEPOTVRĐENO): „Sadržaj VOC ovog proizvoda je 419 g/l. Ne može se isključiti da proizvod sadrži čestice manje od 0,1 μm."
- ODGOVOR VLASNIKA: `[upišite ovde]`

## GAP-009 — Kartica „Video materijali" na Carsystem strani

- Status: `POTREBAN ODGOVOR VLASNIKA`
- Prioritet: `LOW`
- Oblast: `tekst`
- Vidljivost: `javno`
- Putanja: `components/carsystem-brand/carsystemBrandData.ts`
- Linija ili identifikator: `id: "video"` (linija 706)
- Ruta/strana: `/brendovi/carsystem`
- Komponenta ili polje: kartica u bloku dokumentacije
- Trenutni tekst/vrednost: „Video materijali — Video materijali za Carsystem program još nisu objavljeni. · U pripremi" (ranije: „Centralni javni video resurs još nije povezan.")
- Zašto nije bezbedno automatski ispraviti: da li video postoji i gde se objavljuje (ili da kartica nestane) je odluka sadržaja; uklanjanje kartice menja raspored strane.
- Šta je provereno: kartica nema link; `docs/CONTENT_ASSET_GAP_AUDIT.md:714` (C07) beleži isto.
- Pronađeni izvori i konflikt: nema.
- Tačno pitanje za vlasnika: Imate li video materijale za Carsystem program koje treba povezati, ili karticu treba ukloniti?
- Očekivani format odgovora: link(ovi) ka videu ili „ukloniti karticu".
- Predlog (NEPOTVRĐENO): ukloniti karticu dok video ne postoji.
- ODGOVOR VLASNIKA: `[upišite ovde]`

## GAP-010 — Tačka centrale na mapi

- Status: `POTREBAN ODGOVOR VLASNIKA`
- Prioritet: `LOW`
- Oblast: `kontakt`
- Vidljivost: `javno`
- Putanja: `lib/company-contact.ts`
- Linija ili identifikator: `companyLocation.coordinates` (linija 45)
- Ruta/strana: mapa centrale na `/` i `/kontakt` (`components/map/CompanyLocationMap.tsx`)
- Komponenta ili polje: marker „Centrala · Inđija"
- Trenutni tekst/vrednost: `45.0482, 20.0817` — centar grada, ne adresa.
- Zašto nije bezbedno automatski ispraviti: jedina tačka za Ive Andrića 3 je automatsko geokodiranje (`45.0496189, 20.0654391`, status `geocoded_preview` u `data/store-locations.json`), nepotvrđeno.
- Šta je provereno: adresa (potvrđena, vidi rezime), geokod iz BEX uvoza.
- Pronađeni izvori i konflikt: centar grada vs. geokod adrese.
- Tačno pitanje za vlasnika: Da li je ulaz/magacin na Ive Andrića 3 na tački `45.0496189, 20.0654391`?
- Očekivani format odgovora: „da" ili tačne koordinate / link sa mape.
- Predlog (NEPOTVRĐENO): koristiti geokod adrese posle Vaše potvrde.
- ODGOVOR VLASNIKA: `[upišite ovde]`

## GAP-011 — Oznake projektnih faza („faza 2–5") na ekranima portala

- Status: `POTREBAN ODGOVOR VLASNIKA`
- Prioritet: `LOW`
- Oblast: `portal`
- Vidljivost: `komercijalista`, `vlasnik/admin`
- Putanja (23 mesta): `app/portal/admin/page.tsx:41-45`, `app/portal/adresnice/page.tsx:24`, `app/portal/bex/page.tsx:24`, `app/portal/dugovanja/page.tsx:23`, `app/portal/izvestaji/page.tsx:22-24`, `app/portal/kupci/[id]/page.tsx:43-46`, `app/portal/limiti/page.tsx:22-25`, `app/portal/nabavka/page.tsx:22-25`, `app/portal/otprema/page.tsx:24-26`, `app/portal/page.tsx:87`, `app/portal/porudzbine/page.tsx:22-25`, `app/portal/zalihe/page.tsx:22-26`, `components/portal/PortalShell.tsx:291`
- Linija ili identifikator: `phase="faza N"` i spiskovi preduslova „(faza N)"
- Ruta/strana: ekrani portala za module koji još nisu povezani (Dugovanja, Limiti, Nabavka, Otprema, BEX, Zalihe…)
- Komponenta ili polje: najava modula i spisak preduslova
- Trenutni tekst/vrednost: npr. „Uvoz faktura iz BiznisSoft izvoza (faza 2) — bez njega nema nijednog prodajnog podatka."
- Zašto nije bezbedno automatski ispraviti: brojevi faza su iz plana projekta (`docs/b2b`); da li ih zaposleni treba da vide ili ih zameniti opisom je odluka vlasnika. Tekst je inače tačan i ne obećava ništa netačno.
- Šta je provereno: sva 23 pojavljivanja; nijedno nije vidljivo kupcu.
- Pronađeni izvori i konflikt: nema.
- Tačno pitanje za vlasnika: Da li komercijalisti treba da vide oznake „faza N", ili ih zameniti opisom (npr. „posle povezivanja BiznisSoft izvoza")?
- Očekivani format odgovora: „zadržati" / „zameniti opisom".
- Predlog (NEPOTVRĐENO): zameniti opisom preduslova.
- ODGOVOR VLASNIKA: `[upišite ovde]`

## GAP-012 — Naziv uloge „Gazda" u portalu

- Status: `POTREBAN ODGOVOR VLASNIKA`
- Prioritet: `LOW`
- Oblast: `portal`
- Vidljivost: `komercijalista`, `vlasnik/admin`
- Putanja: `lib/authz/permissions.mjs`
- Linija ili identifikator: `{ key: "gazda", label: "Gazda" }` (linije 144, 151); tekst se ponavlja na 17 mesta u 11 fajlova (npr. `app/portal/forbidden.tsx:17`, `app/portal/nemate-pristup/page.tsx:17`, `app/portal/kupci/page.tsx:106`, `app/portal/limiti/page.tsx:20-23`, `app/portal/page.tsx:41`)
- Ruta/strana: `/portal`, `/portal/nemate-pristup`, `/portal/dozvole`, `/portal/limiti`
- Komponenta ili polje: naziv uloge i poruke „zatražite ga od Gazde"
- Trenutni tekst/vrednost: „Gazda"
- Zašto nije bezbedno automatski ispraviti: naziv je deo modela uloga (van ovog kruga); kolokvijalan je, ali može biti namerna odluka firme.
- Šta je provereno: svi potrošači; kupcu se ne prikazuje.
- Pronađeni izvori i konflikt: nema.
- Tačno pitanje za vlasnika: Da li zaposleni treba da vide naziv uloge „Gazda" ili, na primer, „Vlasnik"?
- Očekivani format odgovora: željeni naziv uloge.
- Predlog (NEPOTVRĐENO): „Vlasnik".
- ODGOVOR VLASNIKA: `[upišite ovde]`

## GAP-013 — Formulacija glavnog CTA u CLAUDE.md

- Status: `POTREBAN ODGOVOR VLASNIKA`
- Prioritet: `LOW`
- Oblast: `CTA`
- Vidljivost: `javno` (posredno — CLAUDE.md usmerava buduće izmene sajta)
- Putanja: `CLAUDE.md`
- Linija ili identifikator: linija 15 („Primary public CTA")
- Ruta/strana: svi pozivi „Pronađite najbližu prodavnicu" (početna, brend strane, sezonske kampanje)
- Komponenta ili polje: tekst glavnog CTA
- Trenutni tekst/vrednost: CLAUDE.md propisuje „Pronađi najbližu prodavnicu"; sajt sada svuda koristi „Pronađite najbližu prodavnicu" (pravilo persiranja).
- Zašto nije bezbedno automatski ispraviti: CLAUDE.md je projektno pravilo vlasnika; ovaj krug ne menja dokumentaciju koja nije korisnički tekst.
- Šta je provereno: sva 24 pojavljivanja CTA „Pronađite (najbližu) prodavnicu" u kodu; čuvar teksta bi oborio build ako se vrati neformalni oblik.
- Pronađeni izvori i konflikt: CLAUDE.md vs. pravilo persiranja.
- Tačno pitanje za vlasnika: Da li u CLAUDE.md ažurirati glavni CTA na „Pronađite najbližu prodavnicu"?
- Očekivani format odgovora: „da" / „ne".
- Predlog (NEPOTVRĐENO): „da".
- ODGOVOR VLASNIKA: `[upišite ovde]`
