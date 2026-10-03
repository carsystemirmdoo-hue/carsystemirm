# 41 — Pilot: lokalni build, šifre partnera, rezervna kopija, kontrole talasa i prepreke

**Status (2026-10-02): pilot baza prazna i proverena; lokalni produkcioni build
sa pilot podešavanjima proveren; nema deploymenta, kupaca ni faktura.**
Radna granica prostora: **0,5 GB** (tačan limit potvrđuje vlasnik u konzoli).
Prethodno: [40](40-pilot-priprema-rabati-i-nalozi.md).

## 1. Lokalni produkcioni build sa pilot podešavanjima

Promenljive iz 39 §3 (pilot ključevi, `DATABASE_URL`/`DATABASE_DIRECT_URL` kao
`carsystem_app`, `PORTAL_MFA_MODE=enforced`, `CUSTOMER_ORDERING=off`,
`PORTAL_COMMERCE=off`, flegovi `0`, `NEXT_PUBLIC_SEO_INDEXING=false`) u
privatnom fajlu `~/.carsystem-secrets/pilot/local-build.env` (600);
`AUTH_URL=http://localhost:…`. Build u ignorisanu fasciklu, `next start`
lokalno, zatim build obrisan.

| Provera | Rezultat |
|---|---|
| `next build` | prolazi (poznato upozorenje `jose`/Edge, postojalo i ranije) |
| `/`, `/katalog`, `/prijava`, `/prijava/kupac` | 200 |
| `/portal`, `/portal/importi` | 307 → `/prijava` |
| `/kupac` | 307 → `/prijava/kupac` |
| `robots.txt` | `Disallow: /`; stranice nose `noindex` |
| `/api/sync/*` | isključeno (404/405) |
| zaglavlja | CSP `frame-ancestors 'none'`, `Referrer-Policy`; prijava `Cache-Control: no-store` |
| klijent baze aplikacije (isti `getDb`, ista adresa) | prijavljen kao `carsystem_app`; čita; `CREATE TABLE`, `DROP TABLE`, `TRUNCATE`/`DELETE`/`UPDATE` traga revizije → odbijeno (42501) |

Napomena: `next start` podrazumevano sluša na svim adresama računara; za
sledeću lokalnu proveru pokretati sa `-H 127.0.0.1`.

## 2. Šifre partnera: registar i alat za povezivanje usklađeni

Fakture 2021–2026 štampaju šifru partnera **uvek sa 5 cifara** („00028"),
izvoz šifarnika bez nula („28"). Pravilo je zajedničko
(`lib/commercial/partnerRegisterMatch.mjs`):

- `invoiceFormPartnerCode` — šifra iz šifarnika u obliku sa fakture, samo kada
  je nedvosmisleno (cifre, ≤ 5, ključ bez nula jedinstven u šifarniku);
- **alat za povezivanje** (`customer-link.mts`) upisuje vezu pod šifrom sa
  fakture;
- **registar partnera** (`linkPartnerToCustomer`) i dalje upisuje svoju
  izvornu šifru, a uz nju sada i oblik sa fakture za istog kupca; kod
  kolizije („0012" i „12") oblik sa fakture se ne pravi, a već povezan /
  sukobljen / isključen oblik sa fakture se ne dira — to razrešava kancelarija.

Oba puta daju isti identitet koji uvoz faktura traži. Testovi:
`partnerRegisterMatch.test.mjs`, `partnerAccounts.integration.test.mts`
(nov slučaj), `customerLink.integration.test.mts`.

## 3. Pregled predloga za prvi talas

`customer-link.mts plan` nad **pilot bazom** (ograničena uloga, samo čitanje):
predlog za svakog partnera talasa (otvaranje kupca + veza šifre sa fakture),
bez izdvojenih slučajeva. Tabela za kancelariju je privatna
(`~/.carsystem-private/veze-talas-01.csv`): kolone `odluka` (`potvrdi`/`odbij`)
i `potvrdio` popunjava kancelarija; primena tek posle toga (39 §1).

## 4. Rezervna kopija i proba vraćanja

`scripts/ops/pilot-backup.sh` (proveren nad praznom pilot bazom):

- `dump <fascikla>` — `pg_dump -Fc` sa direktne adrese vlasnika (Frankfurt,
  bez poolinga), lozinka kroz okruženje; odbija fasciklu u repozitorijumu,
  računar bez FileVault-a i fajl tajni koji nije označen kao pilot; uz kopiju
  `.json` sa SHA-256 i brojem redova ključnih tabela; prava 600.
- `verify <fajl>` — proverava otisak, vraća u privremenu **lokalnu** bazu,
  poredi broj redova i briše privremenu bazu.

Redosled za talas: Neon grana `pre-talas-01` (konzola) → `dump` → `verify` →
talas → `dump` posle.

## 5. Kontrole pre i posle uvoza

`scripts/ops/wave-control.mts` (samo čitanje; pravila u
`lib/import/waveControl.mjs`, testirana). Ispisuje samo ✔/✖ i broj
dokumenata, ne iznose.

**`pre`:** fajlovi talasa postoje i otisci su jednaki manifestu; verzija
parsera = manifest; baza bez demo oznake; nijedan dokument talasa nije već
uvezen; svaki partner talasa ima `mapped` šifru sa fakture za izdavaoca
`CSRM`; nema dokumenata na ručnom pregledu; procena posle talasa ispod 80 %
od 0,5 GB. *Nad pilot bazom danas pada samo provera partnera (još nisu
povezani) — očekivano.*

**`posle`:** svaki dokument talasa u bazi, ispravan i knjižen; nijedan na
pregledu ni u sukobu revizije; broj faktura, stavki, neto i bruto = manifest
(na paru; isto merilo kao uvoz: bruto − PDV po stavci, provereno za ceo
talas); u mesecu za `CSRM` nema faktura van talasa; **BizniSoft kontrolni zbir**
(broj, neto, PDV, bruto) = baza — bez njega talas se ne prihvata; veličina baze
i promena.

## 6. Sledeći korak za Vercel

Vlasnik, u Vercel timu `carsystem1`: **Settings → Billing → prelazak na Pro
(jedno razvojno sedište)**. Posle toga, i tek uz posebno odobrenje: grana
`pilot/istorija`, promenljive iz 39 §3 (samo Preview, samo ta grana) i jedan
zaštićeni deployment. Vercel Authentication ostaje uključen; zaštita lozinkom
nije potrebna.

## 7. Šta još blokira prvi uvoz

**Tehničko (vlasnik / naš rad):**

1. Vercel Pro na timu (§6) → promenljive i zaštićena objava `pilot/istorija`
   (odobrenje).
2. Vlasnik u pilotu: Aleksandar sam postavlja lozinku i vezuje drugi faktor,
   kada je prisutan.
3. Nalog kancelarije u pilotu (pravi ga Vlasnik; drugi faktor obavezan).
4. Potvrda limita prostora u Neon konzoli.

**Podaci i potvrde od kancelarije:**

1. Pregled i potvrda predloga veze za partnere talasa (`odluka`, `potvrdio`).
2. BizniSoft kontrolni zbir za januar 2025. (40 §3).

**Ne blokira prvi talas** (blokira kasnije talase ili druge delove): pravila
za storna i revizije, šifarnik artikala, potvrde kontakata i pozivi kupcima,
odluka o Git istoriji.
