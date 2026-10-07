# 24 — „Zapamti me" za kupce: tehnički predlog

Status: **PREDLOG — nije implementirano, nije uključeno.** Traži odobrenje vlasnika i migraciju.

## Polazno stanje (proveriti pre implementacije)

- Interni i kupčevi nalozi dele **jednu** Auth.js konfiguraciju: JWT, `maxAge` 8 h
  (`auth.config.ts`), jedan kolačić sesije. Razlikuje ih `subject` u tokenu.
- Opoziv danas radi preko `sessionVersion`: svaka promena stanja naloga (isključenje,
  aktivacija, reset) povećava verziju i `getCustomerSession()` odbija stariji token.
- Zato se 30 dana **ne sme** postići povećanjem `maxAge`: to bi produžilo i sesiju
  zaposlenih, a JWT se do isteka ne može opozvati bez provere u bazi.

## Predlog: odvojen token za pamćenje uređaja

JWT ostaje 8 h za sve. Kupac koji izričito izabere „Zapamti me" dobija DRUGI, neprozirni
token koji služi samo da se, kada 8-časovna sesija istekne, izda nova — bez lozinke,
najduže 30 dana od prijave lozinkom.

| Deo | Rešenje |
|---|---|
| Uključivanje | `CUSTOMER_REMEMBER_ME=0` podrazumevano. Kada je 0, polje se ne prikazuje i server ga ignoriše. |
| Tabela (nova migracija) | `customer_remember_tokens`: `id`, `account_id` → `customer_users`, `token_hash` (SHA-256), `family_id`, `created_at`, `expires_at` (= prijava lozinkom + 30 d, **ne** klizno), `last_used_at`, `revoked_at`, `revoked_reason`, kratak opis uređaja (npr. „Chrome, macOS" — bez IP adrese). |
| Kolačić | `__Host-cs_remember`, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, 32 nasumična bajta. U bazi samo heš. |
| Obnova | Middleware vidi istekao JWT + kolačić pamćenja → preusmeri na `/prijava/kupac/nastavi?callbackUrl=…` → server proveri token, **rotira** ga (stari opozvan, novi u istoj porodici) i pozove zaseban Credentials provajder `customer-remember`, koji izdaje običan 8 h JWT sa `authMethod: "remember"`. |
| Krađa tokena | Upotreba već rotiranog tokena = opoziv cele porodice i `sessionVersion + 1`. |
| Ograničenje | Najviše 5 aktivnih uređaja po nalogu; šesti opoziva najstariji. |
| Samo kupci | Provajder `customer-remember` čita isključivo `customer_users`; interni nalog nikad ne dobija ovaj kolačić. Test to dokazuje. |

## Tražene kontrole

1. **Odjava sa svih uređaja** — „Moj nalog → Uređaji": spisak aktivnih uređaja (opis,
   poslednja upotreba, ističe) i dugme „Odjavi sve uređaje": u JEDNOJ transakciji opoziva
   sve tokene naloga i povećava `sessionVersion`. Tekuća sesija se time takođe gasi.
2. **Opoziv naloga** — postojeće promene stanja (`account-service`, `invitation-service`,
   `verification-service`) već povećavaju `sessionVersion`; u istoj transakciji dodaje se
   opoziv svih tokena pamćenja. Isključen nalog ne može obnoviti sesiju ni sa važećim kolačićem.
3. **Lozinka pre porudžbine iz stare sesije** — JWT dobija `authMethod` (`password` |
   `remember`) i `authAt`. Slanje porudžbine (F7) traži `authMethod === "password"` i
   `authAt` mlađi od 8 h; inače prikazuje kratko ponovno unošenje lozinke (bez nove
   prijave), koje ažurira oba polja. Pregled faktura i kataloga ne traži ponovnu lozinku.
4. **Promena ili reset lozinke** — opoziva sve tokene pamćenja.
5. **Odjava na jednom uređaju** — opoziva samo token tog uređaja i briše oba kolačića.

## Šta se NE menja

- `maxAge` od 8 h, kolačić sesije, `normalizeAnyCallback`, interna prijava i MFA.
- Anonimni posetioci: bez kolačića pamćenja nema nijednog dodatnog zahteva.

## Testovi (uslov za uključivanje)

- interni nalog: ni posle 30 dana ni sa podmetnutim kolačićem nema obnove; sesija i dalje ističe posle 8 h;
- kupac bez „Zapamti me": ponašanje identično današnjem;
- obnova izdaje 8 h JWT sa `authMethod: "remember"` i rotira token; ponovljen stari token opoziva porodicu;
- 30 dana se računa od prijave lozinkom, ne od poslednje obnove;
- „Odjavi sve uređaje", isključenje naloga, promena i reset lozinke: sledeći zahtev sa bilo kog uređaja je neprijavljen;
- porudžbina iz obnovljene sesije traži lozinku; posle unosa prolazi;
- `CUSTOMER_REMEMBER_ME=0`: kolačić se ne postavlja, a postojeći se ignoriše.

## Otvorena pitanja za vlasnika

- Da li je 30 dana prihvatljivo za kupce koji dele računar u radionici (predlog: tekst
  pored polja „Ne uključujte na zajedničkom računaru").
- Da li porudžbina uvek traži lozinku (strože) ili samo iz obnovljene sesije (predlog).
