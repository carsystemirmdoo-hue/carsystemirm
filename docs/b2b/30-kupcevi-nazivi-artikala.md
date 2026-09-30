# 30 — Kupčevi sopstveni nazivi artikala (OTVORENO)

Status: **otvoreno, ne implementira se** dok ne razjasnimo potrebu.

## Šta je prvobitno planirano (F9 u planu faza)
„Interni nazivi": kupac (firma) za artikle koje kupuje vodi **svoje nazive**
(npr. „bela baza za Opel") i po njima pretražuje; nazive vidi samo ta firma i
njen komercijalista. Zavisnost u planu: **izvor naziva**.

## Šta je u međuvremenu urađeno (nije isto)
Posle F9 postoji prikaz istog artikla na dve strane — BizniSoft šifra i naziv
za zaposlene, kataloški naziv, varijanta i pakovanje za kupca
(`loadArticleIdentities`, `27-…`). To rešava prepoznavanje artikla, ali ne
kupčeve **sopstvene** nazive.

## Šta nedostaje / treba odlučiti
1. **Izvor naziva:** da li BizniSoft vodi naziv artikla po kupcu (npr. šifra i
   naziv kupca na narudžbenici)? Ako vodi — dolazi izvozom i ne unosi se ručno.
   Ako ne vodi — kupac ih unosi sam u nalogu.
2. **Ko sme da menja:** samo kupac, ili i komercijalista u njegovo ime.
3. **Gde se koristi:** pretraga u „Poručite ponovo", korpa, zahtev; da li se
   naziv prenosi kancelariji uz zahtev (korisno pri telefonskoj proveri).
4. **Model (predlog kad se odluči):** tabela `customer_article_aliases`
   (`customer_id`, `article_id`, `alias`, ko/kada), jedinstveno po
   (kupac, artikal); samo kupčev opseg; alias NIKAD nije identitet — veza
   ostaje po šifri, a alias je samo prikaz i pretraga.
5. **Rizik:** alias ne sme uticati na povezivanje sa katalogom ni na cenu.
