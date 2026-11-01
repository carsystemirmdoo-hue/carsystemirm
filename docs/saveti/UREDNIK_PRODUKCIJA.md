# Urednik članaka — uključivanje na Production (zaseban korak, traži odobrenje vlasnika)

Urednik članaka u poslovnom panelu (`/portal/clanci`) i meni „Saveti i podrška“ su na grani
`feat/saveti-i-podrska-2026-11-01`. Grana je proverena na lokalnoj test bazi. Na Production-u ništa od
ovoga **nije uključeno** dok vlasnik ne odobri svaki korak ispod.

## Šta je izrađeno

- **Panel `/portal/clanci`**:
  - spisak sa pretragom i filterima (Nacrt, Za pregled, Odobren, Zakazan, Objavljen, Povučen), uz oznaku „čeka stručnu potvrdu“;
  - urednik bez pisanja koda, naslovna slika sa alt tekstom, izvori i interne napomene (nikad javno);
  - pregled u izgledu sajta (računar i telefon), istorija, verzije i vraćanje ranije verzije.
- **Pristup**:
  - `view:clanci`, `articles:edit`, `articles:approve` i `articles:publish` ima samo uloga „gazda“, i nijedan paket ih ne dodeljuje;
  - odobravanje, upis stručne potvrde, zakazivanje, objava i povlačenje traže svež drugi faktor.
- **Odobrenje** važi za tačnu verziju sadržaja, jer se pamti otisak teksta, slike i izvora:
  - svaka izmena javnog sadržaja poništava odobrenje i otkazuje termin;
  - izmena samo internih napomena ga ne poništava.
- **Stručna potvrda** je zaseban uslov:
  - tekst označen da je traži ne može biti odobren dok potvrda imenovanog stručnjaka nije upisana za tu verziju;
  - izmena teksta traži novu potvrdu;
  - oznaka se ne može ukloniti, što sprečava okidač u bazi.
- **Objava**:
  - vlasnik zakazuje datum i vreme po vremenu Srbije ili objavljuje odmah;
  - kod objavljenog članka javna ostaje poslednja odobrena verzija, sve dok nova ne bude odobrena i objavljena ili dok se članak ne povuče.
  - **Raspored cele arhive ne postoji**: ništa se ne objavljuje samo od sebe.
- **Meni „Saveti i podrška“** objedinjuje programe, biblioteku vodiča, dokumentaciju i tehničku podršku. Grupa biblioteke se prikazuje tek kada postoji bar jedan objavljen članak.

## Kako članak postaje javan u zakazano vreme

Najjednostavniji pouzdan način, bez zakazanog posla i bez novog servisa:

1. **Javni upit sam proverava termin.** `lib/saveti/index.ts` prikazuje zakazanu, odobrenu verziju čim termin prođe, tako što ga poredi sa trenutkom generisanja strane.
2. **Strane se obnavljaju na 60 sekundi** (ISR): `/vodici`, članci, teme, feed, stranice programa i `/api/saveti/stanje` za meni. Članak je javan najkasnije oko minut posle termina. Lokalna proba: 5 s posle termina.
3. **Radnje u panelu osvežavaju strane odmah**: objava odmah, objava izmena i povlačenje.
4. **Objava se naknadno upisuje** (javna verzija, događaj, revizija) pri svakom otvaranju panela i pre svake radnje nad člankom.
   - Ruta `/api/saveti/objava` radi isto, ali nije uslov objave i zakazani posao (cron) nije uključen.
   - Ako se ikad uključi, poziv je bezbedan za ponavljanje: jedno zakazivanje daje najviše jednu objavu.

Vreme se unosi po vremenu Srbije (Europe/Belgrade), a prelazak na letnje i zimsko vreme rešava `lib/saveti/vreme.mjs`.

## Koraci za Production (svaki uz posebno odobrenje)

1. **Kopija baze** (rezervna kopija preko GitHub Actions) i provera vraćanja, kao kod ranijih migracija.
2. **Migracija 0058** nalogom vlasnika baze.
   - Pokreće se `node db/migrate.mjs` sa `MIGRATION_DATABASE_URL`, zatim prava aplikacionog naloga iz `db/provisioning/runtime-role.sql`, blok „Saveti i vodiči (0058)“.
   - Pravi 7 novih tabela i ne menja postojeće podatke.
   - **Redosled:** draft PR #25 (cene po kupcu) nosi migraciju `0057`, čije je vreme u dnevniku ranije od 0058. Ako 0058 bude primenjena pre 0057, alat za migracije bi 0057 preskočio. Zato pre spajanja PR #25 posle ove grane njegovoj migraciji treba povećati vreme u `_journal.json` iznad vremena 0058 (1793455200000) ili najpre primeniti 0057.
3. **Spajanje grane u main i push.** Javni `/vodici` posle toga čita samo objavljene verzije iz baze. Dok ih nema, prikazuje poruku da su tekstovi u pripremi, kao sada, a meni nema grupu biblioteke.
4. **Početni uvoz tekstova**: `node scripts/saveti/uvezi-u-bazu.mjs` (proba), pa `--upisi`.
   - Uvozi 224 teksta: 184 kao „Za pregled“ i 40 kao „Nacrt“ sa oznakom „traži stručnu potvrdu“ i razlogom.
   - Ništa se ne odobrava, ne zakazuje ni ne objavljuje.
5. **Slike** se čuvaju u istoj Postgres bazi (`saveti_slike`, WebP do 2 MB, obično 0,2–0,5 MB).
   - Nema novog servisa ni troška.
   - Na Neon Free (0,5 GB) to je dovoljno za nekoliko stotina slika; kapacitet treba pratiti.
6. **Objava pojedinačnih članaka** je posebna odluka vlasnika u panelu.

Nijedan korak ne uvodi plaćeni servis. `CRON_SECRET` i `crons` u `vercel.json` **nisu potrebni**.

## Povratak

- **Kod**: vraća se na prethodni commit (main pre spajanja). Meni i `/vodici` se vraćaju na staro stanje.
- **Baza**: `db/rollback/0058_saveti_urednik.down.sql`, posle kopije baze i vlasnikom baze.
  - Uklanja tabele rubrike i red migracije u `drizzle.__drizzle_migrations`.
  - Tekstovi iz repozitorijuma ostaju u `content/saveti`, ali izmene, odobrenja i slike napravljeni u panelu se gube; zato je kopija baze obavezna.
- **Proba vraćanja**: migracija i povratak isprobani su na lokalnoj test bazi (vidi „Provere“).

## Provere na radnoj grani

- `lib/saveti/urednik/*.test.mjs` proverava:
  - pravila statusa, odobrenja i stručne potvrde;
  - termin iz datuma i vremena Srbije (i preko promene sata);
  - javnost od termina;
  - kružni prolaz urednika kroz svih 224 teksta bez gubitka.
- `db/integration/savetiUrednik.integration.test.mts` proverava:
  - ceo tok i zabranu drugim ulogama;
  - poništavanje odobrenja i termina posle izmene;
  - javnost u terminu bez zakazanog posla i jednokratan upis objave;
  - izmenu objavljenog, povlačenje i ponovnu objavu;
  - stručnu potvrdu, slike i okidače „samo dodavanje“.
- **Tok u pregledaču** nad sintetičkom bazom (`carsystem_saveti_ui_qa`), sa stvarnim satom: termin zakazan 2–3 minuta unapred, pa provera javne strane, menija i stranice programa. Skripta i snimci su u `~/Carsystem/radno/poredjenje-saveti-podrska-2026-11-01`.
