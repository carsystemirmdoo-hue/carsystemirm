# Vizuelni koncepti za grupe koje nisu boje, lakovi i sprejevi

**Datum:** 2026-08-18 · **Status:** koncepti, ništa nije implementirano
**Obim:** 10 platformskih kategorija van paint/spray sveta — **74 proizvoda ukupno**

| Grupa | Proizvoda | Grupa | Proizvoda |
| --- | --- | --- | --- |
| `zastita` | 25 | `kitovi` | 8 |
| `radionica` | 14 | `ciscenje` | 7 |
| `poliranje` | 12 | `abrazivi` | 4 |
| `maskiranje` | 2 | `oprema` | 1 |
| `lepkovi` | 1 | `pribor` | 0 |

> Poređenja radi: `sprejevi` ima 654 proizvoda, `boje` 104. **Svih deset ostalih
> grupa zajedno je 74 proizvoda — 8,9% kataloga.** To je najvažnija činjenica za
> ocenu ovih koncepata: pravac koji traži sopstveni jezik za grupu od 1–4
> proizvoda skoro sigurno ne vredi truda, ma koliko lepo izgledao.

Icon rain / icon pile je **odbačen** i ne pojavljuje se ni u jednom konceptu
ispod. Od 22 koncepta, **16 ne zahteva nijedan novi SVG element**.

---

## Kako čitati kolonu „novi SVG"

- **ne** — radi se CSS gradijentima, maskama, `clip-path`-om, `filter`-om, ili
  postojećim renderom proizvoda;
- **izvedeno** — koristi siluetu ili boju **stvarnog** rendera proizvoda, koje
  već imamo izmerene u `data/product-image-metrics.generated.json`;
- **da** — traži crtanje novih elemenata.

---

## A · Univerzalni koncepti (rade za više grupa)

### 1. Material Signature

| | |
| --- | --- |
| **Princip** | Svaka grupa dobija apstraktan ali fizički tačan trag svog materijala: sloj, rez, pritisak, preklop, trenje, brisanje. Jedan potez, ne tekstura preko cele scene. |
| **Grupe** | Sve — trag se bira po grupi (abrazivi = trenje, kitovi = razvlačenje, maskiranje = preklop, zaštita = film) |
| **Odnos sa slikom** | Trag prolazi **iza** proizvoda i izlazi sa obe strane, kao što spray potez radi danas |
| **Statično** | Da — trag je konačno stanje |
| **Kretanje** | Opciono: trag se izvlači jednom, 600–800 ms, isti princip kao `spray-draw` |
| **Zašto nije generički** | Trag opisuje **radnju** koja se izvodi tim proizvodom, ne apstraktan oblik. Glet se razvlači, abraziv briše, folija se preklapa — tri različita fizička ponašanja |
| **Rizici** | Ako se svede na „mrlju u boji grupe", pretvara se u generičan gradijent |
| **Desktop / mobile** | Isto; trag se skalira u `cq` jedinicama |
| **Performanse** | Jedan SVG path + maska po sceni |
| **Novi SVG** | ne (CSS gradijenti + maske) |

### 2. Product Echo

| | |
| --- | --- |
| **Princip** | Velika, tonski prigušena kontura ili isečak **stvarnog oblika proizvoda** stoji iza rendera, pomerena i uvećana — dubina bez ijednog izmišljenog oblika |
| **Grupe** | Sve; najjače tamo gde je oblik prepoznatljiv (diskovi, limenke, tube) |
| **Odnos sa slikom** | Doslovan: eho **je** proizvod, kroz `filter` i alfu istog rendera |
| **Statično** | Da |
| **Kretanje** | Opciono: eho klizne 8–12 px pri ulasku |
| **Zašto nije generički** | Ne može biti generičan — svaki proizvod pravi svoju scenu iz sopstvene siluete |
| **Rizici** | Na proizvodu bez alfe (14 JPG-ova) eho postaje beli pravougaonik; mora biti gejtovan na `boxSource === "alpha"` |
| **Desktop / mobile** | Isto, `cq`-skalirano |
| **Performanse** | Ista slika, drugi `filter` — bez novih mrežnih zahteva |
| **Novi SVG** | izvedeno |

