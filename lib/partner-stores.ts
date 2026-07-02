export type PartnerStore = {
  id: string;
  name: string;
  city: string;
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
  mapPosition: {
    x: number;
    y: number;
  };
  description: string;
  featured?: boolean;
};

export const partnerStores: PartnerStore[] = [
  {
    id: "indjija-central",
    name: "Carsystem i R-M Inđija",
    city: "Inđija",
    region: "Srem",
    address: "Partnerska lokacija, Inđija",
    phone: "+381 22 000 001",
    email: "office@carsystemirm.com",
    workingHours: "Pon-Pet 08:00-16:00",
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
    name: "Partner program Novi Sad",
    city: "Novi Sad",
    region: "Vojvodina",
    address: "Partnerska lokacija, Novi Sad",
    phone: "+381 21 000 002",
    workingHours: "Pon-Pet 08:00-17:00",
    brands: ["R-M", "Carsystem", "Baslac"],
    programs: ["Boje i lakovi", "Priprema", "Abrazivi"],
    coordinates: { lat: 45.2671, lng: 19.8335 },
    mapPosition: { x: 39, y: 29 },
    description:
      "Regionalna podrška za radionice u Južnoj Bačkoj i okolnim mestima.",
  },
  {
    id: "beograd-partner",
    name: "Partner program Beograd",
    city: "Beograd",
    region: "Beograd",
    address: "Partnerska lokacija, Beograd",
    phone: "+381 11 000 003",
    workingHours: "Pon-Pet 08:00-17:00, Sub 08:00-13:00",
    brands: ["R-M", "Carsystem", "SATA", "Car Fit"],
    programs: ["Boje i lakovi", "Priprema", "Oprema", "Poliranje"],
    coordinates: { lat: 44.8125, lng: 20.4612 },
    mapPosition: { x: 54, y: 45 },
    description:
      "Podrška za profesionalne lakirnice i servise u širem beogradskom području.",
  },
  {
    id: "nis-partner",
    name: "Partner program Niš",
    city: "Niš",
    region: "Jug Srbije",
    address: "Partnerska lokacija, Niš",
    phone: "+381 18 000 004",
    workingHours: "Pon-Pet 08:00-16:30",
    brands: ["Carsystem", "Baslac", "Car Fit"],
    programs: ["Boje i lakovi", "Priprema", "Potrošni materijal"],
    coordinates: { lat: 43.3209, lng: 21.8958 },
    mapPosition: { x: 69, y: 76 },
    description:
      "Kontakt za južnu Srbiju, pripremu površine, potrošni program i refinish podršku.",
  },
  {
    id: "kragujevac-partner",
    name: "Partner program Kragujevac",
    city: "Kragujevac",
    region: "Šumadija",
    address: "Partnerska lokacija, Kragujevac",
    phone: "+381 34 000 005",
    workingHours: "Pon-Pet 08:00-16:00",
    brands: ["R-M", "Carsystem", "Baslac"],
    programs: ["Boje i lakovi", "Priprema", "Poliranje"],
    coordinates: { lat: 44.0128, lng: 20.9114 },
    mapPosition: { x: 56, y: 61 },
    description:
      "Šumadijski oslonac za boje, lakove, pripremu i završnu obradu.",
  },
  {
    id: "subotica-partner",
    name: "Partner program Subotica",
    city: "Subotica",
    region: "Sever Srbije",
    address: "Partnerska lokacija, Subotica",
    phone: "+381 24 000 006",
    workingHours: "Pon-Pet 08:00-16:00",
    brands: ["Carsystem", "Baslac", "Cosmos Spray"],
    programs: ["Priprema", "Aerosoli", "Potrošni materijal"],
    coordinates: { lat: 46.1005, lng: 19.6651 },
    mapPosition: { x: 35, y: 10 },
    description:
      "Severna Vojvodina, svakodnevni radionički materijali i pomoćni program.",
  },
  {
    id: "zrenjanin-partner",
    name: "Partner program Zrenjanin",
    city: "Zrenjanin",
    region: "Banat",
    address: "Partnerska lokacija, Zrenjanin",
    phone: "+381 23 000 007",
    workingHours: "Pon-Pet 08:00-16:00",
    brands: ["R-M", "Carsystem", "Car Fit"],
    programs: ["Boje i lakovi", "Priprema", "Abrazivi"],
    coordinates: { lat: 45.3836, lng: 20.3819 },
    mapPosition: { x: 58, y: 28 },
    description:
      "Banatska partnerska tačka za pripremu, nijansiranje i tehničku podršku.",
  },
  {
    id: "cacak-partner",
    name: "Partner program Čačak",
    city: "Čačak",
    region: "Zapadna Srbija",
    address: "Partnerska lokacija, Čačak",
    phone: "+381 32 000 008",
    workingHours: "Pon-Pet 08:00-16:30",
    brands: ["Carsystem", "SATA", "Baslac"],
    programs: ["Priprema", "Oprema", "Boje i lakovi"],
    coordinates: { lat: 43.8914, lng: 20.3497 },
    mapPosition: { x: 45, y: 64 },
    description:
      "Podrška za radionice u zapadnoj Srbiji, sa fokusom na pripremu i nanos.",
  },
  {
    id: "uzice-partner",
    name: "Partner program Užice",
    city: "Užice",
    region: "Zapadna Srbija",
    address: "Partnerska lokacija, Užice",
    phone: "+381 31 000 009",
    workingHours: "Pon-Pet 08:00-16:00",
    brands: ["Carsystem", "Car Fit", "Cosmos Spray"],
    programs: ["Priprema", "Potrošni materijal", "Aerosoli"],
    coordinates: { lat: 43.8558, lng: 19.8425 },
    mapPosition: { x: 35, y: 68 },
    description:
      "Radionički materijali i podrška za servise u zlatiborskom regionu.",
  },
  {
    id: "leskovac-partner",
    name: "Partner program Leskovac",
    city: "Leskovac",
    region: "Jug Srbije",
    address: "Partnerska lokacija, Leskovac",
    phone: "+381 16 000 010",
    workingHours: "Pon-Pet 08:00-16:00",
    brands: ["Carsystem", "Baslac", "Cosmos Spray"],
    programs: ["Boje i lakovi", "Priprema", "Potrošni materijal"],
    coordinates: { lat: 42.9981, lng: 21.9461 },
    mapPosition: { x: 70, y: 85 },
    description:
      "Južna partnerska tačka za osnovni refinish program i pomoćne artikle.",
  },
  {
    id: "pancevo-partner",
    name: "Partner program Pančevo",
    city: "Pančevo",
    region: "Južni Banat",
    address: "Partnerska lokacija, Pančevo",
    phone: "+381 13 000 011",
    workingHours: "Pon-Pet 08:00-17:00",
    brands: ["R-M", "Carsystem", "SATA"],
    programs: ["Boje i lakovi", "Oprema", "Poliranje"],
    coordinates: { lat: 44.8706, lng: 20.6403 },
    mapPosition: { x: 59, y: 44 },
    description:
      "Podrška za lakirnice u južnom Banatu i širem beogradskom okruženju.",
  },
  {
    id: "sremska-mitrovica-partner",
    name: "Partner program Sremska Mitrovica",
    city: "Sremska Mitrovica",
    region: "Srem",
    address: "Partnerska lokacija, Sremska Mitrovica",
    phone: "+381 22 000 012",
    workingHours: "Pon-Pet 08:00-16:00",
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
