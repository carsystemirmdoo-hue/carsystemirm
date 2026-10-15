# 62 — Objava: kupovina preko sajta, cela pakovanja i prvi skup veza (jedan postupak)

Status (15. 10. 2026): **koraci 0–7 izvršeni ranijim objavama; koraci 8–10 izvršeni 15. 10.** po
odobrenju vlasnika: odobreni skupovi 1–15 objedinjeni u jedan plan (jedna konačna odluka po šifri, svi
izvori uz zapis: potvrda vlasnika, pravilo vlasnika, kancelarija, etiketa), odluke artikala, pribor i
ispravke oznaka — posle proverene kopije i probe na izolovanoj kopiji Production baze; upis
pakovanja i pribora sada ima i audit zapis. Brojevi su u privatnom zapisu prenosa.

Prvobitni status: pripremljeno, ništa nije primenjeno na Production. Jedno odobrenje vlasnika pokriva
ceo postupak ispod; postupak se **zaustavlja** čim neka provera padne ili stanje odstupa od
pripremljenog (§3).

Brojevi (koliko veza, koje šifre, snimak „pre“) su u privatnom planu
`~/.carsystem-private/sifarnik-2026-10-11/plan-upisa/` — repo je javan.

## 1. Šta se objavljuje

| Deo | Šta | Migracija |
|---|---|---|
| PR #23 (revizija B0–B11) | po [59](59-objava-revizije.md) | 0045, 0046 |
| Ovaj PR (kupovina preko sajta) | katalog na istom obračunu i korpi kao portal; „Moj nalog“; cela pakovanja (broj pakovanja × potvrđeno pakovanje = BizniSoft količina); izuzetak kancelarije; status po varijanti; alati za veze i pakovanja | **0047** |
| Odobreni skupovi veza (podaci) | prvi skup: 10 kontrolnih veza + nesporne veze po pravilima Carsystem/Befar; drugi skup: Carsystem diskovi, listovi, rolne i paketi po potvrdi vlasnika (kupac poručuje pakovanje, BizniSoft količina = pakovanje × količina pakovanja) | — |

Ne menja se: poručivanje za stvarne kupce ostaje **isključeno** (samo test kupac PROBA u
`ordering.trial`), preporuke isključene, održavanje sajta uključeno, nove promenljive okruženja nema.
Van postupka (posebne odluke): Carsystem KOM sa više komada u prodajnoj jedinici, nazivi bez oznake
brenda, artikli bez prodaje poslednjih 12 meseci, zatvaranje starog zapisa uvoza.

## 2. Kompatibilnost

| | Baza bez 0047 | Baza sa 0047 |
|---|---|---|
| Kod pre PR #23 (sadašnji Production) | radi | **radi** — provereno lokalno (testovi zahteva, korpe i „Poručite ponovo“ nad bazom sa 0045–0047) |
| Kod PR #23 | radi | **radi** — provereno lokalno (isti testovi nad bazom sa 0045–0047) |
| Kod ovog PR-a | **ne radi** (čita `article_pack_sizes`, `pack_count`) | radi |

0047 je čisto dodavanje: nova tabela `article_pack_sizes` (sa ograničenjima: količina > 0; za
JM KOM/KT ceo broj komada), kolona `customer_cart_items.pack_count`, kolone
`customer_order_lines.pack_count/pack_quantity`. Ništa postojeće se ne menja. Zaključak: **prvo sve
migracije (0045–0047), pa kod.** Build ne pokreće migracije.

## 3. Pravila zaustavljanja

Postupak staje i javlja stanje ako: kopija nije zelena ili se ne vrati lokalno; broj migracija pre
nije 45 ili posle nije 48; nalog aplikacije nema prava na novu tabelu; build ili provera posle
objave padne; plan upisa ne kaže „spremno“ za tačno onoliko veza koliko ima privatni plan; posle
upisa plan ne kaže „veza već potvrđena“ za sve; bilo koja 500 greška u logovima; `ordering.trial`
ili `CUSTOMER_ORDERING` nisu kao pre. Povratak je u §6.

## 4. Postupak

| # | Korak | Ko | Očekivano |
|---|---|---|---|
| 0 | PR #23 i ovaj PR pregledani; Vercel pristup vlasnika važi; firmin `main` je i dalje isti commit kao Production pre pripreme | Vi / ja | sve „da“ |
| 1 | Snimak „pre“ (samo čitanje): broj migracija, potvrđene veze, postojanje `article_pack_sizes`, `ordering.trial`, ključni brojevi iz [59 §3.4](59-objava-revizije.md) | ja | jednako privatnom snimku (migracije 45, veza 0, tabela ne postoji, proba = samo PROBA) |
| 2 | Kopija baze: GitHub „Kopija baze“ → *Run workflow* → zeleno → lokalno dešifrovanje i `db-backup.mjs verify` | ja (uz firmin pristup) | zeleno; broj prolaza i otisak zapisani privatno |
| 3 | Migracije kao vlasnik baze (direktna adresa): `MIGRATION_DATABASE_URL='<vlasnik>' NODE_ENV=production npm run db:migrate` | ja | 45 → 48 |
| 4 | Provera baze (samo čitanje): 48 migracija; `has_table_privilege('carsystem_app', …)` za `auth_revoked_sessions` (INSERT, DELETE) i `article_pack_sizes` (SELECT, INSERT, DELETE); oba CHECK ograničenja na `article_pack_sizes`; nove vrednosti `notification_kind` | ja | sve „da“; sadašnji kod i dalje radi (`/prijava` 200) |
| 5 | Spajanje PR #23 (squash) → Vercel Production build | ja | build uspeo; `/prijava` 200, `/portal` 307 |
| 6 | Spajanje ovog PR-a (osnova je posle koraka 5 `main`) → build | ja | build uspeo |
| 7 | Provera posle objave: tabela [59 §5](59-objava-revizije.md) + `/api/kupac/ponude` bez sesije = 401 i `no-store`; javna strana proizvoda bez cena u HTML-u | ja | sve kao očekivano |
| 8 | Plan upisa (samo čitanje) za svaki odobreni skup: `DATABASE_URL=<aplikacija> npx tsx --tsconfig db/integration/tsconfig.test.json scripts/catalog/apply-confirmed-links.mts <skup.json>` | ja | „Spremno: N / N“ po skupu, N = privatni plan; nijedno „ODBIJENO“ |
| 9 | Upis: isto + `--potvrdio <e-mail naloga vlasnika> --upis --production-odobreno`, skup po skup | ja | „Upisano: N“ po skupu (veze kroz `decideMapping` sa auditom; pakovanja po privatnom planu) |
| 10 | Provera upisa (samo čitanje): ponovljen plan = „veza već potvrđena“ za sve; broj potvrđenih veza, pakovanja i audit zapisa = privatni plan | ja | jednako |
| 11 | Prijavljeni tok na nalogu PROBA (§5) | **Vi** | sve stavke §5 |
| 12 | Vercel logovi prvih 30 min bez 500; sledeći ciklus KANC-01 kao u [59 §5](59-objava-revizije.md) | ja | bez 500; ciklus „obrađeno“ |

