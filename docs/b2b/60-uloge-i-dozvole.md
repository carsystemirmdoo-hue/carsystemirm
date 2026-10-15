# 60 — Uloge, nalozi i dozvole: pregled i preporuke

Stanje koda: grana `fix/revizija-portala-objava` (PR #23). Izvor istine:
`lib/authz/permissions.mjs` (uloge, sposobnosti, paketi, meni, mapa ruta) i
provere u svakoj strani i serverskoj radnji. Matrica u §2 je **proverena na
živom serveru** nad sintetičkom bazom (`scripts/qa/role-tour.mjs galerija`):
za svaku ulogu otvorene su sve strane portala i zabeležen stvaran odgovor.
Ništa nije menjano na stvarnim nalozima. Stvarno stanje naloga na Production-u
je u privatnoj belešci (repo je javan).

## 0. Četiri odvojena mehanizma

| Mehanizam | Šta određuje | Gde |
|---|---|---|
| **Tip naloga** | zaposleni (`users`) ili kupac (`customer_users`) — odvojene tabele, odvojena prijava (`/prijava` sa drugim faktorom / `/prijava/kupac` bez njega), token nosi `subject`; kupčev token ne otvara portal i obrnuto | `auth.ts`, `customer-scope.mjs` |
| **Uloga zaposlenog** | tačno jedna od 4: Vlasnik (`gazda`), Kancelarija, Komercijalista, Magacioner — osnovni skup sposobnosti | `ROLE_BASE` |
| **Paketi dozvola** | 16 paketa koje vlasnik dodaje pojedincu povrh uloge | `PACKAGE_GRANTS`, `/portal/dozvole` |
| **Opseg kupaca** | `customers:view_all` (Vlasnik, Kancelarija, paket „analitika“) = svi kupci; inače samo kupci dodeljeni u `customer_assignments` | `scope.mjs` |

**Vlasnik ≠ administrator.** Posebne uloge „administrator“ nema. Administracija
naloga su paketi „Korisnici i dozvole“ (`users:manage`) i „Bezbednost naloga“
(`users:manage_security`), koje Vlasnik ima po ulozi, a drugima ih može dati.
Strana „Administracija“ (`/portal/admin`) su sistemski pragovi koje kod trenutno
ne koristi. Tri radnje ima **samo Vlasnik** i nijedan paket ih ne daje:
registracija uređaja (`devices:manage`), cenovnik (`pricelist:manage`), dodela
kupaca komercijalistima (`assignments:manage`).

Kupac nema uloge: svi nalozi iste firme vide isto (fakture firme, korpa firme,
zahtevi firme). Uloga „prodavnica/partner“ iz plana (CLAUDE.md) **ne postoji**.

## 1. Uloge

| Uloga | Namena | Početna | Šta vidi | Šta radi (piše/odobrava) | Kupci | Cene, rabati, finansije | Stanje |
|---|---|---|---|---|---|---|---|
| **Vlasnik** (`gazda`) | vlasnik firme | `/portal` | sve (43/44 strane; korpa je isključena) | sve: cenovnik, odobravanje rabata, dodele, nalozi kupaca, uređaji, korisnici i bezbednost, potvrda zahteva, uvoz, odluke o dokumentima, obračun preporuka | svi | sve: osnovne cene (VP), pravila rabata, rabati sa faktura, cene kupaca u zahtevima; nabavna cena se ne čuva | funkcionalna |
| **Kancelarija** | prijem zahteva, unos u BizniSoft, uvoz | `/portal` | kupci, šifre i registar partnera (čitanje), bez komercijaliste, prodaja, zahtevi, rabati iz faktura (čitanje), mapiranja artikala (čitanje), obaveštenja, importi, izvorni dokumenti, spremnost, sinhronizacija (19/44) | obrada i potvrda zahteva, broj iz BizniSofta, izmenjen predlog, odgovor na upit, ručni uvoz PDF-a, ručni ciklus sinhronizacije, ponovni obračun posle uvoza, izvoz | svi | rabati sa faktura (čitanje), cene kupaca u zahtevima; ne vidi pravila rabata ni cenovnik | funkcionalna |
| **Komercijalista** | rad sa svojim kupcima | `/portal` | kupci, prodaja, zahtevi (čitanje), za razgovor, preporuke, rabati iz faktura (čitanje), obaveštenja | odgovor na upit za cenu, izvoz svojih podataka; uz „cene_predlog“: predlog rabata | **samo dodeljeni** | rabati sa faktura svojih kupaca; uz „cene_predlog“ i pravila svojih kupaca | funkcionalna |
| Komercijalista + **analitika** | isto + analiza cele firme | `/portal` | + analitika, povrati, izveštaji, importi i izvorni dokumenti (čitanje), zalihe, BEX (24/44) | isto | **svi** (paket daje `customers:view_all`) | rabati i promet **svih** kupaca | funkcionalna |
| **Magacioner** | otprema | `/portal/otprema` | otprema, adresnice, BEX (5/44 sa lozinkom i drugim faktorom) | ništa stvarno (strane čekaju izvor podataka) | nema | nema | **samo predviđena** |
| **Kupac** (drugi tip naloga) | firma kupac | `/kupac` | pregled, fakture (+ pregled za štampu), izbor robe, korpa, zahtevi, upiti, saglasnosti, bezbednost | zahtev za porudžbinu (samo firme u probi), upit za cenu (iz kataloga), potvrda izmenjenog predloga, promena lozinke | samo svoja firma | svoje istorijske cene sa faktura; svoja cena po opciji plaćanja (samo u probi) | funkcionalna (poručivanje samo u probi) |

## 2. Matrica (serverske dozvole)

Oznake: — nema · Č čita · O obrađuje (piše) · OD odobrava/odlučuje. Opseg: (d) =
samo dodeljeni kupci, (s) = svi, (f) = svoja firma.

| Funkcija | Vlasnik | Kancelarija | Komercijalista | +analitika | Magacioner | Kupac |
|---|---|---|---|---|---|---|
| Kupci, kartica kupca | Č (s) | Č (s) | Č (d) | Č (s) | — | — |
| Prodaja, fakture, izvoz | Č (s) | Č (s) | Č (d) | Č (s) | — | Č (f) |
| Analitika, povrati | Č | — | — | Č (s) | — | — |
| Za razgovor, preporuke | Č + obračun | — | Č (d) | Č (s) | — | — |
| Zahtevi kupaca | OD (potvrda) | OD (potvrda) | Č (d) | Č (s) | — | O (f) |
| Upiti za cenu | O | O | O (d) | O (s) | — | O (f) |
| Rabati iz faktura | Č + OD | Č (s) | Č (d) | Č (s) | — | — |
| Predlog rabata | OD | — | O (d) uz „cene_predlog“ | O (s) uz paket | — | — |
| Odobravanje rabata, primena u BizniSoftu | OD | — | — | — | — | — |
| Cenovnik (osnovne cene) | OD | — | — | — | — | — |
| Opcije plaćanja, poseban status kupca | OD | — | — | — | — | — |
| Šifre partnera, registar, mapiranja artikala | OD | Č | — | — | — | — |
| Izvorni dokumenti (odluke o verziji) | OD | Č | — | Č | — | — |
| Ručni uvoz PDF-a | O | O | — | — | — | — |
| Sinhronizacija: pregled / ručni ciklus | Č / O | Č / O | — | — | — | — |
| Uređaji (konektor) | OD | — | — | — | — | — |
| Dodela kupaca komercijalistima | OD | — | — | — | — | — |
| Nalozi kupaca, pozivi, poruke za predaju | OD | — | — (uz paket: O (d)) | — | — | — |
| Korisnici, dozvole, bezbednost naloga | OD | — | — | — | — | — |
| Obaveštenja | Č | Č (zahtevi, upiti) | Č | Č | — | — |
| Dugovanja, limiti, zalihe, nabavka, otprema | prazne strane | dugovanja: prazna | dugovanja: prazna | + zalihe: prazna | otprema: prazna | — |
| Sopstvena lozinka i drugi faktor | O | O | O | O | O | O (lozinka) |

**Meni naspram servera** (provereno):
- Meni prikazuje strane **bez funkcije** (čekaju izvor podataka): Dugovanja (Vlasnik, Kancelarija, Komercijalista); Zalihe, BEX, Izveštaji (uz „analitiku“); Limiti, Nabavka, Porudžbine, Otprema, Adresnice, BEX (Vlasnik); ceo meni Magacionera.
- Server dozvoljava, a meni ne prikazuje: `/portal/kupci/kontakti` (grupni predlog kontakata), `/portal/kupci/veze` (grupne veze šifara), `/portal/cene/pravila` (otvara se iz „Cene i rabati“). To su namerni pomoćni ekrani.
- Kancelarija otvara „Predlozi rabata“ i „Šifre partnera“ samo za čitanje — dugmad za predlog i potvrdu se ne prikazuju bez prava (provereno u kodu i na snimcima).
- Nema slučaja da meni nudi radnju koju server odbija.

## 3. Procena za našu firmu

**Vlasnik.** Ima sve što treba. Dva problema:
1. Drugi „gazda“ nalog (operater/IT) ima pun **poslovni** pristup — odobravanje rabata, cenovnik, dodele. Treba mu samo deo toga: registracija uređaja i cenovnik postoje samo kod Vlasnika. *Odluka:* ostaje gazda (jednostavno) ili Kancelarija + „Korisnici i dozvole“ + „Bezbednost naloga“, uz Vlasnika za uređaje i cenovnik. Nova uloga nije potrebna.
2. Vlasniku dodeljeni paketi nemaju efekta (uloga već ima sve) — samo zbunjuju ekran Dozvola.

**Kancelarija** (zahtevi, BizniSoft, uvoz). Ima sve za tok zahteva, upita i uvoza. Nedostaje:
1. **Unos odobrenih rabata u BizniSoft i oznaka da je uneto** (`prices:apply`, paket „Evidentiranje primene u BizniSoftu“). Odobrena pravila čekaju unos u BizniSoft, a označiti to danas može samo Vlasnik. Ako to radi kancelarija → dodeliti joj taj **postojeći** paket.
2. **Pozivi pilot kupcima** (paket „Nalozi kupaca“) — samo ako pozive izdaje kancelarija, a ne Vlasnik.
3. Opciono: čitanje važećih pravila rabata (`view:cene`) radi odgovora kupcu; danas vidi rabate sa faktura i cene u samom zahtevu.

**Komercijalista.** Za rad sa svojim kupcima je dovoljno. Nedostaje i preširoko je:
1. Za **upit za cenu svog kupca** ne dobija obaveštenje (obaveštenja se vide po pravu, ne po kupcu). Rešenje je obaveštenje po dodeli — dopuna koda, ne nova uloga.
2. **Paket „analitika“ daje i uvid u SVE kupce** (fakture, rabati, izvorni dokumenti), ne samo analizu. Ako je namera samo analiza → paket treba razdvojiti; ako je namera da taj komercijalista vidi sve → ostaje. *Odluka vlasnika.*
3. „Dugovanja“ u meniju je prazna strana — skloniti dok ne stignu uplate.

**Magacioner.** Uloga postoji, ali nema nijednu funkcionalnu stranu i na Production-u nema naloga. Ne praviti naloge dok ne stignu zalihe i otprema. Kada se pojavi stvaran posao (priprema potvrđene porudžbine), trebaće pregled potvrđenih zahteva — **bez cena**. To je dopuna postojeće uloge, ne nova uloga.

**Kupac.** Za pilot dovoljno: jedan tip, više naloga po firmi, sve vide isto. Podela unutar firme (npr. „nabavka vidi cene, magacin ne“) nije potrebna za pilot.

**Paketi bez funkcije** (vode na prazne strane): otprema, predlog nabavke, poručivanje, kreditni limiti, sistemski pragovi, globalno zatvaranje, pregled obaveštenja. Ne dodeljivati ih. Predlog: sakriti ih na ekranu Dozvola dok funkcija ne postoji.

**Preklapanja.** „Nalozi kupaca“ ⊃ „Predlaganje kontakata“; „Odobravanje cena“ i „Primena u BizniSoftu“ dele pregled — namerno (različiti koraci), zadržati.

## 4. „Kao da sam ta uloga“

- **Vlasnik:** prijava sa kodom → Početna (spremnost, kopije, nalozi) → u meniju sve → odobrava rabate, primenjuje cenovnik, dodeljuje kupce, izdaje pozive, potvrđuje zahteve, registruje uređaj.
- **Kancelarija:** prijava sa kodom → Početna → **Zahtevi kupaca**: preuzme zahtev, pripremi izmenjen predlog ili potvrdi (broj P-…), upiše broj iz BizniSofta, odštampa A4 → **Obaveštenja**: nov zahtev ili upit → **Importi**: otpremi PDF, vidi prijem sa konektora → **Kartica kupca**: istorija kupovine.
- **Komercijalista:** prijava sa kodom → Početna → **Kupci**: samo svoji → **Za razgovor**: kome se javiti → kartica kupca sa predlogom razgovora → **Zahtevi**: vidi zahteve svojih kupaca, ne menja ih → **Upiti**: odgovori kupcu → uz paket „cene_predlog“: predlog rabata za svog kupca.
- **Komercijalista + analitika:** isto, ali **svi kupci** i Analitika cele firme.
- **Magacioner:** prijava sa kodom → Otprema → poruka da čeka izvor podataka (nema rada).
- **Kupac:** prijava → Pregled → **Fakture**: lista, detalj, pregled za štampu → **Izbor robe** (samo firma u probi): cene po opciji plaćanja → **Korpa** → zahtev → **Zahtevi**: potvrda izmenjenog predloga → **Upiti**: odgovor na upit.

### Kako da redom pregledate svaku ulogu (sintetički, bez stvarnih naloga)

Sintetički server: baza `carsystem_revizija_ui_qa`, build `.next-verify`, port 3450.

```bash
node scripts/qa/role-tour.mjs galerija ~/Carsystem/radno/pregled-uloga-2026-10-11
```
Pravi `index.html` sa matricom stvarnih odgovora servera i snimcima svake strane po ulozi.

```bash
node scripts/qa/role-tour.mjs otvori kancelarija
```
Otvara prozor već prijavljen kao izabrana uloga, za samostalno klikanje. Uloge: `vlasnik`, `kancelarija`, `petar`, `milan`, `jovan`, `magacin`, `kupac`. Lozinke se ne prikazuju.

## 5. Kratka lista

| | Stavka |
|---|---|
| **Zadržati** | 4 uloge + kupac kao poseban tip; opseg po dodelama; samo-Vlasnik za uređaje, cenovnik i dodele; odvojeni koraci predlog / odobravanje / primena; „cene_predlog“ za komercijaliste |
| **Dopuniti** | obaveštenje komercijalisti o upitu i zahtevu **njegovog** kupca (po dodeli); sakriti prazne strane (Dugovanja i ostale) i pakete bez funkcije dok ne stignu podaci; magacionera (pregled potvrđenih porudžbina bez cena) tek uz zalihe i otpremu |
| **Ukloniti** | dodeljene pakete kod Vlasnika (bez efekta); stranu i paket „Sistemski pragovi“ dok pragovi nemaju upotrebu |
| **Odluka vlasnika** | (1) drugi „gazda“ nalog: ostaje gazda ili Kancelarija + paketi korisnika/bezbednosti; (2) da li kancelarija označava unos rabata u BizniSoft (paket „primena“); (3) ko izdaje pozive pilot kupcima (Vlasnik ili kancelarija + „Nalozi kupaca“); (4) paket „analitika“: sme li komercijalista sa njim da vidi sve kupce ili paket treba razdvojiti; (5) da li kancelarija izvozi podatke svih kupaca |
