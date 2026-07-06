export type CompanyContact = {
  name: string;
  city: string;
  country: string;
  locationLabel: string;
  phone: string;
  phoneHref: string;
  email: string;
  emailHref: string;
  workingHours: string;
  partnerNetworkNote: string;
  editableNote: string;
};

export type CompanyLocation = {
  name: string;
  city: string;
  label: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  dataNote: string;
};

/**
 * Canonical company/headquarters location. Every single-location map
 * (contact teaser, homepage preview) must read coordinates from here —
 * never duplicate lat/lng in components.
 */
export const companyLocation: CompanyLocation = {
  name: "Carsystem i R-M Inđija",
  city: "Inđija",
  label: "Centrala · Inđija",
  coordinates: { lat: 45.0482, lng: 20.0817 },
  dataNote:
    "Koordinate su na nivou grada Inđije; zameniti tačnom adresom centrale kada bude potvrđena.",
};

export const companyContact: CompanyContact = {
  name: "Carsystem i R-M Inđija",
  city: "Inđija",
  country: "Srbija",
  locationLabel: "Inđija, Srbija",
  phone: "+381 22 000 000",
  phoneHref: "tel:+38122000000",
  email: "office@carsystemirm.com",
  emailHref: "mailto:office@carsystemirm.com",
  workingHours: "Pon-Pet 08:00-16:00",
  partnerNetworkNote:
    "Upiti se rutiraju ka centrali u Inđiji i partnerskoj mreži u Srbiji.",
  editableNote:
    "Kontakt za upite i rutiranje partnerske mreže u Srbiji.",
};
