/** Tekst za kancelariju za kodove grešaka i upozorenja parsera lagera (dok. 65). */
export const STOCK_PROBLEM_LABELS = Object.freeze({
  prazan_fajl: "Fajl je prazan.",
  fajl_prevelik: "Fajl je prevelik.",
  xlsx_neispravan: "Excel fajl nije ispravan.",
  csv_neispravan: "CSV fajl nije ispravan.",
  vise_listova_sa_izvestajem: "Više listova liči na izveštaj — otpremite izvoz sa jednim listom.",
  nije_stanje_zaliha: "Ovo nije izveštaj „Stanje zaliha“ iz BizniSofta.",
  nema_datuma_stanja: "U izveštaju nije pronađen datum „Na dan:“.",
  nema_poslovnog_objekta: "U izveštaju nije pronađen poslovni objekat.",
  vise_poslovnih_objekata: "Izveštaj obuhvata više poslovnih objekata — potreban je samo 021 VELEPRODAJA.",
  pogresan_poslovni_objekat: "Izveštaj nije za poslovni objekat 021 VELEPRODAJA.",
  nema_zaglavlja_tabele: "Nije pronađeno zaglavlje tabele (Šifra, Količina).",
  zaglavlje_promenjeno: "Zaglavlje tabele se menja između strana.",
  previse_neprepoznatih_redova: "Previše redova nije prepoznato kao artikal.",
  kolicina_u_vise_kolona: "Količina se pojavljuje u više kolona istog reda.",
  sifra_nije_ceo_broj: "Šifra artikla nije ceo broj.",
  mesoviti_decimalni_separator: "U fajlu se mešaju decimalni zarez i decimalna tačka.",
  dvosmislen_broj: "Količina je dvosmislena (npr. 1.234 — hiljade ili decimale).",
  neispravan_broj: "Količina nije broj.",
  dupla_sifra: "Ista šifra se pojavljuje dvaput.",
  sudar_sifara: "Dve šifre se razlikuju samo po vodećim nulama.",
  nema_artikala: "U izveštaju nema nijednog artikla.",
  nedostaju_strane: "Nedostaju strane izveštaja.",
  pdf_neispravan: "PDF fajl nije moguće pročitati.",
  pdf_bez_teksta: "PDF nema tekst (verovatno je skeniran). Izvezite izveštaj iz BizniSofta kao PDF sa tekstom ili kao XLSX.",
  pdf_previse_strana: "PDF ima previše strana za izveštaj lagera.",
  pdf_raspored_bez_uzorka: "Ovaj raspored PDF izveštaja još nije podržan. Otpremite XLSX ili PDF „Stanje zaliha artikla“ ili „Zbirni pregled po artiklima“.",
  pdf_red_nepotpun: "Red u PDF-u nema sve kolone (ulaz, izlaz, stanje…).",
  pdf_kolona_nejasna: "Broj u PDF-u nije jasno u jednoj koloni — uvoz se ne prihvata.",
  pdf_ulaz_izlaz_stanje: "Kod nekih redova ulaz − izlaz nije jednako stanju.",
  prethodno_stanje_nije_nula: "„Prethodno stanje“ nije nula — izvezite pregled od početka godine (01.01.).",
  isti_sadrzaj: "Isti sadržaj (objekat, datum stanja i stavke) već postoji u drugom fajlu.",
  kontrolni_zbir_ne_odgovara: "Zbir vrednosti stavki ne odgovara redu „Ukupno“ — fajl je verovatno nepotpun.",
  // upozorenja
  naslov_drugaciji: "Naslov izveštaja nije tačno „STANJE ZALIHA“.",
  nema_kolone_naziv: "Nema kolone sa nazivom artikla.",
  neprepoznati_redovi: "Neki redovi nisu prepoznati kao artikal i preskočeni su.",
  prazne_kolicine: "Neke stavke imaju praznu količinu — ne tumače se kao nula.",
  negativne_kolicine: "Neke stavke imaju negativnu količinu — sačuvane su kao nalaz za proveru.",
  sifre_kao_brojevi: "Šifre su u Excel-u zapisane kao brojevi (vodeće nule nisu u fajlu); veza ide preko šifre bez vodećih nula.",
  nema_zbirnog_reda: "Nema reda „Ukupno stanje zaliha“ — potpunost se ne može proveriti zbirom.",
  kontrolni_zbir_nije_moguc: "Kontrolni zbir nije mogao da se proveri.",
  nedostaje_jm: "Neke stavke nemaju jedinicu mere u izveštaju.",
  jm_razlikuje_od_potvrde: "Kod nekih stavki JM iz izveštaja se razlikuje od potvrđenog pakovanja — za njih nema broja pakovanja dok se ne proveri.",
  pdf_samo_artikli_sa_prometom: "PDF „Zbirni pregled po artiklima“ navodi samo artikle sa prometom u periodu; artikli koji nisu navedeni nisu nula, nego nepoznato.",
  kolicina_puta_cena_odstupa: "Kod nekih redova količina × cena ne daje vrednost iz izveštaja (zaokruživanje ili pomerena kolona).",
});

export function stockProblemText(p) {
  const base = STOCK_PROBLEM_LABELS[p?.code] ?? p?.code ?? "nepoznato";
  const extra = [p?.count ? `${p.count}×` : "", p?.row ? `red ${p.row}` : "", p?.detail ? String(p.detail) : ""].filter(Boolean).join(" · ");
  return extra ? `${base} (${extra})` : base;
}
