# 29 — Keširanje privatnih podataka: stvarna zaglavlja (2026-09-30)

Mereno nad pokrenutim produkcionim build-om (`next start`, demo baza), za tri
sesije (anonimno, kupac, gazda), HTML i RSC zahtev, bez praćenja
preusmerenja. Skripta: `.cache/demo/f10-headers.mts`; rezultati
`f10-headers-before.tsv` i `f10-headers-after.tsv`.

| Putanje | Pre | Posle |
|---|---|---|
| Javne statične (`/`, `/katalog`, `/proizvodi/…`) | `s-maxage=31536000` | isto — **ispravno**: HTML ne sadrži ničije podatke; kupčeve cene, korpa i „Poručite ponovo" stižu posebnim zahtevima sa `no-store` |
| Strane naloga `/kupac/*` sa sesijom | `private, no-cache, no-store, …` | isto |
| Portal `/portal/*` sa sesijom | `private, no-cache, no-store, …` | isto |
| `/api/kupac/*` | `no-store, private` + `Vary: Cookie` | isto |
| **Preusmerenja** sa `/kupac/*`, `/portal/*` bez sesije (middleware, 307) | **bez `Cache-Control`** | `private, no-store` + `Vary: Cookie` |
| `/prijava/kupac/nastavi` (obnova) | `no-store` | `private, no-store` |
| `/api/portal/izvoz` greške, odbijanje pristupa (`apiAuthResponse`) | **bez zaglavlja** | `private, no-store` |
| `/api/portal/podesavanja/navigacija` | **bez zaglavlja** | `private, no-store` |

Nijedan privatan odgovor nije imao zaglavlje koje dozvoljava deljeno
keširanje; nađena su tri odgovora BEZ zaglavlja (preusmerenja, greške izvoza,
podešavanje navigacije) — ispravljeno.

**Izolacija naloga (isto merenje):** kupac na `/portal/*` i gazda na `/kupac/*`
dobijaju samo preusmerenje (RSC telo = `NEXT_REDIRECT`, bez ijednog podatka);
gazda na `/api/kupac/*` dobija `401` ili `signedIn: false`.

**Čuvar:** `lib/security/privateCaching.test.mjs` (u `npm test`) — svaka API
ruta mora izričito reći `no-store`, strane naloga i portala moraju biti
dinamičke, privatna preusmerenja idu kroz `privateRedirect`.
