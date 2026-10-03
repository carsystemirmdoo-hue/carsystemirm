# 35 — Šta tražimo od kancelarije i BizniSoft-a

**Status (2026-10-02): zahtev, ništa nije primljeno.** Objedinjuje
[23 §4](23-partner-registry-and-account-verification.md),
[25 §2](25-f7-ordering-preparation.md) i
[26 §5–6](26-f8-catalog-buying-and-biznisoft-refresh.md) u jedan spisak za
kancelariju. Plan uvoza: [34](34-prelazak-na-stvarne-podatke.md).

**Format izvoza ne propisujemo.** Tražimo ono što BizniSoft već ume da izveze,
neizmenjeno, uz snimak ekrana sa kog je izvoz napravljen. Uvoznik se piše tek
posle pregleda uzorka. Bez uzorka nema konačnog uvoza cenovnika ni rabata.

## 0. Pravila za svaki izvoz

1. **Prvo uzorak, pa ceo izvoz.** Uzorak: 20–50 redova u stvarnoj strukturi.
2. **Neizmenjen fajl**: bez ručnog sređivanja, brisanja kolona, spajanja ćelija
   i međuzbirova. Ako BizniSoft nudi više formata (XLSX, CSV, XML), pošaljite
   onaj koji se najlakše pravi redovno.
3. **Snimak ekrana** izvoza (meni, filteri, datum) — da bi se isti izvoz mogao
   ponoviti.
4. **Napišite uz fajl**: kodnu stranu ako je CSV (npr. UTF-8 ili Windows-1250),
   separator kolona, decimalni separator, format datuma.
