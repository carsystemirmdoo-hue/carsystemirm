# baslac — vizuelna source mapa

Datum: 2026-08-21
Svrha: utvrditi za svaki relevantan baslac artikal šta se stvarno zna o
njegovom identitetu i kakav vizual sme da nosi.

## Pravilo koje važi za ceo dokument

`baslac.de` je webshop koji vodi **KLW GmbH, Hugo-Junkers-Str. 78–80, 50739 Köln**
(potvrđeno u footeru sajta). Nije zvanični Baslac korporativni sajt i **nije
dokaz Carsystem zaliha**. Koristi se samo za potvrdu SKU-a, naziva, zapremine,
izgleda ambalaže i pripadnosti porodici.

Stara ambalaža sa tekstom `A brand of BASF` može prikazivati stvarno postojeće
pakovanje, ali se **ne sme koristiti kao dokaz trenutnog vlasništva ni kao
aktuelna korporativna poruka.**

---

## 0. Dostavljena slika — NOT FOR USE

| Polje | Vrednost |
| --- | --- |
| Fajl | `ChatGPT Image Aug 21, 2026, 08_59_12 AM (1).png` |
| Dimenzije | 1416 × 1111 |
| Format | PNG, mode **RGB** — kanali `('R','G','B')` |
| Alfa kanal | **ne postoji uopšte** |
| Checkerboard | naslikan u same piksele |
| Etiketa | `Line 35 Basecoat`, `A brand of BASF – We create chemistry` |
| SKU | nema |
| Status | **`NOT_FOR_USE`** |

**Razlog nije checkerboard.** Naziv fajla pokazuje da je slika **AI-generisana**.
To znači da su logotip, tekst etikete i oblik ambalaže sintetizovani, a ne
fotografisani. Čišćenje pozadine ne bi rešilo problem — sam motiv nije stvarna
ambalaža.

Zato se ova slika ne koristi ni kao `familyPackshot`, ni posle obrade, ni pod
predloženim imenom `baslac--line-35--family-packshot--front.webp`.

Validator ovo sada odbija automatski:

```bash
node scripts/validate-incoming-assets.mjs
```

```
PROBLEM ChatGPT Image Aug 21, 2026, 08_59_12 AM (1).png
        - naziv ukazuje na AI-generisanu sliku; ambalaza, etikete i logotipi
          se ne generisu vestacki
```

Uz to validator sada prepoznaje i dva slučaja koja si opisao: alfa kanal koji
postoji ali je **potpuno neproviran**, i **checkerboard urezan u piksele**.

**Šta umesto toga:** stvarni family packshot linije 35 treba preuzeti sa
baslac.de product stranice uz potvrđeno pravo korišćenja, ili fotografisati
limenku iz Carsystem zaliha.

---

## 1. Razrešeni identitetski konflikti

Dokazni lanac: oznaka artikla + tačan naziv + zapremina + pripadnost liniji,
međusobno saglasni, plus postojeći TDS linije u repozitorijumu.

### `35-M331` — konflikt razrešen

| Polje | Pre | Posle |
| --- | --- | --- |
| Naziv | Baslac 35-M331 pasta | Baslac 35-M331 Red Xirallic |
| Program | `poliranje` | `boje-i-lakovi` |
| Faza | `poliranje` | `boja` |

Dokaz: `35-M331 Red - Xirallic 0,5` — listing na
`https://www.baslac.de/basislack/35-m331-red-xirallic-05-54464538.html`,
u kategoriji **Basislack**, linija „Konventioneller Basislack Reihe 35".

Tvoja pretpostavka je tačna: „pasta" je pigmentna/toner pasta, ne bodyfiller.
Oznaka `35-M###`, kategorija i Xirallic efekat se slažu međusobno.

### `35-M214` — konflikt razrešen

| Polje | Pre | Posle |
| --- | --- | --- |
| Naziv | Baslac 35-M214 | Baslac 35-M214 Silver Dollar Bright |
| Faza | `lak` | `boja` |

Dokaz: `35-M214 Silver dollar bright 3,5 L` —
`https://www.baslac.de/basislack/35-m214-silver-dollar-bright-35-l-53224337.html`.
Ranija tvrdnja „hardener" iz starog audita je time oborena.

### `30-S510` — i dalje NIJE razrešen

Linija 30 ima dva sistema (standardni Topcoat i CV Topcoat) sa različitim
hardenerima (`50-15/-20/-30` naspram `51-515/-520`). baslac.de listing pokazuje
`30-S330`, `30-S340` u istoj porodici, ali ne razrešava koji je sistem naš
zapis. **Ne menjam ga nagađanjem.**

---

## 2. Source mapa po artiklu

Kolone: SKU · naziv · kategorija · catalog status · stock decision · zvanični
dokument · baslac.de URL · slika · family/specific · etiketa · era · licenca ·
filename · putanja · background · status

