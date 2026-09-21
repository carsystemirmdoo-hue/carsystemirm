> **STATUS: HISTORICAL_IMPLEMENTATION_EVIDENCE**
>
> Current-main state (2026-09-21, `main` = `7f9f6179d347348b39dec7609e653d2c7971d607`):
>
> - V6A / V6B / loading-shadow gate NISU na current `main` (istorijski `IMPLEMENTED_AND_VERIFIED` samo u starom, nekomitovanom worktree-u na `7d6b8df`);
> - V6C NIJE odobren;
> - enhanced pilot assets = 0 integrated (0 odobreno); `productImage` reference nepromenjene;
> - dokument služi kao evidence/handoff za budući quality rollout, ne kao opis današnjeg koda;
> - današnji product/brand identities se UVEK uzimaju iz current runtime-a (npr. 25 tadašnjih „Carsystem” RUPES proizvoda danas ima `brandSlug = rupes`); usklađeni nalazi po današnjem identitetu su u `data/catalog/image-quality/IMAGE_QUALITY_QUEUE.csv`.
>
> Istorijski sadržaj ispod ove napomene nije menjan. SHA-256 originalnog handoff fajla: `b402aa3e09aadb0432e09b36e3d4d5f69bb91b9d7c08ace04edd241b698400e3` (jedina razlika u telu: uklonjen jedan razmak na kraju reda 91).

---

# CARSYSTEM_IMAGE_AUDIT_FULL_CONTEXT

Potpun kontekst razgovora „Carsystem product packshot — audit, pilot, rendering V6" (20–21. 9. 2026).
Sastavljeno iz stvarnih poruka korisnika, izvještaja svake faze i trenutnog stanja repozitorijuma. Ništa nije dodato što nije bilo u razgovoru.

Oznake statusa korištene u dokumentu:

- `IMPLEMENTED_AND_VERIFIED` — u kodu je i provjereno testovima/browserom
- `PLANNED_NOT_IMPLEMENTED` — samo plan ili prijedlog
- `REJECTED` — odbačeno (od korisnika ili mjerenjem)
- `UNCONFIRMED` — nisam siguran / detalj nije sačuvan u kontekstu

Osnovni podaci:

| | |
|---|---|
| Projekat | sajt **Carsystem i R-M Inđija d.o.o.** (Next.js 15.5.19 App Router, TypeScript, CSS Modules, React 18.3.1) |
| Repo | `/Users/miledulic/Desktop/Projects/carsystem` |
| Branch / HEAD | `chore/repo-cleanup-2026-09` / `7d6b8dfa671ab9638297232a8f76369793f68e2e` (u ravni sa `origin`, 0 ahead / 0 behind) |
| Stanje | **sve izmjene ovog projekta su NEKOMITOVANE u radnom stablu**; ništa nije pushovano |
| Jezik rada | srpski/bosanski, latinica |
| Radni folder van repoa (dokazi, skripte, ZIP-ovi) | `/private/tmp/claude-501/-Users-miledulic-Desktop-Projects-carsystem/e81e30f7-b2c2-4a78-a915-979086f1769f/scratchpad/` (privremena lokacija — može nestati) |

---

## 1. Cilj projekta

Korisnikova formulacija (prva poruka): potpun audit i standardizacija Carsystem product packshot slika **„bez gubitka autentičnosti proizvoda"**.

- „Cilj NIJE da AI redizajnira proizvode. Cilj je: istu stvarnu fotografiju proizvoda učiniti čistijom, svjetlijom, konzistentnijom i profesionalnijom, bez mijenjanja identiteta proizvoda."
- Poseban image-quality projekat: „Ne diraj katalogsku logiku, product identity, sync coverage niti customer-facing podatke osim referenci na novu odobrenu sliku kada dođemo do te faze."
- Rad ide u fazama; svaku fazu korisnik izričito odobrava, a svaka završava sa „STOP".

Tokom rada se cilj u praksi podijelio na dva odvojena toka:

1. **Asset tok** (kvalitet samih fajlova): audit → pilot re-exporta iz zvaničnih originala. Završen do nivoa „pilot spreman za ručni pregled"; **nijedan asset nije odobren ni integrisan**.
2. **Rendering tok** (kako sajt crta slike): pokazalo se da je veliki dio „loših" kartica problem fita i CSS sjenki, ne fajla. Iz toga je nastao **V6** (V6A fit + V6B sjenka), koji je implementiran i provjeren, ali **nije commitovan**.

## 2. Početni problem

Na produkcijskom `/katalog?brend=carsystem` dio Carsystem slika izgleda: pretamno; sivo/isprano; sa lošom ili neujednačenom pozadinom; sa lošim cropom; sa previše praznog prostora; sa slabim kontrastom; kao stara katalog fotografija; neusklađeno sa ostalim karticama.

Šta je audit stvarno našao (mjerenjem, ne utiskom):

### 2.1 Sistemski gubitak tona u izvoru (asset problem)
- carsystem.org servira 660 px `_processed_` derivat koji je **mjerljivo tamniji i zasićeniji** od zvaničnog originala: `runtime ≈ original ^ γ`, γ **2,07–2,27** (medijana 2,21), promjena medijane luminance −26,6 % do −90,3 %.
- Potvrđeno na **15 od 15 izmjerenih PNG parova** (5 sa ICC Adobe RGB 1998, 10 bez ikakvog profila). Jedini WebP original: γ 1,00 (`not_detected`).
- Gubitak nastaje **na serveru carsystem.org** (original → `_processed_`). Naš `publish_images.py` re-encode je vjeran (60,7→60,7; 67,0→68,0; 124,7→125,0).
- Hipoteza „skidanje ICC profila" je **povučena** (isti γ≈2,2 i na fajlovima bez profila). Mehanizam na serveru je nepoznat (hipoteza: resize u linearnom svjetlu bez povratka u sRGB) — `UNCONFIRMED`.
- **Zabranjena ekstrapolacija**: 447 od 463 asseta ima `pipelineToneStatus: unknown`.

### 2.2 Rubni alfa okvir (asset problem, 6 asseta)
- 6 asseta ima poluprovidnu **bijelu liniju debljine 1 px uz samu ivicu platna** (postoji već u fajlu proizvođača). Primjer `rupes-polishing-machine-lhr75`: prsten 0 alfa 55, uglovi 98.
- Posljedica: bounding box `alpha > 24` postaje cijelo platno → fit sistem skalira platno umjesto proizvoda; u tamnoj temi okvir se vidi kao blijedi pravougaonik.
- Moj prvi opis („veo preko cijelog platna") je bio pogrešan i ispravljen.

### 2.3 Fit sistem mjeri sjenku kao proizvod (rendering problem)
- `scripts/extract-product-image-metrics.py` računa content box po `alpha > 24`, što uključuje zapečenu (baked) zvaničnu sjenku. Proizvod se zato crta manji.
- **70 kartica** renderuje proizvod ≥10 % manjim nego što bi trebalo (`css-rendering-candidates.csv`).

### 2.4 CSS sjenke kartice (rendering problem)
- `.contactShadow` i `drop-shadow` na kartici uzimaju boju iz `--foreground` → u **tamnoj temi postaju SVIJETLE** (+12 do +15 L* ispod proizvoda).
- `.contactShadow` je vezan za dno površine, ne za proizvod: kod širokih/niskih proizvoda visi 40–58 px ispod njih.
- Do **tri sloja sjenke odjednom** (zvanična + contactShadow + drop-shadow).
- PDP hero nema taj problem (nema `.contactShadow`, a njegov `drop-shadow` je eksplicitno taman).

### 2.5 Svojstvo zvaničnih asseta koje se NE može riješiti CSS-om
- Zvanična „sjenka" je svijetlosiv poluprovidan sloj (RGB≈177, alfa≈69) pravljen za bijelu podlogu. Na tamnoj površini `rgb(19,19,22)` vidi se kao **svijetli oreol** (+14 do +22 L*), i kad se uklone sve CSS sjenke. 36 od 80 asseta sa mekim proširenjem ima svijetao sloj (≥140).
- Oreol nestaje tek kad je površina iza proizvoda svijetla (~160–200). To je **estetska odluka o tamnoj temi**, ne bug → V6C, koji **nije odobren**.

### 2.6 Odbačeni signali (lažno pozitivni na ovom asortimanu) — `REJECTED`
- luminanca kao mjera „pretamne slike" (Carsystem je crven: 230 od 463 mjere kao „very-dark" bez defekta);
- `SOFT_IMAGE` / `LOW_DETAIL` (pjenasti padovi, rolne, abrazivi su stvarno mat);
- `skinShare` detektor ljudi (pali na bež trakama i zlatnim diskovima).

## 3. Dogovorena pravila za obradu slika

### 3.1 Identitet proizvoda je ZAKLJUČAN (korisnik, poruka 1)
Strogo zabranjeno mijenjati: Carsystem logo; tekst etikete; product name; article number; hazard piktograme; količinu; oblik ambalaže; odnos širine/visine proizvoda; čep; ručku; boju ambalaže; broj proizvoda u packshotu; raspored elemenata na etiketi. Ako se ijedno promijeni → rezultat je `REJECTED`.

### 3.2 Original se nikad ne prepisuje
„Nikada: overwrite; destructive edit; rename originala radi zamjene; delete." Mora se u svakom trenutku moći vratiti na original. Korisnik je predložio strukturu `public/products/carsystem/original/` + `public/products/carsystem/enhanced/` „ili postojeću bolju". **Trenutno: `public/products/carsystem/enhanced/` NE postoji i izričito je zabranjeno kreirati ga** dok asseti nisu odobreni.

