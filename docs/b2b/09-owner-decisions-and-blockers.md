# 09 — Odluke vlasnika i blokade

Ovde su **isključivo** pitanja na koja odgovor **nije pronađen** u repozitorijumu.
Za svako: zašto blokira, šta tačno treba dostaviti, i šta se u međuvremenu može raditi.

Poređano po tome koliko blokira — ne po redosledu faza.

---

## BLOKIRA FAZU 4b — bez ovoga se adapter ne piše

### P1 — Kako izgleda stvaran BizniSoft izvoz kupaca? 🔴

**Šta je pretraženo:** svi `*.csv`, `*.xlsx`, `*.xls`, `*.xml` van `node_modules`. Pronađeno:

| Fajl | Šta je |
|---|---|
| `fixtures/dev/import/probni-izvoz-2026.csv` | **Izmišljeni podaci** — `fixtures/dev/README.md` to izričito kaže |
| `_incoming/Klijenti.csv` | 113 redova, **jedna kolona**, zaglavlje doslovno `Klijenti`. Nije tabelarni izvoz |

**Zašto blokira:** `lib/import/invoiceRow.mjs:REQUIRED_COLUMNS` očekuje 9 obaveznih i 11 opcionih kolona sa srpskim imenima. **Te kolone su naša pretpostavka izvedena uz izmišljeni fixture**, ne dokumentovan format proizvođača. Ako se stvaran izvoz razlikuje — a verovatno se razlikuje — parser ne radi i ceo plan uvoza se menja.

**Šta dostaviti:**
1. **Jedan stvaran fajl izvoza kupaca** — anonimizovan (izmenjeni nazivi i PIB-ovi), ali sa **očuvanom strukturom**: imena kolona, separator, kodni raspored, format datuma i brojeva.
2. **Screenshot ekrana u BizniSoftu odakle se izvoz pokreće** — vidi se koje opcije uopšte postoje.
3. Odgovor: **da li izvoz sadrži PIB?** Ako ne, koji je identitet kupca?

**U međuvremenu:** cela canonical shema (`03-data-contract-draft.md`) — ne zavisi od izvora.

---

### P2 — Postoji li uopšte cena po paru (kupac, artikal)? 🔴 ⚠️ najvažnije pitanje

**Šta je pretraženo:** `db/schema/*` — **nijedna cenovna tabela**. `grep -i 'price|cena|rabat|marza'` daje samo `unitPrice` i `discountPercent` **unutar stavke fakture** — dakle **ostvarenu cenu na dokumentu**, ne **važeći cenovnik**.

**Zašto blokira:** cela premisa portala je „kupac vidi svoju cenu". Ako BizniSoft ne ume da izveze važeći cenovnik po kupcu, portal ne može prikazati cenu pre porudžbine — a to je osnovna funkcija.

**Šta dostaviti:**
1. **Da li BizniSoft ume da izveze cenovnik po kupcu?** Da / Ne / Ne znamo.
2. Ako **da** — jedan takav izvoz (anonimizovan), pun oblik.
3. Ako **ne** — kako komercijalista danas saznaje cenu za konkretnog kupca? Gleda u BizniSoft ručno? Papirni cenovnik? Zna napamet?
4. **Da li je izvezena cena sa PDV-om ili bez?** Bez ovog odgovora cena je neupotrebljiva — greška od 20%.
5. Koliko približno ima parova (kupac × artikal)? 20 × 3.500 ≈ 70.000 je podnošljivo; 500 × 3.500 ≈ 1,75M traži drugačiji pristup.
6. Postoji li period važenja cene (`valid_from` / `valid_to`)?

**Ako je odgovor na (1) „Ne":** model se menja iz temelja. Mogućnosti:
- kupac vidi katalog **bez cene** i dobija ponudu na upit;
- cene se **unose ručno** u portal — rizik raskoraka sa BizniSoftom, direktno krši AD-3.

🟡 **To je poslovna odluka vlasnika, ne tehnička.**

---

### P3 — Postoji li izvoz stanja zaliha? 🔴

