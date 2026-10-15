# Proces pisanja i provere — Saveti i vodiči

Ovaj dokument važi za ljude i za AI pomoćnike. Pre pisanja obavezno pročitajte [UREDNICKI_VODIC.md](UREDNICKI_VODIC.md) i [TERMINOLOGIJA.md](TERMINOLOGIJA.md). Uzor za format i nivo je [vreme-upotrebljivosti-smese.md](../../content/saveti/clanci/vreme-upotrebljivosti-smese.md).

## 1. Gde su izvori (da se istraživanje ne ponavlja)

| Šta | Gde |
| --- | --- |
| Lokalni tehnički listovi (R-M 117, baslac 102, Carsystem 6 PDF) | `public/documents/products/<brend>/…`; tekst za brzu pretragu: `python3 scripts/saveti/izvuci-tekst-pdf.py` → `tmp/saveti/pdftext/` |
| Izvodi iz tehničkih listova (sa URL-om zvaničnog dokumenta) | `data/knowledge/*-tds-claims.generated.json`, `*-technical-extraction.generated.json` (`machine-extracted`: pre citiranja proveriti u samom dokumentu) |
| Proizvodi koje stvarno imamo (kanonski slugovi, linkovi na TDS) | `npx tsx --tsconfig tsconfig.json scripts/saveti/katalog-pregled.mts` → `tmp/saveti/catalog-digest.json`; porodice → `families-digest.json` |
| Zvanični izvori po brendu | `data/knowledge/brand-sources.ts`, `docs/*_DOCUMENT_SOURCE_MAP.md`, `docs/*_RESEARCH.md` |
| Novosti dobavljača (pregled od 2026-10-08) | `docs/saveti/istrazivanje/*-news.json` i `.md` |
| Stvarna pitanja (dokaz porekla pitanja) | `docs/saveti/istrazivanje/questions.json` (`found-in-source` / `editorial-proposal`) |
| Smernice platforme i pretrage | `docs/saveti/istrazivanje/platform.md` |
| Teme, ID-jevi i slugovi | `docs/saveti/INVENTAR.md` |

## 2. Pisanje jedne teme

1. Otvorite stub `content/saveti/clanci/<slug>.md`. Naslov, glavno pitanje i kategorija su dati. Naslov se sme doterati ako je jasniji, ali se pitanje ne sme promeniti tako da cilja tuđu temu.
2. Pronađite pitanje u `questions.json` i popunite `poreklopitanja`:
   ```yaml
   poreklopitanja:
     tip: pronadjeno-u-izvoru   # ili urednicka-procena
     napomena: "kratko: gde je pitanje viđeno"
     izvori:
       - https://…
   ```
3. Za svaku tehničku tvrdnju otvorite izvor i proverite je. Vrednost iz tehničkog lista navodi se uz `[^id]` i `verzija`.
4. Popunite `metaNaslov` (≤ 58), `opis` (70–160), `proizvodi` (samo kanonski slugovi ili `grupa:<slug>`), `povezani` (ID-jevi iz inventara, 2–5), `izvori`.
5. Postavite `status.pisanje: napisano`, `poslednjaProvera` (datum provere izvora) i `ponovniPregled` (trajni tekst: +12 meseci; tekst sa podacima proizvoda: +6 meseci; novost: isti datum kao `proveraVaziDo`).
6. Ako izvor nedostaje ili je protivrečan: `strucnaPotvrda: { potrebna: true, razlog: "…", status: potrebno }`. Tekst ostaje van rasporeda dok se ne potvrdi.
7. Pokrenite `npm run saveti:build` i ispravite sve greške u svojim fajlovima.

## 3. Provera (druga osoba ili drugi prolaz)

Recenzent **ne piše** tekst iz početka. On:

1. otvara svaki citirani izvor i proverava da li tvrdnja u tekstu tačno odgovara izvoru (vrednost, jedinica, uslov, proizvod, verzija);
2. traži tvrdnje bez izvora koje nisu opšte poznato znanje i uklanja ih ili dodaje izvor;
3. proverava da tekst ne prenosi podatke sa jednog proizvoda na drugi i da „mogući uzroci“ ne zvuče kao sigurna dijagnoza;
4. proverava jezik prema vodiču: ekavica, persiranje, terminologija, red reči i kalkovi;
5. proverava da se tekst ne preklapa sa srodnim temama iz inventara;
6. tek tada postavlja `tehnickaProvera: provereno` i `jezickaProvera: provereno`, ili `ispravke-potrebne` sa beleškom u `napomenaProvere`.

## 4. Odobrenje i raspored

```bash
npm run saveti:build
npm run saveti:odobri -- --id=SV-0111 --odobrio="Ime Prezime" --uloga="tehnički recenzent"
npm run saveti:plan
```

Odobrenje upisuje samo imenovana osoba iz firme. Posle izmene teksta otisak se menja i tekst traži novo odobrenje.

## 5. Nova novost posle ovog istraživanja

Jednokratno istraživanje nije trajno praćenje. Kada proizvođač objavi novost:

1. proveriti je na zvaničnom izvoru (datum, tržište, proizvod, da li je u našem programu);
2. napraviti novi fajl u `content/saveti/clanci/` sa `tip: novost`, sledećim slobodnim ID-jem i `proveraVaziDo` (najviše 60 dana);
3. napisati, proveriti, odobriti, pa pokrenuti `npm run saveti:plan`. Novost dobija prvi slobodan termin, a trajni tekstovi se pomeraju za jedan termin.

Predlog ritma: jednom mesečno pregled stranica sa vestima iz `docs/saveti/istrazivanje/*.md` (lista URL-ova je tamo).
