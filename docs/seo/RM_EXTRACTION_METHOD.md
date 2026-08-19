# R-M ekstrakcija — metodologija i ograničenja

Datum: 2026-08-08

Kako je tehnički sadržaj izvučen iz R-M dokumentacije, šta je namerno izostavljeno i gde su granice pouzdanosti.

## Osnovno pravilo

**IZVUCI — NE ZAKLJUČUJ.**

Vrednost ulazi u skup podataka samo ako je eksplicitno napisana u izvornom dokumentu. Nijedna vrednost nije izvedena iz naziva proizvoda, kategorije, sistema, sličnog proizvoda ni iz opšteg znanja o autolakirerstvu.

Dve posledice koje se vide u podacima:

1. **Ćutanje je NEPOZNATO, nikad podrazumevana vrednost.** Ako list ne pominje aluminijum, proizvod nema podatak o aluminijumu. To nije zabrana.
2. **Nejasnoća se čuva, ne razrešava.** Kada normalizacija zahteva tumačenje, strukturirana vrednost ostaje prazna, a izvorna formulacija se zadržava za stručnjaka.

## Alat

`pypdf` (Python). Na ovoj mašini nema `pdftotext`, `mutool`, `qpdf` ni `ghostscript`, pa je ekstrakcija teksta rađena kroz Python, a obrada u Node-u.

## Poznata ograničenja

### 1. Ligature

PDF-ovi sadrže tipografske ligature (`ﬁ`, `ﬂ`, `ﬀ`), pa sirovi tekst daje `ﬂash oﬀ`, `ﬁlm`, `speciﬁed`. Regex pisan protiv ljudskog pravopisa ne bi uhvatio ništa.

Sva obrada prolazi kroz `normaliseText()` u `scripts/lib/rm-pdf-text.mjs`.

### 2. Spojene kolone pištolja

28 dokumenata navodi dve kolone — `Compliant Gravity Spray Gun` i `HVLP Spray Gun`. Pri ekstrakciji se spajaju u jedan red:

```
Nozzle Size 1.3 -1.4 1.3 -1.5
```

Ne postoji pouzdan način da se odredi koja vrednost pripada kom pištolju bez tumačenja. Za tih 28 proizvoda **strukturirana vrednost nije dodeljena**; zadržan je izvorni tekst i stavka je označena kao nejasna.

Zbog toga je `sprayGun` popunjen za samo 11 od 39 proizvoda koji uopšte imaju sekciju o dizni. To je namerno.

### 3. Opisne vrednosti odzračivanja

37 od 39 `Flash Off` izjava nije brojčano. Primeri iz listova:

- „No flash off before oven drying."
- „Flash off between spray coats until mat, no flash off before drying."
- „Until surface is completely mat. Use Venturi system."

Pretvaranje ovoga u broj minuta izmislilo bi parametar koji list ne navodi. Zadržan je tekst.

### 4. Šifre proizvoda

R-M šifre su alfanumeričke (`H 2A14`, `HB 032`, `RA 050X`, `P 5480`), ne čisto numeričke.

Obrazac zahteva razmak između slova i broja. Bez tog razmaka isti obrazac hvata i granulacije brusnog papira (`P400`, `P600`) i pretvara specifikaciju abraziva u nepostojeću referencu na proizvod.

### 5. Uslovne izjave o podlozi

Neki listovi razdvajaju bezuslovnu i uslovnu listu:

```
Product is suitable on
  OEM parts with e-coat
  Old paintwork
  GRP / SMC
If bare metal areas are primed, the product can be used on
  Sheet steel
  Galvanized sheet steel
  Aluminium
```

Ove dve liste **nisu iste tvrdnje**. Druga je slabija i mapira se na `requires-primer`, a ne na `suitable`. Spajanje bi promenilo tehničko značenje.

5 proizvoda ima ovakvu uslovnu izjavu.

### 6. Product information PDF-ovi

59 `product-information` dokumenata nije izvor. Provera sadržaja pokazuje da su to sačuvane veb-stranice sa linkom ka TDS-u — oko 177 znakova teksta, bez ijedne tehničke vrednosti. Isključeni po tipu dokumenta.

### 7. Komponentni listovi

16 listova (učvršćivači, razređivači, aditivi) sadrži samo sekcije `Application` i `Remarks`. Njihovi parametri mešanja stoje u listu premaza, ne u sopstvenom. Čitljivi su i obrađeni, ali daju malo strukturiranih vrednosti — to je svojstvo izvora, ne propust obrade.

## Šta nije rađeno

- Nije korišćena pretraga interneta.
- Nije korišćeno opšte znanje o autolakirerstvu.
- Nisu spajane dve odvojene izjave u jaču tvrdnju.
- Nisu popunjavane praznine „jer je očigledno".
- Nijedan konflikt nije automatski razrešen.

## Zaštita od objavljivanja

Sve izvučeno nosi status `machine-extracted`, koji `Claim` gate iz Faze 2 tretira kao neobjavljivo. `publishedValue()` propušta samo `expert-verified`.

`scripts/validate-knowledge.mjs` proverava to nad **izgrađenim HTML-om**: 12 markera × 832 stranice, plus višerečne formulacije podloga na 58 R-M stranica. Provera je verifikovana i negativno — ubacivanjem veštačkog curenja, koje je uredno prijavljeno.

## Pokretanje

```bash
npm run knowledge:pipeline    # inventar → ekstrakcija → analiza → intenti → review pack
npm run knowledge:validate    # zahteva prethodni npm run build
```
