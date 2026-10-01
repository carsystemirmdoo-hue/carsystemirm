# Sadržaj — odluke vlasnika i preostale preporuke

Dokument nastao posle provere sadržaja, kontakt podataka, placeholder tekstova i
obraćanja korisniku (2026-10-01, grana `chore/content-qa-2026-10`, polazni
`origin/main` = `f1bd389`). Sve stavke su rešene odlukom vlasnika, javnim
izvorom ili bezbednim pravilom projekta; dokazi i istorija pitanja su sačuvani.

## Rezime

**Nema otvorenih pitanja koja blokiraju Production.**

| Status | Stavke |
|---|---|
| `RESOLVED_BY_OWNER_CONFIRMATION` | GAP-001, 002, 005, 009 (prevodi i tri ispravke primenjeni 2026-10-01), 012, 013, 014 |
| `RESOLVED_FROM_PUBLIC_SOURCES` | GAP-010, 011 |
| `RESOLVED_BY_SAFE_PROJECT_POLICY` | GAP-003, 004 (`SAFE_DEFAULT_APPLIED`), 007, 008 |
| `DEFERRED_NON_PUBLIC_DATA` | naknadna provera 82 neproverene lokacije (GAP-003) — `docs/locations/UNVERIFIED_LOCATIONS_FOLLOW_UP.md` |
| `ADVISORY_REVIEW_RECOMMENDED` | GAP-006 (pravna revizija teksta saglasnosti); GAP-009 — novi nalaz parsiranja baslac 40-440/40-450 (sušenje bez vremena) čeka odobrenje |

Statusne oznake: `RESOLVED_BY_OWNER_CONFIRMATION` — direktna odluka ili potvrda
firme; `RESOLVED_FROM_PUBLIC_SOURCES` — dva saglasna javna izvora ili zvaničan
izvor; `RESOLVED_BY_SAFE_PROJECT_POLICY` — primenjeno bezbedno pravilo bez
pretpostavki; `DEFERRED_NON_PUBLIC_DATA` — provera podataka koji nisu javni, ne
blokira; `ADVISORY_REVIEW_RECOMMENDED` — urađeno, preporučen stručni/pravni pregled.

### Matrica dokaza (online provera, 2026-10-01)

| Stavka | Status | Najjači pronađeni dokaz | Dokaz (pre odluke) |
|---|---|---|---|
| GAP-001 Telefon | RESOLVED_BY_OWNER_CONFIRMATION | Direktna potvrda firme: 022 558 501 + tri regionalna broja | Da — potvrda firme |
| GAP-002 E-pošta | RESOLVED_BY_OWNER_CONFIRMATION | Direktna potvrda firme: carsystemirmdoo@gmail.com | Da — potvrda firme |
| GAP-003 BEX lokacije | RESOLVED_BY_SAFE_PROJECT_POLICY | Nema javnog izvora za 82 `pending` lokacije | Ne — pristanak i status zna samo firma |
| GAP-004 Radno vreme | RESOLVED_BY_SAFE_PROJECT_POLICY | Nijedan imenik ni registar ne navodi radno vreme | Ne |
| GAP-005 Naziv firme | RESOLVED_BY_OWNER_CONFIRMATION | Registar: „CAR SYSTEM I R-M d.o.o. Inđija" (pun i skraćen naziv) | Delimično — pravni naziv je jasan; oblik za prikaz i objava PIB/MB su odluka |
| GAP-006 Saglasnost | ADVISORY_REVIEW_RECOMMENDED | ZZPL čl. 15 (opoziv jednako jednostavan kao pristanak) | Ne — nova verzija teksta traži odobrenje |
| GAP-007 Slanje forme | RESOLVED_BY_SAFE_PROJECT_POLICY | Nema API rute ni servisa; potvrđeno sanduče je Gmail | Ne — poslovna i troškovna odluka |
| GAP-008 Demo rute | RESOLVED_BY_SAFE_PROJECT_POLICY | Produkcija danas: 307 → maintenance | Ne — odluka pre otvaranja sajta |
| GAP-009 TDS na engleskom | RESOLVED_BY_OWNER_CONFIRMATION | Zvanični TDS samo EN (baslac i DE); srpska verzija ne postoji | Ne — prevod mora odobriti stručno lice |
| GAP-010 Video kartica | RESOLVED_FROM_PUBLIC_SOURCES | Zvaničan kanal `youtube.com/carsystem_refinish` (link sa carsystem.org) | Delimično — kandidat postoji, izbor je odluka |
| GAP-011 Tačka na mapi | RESOLVED_FROM_PUBLIC_SOURCES | OSM zgrada (way 799359269) na 45.0496189, 20.0654391 = BEX geokod | Skoro — dva nezavisna izvora; potrebna potvrda ulaza |
| GAP-012 „faza N" | RESOLVED_BY_OWNER_CONFIRMATION | — (interno) | Ne |
| GAP-013 „Gazda" | RESOLVED_BY_OWNER_CONFIRMATION | — (interno) | Ne |
| GAP-014 CTA u CLAUDE.md | RESOLVED_BY_OWNER_CONFIRMATION | — (projektno pravilo) | Ne |

### Šta je već ispravljeno bez Vašeg odgovora

- **Lažni telefon `+381 22 000 000` uklonjen.** Stajao je kao klikabilan
  `tel:` link na 1233 prerenderovane strane (footer, kontakt, početna, svaki
  PDP, brend strane). Posle potvrde firme (GAP-001) na svim tim mestima stoji
  telefon kancelarije `022 558 501` (`tel:+38122558501`).
- **Potvrđeni kontakti firme (2026-10-01):** glavna e-pošta
  `carsystemirmdoo@gmail.com` (footer, `/kontakt`, forma za upit, schema.org);
  regionalni komercijalisti samo na `/kontakt` (Vojvodina 061 168 8472,
  Centralna Srbija 069 333 7401, Južna Srbija 063 157 8270), bez imena.
  `office@carsystemirm.com` je uklonjen iz runtime-a. schema.org
  `Organization` sada nosi adresu, telefon kancelarije, e-poštu i
  `contactPoint` za kancelariju i tri regiona.