5. **Datum stanja** u nazivu fajla ili u poruci (npr. „stanje 2026-10-15").
6. **Uzorak ide anonimizovan** kada to ne kvari strukturu (kupci zamenjeni,
   kolone zadržane); ceo izvoz ide samo privatnim kanalom, nikad e-poštom na
   spoljne adrese ni u git.

## 1. Šifarnik partnera (kupci)

Obavezna polja: **šifra partnera** · **naziv** · **PIB** · **matični broj** ·
mesto · adresa · **šifra komercijaliste** · **aktivan da/ne**.

Ako postoje: tip partnera (kupac/dobavljač) · šifra sedišta za poslovnice ·
e-pošta · telefon · datum poslednje izmene.

Već imamo: `Kupci_BizniSoft_priprema.xlsx` (594 partnera, [23 §3](23-partner-registry-and-account-verification.md)).
To je **priprema, ne sirov izvoz** — treba i sirov izvoz istih polja.

## 2. Šifarnik artikala

Obavezna polja: **interna šifra** · **naziv** · **jedinica mere** · grupa ·
brend ili dobavljač · **PDV stopa** · **aktivan da/ne**.

Ako postoje: pakovanje i koliko JM je u pakovanju · šifra proizvođača /
kataloški broj · barkod.

Pravilo iz kataloga: interna šifra je tekst (vodeće nule se čuvaju); šifra
proizvođača se ne izmišlja kada je nema.

## 3. Važeći prodajni cenovnik

Obavezna polja: **interna šifra artikla** · **cena bez PDV-a** · **valuta** ·
**važi od** · **naziv cenovnika**.

Pitanja: ima li više cenovnika i koji je osnovni za veleprodaju? Cena po JM ili
po pakovanju?

> Uvoz cenovnika **ne postoji** u kodu (tabele `price_lists` /
> `price_list_items` puni samo sintetički seed). Pravi se tek iz uzorka, uz
> testove i pregled razlike pre aktivacije.

## 4. Uslovi po kupcu (rabati i posebne cene)

Obavezna polja: **šifra partnera** · **na šta se odnosi** (artikal, grupa,
brend ili sve) · **rabat %** ili **posebna cena** · **važi od** · važi do.

Pitanje: gde se u BizniSoftu vode rabati po kupcu i može li se to izvesti kao
tabela?

## 5. Prodajni dokumenti — istorija

Najvažniji izvoz. **Jedan red po stavci**, period **najmanje 24 meseca**.

| Polje | Obavezno |
|---|---|
| izdavalac (firma u BizniSoftu) | da |
| tip dokumenta (faktura, povraćaj, knjižno odobrenje, storno, korekcija) | da |
| broj dokumenta i poslovna godina | da |
| status (proknjižen / storniran / nacrt) | da |
| datum dokumenta i datum prometa | da |
| šifra partnera (i PIB sa dokumenta) | da |
| broj originalnog dokumenta za storno / povraćaj / odobrenje | da, gde postoji |
| redni broj stavke | da |
| šifra artikla, naziv, JM | da |
| količina (sa predznakom kako stoji) | da |
| cena bez PDV-a, rabat %, vrednost bez PDV-a, stopa PDV-a, vrednost sa PDV-om, valuta | da |
| šifra komercijaliste na dokumentu | poželjno |

## 6. Uzorci koje treba posebno pronaći

- **Korektivni dokumenti** sa vidljivom vezom na original: po jedan storno,
  povraćaj robe, knjižno odobrenje, korekcija cene i korekcija popusta — i PDF
  i red u izvozu iz §5.
- **PDF faktura čija se tabela nastavlja na sledećoj strani.**
- **Kontrolni primer za cene:** 2–3 kupca sa poznatim rabatima i po jedna
  njihova skorašnja faktura — da naš obračun dâ isti iznos kao BizniSoft.

## 7. Lager (kasnije, posle cenovnika)

Snimak po magacinu: interna šifra · magacin · količina · da li je raspoloživo
ili ukupno · **vreme stanja**. Odluka vlasnika: sme li kupac da vidi tačan
lager ili samo „ima / nema / na upit".

## 8. Pitanja za BizniSoft podršku

1. Može li BizniSoft sam, po rasporedu, da izvozi šifarnike, cenovnik, rabate
   i lager u jednu fasciklu? Ako ne — ko i kada izvozi ručno?
2. Postoji li pristup bazi samo za čitanje (ODBC/SQL) ili API?
3. Može li BizniSoft da uveze narudžbenicu ili predračun iz fajla?

## 9. Originalni PDF-ovi i konektor

**Gde su originali.** Konektor (`connector/`, [21](21-windows-connector.md))
čita samo PDF-ove iz **jedne izričito podešene fascikle** (`izvorniFolder`,
apsolutna putanja, bez podfascikli) na računaru u kancelariji. Fajlove **ne
menja, ne premešta, ne briše i ne kopira**. Originali ostaju tamo gde ih
BizniSoft ostavi.

**Šta konektor čuva** (lokalni red, SQLite u fascikli stanja): otisak bajtova
(SHA-256), poslednju putanju, veličinu i potpisano telo zahteva (kanonski JSON
sa poslovnim podacima) dok server ne potvrdi prijem. PDF bajtovi **ne napuštaju
računar**.

**Šta čuva server:** otisak fajla, ime fajla, pročitane stavke
(`source_document_lines`, uz `raw_cells`) i verziju parsera. **Sam PDF se ne
čuva nigde osim u fascikli u kancelariji.**

**Posledica: arhivu PDF-ova čuva kancelarija.** Ako se ta fascikla očisti ili
disk izgubi, original postoji samo u BizniSoftu. Treba odlučiti ko pravi
rezervnu kopiju fascikle i koliko dugo.

**Ponovna obrada — šta postoji:**

| Slučaj | Kako |
|---|---|
| Kupac nije bio mapiran | dokument čeka (`invoice_id IS NULL`); posle mapiranja ga knjiži `postAwaitingMapping` iz sačuvanih stavki — PDF nije potreban |
| Isti fajl ponovo (isti bajtovi, drugo ime) | prepoznaje se po otisku, „isti fajl, preskočeno", promet se ne menja |
| Izmenjen fajl na istoj putanji | novi otisak → novi pokušaj; isti poslovni identitet sa drugim sadržajem ide na ručni pregled, ne knjiži se dva puta |
| Pad konektora usred slanja / izgubljen odgovor | stavka se vraća u red i šalje ponovo; server odgovara `duplicate_file`, faktura je jedna |

**Ponovna obrada — šta NE postoji:** ponovno čitanje već primljenog PDF-a
posle ispravke parsera. Server ga odbija kao isti fajl, a sam PDF nema. Za to
bi trebao poseban, ovlašćen tok (nova verzija parsera + zamena izvornog zapisa
kroz reviziju, uz trag u `audit_log`). **Nije napravljeno**; ne raditi ručnim
brisanjem redova u bazi.

## 10. Redosled prijema

1. Uzorci §1, §2, §5 i §6 → profil strukture → uvoznik partnera i artikala.
2. Uzorak §3 i §4 + kontrolni primer → uvoz cenovnika i rabata sa testovima.
3. Ceo izvoz, u talasima po [34 §3](34-prelazak-na-stvarne-podatke.md).
4. Lager i redovni izvoz po rasporedu.