**Šta je pronađeno:** `app/portal/zalihe/page.tsx` već navodi kao blokadu: *„U postojećem sistemu ne postoji izvor stanja zaliha. Fakture ga ne sadrže i ne mogu ga zameniti."* Isto u `app/portal/nabavka/page.tsx` i `docs/portal/SETUP.md`. 🟢

**Zašto blokira:** dostupnost je signal preporuka (S8), uslov za porudžbinu i sadržaj magacinskog toka. Prikazivanje netačnog lagera je gore od neprikazivanja (T20).

**Šta dostaviti:**
1. Ume li BizniSoft da izveze trenutno stanje po artiklu? Da / Ne.
2. Ako da — jedan izvoz sa strukturom.
3. 🟡 **Sme li tačna količina napustiti kancelariju**, ili je dovoljno „dostupno / ograničeno / nedostupno"? Portal radi i sa drugim.
4. Koliko često se stanje menja — je li dnevni snapshot dovoljan?

---

### P4 — Poklapaju li se šifre artikala u BizniSoftu i u katalogu? 🔴

**Šta je pronađeno:** javni katalog koristi slugove (`lib/products.ts`, `lib/baslac-catalog-products.ts`, `app/proizvodi/[slug]`). `articles.code` iz uvoza je šifra iz izvora. **Nema tabele mapiranja.** Postoji jedino neiskorišćeno polje `biznisSoftSku?: string` u `lib/carsystem-data.ts:248`. 🟢

**Zašto blokira:** bez veze između to dvoje, kupac ne može kliknuti sa preporuke na proizvod, korpa ne zna šta je dodato, a katalog i cene su dva odvojena sveta.

**Šta dostaviti:**
1. Uzorak od **20–30 šifri artikala** iz BizniSofta sa nazivima.
2. Da li se ta šifra pojavljuje na fakturi koju kupac dobija?
3. Postoji li **barkod** u BizniSoftu? Pouzdaniji je most.

**Ako se ne poklapaju:** treba tabela mapiranja i **ručno povezivanje ~3.500 stavki**. To je posao za nedelje, ne dane, i mora ući u plan **pre** faze 4b.

---

## BLOKIRA FAZU 5

### P5 — Kako potvrđena porudžbina ulazi u BizniSoft? 🔴

**Šta je pretraženo:** `grep -ri 'biznisoft'` nad `app`, `lib`, `db`, `scripts`, `components`, `types` — **svi pogoci su tekst na ekranima, komentari i jedno neiskorišćeno polje.** `app/portal/biznissoft/page.tsx` je `redirect()` od 10 linija. `grep 'fetch(|axios'` nad portalom → **nula odlaznih poziva**. 🟢

**Zašto blokira:** određuje da li je T17 (dvostruko knjiženje) tehnički ili proceduralni rizik. Menja i AD-3: bez pisive veze, promena cene se **uvek** upisuje ručno.

**Šta dostaviti:**
1. Ima li BizniSoft **ikakav** način prijema dokumenta izvana? API, uvoz fajla, međubaza — bilo šta.
2. Ako **da** — dokumentacija ili kontakt podrške BizniSofta.
3. Ako **ne** — prihvata li kancelarija da porudžbine prekucava ručno? Koliko ih se očekuje dnevno?

> **Ručni prepis je prihvatljivo rešenje za pilot od 10–20 kupaca** i treba ga otvoreno planirati, ne tretirati kao privremenu sramotu.

---

### P6 — Može li se izvoz zakazati u 09:00? 🔴

**Zašto:** ceo `04-sync-agent-contract.md` polazi od toga da u izvoznom folderu **postoji svež fajl** u 09:00.

**Šta dostaviti:** ume li BizniSoft da automatski izveze po rasporedu, ili neko mora ručno pokrenuti izvoz? Ako je ručno — ko i u koliko sati?

---

### P7 — Koliko istorije prodaje postoji? 🔴

**Zašto:** preporuke traže obrazac. Sa 3 meseca istorije S2 (medijalni interval) i S6 (sezonalnost) nemaju smisla — treba bar 12–24 meseca.

**Šta dostaviti:**
1. Od kog datuma BizniSoft ima upotrebljivu istoriju?
2. Može li se izvesti odjednom ili samo po periodima?
3. Koliko približno redova?

