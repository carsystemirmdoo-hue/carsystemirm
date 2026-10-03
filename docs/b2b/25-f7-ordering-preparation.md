# 25 — F7 priprema: podaci za kupovinu, veze artikala i prvi tok porudžbine

Status: **priprema + lokalni demo.** Stvarno poručivanje je isključeno
(`CUSTOMER_ORDERING=off`). Režim `demo` radi samo nad demo podacima i demo
cenovnikom. Stvarni režim ne postoji u kodu dok vlasnik ne potvrdi cenovnik,
veze artikala i postupak kancelarije.

---

## 1. Šta danas dobijamo iz BizniSofta, a šta nedostaje

| Podatak | Danas | Izvor | Za kupovinu |
|---|---|---|---|
| Interna šifra artikla | samo za artikle koji su bili na fakturi | PDF faktura (`articleCode`, 6 cifara) | **nedostaje ceo šifarnik** |
| Naziv artikla | sa fakture | PDF | šifarnik |
| Jedinica mere | sa fakture | PDF (`unit`) | šifarnik, za SVE artikle |
| Pakovanje / količina u pakovanju | nema | — | **nedostaje** |
| Šifra proizvođača | nema | — | **nedostaje** (povezuje sa katalogom) |
| Barkod | pročita se sa PDF-a, pa se odbacuje | PDF | šifarnik |
| Važeća cena | **nema** — fakturisana cena je istorija | — | **nedostaje cenovnik** |
| Rabat po kupcu | samo ostvaren rabat na pojedinoj fakturi | PDF | **nedostaju uslovi po kupcu** |
| PDV stopa | sa fakture | PDF | šifarnik/cenovnik |
| Upis porudžbine u BizniSoft | nema; sve je samo čitanje | — | ručni unos u pilotu (§4) |

Konektor (`connector/`) čita samo PDF fakture iz jedne fascikle i ništa ne
upisuje u BizniSoft. Jedina udaljena komanda je `scan_and_sync`.

## 2. Uputstvo: šta tražiti od kancelarije

Tražiti **izvoz iz BizniSofta u XLSX ili CSV**, neizmenjen (bez ručnog
sređivanja), i **snimak ekrana sa kog je izvoz napravljen**. Prvo jedan mali
uzorak (20–30 redova), pa tek kad ga proverimo, ceo izvoz.

**A. Šifarnik artikala — svi aktivni artikli**
interna šifra · naziv · jedinica mere · pakovanje (npr. „1 l", „kutija 50 kom") i
koliko JM je u pakovanju · šifra proizvođača / kataloški broj dobavljača ·
barkod · grupa · brend ili dobavljač · PDV stopa · aktivan da/ne.

**B. Važeći prodajni cenovnik**
interna šifra · cena bez PDV-a · valuta · datum od kada važi · naziv cenovnika.
Pitanje: da li ima više cenovnika i koji je osnovni za veleprodaju? Da li je
cena po JM ili po pakovanju?

**C. Uslovi po kupcu (rabati i posebne cene)**
šifra partnera · na šta se odnosi (artikal, grupa, brend ili sve) · rabat % ili
posebna cena · važi od/do. Pitanje: gde se u BizniSoftu vode rabati po kupcu i
može li se to izvesti kao tabela?

**D. Kontrolni primer**
2–3 kupca sa poznatim rabatima i po jedna njihova skorašnja faktura, da
proverimo da naš obračun daje isti iznos kao BizniSoft.

**E. Pitanja za postupak**
1. Može li BizniSoft da **uveze porudžbinu/predračun iz fajla** (XML, CSV) ili
   preko neke veze? Ako ne — porudžbine se u pilotu unose ručno.
2. Ko u kancelariji prima i potvrđuje porudžbine sa sajta, i do kada u toku dana?
3. Prodaje li se samo u celim pakovanjima? Postoji li najmanja količina?
4. Sme li tačna cena kupca da bude vidljiva kupcu na sajtu (P8 iz `09-…`)?
5. Koliko često se cenovnik i rabati menjaju i ko ih menja?

## 3. Veze BizniSoft artikla sa katalogom

- Ekran: `/portal/proizvodi/mapiranja`.
- **Potvrda mora pokazivati na tačan proizvod.** Pre čuvanja server proverava
  da proizvod postoji. Kada proizvod ima više redova šifara (npr. granulacije),
  varijanta je obavezna i bira se sa spiska. Slobodnog unosa varijante više nema.
