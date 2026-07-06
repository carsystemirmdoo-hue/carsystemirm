export type PartnerLocationType = "partner" | "prodajno-mesto" | "servis" | "distributer";
export type PartnerLocationDataStatus = "confirmed" | "incomplete" | "placeholder";

export type PartnerStore = {
  id: string;
  partnerId?: string;
  isPublic: boolean;
  dataStatus: PartnerLocationDataStatus;
  dataNote: string;
  sourceUrl?: string;
  name: string;
  city: string;
  canonicalCity?: string;
  region: string;
  address: string;
  phone: string;
  email?: string;
  workingHours: string;
  brands: string[];
  programs: string[];
  coordinates?: {
    lat: number;
    lng: number;
  };
  type: PartnerLocationType;
  locationTypeCapabilities?: PartnerLocationType[];
  mapPosition: {
    x: number;
    y: number;
  };
  description: string;
  featured?: boolean;
};

export const partnerStores: PartnerStore[] = [
  {
    id: "spektar-mb-sremska-mitrovica",
    isPublic: true,
    dataStatus: "confirmed",
    dataNote: "Auto boje; potvrđeno na zvaničnom sajtu firme.",
    sourceUrl: "https://spektarmb.com/prodajni-asortiman/",
    name: "Spektar MB",
    city: "Sremska Mitrovica",
    region: "Srem",
    address: "Miloša Obilića 35, 22000 Sremska Mitrovica",
    phone: "022 622 907 / 064 644 9 339",
    workingHours: "Pozovite za radno vreme",
    type: "prodajno-mesto",
    brands: [],
    programs: ["Prodajno mesto"],
    coordinates: { lat: 44.979577, lng: 19.6067663 },
    mapPosition: { x: 32, y: 42 },
    description: "Prodajno mesto za auto boje i prateći refinish program.",
  },
  {
    id: "intercolor-novi-sad",
    isPublic: true,
    dataStatus: "confirmed",
    dataNote: "Auto boje i lakovi; podaci potvrđeni u više poslovnih imenika.",
    sourceUrl: "https://www.planplus.rs/intercolor-auto-boje-i-lakovi/116352",
    name: "Intercolor",
    city: "Novi Sad",
    region: "Južna Bačka",
    address: "Partizanskih baza 4, 21137 Novi Sad",
    phone: "021 6402 853",
    workingHours: "Pozovite za radno vreme",
    type: "prodajno-mesto",
    brands: [],
    programs: ["Prodajno mesto"],
    coordinates: { lat: 45.2517594, lng: 19.8031672 },
    mapPosition: { x: 39, y: 30 },
    description: "Prodajno mesto za auto boje i lakove u Novom Sadu.",
  },
  {
    id: "vukonjanski-zrenjanin",
    isPublic: true,
    dataStatus: "confirmed",
    dataNote: "Održavanje i popravka motornih vozila.",
    sourceUrl:
      "https://www.companywall.rs/firma/zoran-vukonjanski-pr-servis-za-odrzavanje-i-popravka-motornih-vozila-vukonjanski-zrenjanin/MMtkhb5R",
    name: "Zoran Vukonjanski / Vukonjanski",
    city: "Zrenjanin",
    region: "Banat",
    address: "Elemirski put 13, 23101 Zrenjanin",
    phone: "060 644 6403",
    workingHours: "Pozovite za radno vreme",
    type: "servis",
    brands: [],
    programs: ["Servis"],
    coordinates: { lat: 45.4079876, lng: 20.3523777 },
    mapPosition: { x: 58, y: 28 },
    description: "Servis za održavanje i popravku motornih vozila.",
  },
  {
    id: "igor-automotive-beograd",
    isPublic: true,
    dataStatus: "confirmed",
    dataNote:
      "Trgovina auto bojama. Stariji direktorijumi navode Ustaničku 102; aktuelna registracija i diler-lista navode Grčića Milenka 73.",
    sourceUrl:
      "https://www.companywall.rs/firma/igor-radovic-pr-igor-automotive-beograd/MMkeEOnR",
    name: "Igor Automotive",
    city: "Beograd",
    region: "Beograd",
    address: "Grčića Milenka 73, 11000 Beograd",
    phone: "011 386 33 60 / 063 528 477",
    workingHours: "Pozovite za radno vreme",
    type: "prodajno-mesto",
    brands: [],
    programs: ["Prodajno mesto"],
    coordinates: { lat: 44.7840781, lng: 20.4860137 },
    mapPosition: { x: 55, y: 47 },
    description: "Prodajno mesto za auto boje u Beogradu.",
  },
  {
    id: "automotive-color-shop-batajnica",
    isPublic: true,
    dataStatus: "confirmed",
    dataNote: "Auto boje; adresa potvrđena i u registracionim podacima.",
    sourceUrl:
      "https://www.mojabatajnica.com/firme/batajnica-auto-boje-auto-boje-automotive-color-shop",
    name: "Automotive Color Shop",
    city: "Batajnica / Beograd",
    canonicalCity: "Beograd",
    region: "Beograd",
    address: "Majora Zorana Radosavljevića 108, 11080 Batajnica",
    phone: "011 450 75 92",
    workingHours: "Pozovite za radno vreme",
    type: "prodajno-mesto",
    brands: [],
    programs: ["Prodajno mesto"],
    coordinates: { lat: 44.9010783, lng: 20.2829458 },
    mapPosition: { x: 49, y: 40 },
    description: "Prodajno mesto za auto boje u Batajnici.",
  },
  {
    id: "markus-professional-nis",
    isPublic: true,
    dataStatus: "confirmed",
    dataNote:
      "Auto servis; farbanje, limarija i druge servisne usluge. Podaci sa zvaničnog sajta.",
    sourceUrl: "https://www.autoservismarkus.rs/contact.html",
    name: "Markus Professional",
    city: "Niš",
    region: "Nišavski okrug",
    address: "Dušana Životića 15, Niš (Čalije)",
    phone: "065 4141 421 / 018 571 172",
    workingHours: "Pozovite za radno vreme",
    type: "servis",
    brands: [],
    programs: ["Servis"],
    coordinates: { lat: 43.3331289, lng: 21.9447743 },
    mapPosition: { x: 70, y: 76 },
    description: "Servisna lokacija za limariju, farbanje i povezane usluge.",
  },
  {
    id: "vmtim-maki-nis",
    isPublic: true,
    dataStatus: "confirmed",
    dataNote:
      "Nađen i kao prodaja auto farbi i kao autolakirerska radionica na istoj lokaciji.",
    sourceUrl:
      "https://www.moja-delatnost.rs/auto-farbe-nis-crveni-krst/vmtim-maki-nis/MM1Ow5VJ",
    name: "VMTIM-MAKI Niš",
    city: "Niš",
    region: "Nišavski okrug",
    address: "Lelice Kostić 15, 18000 Niš",
    phone: "063 119 2771",
    workingHours: "Pozovite za radno vreme",
    type: "prodajno-mesto",
    locationTypeCapabilities: ["prodajno-mesto", "servis"],
    brands: [],
    programs: ["Prodajno mesto", "Servis"],
    coordinates: { lat: 43.344869, lng: 21.883094 },
    mapPosition: { x: 68, y: 75 },
    description: "Kombinovana lokacija za prodaju auto farbi i servisni rad.",
  },
  {
    id: "irko-novi-pazar",
    isPublic: true,
    dataStatus: "confirmed",
    dataNote: "Trgovina na malo bojama i srodnim materijalom.",
    sourceUrl:
      "https://www.kompanije.net/preduzetnici/p176849_STR-IRKO-LJAJI%C4%86-IRFAN-PREDUZETNIK-NOVI-PAZAR--ZMAJ-JOVINA-48.htm",
    name: "IRKO",
    city: "Novi Pazar",
    region: "Raška oblast",
    address: "Zmaj Jovina 48, 36300 Novi Pazar",
    phone: "020 381 919 / 063 611 512",
    workingHours: "Pozovite za radno vreme",
    type: "prodajno-mesto",
    brands: [],
    programs: ["Prodajno mesto"],
    coordinates: { lat: 43.1303828, lng: 20.5168764 },
    mapPosition: { x: 50, y: 82 },
    description: "Prodajno mesto za boje i srodni materijal u Novom Pazaru.",
  },
  {
    id: "bast-doo-novi-sad",
    isPublic: true,
    dataStatus: "confirmed",
    dataNote:
      "Prodavnica auto boja, lakova, alata i pratećeg materijala; navedena kao TOP diler.",
    sourceUrl: "https://touchup.rs/en/prodajna-mesta/",
    name: "BAST DOO",
    city: "Novi Sad",
    region: "Južna Bačka",
    address: "Temerinska 4, Novi Sad",
    phone: "021 553 993",
    workingHours: "Pozovite za radno vreme",
    type: "prodajno-mesto",
    brands: [],
    programs: ["Prodajno mesto"],
    coordinates: { lat: 45.2608852, lng: 19.8433522 },
    mapPosition: { x: 40, y: 29 },
    description: "Prodajno mesto za auto boje, lakove, alat i prateći materijal.",
  },
  {
    id: "autounion-nis",
    isPublic: false,
    dataStatus: "incomplete",
    dataNote:
      "Srpska Autounion lokacija (DOO AUTOUNION NIŠ, Vojvode Putnika bb, Palilula). Adresa je 'bb' pa tačna pozicija objekta nije potvrđena — bez koordinata dok se lokacija ne verifikuje. Ranija Trebinje (BiH) lokacija je uklonjena iz javne mreže.",
    sourceUrl: "https://www.kompanije.net/Srbija/autounion/9388",
    name: "Autounion",
    city: "Niš",
    region: "Nišavski okrug",
    address: "Vojvode Putnika bb, Niš",
    phone: "064 645 6000",
    workingHours: "Pozovite za radno vreme",
    type: "prodajno-mesto",
    brands: [],
    programs: ["Prodajno mesto"],
    mapPosition: { x: 69, y: 76 },
    description: "Prodajno mesto za delove i opremu za vozila u Nišu.",
  },
  {
    id: "indjija-central",
    isPublic: false,
    dataStatus: "incomplete",
    dataNote:
      "Realna poslovna lokacija nije potvrđena u repo-u: adresa i telefon su placeholder vrednosti.",
    name: "Carsystem i R-M Inđija",
    city: "Inđija",
    region: "Srem",
    address: "Partnerska lokacija, Inđija",
    phone: "+381 22 000 001",
    email: "office@carsystemirm.com",
    workingHours: "Pon-Pet 08:00-16:00",
    type: "distributer",
    brands: ["R-M", "Carsystem", "SATA", "Baslac"],
    programs: ["Boje i lakovi", "Priprema", "Oprema", "Potrošni materijal"],
    coordinates: { lat: 45.0482, lng: 20.0817 },
    mapPosition: { x: 46, y: 36 },
    description:
      "Centralna kontakt tačka za refinish program, tehničku podršku i rutiranje ka partnerskoj mreži.",
    featured: true,
  },
  {
    id: "novi-sad-partner",
    isPublic: false,
    dataStatus: "placeholder",
    dataNote: "Demo partner zapis: naziv, adresa i telefon nisu potvrđeni.",
    name: "Partner program Novi Sad",
    city: "Novi Sad",
    region: "Vojvodina",
    address: "Partnerska lokacija, Novi Sad",
    phone: "+381 21 000 002",
    workingHours: "Pon-Pet 08:00-17:00",
    type: "prodajno-mesto",
    brands: ["R-M", "Carsystem", "Baslac"],
    programs: ["Boje i lakovi", "Priprema", "Abrazivi"],
    coordinates: { lat: 45.2671, lng: 19.8335 },
    mapPosition: { x: 39, y: 29 },
    description:
      "Regionalna podrška za radionice u Južnoj Bačkoj i okolnim mestima.",
  },
  {
    id: "beograd-partner",
    isPublic: false,
    dataStatus: "placeholder",
    dataNote: "Demo partner zapis: naziv, adresa i telefon nisu potvrđeni.",
    name: "Partner program Beograd",
    city: "Beograd",
    region: "Beograd",
    address: "Partnerska lokacija, Beograd",
    phone: "+381 11 000 003",
    workingHours: "Pon-Pet 08:00-17:00, Sub 08:00-13:00",
    type: "prodajno-mesto",
    brands: ["R-M", "Carsystem", "SATA", "Car Fit"],
    programs: ["Boje i lakovi", "Priprema", "Oprema", "Poliranje"],
    coordinates: { lat: 44.8125, lng: 20.4612 },
    mapPosition: { x: 54, y: 45 },
    description:
      "Podrška za profesionalne lakirnice i servise u širem beogradskom području.",
  },
  {
    id: "nis-partner",
    isPublic: false,
    dataStatus: "placeholder",
    dataNote: "Demo partner zapis: naziv, adresa i telefon nisu potvrđeni.",
    name: "Partner program Niš",
    city: "Niš",
    region: "Jug Srbije",
    address: "Partnerska lokacija, Niš",
    phone: "+381 18 000 004",
    workingHours: "Pon-Pet 08:00-16:30",
    type: "prodajno-mesto",
    brands: ["Carsystem", "Baslac", "Car Fit"],
    programs: ["Boje i lakovi", "Priprema", "Potrošni materijal"],
    coordinates: { lat: 43.3209, lng: 21.8958 },
    mapPosition: { x: 69, y: 76 },
    description:
      "Kontakt za južnu Srbiju, pripremu površine, potrošni program i refinish podršku.",
  },
  {
    id: "kragujevac-partner",
    isPublic: false,
    dataStatus: "placeholder",
    dataNote: "Demo partner zapis: naziv, adresa i telefon nisu potvrđeni.",
    name: "Partner program Kragujevac",
    city: "Kragujevac",
    region: "Šumadija",
    address: "Partnerska lokacija, Kragujevac",
    phone: "+381 34 000 005",
    workingHours: "Pon-Pet 08:00-16:00",
    type: "prodajno-mesto",
    brands: ["R-M", "Carsystem", "Baslac"],
    programs: ["Boje i lakovi", "Priprema", "Poliranje"],
    coordinates: { lat: 44.0128, lng: 20.9114 },
    mapPosition: { x: 56, y: 61 },
    description:
      "Šumadijski oslonac za boje, lakove, pripremu i završnu obradu.",
  },
  {
    id: "subotica-partner",
    isPublic: false,
    dataStatus: "placeholder",
    dataNote: "Demo partner zapis: naziv, adresa i telefon nisu potvrđeni.",
    name: "Partner program Subotica",
    city: "Subotica",
    region: "Sever Srbije",
    address: "Partnerska lokacija, Subotica",
    phone: "+381 24 000 006",
    workingHours: "Pon-Pet 08:00-16:00",
    type: "prodajno-mesto",
    brands: ["Carsystem", "Baslac", "Cosmos Spray"],
    programs: ["Priprema", "Aerosoli", "Potrošni materijal"],
    coordinates: { lat: 46.1005, lng: 19.6651 },
    mapPosition: { x: 35, y: 10 },
    description:
      "Severna Vojvodina, svakodnevni radionički materijali i pomoćni program.",
  },
  {
    id: "zrenjanin-partner",
    isPublic: false,
    dataStatus: "placeholder",
    dataNote: "Demo partner zapis: naziv, adresa i telefon nisu potvrđeni.",
    name: "Partner program Zrenjanin",
    city: "Zrenjanin",
    region: "Banat",
    address: "Partnerska lokacija, Zrenjanin",
    phone: "+381 23 000 007",
    workingHours: "Pon-Pet 08:00-16:00",
    type: "prodajno-mesto",
    brands: ["R-M", "Carsystem", "Car Fit"],
    programs: ["Boje i lakovi", "Priprema", "Abrazivi"],
    coordinates: { lat: 45.3836, lng: 20.3819 },
    mapPosition: { x: 58, y: 28 },
    description:
      "Banatska partnerska tačka za pripremu, nijansiranje i tehničku podršku.",
  },
  {
    id: "cacak-partner",
    isPublic: false,
    dataStatus: "placeholder",
    dataNote: "Demo partner zapis: naziv, adresa i telefon nisu potvrđeni.",
    name: "Partner program Čačak",
    city: "Čačak",
    region: "Zapadna Srbija",
    address: "Partnerska lokacija, Čačak",
    phone: "+381 32 000 008",
    workingHours: "Pon-Pet 08:00-16:30",
    type: "prodajno-mesto",
    brands: ["Carsystem", "SATA", "Baslac"],
    programs: ["Priprema", "Oprema", "Boje i lakovi"],
    coordinates: { lat: 43.8914, lng: 20.3497 },
    mapPosition: { x: 45, y: 64 },
    description:
      "Podrška za radionice u zapadnoj Srbiji, sa fokusom na pripremu i nanos.",
  },
  {
    id: "uzice-partner",
    isPublic: false,
    dataStatus: "placeholder",
    dataNote: "Demo partner zapis: naziv, adresa i telefon nisu potvrđeni.",
    name: "Partner program Užice",
    city: "Užice",
    region: "Zapadna Srbija",
    address: "Partnerska lokacija, Užice",
    phone: "+381 31 000 009",
    workingHours: "Pon-Pet 08:00-16:00",
    type: "prodajno-mesto",
    brands: ["Carsystem", "Car Fit", "Cosmos Spray"],
    programs: ["Priprema", "Potrošni materijal", "Aerosoli"],
    coordinates: { lat: 43.8558, lng: 19.8425 },
    mapPosition: { x: 35, y: 68 },
    description:
      "Radionički materijali i podrška za servise u zlatiborskom regionu.",
  },
  {
    id: "leskovac-partner",
    isPublic: false,
    dataStatus: "placeholder",
    dataNote: "Demo partner zapis: naziv, adresa i telefon nisu potvrđeni.",
    name: "Partner program Leskovac",
    city: "Leskovac",
    region: "Jug Srbije",
    address: "Partnerska lokacija, Leskovac",
    phone: "+381 16 000 010",
    workingHours: "Pon-Pet 08:00-16:00",
    type: "prodajno-mesto",
    brands: ["Carsystem", "Baslac", "Cosmos Spray"],
    programs: ["Boje i lakovi", "Priprema", "Potrošni materijal"],
    coordinates: { lat: 42.9981, lng: 21.9461 },
    mapPosition: { x: 70, y: 85 },
    description:
      "Južna partnerska tačka za osnovni refinish program i pomoćne artikle.",
  },
  {
    id: "pancevo-partner",
    isPublic: false,
    dataStatus: "placeholder",
    dataNote: "Demo partner zapis: naziv, adresa i telefon nisu potvrđeni.",
    name: "Partner program Pančevo",
    city: "Pančevo",
    region: "Južni Banat",
    address: "Partnerska lokacija, Pančevo",
    phone: "+381 13 000 011",
    workingHours: "Pon-Pet 08:00-17:00",
    type: "prodajno-mesto",
    brands: ["R-M", "Carsystem", "SATA"],
    programs: ["Boje i lakovi", "Oprema", "Poliranje"],
    coordinates: { lat: 44.8706, lng: 20.6403 },
    mapPosition: { x: 59, y: 44 },
    description:
      "Podrška za lakirnice u južnom Banatu i širem beogradskom okruženju.",
  },
  {
    id: "sremska-mitrovica-partner",
    isPublic: false,
    dataStatus: "placeholder",
    dataNote: "Demo partner zapis: naziv, adresa i telefon nisu potvrđeni.",
    name: "Partner program Sremska Mitrovica",
    city: "Sremska Mitrovica",
    region: "Srem",
    address: "Partnerska lokacija, Sremska Mitrovica",
    phone: "+381 22 000 012",
    workingHours: "Pon-Pet 08:00-16:00",
    type: "prodajno-mesto",
    brands: ["Carsystem", "Baslac", "Car Fit"],
    programs: ["Priprema", "Abrazivi", "Boje i lakovi"],
    coordinates: { lat: 44.9764, lng: 19.6122 },
    mapPosition: { x: 32, y: 42 },
    description:
      "Sremska partnerska mreža za pripremu, potrošni program i osnovni refinish tok.",
  },
];

