# Sezonske kampanje

Praznične promene (Nova godina, Vaskrs) uključuju se i gase automatski, po
datumu u zoni `Europe/Belgrade`, bez novog deploya. Standardna stranica je
uvek podrazumevana.

## Gde je šta

| Fajl | Uloga |
| --- | --- |
| `lib/seasonal/seasonalCampaigns.config.mjs` | **Jedino mesto** gde se definišu kampanje: prozor, tekst, vizual, `enabled` |
| `lib/seasonal/seasonalCalendar.mjs` | Pravila: datum u Beogradu, pravoslavni Vaskrs, razrešavanje aktivne kampanje |
| `lib/seasonal/seasonalCalendar.test.mjs` | Testovi (`npm run test:seasonal`) |
| `components/seasonal/useSeasonalCampaign.ts` | Klijentski hook; jedini ulaz za komponente |
| `components/baslac-brand/baslacSeasonal.ts` | Kampanja → slajd Baslac heroja (pozicija 2) |

## Pravila

| Kampanja | Prozor (oba dana uključena) |
| --- | --- |
| `nova-godina` | 15. decembar – 7. januar (pravoslavni Božić) |
| `vaskrs` | 10 dana pre pravoslavnog Vaskrsa – Vaskršnji ponedeljak |

Pravoslavni Vaskrs se računa (Meeus, julijanski → gregorijanski, +13 dana,
važi 1900–2099) i test ga poredi sa objavljenim datumima 2024–2033. Primeri:
2027 → 22. 4. – 3. 5.; 2028 → 6. 4. – 17. 4.

Rok sa portala ima prednost: `image.validUntil` (i `validFrom`) gasi SLIKU
posle roka; kampanja tada ostaje u dekorativnoj verziji bez slike. Pravila
ponovne upotrebe opisana su niže („Sezonski vizual“). Ako ceo
pozdrav treba da se ugasi ranije, isključiti kampanju (`enabled: false`).

## Zašto se sezona računa u browseru

Stranice brendova su statičke (SSG). ISR (`revalidate`) nije opcija: na
`main` je `public/` isključen iz Vercel funkcije `brendovi/*`
(`outputFileTracingExcludes`), pa bi regeneracija na serveru pročitala
`existsSync` kao `false` i sve media slotove pretvorila u placeholdere.
Zato server i prvi render uvek daju standardnu verziju, a hook posle
hidratacije umeće sezonski slajd iza prvog. Visina heroja je fiksna, a
paginacija ostaje u jednom redu, pa se layout ne pomera (izmereno CLS
≈ 0,002).

## Ručna kontrola

- **Ugasiti sve:** `NEXT_PUBLIC_SEASONAL_CAMPAIGNS=off` pa novi build/deploy.
- **Forsirati jednu:** `NEXT_PUBLIC_SEASONAL_CAMPAIGNS=vaskrs` (ili `nova-godina`).
- **Isključiti jednu trajno:** `enabled: false` u konfiguraciji.
- **Podrazumevano:** promenljiva nije postavljena, odnosno `auto`.
- Nepoznata vrednost nikad ne uključuje kampanju (pada na `auto`).

## Preview i testiranje

U developmentu (ili uz `NEXT_PUBLIC_SEASONAL_PREVIEW=1`):

- `/brendovi/baslac?sezona-datum=2026-12-20` → Nova godina
- `/brendovi/baslac?sezona-datum=2027-04-30` → Vaskrs
- `/brendovi/baslac?sezona=off` ili `?sezona=vaskrs`

U produkcijskom buildu bez `NEXT_PUBLIC_SEASONAL_PREVIEW` ovi parametri se ignorišu.

## Sezonski vizual: trenutno stanje i aktivacija

Trenutno **nijedna kampanja nema aktivan vizual**, pa je CSS dekoracija
produkcijsko rešenje. Preuzeti vizuali sa portala (Nova godina 2024/25,
Uskrs 2025) čuvaju se u `seasonalImageLibrary` u konfiguraciji, sa poreklom
(`docs/BASLAC_PORTAL_ASSETS.md`).

Slika se prikazuje samo uz izričitu odluku o ponovnoj upotrebi (`reuse`):

| `reuse.status` | Kada se prikazuje |
| --- | --- |
| `campaign-only` | samo unutar `reuse.campaignWindow`, odnosno originalnog perioda kampanje |
| `generic-confirmed` | u svakoj sezoni kampanje; `reuse.evidence` mora da navede potvrdu dobavljača |
| nema `reuse` ili nema dokaza | nikad |

Zato vizual iz 2024/25 ne može da postane vizual za 2026/27, čak ni ako se
greškom poveže sa kampanjom. To proverava `npm run test:seasonal`.

Aktivacija, kad za to postoji osnov:

1. **Potvrda da je postojeći vizual generički:** u zapisu biblioteke postaviti
   `reuse.status: "generic-confirmed"`, doslovan dokaz u `reuse.evidence`,
   pa u kampanji `image: seasonalImageLibrary["…"]`.
2. **Novi vizual za tekuću sezonu:** novi zapis u biblioteci sa
   `campaign-only` i `campaignWindow` te sezone, pa ga povezati sa kampanjom.

`validFrom`/`validUntil` dodatno ograničavaju prikaz, na primer rokom sa
portala. Svaki zapis mora imati `desktopSrc`, opcioni `mobileSrc`, dimenzije,
`alt`, `reuse` i `source` (portal, ID asseta, naziv, putanja, originalni
fajl, napomene). Slika je uvek `lazy` i nikad nije LCP. Ako ne uspe da se
učita, slajd pada na CSS dekoraciju.
