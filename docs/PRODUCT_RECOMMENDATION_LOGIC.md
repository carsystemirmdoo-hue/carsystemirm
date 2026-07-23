# Product recommendation logika

## ODLUKA ZA PONEDELJAK

Sistem preporuke proizvoda treba dogovoriti u ponedeljak sa ostalim kolegama, jer preporuke zahtevaju stvarnu tehničku i poslovnu logiku proizvoda.

Do tada je blok „Slični proizvodi“ vizuelno i tehnički implementiran, ali koristi ručno odabrane privremene relacije.

Privremene relacije ne treba tretirati kao potvrđenu kompatibilnost.

## Privremeno javno pravilo

- „Slični proizvodi“ koristi samo ručno navedene lokalne `relatedProductSlugs` ili reviewed `ProductRecommendation` zapise sa statusom `confirmed`.
- Blok ima neutralan opis i ne tvrdi da su proizvodi tehnički kompatibilni.
- `compatibleProducts` ostaje zasebna, strože proverena sekcija.
- `internalReason` nikada se ne prikazuje kupcu.
- Ne postoji automatsko rangiranje, scoring ili cross-brand recommendation algoritam.

## Pitanja za dogovor

- Da li preporuke prvenstveno treba da budu iz istog brenda?
- Da li prednost imaju proizvodi iz iste kategorije ili iste faze procesa?
- Kako razlikujemo alternative od kompatibilnih proizvoda?
- Da li treba preporučivati proizvod koji ide pre ili posle trenutnog proizvoda?
- Da li smemo preporučivati proizvode drugih brendova?
- Da li dostupnost na lageru utiče na preporuku?
- Da li komercijalni prioritet ili marža smeju uticati na redosled?
- Koliko proizvoda prikazujemo: 4, 5, 6 ili više?
- Ko potvrđuje tehničku kompatibilnost?
- Šta je fallback kada nema stručne preporuke?
- Da li granulacije istog artikla tretiramo kao varijante ili preporuke?
- Da li recommendations kasnije dolaze iz BizniSofta, ručne administracije ili našeg kataloškog modela?

## Typed priprema

Model podržava relacije `similar`, `alternative`, `compatible`, `same-process-stage`, `next-process-step`, `same-brand` i `manual`, uz review status, prioritet i internu napomenu. Implementacija za sada namerno ne pokušava da sama zaključi poslovni ili tehnički odnos.
