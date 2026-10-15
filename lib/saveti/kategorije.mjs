/**
 * Tematske celine rubrike „Saveti i vodiči“.
 *
 * Redosled je redosled prikaza. `novosti` je posebna kategorija: ima sopstvenu
 * stranicu (/vodici/novosti) i članci u njoj su tipa „novost“, sa datumom
 * događaja i rokom važenja provere.
 */

export const SAVETI_KATEGORIJE = [
  {
    slug: "novosti",
    naziv: "Novosti",
    opis: "Proverene novosti proizvođača iz našeg programa, sa datumom događaja i napomenom o dostupnosti u Srbiji.",
  },
  {
    slug: "osnove",
    naziv: "Osnove auto lakiranja",
    opis: "Pojmovi i redosled slojeva u reparaturnom lakiranju, objašnjeni za početnike i one koji žele da provere znanje.",
  },
  {
    slug: "priprema-povrsine",
    naziv: "Priprema površine",
    opis: "Procena oštećenja, odmašćivanje, priprema lima, plastike i starog laka pre nanošenja materijala.",
  },
  {
    slug: "korozija",
    naziv: "Korozija i podloge",
    opis: "Kako se korozija prepoznaje i uklanja i kako se bira zaštita za čelik, pocinkovani lim i aluminijum.",
  },
  {
    slug: "kitovi-i-punioci",
    naziv: "Kitovi, prajmeri i punioci",
    opis: "Kada se koristi kit, kada prajmer, a kada punilac, i kako se slojevi podloge pravilno slažu.",
  },
  {
    slug: "brusenje-i-abrazivi",
    naziv: "Brušenje i abrazivi",
    opis: "Granulacije, redosled brušenja, diskovi, podloge i ručno i mašinsko brušenje.",
  },
  {
    slug: "boje-i-nijanse",
    naziv: "Bazne boje i nijanse",
    opis: "Bazne boje, utvrđivanje nijanse, metalik i biserni efekti, probni limovi i prelazi.",
  },
  {
    slug: "lakovi",
    naziv: "Bezbojni lakovi i direktni sjaj",
    opis: "Izbor i nanošenje bezbojnog laka, jednoslojni sistemi sa direktnim sjajem i tipične razlike među lakovima.",
  },
  {
    slug: "ucvrscivaci-i-razredjivaci",
    naziv: "Učvršćivači i razređivači",
    opis: "Odnos mešanja, vreme upotrebljivosti smeše, izbor učvršćivača i razređivača i kompatibilnost sistema.",
  },
  {
    slug: "uslovi-i-susenje",
    naziv: "Uslovi rada i sušenje",
    opis: "Temperatura, vlažnost, odzračivanje između slojeva, sušenje u kabini i infracrveno sušenje.",
  },
  {
    slug: "oprema-i-pistolji",
    naziv: "Pištolji i oprema",
    opis: "Izbor, podešavanje, čišćenje i održavanje pištolja za lakiranje i prateće opreme.",
  },
  {
    slug: "maskiranje",
    naziv: "Maskiranje",
    opis: "Folije, papiri, trake i postupci maskiranja koji čuvaju susedne površine i daju čiste ivice.",
  },
  {
    slug: "greske-pri-lakiranju",
    naziv: "Greške pri lakiranju",
    opis: "Kako izgleda greška, šta je može izazvati i kako se uzrok proverava pre sanacije.",
  },
  {
    slug: "poliranje",
    naziv: "Poliranje i završna obrada",
    opis: "Uklanjanje sitnih grešaka, izbor pasta i sunđera, mašinsko poliranje i nega laka.",
  },
  {
    slug: "zastita-na-radu",
    naziv: "Zaštita na radu",
    opis: "Lična zaštitna oprema, rad sa rastvaračima i izocijanatima, ventilacija i bezbedno skladištenje.",
  },
  {
    slug: "radionica",
    naziv: "Organizacija radionice",
    opis: "Planiranje posla, manje rasipanja materijala, otpad i skladištenje u autolakirerskoj radionici.",
  },
  {
    slug: "tehnicka-dokumentacija",
    naziv: "Tehnički i bezbednosni listovi",
    opis: "Kako se čitaju tehnički i bezbednosni listovi i šta koji podatak znači za rad.",
  },
  {
    slug: "sprejevi",
    naziv: "Boje u spreju",
    opis: "Rad sa bojama i lakovima u spreju za manje popravke, delove i hobi projekte.",
  },
];

export const SAVETI_KATEGORIJA_SLUGS = SAVETI_KATEGORIJE.map((category) => category.slug);

export function getSavetiKategorija(slug) {
  return SAVETI_KATEGORIJE.find((category) => category.slug === slug);
}

/** Tipovi članaka. */
export const SAVETI_TIPOVI = {
  novost: "Novost",
  "osnovni-vodic": "Osnovni vodič",
  postupak: "Postupak",
  "resavanje-problema": "Rešavanje problema",
};

/** Putanje koje su zauzete pod /vodici i ne smeju biti slug članka. */
export const SAVETI_REZERVISANI_SLUGOVI = new Set(["novosti", "kategorije", "feed", "pretraga", "strana"]);

export const MIN_RECI_PO_TIPU = {
  novost: 140,
  "osnovni-vodic": 450,
  postupak: 350,
  "resavanje-problema": 350,
};
