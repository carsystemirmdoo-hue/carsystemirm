# Import lokacija iz BEX CSV-a

Trenutni režim je **preview import based on BEX delivery contacts**. Sajt je zaključan, pa se poslovni BEX kontakti prikazuju u internom preview-u pre završne komercijalne provere. Pre javnog otključavanja sajta preporučena je konačna provera naziva, adrese, tipa, telefona, radnog vremena i tačne pozicije svake lokacije.

## Granica privatnosti

- Ulazni fajl je `_incoming/Klijenti.csv`.
- Interni review je `data/internal/location-import-review.csv`.
- Agregirani izveštaj je `data/internal/location-import-summary.json`.
- Geocoding cache je `data/internal/geocoding-cache.json`.
- Svi navedeni interni fajlovi su u `.gitignore` i ne importuju se iz Next.js koda.
- Browser dobija samo `data/store-locations.json`, preko `data/store-locations.ts`.
- Javni dataset ne sadrži PIB, BEX kontakt ID, pravno/fizičko lice, interne napomene, geocoder confidence niti originalne CSV redove.

Postojećih devet ranije potvrđenih lokacija ostaje u `data/public-location-overrides.json` i zadržava svoje tipove. Taj fajl sadrži samo javna polja.

## Pravila preview importa

Za aktivan BEX red sa pozitivnom vrednošću `Pravno lice` import postavlja:

```text
review_status=preview_approved
verification_status=pending
is_public=true
type=partner
geocoding_approved=true
```

Javni naziv tipa je „Partnerska lokacija“. To nije tvrdnja da je objekat Carsystem poslovnica ili zvanična prodavnica.

Fizičko lice ostaje interno:

```text
review_status=manual_confirmation_required
is_public=false
```

Njegova adresa se ne šalje geocoderu i ne ulazi u javni dataset.

## Pokretanje

Novi BEX izvoz postaviti na `_incoming/Klijenti.csv`, zatim pokrenuti:

```bash
npm run locations:import
npm run locations:geocode
npm run locations:validate
```

`locations:import` analizira izvor, osvežava review uz očuvanje ručnih kolona, spaja samo očigledne duplikate i generiše trenutni javni dataset. `locations:geocode` radi jednokratno mrežno geokodiranje još neobrađenih poslovnih primarnih redova, čuva cache i ponovo generiše javni dataset.

## Duplikati

Automatsko spajanje je dozvoljeno samo kada redovi imaju istu normalizovanu adresu i visoko pouzdano podudaranje naziva. Normalizacija uklanja razlike poput velikih/malih slova, interpunkcije, `doo`, `d.o.o.`, `preduzetnik`, generičkih prefiksa i numeričkih sufiksa koji ne menjaju identitet firme.

Primarni red dobija:

```text
duplicate_resolution=auto_primary_preview
```

Povezani redovi ostaju u review fajlu sa:

```text
review_status=merged
duplicate_resolution=auto_merged_preview
merge_target_id=<javni-id-primarnog-markera>
```

Potpuniji naziv se koristi kao javni, a ostali nazivi ulaze u bezbedno javno polje `alternativeNames` radi pretrage. BEX ID-jevi se nikada ne koriste u javnom ID-u.

Ne spajaju se automatski isti nazivi na različitim adresama, različite firme na istoj adresi ili neodređena podudaranja. Za ručno razdvajanje postaviti `duplicate_resolution=keep_separate`.

Ako različite lokacije nakon geokodiranja dele iste koordinate, ostaju odvojene. MapLibre sloj im primenjuje mali deterministički vizuelni offset, dok navigacija i dalje koristi sačuvanu geokodiranu koordinatu.

## Geokodiranje

Skripta koristi javni Nominatim samo u razvojnom okruženju, nikada u browseru. Pre pokretanja pročitati aktuelnu [Nominatim Usage Policy](https://operations.osmfoundation.org/policies/nominatim/).

- jedna nit i jedan računar;
- najmanje 1,1 sekunda između mrežnih zahteva;
- lokalni cache za svaki upit;
- šalju se samo poslovne adrese pravnih lica;
- fizička lica, PIB i BEX ID se ne šalju;
- User-Agent identifikuje Carsystem preview proces javnim poslovnim kontaktom;
- endpoint i User-Agent mogu se promeniti kroz `NOMINATIM_ENDPOINT` i `NOMINATIM_USER_AGENT`.

Precizan rezultat dobija `coordinate_status=geocoded_preview`. Rezultat na nivou ulice, naselja ili grada, kao i adresa sa `bb`, `0` ili bez broja, dobija `coordinate_status=approximate`. Takva lokacija u interfejsu ima oznaku:

```text
Približna lokacija — tačna pozicija još nije potvrđena.
```

Ako nema ni pouzdanog rezultata za grad/naselje, red ostaje javno dostupan u listi sa `coordinate_status=geocode_no_result`, ali bez markera i navigacije.

## Ručne korekcije

Ručne kolone imaju prioritet nad narednim importom:

- `display_name`, `public_address`, `public_city`;
- `type`, `verification_status`, `is_public`;
- `public_location_id`;
- `latitude`, `longitude`, `coordinate_status`;
- `phone`, `working_hours`, `available_brands`;
- `public_notes`, `internal_note`;
- `duplicate_resolution`, `merge_target_id`.

Za konačno potvrđenu lokaciju postaviti:

```text
review_status=approved
verification_status=verified
is_public=true
coordinate_status=verified_manual|geocoded_verified
```

Za ručno potvrđenu koordinatu obavezno upisati latitude/longitude. Telefon, radno vreme i brendovi su opcioni; brendovi se razdvajaju znakom `|` ili `;`.

Nakon ručne izmene pokrenuti:

```bash
npm run locations:build
npm run locations:validate
```

Ako zapis nestane iz sledećeg BEX izvoza, ostaje u review fajlu sa `source_status=missing_from_latest_import`, zajedno sa ranijim ručnim odlukama.

## Deployment napomena

Lokacijski sloj nema backend, bazu, autentifikaciju ni runtime geokodiranje i kompatibilan je sa statičkim generisanjem. Glavna konfiguracija projekta i dalje koristi standardni Next.js build zbog postojećeg maintenance middleware-a, prema `deployment/vercel/README.md` i `deployment/shared-hosting/README.md`.