- **`tel:` za partnerske lokacije ispravljen:** polje sa dva broja
  („011 386 33 60 / 063 528 477") davalo je jedan spojen, neispravan link;
  sada je link prvi broj u međunarodnom obliku.
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
  nepotvrđen kontakt (`office@carsystemirm.com`, `info@carsystem-rm.rs`,
  `eurospektar@blic.net`, 022 367 139, 062 881 0895), `tel:` van međunarodnog
  oblika, neformalno obraćanje ili ovaj žargon. Posle builda
  `npm run content:check:html` isto proverava u prerenderovanom HTML-u.

---

## GAP-001 — Telefon centrale

- Status: `RESOLVED_BY_OWNER_CONFIRMATION`
- Prioritet: `BLOCKER`
- Oblast: `kontakt`
- Vidljivost: `javno`
- Putanja: `lib/company-contact.ts`
- Linija ili identifikator: `companyContact.phone`, `companyContact.phoneInternational`, `companyContact.phoneHref` (linije 93–95); `companyContact.salesContacts` (linija 103)
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
- Trenutni tekst/vrednost: `022 558 501` / `tel:+38122558501` (kancelarija, glavni broj svuda). Ranije: `+381 22 000 000` / `tel:+38122000000`, pa `null` do potvrde.
- Zašto nije bezbedno automatski ispraviti: javni izvori daju tri različita broja; nijedan nije sa firminog sajta ni potvrđen od firme.
- Šta je provereno: kod, `docs/seo/SEO_LOCAL_BUSINESS_AUDIT.md` (već beleži broj kao placeholder), firmin BEX adresar (`_incoming/Klijenti.csv`, red firme nema telefon), registar, carsystem.org, keš pretraživača starog sajta `carsystemirm.com/kontakt` (domen danas servira „sajt u pripremi" ovog projekta).
- Pronađeni izvori i konflikt:
  - `+381 22 367 139` — spisak partnera na carsystem.org (`docs/CARSYSTEM_ORG_COMPARATIVE_AUDIT.md:211`)
  - `022/558 501` — keš pretraživača starog sajta i poslovni imenik (isti broj naveden i kao faks)
  - `+381 62 8810895` — agregator kolikajeplata.com (nejasno da li je broj firme)
- Prvobitno pitanje (istorija): Koji broj (ili brojevi) treba da stoje javno kao telefon centrale, i da li je neki od njih mobilni ili poseban broj za tehničku podršku?
- Očekivani format odgovora: broj u obliku `+381 22 123 456` (može više brojeva sa namenom, npr. „centrala", „tehnička podrška").
- Prvobitni predlog (istorija): `+381 22 367 139` jer ga navodi zvaničan spisak partnera proizvođača Carsystem.
- Odluka i primena (2026-10-01): Direktna potvrda firme (2026-10-01), ima prednost nad svim javnim izvorima:
  - telefon kancelarije: `022 558 501` / `+381 22 558 501` / `tel:+38122558501` — glavni broj na footeru, `/kontakt`, početnoj, PDP, brend stranama, katalogu i u glavnim CTA dugmadima;
  - komercijalista za Vojvodinu: `061 168 8472` / `+381 61 168 8472` / `tel:+381611688472`;
  - komercijalista za Centralnu Srbiju: `069 333 7401` / `+381 69 333 7401` / `tel:+381693337401`;
  - komercijalista za Južnu Srbiju: `063 157 8270` / `+381 63 157 8270` / `tel:+381631578270`;
  - regionalni brojevi samo na `/kontakt` (blok „03 · Komercijalisti po regionima"), bez imena komercijalista; nisu dodeljeni prodavnicama jer nema proverene regionalne klasifikacije lokacija.
  Kandidati `+381 22 367 139` i `+381 62 8810895` nisu potvrđeni i čuvar ih odbija.

## GAP-002 — E-pošta centrale (adresa na koju stižu upiti)

- Status: `RESOLVED_BY_OWNER_CONFIRMATION`
- Prioritet: `BLOCKER`
- Oblast: `kontakt`
- Vidljivost: `javno`
- Putanja: `lib/company-contact.ts`
- Linija ili identifikator: `companyContact.email`, `companyContact.emailHref` (linije 97–98)
- Ruta/strana: footer svih strana, `/kontakt`, `/`
- Komponenta ili polje — potrošači:
  1. `components/layout/Footer.tsx:94` — link e-pošte u footeru
  2. `components/contact/ContactInfoCard.tsx:14` — red „E-pošta" na `/kontakt`
  3. `components/contact/ContactForm.tsx:177` — **forma za upit otvara poruku upravo na ovu adresu**
  4. `components/home/CarsystemHomePage.tsx:627` — red „Kontakt" na početnoj (dok nema telefona)
  5. `scripts/geocode-location-review.mjs:19` — kontakt adresa u zahtevima ka OpenStreetMap geokoderu (nije javni prikaz)
- Trenutni tekst/vrednost: `carsystemirmdoo@gmail.com` / `mailto:carsystemirmdoo@gmail.com` (footer, `/kontakt`, forma za upit, schema.org, korisnički agent geokodera). Ranije: `office@carsystemirm.com`, sada uklonjen iz runtime-a.
- Zašto nije bezbedno automatski ispraviti: četiri različite adrese u izvorima; ako sanduče ne postoji, upiti kupaca se gube bez greške.
- Šta je provereno: kod, `docs/seo/SEO_LOCAL_BUSINESS_AUDIT.md:18` (adresa zabeležena kao placeholder), registar, keš starog sajta.
- Pronađeni izvori i konflikt:
  - `office@carsystemirm.com` — u kodu od početka, bez izvora
  - `carsystemirmdoo@gmail.com` — keš pretraživača starog sajta `carsystemirm.com/kontakt`
  - `eurospektar@blic.net` — registar (pretraga.cubepartner.rs)
  - `info@carsystem-rm.rs` — bila u mrtvom fajlu `components/ContactForm.tsx` (uklonjen; nije se prikazivao)
- Prvobitno pitanje (istorija): Na koju adresu treba da stižu upiti sa sajta, i da li sanduče `office@carsystemirm.com` postoji i da li ga neko čita?
- Očekivani format odgovora: jedna adresa (`ime@domen`), uz „da/ne" da li `office@carsystemirm.com` postoji.
- Prvobitni predlog (istorija): adresa na domenu `carsystemirm.com`, jer je to domen sajta.
- Odluka i primena (2026-10-01): Direktna potvrda firme (2026-10-01): glavna e-pošta je `carsystemirmdoo@gmail.com` (`mailto:carsystemirmdoo@gmail.com`) za sva glavna `mailto:` mesta i formu za upit. `office@carsystemirm.com` se ne koristi ni kao prikaz, ni kao primalac, ni kao rezerva, ni u schema.org; `info@carsystem-rm.rs` i `eurospektar@blic.net` takođe nisu kontakt.

## GAP-003 — Objava partnerskih lokacija preuzetih iz BEX adresara

- Status: `RESOLVED_BY_SAFE_PROJECT_POLICY`
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
- Online dokazi (2026-10-01): Zvanični pretraživač partnera na carsystem.org nije dostupan na poznatim adresama (`/en/partner-search`, `/en/partners`: 404); raniji audit (`docs/CARSYSTEM_ORG_COMPARATIVE_AUDIT.md:211`) za Srbiju beleži samo centralu. Nijedan javni izvor ne potvrđuje 82 lokacije sa statusom `pending`.
- Prvobitno pitanje (istorija): Koje od 91 lokacije smeju biti javno prikazane kao prodajna/partnerska mesta pre otvaranja sajta?
- Očekivani format odgovora: „sve 91" / „samo 9 proverenih" / spisak ID-jeva iz `data/store-locations.json` koje treba sakriti ili potvrditi.
- Prvobitni predlog (istorija): do provere javno prikazati samo 9 lokacija sa statusom `verified`.
- Odluka i primena (2026-10-01): Odluka vlasnika (2026-10-01): javno se prikazuje samo 9 lokacija sa `verificationStatus: "verified"`; 82 zapisa `pending` se ne prikazuju kao prodavnice ni partneri i ostaju u izvoru. Primenjeno: `isPubliclyListedStore()` u `lib/partner-stores.ts` (svi javni potrošači i LocalBusiness JSON-LD). Naknadna provera 82 zapisa: `docs/locations/UNVERIFIED_LOCATIONS_FOLLOW_UP.md` (`DEFERRED_NON_PUBLIC_DATA`, ne blokira otvaranje sajta). Među njima je i sama centrala, koja više nije prikazana kao „partner".

## GAP-004 — Radno vreme centrale

- Status: `RESOLVED_BY_SAFE_PROJECT_POLICY`
- Prioritet: `HIGH`
- Oblast: `kontakt`
- Vidljivost: `javno`
- Putanja: `lib/company-contact.ts`
- Linija ili identifikator: `companyContact.workingHours` (linija 100)
- Ruta/strana: footer svih strana, `/kontakt`
- Komponenta ili polje: `components/layout/Footer.tsx:99`, `components/contact/ContactInfoCard.tsx:23` (red „Radno vreme")
- Trenutni tekst/vrednost: `null` (ne prikazuje se). Ranije: `Pon-Pet 08:00-16:00` bez ikakvog izvora.
- Zašto nije bezbedno automatski ispraviti: nijedan izvor (registar, BEX, carsystem.org, keš starog sajta) ne navodi radno vreme.
- Šta je provereno: svi izvori iz GAP-001.
- Pronađeni izvori i konflikt: nema izvora.
- Online dokazi (2026-10-01): Nijedan javni izvor ne navodi radno vreme: poslovnivodic.com (unos „CAR SYSTEM I R-M", Ive Andrića 3, +381 22 558 501 — bez radnog vremena), pretraga.cubepartner.rs, kolikajeplata.com, pretraga veba „Car System Inđija radno vreme".
- Prvobitno pitanje (istorija): Koje je radno vreme centrale (radni dani, subota, praznici)?
- Očekivani format odgovora: npr. `Pon–Pet 08:00–16:00, Sub 08:00–13:00`.
- Prvobitni predlog (istorija): nema.
- Odluka i primena (2026-10-01): `SAFE_DEFAULT_APPLIED`: nijedan pouzdan javni izvor ne navodi radno vreme, pa `workingHours` ostaje `null` i radno vreme se nigde ne prikazuje; pretpostavljeno „Pon–Pet 08:00–16:00" se ne koristi. Kada firma dostavi radno vreme, upisuje se u `lib/company-contact.ts` i automatski se prikazuje u footeru i na `/kontakt`.

## GAP-005 — Zvaničan naziv firme i podaci o pravnom licu na sajtu

- Status: `RESOLVED_BY_OWNER_CONFIRMATION`
- Prioritet: `HIGH`
- Oblast: `pravni podatak`
- Vidljivost: `javno`, `kupac`, `komercijalista`, `vlasnik/admin`
- Putanja i linija — svi potrošači (tri različita oblika naziva):
  - „Carsystem i R-M Inđija": `lib/company-contact.ts:84` (`companyContact.name`, footer `components/layout/Footer.tsx:81`), `lib/seo.ts:67` (`organizationJsonLd`; adresa, telefon i e-pošta su dodati posle potvrde, naziv čeka ovu stavku)
  - „Carsystem i R-M Inđija d.o.o.": `components/home/CarsystemHomePage.tsx:612` (naslov bloka „Centrala, Inđija" na `/`), `app/portal/layout.tsx:22` (metadata portala), `lib/customers/consent.mjs:35` (tekst saglasnosti — vidi GAP-006)
  - „Carsystem i R-M DOO": `features/portal/PortalLoginForm.tsx:28, 57` (`/prijava`), `app/prijava/kupac/CustomerLoginForm.tsx:37, 66` (`/prijava/kupac`), `app/prijava/reset/ResetForm.tsx:41, 71, 94` (`/prijava/reset`), `components/portal/PortalShell.tsx:65` (oznaka u portalu), `components/carsystem-brand/carsystemBrandData.ts:245, 816` (`/brendovi/carsystem`)
- Ruta/strana: footer svih strana, `/`, `/brendovi/carsystem`, `/prijava`, `/prijava/kupac`, `/prijava/reset`, portal, JSON-LD početne
- Komponenta ili polje: naziv firme u tekstu, oznakama i schema.org `Organization`
- Trenutni tekst/vrednost: tri oblika navedena gore.
- Zašto nije bezbedno automatski ispraviti: registar vodi naziv „CAR SYSTEM I R-M d.o.o. Inđija"; koji oblik se prikazuje i koje podatke pravnog lica (PIB, matični broj) treba objaviti je odluka firme. Telefon, e-pošta i adresa su u schema.org dodati posle GAP-001 i GAP-002.
- Šta je provereno: registar (cubepartner/APR), BEX red firme, `docs/seo/SEO_LOCAL_BUSINESS_AUDIT.md` (već predviđa dopunu Organization schema posle potvrde), svih 13 pojavljivanja u kodu.
- Pronađeni izvori i konflikt: „Carsystem i R-M Inđija" / „Carsystem i R-M Inđija d.o.o." / „Carsystem i R-M DOO" (sajt) vs. „CAR SYSTEM I R-M d.o.o. Inđija" (registar).
- Online dokazi (2026-10-01): Registar (pretraga.pkspartner.rs → cubepartner.rs, podaci iz APR-a): poslovno ime i skraćeno poslovno ime „CAR SYSTEM I R-M d.o.o. Inđija", adresa Ive Andrića 3, Inđija, osnovano 2009-03-05, status aktivno. Nijedan izvor ne koristi oblik „Carsystem i R-M DOO".
- Prvobitno pitanje (istorija): Koji tačan naziv firme želite na sajtu i u portalu, i da li u footeru treba prikazati pun pravni naziv sa PIB-om i matičnim brojem?
- Očekivani format odgovora: naziv za prikaz + pun pravni naziv + „da/ne" za PIB i MB u footeru.
- Prvobitni predlog (istorija): prikaz „Carsystem i R-M Inđija" svuda, a pun pravni naziv iz registra u footeru i u tekstu saglasnosti.
- Odluka i primena (2026-10-01): Odluka vlasnika (2026-10-01): brend/korisnički naziv „Carsystem i R-M" (header, marketing, kratke oznake, login, portal, schema.org `name`); pun pravni naziv „CAR SYSTEM I R-M d.o.o. Inđija" (pravni red u footeru, saglasnost, schema.org `legalName`); PIB 105988852, MB 20506610, adresa Ive Andrića 3, 22320 Inđija, Srbija. Primenjeno: `companyContact.name/legalName/pib/mb`, `seoSiteConfig.name/legalName`, pravni red u footeru („© godina · pun naziv · PIB · MB · adresa"), schema.org `taxID` i `identifier`. Oblici „Carsystem i R-M DOO" i „Carsystem i R-M Inđija d.o.o." uklonjeni (čuvar ih odbija; izuzetak je samo istorijski tekst saglasnosti v1).

## GAP-006 — Tekst saglasnosti kupca za obaveštenja e-poštom

- Status: `ADVISORY_REVIEW_RECOMMENDED`
- Prioritet: `MEDIUM`
- Oblast: `pravni podatak`
- Vidljivost: `kupac`
- Putanja: `lib/customers/consent.mjs`
- Linija ili identifikator: `CONSENT_LABELS.email_marketing.body` (linije 33–36), verzija `CURRENT_CONSENT_TEXT_VERSION = "2026-08-v1"` (linija 29)
- Ruta/strana: `/kupac/saglasnosti`; evidentiranje saglasnosti u `/portal/kupci/nalozi`
- Komponenta ili polje: `app/kupac/saglasnosti/ConsentControls.tsx`
- Trenutni tekst/vrednost: „Pristajem da mi Carsystem i R-M Inđija d.o.o. šalje obaveštenja o proizvodima, akcijama i tehničkim novostima na moju poslovnu e-poštu. Saglasnost mogu povući u bilo kom trenutku, jednako lako kao što sam je dao."
- Zašto nije bezbedno automatski ispraviti: tekst je verzionisan i evidentira se uz svaku datu saglasnost; svaka izmena traži novu verziju i pravnu proveru. Dva otvorena pitanja: tačan naziv pravnog lica (GAP-005) i rodno obeležen oblik „dao" u izjavi koju daje i korisnica.
- Šta je provereno: konstanta verzije, potrošači teksta.
- Pronađeni izvori i konflikt: naziv u tekstu se razlikuje od registra (GAP-005).
- Online dokazi (2026-10-01): Zakon o zaštiti podataka o ličnosti („Sl. glasnik RS", br. 87/2018), član 15: opoziv pristanka mora biti jednako jednostavan kao davanje pristanka — postojeći tekst to već kaže; otvoreni su samo naziv pravnog lica i rodno obeležen oblik.
- Prvobitno pitanje (istorija): Da li odobravate novu verziju teksta saglasnosti sa tačnim nazivom pravnog lica i rodno neutralnim završetkom?
- Očekivani format odgovora: „da" uz konačan tekst, ili „ne".
- Prvobitni predlog (istorija): „Pristajem da mi CAR SYSTEM I R-M d.o.o. Inđija šalje obaveštenja o proizvodima, akcijama i tehničkim novostima na moju poslovnu e-poštu. Saglasnost mogu povući u bilo kom trenutku, jednako lako kao što je data." (verzija `2026-10-v2`)
- Odluka i primena (2026-10-01): Odluka vlasnika (2026-10-01): nova verzija `2026-10-v2`, latinicom kao portal: „Pristajem da mi CAR SYSTEM I R-M d.o.o. Inđija na moju poslovnu e-poštu šalje obaveštenja o proizvodima, akcijama i tehničkim novostima. Saglasnost je dobrovoljna i mogu je povući u bilo kom trenutku, jednako jednostavno kao što je data." Primenjeno: `CONSENT_TEXT_VERSIONS` čuva `2026-08-v1` doslovno; nove odluke se upisuju sa `2026-10-v2`; ekran prikazuje tekst one verzije uz koju je saglasnost data. Testovi prelaza u `lib/customers/consent.test.mjs`. Preporučena je naknadna pravna revizija teksta — nije tehnička prepreka.

## GAP-007 — Kako forma za upit šalje poruku

- Status: `RESOLVED_BY_SAFE_PROJECT_POLICY`
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
- Online dokazi (2026-10-01): Nema javnog dokaza koji bi rešio stavku — to je poslovna odluka. Napomena: potvrđeno sanduče je Gmail adresa; slanje sa servera zahtevalo bi poseban servis ili nalog za slanje (pristupni podaci firme), što ovaj krug ne uvodi.
- Prvobitno pitanje (istorija): Da li je prihvatljivo da upit ide kroz program za e-poštu kupca, ili želite da sajt sam šalje poruku (uz izbor servisa i eventualni trošak)?
- Očekivani format odgovora: „ostaje kako jeste" ili „sajt šalje sam" + odobren servis.
- Prvobitni predlog (istorija): zadržati sadašnji način do otvaranja sajta.
- Odluka i primena (2026-10-01): Odluka vlasnika (2026-10-01): ostaje `mailto:` — sajt priprema poruku, korisnik je šalje iz svog programa za e-poštu, primalac `carsystemirmdoo@gmail.com`. Tekst forme sada kaže: „Poruka još nije poslata …" i „Poruka nije poslata dok je ne pošaljete iz tog programa." Bez servisa za e-poštu, API rute, troška i env promenljive.

## GAP-008 — Interne demo strane dostupne na javnom domenu

- Status: `RESOLVED_BY_SAFE_PROJECT_POLICY`
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
- Online dokazi (2026-10-01): Produkcioni domen danas: `https://carsystemirm.com/interaction-demo/cursor-states`, `/social-exports/spray-reveal` i `/kontakt` vraćaju 307 → `/site-u-pripremi` (maintenance). Izloženost demo ruta nastaje tek kad se maintenance isključi.
- Prvobitno pitanje (istorija): Da li `/interaction-demo/*` i `/social-exports/*` treba da budu nedostupni na produkcionom domenu?
- Očekivani format odgovora: „zatvoriti u produkciji" / „ostaviti".
- Prvobitni predlog (istorija): zatvoriti u produkciji (posebna izmena middleware-a).
- Odluka i primena (2026-10-01): Odluka vlasnika (2026-10-01): `/interaction-demo/*` i `/social-exports/*` vraćaju 404 na Vercel Production i Preview (pre održavanja, kanonskog hosta i noindex-a); lokalno i u `vercel dev` ostaju dostupne. Primenjeno: `lib/internal-demo-routes.mjs` + `middleware.ts`, test `lib/internalDemoRoutes.test.mjs` (`npm run test:internal-routes`), bez nove env promenljive (odlučuje `VERCEL_ENV`).

## GAP-009 — Neprevedena tehnička uputstva iz tehničkih listova (TDS)

- Status: `RESOLVED_BY_OWNER_CONFIRMATION` (primenjeno 2026-10-01)
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
- Online dokazi (2026-10-01): Zvanični tehnički listovi postoje samo na engleskom (i nemačkom za baslac): `https://techinfo.baslac.com/en/40-620.pdf` (200), `/de/40-620.pdf` (200), `/sr/`, `/rs/`, `/hr/`, `/sl/` (404); Norbin `https://www.norbin-paint.com/files/TDS/NORBIN_TDS_N15-V20_Clear_VOC.pdf`, `…/NORBIN_TDS_N15-V25_Fast_Clear_VOC.pdf`, `…/N60-V20_Multifunctional_Body_Filler_Hardener.pdf`; za R-M ONYX HD nije pronađen srpski tehnički list. Zvaničan srpski prevod ne postoji — prevod bi bio naš i mora ga odobriti stručno lice.
- Prvobitno pitanje (istorija): Da li ove rečenice treba prevesti na srpski (i ko odobrava prevod), ili ostaju na engleskom kao citat iz TDS-a?
- Očekivani format odgovora: „prevesti — odobrava [ime/uloga]" ili „ostaje original".
- Prvobitni predlog (istorija): „Sadržaj VOC ovog proizvoda je 419 g/l. Ne može se isključiti da proizvod sadrži čestice manje od 0,1 μm."
- Odluka i primena (2026-10-01): Odluka vlasnika (2026-10-01): konzervativan srpski prevod vidljivih tekstualnih polja kroz izvor istine sync-a, original sa izvorom u provenance-u, dva sync prolaza sa drugim 0-diff i oznaka za stručni pregled. Tabela odobrena 2026-10-01 i primenjena kroz izvor istine sync-a (vidi „Primena" ispod), zajedno sa tri ispravke parsiranja. Ne blokira Production.

### Primena (2026-10-01)

Izvor istine: `data/norbin-sync/technical-localization.json`, `data/baslac-sync/technical-localization.json`,
`data/rm-sync/technical-localization.json` (format i pravila: `scripts/lib/technical-localization.mjs`).
Ključ je zvanična šifra; svaka stavka nosi doslovni original, srpski tekst, vrstu (`translation` /
`parser-correction`) i TDS izvor (URL, strana, odeljak). Apply upisuje srpski tekst u `technical` i
original sa izvorom u `technicalLocalization` zapisa (provenance, ne prikazuje se). Pravilo koje više ne
pogađa izvor obara `<brend>:sync:apply`, pa se zastareo prevod nikad ne primeni tiho. Dva sync prolaza,
drugi 0 diff, za sva tri brenda; promena generisanog kataloga ograničena je na pogođena polja 18 zapisa.
Regresija: `lib/content-qa/releaseRegression.test.mts`.

Pre primene je svaki red ponovo upoređen sa zvaničnim TDS PDF-om (preuzetim 2026-10-01). Razlike u odnosu
na predlog ispod:

- „suvo na prašinu" je zadržano kako je vlasnik naveo; u redu 6 i 15 oblik je „suvo na prašinu posle N".
- Red 12: „45 Line" ostaje u zvaničnom obliku (naziv se ne prevodi): „Bez otparavanja pre nanošenja 45 Line."
- Red 13: „20°C: 4 h · suvo na prašinu posle 2 h" (dve vrednosti, bez dvotačke unutar vrednosti).
- Red 14: TDS kaže „Possibility to speed up the process with additional air flow" — parser je odsekao kraj;
  prevod je veran celom iskazu: „(proces se može ubrzati dodatnim protokom vazduha)".
- Red 17: TDS daje zapreminski odnos C 2A40 100 % : H 2A20 100 % + R 2A20/R 2A10 20 %; prikaz
  „1:1 + 20% zapreminski (lak : učvršćivač + razređivač)".
- Temperatura u obliku „20°C" (preovlađuje u katalogu), rasponi sa crticom kao u izvoru („2-3 min").
- Dodatno pronađena 3 iskaza iste vrste pri ponovnoj proveri renderovanog HTML-a (nisu bila u tabeli),
  prevedena po istim pravilima: Norbin N55-015 i baslac 21-10 „15 min before filler application" → „15 min
  pre nanošenja punila"; baslac 21-20 „15 min,before applying baslac 20-24/34/94 filler" → „15 min pre
  nanošenja baslac punila 20-24/34/94"; Norbin N60-V20 sušenje „20 - 30 minutes" → „20-30 min pri 20°C"
  (TDS: „Drying time at 20°C: 20 – 30 minutes").

#### Novi nalaz parsiranja — NIJE ispravljeno, čeka odobrenje

| Proizvod | Šta sajt prikazuje | Šta kaže TDS | Uzrok |
|---|---|---|---|
| baslac 40-440 (`/proizvodi/baslac-40-440-2k-voc-clear`) | „Sušenje: 20°C: 50-415 · 60°C: 50-415 · …" (bez vremena) | str. 2, Drying: 20°C — 50-415: 10 h, 50-420: 16 h, 50-430: 16 h; 60°C — 50-415: 30 min, 50-420: 40 min, 50-430: 40 min | parser čuva samo prvi učvršćivač, a `dryingText` u `lib/baslac-catalog-products.ts` deli red na prvoj „: " i gubi vreme |
| baslac 40-450 (`/proizvodi/baslac-40-450-universal-clear-voc`) | isto („20°C: 50-415 · 60°C: 50-415") | techinfo.baslac.com/en/40-450.pdf, str. 2, Drying (po učvršćivaču) | isti uzrok |

### Predlog prevoda (GAP-009) — istorija, primenjeno uz izmene navedene iznad

Pravila: brojevi, jedinice, temperature, vremena i ograničenja ostaju isti (decimalni
zarez prema `data/*-sync/LOCALIZATION_GUIDE.md`); zvanične oznake (Line 45, wet-on-wet
kao ustaljen termin) se ne prevode; original ostaje u provenance-u sa izvorom. Pronađeno
skeniranjem renderovanog teksta svih PDP strana Norbin, baslac i R-M (2026-10-01).
Zvanični nazivi proizvoda i nazivi PDF dokumenata nisu predmet prevoda.

| # | Proizvod (ruta) | Polje | Original | Predlog na srpskom | Mora ostati identično | Izvor |
|---|---|---|---|---|---|---|
| 1 | Norbin N15-V20, N15-V25 (`/proizvodi/norbin-n15-v20-clear-voc`, `/proizvodi/norbin-n15-v25-fast-clear-voc`) | VOC | The VOC content of this product is 419 g/l. It cannot be ruled out that this product contains particles < 0.1 μm. | Sadržaj VOC ovog proizvoda je 419 g/l. Ne može se isključiti da proizvod sadrži čestice manje od 0,1 μm. | 419 g/l; < 0,1 μm | norbin-paint.com/files/TDS/NORBIN_TDS_N15-V20_Clear_VOC_2022.pdf; …/N15-V25_Fast_Clear_VOC_2.pdf |
| 2 | Norbin N60-V20 (`/proizvodi/norbin-n60-v20-multifunctional-body-filler-hardener`) | VOC | The VOC content of this product is 249 g/l. It cannot be ruled out that this product contains particles < 0.1 μm. | Sadržaj VOC ovog proizvoda je 249 g/l. Ne može se isključiti da proizvod sadrži čestice manje od 0,1 μm. | 249 g/l; < 0,1 μm | norbin-paint.com/files/TDS/N60-V20_Multifunctional_Body_Filler_Hardener.pdf |
| 3 | Norbin N15-020, N15-V20, N55-V29 (`/proizvodi/grupa/norbin-n15-020`, `/proizvodi/norbin-n15-v20-clear-voc`, `/proizvodi/norbin-n55-v29-2k-primer-filler-black`) | Razmak između slojeva | 3 minutes flash off between coats | 3 minuta otparavanja između slojeva | 3 min | NORBIN_TDS_N15-020_Clear_2022.pdf; …N15-V20…; N55-V29_2K_Primer_Filler_black.pdf |
| 4 | Norbin N15-020, N15-V20 | Sušenje (spremno za montažu) | 5 hours ready for assembly (at 20°C) | 5 sati do spremnosti za montažu (pri 20 °C) | 5 h; 20 °C | NORBIN_TDS_N15-020_Clear_2022.pdf; …N15-V20… |
| 5 | Norbin N15-020, N15-V20, N15-V25 | Sušenje (tvrdoća) | Total hardness: after 24 hours | Potpuna tvrdoća: posle 24 sata | 24 h | iste kao 3–4; N15-V25_Fast_Clear_VOC_2.pdf |
| 6 | Norbin N15-V25 | Sušenje (suvo na prašinu) | 2 hours dust free (at 20°C) | 2 sata do suvoće na prašinu (pri 20 °C) | 2 h; 20 °C | N15-V25_Fast_Clear_VOC_2.pdf |
| 7 | Norbin N55-015 (`/proizvodi/norbin-n55-015-1k-plastic-primer`) | Broj slojeva | 1 - 2 thin coats | 1–2 tanka sloja | 1–2 | N55-015_1K_Plastic_Primer.pdf |
| 8 | Norbin N60-V20 | Vreme | 4 - 6 minutes at room temperature | 4–6 minuta na sobnoj temperaturi | 4–6 min | N60-V20_Multifunctional_Body_Filler_Hardener.pdf |
| 9 | baslac 40-40 (`/proizvodi/baslac-40-40-2k-universal-clear`) | Razmak između slojeva | 2-3 min after each spray coat | 2–3 min posle svakog sloja | 2–3 min | techinfo.baslac.com/en/40-40.pdf |
| 10 | baslac 40-440, 40-450 (`/proizvodi/baslac-40-440-2k-voc-clear`, `/proizvodi/baslac-40-450-universal-clear-voc`) | Razmak između slojeva | 3 min between spray coats | 3 min između slojeva | 3 min | techinfo.baslac.com/en/40-440.pdf; …/40-450.pdf |
| 11 | baslac 40-620 (`/proizvodi/baslac-40-620-2k-clear-mat-voc`) | Razmak između slojeva | Flash off until completely mat after the first spray coat and before drying. Do not flash off for more than 25 min. | Posle prvog sloja i pre sušenja otparavati dok površina potpuno ne postane mat. Otparavanje ne sme trajati duže od 25 min. | 25 min | techinfo.baslac.com/en/40-620.pdf |
| 12 | baslac 45-W10 (`/proizvodi/baslac-45-w10`) | Razmak između slojeva | No flash off before applying 45 Line. | Bez otparavanja pre nanošenja Line 45. | Line 45 (naziv) | techinfo.baslac.com/en/45-W10.pdf |
| 13 | baslac 40-10 (`/proizvodi/baslac-40-10-2k-panel-clear`) | Sušenje | 20°C: 4 h dust-free (TDS: „Drying at 20°C 4 h dust-free: 2 h") | 20 °C: 4 h; suvo na prašinu: 2 h | 20 °C; 4 h; 2 h | techinfo.baslac.com/en/40-10.pdf — **ispravka parsiranja**: sajt danas tvrdi „4 h dust-free", TDS kaže 4 h sušenje i 2 h do suvoće na prašinu |
| 14 | R-M ONYX HD, ONYX HD TROPICAL (`/proizvodi/rm-onyx-hd`, `/proizvodi/rm-onyx-hd-tropical`) | Sušenje | 20°C: 15 min Possibility to speed up the process | 20 °C: 15 min (proces se može ubrzati) | 20 °C; 15 min; 40 °C: 10 min | techinfo.rmpaint.com/unicorn/en/ONYX HD-ONYX HD Waterborne basecoat line.pdf; …TROPICAL….pdf |
| 15 | R-M C 2P52 (`/proizvodi/rm-c-2p52-easy-air-finish-r`) | Sušenje | 20°C: Dust free time: 35 min | 20 °C: suvo na prašinu za 35 min | 20 °C; 35 min | techinfo.rmpaint.com/unicorn/en/C 2P52 -eSense clear coat ambient drying.pdf |
| 16 | R-M P 5540 (`/proizvodi/rm-p-5540-ghd-protect-primer-filler`) | Odnos mešanja | 100:25:25 100:25:25 by volume wet on wet | 100:25:25 zapreminski, mokro na mokro; 100:20:20 zapreminski, za brušenje | 100:25:25; 100:20:20 | techinfo.rmpaint.com/unicorn/en/P 5540-GHD PROTECT PRIMER FILLER grey PUR.pdf — **ispravka parsiranja**: duplirani prvi odnos, izostavljen odnos za brušenje iz istog TDS-a |
| 17 | R-M C 2A40 (`/proizvodi/c-2a40-airtop`) | Odnos mešanja | 1:1 + 20% Clear coat Preparation | 1:1 + 20 % | 1:1; 20 % | techinfo.rmpaint.com/unicorn/en/C 2A40-Clear coat air drying.pdf — **ispravka parsiranja**: „Clear coat Preparation" je naslov sledećeg odeljka u TDS-u |

Napomena: redovi 13, 16 i 17 ispravljaju i pogrešno pročitanu vrednost, ne samo jezik;
zato su posebno istaknuti za pregled.

#### Data-correctness (odvojeno od prevoda) — ISPRAVLJENO 2026-10-01 (odobreno)

Ovo nisu jezički problemi nego pogrešno pročitani podaci iz TDS-a; sajt danas prikazuje
netačnu ili nepotpunu tehničku vrednost. Provereno direktno u PDF-ovima proizvođača.

| Proizvod | Šta sajt prikazuje | Šta kaže TDS | Uzrok |
|---|---|---|---|
| baslac 40-10 (`/proizvodi/baslac-40-10-2k-panel-clear`) | „20°C: 4 h dust-free" | „Drying at 20°C 4 h, dust-free: 2 h" (sušenje 4 h; suvo na prašinu 2 h) | parser je spojio dve vrednosti i izgubio „2 h" |
| R-M P 5540 (`/proizvodi/rm-p-5540-ghd-protect-primer-filler`) | „100:25:25 100:25:25 by volume wet on wet" | „100:25:25 by volume wet on wet; 100:20:20 by volume for sanding" | duplirana prva vrednost, izostavljen odnos za brušenje |
| R-M C 2A40 (`/proizvodi/c-2a40-airtop`) | „1:1 + 20% Clear coat Preparation" | „1:1 + 20%", zatim odeljak „Clear coat Preparation" | naslov sledećeg odeljka zalepljen za vrednost |

## GAP-010 — Kartica „Video materijali" na Carsystem strani

- Status: `RESOLVED_FROM_PUBLIC_SOURCES`
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
- Online dokazi (2026-10-01): carsystem.org linkuje zvanični kanal `https://www.youtube.com/carsystem_refinish`; postoji i kanal proizvođača Vosschemie GmbH. Videi su na nemačkom/engleskom; izbor videa i ugrađivanje su odluka vlasnika.
- Prvobitno pitanje (istorija): Imate li video materijale za Carsystem program koje treba povezati, ili karticu treba ukloniti?
- Očekivani format odgovora: link(ovi) ka videu ili „ukloniti karticu".
- Prvobitni predlog (istorija): ukloniti karticu dok video ne postoji.
- Odluka i primena (2026-10-01): Kartica „Video materijali" vodi na zvanični kanal `https://www.youtube.com/carsystem_refinish` (link sa carsystem.org, 200 na 2026-10-01), otvara se u novom prozoru sa `rel="noopener noreferrer"`. Tekst: „Pogledajte zvanične Carsystem video materijale, demonstracije proizvoda i postupke primene." Status „U pripremi" uklonjen.

## GAP-011 — Tačka centrale na mapi

- Status: `RESOLVED_FROM_PUBLIC_SOURCES`
- Prioritet: `LOW`
- Oblast: `kontakt`
- Vidljivost: `javno`
- Putanja: `lib/company-contact.ts`
- Linija ili identifikator: `companyLocation.coordinates`
- Ruta/strana: mapa centrale na `/` i `/kontakt` (`components/map/CompanyLocationMap.tsx`)
- Komponenta ili polje: marker „Centrala · Inđija"
- Trenutni tekst/vrednost: `45.0482, 20.0817` — centar grada, ne adresa.
- Zašto nije bezbedno automatski ispraviti: jedina tačka za Ive Andrića 3 je automatsko geokodiranje (`45.0496189, 20.0654391`, status `geocoded_preview` u `data/store-locations.json`), nepotvrđeno.
- Šta je provereno: adresa (potvrđena, vidi rezime), geokod iz BEX uvoza.
- Pronađeni izvori i konflikt: centar grada vs. geokod adrese.
- Online dokazi (2026-10-01): OpenStreetMap/Nominatim za „Ive Andrića 3, Inđija": zgrada na kućnom nivou (`class=building`, `type=house`, way 799359269) na `45.0496189, 20.0654391`, „3, Иве Андрића, Инђија, 22320" — ista tačka kao BEX geokod. Ostaje da firma potvrdi da je to ulaz/magacin za posetioce.
- Prvobitno pitanje (istorija): Da li je ulaz/magacin na Ive Andrića 3 na tački `45.0496189, 20.0654391`?
- Očekivani format odgovora: „da" ili tačne koordinate / link sa mape.
- Prvobitni predlog (istorija): koristiti geokod adrese posle Vaše potvrde.
- Odluka i primena (2026-10-01): Tačka objekta `45.0496189, 20.0654391` (OpenStreetMap zgrada way 799359269 = BEX geokod) zamenjuje centar Inđije `45.0482, 20.0817`. Marker: „Carsystem i R-M — centrala"; tačka je opisana kao objekat, ne kao ulaz ni prijem robe.

## GAP-012 — Oznake projektnih faza („faza 2–5") na ekranima portala

- Status: `RESOLVED_BY_OWNER_CONFIRMATION`
- Prioritet: `LOW`
- Oblast: `portal`
- Vidljivost: `komercijalista`, `vlasnik/admin`
- Putanja (23 mesta): `app/portal/admin/page.tsx:41-45`, `app/portal/adresnice/page.tsx:24`, `app/portal/bex/page.tsx:24`, `app/portal/dugovanja/page.tsx:23`, `app/portal/izvestaji/page.tsx:22-24`, `app/portal/kupci/[id]/page.tsx:43-46`, `app/portal/limiti/page.tsx:22-25`, `app/portal/nabavka/page.tsx:22-25`, `app/portal/otprema/page.tsx:24-26`, `app/portal/page.tsx:87`, `app/portal/porudzbine/page.tsx:22-25`, `app/portal/zalihe/page.tsx:22-26`, `components/portal/PortalShell.tsx:291`
- Linija ili identifikator: `phase="faza N"` (prikazuje se kao „Planirano: faza N") i spiskovi preduslova „(faza N)"
- Ruta/strana: ekrani portala za module koji još nisu povezani (Dugovanja, Limiti, Nabavka, Otprema, BEX, Zalihe…)
- Komponenta ili polje: najava modula i spisak preduslova
- Trenutni tekst/vrednost: npr. „Uvoz faktura iz BiznisSoft izvoza (faza 2) — bez njega nema nijednog prodajnog podatka."
- Zašto nije bezbedno automatski ispraviti: brojevi faza su iz plana projekta (`docs/b2b`); da li ih zaposleni treba da vide ili ih zameniti opisom je odluka vlasnika. Tekst je inače tačan i ne obećava ništa netačno.
- Šta je provereno: sva 23 pojavljivanja; nijedno nije vidljivo kupcu.
- Pronađeni izvori i konflikt: nema.
- Online dokazi (2026-10-01): Nije predmet javnog izvora (interni plan projekta).
- Prvobitno pitanje (istorija): Da li komercijalisti treba da vide oznake „faza N", ili ih zameniti opisom (npr. „posle povezivanja BiznisSoft izvoza")?
- Očekivani format odgovora: „zadržati" / „zameniti opisom".
- Prvobitni predlog (istorija): zameniti opisom preduslova.
- Odluka i primena (2026-10-01): Odluka vlasnika (2026-10-01): u UI-ju nema „faza N" ni „Planirano: faza N". `PhaseNotice` prikazuje preduslov („Dostupno nakon povezivanja BiznisSoft izvoza", „… BEX naloga za otpremu", „… uvoza podataka o zalihama", „… statusa plaćanja"); „(faza N)" uklonjeno iz spiskova preduslova i iz opisa polja pretrage. Brojevi faza ostaju u `docs/b2b`. Čuvar odbija povratak.

## GAP-013 — Naziv uloge „Gazda" u portalu

- Status: `RESOLVED_BY_OWNER_CONFIRMATION`
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
- Online dokazi (2026-10-01): Nije predmet javnog izvora (interni naziv uloge).
- Prvobitno pitanje (istorija): Da li zaposleni treba da vide naziv uloge „Gazda" ili, na primer, „Vlasnik"?
- Očekivani format odgovora: željeni naziv uloge.
- Prvobitni predlog (istorija): „Vlasnik".
- Odluka i primena (2026-10-01): Odluka vlasnika (2026-10-01): korisnička oznaka uloge je „Vlasnik" (i oblici „od Vlasnika", „nalog sa ulogom Vlasnik"); interni ključ `gazda` je nepromenjen (bez migracije, promene dozvola i sesija). Čuvar odbija „Gazda" u korisničkom tekstu.

## GAP-014 — Formulacija glavnog CTA u CLAUDE.md

- Status: `RESOLVED_BY_OWNER_CONFIRMATION`
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
- Online dokazi (2026-10-01): Nije predmet javnog izvora (projektno pravilo).
- Prvobitno pitanje (istorija): Da li u CLAUDE.md ažurirati glavni CTA na „Pronađite najbližu prodavnicu"?
- Očekivani format odgovora: „da" / „ne".
- Prvobitni predlog (istorija): „da".
- Odluka i primena (2026-10-01): Odluka vlasnika (2026-10-01): glavni CTA je „Pronađite najbližu prodavnicu" — ažurirano u `CLAUDE.md` i u normativnim dokumentima `MASTER_REQUIREMENTS.md`, `UI_DESIGN_BRIEF.md`, `CLAUDE_DESIGN_PROMPT.md`; istorijski auditi u `docs/` zadržavaju originalne citate.
