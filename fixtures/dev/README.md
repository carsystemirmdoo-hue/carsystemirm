# Razvojni fikstovi — nisu poslovni podaci

Sve u ovom folderu postoji isključivo radi razvoja i vizuelne provere interfejsa.

**Ništa odavde se ne sme upisati u bazu, prikazati kao stvarno stanje firme, niti
predstaviti kao proverena informacija.** Imena kupaca, iznosi, dugovanja,
pošiljke i ponašanje pri plaćanju su izmišljeni radi prikaza rasporeda ekrana.

## Zašto je odvojeno

Ranija verzija portala je čitala ove nizove direktno kroz `PortalProvider`, pa se
demo promet prikazivao kao da je stvaran. Premeštanjem iz `mock-data/` u
`fixtures/dev/` granica je vidljiva iz same putanje: uvoz iz `@/fixtures/dev/...`
u kodu koji se izvršava u produkciji je greška.

## Šta ih koristi

Moduli u `features/portal/` iz ranije verzije (`CustomersModule`,
`OrdersModule`, `PricingModule`, `PortalDashboard`, `IntegrationCenters`,
`OperationsAdmin`, `EntityModules`). Ti moduli **nisu vezani ni za jednu rutu** —
zadržani su zato što sadrže upotrebljiv raspored tabela i obrazaca koji se u
fazama 2–5 prevodi na stvarne podatke.

Rute iz ranije verzije koje su vodile na te module (`/portal/cene`,
`/portal/proizvodi`, `/portal/odobrenja`, `/portal/komercijalisti`,
`/portal/biznissoft`, `/portal/podesavanja`) sada preusmeravaju na odgovarajući
ekran verzije 2. Nijedan fajl nije obrisan.

## Prava pravila za podatke

- Kupci, fakture i promet dolaze iz uvoza BiznisSoft izvoza (faza 2).
- Podaci o plaćanju **ne postoje** u fakturama. Dugovanje, kašnjenje, procenat
  plaćenih na vreme i otvoreni saldo se prikazuju kao
  „Podatak nije dostupan iz trenutnog izvora“ dok se ne poveže proveren izvor.
- `db/seed.mjs` upisuje samo pakete dozvola, podrazumevane pragove i jedan
  početni Gazda nalog. Nijednog kupca, fakturu ni pošiljku.
