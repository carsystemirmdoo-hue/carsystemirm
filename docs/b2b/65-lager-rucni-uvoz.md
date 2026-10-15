# 65 — Ručni uvoz lagera iz BizniSofta (021 VELEPRODAJA)

Status (15. 10. 2026): **uvoz radi na Production-u za vlasnika i kancelariju (migracija 0050 primenjena 13. 10.); prikaz kupcima isključen.** Prvi stvaran uvoz (15. 10.) otkrio je drugi raspored izveštaja — vidi §1a.
Prva faza je ručni uvoz izvoza, bez BizniSoft WebService licence i bez veze sa bazom BizniSofta
(istraživanje WebService-a: dok. 64, lokalna grana). Automatsko preuzimanje izvoza iz foldera preko
Windows konektora je sledeća faza.

| Deo | Stanje |
|---|---|
| Parser izveštaja „Stanje zaliha“ (XLSX i CSV) | implementirano, jedinični testovi; stvaran primer od 24.08.2026 pročitan bez grešaka (brojevi u privatnoj evidenciji) |
| Otpremanje, pregled, potvrda, odbacivanje, evidencija (`/portal/zalihe/uvoz`) | implementirano; integracioni testovi i provera u pregledaču nad sintetičkom bazom |
| Migracija 0050 (`stock_imports`, `stock_import_lines`) | primenjena na Production 13. 10. 2026 |
| Prikaz kupcima („Stanje prema poslednjem izvozu…“) | pripremljen, **isključen** (dve brave, prag zastarelosti nije zadat) |
| Automatsko preuzimanje preko konektora | sledeća faza |

## 1. Šta se čita

Izveštaj **„STANJE ZALIHA“** iz BizniSofta, izvezen kakav jeste (XLSX iz štampe ili CSV). Raspored se
**prepoznaje**, ne pretpostavlja po broju reda ili kolone:

- zaglavlje izveštaja: naslov, „Na dan:“ (datum stanja), „Datum štampe:“, „Poslovni objekti:“ → mora
  biti tačno jedan objekat, **021 VELEPRODAJA**;
- zaglavlje tabele (red sa „Šifra“ i „Količina“) se ponavlja na svakoj strani; raspon kolone ide od
  naslova do sledećeg naslova, jer spojene ćelije pomeraju vrednost (u primeru naslov „Količina“ stoji u
  koloni X, a brojevi u Y);
- podnožje strane („Strana N od M“, „BizniSoft Poslovni Programi…“), prazni redovi i prelomi se
  preskaču; zbirni red „Ukupno stanje zaliha na dan:“ nije artikal.

Format fajla se prepoznaje po sadržaju (XLSX je ZIP), ne po ekstenziji. CSV: UTF-8 ili Windows-1250,
separator `;`, tab ili `,`.

**Čuva se samo:** izvorna šifra (tekst, kakva je u fajlu), ključ za vezu, naziv i izvorna količina.
**Ne čuva se:** nabavna cena, vrednosti, VP cena, % RuC, originalni fajl (samo SHA-256 i veličina).

### 1a. Dva rasporeda istog programa (od 15. 10. 2026)

| | A — „STANJE ZALIHA“ (primer 24.08.2026) | B — „STANJE ZALIHA ARTIKLA“ (prvi stvaran uvoz 15.10.2026) |
|---|---|---|
| Kolone | Šifra · Naziv robe · Stopa · Količina · Nab.Cena · Nab.Vred · VP Cena · VP Vred. · %RuC | Šifra · **GR.** · Naziv robe · **JM** · Količina · Cena · Vrednost |
| Zaglavlje strane | ponavlja se samo zaglavlje tabele | ponavljaju se i firma, adresa i naslov na svakoj strani |
| Filteri | svaki u svojoj ćeliji | u jednoj ćeliji, razdvojeni sa „·“ |
| Zbirni red | dve vrednosti (nabavna, VP) | jedna vrednost |

