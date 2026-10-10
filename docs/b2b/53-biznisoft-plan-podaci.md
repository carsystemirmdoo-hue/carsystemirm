# 53 — BizniSoft: plan podataka (zalihe, rezervacije, grupe, pakovanja)

Status: **samo plan** (10. 10. 2026). Nema kupovine, povezivanja sa živom bazom ni nove implementacije dok rabati nisu razjašnjeni. Ništa se ne upisuje u BizniSoft.

## Šta danas postoji (potvrđeno)

| Izvor | Kako stiže | Šta portal uzima |
|---|---|---|
| Fakture (Račun-otpremnica) | PDF iz fascikle štampe → Windows konektor (KANC-01, radnim danima) | šifra, naziv, JM, količina, cena bez PDV, rabat %, iznos; partner |
| „Stanje zaliha – nabavna i VP cena“ | PDF (FastReport), gazda otprema ručno | šifra, naziv, PDV, VP cena (nabavna i zaliha se odbacuju) |
| „Stanje zaliha“ (lager) | PDF (FastReport), dostavljen 23. 7. 2026 | šifra, kat. br., grupa, naziv, JM — kontrola čitanja prolazi (1.795 šifara) |
| Registar partnera | pripremljen XLSX | šifra, naziv, PIB… |

Nalazi iz lagera: kolona **GR.** postoji, ali je svuda `00` — grupe se u BizniSoftu ili ne vode, ili se ne štampaju u ovom izveštaju. Kolona **Kat. br.** postoji i delimično je popunjena. Izveštaj ima filtere *Vrsta artikla*, *Stanje artikla*, *Poslovni objekat* (021 VELEPRODAJA) i *Vrsta cene*.

Nepoznato: API, pristup bazi (ODBC/SQL), zakazani izvoz, izvoz u XLSX/CSV iz istih izveštaja, verzija programa.

## Šta je potrebno, po temi

**Zalihe** (za „ima / nema / na upit“, ne nužno tačan broj): šifra artikla · poslovni objekat/magacin · stanje · rezervisano · raspoloživo (= stanje − rezervisano) · datum i čas stanja. Osvežavanje: najmanje jednom dnevno; portal sakriva stanje starije od 24 h.

**Rezervacije:** broj dokumenta (predračun/porudžbina) · šifra kupca · šifra artikla · količina · datum i rok važenja · status. Potrebno da „raspoloživo“ ne obeća robu koja je već rezervisana.

**Grupe proizvoda:** šifarnik grupa (šifra, naziv, nadgrupa) i veza artikal → grupa. Tek tada rabat po grupi može biti pravilo nad BizniSoft grupom; do tada su grupe u portalu „izvedene iz faktura kupca“ i nisu BizniSoft grupe.

**Pakovanja:** po artiklu: JM prodaje · količina u pakovanju (npr. 4 LIT) · JM pakovanja · EAN/bar-kod · kat. br. proizvođača. Bez potvrđene količine pakovanja portal ne računa cenu pakovanja (cena ostaje po JM).

**Rabati kupaca (za proveru, ne za uvoz bez odluke):** gde BizniSoft čuva uslove (po kupcu, grupi, artiklu), i da li postoji izveštaj/tabela uslova. Portal danas izvodi rabate iz faktura i vodi ih kroz odobravanje.

## Redosled (predlog, bez obaveze)

1. **Izvoz postojećih izveštaja u XLSX/CSV** umesto PDF-a (ako FastReport u BizniSoftu to nudi) — isti sadržaj, pouzdanije čitanje.
2. **Šifarnik artikala sa JM, grupom i pakovanjem** — jednokratno, pa po promeni.
3. **Lager sa rezervacijama** po objektu — dnevno, kroz postojeći konektor (fascikla), bez pristupa bazi.
4. Pristup bazi samo za čitanje ili API — tek kada 1–3 nisu dovoljni i uz pisanu saglasnost proizvođača; nikad upis.

## Pitanja za ponedeljak (BizniSoft / kancelarija)

1. Da li izveštaji „Stanje zaliha“ i „Stanje zaliha – nabavna i VP cena“ mogu da se izvezu u XLSX ili CSV (ne samo PDF)? Koji je kodni raspored i decimalni separator?
2. Da li postoji zakazani (automatski) izvoz u fasciklu, npr. svako jutro?
3. Da li BizniSoft vodi **grupe artikala**? Zašto je u lageru GR. = 00 — nisu unete ili izveštaj ne prikazuje grupu? Postoji li izveštaj šifarnika sa grupom?
4. Gde se vodi **količina u pakovanju** i EAN? Može li ući u izvoz šifarnika?
5. Da li postoje **rezervacije** (predračuni/porudžbine koje umanjuju raspoloživo)? Postoji li izveštaj „raspoloživo = stanje − rezervisano“ po objektu?
6. Koliko poslovnih objekata/magacina ima, i koji je merodavan za veleprodaju (021)?
7. Gde se čuvaju **rabati kupaca** (po kupcu, grupi, artiklu) i postoji li izveštaj uslova kupca?
8. Postoji li API ili pristup bazi samo za čitanje, i pod kojim uslovima (licenca, trošak, saglasnost)? — samo informacija, bez odluke.
9. Može li BizniSoft da uveze porudžbinu/predračun iz fajla (format)? — samo informacija.
10. Ko u kancelariji pokreće izvoz i koliko često je realno?
