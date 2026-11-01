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
2. **Strane se obnavljaju na 60 sekundi** (ISR): `/vodici`, članci, teme, feed, stranice programa i `/vodici/stanje.json` za meni. Vreme obnove ne znači da je strana sigurno nova posle 60 s; tačna kašnjenja su u odeljku „Kašnjenje javnog prikaza“.
3. **Radnje u panelu osvežavaju strane odmah**: objava odmah, objava izmena i povlačenje.
4. **Objava se naknadno upisuje** (javna verzija, događaj, revizija) pri svakom otvaranju panela i pre svake radnje nad člankom.
   - Ruta `/api/saveti/objava` radi isto, ali nije uslov objave i zakazani posao (cron) nije uključen.
   - Ako se ikad uključi, poziv je bezbedan za ponavljanje: jedno zakazivanje daje najviše jednu objavu.

Vreme se unosi po vremenu Srbije (Europe/Belgrade), a prelazak na letnje i zimsko vreme rešava `lib/saveti/vreme.mjs`.

## Kašnjenje javnog prikaza (izmereno 1. 11. 2026)

Merenje je rađeno na lokalnom `next start` (isti build kao za Vercel) nad sintetičkom bazom, sa stvarnim satom. Skripta i zapisi su u `~/Carsystem/radno/poredjenje-saveti-podrska-2026-11-01` (`alati/kes.mjs`, `kes-log*.txt`).

Pojmovi:

- **zagrejan keš**: adresa je već tražena i strana je u kešu;
- **hladan keš**: adresa još nije tražena;
- **saobraćaj**: zahtev svake sekunde;
- **bez saobraćaja**: niko ne traži adresu duže od 60 s.

| Događaj | Članak (direktna adresa) | Biblioteka `/vodici`, feed, meni | Stranica programa (veza na vodič) | Naslovna slika | `sitemap.xml` |
|---|---|---|---|---|---|
| **Radnja u panelu** (objava odmah, objava izmena, povlačenje), zagrejan ili hladan keš | prvi sledeći zahtev (izmereno 0,3–0,5 s) | isto | isto | isto | isto |
| **Zakazana objava**, hladan keš | prvi zahtev | — (uvek u kešu) | — (uvek u kešu) | od termina | — |
| **Zakazana objava**, zagrejan keš sa saobraćajem | najviše 60 s posle termina (izmereno 47 s) | isto (izmereno 47–48 s) | isto (izmereno 47 s) | od termina (izmereno 0,9 s) | do 1 h |
| **Zakazana objava**, zagrejan keš bez saobraćaja | prvi zahtev dobija staru stranu, drugi novu | isto | isto | od termina | do 1 h + jedan zahtev |

Šta to znači:

- **Najduže očekivano kašnjenje za zakazanu objavu** je 60 s posle termina, plus jedan zahtev po adresi.
  - Na adresi koju dugo niko nije tražio, prvi posetilac posle termina može dobiti stranu iz vremena pre termina (članak još „ne postoji“, biblioteka i program bez veze).
  - Taj zahtev pokreće obnovu, i svaki sledeći, posle oko 1 s, dobija novu stranu. Kašnjenje se zato meri brojem zahteva, a ne sekundama.
- **Povlačenje i objava iz panela** važe od prvog sledećeg zahteva na svim adresama, jer radnja briše keš tih strana (`revalidatePath`). Ništa ne zavisi od 60 s.
- **Naslovna slika** se služi iz baze bez keša na serveru, pa je javna od termina i nestaje odmah posle povlačenja (HTTP 404, `no-store`).
  - Pregledač koji je sliku već učitao čuva je najviše 60 s, a zatim je proverava (`max-age=60, must-revalidate` i ETag).
  - Ranije je bio dozvoljen keš od jednog dana; to je ispravljeno.
- **Meni** u otvorenoj kartici ponovo čita `/vodici/stanje.json` pri prelasku na drugu stranu ili povratku na karticu, kada je stanje starije od 60 s. Ranije se čitalo samo pri punom učitavanju strane.
- **Prelazak unutar sajta** (klik bez ponovnog učitavanja) može prikazati stranu koju je Next.js unapred učitao najviše 5 minuta ranije. To je podrazumevano ponašanje Next.js-a (`staleTimes.static` = 300 s) i nije izmereno posebno. Puno učitavanje i direktna adresa nemaju to kašnjenje.
- **`sitemap.xml`** se obnavlja na sat vremena, kao do sada za ceo sajt. Radnje u panelu ga osvežavaju odmah, a utiče samo na pretraživače.
- **Vercel** koristi isti model (obnova u pozadini, `revalidatePath` briše keš za sve regione). Na Vercel-u nije mereno, jer Preview ove grane nema tabele 0058.