Uzrok neuspeha 15.10.: parser je granice kolona računao samo iz naslova koje koristi, pa je raspon
„Šifre“ (A–E) obuhvatio i kolonu „GR.“ („00“) — svaki red je imao dve vrednosti u rasponu šifre i
odbačen je kao neprepoznat (1.909). Ispravka (parser `/2`): granica je SVAKI naslov u zaglavlju tabele;
redovi zaglavlja izveštaja koji se ponove između strana prepoznaju se po sadržaju; kontrola zbira radi
za jednu ili dve kolone vrednosti; filteri se čitaju i iz delova razdvojenih sa „·“. Prag za
neprepoznate redove nije menjan. JM iz rasporeda B se ne koristi kao izvor — samo kao provera: ako se
razlikuje od potvrđenog pakovanja, za tu stavku nema broja pakovanja i diže se upozorenje.

Isti fajl je jedinstven (SHA-256): fajl koji je odbila starija verzija čitača ostaje zapisan kao
*neuspešno*, a ponovno otpremanje istog fajla prikazuje uputstvo da se izveštaj ponovo izveze iz
BizniSofta (nov izvoz je nov fajl).

## 2. Pravila

| Tema | Pravilo |
|---|---|
| Šifra | Tekst; vodeće nule se čuvaju kada postoje. Excel ih gubi (šifra je broj) → veza ide preko ključa bez vodećih nula, i samo kada je jednoznačna. Dve šifre u fajlu sa istim ključem = greška; dve šifre u portalu sa istim ključem = „sudar“, veza se ne pravi. |
| JM | Raspored A nema kolonu JM, raspored B ima. JM se **ne zaključuje iz naziva**; merodavna je samo potvrđena prodajna jedinica (`article_pack_sizes`, 0047). JM iz izveštaja služi samo kao provera: razlika → nema broja pakovanja + upozorenje. |
| Cela pakovanja | ⌊izvorna količina ÷ potvrđena količina pakovanja⌋, samo uz potvrđenu vezu artikla, JM i pakovanje. Inače nema broja. |
| Brojevi | XLSX broj je broj. Tekst: decimalni zarez ili tačka; „1.234“ / „1,234“ se tumači samo kada je separator za ceo fajl utvrđen iz nedvosmislenih vrednosti, inače greška. Mešani separatori = greška. |
| Prazna količina | Nije nula (`NULL`, upozorenje). |
| Izostavljen artikal | Nije nula — nepoznato. |
| Negativna količina | Čuva se kao nalaz za administraciju (upozorenje); kupcu se nikad ne prikazuje. |
| Raspoloživost | Formula se ne izmišlja. Prikazuje se **stanje iz izvoza**, uz napomenu da raspoloživost potvrđuje kancelarija. |
| Datumi | Datum stanja iz sadržaja izveštaja; datum štampe odvojeno; vreme otpremanja i potvrde beleži portal. Vreme izvoza izveštaj ne navodi i ne izmišlja se. |
| Potpunost | Zbir „Nab.Vred“ i „VP Vred.“ mora odgovarati redu „Ukupno“; sve strane „N od M“ moraju postojati; količina × cena se proverava po redu. Cene se koriste samo za ovu proveru u memoriji. |
| Stari brendovi | Prisustvo artikla (npr. 3M, sia) u lageru ne vraća ga u javni katalog. |

Greške blokiraju potvrdu; upozorenja ne blokiraju, ali su prikazana u pregledu.

## 3. Tok i evidencija

1. **Otpremanje** (`imports:write` — vlasnik i kancelarija): fajl se čita i upisuje kao *pregled*.
   Isti fajl (isti SHA-256) otvara postojeći pregled — nema duplikata. Fajl sa greškama dobija status
   *neuspešno* i ostaje u evidenciji.
2. **Pregled**: objekat i datumi, broj prepoznatih stavki, povezani i nepovezani artikli, sudari,
   stavke bez potvrđene JM/pakovanja, negativne i prazne količine, greške i upozorenja.
