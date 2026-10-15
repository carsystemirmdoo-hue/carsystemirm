# Istraživanje pitanja: autolakiranje (za 200+ edukativnih članaka)

Pristupljeno: 2026-10-08 · Fajl sa podacima: `questions.json` (292 pitanja, posle spajanja bliskih duplikata; 123 varijante formulacija u poljima `variants`, 69 pitanja ima bar jednu varijantu)

## Kako čitati podatke

- `found-in-source` (131): pitanje, ili njemu jasno ekvivalentno, viđeno je na `sourceUrl`. To može biti naslov teme u rezultatima pretrage ili pitanje pročitano na samoj stranici. Kod forumskih stranica koje su pročitane preko alata za preuzimanje, pitanja su često parafrazirana; tada je `originalPhrasing` = `null`, a u `note` piše „parafraza“, odnosno samo kontekst.
- `editorial-proposal` (161): uredničke teme koje dopunjuju pokrivenost. Kod nekih postoji `backgroundUrl`, tehnička podloga (PPG/BASF/R-M/baslac). To NIJE dokaz da su ljudi tako pitali.
- `additionalSources`: druge stranice na kojima se pojavljuje isto pitanje (spojeni duplikati).
- Nijedna tvrdnja o učestalosti („najčešće“, obim pretrage) nije data jer nemamo podatke o obimu. Broj izvora po pitanju nije mera popularnosti.
- Lična imena i korisnička imena nisu prikupljana.

## Pregled po temama (ukupno / found-in-source)

| Tema | Ukupno | Found | Glavni obrasci pitanja |
|---|---|---|---|
| osnove | 14 | 6 | redosled slojeva, „lak u boji ili posebno“, šta sve treba kupiti, spot popravka, izbor majstora |
| priprema-metala | 7 | 1 | goli lim; aluminijum, cink, površinska rđa i KTL su uredničke teme |
| priprema-plastike | 12 | 6 | ljuštenje boje sa branika, prajmer/promotor za plastiku, napukli branik, broj slojeva |
| stari-lak | 8 | 4 | ljuštenje fabričkog laka, skidati do lima ili ne, lak preko laka, skidači boje |
| odmascivanje | 7 | 2 | kućna sredstva umesto antisilikona, smola i katran; redosled odmašćivanja je urednička tema |
| korozija | 12 | 8 | uklanjanje rđe, konvertor rđe, šupljine, podvozje, zaštita posle varenja |
| kitovi | 13 | 6 | odnos učvršćivača, pore, kit preko boje, kit pre ili posle epoksida |
| prajmeri-fileri | 10 | 3 | cink prajmer na varu, koliko prajmer sme da stoji, nanošenje filera |
| brusenje | 11 | 5 | granulacije za kit i filer, suvo ili mokro, prelaz kit/boja |
| abrazivi | 10 | 4 | sunđer za poliranje vs podloga za brušenje, međusloj (interface pad), vek sunđera |
| baze-nijanse | 12 | 5 | varijante iste šifre boje, pokrivnost podloge, međusušenje, broj slojeva |
| efekti-metalik-biser | 11 | 6 | fleke i pruge na metaliku, utapanje, troslojni biser, krupniji kristali, poliranje baze (zabluda) |
| lakovi | 8 | 1 | broj slojeva laka; MS/HS, ekspres lak i utapanje laka su uredničke teme |
| ucvrscivaci-razredjivaci | 10 | 3 | odnosi mešanja baze i laka, procenat razređivanja, uloga razređivača |
| uslovi-rada | 9 | 4 | hladna garaža, zamućenje pri vlazi, priprema garaže |
| oprema-pistolji | 21 | 12 | kompresor, voda u vazduhu, dizne, pritisak HVLP, čišćenje, original vs kopija |
| maskiranje | 9 | 4 | papir ili folija, meka ivica, dvobojno, bez demontaže |
| susenje | 9 | 3 | kad prati auto, koliko traje otvrdnjavanje, ubrzanje sušenja |
| greske | 22 | 10 | solvent pop, krateri, dieback, curenje, lifting, tragovi brušenja, talasasta površina |
| poliranje | 20 | 14 | kada polirati i voskirati nov lak, hologrami, mokro brušenje, DA vs rotaciona |
| zastita-na-radu | 9 | 2 | maska za 2K, štetnost skidača; ostalo su uredničke teme |
| radionica-potrosnja | 10 | 4 | potrošnja boje, otpad razređivača, rok trajanja, filteri kabine |
| tds-sds | 8 | 1 | čitanje odnosa mešanja; ostalo urednički (u izvorima retko pitaju direktno) |
| sprejevi-diy | 23 | 16 | ogrebotine, kamenčići, felne, branik sprejom, hladno vreme, 2K sprej, lak koji se nabrao |
| izbor-proizvoda | 7 | 1 | original vs kopija; ostalo urednički, vezano za naš program |