### 3. Negative-space Reveal

| | |
| --- | --- |
| **Princip** | Scena se gradi **oduzimanjem**: puna površina u tonu grupe, iz koje je izrezan oblik koji otkriva proizvod. Ne dodaje se dekoracija — uklanja se prostor |
| **Grupe** | Sve; posebno `zastita` (25) i `maskiranje` (2), gde je maskiranje bukvalno tema |
| **Odnos sa slikom** | Rez prati siluetu proizvoda sa odstupanjem, pa proizvod „izlazi" iz mase |
| **Statično** | Da |
| **Kretanje** | Opciono: rez se otvara jednom |
| **Zašto nije generički** | Obrnuta logika od svake dekorativne pozadine — masa je pravilo, proizvod je izuzetak |
| **Rizici** | Puna masa lako postane pretamna u dark temi; traži isti `contrastMode` gejt kao halo |
| **Desktop / mobile** | Na 390 px rez mora biti prostiji — jedan luk umesto tri |
| **Performanse** | `clip-path` ili SVG maska, jedan sloj |
| **Novi SVG** | ne |

### 4. Compression Field

| | |
| --- | --- |
| **Princip** | Mreža paralelnih linija ili traka **reaguje na prisustvo proizvoda** — savija se, zgušnjava i razređuje oko njegove siluete, kao da proizvod pritiska materijal |
| **Grupe** | Sve; prirodno za `kitovi` (8), `zastita` (25), `poliranje` (12) |
| **Odnos sa slikom** | Deformacija se računa iz **izmerenog content box-a**, pa svaka silueta pravi drugačije polje |
| **Statično** | Da |
| **Kretanje** | Opciono: polje se „slegne" jednom, 500 ms |
| **Zašto nije generički** | Linije nisu ukras nego posledica proizvoda — bez proizvoda polje ne postoji |
| **Rizici** | Preterana deformacija liči na toplotnu mapu; mora ostati suzdržana |
| **Desktop / mobile** | Manje linija na mobilnom (12 umesto 24) |
| **Performanse** | Jedan SVG sa `n` path-ova, statičan |
| **Novi SVG** | ne (generisane linije) |

### 5. Assembly Frame

| | |
| --- | --- |
| **Princip** | Precizan tehnički okvir se **sklapa** oko proizvoda: uglovi, registracione oznake, ose. Ništa ne pada i ništa se ne gomila |
| **Grupe** | `oprema` (1), `radionica` (14), `abrazivi` (4), sistemske stranice |
| **Odnos sa slikom** | Okvir se dimenzioniše iz content box-a proizvoda, pa uvek „pristaje" |
| **Statično** | Da |
| **Kretanje** | Opciono: uglovi ulaze iz četiri strane, 400 ms |
| **Zašto nije generički** | Okvir je izveden iz stvarne siluete, ne fiksni pravougaonik |
| **Rizici** | Bez ijedne brojke — čim se pojavi crtica sa razmakom, čita se kao mera |
| **Desktop / mobile** | Na mobilnom samo uglovi, bez osa |
| **Performanse** | 8–12 kratkih path-ova |
| **Novi SVG** | ne |

### 6. Depth Stack

| | |
| --- | --- |
| **Princip** | Tri do četiri velike, meke tonske ploče u različitim dubinama iza proizvoda — bez ijednog oblika, samo prostor |
| **Grupe** | Sve, kao **default** za grupe bez sopstvenog jezika |
| **Odnos sa slikom** | Ploče se centriraju na optički centar proizvoda |
| **Statično** | Da |
| **Kretanje** | Opciono: paralaksa 4–6 px na skrol |
| **Zašto nije generički** | Iskreno — **jeste** najgeneričniji od svih. Zato je predložen kao *fallback*, ne kao karakter |
| **Rizici** | Ako se koristi svuda, sajt izgleda kao svaki drugi B2B katalog |
| **Desktop / mobile** | Isto |
| **Performanse** | Najjeftiniji mogući — tri `radial-gradient`-a |
| **Novi SVG** | ne |

