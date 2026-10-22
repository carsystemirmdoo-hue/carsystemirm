# Zaključane stranice („pod ključ“) — evidencija od 2026-10-22

Zaključana stranica je stranica čiji odobreni dizajn i raspored se više ne menjaju bez dogovora sa vlasnikom. Sadržaj, podaci, cene i slike se i dalje menjaju. Zaključavanje ne menja dostupnost stranice posetiocima.

**Stranice bira vlasnik.** Agent ne dodaje stranice sam. Spisak je trenutno prazan i popunjava se tek kada vlasnik navede stranice.

## Kako se vodi evidencija

| Šta | Gde |
|---|---|
| Spisak, datum, ko je odobrio, zavisni fajlovi | `data/locked-pages.json` |
| Referentni snimci (desktop 1440 i telefon 390, svetla i tamna tema, cela strana) | van repozitorijuma: `~/Carsystem/zakljucane-stranice/<stranica>/<datum>/`. Repozitorijum je javan, a sajt je u pripremi, pa slike ne idu na GitHub. U evidenciji je samo sha256 otisak svake slike. |
| Alat | `scripts/lock/locked-pages.mjs` |

```bash
node scripts/lock/locked-pages.mjs add /putanja --naziv "Naziv" --odobrio "vlasnik"
```
Upisuje stranicu i, iz grafa importa, sve fajlove od kojih zavisi: stranicu, layout, header, footer, komponente, CSS i podatke.

```bash
node scripts/lock/locked-pages.mjs snimi --base http://localhost:3508
```
Pravi referentne snimke i upisuje im otiske.

```bash
node scripts/lock/locked-pages.mjs uticaj --od company/main
```
Pre svake objave pokazuje koje zaključane stranice diff dira. Ako je stranica pogođena (npr. promenom zajedničke komponente), posledica se prikazuje vlasniku pre objave.

```bash
node scripts/lock/locked-pages.mjs uporedi --base http://localhost:3508
```
Novi snimci se porede sa referentnim.

## Zaključane stranice

| Stranica | Ruta | Zaključano | Odobrio | Referentni snimci | Status |
|---|---|---|---|---|---|
| — | — | — | — | — | čeka izbor vlasnika |

## Odnos prema `docs/PAGE_LOCK_STATUS.md`

`PAGE_LOCK_STATUS.md` beleži ranija zaključavanja iz avgusta i septembra 2026: PDP šablon, početnu, header i footer, Cosmos LAC, Befar i `/katalozi`. Te površine su posle toga menjane u krugovima koje je vlasnik izričito tražio (redizajn menija, Befar hero, R-M/Baslac izbor baza). Ta evidencija ostaje kao istorija. Važeći spisak je ovaj i popunjava se po izboru vlasnika.