## Koraci za Production (svaki uz posebno odobrenje)

1. **Kopija baze** (rezervna kopija preko GitHub Actions) i provera vraćanja, kao kod ranijih migracija.
2. **Migracija 0058** nalogom vlasnika baze (vidi „Redosled migracija“ ispod):
   1. `npm run db:migrate:check` sa `MIGRATION_DATABASE_URL`. Provera samo čita (transakcija READ ONLY) i ispisuje šta će biti primenjeno. Očekuje se tačno `0058_saveti_urednik`, ili `0057_…, 0058_…` redom ako je PR #25 spojen pre ove grane. Bilo koja greška znači stop.
   2. `npm run db:migrate`. Pravi 7 novih tabela i ne menja postojeće podatke.
   3. Prava aplikacionog naloga iz `db/provisioning/runtime-role.sql`, blok „Saveti i vodiči (0058)“.
   4. Ponovo `npm run db:migrate:check`: „nema neprimenjenih migracija“.
3. **Spajanje grane u main i push.** Javni `/vodici` posle toga čita samo objavljene verzije iz baze. Dok ih nema, prikazuje poruku da su tekstovi u pripremi, kao sada, a meni nema grupu biblioteke.
4. **Početni uvoz tekstova**: `node scripts/saveti/uvezi-u-bazu.mjs` (proba), pa `--upisi`.
   - Uvozi 224 teksta: 184 kao „Za pregled“ i 40 kao „Nacrt“ sa oznakom „traži stručnu potvrdu“ i razlogom.
   - Ništa se ne odobrava, ne zakazuje ni ne objavljuje.
5. **Slike** se čuvaju u istoj Postgres bazi (`saveti_slike`, WebP do 2 MB, obično 0,2–0,5 MB).
   - Nema novog servisa ni troška.
   - Na Neon Free (0,5 GB) to je dovoljno za nekoliko stotina slika; kapacitet treba pratiti.
6. **Objava pojedinačnih članaka** je posebna odluka vlasnika u panelu.

Nijedan korak ne uvodi plaćeni servis. `CRON_SECRET` i `crons` u `vercel.json` **nisu potrebni**.

## Redosled migracija (0057 i 0058)

Stanje 1. 11. 2026:

- **main = Production:** migracije `0000`–`0056`.
- **Draft PR #25** (`integration/cene-po-kupcu-redizajn`): nosi `0057_customer_rebate_sheet` (vreme 1793368800000). Primenjena je samo na lokalnim test bazama. Grana je 106 commitova iza main-a, a poslednja izmena je od 17. 10.
- **Ova grana (PR #52):** nosi `0058_saveti_urednik` (vreme 1793455200000).

Drizzle primenjuje samo migracije čije je vreme u dnevniku veće od vremena poslednje primenjene. Migracija spojena kasnije, a sa ranijim vremenom, bila bi **tiho preskočena**. To je potvrđeno na privremenoj bazi: posle 0058, drizzle bez greške preskače 0057 i njene tabele ne nastaju.

**Pravilo:** broj i vreme migracije prate redosled spajanja u main. Već primenjena migracija i njen unos u dnevniku se nikad ne menjaju.

- **PR #25 spojen prvi:** ništa se ne menja. Ova grana se rebase-uje na main i dnevnik je `0056 → 0057 → 0058`.
- **PR #52 spojen prvi:** pre spajanja PR #25 njegova migracija postaje `0059_customer_rebate_sheet`.
  - Menjaju se fajl, rollback fajl i unos u dnevniku, sa vremenom većim od 1793455200000.
  - To je dozvoljeno samo zato što 0057 nije primenjena ni na jednoj deljenoj bazi.

**Zaštita u kodu** (`db/migrationOrder.mjs`) ne oslanja se na pamćenje ovog pravila. `npm run db:migrate` i `npm run qa:pg:migrate` odbijaju da pokrenu ijednu migraciju kada:

- bi neka migracija bila preskočena, jer njeno vreme nije posle poslednje primenjene;
- baza ima primenjenu migraciju koje nema u kodu, što znači da je kod stariji od baze;
- dnevnik nije uređen, tj. `idx`, broj u nazivu ili vreme ne rastu strogo.

Test `db/migrationOrder.test.mjs` (deo `test:db-safety`) proverava dnevnik pri svakom `npm test`.

Proba na privremenoj bazi:

| Slučaj | Ishod |
|---|---|
| prazna baza | primenjeno `0000`–`0056` i `0058` |
| dodata 0057 sa ranijim vremenom | odbijeno, ništa nije primenjeno |
| ista 0057 kao 0059 sa kasnijim vremenom | primenjena |
| stariji kod nad novijom bazom | odbijeno |

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
