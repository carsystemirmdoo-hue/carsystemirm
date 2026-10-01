# Neproverene lokacije — plan naknadne provere

Odluka vlasnika (2026-10-01, `docs/CONTENT_GAPS_REQUIRING_OWNER_INPUT.md` GAP-003): javni lokator prikazuje samo 9 lokacija sa `verificationStatus: "verified"`. Ovih 82 zapisa sa statusom `pending` potiču iz BEX kontakata za isporuku; ostaju u `data/store-locations.json`, ali se **ne prikazuju** kao prodavnice ni partneri (`isPubliclyListedStore` u `lib/partner-stores.ts`).

Provera ne blokira otvaranje sajta. Lokacija postaje javna tek kada se u izvoru postavi `verificationStatus: "verified"` na osnovu dokumentovane provere.

## Šta se proverava za svaku lokaciju

1. **Firma postoji javno** — registar (APR) ili zvaničan sajt/profil.
2. **Aktuelna adresa** — poklapa se sa adresom iz BEX-a.
3. **Delatnost** — prodaja auto boja/lakova, lakirnica ili servis.
4. **Telefon** — javni broj firme (ne lični broj iz BEX-a).
5. **Dokaz partnerstva** — potvrda firme ili dokument da je lokacija Carsystem/R-M partner i da pristaje da bude javno navedena.

Kolone za proveru su prazne (`—`) dok ih neko ne popuni sa izvorom.

## Spisak (82)