### 7. Edge Light

| | |
| --- | --- |
| **Princip** | Jedan usmereni izvor svetla „pere" scenu sa strane, ostavljajući oštru ivicu i dugačku senku proizvoda na podu panela |
| **Grupe** | Sve; najjače za metalne i sjajne proizvode |
| **Odnos sa slikom** | Senka je **izvedena silueta** proizvoda, ukošena i zamućena |
| **Statično** | Da |
| **Kretanje** | Opciono: ugao svetla se pomeri 6° pri ulasku |
| **Zašto nije generički** | Senka je stvarni oblik proizvoda, ne elipsa ispod njega |
| **Rizici** | Traži alfu; JPG-ovi bez alfe ne mogu dati senku |
| **Desktop / mobile** | Kraća senka na mobilnom |
| **Performanse** | `drop-shadow` + jedan gradijent |
| **Novi SVG** | izvedeno |

---

## B · Category-specific koncepti

### 8. Abrasion Orbit — `abrazivi` (4), `poliranje` (12)

| | |
| --- | --- |
| **Princip** | Kontrolisani lukovi trenja: gustina traga raste ka spolja, površina iza njega menja ton. Bez beskonačnog kruženja i bez rotacije u petlji |
| **Odnos sa slikom** | Lukovi su koncentrični sa **kružnim** proizvodom — disk je centar svog polja |
| **Statično** | Da, luk je završen trag |
| **Kretanje** | Opciono: luk se ispisuje jednom, 700 ms |
| **Zašto nije generički** | Trag je posledica kontakta diska sa površinom, ne dekorativni krug |
| **Rizici** | Ne sme sugerisati granulaciju; nikakve tačkice u pravilnim gustinama koje bi se čitale kao P-broj |
| **Desktop / mobile** | Isto, manji radijus |
| **Performanse** | 3–5 lukova |
| **Novi SVG** | ne |

### 9. Controlled Fold — `maskiranje` (2), `zastita` (25)

| | |
| --- | --- |
| **Princip** | Velika savijena površina: preklop, zategnuta ivica, jedna oštra linija pregiba. Materijal, ne uzorak |
| **Odnos sa slikom** | Pregib prolazi iza proizvoda i izlazi sa druge strane |
| **Statično** | Da |
| **Kretanje** | Opciono: pregib se „zategne" jednom |
| **Zašto nije generički** | Folija i zaštitni film se u radionici zaista tako ponašaju — pregib je prepoznatljiv radniku |
| **Rizici** | Lako sklizne u origami dekoraciju |
| **Desktop / mobile** | Jedan pregib na mobilnom umesto dva |
| **Performanse** | Dva `clip-path` poligona + gradijent |
| **Novi SVG** | ne |

### 10. Technical Cutaway — `oprema` (1), `radionica` (14) |

| | |
| --- | --- |
| **Princip** | Kontrolisan presek procesa: podloga, materijal, alat — u preseku, bez ijedne mere |
| **Odnos sa slikom** | Proizvod stoji na preseku kao izvor radnje |
| **Statično** | Da |
| **Kretanje** | Opciono: slojevi preseka se otkrivaju odozdo naviše |
| **Zašto nije generički** | Presek je jezik tehničke dokumentacije koju ova industrija stvarno koristi |
| **Rizici** | **Najveći rizik u celoj listi** — presek prirodno poziva na debljine i brojke, a mi ih nemamo |
| **Desktop / mobile** | Na mobilnom najviše tri sloja |
| **Performanse** | Jeftino |
| **Novi SVG** | ne |

### 11. Process Field — `ciscenje` (7), `lepkovi` (1), `kitovi` (8)