**Ako je istorija kratka:** prva verzija preporuka koristi samo „šta je kupac već kupovao", bez sezonalnosti, uz nizak `confidence`. To je pošteno i korisno.

**Šta se već meri:** ekran `/portal/importi/spremnost` prikazuje koliko je istorije
**uvezeno** — raspon datuma, fakture po mesecu, parove (kupac, artikal) koji se
ponavljaju. Vidi [18 — spremnost podataka](18-data-readiness.md).

To **ne odgovara** na P7. Uvezeni raspon pokazuje samo šta jeste ušlo u sistem;
da bi sistem znao šta nedostaje, morao bi znati za dokument koji nikada nije
uvezen. Pitanje 1 iznad — od kog datuma BizniSoft ima upotrebljivu istoriju —
ostaje otvoreno i traži spoljnu evidenciju.

---

### P8 — Sme li tačan lager i tačna cena napustiti kancelariju? 🟡

**Zašto:** AD-4 kaže da je cloud **ograničeni read model**. Granica je poslovna odluka, ne tehnička.

**Tri odgovora Da/Ne:**
1. Sme li **tačna količina** na lageru biti u cloudu, ili samo dostupnost?
2. Sme li **efektivna cena kupca** biti u cloudu? *(Ako ne — portal ne može prikazati cenu i ceo koncept pada.)*
3. Sme li **istorija prodaje po kupcu** biti u cloudu?

**Utvrđeno bez pitanja:** nabavne cene i marže dobavljača **ne idu** u cloud ni pod jednim odgovorom.

---

### P9 — Postoji li BEX ugovor i pristupni podaci? 🔴

**Šta je pronađeno:** `.env.example` ima imena `BEX_BASE_URL`, `BEX_CLIENT_ID`, `BEX_API_KEY`, `FEATURE_BEX`. **Grep nad kodom ih ne nalazi.** Tri `PhaseNotice` ekrana ih pominju kao tekst. **Nula linija koda koji poziva BEX.** 🟢

**Šta dostaviti:** postoji li ugovor; postoji li **test okruženje** (bez njega se koristi jasno označen razvojni adapter i nijedna stvarna pošiljka se ne kreira); dokumentacija API-ja.

> **Vrednosti ključeva se ne šalju u chat ni u repozitorijum** — unose se direktno u okruženje servera.

---

### P10 — Kako magacin danas radi? 🔴

**Zašto:** zahtev izričito kaže da BEX integracija **bez magacinskog ekrana nije prihvatljiva**. Da bi ekran bio upotrebljiv, mora odgovarati stvarnom poslu.

**Šta dostaviti:** kako magacioner danas saznaje šta da spakuje; štampa li se nešto; kada se stvara BEX adresnica; ko meri težinu i dimenzije; šta kad roba nije dostupna posle potvrde.

---

## POSLOVNE ODLUKE — ne blokiraju kod, ali menjaju obim

### P11 — Ko odobrava kupčev nalog i kako se predaje pristup? 🟡

Zahtev kaže „ručno odobreni nalozi", ali ne i: ko otvara (owner? office? sales_rep predlaže?), kako kupac dobija pristup (poziv e-poštom? telefonom?), i može li **jedna firma imati više naloga** (vlasnik + nabavka).

**Predlog dok nema odgovora:** office otvara, kupac dobija poziv e-poštom sa jednokratnim linkom (TTL 72h), jedna firma sme više naloga. Struktura M3 to već podržava.

---

### P12 — Kakav je kancelarijski računar? 🔴

**Zašto:** određuje da li je Sync Agent uopšte izvodljiv kako je opisan.

**Šta dostaviti:** verzija Windowsa; ko ima administratorska prava; može li se otvoriti **namenski nalog bez admin prava**; postoji li antivirus/EDR koji bi blokirao nepotpisanu aplikaciju; da li računar ostaje uključen preko noći.

---

### P13 — Postoji li izvor „odgovarajućih zamena"? 🔴

**Zašto:** signal S10 u preporukama. `docs/PRODUCT_RECOMMENDATION_LOGIC.md` izričito kaže da automatskog zaključivanja nema i da tehničku kompatibilnost mora neko potvrditi. 🟢

