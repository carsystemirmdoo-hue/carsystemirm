# 65 — Ručni uvoz lagera iz BizniSofta (021 VELEPRODAJA)

Status (13. 10. 2026): **implementirano i testirano lokalno; na Production-u nije aktivno.**
Prva faza je ručni uvoz izvoza, bez BizniSoft WebService licence i bez veze sa bazom BizniSofta
(istraživanje WebService-a: dok. 64, lokalna grana). Automatsko preuzimanje izvoza iz foldera preko
Windows konektora je sledeća faza.

| Deo | Stanje |
|---|---|
| Parser izveštaja „Stanje zaliha“ (XLSX i CSV) | implementirano, jedinični testovi; stvaran primer od 24.08.2026 pročitan bez grešaka (brojevi u privatnoj evidenciji) |
| Otpremanje, pregled, potvrda, odbacivanje, evidencija (`/portal/zalihe/uvoz`) | implementirano; integracioni testovi i provera u pregledaču nad sintetičkom bazom |
| Migracija 0050 (`stock_imports`, `stock_import_lines`) | proverena na izolovanoj test bazi; **nije primenjena na Production** |
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

## 2. Pravila

| Tema | Pravilo |
|---|---|
| Šifra | Tekst; vodeće nule se čuvaju kada postoje. Excel ih gubi (šifra je broj) → veza ide preko ključa bez vodećih nula, i samo kada je jednoznačna. Dve šifre u fajlu sa istim ključem = greška; dve šifre u portalu sa istim ključem = „sudar“, veza se ne pravi. |
| JM | Izveštaj nema kolonu JM. JM se **ne zaključuje iz naziva**; merodavna je samo potvrđena prodajna jedinica (`article_pack_sizes`, 0047). |
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

## 5. Uputstvo za kancelariju

1. U BizniSoftu otvorite izveštaj **„Stanje zaliha“**: poslovni objekat **021 VELEPRODAJA**, „Na dan“ =
   dan za koji šaljete stanje.
2. Izvezite u **Excel (XLSX)** ili CSV. Fajl ne sređujte — prazne kolone, zaglavlja i strane ostaju.
3. Portal → **Zalihe → Uvoz lagera** (`/portal/zalihe/uvoz`) → izaberite fajl → „Otpremite na pregled“.
4. Proverite: objekat 021, datum stanja, broj stavki, kontrolu potpunosti (zeleno), greške (moraju biti
   0) i upozorenja.
5. Ako je sve u redu: označite potvrdu → „Potvrdite lager“. Ako traži drugi faktor, odjavite se i
   prijavite ponovo. Ako nije u redu: „Odbacite otpremanje“ sa razlogom i izvezite ponovo.
6. Isti fajl dva puta ne pravi duplikat. Stariji izvoz ne može zameniti noviji.

## 6. Aktivacija na Production-u (nije urađeno u ovom koraku)

1. Migracije **0045–0050 redom** po postupku dok. 59 (vlasnik baze, sveža kopija pre, snimak pre/posle).
   Redosled je obavezan: Drizzle primenjuje samo migracije novije od poslednje primenjene.
2. Objava koda koji sadrži 0045–0050 (do tada se ovaj kod ne sme objaviti na Production — dok. 59 §2:
   bez 0045 niko ne može da se prijavi).
3. Prvi stvaran izvoz: otpremanje i pregled na Production-u, poređenje sa BizniSoftom, potvrda.
4. Odluka vlasnika o pragu zastarelosti i prikazu; tek tada `STOCK_CUSTOMER_DISPLAY=1` i podešavanje
   (`enabled`, `maxAgeDays`).

## 7. Provere

- `npm run test:stock` — parser, brojevi, datumi, veza, politika prikaza (sintetički izveštaj:
  `fixtures/dev/biznisoft/lager/`, generator `scripts/fixtures/build-stock-report-fixture.py`).
- `db/integration/stockImport.integration.test.mts` — prava, duplikat, neuspešan fajl, stariji datum,
  okidači, bez cena u bazi, brave prikaza.