| | |
| --- | --- |
| **Princip** | Pozadina prikazuje **silu** procesa: pritisak, raspršivanje, nanošenje, uklanjanje — kao polje smera, ne kao objekat |
| **Odnos sa slikom** | Smer polja izlazi iz proizvoda (mlaznica, vrh tube) |
| **Statično** | Da |
| **Kretanje** | Opciono: polje se pojačava jednom |
| **Zašto nije generički** | Smer je vezan za geometriju konkretnog proizvoda |
| **Rizici** | Blizu je postojećem spray jeziku — mora se jasno razlikovati da ne izgleda kao slabija kopija |
| **Desktop / mobile** | Isto |
| **Performanse** | Jedan konusni gradijent |
| **Novi SVG** | ne |

### 12. Surface Transition — `abrazivi` (4), `poliranje` (12)

| | |
| --- | --- |
| **Princip** | Scena je **jedna površina u dva stanja**: hrapava sa jedne, ispolirana sa druge strane, sa jasnom granicom koja prolazi iza proizvoda |
| **Odnos sa slikom** | Granica prolazi tačno kroz proizvod — on je uzrok prelaza |
| **Statično** | Da |
| **Kretanje** | Opciono: granica pređe preko scene jednom |
| **Zašto nije generički** | Prikazuje **rezultat** rada, što je ono što kupac zapravo kupuje |
| **Rizici** | Tekstura hrapavosti mora ostati apstraktna |
| **Desktop / mobile** | Isto |
| **Performanse** | Dva gradijenta + jedna maska |
| **Novi SVG** | ne |

### 13. Modular Workshop — `radionica` (14), `oprema` (1)

| | |
| --- | --- |
| **Princip** | Velike tehničke forme organizuju prostor kao sistem — moduli, žlebovi, nosači. **Bez doslovne pegboard ilustracije** |
| **Odnos sa slikom** | Proizvod zauzima jedan modul; ostali su prazni |
| **Statično** | Da |
| **Kretanje** | Opciono: moduli se poravnaju jednom |
| **Zašto nije generički** | Modul je mera prostora, ne ukras — kompozicija govori „ovo je deo sistema" |
| **Rizici** | Prazni moduli mogu izgledati kao nedostajući sadržaj |
| **Desktop / mobile** | 2 modula na mobilnom umesto 5 |
| **Performanse** | Jeftino |
| **Novi SVG** | ne |

### 14. Bond Line — `lepkovi` (1), `kitovi` (8)

| | |
| --- | --- |
| **Princip** | Dve površine i spojnica između njih; spojnica je jedina „topla" linija u sceni |
| **Odnos sa slikom** | Spojnica izlazi ispod proizvoda |
| **Statično** | Da |
| **Kretanje** | Opciono: spojnica se zatvara jednom |
| **Zašto nije generički** | Prikazuje funkciju (spajanje), ne ambalažu |
| **Rizici** | Populacija je **9 proizvoda** — teško opravdati zaseban jezik |
| **Desktop / mobile** | Isto |
| **Performanse** | Trivijalno |
| **Novi SVG** | ne |

### 15. Protective Film — `zastita` (25)

| | |
| --- | --- |
| **Princip** | Poluprovidan film prekriva deo scene, sa vidljivom ivicom i blagim odsjajem; ispod filma scena je nešto prigušenija |
| **Odnos sa slikom** | Ivica filma prolazi preko dela panela, nikad preko lica proizvoda |
| **Statično** | Da |
| **Kretanje** | Opciono: film klizne preko scene jednom |
| **Zašto nije generički** | Zaštita je bukvalno film — metafora i funkcija su ista stvar |
| **Rizici** | „Staklasti" efekat je izričito zabranjen dizajn-pravcem; film mora biti mat |
| **Desktop / mobile** | Isto |
| **Performanse** | Jedan sloj sa `backdrop-filter`, ili bez njega na slabijim uređajima |
| **Novi SVG** | ne |

### 16. Grit Gradient — `abrazivi` (4)

