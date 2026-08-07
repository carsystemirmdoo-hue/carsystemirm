import type { User } from "@/types/portal";

export const portalUsers: User[] = [
  { id: "usr-owner", name: "Milan Jovanović", email: "milan@carsystem.rs", initials: "MJ", role: "owner" },
  { id: "usr-marko", name: "Marko Petrović", email: "marko@carsystem.rs", initials: "MP", role: "sales", region: "Vojvodina" },
  { id: "usr-jelena", name: "Jelena Ilić", email: "jelena@carsystem.rs", initials: "JI", role: "office" },
  { id: "usr-nenad", name: "Nenad Simić", email: "nenad@carsystem.rs", initials: "NS", role: "sales", region: "Beograd" },
  { id: "usr-ana", name: "Ana Ristić", email: "ana@carsystem.rs", initials: "AR", role: "sales", region: "Centralna Srbija" },
  { id: "usr-luka", name: "Luka Nikolić", email: "luka@carsystem.rs", initials: "LN", role: "sales", region: "Južna Srbija" },
  { id: "usr-tamara", name: "Tamara Kovač", email: "tamara@carsystem.rs", initials: "TK", role: "sales", region: "Zapadna Srbija" },
];

export const demoUsers = {
  owner: portalUsers[0],
  sales: portalUsers[1],
  office: portalUsers[2],
};