### 3.3 Provenance
Za svaku enhanced sliku: original path, enhanced path, manufacturer code, transformation type, `deterministic`/`AI-assisted`, datum, original SHA256, enhanced SHA256, approval status. Predložen fajl `data/carsystem-image-enhancement.generated.json` — `PLANNED_NOT_IMPLEMENTED`. U pilotu postoji samo `provenance-draft.json` van repoa. **„Ne mijenjaj runtime reference dok `approvalStatus !== approved`."** Svi pilot rezultati su `pending_manual_review`.

### 3.4 Vizuelni standard (poruka 1)
Proizvod jasno odvojen od pozadine; neutralna ili transparentna pozadina; prirodno osvjetljenje; bez pregorenih bijelih i pretamnih crnih površina; etiketa maksimalno čitljiva iz originala; prirodne originalne boje; bez AI „beauty" izgleda; bez novih refleksija; bez lebdećeg proizvoda ako original ima prirodnu sjenu; konzistentan padding i scale. „Ne pokušavaj učiniti sve proizvode identičnim."

### 3.5 Brightness / exposure / contrast
- **Nema globalnog brightness/gamma/exposure pravila** („Ne koristi globalno `brightness +20%`").
- „Ne koristi AI samo zato što je proizvod taman ili crn."
- Dogovoreni metod za tamne slike nije posvjetljivanje nego **REEXPORT_FROM_OFFICIAL_ORIGINAL**: ponovni deterministički export iz zvaničnog originala, koji nema gubitak tona. Bez levels, bez izoštravanja, bez cropa, bez retuša.

### 3.6 Color management
ICC profil se **pravilno konvertuje u sRGB** kad postoji (lcms2, relative colorimetric); ne smije se samo ukloniti; za original bez profila se **ne pretpostavlja** nikakav profil; potvrđuje se browser-rendered izgled, ne samo numerička luminanca.

### 3.7 Crop / padding / platno
Bez cropa i bez proširenja platna u pilotu. „Padding" tretman je ocijenjen kao besmislen jer fit sistem ionako mjeri content box (`proflex-mercury` je zato izbačen iz pilota). Veličina/pozicija proizvoda na kartici se rješava **mjerenjem (subjectBox), ne izmjenom fajla**.

### 3.8 Background / transparent background
- Nikad cut-out tamo gdje je materijal cijeli kadar (`glass-fibre-fleece`: izlaz mora ostati 100 % neprovidan).
- **`alpha < 100 → 0` je `REJECTED`** (korisnik: uklanja antialiasing, meku sjenku, poluprovidne dijelove). Zamijenjen metodom **BORDER_FRAME_STRIP** (vidi 4.1).
- Zabranjeno u rendering radu: izmjena alfa kanala asseta, dark-theme duplikati asseta.

### 3.9 Shadow
Zvanična zapečena sjenka se **čuva u assetu**. CSS smije dodati najviše **jednu** sjenku, i samo kad asset nema svoju jaku. CSS sjenka: ne koristi `--foreground`, tamna u obje teme, usidrena pod izmjereno dno subjekta, ne mijenja RGB/opacity/filter samog asseta.

### 3.10 Zabranjene tehnike u renderingu (poruka 6)
`filter: brightness`, `filter: contrast`, `mix-blend-mode`, `opacity` nad cijelom slikom, izmjena alfe asseta, dark-theme asset duplikati, AI, globalno pravilo koje zavisi samo od luminance proizvoda.

### 3.11 Multi-product
Ne pretvarati multi-product sliku u single-product (komplet, više veličina, family, grupa limenki, oprema, merch).

### 3.12 Bez mass apply
„Ne zamjenjuj svih 462… Ne radi bulk AI edit bez individualnog reviewa. Ne mijenjaj `productImage` reference. Ne commituj enhanced slike. Ne pushuj."

### 3.13 Score
Quality score služi **samo za redoslijed pregleda**, nikad kao automatska odluka.

### 3.14 Validacioni pragovi
Pragovi su fiksirani prije mjerenja. **Ne rekalibrisati ih poslije rezultata** („Ne mijenjaj pragove dok manual review ne potvrdi klasifikaciju"). Za detektor sjenke: „Podesi metod, ne prag naslijepo… koristi geometriju i položaj alfa komponente ispod proizvoda, ne luminancu proizvoda."

### 3.15 Original vs placeholder
- Placeholder = `src` sadrži `placeholder-product` (`/images/products/placeholder-product.svg`). Dva Carsystem proizvoda ga imaju: `carsystem-soft-plus-git`, `carsystem-p23-brusni-diskovi`.
- Placeholder nikad ne dobija fit ni V6 (`hasProductAsset` je `false`).
- U ovom razgovoru **nije donesena nova odluka** o tome kada se prikazuje placeholder umjesto slike; važi zatečeno ponašanje.

### 3.16 Image rights / provenance odluke
- Izvor svih Carsystem slika je carsystem.org (`/fileadmin/products/images/…`); `officialOriginalUrl` je zabilježen u audit CSV-u.
- Privremeni download originala dozvoljen **samo van repoa, bez bulk downloada, uz popis preuzetog**: HEAD za 44 kandidata; ranged GET zaglavlja (2,88 MB); puno preuzimanje 16 originala (24,6 MB) za mjerenje tona; u pilotu 6 originala.
- Nije bilo posebne rasprave o pravima korištenja slika u ovom razgovoru. (CLAUDE.md projekta traži oprez sa pravnim tvrdnjama o brendovima; to nije mijenjano.)

### 3.17 Opšta pravila rada koja je korisnik ponavljao
Postojeće korisničke nekomitovane izmjene: **ne dirati, ne stashovati, ne prepisivati**. Ne popravljati nepovezan kod. Ne refaktorisati radi manjeg broja linija. Ako browseri ne renderuju identično — prijaviti, ne sakrivati tolerancijom. Ne proširivati scope. Ne commitovati i ne pushovati bez izričitog odobrenja.

## 4. Tehnički model / kod

### 4.1 BORDER_FRAME_STRIP (metod za rubni okvir) — dokumentovan i korišten samo u pilotu, van repoa
Parametri `K_MAX = 4`, `RING_TOL = 6`, `GUARD = 8 px`. Radi nad **lossless izvorom** (original PNG), nikad nad objavljenim lossy WebP-om.
1. Zaštićeni core `C = alpha ≥ 250`; zaštićena zona `P` = `C` dilatiran za 8 px.
2. Prsten `k` je „okvirni" ako je medijana alfe u (0,250) i raspon p1–p99 ≤ 6. Stati na prvom prstenu medijane 0 → `k*`.
3. Jarak: prsten `k*` mora biti 100 % `alpha == 0`.
4. Maska `F` = pikseli prstenova `0…k*−1` sa `alpha > 0`. Operacija: `alpha[F] = 0`; RGB se ne dira.
Auto-reject R1–R10 (nema okvira / predebeo; neuniforman prsten; jarak nije čist; `F ∩ P ≠ ∅`; bilo koji piksel van `F` promijenjen; lokalitet; core box promijenjen; novi box nije unutar starog; dimenzije platna; encoder parity > 2 nivoa).
Simulacija: PASS — `lhr75`, `lh19e`, `vacuum-cleaner-s145`, `paint-trolley-flexi-plus`; REJECT — `rupes-orbital-sander-slp41a` (R4, proizvod 6 px od ivice), `rupes-skorpio-e-rx` (R1/R2, okvir nepotpun).
Alternativa bez diranja asseta (generator ignoriše rubne prstenove) — `PLANNED_NOT_IMPLEMENTED`; V6A hibridni box u praksi rješava veličinu, ali okvir ostaje vidljiv u tamnoj temi.

### 4.2 REEXPORT_FROM_OFFICIAL_ORIGINAL (pilot, van repoa)
original (SHA256 zabilježen) → ICC→sRGB samo ako profil postoji → Lanczos downscale u **premultiplied alfi** na 660 px (**nikad upscale**) → WebP q90, method 6, alfa sačuvana (isti parametri kao `publish_images.py`). Auto-reject T1–T8: γ van 0,97–1,03; IoU siluete < 0,98; omjer strana core boxa > 0,5 %; broj komponenti ≠; clipping +0,5 pp; korelacija ivica < 0,90; dimenzije/ugaona alfa; fajl > 3×. Dodatna A-pravila u pilotu (A1 SSIM ≥ 0,97; A6 encode parity ≤ 2 nivoa; A7 kontrola; A8 ΔE po pikselu ≤ 2,0 / p95 ≤ 6,0).

### 4.3 Postojeći fit sistem (zatečeno, NE mijenja se)
- `scripts/extract-product-image-metrics.py` → `data/product-image-metrics.generated.json` + `components/product/ProductImageFit.generated.module.css`.
- CSS custom properties po slici: `--product-content-aspect | fill-x | fill-y | offset-x | offset-y`, `--product-canvas-aspect`; selektor `.fit[data-product-fit="<putanja slike>"]`.
- Envelope po klasi veličine — kartica: S 58cqw×72cqh, M 66×78, L 74×84, XL 82×90 (optical-y 49 %, aspect površine 1,1); PDP: S 58×74, M 66×80, L 74×86, XL 82×92 (optical-y 48 %).
- PDP stage format (portrait 5/6, square 1/1, landscape 4/3) bira `resolveStageFormat` iz **legacy `metrics.aspect`** (pragovi 0,8 / 1,45). Zato se `box`/`aspect` **nikad ne mijenjaju** (inače 7 asseta mijenja format stage-a).
- Kartica = `ProductVisualSurface` (`.contactShadow` je pravi `<span>`, ne pseudo-element; `.productImage` ima drop-shadow). PDP hero = `ProductDetailExperience` stage (`data-product-hero-visual`, `.heroProductImage`, `.stagePlate`, `.stageHalo`).
- `next/image`: sharp `rotate().resize(w, undefined, {withoutEnlargement:true})`, formati AVIF/WebP; optimizer **nikad ne uvećava**.

### 4.4 V6A_FIT — hibridni subject box — `IMPLEMENTED_AND_VERIFIED` (nekomitovano)
Zašto ne čisti `alpha ≥ 250`: izostavlja stvaran dio proizvoda na **38 od 463** asseta (providni poklopci, kape, nogavice koje blijede, rub poklopca limenki).
Algoritam (samo geometrija i alfa, bez RGB-a):
1. opaque core = `alpha ≥ 250`;
2. rim = 2 px oko jezgra → subjekt;
3. svaki preostali meki piksel (`24 < alpha < 250`): **shadow zona** = ispod dna jezgra u svojoj koloni, ili u koloni bez jezgra ali u prizemnom pojasu (donjih 35 % visine jezgra) → nije subjekt; **detail zona** = sve ostalo → subjekt ako `alpha ≥ 128`;
4. visoka poluprovidna masa ispod jezgra → subjekt + `translucentBelowCore` (0 slučajeva u katalogu);
5. 1 px opening.
Konstante u generatoru:
```python
SUBJECT_FIT_PREFIXES = ("/products/carsystem/",)
FIT_MODEL_VERSION = 1
SUBJECT_RULE_MIN_DELTA = 0.005
SUBJECT_CORE_ALPHA = 250; SUBJECT_DETAIL_ALPHA = 128; SUBJECT_RIM_PX = 2; GROUND_BAND = 0.35
```
Sanity u generatoru: subjekt unutar legacy boxa, pokriva core, w/h ≥ 8, površina ≥ 25 % legacy boxa, `min(lw/w, lh/h) ≤ 1.4`. Polja se pišu samo za allowlistu i `mask_source == "alpha"`.
Nova polja manifesta (čisto aditivno, `schemaVersion` ostaje 1): `fitModelVersion`, `subjectBox`, `subjectAspect`, `subjectCenter`, `officialShadow`.
V6 CSS: blok dodat **IZA netaknutog legacy bloka**, pravila `.fit[data-product-fit="…"][data-product-fit-model="v6"] { 5 svojstava }`, samo gdje se subject box razlikuje od legacy boxa za > 0,5 % platna → **140 pravila** (bez praga bilo bi 262).

### 4.5 V6B_SHADOW — model `officialShadow` — `IMPLEMENTED_AND_VERIFIED` (nekomitovano)
Geometrijski detektor (samo alfa ispod proizvoda): `underCoverage`, `underMeanThick` (px @660), `lateralExt`.
```python
SHADOW_STRONG_LATERAL = 0.10; SHADOW_STRONG_THICKNESS = 5.0; SHADOW_STRONG_COVERAGE = 0.2
SHADOW_THIN_THICKNESS = 1.5; SHADOW_THIN_COVERAGE = 0.25; SHADOW_THIN_LATERAL = 0.04
OFFICIAL_SHADOW_OVERRIDES = {"/products/carsystem/catalog/carsystem-glass-fibre-reinforced-putty.webp": "unknown"}
```
STRONG ako `lateralExt ≥ 0,10` ili (`thick ≥ 5` i `coverage ≥ 0,2`); THIN ako `thick ≥ 1,5` ili `coverage ≥ 0,25` ili `lateralExt ≥ 0,04`; inače NONE.
Pravila prikaza:

| `officialShadow` | kartica | PDP hero |
|---|---|---|
| `strong` | 0 CSS sjenki (`.contactShadow {display:none}`, `.productImage {filter:none}`) | `filter: none` (light i dark) |
| `none` | tačno 1 tamna usidrena sjenka, opacity 0,55 | bez V6 pravila → zatečeni tamni `drop-shadow` |
| `thin` / `unknown` | tačno 1 slabija, opacity 0,32 | slabiji `drop-shadow(0 18px 24px oklch(0.08 0.01 250 / 0.14))`; dark: rub + `oklch(0.02 0.01 250 / 0.26)` |

CSS kartice (sve pod `.surface[data-product-shadow-model="v6"]`):
```css
.surface[data-product-shadow-model="v6"] .productImage { filter: none; }
.surface[data-product-shadow-model="v6"] .contactShadow {
  --product-envelope-w: 84cqw; --product-envelope-h: 84cqh;
  --product-fit-w: min(var(--product-envelope-w), calc(var(--product-envelope-h) * var(--product-content-aspect)));
  --product-v6-shadow-h: max(8px, calc(var(--product-fit-w) * 0.06));
  top: calc(49% + var(--product-fit-w) / var(--product-content-aspect) / 2 - var(--product-v6-shadow-h) * 0.45);
  bottom: auto; width: calc(var(--product-fit-w) * 0.78); height: var(--product-v6-shadow-h);
  background: oklch(0.08 0.01 250 / 0.5); filter: blur(7px); opacity: 0.55;
}
/* + 4 pravila lestvice S/M/L/XL (ista kao .objectWrap; test 8c pazi da se ne raziđu) */
/* thin/unknown: opacity 0.32;  strong: display: none */
```
Svjesno zadržano: **1 px svijetli rub (`drop-shadow(0 0 1px …)`) na PDP-u u tamnoj temi** za none/thin/unknown — obris, ne sjenka; uklanjanje bi bilo van otključanog opsega.

### 4.6 Aktivacija V6 (`lib/productFitModel.mjs`, čista logika)
V6 je aktivan SAMO kada: `brandSlug === "carsystem"` **i** slug nije u `V6_FIT_EXCLUDED_SLUGS` **i** generator je upisao V6 polja **i** `isSaneSubjectMetrics(metrics)` prolazi. Inače `resolveOfficialShadowV6` vraća `null` → nema atributa → zatečeni fit i zatečene sjenke.
`isSaneSubjectMetrics`: `fitModelVersion === 1`; `officialShadow` iz dozvoljenog skupa; `subjectBox` 4 konačna broja, ≥ 8×8, unutar `box` i platna; `min(bw/sw, bh/sh) ≤ 1.4`; površina ≥ 25 % legacy boxa; `|subjectAspect − sw/sh| ≤ 0.01`; `subjectCenter` 2 broja.
Atributi koje dobija površina/stage: `data-product-fit-model="v6"`, `data-product-shadow-model="v6"`, `data-product-official-shadow="strong|thin|none|unknown"`.
Server-only adapter `lib/product-fit-model.ts`: `getOfficialShadowV6(product, src)`, `withProductFitModel(entities)` (dodaje `presentation.officialShadow`; vraća istu referencu kad nije V6). Odluka se donosi na serveru jer manifest ne smije u klijentski bundle.
U `ProductVisualSurface.tsx`: `const v6Shadow = hasProductAsset && !image ? (resolved.officialShadow ?? null) : null;` — `image` prop (galerija) mijenja sliku poslije odluke servera, pa tada ostaje legacy.

### 4.7 Gate sjenke na učitanu sliku — `IMPLEMENTED_AND_VERIFIED` (nekomitovano, posljednja dopuna)
Problem: V6 `.contactShadow` je poseban element, pa je tokom učitavanja stajao sam (usamljena tamna traka).
- `components/product/productImageLoadState.mjs` → `watchProductImageLoad(img, onSettle)`: stanja `loading → loaded | failed`; bez React-a.
  - `loaded` tek poslije `load` **i** `img.decode()` (inače sjenka frejm-dva prije piksela);
  - cache / učitano prije hidracije: provjera `img.complete` odmah pri kačenju;
  - greška: `error` događaj, ili `complete` uz `naturalWidth === 0` (pala prije hidracije);
  - brojač generacije: zakašnjeli `decode()` ne može vratiti sjenku slici koja je u međuvremenu pala;
  - modul pamti `currentSrc` već dekodiranih slika (`decodedSources`) i za njih javlja `loaded` **sinhrono** → pri ponovnom montiranju kartice nema frejma bez sjenke. Uslov `complete` + `naturalWidth > 0` i dalje važi.
- `ProductVisualSurface.tsx`: stanje vezano za `src` (`settledImage`), `ref` na `<Image>`, `useLayoutEffect`, atribut `data-product-image-state` **samo na V6 karticama**. `<Image>` NIJE dobio `onLoad`/`onError` (Next-ov `onError` radi `img.src = img.src` na svakoj kartici, a njegov `onLoad` opali i za slomljenu `complete` sliku).
- CSS (jedno pravilo): `.surface[data-product-shadow-model="v6"]:not([data-product-image-state="loaded"]) .contactShadow { visibility: hidden; }` — `visibility`, ne `opacity`/`display`, da hover i reduced-motion ostanu isti. Server uvijek šalje `loading` → nema bljeska ni prije hidracije.
- Poznata granica: **bez JavaScripta V6 kartica nema CSS sjenku** (slika i sve ostalo radi).
- PDP hero ovo ne treba (sjenka je `drop-shadow` na samoj slici).

### 4.8 V6C_DARK_POOL — `REJECTED` za implementaciju (nije odobren)
Prototipirane opcije: bez poola; slab radijalni pool (`closest-side`, centar rgb 60,62,68; ivica prema uglu 0,4 L*, oreol jedva smanjen); postojeći V6 pool (66 %×60 %, centar rgb 176; ivica 26,3 L* — **vidljiva pravougaona ivica**, ne ispunjava uslov). V5 well `rgb(160,162,166)` gasi oreol ali je „svijetli pravougaonik u tamnoj kartici". Konačna estetska odluka **nije donesena**. Test u repou potvrđuje da V6 pravila nemaju gradient/pool/well.

## 5. Sve implementirane promjene

Sve ispod je u radnom stablu, **nekomitovano**. `IMPLEMENTED_AND_VERIFIED` osim gdje piše drugačije.

| fajl | izmjena |
|---|---|
| `scripts/extract-product-image-metrics.py` | +217/−2: `_dilate`, `_bbox`, `measure_subject(alpha, legacy_box)`, `_subject_fields(...)`, `measure(path, href=None)`, detektor `officialShadow`, allowlista, override, dodatni V6 CSS blok |
| `data/product-image-metrics.generated.json` | regenerisano: 1 085 ne-Carsystem stavki **bajt-identično**; sva legacy polja nepromijenjena; **488** Carsystem stavki dobilo V6 polja. SHA256 `0aa9f098049d779cd012e237efef297116e8dcf3a93d25aa5136dc8b1a5747e4` |
| `components/product/ProductImageFit.generated.module.css` | počinje cijelim starim fajlom; +140 V6 pravila. SHA256 `45064f6770e982b1a958742e4d63bea05922f052a5460418aea2394ac130caca` |
| `lib/productFitModel.mjs` (novo) | pravilo aktivacije, lista izuzetaka, sanity |
| `lib/product-fit-model.ts` (novo, `server-only`) | `getOfficialShadowV6`, `withProductFitModel` |
| `lib/product-image-metrics.ts` | opciona V6 polja u tipu |
| `components/product/productVisualPresentation.ts` | `officialShadow?` u `ProductVisualPresentation` |
| `components/product/ProductVisualSurface.tsx` | 3 V6 atributa (+10) **+ dopuna učitavanja (+32/−0)** |
| `components/product/ProductVisualSurface.module.css` | V6B blok (+77) **+ gate pravilo (+12/−0)** |
| `components/product/productStageImages.ts`, `productVariantView.ts`, `ProductStickyStage.tsx` | PDP: `officialShadow` po hero slici + 3 atributa na stage-u; `resolveStageFormat` i dalje čita legacy `aspect` |
| `components/product/ProductDetailExperience.module.css` | V6B blok za `.heroProductImage` (+27) |
| `app/katalog/page.tsx`, `app/katalog/strana/[page]/page.tsx` | `withProductFitModel(...)` |
| `components/product/productFitModelV6.test.mjs` (novo) | 17 testova |
| `components/product/productSubjectMetricsGenerator.test.mjs` (novo) | 8 testova (izvršava stvarni Python `measure_subject` na sintetičkoj alfi) |
| `components/product/productImageLoadState.mjs` (novo, 78 linija) | `watchProductImageLoad` |
| `components/product/productImageLoadState.test.mjs` (novo) | 15 testova |
| `docs/PAGE_LOCK_STATUS.md` | +13/−0: podsekcija „Reopen 2026-09-21 — ograničen, samo hero slika proizvoda (V6A + V6B)" na kraju PDP sekcije PASS 01, kao **zaseban hunk**; korisnikov hunk netaknut |

NIJE dirano: `package.json` (SHA256 `e495abd8…`, isti kao u pre-flightu), `lib/carsystem-data.ts` (isti zatečeni diff od 42 linije), nijedan fajl pod `public/`, nijedna `productImage` referenca. Nema `public/products/carsystem/enhanced/`.

Rollback: (a) bez gita — `SUBJECT_FIT_PREFIXES = ()` + `npm run images:metrics` vraća oba generisana fajla i V6 atributi nestaju; (b) potpuno — vratiti izmijenjene izvorne fajlove, obrisati nove, regenerisati. Pre-flight kopije fajlova koje je korisnik već imao izmijenjene: `…/scratchpad/v6-impl/pre/`; stanje prije dopune učitavanja: `…/scratchpad/v6-loading/pre/`.

## 6. Sve testirane varijante i rezultati

### 6.1 Audit (read-only) — brojevi, samo `brandSlug=carsystem`
| | |
|---|---|
| Carsystem product records / kartice | 465 |
| kartice sa primary slikom | 463 (2 placeholdera) |
| unique primary asseta (po putanji) | 463 |
| PDP gallery reference / unique | 306 / 292 (nijedna nije i primary) |
| unique runtime asseta (putanja = SHA256) | 755 (754 bez zajedničkog placeholder SVG-a) |
| orphaned Carsystem fajlovi na disku | 4 |
| „890" | broj source-side image zapisa na carsystem.org, NE runtime asseta |

Klasifikacija 463 primary: **A_OK_NO_CHANGE 388 · B_DETERMINISTIC_FIX 40 · C_AI_ASSISTED_SAFE 0** (svi C su poslije provjere prebačeni u B) **· D_AI_HIGH_RISK 1** (`staub-stop-water-black`) **· E_SOURCE_REPLACEMENT_PREFERRED 9** (`x-stand-classic`, `x-stand-top`, `mmir-trolley-box`, `git-elastic-weiss`, `f19-brusni-diskovi`, `f23-brusni-diskovi`, `finish-serija`, `p19-brusni-diskovi`, `zastitno-odelo`) **· F_SPECIAL_MARKETING_IMAGE 25**.
Tip problema: SOURCE 57 · CSS 46 · BOTH 18 · NONE 342. `pipelineToneStatus`: confirmed 15 · not_detected 1 · unknown 447.
B tretmani (grubo): čišćenje 18, maskirani 7, BORDER_FRAME_STRIP 6, korekcija 3, re-export 2, padding 2, ostalo 2.
Procjena asset-size delte iz audita: `UNCONFIRMED` (broj nije sačuvan u kontekstu).

### 6.2 Pilot (5 + kontrola, van repoa) — svi `pending_manual_review`, **odobreno za integraciju: 0**
| rezultat | medLum O / R / P | γ | ΔE u browseru (sada → pilot) | automatika | kategorija odbijanja (prijedlog) | preporuka |
|---|---|---|---|---|---|---|
| `anti-rust-putty` 149.612 | 167,9 / 101,3 / 167,4 | 1,0024 | 19,44 → 2,89 | REJECT T5, A8 | LOSSY_ENCODING_VARIANCE | APPROVE_PILOT |
| `glass-fibre-fleece` 125.421 | 199 / 146 / 199 | 1,0 | 19,51 → 0,67 | REJECT A1 (SSIM 0,9691) | LOSSY_ENCODING_VARIANCE | APPROVE_PILOT |
| `lhr75` **LANCZOS_660** 157.332 | 89,4 / 25,7 / 89,7 | 0,9992 | 18,24 → 1,74 | **PASS** | — | APPROVE_PILOT |
| `lhr75` NATIVE_560 | 89,8 / 25,7 / 89,8 | 1,0 | 18,22 → 1,31 | REJECT A6 | LOSSY_ENCODING_VARIANCE | REJECT (samo poređenje) |
| `can-scraper` 159.672 | 10,0 / 1,0 / 9,6 | 1,0015 | 5,87 → 1,2 | REJECT T6 (0,685) | EXPECTED_SOURCE_RECOVERY (vraća utisnuti CARSYSTEM natpis koji u runtimeu ne postoji) | APPROVE_PILOT |
| `sanding-block-disc-kit-150` 151.904 (ICC Adobe RGB) | 83,2 / 22,4 / 82,9 | 1,0014 | 25,09 → 2,02 | REJECT A8 (2,02 vs 2,0) | LOSSY_ENCODING_VARIANCE | APPROVE_PILOT |
| `socks-carsystem-black-white` (KONTROLA) | 199 / 198 / 198 | 1,0 | 2,37 → 2,03 | REJECT A1, A8; kontrolno A7 PROŠLO | LOSSY_ENCODING_VARIANCE | KEEP_CURRENT — nikad se ne integriše |

Nijedno odbijanje nije svrstano u `REAL_VISUAL_RISK` (prijedlog, čeka ljudsku potvrdu). Pragovi NISU mijenjani. Moj komentar: R10/A6, T5 i A8-po-pikselu su prestrogi za lossy encoder, ali ih nisam prepravljao.
LHR75: korisnik je izabrao **LANCZOS_660** (nema vidljive razlike prema 560, bolje pokriva PDP i 2× DPR, konzistentno sa katalogom, ringing mjerljiv ali nevidljiv).
Neutralnost harnessa: trenutni fajl kroz emulaciju vs. pravi optimizer ΔE 0,086.
Usputni nalaz: pilot je vjeran originalu, pa je svijetli oreol zvanične sjenke u tamnoj temi 26–83 % svjetliji nego danas (tamni derivat ga je slučajno prigušivao) → pokrenuo rendering prototip.

### 6.3 Rendering prototip V0–V6 (Playwright style injection, repo nediran)
14 uzoraka × kartica/PDP × light/dark × V0–V6 = 392 rendera + 15 sweep.
| | šta | ishod |
|---|---|---|
| V0 | trenutni UI | 3 sloja sjenke, svijetle CSS sjenke u dark, odvojena `.contactShadow` |
| V1 | bez `.contactShadow` | djelimično |
| V2 | bez CSS `drop-shadow` | djelimično |
| V3 | bez oba | regresija u light: 10/14 bez uzemljenja — `REJECTED` |
| V4 | V3 + fit po jezgru (`alpha ≥ 250`) | vraća proizvode na tačno 66,0 % površine (anti-rust 52,2→66,0); ista light regresija — `REJECTED` kao cjelina; kasnije zamijenjen hibridnim boxom |
| V5 | V4 + neutralni well `rgb(160,162,166)` u dark | gasi oreol za tipične limenke, ali je svijetli pravougaonik — `REJECTED` |
| V6 | V4 + „tačno jedna sjenka" + radijalni pool | light regresija nije detektovana (0/14 bez uzemljenja); oreol samo smanjen (+14..+22 → +4,7..+14,9) → **prihvaćen kao strukturni pravac, razdvojen na V6A / V6B / V6C** |
Odbačena alternativa: SVG filter sa strmom alfa rampom — `REJECTED` (siječe poluprovidne dijelove proizvoda, filter na ~48 slika po ekranu).

### 6.4 Pred-implementaciona validacija V6 (svih 463)
- V6A: Δscale medijana 0,00 %; p99/max +16,2 % / **+32,1 %** (kartica); negativan 0; Δscale > 10 %: 13 (kartica) / 17 (PDP); pomjeraj centra > 3 %: 15; **subjekt odsječen: 0**; < 8 px od ivice: 1 (`h2o-cleaner` 7,1 px). 365/463 se praktično ne mijenja. Najveća povećanja: `multi-flow` +32 %, `glas` +28 %, `anti-rust-putty` +26 %, `lhr75` +23 %, `coffee-cup-black` +17 % — sve ispravke.
- Translucent-subject regresija sa hibridnim boxom: **0**.
- V6B detektor, ground truth 64 asseta (STRONG 22 / THIN 11 / NONE 31): stari (udio meke alfe ≥ 2 %) precision 0,870 / recall 0,909; **novi geometrijski 1,000 / 1,000**. Ograničenje: pragovi in-sample, oznake od jednog recenzenta (AI); hold-out 41 graničnih: 40 se slaže, 1 granični (`glass-fibre-reinforced-putty` → `unknown`). Štetna zamjena NONE↔STRONG ima velik razmak.
- Cijeli katalog (implementirano): none 341 · strong 74 · thin 46 · unknown 1 · legacy 1.

### 6.5 Implementacioni QA (Chromium)
192 zapisa (38 proizvoda × kartica/PDP × light/dark desktop + 10 proizvoda mobile 390×844), **0 problema**. „CURRENT" = isti element sa skinuta 3 V6 atributa; provjereno prema stvarnim pre-change snimcima: 32 para, srednja razlika 0,0. Sidrenje: gornja ivica sjenke 3,5–5,1 px iznad dna subjekta (zatečeno: −18 do +67 px). PDP `data-stage-format` isti prije i poslije. Drugi brendovi: 0 V6 atributa.

### 6.6 Završni QA
- **488 vs 463**: 462 primary sa alfom + 24 PDP gallery sa alfom + 2 ostala fajla na disku (`carsystem-git-multi-green.webp`, `putty-smear-fine-material-v2.png`) = 488. Duplicate path 0. Ne-Carsystem stavki sa V6 poljem: 0. 270 Carsystem stavki bez V6 polja = 154 canvas + 115 opaque-border + 1 alfa fallback (`putty-smear-fine-shadow.png`).
- **CSS veličina**: +44,3 KB raw = **+3,7 KB gzip / +2,1 KB brotli**, 13 ruta; početna `/` 0. 96 % je generisana per-asset geometrija. 11 ručnih pravila. 1 mrtvo pravilo, 4 uspavana (izuzeti slugovi). Alternative (grupisanje −1 % gzip; samo promijenjena svojstva −0,4 KB; inline style +16 KB RSC) — ne preporučene.
- **Cross-browser** (Chromium 149, WebKit 26.5, Firefox 151): 52/52 zapisa po engineu, 0 problema; svi `CSS.supports` true (`oklch`, `color-mix`, `container-type: size`, `cq*`, `min/max/calc` sa cq, dijeljenje dužine brojem, `drop-shadow` sa oklch, `blur`); geometrija između enginea ≤ 0,006 % širine, 0,043 % centra, 0,11 px sjenke. Rendering **nije piksel-identičan**: srednja razlika prema Chromiumu 3,6 (WebKit) / 3,9 (Firefox), max 8,4 / 10,9 (`anti-rust-putty`, kartica, dark) — razlika je u resamplingu same slike i postoji i u zatečenom renderu (6,4 / 7,4).
- **Responsive/interakcija** (390×844, 768×1024, 1440×900): hover podiže proizvod ≈1,7 px, sjenka ostaje na tlu (razmak −3,6 → −1,9 px, i dalje ispod proizvoda); `z-index` sjenke 2 < proizvoda 3; `pointer-events: none`; klik na sjenku vodi na PDP (5/5); nema horizontalnog overflowa; focus-visible isto kao hover; touch `(hover:none)` true; reduced-motion 0,0 px.
- **Rollout scope** `LIMITED_INITIAL_ROLLOUT` (vidi 7.3).

### 6.7 QA dopune učitavanja (Chromium 149; 390×844 i 1440×900; light i dark; mjereno po frejmu)
| scenario | rezultat |
|---|---|
| loading → loaded (slika zadržana 3,5 s), `none`/`thin`/`strong` | **0 usamljenih frejmova u 12/12** |
| isti harness sa emulacijom stanja PRIJE dopune | usamljena sjenka u 8/8 (dokaz da harness vidi problem) |
| legacy kontrole (`multi-flow`, R-M `2210-onyx-activator`) | bez atributa, ponašanje isto kao prije (8/8) |
| cache, **produkcijski build** (`build:check` → `.next-verify`, `start:check` port 3220), drugi dolazak | 46/52 zahtjeva iz HTTP cachea (11/11, 11/11, 10/15, 14/15); sve spremne slike `loaded`; 0 usamljenih frejmova; sjenka najviše **54 ms POSLIJE** slike |
| učitano prije hidracije (dev) | 12–19 slika po stranici, sve `loaded` |
| kartica montirana drugi put | novi `<img>` se prvi put vidi već sa sjenkom (8/8) |
| failed: abort i HTTP 404 × poslije montiranja i prije hidracije | **16/16**: `failed`, sjenka nijednom nacrtana |
| hover/focus/touch/reduced-motion prema završnom QA | 73 mirna stanja: max razlika **0,010 px**, 0 razlika u stilu |

### 6.8 Posljednji gate (poslije dopune)
`test:product-motion` **169/169** (154 + 15 novih) · `test:catalog` 30/30 · `test:family-presentation` 9/9 · `test:variant-experience` 5/5 · `test:optical` 5/5 · `images:metrics:check` ok (1843 slike, isti SHA256) · `typecheck` 0 · `lint` 0 · `npm run build` 0 · `git diff --check` 0. (`catalog:validate` uz živ server: exit 0 u završnom QA; nije ponavljan poslije dopune učitavanja.)

## 7. Posebni slučajevi i exclusions

### 7.1 Izuzeti od V6 (`V6_FIT_EXCLUDED_SLUGS`) — odluka korisnika, privremeno
| slug | razlog |
|---|---|
| `carsystem-multi-flow` | rep zvanične sjenke bi prešao ivicu kartice (−22,8 px kartica, −27,8 px PDP; α ≤ 43) |
| `carsystem-paint-system-cps-3-0` | kraj refleksije prelazi ivicu kartice za 2,9 px (α 10, nevidljivo) |
| `carsystem-h2o-cleaner` | subjekt 7,1 px od ivice PDP stage-a (prag 8 px) |
Za njih ostaje zatečeno ponašanje u cjelini (i fit i sjenke). Metrika im je ispravna (`strong`), zato postoje 4 uspavana CSS pravila. Vraćaju se brisanjem sluga sa liste.

### 7.2 463 vs 459 na `/katalog`
465 proizvoda − 2 placeholdera (`carsystem-soft-plus-git`, `carsystem-p23-brusni-diskovi`) = 463 kartice sa slikom → **459 V6 + 4 legacy**: tri izuzeta iznad + `carsystem-glass-fibre-fleece` (RGB 660×660 **bez alfa kanala**, `boxSource: opaque-border` → subjekt se ne može izmjeriti).

### 7.3 Opseg prvog izdanja — `LIMITED_INITIAL_ROLLOUT`
V6 radi: `/katalog`, `/katalog/strana/[n]`, PDP hero.
Legacy ostaje: PDP „slični proizvodi", PDP thumbnailovi (`<button data-product-fit>`), `/kategorije/[slug]` (danas 0 Carsystem proizvoda u 4 SEO kategorije), `/proizvodi/grupa/[slug]` (Carsystem nema porodica), `/brendovi/carsystem` (ne koristi fit površine), svi drugi brendovi.
Identitet: 0 neslaganja putanje slike između površina; razlikuje se samo rendering. Jedino mjesto gdje kupac danas vidi isti proizvod u dva renderinga: „slični proizvodi" (legacy) naspram `/katalog` (V6).

### 7.4 Ostali posebni slučajevi
- `carsystem-glass-fibre-reinforced-putty` → **mora ostati `unknown`** (override u generatoru; granični slučaj detektora).
- `carsystem-rupes-polishing-machine-lhr75` (trenutni runtime) → klasifikovan `thin` jer rubni okvir pada ispod proizvoda; **blijedi okvir je i dalje vidljiv u tamnoj temi** (asset problem; pilot LANCZOS_660 ga rješava ali nije integrisan).
- `glas` → zvanična sjenka je svijetla pravougaona ploča, vidi se u tamnoj temi u svim opcijama (svojstvo asseta).
- `putty-smear-fine-shadow.png` → nema neprovidno jezgro → fallback; `putty-smear-fine-material-v2.png` → jedino **mrtvo** V6 pravilo (dekorativni trag).
- `socks-carsystem-black-white` → samo kontrola, **nikad se ne integriše**.
- `af-21-1k-filler` → ne može biti kontrola ni tretirani pilot (nema izmjeren original; korisnik: „AF 21… se ne računa kao jedan od pet").
- `polyester-repair-set` → ispao iz pilota (original 20,8 MB nije mjeren). `proflex-mercury` → ispao; cijeli kadar mu je alfa 229 i u originalu — da li se ispravlja na 255 je zasebna, **nedonesena** odluka.
- BORDER_FRAME asseti koji NE smiju u automatsku obradu: `rupes-orbital-sander-slp41a`, `rupes-skorpio-e-rx`.
- Klasa D (`staub-stop-water-black`) i klasa F (25) → bez automatske obrade.

## 8. Otvoreni problemi i nedovršene stvari

1. **Commit nije odobren.** Sav V6 rad + dopuna učitavanja su nekomitovani.
2. **Pilot asseti**: 0 odobreno. Čeka ljudski vizuelni pregled (`carsystem-image-pilot-manual-review.zip`) i potvrdu kategorija odbijanja. Tek poslije toga se smije razgovarati o pragovima.
3. **Svijetli oreol zvanične sjenke u tamnoj temi** i dalje postoji — svojstvo asseta; rješenje traži V6C ili prihvatanje. Odluka nije donesena.
4. **LHR75 okvir** u tamnoj temi i dalje vidljiv (asset nije zamijenjen).
5. Tri izuzeta sluga čekaju ljudsku odluku.
6. Ground-truth oznake detektora sjenke čekaju ljudsku potvrdu; politika za THIN je odluka, ne mjerenje.
7. Rollout na ostale površine (slični proizvodi, thumbnailovi, kategorije, grupe) — `PLANNED_NOT_IMPLEMENTED`. Napomena: gdje god se sjenka crta kao poseban element, treba isti gate na učitanu sliku.
8. Predložene, NEURAĐENE sitnice: suziti allowlistu na `/products/carsystem/catalog/` + 6 legacy PNG-ova (uklanja 1 mrtvo pravilo); podići `--product-envelope-*` sa `.objectWrap` na `.surface` (≈0,3 KB, ali dira legacy selektore — nije bezrizično).
9. 447 asseta ima `pipelineToneStatus: unknown`; sistemski re-export cijelog kataloga nije ni planiran ni odobren.
10. Klasa E (9 asseta): tražiti bolji zvanični packshot — `PLANNED_NOT_IMPLEMENTED`.
11. Provenance fajl i `original/` + `enhanced/` struktura — `PLANNED_NOT_IMPLEMENTED`.
12. Bez JavaScripta V6 kartica nema CSS sjenku — prihvaćena granica, ali korisnik je nije izričito potvrdio: `UNCONFIRMED` kao odluka.
13. Alt tekst slomljene slike prelazi preko oznake brenda — zatečeno ponašanje, nije dirano.
14. Dopuna učitavanja je mjerena samo u Chromiumu; WebKit/Firefox nisu ponovljeni za to — `UNCONFIRMED` za te engine.
15. Okruženje: macOS evakuiše fajlove repoa kao **dataless** (repo je pod `~/Desktop`); generator, `git status` i dev server tada vise na 0 % CPU. Zaobilaženje: pročitati fajlove (`perl -e 'alarm 20; exec @ARGV' cat "$f" > /dev/null`). Sistemska podešavanja nisu dirana.
16. Nuspojava: `playwright install webkit firefox` je sam obrisao keširane `chromium-1223` i `chromium_headless_shell-1223`; instalirao `webkit-2311` i `firefox-1532` u `~/Library/Caches/ms-playwright`.
17. Nastao `.next-verify` (gitignored) zbog cache mjerenja.

## 9. Tačno trenutno stanje repozitorijuma / worktree-a

- Worktree: `/Users/miledulic/Desktop/Projects/carsystem`, branch `chore/repo-cleanup-2026-09`, HEAD `7d6b8df` („fix(product): enable in-place row variant selection"), u ravni sa `origin`.
- Nema commita, pusha ni stasha iz ovog rada. Postoji 1 stash iz 2026-08-07 („epitaxy: pre-switch from review/product-page-system") — zatečen.
- Drugi worktree-ovi postoje (`carsystem-rm` na `main` 113b8ce, `carsystem-sata`, `carsystem-sata2`, `carsystem-baslac`, `carsystem-cosmos`, `carsystem-norbin`, `carsystem-autofit`, `carsystem-faza-1b`, `carsystem-windows-final`) — **nisu dio ovog rada**.

`git status --short` (trenutno). **[K]** = korisnikova izmjena zatečena prije sesije; **[V6]** = ovaj rad; **[K+V6]** = oboje u istom fajlu:
```
 M app/katalog/page.tsx                                       [V6]
 M app/katalog/strana/[page]/page.tsx                         [V6]
 M components/catalog/CatalogExplorer.tsx                     [K]
 M components/catalog/CatalogPage.module.css                  [K]
 M components/catalog/CatalogProductGrid.tsx                  [K]
 M components/catalog/catalogInfiniteScroll.test.mjs          [K]
 M components/home/BrandLogoPlate.tsx                         [K]
 M components/home/CarsystemHomePage.module.css               [K]
 M components/home/CarsystemHomePage.tsx                      [K]
 M components/home/HomeCampaignCarousel.module.css            [K]
 M components/home/HomeCampaignCarousel.tsx                   [K]
 M components/home/homeCampaign.test.mjs                      [K]
 M components/layout/Header.module.css                        [K]
 M components/layout/Header.tsx                               [K]
 M components/product/ProductDetailExperience.module.css      [V6]
 M components/product/ProductImageFit.generated.module.css    [K+V6]
 M components/product/ProductStickyStage.tsx                  [V6]
 M components/product/ProductVisualSurface.module.css         [K+V6]
 M components/product/ProductVisualSurface.tsx                [K+V6]
 M components/product/productStageImages.ts                   [V6]
 M components/product/productVariantView.ts                   [V6]
 M components/product/productVisualPresentation.ts            [V6]
 M data/product-image-metrics.generated.json                  [K+V6]
 M docs/PAGE_LOCK_STATUS.md                                   [K+V6]
 M docs/PRODUCT_SEARCH.md                                     [K]
 M lib/baslac-systems.ts                                      [K]
 M lib/carsystem-data.ts                                      [K]
 M lib/product-image-metrics.ts                               [V6]
 M package.json                                               [K]
 M scripts/extract-product-image-metrics.py                   [V6]
 M scripts/qa-product-search.mjs                              [K]
 M scripts/validate-catalog-search-index.mjs                  [K]
?? components/catalog/catalogCardReveal.test.mjs              [K]
?? components/product/productFitModelV6.test.mjs              [V6]
?? components/product/productImageLoadState.mjs               [V6]
?? components/product/productImageLoadState.test.mjs          [V6]
?? components/product/productSubjectMetricsGenerator.test.mjs [V6]
?? lib/product-fit-model.ts                                   [V6]
?? lib/productFitModel.mjs                                    [V6]
?? public/brands/mono/                                        [K]
?? public/products/carfit/carfit-maskirna-folija-4x5m.webp    [K]
?? public/products/carsystem/carsystem-git-multi-green.webp   [K]
?? public/products/norbin/norbin-n15-020-1l.webp              [K]
?? public/products/rm/rm-body-filler-white-b-2e11.webp        [K]
?? public/products/rm/rm-diamont-bazna-boja.webp              [K]
?? public/products/rm/rm-pasta-190-1l.webp                    [K]
?? public/products/rm/rm-pasta-190-5l.webp                    [K]
?? scripts/qa/print-search-model.mts                          [K]
```
Napomena: `scripts/qa/print-search-model.mts` se pojavio tokom sesije, ali ga ovaj rad nije napravio — tretirati kao korisnikov.

**Važno za commit:** u 5 fajlova [K+V6] korisnikove i V6 izmjene su u istom fajlu. Za tri ručno pisana (`ProductVisualSurface.tsx`, `.module.css`, `PAGE_LOCK_STATUS.md`) dokazano je da obrnuta primjena V6 patcha vraća korisnikovu verziju bajt-za-bajt. Dva generisana se izoluju regeneracijom. Tačni diffovi samo V6 dijela: `FINAL-SOURCE.diff`, `FINAL-GENERATED.diff`, `PAGE_LOCK_STATUS.v6.patch` (u `carsystem-v6-final-review.zip`) + `ADDITIONAL.diff` (u `carsystem-v6-loading-fix-review.zip`).

Isporučeni ZIP paketi (svi van repoa, u scratchpadu): `carsystem-image-audit-review.zip` (5,1 MB) · `carsystem-image-pilot-review.zip` (41 MB) · `carsystem-image-pilot-manual-review.zip` (11,7 MB) · `carsystem-rendering-prototype-review.zip` (7,4 MB) · `carsystem-v6-preimplementation-review.zip` (6,6 MB) · `carsystem-v6-implementation-review.zip` (4,4 MB) · `carsystem-v6-final-review.zip` (3,2 MB) · `carsystem-v6-loading-fix-review.zip` (0,5 MB). Sirovi QA snimci (97 MB) su u `…/scratchpad/v6-impl/qa/shots/`.

## 10. Lista fajlova i komponenti koje su mijenjane

Izmijenjeni (V6): `scripts/extract-product-image-metrics.py` · `data/product-image-metrics.generated.json` · `components/product/ProductImageFit.generated.module.css` · `lib/product-image-metrics.ts` · `components/product/productVisualPresentation.ts` · `components/product/ProductVisualSurface.tsx` · `components/product/ProductVisualSurface.module.css` · `components/product/productStageImages.ts` · `components/product/productVariantView.ts` · `components/product/ProductStickyStage.tsx` · `components/product/ProductDetailExperience.module.css` · `app/katalog/page.tsx` · `app/katalog/strana/[page]/page.tsx` · `docs/PAGE_LOCK_STATUS.md`

Novi (V6): `lib/productFitModel.mjs` · `lib/product-fit-model.ts` · `components/product/productFitModelV6.test.mjs` · `components/product/productSubjectMetricsGenerator.test.mjs` · `components/product/productImageLoadState.mjs` · `components/product/productImageLoadState.test.mjs`

Komponente: `ProductVisualSurface` (kartica), `ProductStickyStage` / `ProductDetailExperience` (PDP hero), katalog stranice (server: `withProductFitModel`).
Novi testovi rade pod `npm run test:product-motion` (`node --test components/product/*.test.mjs components/motion/*.test.mjs`).

## 11. Lista odluka koje su FINALNE i ne treba ih ponovo preispitivati

1. Identitet proizvoda je zaključan (lista iz 3.1); svaka promjena = `REJECTED`.
2. Original se nikad ne prepisuje / ne briše / ne preimenuje.
3. Nema globalnog brightness/gamma/exposure pravila; tamne slike se rješavaju re-exportom iz zvaničnog originala.
4. `alpha < 100 → 0` je odbačen; za rubni okvir važi BORDER_FRAME_STRIP sa R1–R10.
5. ICC → sRGB konverzija kad profil postoji; bez pretpostavljenog profila kad ga nema.
6. Nikad upscale preko nativne rezolucije osim odobrenog LHR75 slučaja; **LHR75 kandidat = LANCZOS_660**, NATIVE_560 samo dokaz.
7. `socks` je kontrola i nikad se ne integriše. AF-21 nije tretirani pilot.
8. Pragovi validacije se ne mijenjaju poslije rezultata; odbijanja se kategorišu (EXPECTED_SOURCE_RECOVERY / LOSSY_ENCODING_VARIANCE / REAL_VISUAL_RISK).
9. `pipelineToneStatus` se postavlja samo iz izmjerenog para; bez ekstrapolacije.
10. Luminanca proizvoda nije signal ni za „pretamno" ni za detekciju sjenke; detektor sjenke je geometrijski.
11. V6 se tretira kao tri odvojene komponente: **V6A i V6B odobreni i implementirani; V6C NIJE odobren**.
12. V6A koristi **hibridni subject box**, ne čisti `alpha ≥ 250`.
13. Postojeća polja manifesta (`box`, `aspect`, `fx/fy/ox/oy`, `tone`, `palette`) i PDP stage format se ne mijenjaju; novo ide u nova polja.
14. V6 je Carsystem-only; aktivacija = brend + nije izuzet + metrika postoji + sanity; inače legacy fallback.
15. Tri izuzeta sluga ostaju legacy dok korisnik ne odluči drugačije.
16. `glass-fibre-reinforced-putty` ostaje `unknown`.
17. Model sjenke: strong 0 / none 1 / thin+unknown 1 slabija; nikad contactShadow i drop-shadow zajedno; CSS sjenka tamna u obje teme, bez `--foreground`, usidrena pod subjekt, ne dira asset.
18. Zabranjene rendering tehnike iz 3.10.
19. PDP DESIGN + UX LOCK je otključan **isključivo** za subjectBox fit, shadow model i sprečavanje višestrukih sjenki. Ništa drugo na PDP-u.
20. V6 sjenka na kartici se crta tek kad je slika učitana i dekodirana; failed = bez sjenke; legacy kartice i drugi brendovi netaknuti.
21. Opseg je `LIMITED_INITIAL_ROLLOUT`; ne širiti bez odobrenja.
22. Bez mass apply; bez `public/products/carsystem/enhanced/`; bez izmjene `productImage` referenci dok `approvalStatus !== approved`.
23. Korisnikove nekomitovane izmjene se ne diraju, ne stashuju, ne prepisuju.
24. Dokazi i međurezultati žive van repozitorijuma.

## 12. Lista stvari koje još treba uraditi

1. **Odluka korisnika o commitu** V6A + V6B + dopune učitavanja. Predloženi redoslijed zasebnih commitova (iz plana): generator + nova polja → V6A → V6B (+ dopuna učitavanja). Paziti da se u commit ne uvuku korisnikove [K] izmjene iz 5 miješanih fajlova.
2. Ljudski pregled pilot paketa i odluka po kandidatu (APPROVE_PILOT / REVISE / REJECT); tek onda struktura `original/` + `enhanced/`, provenance fajl i izmjena runtime referenci.
3. Odluka o tamnoj temi (V6C: bez poola / slab pool / well / prihvatiti oreol).
4. Odluka o tri izuzeta sluga.
5. Kasniji rollout, svaki korak zaseban commit sa istim QA obrascem: (1) PDP „slični proizvodi" (odluka na serveru, `withProductFitModel` obrazac); (2) PDP thumbnailovi (samo fit atribut); (3) `/kategorije` i `/proizvodi/grupa`; (4) izuzeti slugovi; (5) drugi brendovi tek poslije vlastitog audita.
6. Opciono: suziti allowlistu generatora (1 mrtvo pravilo).
7. Opciono: ponoviti QA dopune učitavanja u WebKit-u i Firefoxu.
8. Klasa E: nabaviti bolje zvanične packshotove. Klasa B (40): deterministički tretmani po TOP30 redoslijedu — sve tek poslije odobrenja pilota.
9. Ljudska potvrda ground-truth oznaka sjenke.

## 13. Chronological log

**2026-09-20 08:24 — Poruka 1 (zahtjev za audit).** 15 tačaka: read-only audit, SOURCE vs CSS problem, klase A–F, score samo za sortiranje, zaključan identitet, original se ne prepisuje, provenance, vizuelni standard, tamne slike bez globalnog pravila, multi-product, pilot od 5, automatska validacija, bez mass apply, „STOP prije bilo kakve stvarne obrade".
→ Urađen inventar kroz stvarni runtime (`loadCatalogRuntime()`), piksel-metrike (Pillow + NumPy, bez OCR-a), mjerenje u stvarnom runtimeu (Playwright na dev serveru; produkcija preusmjerava na `/site-u-pripremi`). Prvi nalazi: gubitak tona u derivatu, inflacija content boxa zbog sjenke, svijetle CSS sjenke u tamnoj temi, „veo" na lhr75 (kasnije ispravljeno).

**09:10 — Poruka 2 (audit nije odobren; kompletiraj dokaze).** Traženi stvarni fajlovi sa putanjama, usklađivanje 465/463/463/292/755/890, kompletan TOP30, dokaz za 70 kartica sa ≥ 8 runtime screenshotova, opravdanje svake C klase, info o zvaničnim high-res originalima (privremeni download samo van repoa, bez bulk-a), revizija pilota (AF-21 ne može biti tretirani kandidat).
→ Brojevi usklađeni (tabela u 6.1); svi C prebačeni u B (C = 0); 16 originala preuzeto i izmjereno; potvrđen γ ≈ 2,2.

**10:04 — Poruka 3 (audit spreman za manual review; pilot nije odobren).** ZIP `carsystem-image-audit-review.zip`; **`alpha < 100 → 0` nije odobren** → traži se bezbjedniji metod; uvesti `pipelineToneStatus` bez ekstrapolacije; izmjeriti anti-rust-putty ili ga zamijeniti.
→ Ispravljen opis: nije veo nego 1 px okvir; napisan BORDER_FRAME_STRIP sa R1–R10 (samo dokument + simulacija u memoriji); ICC hipoteza povučena; `pipelineToneStatus` 15/1/447; anti-rust izmjeren (−39,5 %, γ 2,14); kontrola promijenjena na `socks`.

**20:31 — Poruka 4 (audit odobren; izolovani pilot 5 + kontrola).** LHR75 u dvije varijante bez biranja pobjednika; pravila color managementa; T1–T8 + dodatni auto-rejecti; ZIP `carsystem-image-pilot-review.zip`; `pending_manual_review`.
→ Pilot urađen van repoa; prikaz u stvarnom runtimeu kroz Playwright presretanje `/_next/image` sa emulacijom Next sharp lanca (ΔE neutralnosti 0,086). Automatski prolazi 1 od 7 rezultata; dijagnoza svakog odbijanja; pragovi nepromijenjeni. Usput potvrđeno da je okvir vidljiv u tamnoj temi.

**21:08 — Poruka 5 (pilot prihvaćen za manual review; 0 odobreno).** Odluka: LHR75 = LANCZOS_660. Kategorisati svaki REJECT; ne mijenjati pragove; mali ZIP sa tačno 10 fajlova; bez nove obrade; socks se nikad ne integriše.
→ `carsystem-image-pilot-manual-review.zip`. Novi nalaz: zvanična sjenka je svijetla i u tamnoj temi je oreol; pilot ga čini 26–83 % svjetlijim jer je vjeran originalu.

**21:23 — Poruka 6 (read-only rendering prototip).** V0–V5 (+V6), lista zabranjenih tehnika, mjerenja, ZIP `carsystem-rendering-prototype-review.zip`, „Ne implementiraj pobjedničku varijantu".
→ 407 mjerenja. Potvrđeni CSS problemi kartice (svijetle sjenke u dark, odvojena contactShadow, 3 sloja). V4 vraća proizvode na 66,0 %. Oreol nerješiv bez svijetle površine (sweep 19→200). Preporuka: V6 bez poola.

**21:46 — Poruka 7 (V6 prihvaćen kao pravac; ostati read-only).** Razdvojiti V6A/V6B/V6C; full-catalog simulacija; ground truth ≥ 60; „Podesi metod, ne prag naslijepo"; outlier listovi; tri dark-pool pregleda; implementacioni plan bez izvršenja.
→ Dokazano da čisti `alpha ≥ 250` griješi na 38 asseta → **hibridni subject box**. Geometrijski detektor 1,000/1,000 na 64 (uz iskreno navedena ograničenja). Moja ranija tvrdnja da lhr75 pilot i sanding-block imaju „malu official sjenku" ispravljena (oba NONE). Identifikovani `multi-flow`, `paint-system-cps-3-0`, `h2o-cleaner`.

**22:35 — Poruka 8 (odobrena kontrolisana implementacija V6A + V6B).** V6C ne; pilot asseti ne; PDP lock otključan samo za tri stvari; pre-flight; nova polja; lista izuzetaka; model strong/thin/none/unknown; `glass-fibre-reinforced-putty` = unknown; 13 testova; browser QA lista; gate; „STOP prije commita".
→ Pre-flight zabilježen (`v6-impl/PREFLIGHT.txt`), kopije zatečeno izmijenjenih fajlova. Implementirano sve iz 5. Greške usput: spor union-find → vektorizovan; viseća čitanja → otkriven macOS dataless problem; 262 CSS pravila → uveden `SUBJECT_RULE_MIN_DELTA` → 140; zaokruživanje Python vs JS → tolerancija 1e-4. QA 192 zapisa, 0 problema.

**2026-09-21 01:31 — Poruka 9.** Korisnik: limit potrošen, nastavi. → Nastavljeno.

**07:39 — Poruka 10 (završni QA prije odluke o commitu).** 8 tačaka: 488 vs 463; veličina CSS-a; cross-browser; responsive + interakcija; rollout scope; PAGE_LOCK patch; diff integritet; gate + mali ZIP.
→ Korisnik je preko upita odobrio preuzimanje Playwright WebKit + Firefox. Sve tačke zatvorene (6.6). Tri greške mog harnessa ispravljene (koordinate prije `Tab` skrola; atributi skinuti prerano; snimci bez slike zbog dataless servera). Otvoren nalaz: **usamljena sjenka tokom učitavanja slike**. „Ready to commit: YES — uz odluku o sjenci."

**12:42 — „Try again".** → Provjera stanja repoa, isporuka `carsystem-v6-final-review.zip`, statusni blok.

**13:58 — Poruka 11 (završni QA prihvaćen; popravi sjenku tokom učitavanja).** Sjenka tek kad je slika učitana; cache i greška; bez bljeska; legacy netaknut; loading/cached/failed × light/dark × mobile/desktop; hover i reduced-motion isti; objasniti 463 vs 459; before/after + tačan dodatni diff; ne commitovati.
→ Napisan `productImageLoadState.mjs` + gate. Tokom QA otkriveno da katalog poslije pretrage zamijeni instancu kartice (~250 ms, zatečeno) pa je prva verzija gasila sjenku na 1 frejm → dodato pamćenje dekodiranih `currentSrc` + `useLayoutEffect`. Typecheck je uhvatio odvojen JSDoc → ispravljeno. Cache izmjeren na produkcijskom buildu (dev šalje `max-age=0`). Svi rezultati u 6.7/6.8. Isporučen `carsystem-v6-loading-fix-review.zip` + `LOADING-before-after.png`. STOP bez commita.

**17:25 — Poruka 12.** Zahtjev za ovaj handoff dokument.

---

# HANDOFF FOR NEXT CHAT

**Gdje smo stali.** Rendering tok je tehnički završen i čeka samo korisnikovu odluku o commitu. Sav kod (V6A fit, V6B sjenka, gate sjenke na učitanu sliku, testovi, zapis u `docs/PAGE_LOCK_STATUS.md`) je u radnom stablu branch-a `chore/repo-cleanup-2026-09` na HEAD-u `7d6b8df`, **nekomitovan i nepushovan**. Posljednji gate je zelen (169/169 + ostali paketi, typecheck, lint, build, `git diff --check`). Asset tok je stao na „pilot spreman za ručni pregled": 6 rezultata van repoa, 0 odobreno.

**Šta je završeno (ne ponavljati).** Audit 463 primary asseta i A–F klasifikacija; mjerenje gubitka tona (γ ≈ 2,2 na carsystem.org derivatu); BORDER_FRAME_STRIP metod; pilot 5 + kontrola sa validacijom; prototip V0–V6; pred-implementaciona validacija na cijelom katalogu; implementacija V6A + V6B; Chromium/WebKit/Firefox + responsive/hover QA; analiza veličine CSS-a; rollout scope; dopuna učitavanja sa QA. Ne ponavljati ni jedan od ovih koraka osim ako korisnik izričito traži.

**Šta se NE smije.** Commit ili push bez izričitog odobrenja. Diranje korisnikovih [K] izmjena (ne stashovati, ne prepisivati). Kopiranje pilot slika u repo ili kreiranje `public/products/carsystem/enhanced/`. Izmjena `productImage` referenci, asseta, `box`/`aspect` polja ili PDP stage formata. Implementacija V6C (pool/well/gradient). Bilo šta na PDP-u van tri otključane stvari. Globalni brightness/gamma/contrast, `mix-blend-mode`, `opacity` nad slikom, izmjena alfe asseta, dark duplikati, AI obrada. Rekalibracija pragova poslije rezultata. Ekstrapolacija `pipelineToneStatus`. Širenje V6 na druge površine ili brendove. Izmišljanje pravnih tvrdnji o brendovima.

**Sljedeći logičan korak.** Pitati korisnika da li odobrava commit. Ako da: napraviti zasebne commitove (generator + generisani fajlovi → V6A/V6B kod i CSS → dopuna učitavanja → dokument), pri čemu se u 5 miješanih fajlova stage-uje **samo V6 dio** (npr. `git apply --cached` tačnih patch fajlova iz ZIP-ova, ili `git add -p`), pa provjeriti da `git diff --cached` odgovara `FINAL-SOURCE.diff` + `FINAL-GENERATED.diff` + `ADDITIONAL.diff` + `PAGE_LOCK_STATUS.v6.patch`. Poruke commita završiti linijom `Co-Authored-By` koju zadaje okruženje. Poslije toga, odvojeno: ljudski pregled pilot paketa → odluka o integraciji asseta; odluka o tamnoj temi (V6C); odluka o tri izuzeta sluga; rollout redom iz 12.5.

**Rizici koje treba izbjeći.**
- *Miješani fajlovi:* `git add <fajl>` na [K+V6] fajlu bi u commit uvukao i korisnikove nezavršene izmjene.
- *Generisani fajlovi:* regenerisati samo skriptom; provjera `npm run images:metrics:check`; očekivani SHA256 su u 5. Ne pokretati `brands:manifests` (poznato nebezbjedan generator u ovom repou).
- *Dataless fajlovi (macOS, repo pod `~/Desktop`):* prije dugih prolaza materijalizovati fajlove čitanjem; proces na 0 % CPU = čeka File Provider, ne bug u kodu.
- *Dev server:* pokretati kroz alat za preview, ne ručno; ne graditi `.next` dok dev server radi. Za pravi cache-hit koristiti `build:check` + `start:check` (port 3220); Playwright `page.route` gasi HTTP cache.
- *Mjerenje:* element sa `display: none` ima rect 0,0,0,0 — ne porediti mu geometriju; uzorci usred tranzicije (120/350 ms) imaju šum do ~0,5 px; koordinate uzimati poslije skrola.
- *next/image:* ne dodavati `onError` (radi `img.src = img.src`), ne vjerovati `onLoad` za slomljene slike; stanje se prati kroz `ref`.
- *Scratchpad je privremen:* ZIP-ovi i dokazi su pod `/private/tmp/…/scratchpad/`; ako su potrebni dugoročno, korisnik ih treba sačuvati.
- *Iskrenost nalaza:* rendering između browsera nije piksel-identičan (zatečeno), svijetli oreol u tamnoj temi i LHR75 okvir i dalje postoje — ne predstavljati ih kao riješene.

Full image-audit conversation handoff ready: YES