| | |
| --- | --- |
| **Princip** | Gustina zrna raste kontinuirano preko scene, bez ijedne oznake granulacije |
| **Odnos sa slikom** | Gušća strana je iza proizvoda |
| **Statično** | Da |
| **Kretanje** | Ne preporučuje se |
| **Zašto nije generički** | Zrno je stvarni materijal grupe |
| **Rizici** | **Visok** — svaka pravilna gustina se može pročitati kao P-broj koji nismo objavili |
| **Desktop / mobile** | Manje zrna na mobilnom |
| **Performanse** | Jedan generisani gradijent, ne 200 krugova |
| **Novi SVG** | ne |

---

## C · Originalni koncepti (nisu iz zadate liste)

### 17. Weight Line

| | |
| --- | --- |
| **Princip** | Jedna vodoravna linija se **savija pod težinom proizvoda** — jedini element u sceni, ali povezan sa konkretnim proizvodom |
| **Grupe** | Sve; najbolje za teže proizvode (5 L kante, `poliranje`) |
| **Odnos sa slikom** | Ugib je proporcionalan širini content box-a — široka kanta savija liniju više |
| **Statično** | Da |
| **Kretanje** | Opciono: linija se ugne jednom, 400 ms |
| **Zašto nije generički** | Jedna linija koja reaguje na konkretan proizvod je suprotnost dekorativnoj pozadini |
| **Rizici** | Može delovati previše minimalno za hero površinu |
| **Desktop / mobile** | Isto |
| **Performanse** | Jedan path |
| **Novi SVG** | ne |

### 18. Shelf Horizon

| | |
| --- | --- |
| **Princip** | Jedna precizna horizontala deli scenu; proizvod je presecа. Sve iznad je prazno, sve ispod je materijal grupe |
| **Grupe** | Sve — horizonta se menja po grupi |
| **Odnos sa slikom** | Horizont pada na optički centar proizvoda |
| **Statično** | Da |
| **Kretanje** | Opciono: horizont se spusti na mesto |
| **Zašto nije generički** | Deljenje scene na „prazno" i „materijal" daje istu strukturu svim grupama, a različit karakter |
| **Rizici** | Ako je horizont uvek na istoj visini, postaje šablon |
| **Desktop / mobile** | Isto |
| **Performanse** | Trivijalno |
| **Novi SVG** | ne |

### 19. Contact Print

| | |
| --- | --- |
| **Princip** | Scena je „otisak" koji je proizvod ostavio — silueta pomerena i ispunjena tonom grupe, kao pečat |
| **Grupe** | Sve sa alfom |
| **Odnos sa slikom** | Otisak **je** silueta proizvoda |
| **Statično** | Da |
| **Kretanje** | Opciono: otisak se pojavi 120 ms posle proizvoda |
| **Zašto nije generički** | Nemoguće je generički — svaki proizvod pravi svoj otisak |
| **Rizici** | Sa dva otiska scena postaje zbunjujuća; maksimalno jedan |
| **Desktop / mobile** | Isto |
| **Performanse** | Ista slika + `filter: brightness(0)` |
| **Novi SVG** | izvedeno |

### 20. Tolerance Band

| | |
| --- | --- |
| **Princip** | Dve paralelne linije definišu pojas oko proizvoda; pojas je uži za precizne proizvode, širi za grube |
| **Grupe** | `oprema` (1), `abrazivi` (4), `radionica` (14) |
| **Odnos sa slikom** | Pojas se izvodi iz content box-a |
| **Statično** | Da |
| **Kretanje** | Opciono: pojas se skupi na meru |
| **Zašto nije generički** | Prenosi preciznost bez ijedne brojke |
| **Rizici** | **Ozbiljan** — „tolerancija" je tehnički pojam; mora ostati vizuelni, nikad numerički |
| **Desktop / mobile** | Isto |
| **Performanse** | Dve linije |
| **Novi SVG** | ne |

### 21. Stacked Registration

