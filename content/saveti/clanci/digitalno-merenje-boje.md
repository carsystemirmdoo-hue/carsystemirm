---
id: SV-0096
slug: digitalno-merenje-boje
naslov: "Digitalno merenje boje: šta spektrofotometar radi, a šta ne"
metaNaslov: "Spektrofotometar za boju: šta radi, a šta ne"
opis: "Kako ručni uređaji za merenje boje R-M i baslac pomažu pri izboru recepture, šta proizvođači o njima navode i zašto i posle merenja ostaje probni lim."
kategorija: boje-i-nijanse
podtema: digitalni alati za nijanse
tip: osnovni-vodic
publika:
  - profesionalac
  - vlasnik-radionice
glavnoPitanje: Kako uređaji za merenje boje pomažu pri izboru nijanse i gde su njihova ograničenja?
namera: informativna
dodatnaPitanja:
  - Treba li i dalje probni lim?
  - Zašto uređaj meri iz više uglova?
poreklopitanja:
  tip: urednicka-procena
  napomena: "Pitanje proizlazi iz alata proizvođača iz našeg programa (R-M Colortronic 12/6, baslac e-finder star); u questions.json nije pronađeno kao posebno pitanje."
brendovi:
  - rm
  - baslac
proizvodi: []
povezani:
  - SV-0082
  - SV-0083
  - SV-0005
  - SV-0004
  - SV-0093
izvori:
  - id: rm-digital-color-search
    naziv: "R-M, Digital color search (Colortronic 12/6)"
    url: https://www.rmpaint.com/en-int/digital-color-search
    pristupljeno: 2026-10-08
    tip: sajt-proizvodjaca
  - id: rm-color-competence
    naziv: "R-M, Color Competence"
    url: https://www.rmpaint.com/en-int/color-competence
    pristupljeno: 2026-10-08
    tip: sajt-proizvodjaca
  - id: inform-spectro-modules
    naziv: "Info R-M, Digital Color Retrieval with ScanR (javni opis modula)"
    url: https://info.rmpaint.com/processes/digital-color-retrieval-spectrophotometer
    pristupljeno: 2026-10-08
    tip: edukacija-proizvodjaca
  - id: inform-viewr
    naziv: "Info R-M, Digital Color Retrieval with ViewR (javni opis modula)"
    url: https://info.rmpaint.com/processes/digital-color-retrieval-viewr
    pristupljeno: 2026-10-08
    tip: edukacija-proizvodjaca
  - id: inform-kohinoor
    naziv: "Info R-M, Digital Color Retrieval with Kohinoor (javni opis modula)"
    url: https://info.rmpaint.com/processes/digital-color-retrieval-kohinoor
    pristupljeno: 2026-10-08
    tip: edukacija-proizvodjaca
  - id: inform-refinity-scan
    naziv: "Info R-M, Refinity Scan Application (NEW) (javni opis modula)"
    url: https://info.rmpaint.com/processes/refinity-scan-application-new
    pristupljeno: 2026-10-08
    tip: edukacija-proizvodjaca
  - id: baslac-efinder-star
    naziv: "baslac, A perfect finish with baslac® e-finder star"
    url: https://www.baslac.com/en-emea/news/perfect-finish-baslacr-e-finder-star
    datumIzvora: 2023-04-17
    pristupljeno: 2026-10-08
    tip: vest-proizvodjaca
  - id: baslac-efinder-stranica
    naziv: "baslac, baslac e-finder star (stranica alata)"
    url: https://www.baslac.com/en-emea/baslac-e-finder-star
    pristupljeno: 2026-10-08
    tip: sajt-proizvodjaca
  - id: baslac-color-chips
    naziv: "baslac, Color Chips (baslac Effective Color Finder i postupak provere nijanse)"
    url: https://www.baslac.com/en-emea/color-chips
    pristupljeno: 2026-10-08
    tip: sajt-proizvodjaca
  - id: inform-metamerism
    naziv: "Info R-M, Help Centre: Metamerism"
    url: https://info.rmpaint.com/help/metamerism
    pristupljeno: 2026-10-08
    tip: edukacija-proizvodjaca
prioritet: 1415
razlogPrioriteta: Dopunjuje osnovni vodič teme konkretnim pitanjem; raspoređeno naizmenično sa drugim temama.
status:
  istrazivanje: zavrseno
  pisanje: napisano
  tehnickaProvera: provereno
  jezickaProvera: provereno
napomenaProvere: "urednička provera (AI-asistirana) 2026-10-08: otvoreni R-M Digital color search i Color Competence, Info R-M ScanR, ViewR, Kohinoor i Refinity Scan, baslac e-finder star (vest 17.04.2023 i stranica), Color Chips, Metamerism; tvrdnje se poklapaju; ispravke: dodati izvori za module ViewR i Kohinoor (ranije bez sopstvenog URL-a), jezički preciziran opis Refinity modula."
strucnaPotvrda:
  potrebna: false
  status: nije-potrebno
