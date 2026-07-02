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