Napomena: posle koraka 5 svi se jednom ponovo prijave (B8). Potvrđena veza menja i ono što
prijavljeni kupci vide u „Poručite ponovo“ (slika i link proizvoda), iako je za njih poručivanje
isključeno.

## 5. Provera na nalogu PROBA (Vi — Vaša prijava, Vaša lozinka)

PROBA ima odobrene opcije avans i odloženo i rabat samo za baslac: baslac stavke treba da imaju
cenu, ostale „Cena na upit“.

1. Otvorite `https://carsystemirm.com/site-u-pripremi` i unesite kod sajta.
2. Otvorite `/proizvodi/baslac-70-10-silicone-remover-for-oil-silicone-and-grease`, kliknite ikonicu
   prijave gore desno i prijavite se PROBA nalogom. **Očekivano:** vraćate se na istu stranu.
3. Panel „Za Vašu firmu“: pakovanja **limenka 1 L** i **kanta 5 L**; cena celog pakovanja bez i sa
   PDV-om za obe opcije; za kantu je cena pakovanja = 5 × cena po L. Status gore: „Vaša cena potvrđena“.
4. Izaberite kantu 5 L, broj pakovanja **2**. **Očekivano:** „2 × kanta 5 L = 10 L u obračunu“. Dodajte u korpu.
5. Otvorite `/proizvodi/baslac-50-420-2k-clear-hardener-normal-voc`: pakovanje **limenka 0,5 L**, cena
   pakovanja = cena jednog komada (ne pola). Dodajte 1.
6. Otvorite `/proizvodi/carsystem-prefill-spray`: „Cena na upit“ (PROBA nema rabat za Carsystem), nigde
   „400 ml“ kao kapacitet.
7. „Moj nalog“ → Korpa: kanta „2 × kanta 5 L“ i ispod „= 10 LIT“; limenka „1“ i „limenka 0,5 L“; zbir
   po opciji.
8. Pošaljite zahtev (opcija po izboru, napomena „PROBA objava“). **Ovo upisuje probni zahtev na PROBA
   nalogu** — deo je ovog postupka.
9. Kancelarija (Vaš ili kancelarijski nalog): Zahtevi kupaca → taj zahtev → Štampa. **Očekivano:**
   količina 10 (LIT) sa „poručeno: 2 × kanta 5 L = 10 LIT“ i 1 (KOM) sa „poručeno: 1 × limenka 0,5 L = 1 KOM“;
   šifre ne prelaze u susednu kolonu. Zatim zahtev **otkažite** sa razlogom „probni zahtev posle objave“.
10. Odjavite se sa strane proizvoda. **Očekivano:** ista strana, bez panela i cena.

Javite mi broj zahteva i rezultat po koraku; ako bilo koji korak odstupa — staje se (§3).

## 6. Povratak

- **Kod:** Vercel → Deployments → poslednji deployment pre koraka 5 → *Promote to Production*
  (bez diranja baze; migracije ostaju — i kod PR #23 i kod pre njega rade nad bazom sa 0045–0047, §2).
- **Veze i pakovanja:** `apply-confirmed-links.mts <prvi-skup.json> --potvrdio <vlasnik> --povuci "<razlog>" --production-odobreno`
  — svaka veza prelazi u „povučeno“ sa razlogom (audit), pakovanja iz plana se brišu.
- **Baza (samo ako je zaista potrebno, POSLE povratka koda):** `db/rollback/0047_order_packs.down.sql`,
  pa 0046/0045 po [59 §6](59-objava-revizije.md).

## 7. Šta je provereno pre ovog postupka (lokalno)

- Generalna proba prvog skupa na sintetičkoj bazi sa stvarnim šiframa, nazivima, JM i osnovnim
  cenama: plan „spremno“ za sve, upis kroz `decideMapping`, audit za svaku vezu, ponovljen plan
  „veza već potvrđena“, povratak `--povuci` vraća sve u „povučeno“.
- Tok `kontrolne` (10 artikala kroz katalog, korpu, zahtev i štampu), `sajt`, `sve` — prolaze.
- Plan nad Production-om u sesiji samo za čitanje: jedina prepreka je nedostajuća 0047.