poslednjaProvera: 2026-10-08
ponovniPregled: 2027-04-08
---
Ručni uređaj za merenje boje (spektrofotometar) izmeri boju na vozilu i na osnovu merenja u bazi recepata proizvođača boje predloži recepture koje joj odgovaraju. Time se skraćuje traženje između standardne recepture i varijanti. Uređaj ne zna kako ćete boju naneti i ne zamenjuje probni lim: on pomaže da se izabere receptura, a proveru i dalje daje uzorak nanet Vašim postupkom. R-M za svoj sistem navodi da on pomaže i da se bolje odluči kada treba napraviti probni lim[^rm-digital-color-search].

## Šta uređaj radi

Opšte objašnjenje: uređaj osvetli malu površinu i izmeri koliko svetlosti ona odbija na pojedinim talasnim dužinama, i to iz više uglova. Program zatim to merenje uporedi sa podacima u bazi recepata i ponudi najbliže recepture, uz standard i varijante za datu šifru boje.

Proizvođači iz našeg programa za svoje uređaje navode sledeće:

- **R-M Colortronic 12/6** je spektrofotometar povezan sa R-M alatima za recepture; R-M ga navodi uz Color Explorer i platformu Refinity[^rm-color-competence]. Na stranici o digitalnoj pretrazi boje R-M navodi i prikaz spektralnih krivih iz više uglova, sa prebacivanjem između pogleda spreda i iskosa (engl. *face* i *flop*), vizuelni prikaz originalne, ciljne i prilagođene boje i čuvanje sopstvenih probnih limova u oblaku[^rm-digital-color-search].
- **baslac e-finder star** je ručni uređaj povezan sa bazom baslac Formula Finder[^baslac-efinder-stranica]. baslac navodi merenje iz pet uglova za jednobojne, metalik i biserne boje, automatsku kalibraciju na crnoj pločici i posle svakog posla, povezivanje preko WiFi mreže i zeleno ili crveno svetlo koje pokazuje da li je merenje ispravno[^baslac-efinder-star].

R-M ima i edukativne module za pronalaženje boje spektrofotometrom za više uređaja (ScanR, ViewR, Kohinoor), kao i za modul za merenje (Spectro Module) u platformi Refinity[^inform-spectro-modules][^inform-viewr][^inform-kohinoor][^inform-refinity-scan]. Moduli traže prijavu, pa ovde navodimo samo njihove javne opise. Novosti o Refinity platformi opisuju tekstovi [Refinity za baslac korisnike](/vodici/refinity-za-baslac-korisnike) i [R-M LightAssist u Refinity](/vodici/rm-lightassist-u-refinity).

## Šta uređaj ne radi

Ova ograničenja su urednička procena, izvedena iz načina rada uređaja i iz uputstava proizvođača za proveru nijanse:

- **Ne vidi Vaše nanošenje.** Meri gotovu boju na vozilu, a receptura će na delu izgledati onako kako je nanesete: broj slojeva, razređenje i podešavanje pištolja menjaju izgled, posebno kod metalika.
- **Meri površinu kakva jeste.** Prljav, mutan ili oštećen sloj daje merenje te površine. baslac i za poređenje karte nijanse traži očišćen i ispoliran deo vozila[^baslac-color-chips], pa je razumno isto pripremiti i mesto merenja.
- **Ne rešava razliku pod drugim svetlom.** R-M upozorava da dve boje mogu izgledati isto na dnevnom, a različito na veštačkom svetlu[^inform-metamerism]. Konačni izgled se proverava golim okom, pod više izvora svetla.
- **Ne zamenjuje bazu recepata.** Uređaj je onoliko koristan koliko je dobra baza sa kojom radi i koliko je pravilno izabrano mesto merenja.

Proizvođači u materijalima koje smo pregledali ne navode brojčanu tačnost uređaja, pa je ni mi ne navodimo.

## Pitanja i odgovori

### Treba li i dalje probni lim?

Da. baslac i posle izbora varijante u bazi predviđa probni lim[^baslac-color-chips], a R-M uz svoj sistem nudi čuvanje probnih limova u oblaku[^rm-digital-color-search]. Merenje skraćuje put do recepture, a probni lim pokazuje da li ta receptura, naneta Vašim postupkom i prelakirana, odgovara vozilu. Postupak je u vodiču [Probni lim: zašto se radi pre lakiranja](/vodici/probni-lim-pre-lakiranja).

### Zašto uređaj meri iz više uglova?

Zato što metalik i biserne boje izgledaju drugačije spreda i iskosa, pa merenje pod jednim uglom ne opisuje celu boju. baslac za e-finder star navodi merenje iz pet uglova radi tačnijeg očitavanja jednobojnih, metalik i bisernih boja[^baslac-efinder-star], a R-M rezultate prikazuje i za pogled spreda i za pogled iskosa[^rm-digital-color-search]. Zašto se metalik menja sa uglom, objašnjava vodič [Metalik boje: zašto izgledaju drugačije iz svakog ugla](/vodici/metalik-boje-kako-rade).

### Gde mogu da dobijem merenje boje?

Uređaje za merenje koriste lakirerske radionice i prodavci boje koji rade sa tim sistemima. Da li prodavnica u Vašem gradu nudi merenje, proverite preko strane [Prodavnice](/prodavnice) ili nam pišite preko strane [Kontakt](/kontakt).