Po publici: hobista 142, pocetnik 74, profesionalac 56, vlasnik-radionice 20.
Po tipu izvora (samo found): forum 99, qa-site 15, search-results 10, official-faq 6, manufacturer-training 1. Reddit i video-komentari: 0, jer su bili nedostupni (vidi ispod).

### Zapažanja za urednički plan (kvalitativno, ne statistika)

- U ex-YU forumima (samsvojmajstor, bhtuning, poljoprivredni-forum) dominiraju DIY pitanja. Ljudi pitaju šta sve da kupe, kako da ofarbaju branik da se ne ljušti, kako da isprave grešku spreja, koliko materijala treba i koji kompresor da uzmu. Pitanja o TDS/SDS, izocijanatima i otpadu skoro se ne pojavljuju. To su teme koje treba otvoriti urednički.
- Pitanja krajnjih kupaca („kad smem da operem auto“, „kako prepoznati dobrog lakirera“) prirodno vode ka CTA „Pronađi najbližu prodavnicu“.
- Postoje zablude koje vredi razbiti zasebnim člancima: da se baza polira pre laka, da se pištolj potapa u razređivač, da je dovoljna „samo boja“, da kit može preko rđe i da je nitro razređivač univerzalan.
- Kod spreja se stalno ponavljaju nekompatibilnost slojeva (nabiranje), hladno vreme i realna očekivanja od spot popravke metalika. To je osnova za Cosmos Lac sadržaj; tvrdnje o proizvodima proveriti pre objave.

## Konsultovani izvori

### Zvanični FAQ i trening proizvođača (samo tehnička podloga; nisu svi naši brendovi)
- SATA FAQ: https://www.sata.com/en/service/professional-knowledge/faq/ (naš brend)
- R-M: https://www.rmpaint.com/en-int/expert-knowledge.md, https://www.rmpaint.com/llms.txt, https://www.rmpaint.com/en-int/new-energy-vehicles (naš brend)
- baslac: https://www.baslac.com/en-emea/training-solutions (naslovi „5-Minute baslac“), TDS 35 Basecoat: https://techinfo.baslac.com/NA/TDS/en/35%20Basecoat%20Metallic_Solid.pdf (naš brend)
- BASF Fundamentals of Automotive Refinishing (prikaz): https://www.repairerdrivennews.com/2025/09/15/basf-updates-fundamentals-of-automotive-refinishing-document/
- PPG Common Paint Defects Guide (40 grešaka; nije naš brend): https://www.ppg.com/en-AE/automotive-refinish/common-paint-defects-guide
- SprayMax pot life (nije naš brend): https://www.spraymax.com/en-us/brand/news-blog/potlife-the-key-factor-for-2k-aerosols/
- edding FAQ, lifting (nije naš brend): https://faq.edding.com/What-causes-the-paint-to-wrinkle-(%22lift%22)-when-I-use-edding-5200-permanent-spray%3F