| # | ID u izvoru | Naziv (BEX) | Adresa (BEX) | Grad | Tip | Koordinate | Firma postoji | Adresa aktuelna | Delatnost | Telefon | Dokaz partnerstva | Odluka |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `preview-spektar-mol-ada` | Spektar Mol | ADA. LENJINOVA 10 | ADA | partner | geocoded_preview | — | — | — | — | — | — |
| 2 | `preview-aron-nagy-pr-nadj-adorjan` | ARON NAGY PR NAĐ | ADORJAN. PALA PAPA 7 | ADORJAN | partner | approximate | — | — | — | — | — | — |
| 3 | `preview-demix-pro-aleksinac` | DEMIX-PRO | ALEKSINAC. DUSANA TRIVUNCA 27 | ALEKSINAC | partner | geocoded_preview | — | — | — | — | — | — |
| 4 | `preview-boja-vin-lsv-arandjelovac` | BOJA VIN LSV | ARANĐELOVAC. KRALJA PETRA PRVOG (1.) 87A | ARANĐELOVAC | partner | approximate | — | — | — | — | — | — |
| 5 | `preview-color-gms-arilje` | COLOR GMS | ARILJE. HEROJA SOSE 9 | ARILJE | partner | geocoded_preview | — | — | — | — | — | — |
| 6 | `preview-stefan-d-o-o-arilje` | Stefan D.O.O. | ARILJE. PUT DVADESETDRUGOG (22.) AVGUSTA 0 | ARILJE | partner | approximate | — | — | — | — | — | — |
| 7 | `preview-sjaj-plus-backa-palanka` | Sjaj Plus | BACKA PALANKA. VESELINA MASLESE 27 | BACKA PALANKA | partner | geocoded_preview | — | — | — | — | — | — |
| 8 | `preview-bel-kolor-bela-crkva` | Bel Kolor | BELA CRKVA. SONJE MARINKOVIC 2 | BELA CRKVA | partner | geocoded_preview | — | — | — | — | — | — |
| 9 | `preview-autolomar-djermanovic-belosevac` | AUTOLOMAR ĐERMANOVIC | BELOSEVAC. BELOSEVAC 0 | BELOSEVAC | partner | approximate | — | — | — | — | — | — |
| 10 | `preview-master-mix-doo-beograd-cukarica` | MASTER MIX DOO | BEOGRAD-CUKARICA. ILIJE ĐURICICA 30 | BEOGRAD-CUKARICA | partner | geocoded_preview | — | — | — | — | — | — |
| 11 | `preview-modena-beograd-palilula` | Modena | BEOGRAD-PALILULA. SUTJESKA ULICA 8 50/P | BEOGRAD-PALILULA | partner | approximate | — | — | — | — | — | — |
| 12 | `preview-color-planet-beograd-vozdovac` | Color Planet | BEOGRAD-VOZDOVAC. STOJANA LJUBICA 8 | BEOGRAD-VOZDOVAC | partner | approximate | — | — | — | — | — | — |
| 13 | `preview-favorit-beograd-vozdovac` | FAVORIT | BEOGRAD-VOZDOVAC. VOJVODE STEPE 546 | BEOGRAD-VOZDOVAC | partner | geocoded_preview | — | — | — | — | — | — |
| 14 | `preview-merlin-centar-d-o-o-beograd-vozdovac` | MERLIN CENTAR d.o.o. | BEOGRAD-VOZDOVAC. TABANOVACKA 5 | BEOGRAD-VOZDOVAC | partner | geocoded_preview | — | — | — | — | — | — |
| 15 | `preview-sara-beograd-zemun` | Sara | BEOGRAD-ZEMUN. VASE LAZAREVICA 1 | BEOGRAD-ZEMUN | partner | geocoded_preview | — | — | — | — | — | — |
| 16 | `preview-astra-decor-beograd-zvezdara` | Astra Decor | BEOGRAD-ZVEZDARA. KACICEVA 49 | BEOGRAD-ZVEZDARA | partner | geocoded_preview | — | — | — | — | — | — |
| 17 | `preview-ng-autoline-beograd-zvezdara` | NG AUTOLINE | BEOGRAD-ZVEZDARA. MILUTINA STANOJEVICA 12 | BEOGRAD-ZVEZDARA | partner | geocoded_preview | — | — | — | — | — | — |
| 18 | `preview-stojiljkovic-od-bor` | stojiljkovic od | BOR. NIKOLE PASICA 14 | BOR | partner | geocoded_preview | — | — | — | — | — | — |
| 19 | `preview-ino-gmd-ton-borca` | Ino GMD Ton | BORCA. JNA 95 | BORCA | partner | geocoded_preview | — | — | — | — | — | — |
| 20 | `preview-morsad-d-o-o-bozurnja` | MORSAD d.o.o. | BOZURNJA. PUT ZA METERIZE 36 | BOZURNJA | partner | approximate | — | — | — | — | — | — |
| 21 | `preview-pr-proka-cuprija` | PR PROKA | CUPRIJA. CARA LAZARA 0 | CUPRIJA | partner | approximate | — | — | — | — | — | — |
| 22 | `preview-jugocolor-futog` | Jugocolor | FUTOG. CARA LAZARA 226 | FUTOG | partner | geocoded_preview | — | — | — | — | — | — |
| 23 | `preview-autounion-gornji-matejevac` | Autounion | GORNJI MATEJEVAC. VOJVODE PUTNIKA BB | GORNJI MATEJEVAC | partner | approximate | — | — | — | — | — | — |
| 24 | `preview-auto-kolor-gornji-milanovac` | Auto Kolor | GORNJI MILANOVAC. MIODRAGA RADOVANOVICA KORCAGINA 2 | GORNJI MILANOVAC | partner | approximate | — | — | — | — | — | — |
| 25 | `preview-aleksandar-topola-gorovic` | Aleksandar Topola | GOROVIC. CUKOVAC BB | GOROVIC | partner | approximate | — | — | — | — | — | — |
| 26 | `preview-car-system-i-r-m-d-o-o-indjija-indjija` | Car system I R-M d.o.o. Indjija | INĐIJA. IVE ANDRICA 3 | INĐIJA | partner | geocoded_preview | — | — | — | — | — | Sama firma (centrala) — prikazuje se kao centrala na `/kontakt` i početnoj, ne kao partner. |
| 27 | `preview-tehnohem-mix-ivanjica` | TEHNOHEM MIX | IVANJICA. MILOJICE NIKOLICA 47 | IVANJICA | partner | geocoded_preview | — | — | — | — | — | — |
| 28 | `preview-auto-centar-pejic-doo-kikinda` | AUTO CENTAR PEJIC DOO | KIKINDA. KRALJEVICA MARKA 179 | KIKINDA | partner | geocoded_preview | — | — | — | — | — | — |
| 29 | `preview-toma-kladovo` | Toma | KLADOVO. OBILICEVA 26 | KLADOVO | partner | geocoded_preview | — | — | — | — | — | — |
| 30 | `preview-auto-servis-tomasik-kovacica` | AUTO SERVIS TOMASIK | KOVACICA. SAFARIKOVA 8 | KOVACICA | partner | geocoded_preview | — | — | — | — | — | — |
| 31 | `preview-color-queens-kragujevac-aerodrom` | COLOR QUEENS | KRAGUJEVAC-AERODROM. BEOGRADSKA 52 | KRAGUJEVAC-AERODROM | partner | geocoded_preview | — | — | — | — | — | — |
| 32 | `preview-t-m-color-kragujevac-centar` | T & M - COLOR | KRAGUJEVAC-CENTAR. KNEZA MIHAILA 190 | KRAGUJEVAC-CENTAR | partner | approximate | — | — | — | — | — | — |
| 33 | `preview-tim-color-kragujevac-centar` | TIM Color | KRAGUJEVAC-CENTAR. KNEZA MIHAILA 190 | KRAGUJEVAC-CENTAR | partner | approximate | — | — | — | — | — | — |
| 34 | `preview-mondust-metalik-kragujevac-pivara` | MONDUST METALIK | KRAGUJEVAC-PIVARA. DRAGOSLAVA SREJOVICA 33 | KRAGUJEVAC-PIVARA | partner | geocoded_preview | — | — | — | — | — | — |
| 35 | `preview-trijumf-kolor-kraljevo` | Trijumf Kolor | KRALJEVO. CARA LAZARA 83 | KRALJEVO | partner | geocoded_preview | — | — | — | — | — | — |
| 36 | `preview-color-system-krusevac` | Color System | KRUSEVAC. DOSTOJEVSKOG 50 | KRUSEVAC | partner | geocoded_preview | — | — | — | — | — | — |
| 37 | `preview-feromont-m-krusevac` | FEROMONT-M | KRUSEVAC. JUG BOGDANOVA 17 | KRUSEVAC | partner | geocoded_preview | — | — | — | — | — | — |
| 38 | `preview-metal-boja-leskovac` | Metal Boja | LESKOVAC. BULEVAR NIKOLE PASICA 60 | LESKOVAC | partner | geocoded_preview | — | — | — | — | — | — |
| 39 | `preview-profi-mix-leskovac` | Profi Mix | LESKOVAC. JUZNOMORAVSKIH BRIGADA 3 | LESKOVAC | partner | geocoded_preview | — | — | — | — | — | — |
| 40 | `preview-ivan-janjic-ljubic` | Ivan Janjic | LJUBIC. SAJMISTE 0 | LJUBIC | partner | approximate | — | — | — | — | — | — |
| 41 | `preview-pr-janjo-prom-ljubic` | PR JANJO-PROM | LJUBIC. SAJMISTE 0 | LJUBIC | partner | approximate | — | — | — | — | — | — |
| 42 | `preview-vm-tim-maki-nis-crveni-krst` | VM TIM Maki | NIS-CRVENI KRST. BULEVAR DVANAESTI (12.) FEBRUAR 15 | NIS-CRVENI KRST | partner | geocoded_preview | — | — | — | — | — | — |
| 43 | `preview-dms-nikolic-nis-medijana` | DMS NIKOLIC | NIS-MEDIJANA. KRALJA STEVANA PRVOVENCANOG 9 | NIS-MEDIJANA | partner | approximate | — | — | — | — | — | — |
| 44 | `preview-happy-colors-nis-medijana` | Happy Colors | NIS-MEDIJANA. CARA DUSANA 82 | NIS-MEDIJANA | partner | geocoded_preview | — | — | — | — | — | — |
| 45 | `preview-autounion-d-o-o-nis-palilula` | AUTOUNION D.O.O. | NIS-PALILULA. VOJVODE PUTNIKA 0/bb | NIS-PALILULA | partner | approximate | — | — | — | — | — | — |
| 46 | `preview-auto-centar-saja-novi-pazar` | AUTO CENTAR SAJA | NOVI PAZAR. CAMILA SIJARICA 3 | NOVI PAZAR | partner | geocoded_preview | — | — | — | — | — | — |
| 47 | `preview-autolak-centar-mumdzic-novi-pazar` | autolak centar mumdzic | NOVI PAZAR. BORSKI KEJ 7 | NOVI PAZAR | partner | geocoded_preview | — | — | — | — | — | — |
| 48 | `preview-ap-sasa-bozic-obrenovac` | AP SASA BOZIC | OBRENOVAC. BELOPOLJSKA 5 | OBRENOVAC | partner | geocoded_preview | — | — | — | — | — | — |
| 49 | `preview-max-color-bt-pakasnica` | MAX COLOR BT | PAKASNICA. LIPLJANSKA 6 | PAKASNICA | partner | geocoded_preview | — | — | — | — | — | — |
| 50 | `preview-autobill-palic` | AutoBill | PALIC. JOSIPA KOLUMBA 4 | PALIC | partner | geocoded_preview | — | — | — | — | — | — |
| 51 | `preview-antonijev-pancevo` | Antonijev | PANCEVO. IVE KURJACKOG 24 | PANCEVO | partner | geocoded_preview | — | — | — | — | — | — |
| 52 | `preview-duga-commerce-paracin` | DUGA COMMERCE | PARACIN. VOZDA KARAĐORĐA 88 | PARACIN | partner | geocoded_preview | — | — | — | — | — | — |
| 53 | `preview-bojalik-d-o-o-pinosava` | BOJALIK d.o.o. | PINOSAVA. NOVA 3 125 | PINOSAVA | partner | approximate | — | — | — | — | — | — |
| 54 | `preview-bmc-boja-mix-pozarevac` | BMC Boja Mix | POZAREVAC. RATARSKA 88 | POZAREVAC | partner | geocoded_preview | — | — | — | — | — | — |
| 55 | `preview-cikaric-d-o-o-pozega` | CIKARIC d.o.o. | POZEGA. KNJAZA MILOSA 62 | POZEGA | partner | geocoded_preview | — | — | — | — | — | — |
| 56 | `preview-tinta-boje-pozega` | Tinta boje | POZEGA. NEMANJINA 10 | POZEGA | partner | geocoded_preview | — | — | — | — | — | — |
| 57 | `preview-auto-kolor-prijepolje` | AUTO KOLOR | PRIJEPOLJE. BRANKA RADICEVICA 0 | PRIJEPOLJE | partner | approximate | — | — | — | — | — | — |
| 58 | `preview-bojaton-d-o-o-sabac` | BOJATON d.o.o. | SABAC. BORIVOJA MILIVOJEVICA 8 | SABAC | partner | geocoded_preview | — | — | — | — | — | — |
| 59 | `preview-kolor-tapet-sabac` | Kolor Tapet | SABAC. POP LUKINA 36 | SABAC | partner | geocoded_preview | — | — | — | — | — | — |
| 60 | `preview-agrar-simanovci` | Agrar | SIMANOVCI. PRHOVACKA 129 | SIMANOVCI | partner | geocoded_preview | — | — | — | — | — | — |
| 61 | `preview-colorex-026-smederevo` | Colorex 026 | SMEDEREVO. KNEZ MIHAJLOVA 86 | SMEDEREVO | partner | approximate | — | — | — | — | — | — |
| 62 | `preview-gloss-smederevo` | Gloss | SMEDEREVO. SESNAESTOG (16.) OKTOBRA 55 | SMEDEREVO | partner | geocoded_preview | — | — | — | — | — | — |
| 63 | `preview-as-zmijanjac-sopot` | AS ZMIJANJAC | SOPOT. MILOSAVA VLAJICA 49 | SOPOT | partner | geocoded_preview | — | — | — | — | — | — |
| 64 | `preview-spektar-mb-sremska-mitrovica` | SPEKTAR MB | SREMSKA MITROVICA. TARASA SEVCENKA 71 | SREMSKA MITROVICA | partner | geocoded_preview | — | — | — | — | — | — |
| 65 | `preview-auto-car-vidakovic-d-o-o-subotica` | AUTO CAR VIDAKOVIC d.o.o. | SUBOTICA. STARINE NOVAKA 53 | SUBOTICA | partner | geocoded_preview | — | — | — | — | — | — |
| 66 | `preview-delta-spektra-subotica` | DELTA SPEKTRA | SUBOTICA. SOMBORSKI PUT 32 | SUBOTICA | partner | geocoded_preview | — | — | — | — | — | — |
| 67 | `preview-trgo-chem-d-o-o-subotica` | TRGO-CHEM D.O.O. | SUBOTICA. JOVANA MIKICA 24 | SUBOTICA | partner | geocoded_preview | — | — | — | — | — | — |
| 68 | `preview-perla-d-o-o-uzice` | PERLA d.o.o. | UZICE. UZICKE REPUBLIKE 60 | UZICE | partner | geocoded_preview | — | — | — | — | — | — |
| 69 | `preview-auto-centar-buca-valjevo` | AUTO CENTAR-BUCA | VALJEVO. SABACKI PUT 0 | VALJEVO | partner | approximate | — | — | — | — | — | — |
| 70 | `preview-farbarica-014-d-o-o-valjevo` | FARBARICA 014 d.o.o. | VALJEVO. DOKTORA PANTICA 14 | VALJEVO | partner | geocoded_preview | — | — | — | — | — | — |
| 71 | `preview-ptp-moler-valjevo` | PTP Moler | VALJEVO. DOKTORA PANTICA 132 | VALJEVO | partner | geocoded_preview | — | — | — | — | — | — |
| 72 | `preview-tesic-kolor-valjevo` | TESIC KOLOR | VALJEVO. ALEKSANDRA MARKOVICA 4 | VALJEVO | partner | geocoded_preview | — | — | — | — | — | — |
| 73 | `preview-pr-gavra-v-vlasotince` | PR GAVRA V | VLASOTINCE. MILENTIJA POPOVICA 80 | VLASOTINCE | partner | geocoded_preview | — | — | — | — | — | — |
| 74 | `preview-noke-o-d-vranje` | NOKE o.d. | VRANJE. MAJORA MILANA TEPICA 0 | VRANJE | partner | approximate | — | — | — | — | — | — |
| 75 | `preview-bnp-vrcin` | BNP | VRCIN. BEOGRADSKA 62 | VRCIN | partner | geocoded_preview | — | — | — | — | — | — |
| 76 | `preview-bnp-marinkovic-vrcin` | BNP MARINKOVIC | VRCIN. BEOGRADSKA 62 | VRCIN | partner | geocoded_preview | — | — | — | — | — | — |
| 77 | `preview-autolimar-mars-zabrdje` | AUTOLIMAR MARS | ZABRĐE. ZABRĐE 0 | ZABRĐE | partner | approximate | — | — | — | — | — | — |
| 78 | `preview-nicic-servis-zitoradje` | NICIC SERVIS | ZITORAĐE. MAHALA ĐURIC BB | ZITORAĐE | partner | approximate | — | — | — | — | — | — |
| 79 | `preview-mateja-023-zrenjanin` | MATEJA 023 | ZRENJANIN. RADNICKA 3 | ZRENJANIN | partner | geocoded_preview | — | — | — | — | — | — |
| 80 | `preview-stanisic-zrenjanin` | Stanisic | ZRENJANIN. BACKA 4 | ZRENJANIN | partner | geocoded_preview | — | — | — | — | — | — |
| 81 | `preview-vukonjanski-zrenjanin` | vukonjanski | ZRENJANIN. ELEMIRSKI PUT 0 | ZRENJANIN | partner | approximate | — | — | — | — | — | — |
| 82 | `preview-auto-kuca-vesic-d-o-o-zvecka` | AUTO KUCA VESIC d.o.o. | ZVECKA. BRACE JOKSICA 201 | ZVECKA | partner | geocoded_preview | — | — | — | — | — | — |