### 2.1 Artikli koji su već u Carsystem katalogu

| SKU | Naziv | Kategorija | Catalog | Stock odluka | Dokument | baslac.de | Slika | F/S | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `35-M214` | Silver Dollar Bright 3,5 L | Line 35 basecoat toner | objavljen | **potvrđena** (već u ponudi) | `35_Line.pdf` (linija, ne artikal) | [listing](https://www.baslac.de/basislack/35-m214-silver-dollar-bright-35-l-53224337.html) | nije preuzeta | family | `NEEDS_PERMISSION` |
| `35-M331` | Red Xirallic 0,5 L | Line 35 basecoat toner | objavljen | **potvrđena** | `35_Line.pdf` | [listing](https://www.baslac.de/basislack/35-m331-red-xirallic-05-54464538.html) | nije preuzeta | family | `NEEDS_PERMISSION` |
| `30-S510` | S serija | Line 30 topcoat | objavljen | potvrđena | `30_Line.pdf` / `30_Line_CV.pdf` — ambiguozno | nije nađen tačan listing | postojeća slika je pogrešna | — | `NEEDS_IDENTITY_DECISION` |
| `60-20` | Reducer Universal Normal 5 L | razređivač | objavljen | potvrđena | `60-20.pdf` (EXACT) | — | postojeća slika je pogrešna | specific | `NEEDS_CLEANUP` |

**Za sva četiri** važi: trenutne fotografije u `public/products/baslac/` su
pogrešne ili duplirane (dokazano sha256 poklapanjem i čitanjem etiketa).
Detalji u `CONTENT-ASSET-REGISTER.md`.

Preporučeni nazivi i putanje:

| SKU | Filename | Putanja | Background |
| --- | --- | --- | --- |
| `35-M214` | `baslac-35-m214-packshot-front.webp` | `public/products/baslac/` | transparent |
| `35-M331` | `baslac-35-m331-packshot-front.webp` | `public/products/baslac/` | transparent |
| `30-S510` | `baslac-30-s510-packshot-front.webp` | `public/products/baslac/` | transparent |
| `60-20` | `baslac-60-20-5l-packshot-front.webp` | `public/products/baslac/` | transparent |
| Line 35 porodica | `baslac-line-35-family-packshot-front.webp` | `public/products/baslac/families/` | transparent |
| Line 45 porodica | `baslac-line-45-family-packshot-front.webp` | `public/products/baslac/families/` | transparent |

### 2.2 Artikli koji NISU u katalogu

Za sve njih postoji zvanični TDS na disku, ali **dokumentacija nije dokaz da
Carsystem proizvod prodaje ili drži na stanju.** Zato su svi
`NEEDS_IDENTITY_DECISION` na nivou stock odluke, bez obzira što je identitet jasan.

| SKU | Naziv iz TDS-a | Kategorija | Catalog | Stock odluka | Vizuelni tretman |
| --- | --- | --- | --- | --- | --- |
| `12-20` | Bodyfiller Universal | kit / bodyfiller | nije | **nije doneta** | pravi kit: gusta svetlosiva masa, trag špahtle |
| `40-100` | High Speed 2K Clear VOC | clearcoat | nije | nije doneta | transparentan glossy sweep, bez lažnog pigmenta |
| `20-24` | 2K Primerfiller, grey | primer-filler | nije | nije doneta | mat prskana površina, neutralna siva |
| `27-10` | 2K Washprimer | washprimer | nije | nije doneta | mat prskana površina |
| `25-30` | 2K Primerfiller EP | epoxy primer | nije | nije doneta | mat prskana površina |
| `50-415/-420/-430` | 2K Clear Hardener VOC | hardener | nije | nije doneta | čist tehnički background, neutralan fluid |
| `50-510/-530` | Ambient Clear Hardener | hardener | nije | nije doneta | isto |
| `45-R45` | Dilutant | reducer | nije | nije doneta | transparentan/neutralan fluid |
| `45-W10` | 3-Stage Additive and Blending Clear | aditiv | nije | nije doneta | transparentan sweep |
| `80-20 / 80-30` | Additive Mat / Plast | aditivi | nije | nije doneta | neutralan tehnički prikaz |

Zapremine i varijante iz baslac.de listinga (`35-M341`, `35-M302`, `45-W495`,
`45-W221`, `45-W1130`, `45-W435`, `30-S330`, `30-S340`, `35-M1541`) **nisu**
unete u katalog. Postojanje na nemačkom webshopu nije razlog za objavu.

---

## 3. Family vs. specific vizuelni model

Uveden je opcioni `visualIdentity` blok na product tipu
(`lib/carsystem-data.ts`), tako da postojećih ~840 zapisa ostaje netaknuto:

```ts
export type ProductVisualIdentity = {
  packshotKind: "specific" | "family";
  visualFamily?: string;        // npr. "baslac-line-35"
  swatch?: string;              // nijansa varijante
  finishType?: "solid" | "transparent" | "metallic" | "pearl" | "xirallic" | "mat";
  imageConfidence: "confirmed" | "family-only" | "unverified" | "conflicting";
  imageSource?: string;
  imageSourceUrl?: string;
  packagingEra?: string;        // npr. "basf-era"
};
```

Pravila:

1. **Konkretan packshot ima prioritet.** Ako postoji `specific`, koristi se.
2. **Family packshot se koristi samo na nivou porodice** — kao hero linije, ne
   kao slika svakog pojedinačnog tonera.
3. **Varijante se prikazuju kroz listu/swatch**, ne kroz desetine identičnih
   kartica: SKU, naziv nijanse, zapremina, color swatch, finish oznaka,
   dokumentacija.
4. `imageConfidence: "conflicting"` znači da slika i zapis protivreče jedno
   drugom — takav zapis se ne objavljuje kao da je potvrđen.

Trenutno popunjeno stanje:

| Slug | packshotKind | visualFamily | finish | imageConfidence |
| --- | --- | --- | --- | --- |
| `baslac-35-m214` | family | `baslac-line-35` | metallic | `family-only` |
| `baslac-35-m331-pasta` | family | `baslac-line-35` | xirallic | `family-only` |
| `baslac-30-s510-s-serija` | family | `baslac-line-30` | — | `conflicting` |
| `baslac-60-20-razredjivac` | specific | — | — | `conflicting` |

## 4. Vizuelni tretman po tipu proizvoda

Ovo su pravila za buduće sekcije, da se materijal ne predstavlja pogrešno.

| Tip | Ispravan tretman | Zabranjeno |
| --- | --- | --- |
| Line 35 / 45 toneri | tanji tečni potez boje, lakirana color-card površina, metallic grain, pearl/iridescent preliv, diskretan sprayed edge | debela kit-pasta |
| `12-20` bodyfiller | gusta svetlosiva/bela masa, trag špahtle, postojeći putty sistem | — |
| Primeri i fileri | mat prskana površina, grey/white/black samo kada je potvrđeno | efekat guste mase |
| Clearcoat (`40-100`) | transparentan glossy sweep, refleksija lakirane površine | lažna pigmentna boja |
| Hardener / reducer | čist tehnički background, transparentan/neutralan fluidni trag | prikaz kao obojene baze |

## 5. Šta sledeće treba tebi da bude odluka

1. **Pravo korišćenja slika sa baslac.de** — bez toga nijedan family ni specific
   packshot ne može da se preuzme.
2. **`30-S510`: standardni Topcoat ili CV Topcoat?** Bez toga ostaje
   `NEEDS_IDENTITY_DECISION`.
3. **Stock odluka** za artikle iz 2.2 — tek posle nje ima smisla naručivati
   fotografije.


---

## 6. Isporuka `41888e0e-…zip` — status 2026-08-22

**ZIP nije pristupačan.** Pretraga celog fajl-sistema (`find /`), `~/Downloads`,
`~/Desktop`, `_incoming/` i scratchpad foldera ne nalazi
`41888e0e-ea39-4820-8819-3746e258c5ff.zip` ni bilo koji nedavni ZIP. Preflight
tabela iz odeljka 2 zadatka zato nije mogla da se napravi iz stvarnih fajlova.

Registrovano je svih 18 očekivanih asseta (12 konkretnih packshotova, 4 family
packshota, nedostajući `20-94` 1 L) u `CONTENT-ASSET-REGISTER.*` sa statusom
`NEEDS_ASSET` i tačnim `expectedDesktopFilename` + `targetPath`.

### Otvoreno pitanje pre importa

Zadatak sam navodi da jedan fajl nosi naziv
`ChatGPT Image Aug 21, 2026, 12_54_38 PM.png` i da **svi** dostavljeni PNG-ovi
imaju checkerboard urezan u piksele bez stvarne alfe. To je isti potpis kao kod
fajla koji je odbijen 2026-08-21 (odeljak 0 ovog dokumenta) — AI generator, ne
foto-studio.

Ako su ovih 17 fajlova AI-generisani prikazi Baslac ambalaže, uklanjanje
checkerboarda ih ne čini upotrebljivim: logotip, tekst etikete i sigurnosne
oznake bili bi sintetizovani, a objavili bi se kao stvarne fotografije
proizvoda u javnom katalogu distributera.

Ako su fotografije stvarne ambalaže kojima je checkerboard samo kompozitovan
kao pozadina, import je u redu i pipeline je spreman.

**Ovo je pitanje na koje ne mogu da odgovorim bez fajlova.**