### Srpski i ex-YU forumi
- samsvojmajstor.com „Farbanje auta“, strane 1–5: https://www.samsvojmajstor.com/portal/forums/uradi-sam/popravka-automobila/farbanje-auta; uz to teme o metalik fleci, farbanju sprejom, kompresorima, dizni, razređivanju i zaštiti poda (URL-ovi su u JSON-u)
- poljoprivredni-forum.com „Auto limarija i priprema za farbanje“, strane 1, 5, 10 i 15: https://poljoprivredni-forum.com/threads/auto-limarija-i-priprema-za-farbanje.27833/
- bhtuning.com: „Sve o LAKIRANJU!“ (str. 1–2), „pitanje za auto lakirere??“, „Lak sprej ili obični iz kantice?“, „Šta uraditi s branikom guli se boja“, „Touch up paint…“; naslovi tema o branicima i postupku
- forum.hr: samo naslovi tema iz rezultata pretrage (stranice vraćaju 403)
- forum.krstarica.com: samo naslovi tema iz rezultata pretrage (stranice vraćaju 403)
- n1info.rs: naslov članka o ptičjem izmetu (search-results)

### Engleski forumi i Q&A sajtovi (samo naslovi i sadržaj tema)
garagejournal.com, autogeekonline.net, meguiarsonline.com, forums.hybridz.org, stovebolt.com, stangnet.com, gbodyforum.com, dsmtuners.com, forums.ncrs.org, therpf.com, forum.finescale.com, corvetteforum.com, classicmotorsports.com / grassrootsmotorsports.com, retro-rides.org, ferrarichat.com, theminiforum.co.uk, bobistheoilguy.com, forum.ih8mud.com, thegsresources.com, lateral-g.net, sawmillcreek.org, festoolownersgroup.com, forabodiesonly.com, mbclub.co.uk, fiatforum.com, micra.org.uk, mmoc.org.uk, audizine.com, shelby.com, 4x4community.co.za, clublexus.com, toyotaownersclub.com, wheelhorseforum.com, hardforum.com, unofficialwarmoth.com, uk-mkivs.net, 6thgenaccord.com, xs11.club, kzrider.com, stunthanger.com, vansairforce.net, forum.trains.com, mgexp.com, club8090.co.uk, ratsun.net, acurazine.com
Q&A i FAQ prodavaca: getjerry.com/questions, limelinepaintsupply.com/a/answers, nonpaints.com/en/faq, cypaint.com, paintbooth.com, calendar-uk.co.uk

## Nedostupni izvori

| Izvor | Razlog |
|---|---|
| Reddit (r/Autobody, r/AutoDetailing, r/autobodyrepair, r/serbia) | alat za preuzimanje i pretraga blokiraju reddit.com; nije zaobilaženo |
| forum.krstarica.com (sadržaj tema) | HTTP 403; korišćeni su samo naslovi iz rezultata pretrage |
| forum.hr (sadržaj tema) | HTTP 403; korišćeni su samo naslovi iz rezultata pretrage |
| baslac technical-support FAQ (technical-support.baslac.com) | preusmerava na naslovnu stranu (308), lista FAQ nije dostupna |
| Glasurit stranica o clouding-u | 404 |
| Spies Hecker/Axalta vest o serijalu videa o greškama | 404 |
| polovniautomobili.com i mojauto.rs forumi | pretraga nije vratila forumske teme o lakiranju, samo oglase i vesti |
| YouTube komentari | nisu čitljivi bez prijave i JS-a; nisu korišćeni |
| Google „People also ask“ | alat ne prikazuje PAA blokove; korišćeni su samo naslovi rezultata |
| Facebook grupe (Autolakireri Srbija i sl.) | iza prijave; preskočeno po uputstvu |

## Napomene o brendovima i bezbednosti sadržaja

- 3M, sia i Molotow nisu predloženi ni u jednom pitanju. Gde su se pojavljivali u izvorima (npr. abrazivi, krpe za prašinu), izvori nisu citirani kao preporuka.
- PPG, Axalta, Glasurit, Standox, SprayMax, edding i ostali spoljni brendovi služe isključivo kao dokaz pitanja ili tehnička podloga. Ne pominjati ih u člancima kao preporuku.
- U poljima `note` za `izbor-proizvoda` stoje napomene da se tvrdnje o našim proizvodima (Cosmos Lac, BEFAR, RUPES, SATA) proveravaju pre objave. Ne koristiti formulacije poput „zvanični distributer“.
- Odgovori iz foruma (odnosi mešanja, temperature, vremena) nisu verifikovani. Za članke važe TDS-ovi konkretnih proizvoda.