| | |
| --- | --- |
| **Princip** | Nekoliko poluprovidnih kopija istog panela, blago pomerenih — kao slojevi štampe koji nisu savršeno poravnati |
| **Grupe** | Sistemske i grupne stranice |
| **Odnos sa slikom** | Slojevi nose prigušene kopije siluete |
| **Statično** | Da |
| **Kretanje** | Opciono: slojevi se poravnaju u jedan, 500 ms |
| **Zašto nije generički** | Poravnanje slojeva je vizuelna metafora za sistem proizvoda koji rade zajedno |
| **Rizici** | Neusklađenost može delovati kao bag u renderu |
| **Desktop / mobile** | Dva sloja na mobilnom |
| **Performanse** | 2–3 kopije, statične |
| **Novi SVG** | izvedeno |

### 22. Mix Ratio Wedge

| | |
| --- | --- |
| **Princip** | Dva tonska klina se sreću pod uglom — vizuelni izraz mešanja dve komponente, **bez ijednog broja i bez odnosa** |
| **Grupe** | `kitovi` (8), `lepkovi` (1), dvokomponentni proizvodi u `boje` |
| **Odnos sa slikom** | Spoj klinova pada iza proizvoda |
| **Statično** | Da |
| **Kretanje** | Opciono: klinovi se sretnu jednom |
| **Zašto nije generički** | Dvokomponentnost je stvarna osobina grupe |
| **Rizici** | **Najveći rizik od lažne specifikacije u listi** — klin lako izgleda kao 2:1 odnos mešanja. Preporuka: koristiti samo ako se ugao namerno drži „neokruglim" |
| **Desktop / mobile** | Isto |
| **Performanse** | Trivijalno |
| **Novi SVG** | ne |

---

## Rangiranje

### Pet najboljih univerzalnih
1. **Product Echo** (#2) — nemoguće da bude generično, koristi već izmerene podatke, radi za svih 74 non-paint proizvoda i za 758 paint proizvoda
2. **Material Signature** (#1) — najbliži odobrenom spray jeziku, pa sajt ostaje koherentan
3. **Negative-space Reveal** (#3) — jedini pravac sa obrnutom logikom; daje karakter bez dodavanja ijednog objekta
4. **Compression Field** (#4) — scena postoji samo zbog proizvoda
5. **Edge Light** (#7) — najjeftiniji način da panel dobije prostor i težinu

### Pet najboljih category-specific
1. **Surface Transition** (#12) — `abrazivi` + `poliranje` (16 proizvoda), prikazuje rezultat rada
2. **Controlled Fold** (#9) — `maskiranje` + `zastita` (27 proizvoda), najveća non-paint populacija
3. **Abrasion Orbit** (#8) — kružni proizvodi imaju prirodan centar
4. **Modular Workshop** (#13) — `radionica` (14)
5. **Protective Film** (#15) — `zastita` (25), metafora i funkcija se poklapaju

### Pet zanimljivih ali rizičnih
1. **Technical Cutaway** (#10) — presek poziva na brojke koje nemamo
2. **Mix Ratio Wedge** (#22) — klin liči na odnos mešanja
3. **Tolerance Band** (#20) — pojam je numerički po prirodi
4. **Grit Gradient** (#16) — gustina se čita kao granulacija
5. **Stacked Registration** (#21) — neporavnatost liči na bag

### Odbaciti odmah
- **Icon rain / pile** — odbačen ovim krugom; V1/V2 ostaju samo kao arhiva
- **Depth Stack** (#6) kao *karakter* — zadržati isključivo kao neutralni fallback
- **Bond Line** (#14) — 9 proizvoda ne opravdava zaseban jezik; spojiti u Material Signature
- Svaki pravac koji traži bibliotеku od 36–48 ikonica pre nego što je izabran vizuelni smer

---

## Zaključak o obimu

74 proizvoda u deset grupa. **Preporuka: ne graditi deset jezika.** Tri
univerzalna pravca (Product Echo, Material Signature, Negative-space Reveal)
pokrivaju sve grupe uz parametar po grupi, a category-specific pravce uvoditi
samo tamo gde populacija to plaća — realno `zastita` (25), `radionica` (14) i
`poliranje` (12).