3. **Potvrda** (isto pravo + drugi faktor u poslednjih 10 minuta): jedna transakcija; *pregled* →
   *potvrđeno*. Važeći snimak = poslednje potvrđeno otpremanje. Stariji datum stanja od važećeg se ne može
   potvrditi. Neuspešno ili odbačeno otpremanje ne menja važeći snimak.
4. **Odbacivanje** sa razlogom.

Stavke se samo dodaju; podaci otpremanja se ne menjaju; otpremanje se ne briše (okidači u 0050, prava u
`db/provisioning/runtime-role.sql`). Svaki korak ima red u `audit_log`.

## 3a. Čuvanje podataka i prostor

**Šta se čuva i gde** (Postgres baza portala, Neon; ne Vercel):
- `stock_imports` — jedan red po otpremanju: ime fajla, veličina, SHA-256, format, verzija parsera,
  objekat, datum stanja i štampe, sažetak (brojevi, kontrola, JM razlike), greške i upozorenja (kodovi,
  bez cena), ko je i kada otpremio i odlučio;
- `stock_import_lines` — šifra, ključ, naziv i izvorna količina po stavci, samo za fajl koji je prošao
  proveru;
- `audit_log` — trag otpremanja, potvrde i odbacivanja.

**Originalni fajl se ne čuva nigde** — ni u bazi, ni na Vercel-u, ni u repozitorijumu. Server ga čita u
memoriji tokom otpremanja; ostaju samo SHA-256 i veličina. Cene, vrednosti i marže iz izveštaja ne
napuštaju parser.

**Neuspešan pokušaj (15.10., Production):** jedan red u `stock_imports` (status *neuspešno*, 0 stavki,
sažetak 568 B, problemi 353 B), bez ijedne stavke i bez fajla.

**Izmereno** (lokalno, posle `VACUUM`, stvaran izvoz 15.10. = 1.810 stavki): `stock_import_lines`
≈ 330 B po stavci (podaci ≈ 130 B, tri indeksa ≈ 200 B) → **≈ 0,6 MB po uvozu**; zaglavlje otpremanja
1–2 KB. Na Production-u posle neuspešnog pokušaja: obe tabele 112 kB; cela baza 92 MB.

**Procena godišnjeg rasta** (≈ 250 radnih dana, ≈ 1.800 stavki): jedan uvoz dnevno ≈ 150 MB/god;
dva uvoza dnevno ≈ 300 MB/god. Neon Free plan ima 1 GB po projektu (podignuto sa 0,5 GB; proveriti u
Neon konzoli). Veličina baze se ne meša sa Vercel Deployment Storage-om (izlaz builda, drugi limit).

**Pravilo čuvanja (usvojeno 15. 10. 2026, migracija 0051):**
- detaljne stavke se čuvaju **samo za poslednja dva uspešno potvrđena snimka** — ne po kalendaru,
  nego po potvrdama: tek kada se potvrdi novi snimak, stavke trećeg najnovijeg se brišu;
- nov upload, neuspela provera, nepotvrđen ili odbačen fajl ne mogu obrisati nijedan od ta dva
  snimka (pravilo se računa samo nad potvrđenima; neuspešni pokušaji ne zauzimaju mesto);
- provereni, ali nepotvrđeni i odbačeni uvozi gube stavke **7 dana** posle otpremanja; takav uvoz
  se posle toga ne može potvrditi (otpremiti nov izvoz);
- za starije uvoze ostaje mala evidencija u `stock_imports`: datum stanja, ko je uvezao i potvrdio,
  ishod, broj stavki, otisak fajla (SHA-256), sažetak bez liste artikala, uz oznaku
  `lines_purged_at` / `lines_purged_reason`; `audit_log` ostaje ceo. Istorija označava „stavke
  uklonjene po pravilu čuvanja“;
- mesečne kopije lagera se u aplikaciji ne čuvaju.

