# 58 — Kancelarija: kratko uputstvo (redom)

Za sve: izvoze čuvajte na USB pod `Carsystem-izvozi-2026-10-11\`. **Ne slati
mejlom, ne u repo.** Lozinke se nigde ne prepisuju. Na kraju mi javite šta je
urađeno — korak 1 proveravam iz baze.

---

## 1. KANC-01 — provera i ručni ciklus (10 min)

1. Uključite računar, prijavite se na **isti Windows nalog** kao i inače.
2. PowerShell (obično, ne kao administrator):
   ```powershell
   & 'C:\Program Files\CarsystemConnector\windows\provera.ps1'
   ```
3. Ručni ciklus (radi i van radnog dana):
   ```powershell
   & "$env:ProgramFiles\nodejs\node.exe" --no-warnings "C:\Program Files\CarsystemConnector\connector\bin\connector.mjs" --packaged --config "C:\Program Files\CarsystemConnector\config.json" run-once
   ```

**Uspelo je ako:** `provera.ps1` nema crvene greške; `run-once` se završi bez
`config_missing` / `identity_mismatch`; u portalu **Importi → Sinhronizacija**
„Poslednje javljanje“ za KANC-01 ima današnje vreme (ili mi javite pa proverim).

Pre odlaska: računar ostaje **uključen i prijavljen** (zaključan ekran je u
redu, odjava nije) i ne ide u spavanje.

*Nije obavezno:* konektor 0.3.13 (zadatak bez prozora) — samo ako ostane
vremena; postojeći 0.3.12 radi. Paket i uputstvo su u fascikli za nošenje
(`UPUTSTVO-KANCELARIJA.md`, odeljci 1 i 3d).

## 2. Fakture koje nedostaju (10–15 min)

Portal ima poslednju fakturu **izdatu 08. 10. 2026**.

1. U BizniSoftu pogledajte da li postoje računi od **09. 10.** i kasnije.
2. Svaki koji postoji izvezite u PDF **kao i inače** u `Desktop\Fakture\Fakture 2026`.
3. Ponovite `run-once` iz koraka 1.

**Uspelo je ako:** ispis `run-once` pokazuje poslate dokumente (broj poslatih veći od 0), a u portalu
**Prodaja** postoje računi od 09. 10. Ako računa od 09. 10. nema — zapišite
„nema“; i to je odgovor.

## 3. Šifarnik artikala (15–30 min)

1. Nađite izveštaj sa spiskom **svih** artikala (ne samo prodatih).
2. Prvo pokušajte izvoz u **XLSX ili CSV**, inače PDF.
3. Sačuvajte kao `sifarnik-2026-10-11.<xlsx|csv|pdf>`.

**Uspelo je ako:** u fajlu se vide **šifra, naziv i jedinica mere** za artikle
koji nikad nisu fakturisani. Zapišite i: postoji li kolona grupe i da li je
popunjena (u lageru je svuda `00`); da li postoje pakovanje i EAN.

## 4. Uzorak zaliha (15–20 min)

1. Izveštaj **„Stanje zaliha“**, objekat **021 VELEPRODAJA**.
2. U pregledu štampe potražite izvoz u **XLSX/CSV**; ako ga nema — PDF.
3. Sačuvajte kao `zalihe-2026-10-11.<xlsx|pdf>`; ako postoji izveštaj sa
   „rezervisano/raspoloživo“, sačuvajte i njega.

**Uspelo je ako:** fajl ima šifru i količinu po artiklu, i zapisano je „XLSX
postoji: da/ne“ i „rezervisano postoji: da/ne“.

## 5. Otvorene stavke sa dospećima (20–30 min)

1. Izveštaj otvorenih stavki kupaca (IOS / analitička kartica / dugovanja po kupcima).
2. Izvezite **uzorak**: ceo spisak na danas, ili 2–3 kupca ako je velik.
3. Sačuvajte kao `otvorene-stavke-2026-10-11.<xlsx|pdf>`.

**Uspelo je ako:** po stavci se vide **broj računa, iznos, datum dospeća i
uplaćeno/otvoreno**. Ako izveštaj nema dospeće — zapišite koji izveštaj ga ima.

---

**Šta mi javiti:** vreme pokretanja `run-once`; spisak sačuvanih fajlova; odgovori
„da/ne“ iz koraka 2–5. Fajlove sa USB-a kopirajte na Mac u
`~/.carsystem-private/izvozi-2026-10-11/` (van repoa).
