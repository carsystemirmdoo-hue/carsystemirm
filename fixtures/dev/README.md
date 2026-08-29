# Razvojni fikstovi — nisu poslovni podaci

Sve u ovom folderu postoji isključivo radi razvoja i provere uvoza.

**Ništa odavde se ne sme upisati u bazu, prikazati kao stvarno stanje firme, niti
predstaviti kao proverena informacija.**

## Šta je ostalo

Samo `import/probni-izvoz-2026.csv` — ulaz za testove uvoza faktura.

## Šta je uklonjeno i zašto

Raniji `fixtures/dev/portal/` je nosio izmišljene kupce, porudžbine, proizvode i
cene za module `features/portal/` iz prve verzije portala. Ti moduli su radili
nad **drugim modelom dozvola** (`permissions/portal-permissions.ts`, uloge
`owner`/`sales`/`office`) i nad `mockPortalService`, koji je „primenjivao"
promene cena u memoriji.

Dependency graph je pokazao da nijedan od njih nije dostižan iz `app/`. Paralelni
model dozvola pored aktivnog (`lib/authz/permissions.mjs`) je trajan rizik —
dovoljno je da ga jedan budući uvoz dohvati pa da provera dozvole prestane da
znači ono što piše. Zato je ceo taj sloj obrisan, a ne dalje izolovan.

## Prava pravila za podatke

- Kupci, fakture i promet dolaze iz uvoza BiznisSoft izvoza.
- Podaci o plaćanju **ne postoje** u fakturama. Dugovanje, kašnjenje, procenat
  plaćenih na vreme i otvoreni saldo se prikazuju kao
  „Podatak nije dostupan iz trenutnog izvora" dok se ne poveže proveren izvor.
- `db/seed.mjs` upisuje samo pakete dozvola, podrazumevane pragove i jedan
  početni Gazda nalog. Nijednog kupca, fakturu ni pošiljku.