**Kako se briše:** ograničen postupak `stock_import_retention()` (SECURITY DEFINER, bez parametara,
fiksan `search_path`). Aplikacioni nalog ima samo EXECUTE na njemu — i dalje nema DELETE nad
stavkama ni pravo da upiše oznaku čišćenja; okidači to dozvoljavaju samo vlasniku tabele. Potvrda
novog snimka i čišćenje su u jednoj transakciji pod istim savetodavnim zaključavanjem, pa se
paralelne potvrde izvršavaju jedna za drugom. Postupak se poziva pri potvrdi, otpremanju i
odbacivanju. Stavke nemaju drugih veza (nijedna tabela ih ne referencira); važeći snimak za
prikaz je uvek među dva sačuvana.

Uz jedan uvoz dnevno lager tako zauzima ≈ 1,2 MB stavki + ≈ 1–2 KB po zapisu otpremanja.

## 4. Prikaz kupcima — isključen

Kupac vidi stanje tek kada su otključane **obe brave**:

1. okruženje: `STOCK_CUSTOMER_DISPLAY=1`;
2. podešavanje vlasnika `system_settings['stock.customerDisplay']`:
   `{ "enabled": true, "maxAgeDays": N }` — prag zastarelosti u danima od **datuma stanja**.
   Prag nema podrazumevanu vrednost; ranije predloženi 75 min / 18 h nisu usvojeni.

Kada je uključeno, panel kupovine prikazuje za izabrano pakovanje: „Prema izvozu: N × 5 L“ (ili „nema
celog pakovanja“), zatim „Stanje prema poslednjem izvozu: dd.mm.gggg.“ (samo datum, jer izvor nema
vreme), odvojeno „Uvezeno dd.mm.gggg. u hh:mm“ i „Raspoloživost potvrđuje kancelarija.“ Bez potvrđene
veze, JM ili pakovanja — nema broja. Isključen prikaz ne čita tabele lagera.

## 5. Uputstvo za kancelariju (koraci na strani: izbor fajla → provera → potvrda)

1. U BizniSoftu otvorite izveštaj **„Stanje zaliha“**: poslovni objekat **021 VELEPRODAJA**, „Na dan“ =
   dan za koji šaljete stanje.
2. Izvezite u **Excel (XLSX)** ili CSV. Fajl ne sređujte — prazne kolone, zaglavlja i strane ostaju.
3. Portal → **Zalihe → Uvoz lagera** (`/portal/zalihe/uvoz`) → izaberite fajl → „Otpremite na pregled“.
4. Proverite: objekat 021, datum stanja, broj stavki, kontrolu potpunosti (zeleno), greške (moraju biti
   0) i upozorenja.
5. Ako je sve u redu: označite potvrdu → „Potvrdite lager“. Ako traži drugi faktor, odjavite se i
   prijavite ponovo. Ako nije u redu: „Odbacite otpremanje“ sa razlogom i izvezite ponovo.
6. Isti fajl dva puta ne pravi duplikat. Stariji izvoz ne može zameniti noviji.

## 6. Aktivacija na Production-u

1. ✅ Migracije 0045–0050 (13. 10. 2026, posle proverene kopije baze) i objava koda.
2. ⏳ Prvi stvaran izvoz: otpremanje i provera na Production-u, poređenje sa BizniSoftom, potvrda
   (15. 10. odbijen zbog rasporeda B — ispravljeno parserom `/2`; potreban nov izvoz, §1a).
3. ⏳ Odluka vlasnika o pragu zastarelosti i prikazu; tek tada `STOCK_CUSTOMER_DISPLAY=1` i podešavanje
   (`enabled`, `maxAgeDays`).
4. ✅ Pravilo čuvanja (§3a, 0051).

## 7. Provere

- `npm run test:stock` — parser, brojevi, datumi, veza, politika prikaza (sintetički izveštaj:
  `fixtures/dev/biznisoft/lager/`, generator `scripts/fixtures/build-stock-report-fixture.py`).
- `db/integration/stockImport.integration.test.mts` — prava, duplikat, neuspešan fajl, stariji datum,
  okidači, bez cena u bazi, brave prikaza.
