# Sintetički BizniSoft fixtures

**Svaka vrednost u ovim dokumentima je izmišljena.** Nijedan naziv, PIB,
adresa, e-pošta, šifra partnera ili artikla, iznos ni broj dokumenta ne potiče
iz stvarnog dokumenta.

Stvarni PDF uzorci ostaju u privatnom lokalnom folderu, van Gita, i nikada se
ne kopiraju ovde — vidi `docs/b2b/16-biznisoft-pdf-evidence-audit.md`.

## Šta se čuva iz stvarnog formata

Samo **struktura**: geometrija kolona (X koordinate), nazivi kolona, redosled
blokova i aritmetika reda. To je ono što parser mora da razume, i jedino što
sme da izađe iz privatnog izvora.

## Regeneracija

```bash
npm run fixtures:biznisoft
```

Fajlove ne treba ručno uređivati — generator ih pravi determinističkim
računom, pa fixture nikada ne laže o sopstvenom zbiru.

## Slučajevi

| Fajl | Pokriva |
|---|---|
| `jedna-stavka.pdf` | najprostiji dokazani oblik |
| `vise-stavki.pdf` | 7 stavki, mešane poreske stope i rabati |
| `dve-strane-ponovljeno-zaglavlje.pdf` | dvostrani dokument, stavke samo na strani 1 — **dokazani** oblik |
| `vodeca-nula-partner.pdf` | šifra partnera sa vodećom nulom |
| `zbir-se-ne-poklapa.pdf` | odštampan zbir ≠ izračunat — mora biti odbijen |
| `nastavak-tabele.pdf` | tabela se nastavlja na strani 2, ali numeracija počinje ispočetka — nije jedna tabela; mora završiti u `unsupported_requires_sample` |
| `nastavak-tabele-neprekidno.pdf` | numeracija se nastavlja na strani 2, zbir obuhvata obe strane — **dokazan** oblik (stvarne višestranične fakture); `valid` |
| `storno.pdf` | potpun storno fakture `jedna-stavka.pdf`, sa vezom u napomeni — prepoznat kao `storno`, i dalje `unsupported_requires_sample` |
| `negativne-stavke.pdf` | negativna količina pod naslovom fakture (povrat) — mora završiti u `unsupported_requires_sample`, nikad u promet |
| `neispravan-bez-zaglavlja.pdf` | neupotrebljiv ulaz |

Slučajevi koje nijedan fixture ne pokriva (storno, povrat, korekcija, revizija,
negativne vrednosti, referenca na original) namerno **ne postoje**: bez stvarnog
uzorka bi fixture bio izmišljen format, a ne provera.