- **Postojeće potvrđene veze se ne diraju.** Provera važi za novu odluku; ako
  potvrđena veza posle promene kataloga pokazuje na nepostojeću varijantu,
  kolona „Za poručivanje" to kaže i artikal prestaje da bude poručiv.
- **Predlog (`suggested`) nikad nije poručiv**, čak ni kada artikal ima cenu.
  Poručiv je samo artikal sa potvrđenom (`mapped`) vezom, tačnom varijantom i
  stavkom aktivnog cenovnika (`orderabilityProblem`, `lib/ordering/orderRules.mjs`).
- Kada stigne šifarnik (A), predlozi se prave po tačnoj šifri
  (`MAPPING_IMPORT_CONTRACT`), a potvrđuje ih čovek. Po nazivu ili slici se ne spaja.

## 4. Prvi tok porudžbine (pilot)

```
kupac: korpa firme ──slanje──▶ ZAHTEV Z-2026-00001 (submitted)
kancelarija: preuzmi ──▶ U obradi (under_review)
   ├─ potvrdi ──▶ PORUDŽBINA P-2026-00001 (confirmed) ──▶ ručni unos u BizniSoft ──▶ upis broja dokumenta
   ├─ traži izmenu (razlog) ──▶ kupac vraća stavke u korpu i šalje NOV zahtev
   └─ odbij (razlog)
kupac: otkaži — samo dok zahtev nije preuzet, ili kad se traži izmena
```

- **Zahtev i porudžbina su jasno odvojeni.** Zahtev nosi broj `Z-…`. Broj
  porudžbine `P-…` nastaje tek potvrdom; baza ne dozvoljava broj porudžbine bez
  potvrde (`customer_orders_number_only_when_confirmed`).
- **Cena se zamrzava pri slanju**, iz aktivnog cenovnika i rabata kupca iz istog
  cenovnika (ista pravila prvenstva kao `price_rules`: artikal > grupa > brend > sve).
  Pregledač ne šalje cenu. Šalje samo otisak ponude koju je video; ako se cena
  u međuvremenu promenila, zahtev se ne šalje i kupac vidi nove iznose.
- **Ponovljen klik** koristi isti ključ slanja, pa nastaje jedan zahtev.
  Istovremena slanja iste firme se serijalizuju zaključavanjem reda kupca.
- **Prenos u BizniSoft:** trenutno nema nikakve veze za upis, pa je za pilot
  potreban **ručni unos**. Kancelarija posle potvrde unese porudžbinu u
  BizniSoft i upiše broj dokumenta. Drugi, različit broj se ne prepisuje.
  Ako BizniSoft može da uveze fajl (§2-E1), sledeći korak je izvoz potvrđene
  porudžbine u taj format. Upis bi išao preko konektora, kao nova komanda, uz
  posebnu odluku, jer bi to bio prvi upis u BizniSoft.
- Stanja `queued_for_biznisoft` → `shipped` iz `05-order-state-machine.md` nisu
  u ovoj fazi.

## 5. Dozvole (nove)

| Sposobnost | gazda | kancelarija | komercijalista |
|---|---|---|---|
| `view:zahtevi` | ✔ | ✔ | ✔ samo dodeljeni kupci, samo čitanje |
| `customer_orders:review` (prijem, izmena, odbijanje) | ✔ | ✔ | — |
| `customer_orders:confirm` (potvrda, BizniSoft broj) | ✔ | ✔ | — |

Potvrda veza artikala (`mappings:manage`) ostaje kod gazde i paketa `mapiranja`;
kancelarija je nije dobila automatski.

## 6. Podaci i migracija

Migracija `0029_customer_ordering` (povratak: `db/rollback/0029_customer_ordering.down.sql`):
`price_lists`, `price_list_items`, `price_list_customer_terms`,
`customer_cart_items`, `customer_orders`, `customer_order_lines`,
`customer_order_events`. Sve je aditivno. Primenjena je samo na lokalne test i
demo baze.

## 7. Otvoreno za vlasnika

1. Izvozi A–D iz §2 i odgovori na E.
2. Ko potvrđuje veze artikala: gazda, ili i kancelarija (paket `mapiranja`)?
3. Da li kancelarija sme da potvrđuje porudžbine bez gazde (predlog: da, u pilotu).
4. Uslov za uključivanje stvarnog režima: aktivan `biznisoft` cenovnik iz izvoza,
   poklapanje sa kontrolnim fakturama (D) i dogovoren postupak (§4).