export function getAllPartnerStores() {
  return [...partnerStores];
}

export function getPublicPartnerStores() {
  return partnerStores.filter((store) => store.isPublic && store.dataStatus === "confirmed");
}

export function normalizePartnerCity(city: string) {
  return city
    .trim()
    .toLocaleLowerCase("sr-Latn")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function getPartnerCityLabel(store: PartnerStore) {
  return store.canonicalCity ?? store.city;
}

export function getPartnerCityKey(store: PartnerStore) {
  return normalizePartnerCity(getPartnerCityLabel(store));
}

export function getLocationTypeLabel(type: PartnerLocationType) {
  const labels: Record<PartnerLocationType, string> = {
    distributer: "Distributer",
    partner: "Partner",
    "prodajno-mesto": "Prodajno mesto",
    servis: "Servis",
  };

  return labels[type];
}

export function getPartnerLocationTypes(store: PartnerStore) {
  return store.locationTypeCapabilities ?? [store.type];
}

export function hasPartnerLocationType(store: PartnerStore, type: PartnerLocationType) {
  return getPartnerLocationTypes(store).includes(type);
}

export function getPartnerLocationTypeLabel(store: PartnerStore) {
  const types = getPartnerLocationTypes(store);
  if (types.includes("prodajno-mesto") && types.includes("servis")) {
    return "Prodajno mesto i servis";
  }

  return getLocationTypeLabel(store.type);
}

export function getLocationTypeOptions(stores: PartnerStore[]) {
  return Array.from(new Set(stores.flatMap((store) => getPartnerLocationTypes(store))))
    .sort((a, b) => getLocationTypeLabel(a).localeCompare(getLocationTypeLabel(b), "sr-Latn"))
    .map((type) => ({
      label: getLocationTypeLabel(type),
      value: type,
    }));
}

export function getPartnerLocationStats(stores: PartnerStore[]) {
  const partnerIds = stores
    .map((store) => store.partnerId)
    .filter((partnerId): partnerId is string => Boolean(partnerId));

  return {
    cityCount: new Set(stores.map((store) => getPartnerCityKey(store))).size,
    locationCount: stores.length,
    partnerCount:
      partnerIds.length === stores.length ? new Set(partnerIds).size : undefined,
    prodajnoMestoCount: stores.filter((store) =>
      hasPartnerLocationType(store, "prodajno-mesto"),
    ).length,
  };
}
