/**
 * Ograničavanje vidljivosti kupaca.
 *
 * Komercijalista vidi isključivo kupce koji su mu dodeljeni. Provera se radi nad
 * podacima, a ne nad interfejsom — menjanje ID-a kupca u adresi mora da završi
 * odbijanjem, ne prikazom tuđeg kupca.
 */

import { seesAllCustomers } from "./permissions.mjs";

/**
 * @param {{ role: string, permissions?: readonly string[] }} user
 * @param {readonly string[]} assignedCustomerIds  dodeljeni kupci iz baze
 * @param {string} customerId
 * @returns {boolean}
 */
export function canAccessCustomer(user, assignedCustomerIds, customerId) {
  if (!user || !customerId) return false;
  if (seesAllCustomers(user)) return true;
  return (assignedCustomerIds ?? []).includes(customerId);
}

/**
 * Sme li korisnik da ODLUČUJE o cenama i rabatima ovog kupca (predlog,
 * odobrenje, opoziv, opcija plaćanja).
 *
 * Uže od `canAccessCustomer`: komercijalista menja uslove SAMO svojim
 * (dodeljenim) kupcima, i kada mu paket „analitika" otvara pregled svih
 * kupaca. Pregled je čitanje; promena rabata tuđem kupcu nije (odluka
 * vlasnika 2026-11-09).
 *
 * @param {{ role: string, permissions?: readonly string[] }} user
 * @param {readonly string[]} assignedCustomerIds
 * @param {string} customerId
 */
export function canDecidePricesFor(user, assignedCustomerIds, customerId) {
  if (!user || !customerId) return false;
  if (user.role === "komercijalista") return (assignedCustomerIds ?? []).includes(customerId);
  return canAccessCustomer(user, assignedCustomerIds, customerId);
}

/**
 * Odlučuje li korisnik o cenama SVIH kupaca (i o grupnim i opštim pravilima).
 * Komercijalista nikad, ni sa paketom „analitika".
 *
 * @param {{ role: string, permissions?: readonly string[] }} user
 */
export function decidesPricesForAllCustomers(user) {
  return Boolean(user) && user.role !== "komercijalista" && seesAllCustomers(user);
}

/**
 * Filtrira listu kupaca na one koje korisnik sme da vidi. Koristi se i za izvoz,
 * da izveštaj ne bi sadržao redove izvan opsega korisnika.
 *
 * @template {{ id: string }} T
 * @param {{ role: string, permissions?: readonly string[] }} user
 * @param {readonly string[]} assignedCustomerIds
 * @param {readonly T[]} rows
 * @returns {T[]}
 */
export function filterCustomerRows(user, assignedCustomerIds, rows) {
  if (seesAllCustomers(user)) return [...rows];
  const allowed = new Set(assignedCustomerIds ?? []);
  return rows.filter((row) => allowed.has(row.id));
}

/**
 * Filtrira redove koji nose referencu na kupca (fakture, pošiljke, povrati).
 *
 * @template {Record<string, unknown>} T
 * @param {{ role: string, permissions?: readonly string[] }} user
 * @param {readonly string[]} assignedCustomerIds
 * @param {readonly T[]} rows
 * @param {(row: T) => string} getCustomerId
 * @returns {T[]}
 */
export function filterRowsByCustomer(
  user,
  assignedCustomerIds,
  rows,
  getCustomerId,
) {
  if (seesAllCustomers(user)) return [...rows];
  const allowed = new Set(assignedCustomerIds ?? []);
  return rows.filter((row) => allowed.has(getCustomerId(row)));
}
