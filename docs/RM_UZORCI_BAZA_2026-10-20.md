# R-M uzorci baza (kvadratići uz šifru) — 2026-10-20

Izbor baza na R-M karticama dobija kvadratić, kao Baslac izbor. Kvadratić je **orijentacioni prikaz baze/pigmenta**, ne garantovana završna nijansa na vozilu. Ta napomena stoji i u opisu izbora na stranici.

## Izvori

| Izvor | Šta daje | Pristup |
|---|---|---|
| BASF Refinish US, *Diamont Chromatic Color Wheel / Diamont Tinting Base Characteristics* (2020), https://refinish.basf.us/wp-content/uploads/2020/10/2020_Diamont_ENG.pdf, str. 2–5 | Za svaku šifru: naziv, porodica boje, vrsta (solid/metalik/biser/kristal/transparent), pokrivnost | 2026-10-20 |
| R-M Technical Manual (BASF US) AD2526 | „BC 100 Base Clear“ (bezbojna baza) | 2026-10-12 |

Proveren je i zvaničan prikaz po šifri: rmpaint.com (stranice linija baza imaju samo ambijentalne fotografije) i techinfo PDF-ovi za CRYSTAL BASE (samo odnosi mešanja). **Proizvođač ne objavljuje fotografiju uzorka po šifri**, pa se uzorak gradi iz tabele.

## Metod

- Boja kvadratića = **porodica iz tabele** za tačnu šifru (npr. „Red“, „Blue“), preslikana u fiksnu, orijentacionu paletu (`data/rm-sync/base-swatches.json`, `palette`). Nijansa se ne izvodi iz šifre ili naziva.
- Obrazac kvadratića = **vrsta iz tabele**: puna boja (solid), odsjaj (metalik), prelaz (biser), iskre (kristal), poluprovidno (transparent), šahovnica (bezbojno).
- Šifra bez podatka i kartica bez potvrđene linije → **šrafiran neutralan kvadratić** (bez boje).

## Pokrivenost

| Kartica | Pokriveno | Neutralno |
|---|---|---|
| DIAMONT bazna boja | 34 / 35 | 1 — BC 101 (Flop Control: nema porodicu boje u tabeli) |
| DIAMONT CRYSTAL BASE | 17 / 17 | 0 |
| R-M paste za mešanje | 0 / 20 | 20 — linija nije potvrđena, šifre nisu u tabeli: SC 403, BC 111, BC 190, BC 196, BC 301, BC 404, BC 408, BC 475, BC 512, BC 601, BC 616, BC 617, BC 740, BC 816, BC 881, BC 1182, BC 1245, BC 1265, BC 7610, CB 48V |
| **Ukupno** | **51** | **21** |

- Naziv i porodica se ponekad razlikuju; tada važi porodica iz tabele. Primer: CB 38L „Ultra White“ je u tabeli Color = Green, efekat „Green Sparkle“ (str. 4), pa je kvadratić zelen.
- **UNO HD**: kartica ima jedan red (SC 10) i nema izbor baza, pa nema ni kvadratića.
- **ONYX HD**: u katalogu nema redova baza; nema šta da se prikaže.

Provera: `lib/rmBaseSwatches.test.mts` (u `npm run test:rm-brand`) zaključava brojeve iznad i neutralan prikaz.