**Šta dostaviti:** postoji li u BizniSoftu polje „zamenski artikal"? Ako ne — ko i kako potvrđuje da je artikal B zamena za A?

---

### P14 — Gde se hostuje baza i ko drži backup? 🟡

**Zašto:** T24 (kompromitovan backup) zavisi od izbora. `docs/portal/SETUP.md` pominje Neon i Supabase kao besplatne opcije 🟢, ali odluka nije doneta.

**Šta dostaviti:** prihvatljiv provajder; da li podaci smeju napustiti EU; ko drži ključeve za šifrovanje backupa; kolika je prihvatljiva tačka oporavka (RPO).

---

### P15 — Granice ovlašćenja za promenu marže 🟡

AD-3 opisuje workflow, ali ne i pragove.

**Šta dostaviti:** sme li `sales_rep` menjati sam do X%; iznad kog praga odlučuje `owner`; postoji li apsolutni donji prag ispod kog niko ne sme; razlikuju li se pragovi po brendu.

> **Mehanizam već postoji** — `system_settings` (`db/schema/system.ts`) je pravljen baš za pragove 🟢. Trebaju samo vrednosti.

---

### P16 — Šta kupac vidi kad nema cenu za artikal? 🟡

Ako artikal nije u cenovniku kupca: sakriti ga? Prikazati bez cene sa „Zatraži ponudu"? Prikazati cenovničku cenu uz napomenu?

**Predlog:** prikazati **bez cene**, sa „Zatraži ponudu". Skrivanje asortimana šteti prodaji; prikaz cenovničke cene rizikuje da kupac očekuje pogrešnu cenu.

⚠️ Napomena uz T5: prikaz artikla van cenovnika **ne sme** otkriti podatke koje kupac inače ne bi video.

---

### P17 — Sme li komercijalista poručiti u ime kupca bez njegovog znanja? 🟡

Zahtev to dozvoljava. Nije rečeno da li kupac dobija obaveštenje i vidi takvu porudžbinu.

**Predlog:** vidi je, jasno označenu („poručio: {ime}"), i dobija obaveštenje. Skrivanje bi narušilo poverenje ako se otkrije.

---

## Sažetak — po prioritetu

| # | Šta dostaviti | Oslobađa |
|---|---|---|
| **1** | Odgovor: **postoji li cenovnik po kupcu** + jedan izvoz + sa/bez PDV-a | **P2 — ceo projekat** |
| **2** | Jedan stvaran izvoz kupaca (anonimizovan) | P1 — faza 4b |
| **3** | Uzorak od 20–30 šifri artikala | P4 — veza katalog↔BizniSoft |
| **4** | Odgovor: postoji li izvoz lagera | P3 — faze 4b i 5 |
| **5** | Odgovor: kako porudžbina ulazi u BizniSoft | P5 — faza 5 |
| 6 | Tri Da/Ne o granici podataka | P8 — potvrda AD-4 |
| 7 | Opis kancelarijskog računara | P12 — izvodljivost agenta |
| 8 | BEX ugovor i test okruženje | P9 — faza 5 |
| 9 | Opis rada magacina | P10 — faza 5 |
| 10 | Pragovi marže, hosting, politika naloga | P15, P14, P11 |

**Stavke 1–3 su dovoljne da faza 4b krene.**
**Faze 1, 2, 3 i 4a ne čekaju ništa od ovoga i mogu početi odmah.**

---

## Kako bezbedno poslati uzorke

1. **Anonimizovati sadržaj, ne strukturu.** Zameniti nazive firmi i PIB-ove; **zadržati** imena kolona, separator, kodni raspored, format datuma i brojeva.
2. **Ne slati u chat ni u repozitorijum ako sadrži stvarne kupce.** `.gitignore:56` već blokira `/_incoming/*.csv` 🟢 — to je bezbedno mesto za lokalno odlaganje.
3. **Nikad ne slati lozinke, API ključeve ni `.env` vrednosti.** Za BEX i BizniSoft dovoljno je znati **da ključ postoji**; unosi se direktno u okruženje servera.
4. **Screenshot ekrana izvoza je često korisniji od samog fajla** — vidi se koje opcije uopšte postoje.
