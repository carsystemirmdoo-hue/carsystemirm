/**
 * Odluke revizije javnih lokacija (data/public-location-decisions.json).
 *
 * Fajl je javan (repozitorijum je javan), zato nosi samo konačne odluke: ID,
 * vrstu lokacije i status. Obrazloženja, dokazi i sporni zapisi ostaju u
 * privatnoj radnoj kopiji revizije, van repozitorijuma.
 *
 *   status "reviewed" — poslovna lokacija sa javnim dokazom, prikazuje se;
 *   mergeInto          — duplikat: zapis se uklanja, naziv postaje alternativni
 *                        naziv ciljne lokacije;
 *   status "pending"   — ostaje u izvoru, ne prikazuje se (sporno, čeka potvrdu);
 *   status "excluded"  — nije poslovna lokacija za javnu mrežu (naše sedište,
 *                        nepovezana delatnost): uklanja se iz javnog fajla.
 */
import { PUBLIC_LOCATION_TYPES } from "./location-import-utils.mjs";

const latinKey = (value) =>
  String(value ?? "")
    .toLocaleLowerCase("sr-Latn")
    .replaceAll("đ", "dj")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export function applyLocationDecisions(locations, decisionsFile) {
  const decisions = decisionsFile?.decisions ?? [];
  const byId = new Map(locations.map((location) => [location.id, { ...location }]));
  const seen = new Set();
  const summary = { reviewed: 0, merged: 0, pending: 0, excluded: 0 };

  for (const decision of decisions) {
    if (seen.has(decision.id)) throw new Error(`Duplicate location decision: ${decision.id}`);
    seen.add(decision.id);
    const location = byId.get(decision.id);
    if (!location) {
      // Već spojen ili isključen zapis (ponovna primena na generisan fajl) je u redu.
      if (decision.mergeInto && byId.has(decision.mergeInto)) {
        summary.merged += 1;
        continue;
      }
      if (decision.status === "excluded") {
        summary.excluded += 1;
        continue;
      }
      throw new Error(`Location decision for unknown id: ${decision.id}`);
    }

    if (decision.mergeInto) {
      const target = byId.get(decision.mergeInto);
      if (!target) throw new Error(`Merge target missing for ${decision.id}: ${decision.mergeInto}`);
      const names = [...(target.alternativeNames ?? []), location.name, ...(location.alternativeNames ?? [])];
      const own = latinKey(target.name);
      const unique = [];
      for (const name of names) {
        const key = latinKey(name);
        if (!key || key === own || unique.some((item) => latinKey(item) === key)) continue;
        unique.push(name);
      }
      if (unique.length > 0) target.alternativeNames = unique;
      byId.delete(decision.id);
      summary.merged += 1;
      continue;
    }

    if (decision.status === "excluded") {
      if (location.verificationStatus === "verified") {
        throw new Error(`Verified location ${decision.id} cannot be excluded by a review decision.`);
      }
      byId.delete(decision.id);
      summary.excluded += 1;
      continue;
    }

    if (decision.status === "reviewed") {
      if (!PUBLIC_LOCATION_TYPES.has(decision.type) || ["unknown", "warehouse"].includes(decision.type)) {
        throw new Error(`Reviewed location ${decision.id} needs a public type, got ${decision.type}.`);
      }
      if (location.verificationStatus !== "verified") location.verificationStatus = "reviewed";
      location.type = decision.type;
      // Javni naziv (trgovački, bez imena vlasnika) i adresa sa dijakriticima.
      for (const key of ["name", "address", "city"]) {
        if (decision[key] !== undefined) location[key] = decision[key];
      }
      summary.reviewed += 1;
    } else if (decision.status === "pending") {
      if (location.verificationStatus !== "verified") location.verificationStatus = "pending";
      summary.pending += 1;
    } else {
      throw new Error(`Unknown decision status for ${decision.id}: ${decision.status}`);
    }
    byId.set(decision.id, location);
  }

  // Redosled ostaje redosled izvora.
  const result = locations.filter((location) => byId.has(location.id)).map((location) => byId.get(location.id));
  return { locations: result, summary };
}
