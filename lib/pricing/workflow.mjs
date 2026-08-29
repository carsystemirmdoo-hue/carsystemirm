/**
 * Tok promene cene — čista pravila, bez baze.
 *
 * Komercijalista NE aktivira cenu. Predlaže je; gazda odlučuje; kancelarija
 * evidentira da je uslov stvarno upisan u BizniSoft. Tri koraka, tri odvojene
 * sposobnosti, i nijedan od njih ne može sam da zatvori krug.
 */

export const PRICE_RULE_STATUSES = [
  "draft",
  "pending_approval",
  "approved_pending_biznisoft",
  "confirmed",
  "rejected",
  "reconciliation_failed",
  "revoked",
  "expired",
];

/**
 * Sposobnost koju svaki prelaz traži.
 *
 * Vezuje se za sposobnost, nikad za ulogu — isto pravilo kao u
 * `lib/authz/permissions.mjs`. Tako dodavanje paketa ne traži izmenu ovog
 * modula, a oduzimanje paketa deluje odmah.
 */
export const TRANSITION_CAPABILITY = {
  propose: "prices:propose",
  submit: "prices:propose",
  approve: "prices:approve",
  reject: "prices:approve",
  confirm: "prices:apply",
  reconciliation_failed: "prices:apply",
  revoke: "prices:approve",
  expire: "prices:approve",
};

/**
 * Dozvoljeni prelazi.
 *
 * Spisak je namerno kratak i eksplicitan. Svaki prelaz koji nije ovde je
 * zabranjen — uključujući one koji „logično" izgledaju dopušteno, poput
 * `pending_approval → confirmed`. Taj bi preskočio odobrenje, i to je tačno
 * oblik greške koji se ne primeti dok se ne pojavi na fakturi.
 */
export const ALLOWED_TRANSITIONS = {
  draft: ["pending_approval", "revoked"],
  pending_approval: ["approved_pending_biznisoft", "rejected", "revoked"],
  approved_pending_biznisoft: [
    "confirmed",
    "reconciliation_failed",
    "revoked",
    "expired",
  ],
  // Potvrđeno pravilo se ne „vraća" u odobreno: potvrda je zapis o tome šta se
  // dogodilo, a istorija se ne prepravlja. Prestaje da važi opozivom ili istekom.
  confirmed: ["revoked", "expired"],
  // Neuspela usaglašenost nije kraj: kancelarija sme da upiše i evidentira
  // ponovo, ili gazda da opozove.
  reconciliation_failed: ["confirmed", "revoked"],
  rejected: [],
  revoked: [],
  expired: [],
};

/** Prelazi koji traže obrazložen razlog. */
const REASON_REQUIRED = new Set([
  "rejected",
  "revoked",
  "reconciliation_failed",
]);

export class WorkflowError extends Error {
  /** @param {string} message @param {string} code */
  constructor(message, code) {
    super(message);
    this.name = "WorkflowError";
    this.code = code;
  }
}

/**
 * Razlog odbijanja prelaza, ili `null` kada je prelaz dopušten.
 *
 * @param {object} input
 * @param {string} input.from
 * @param {string} input.to
 * @param {ReadonlySet<string> | readonly string[]} input.capabilities
 * @param {string | null | undefined} [input.reason]
 * @param {boolean} [input.actorIsProposer]
 * @param {boolean} [input.customerInScope]  da li je kupac u opsegu aktera
 * @returns {string | null}
 */
export function rejectTransition({
  from,
  to,
  capabilities,
  reason,
  actorIsProposer = false,
  customerInScope = true,
}) {
  if (!PRICE_RULE_STATUSES.includes(to)) {
    return `Nepoznato stanje „${to}".`;
  }
  const allowed = ALLOWED_TRANSITIONS[from];
  if (!allowed) return `Nepoznato polazno stanje „${from}".`;
  if (!allowed.includes(to)) {
    return `Prelaz „${from}" → „${to}" nije dozvoljen.`;
  }

  const has = (capability) =>
    capabilities instanceof Set
      ? capabilities.has(capability)
      : (capabilities ?? []).includes(capability);

  const action = actionFor(from, to);
  const required = TRANSITION_CAPABILITY[action];
  if (required && !has(required)) {
    return `Za ovu radnju je potrebna dozvola „${required}".`;
  }

  /*
   * Predlagač ne odobrava sopstveni predlog.
   *
   * Ovo NIJE isto što i provera sposobnosti: gazda ima i `prices:propose` i
   * `prices:approve`, pa bi bez ovog pravila mogao da predloži i odmah odobri.
   * To je dozvoljeno kao poslovna odluka za gazdu — on i jeste poslednja
   * instanca — ali za svakog ko nije gazda mora postojati drugi par očiju.
   * Pravilo se zato izražava kroz sposobnost: ko ima `prices:audit` (paket
   * odobravanja) sme oba koraka; ostali ne.
   */
  if (to === "approved_pending_biznisoft" && actorIsProposer && !has("prices:audit")) {
    return "Ne možete odobriti sopstveni predlog.";
  }

  if (!customerInScope) {
    return "Kupac nije u vašem opsegu — predlog nije moguć.";
  }

  if (REASON_REQUIRED.has(to) && (!reason || reason.trim().length < 3)) {
    return "Ova radnja traži obrazložen razlog (najmanje 3 znaka).";
  }

  return null;
}

/** Naziv radnje za dati prelaz; osnova za mapiranje na sposobnost. */
export function actionFor(from, to) {
  if (to === "pending_approval") return "submit";
  if (to === "approved_pending_biznisoft") return "approve";
  if (to === "rejected") return "reject";
  if (to === "confirmed") return "confirm";
  if (to === "reconciliation_failed") return "reconciliation_failed";
  if (to === "revoked") return "revoke";
  if (to === "expired") return "expire";
  return "propose";
}

/**
 * Da li stanje znači da je uslov POTVRĐEN u BizniSoftu.
 *
 * Postoji kao funkcija, a ne kao poređenje razbacano po ekranima, zato što je
 * to poređenje koje se najlakše napiše pogrešno — `status !== "rejected"`
 * izgleda kao ista provera i propušta pet stanja.
 */
export function isBiznisoftConfirmed(status) {
  return status === "confirmed";
}

/**
 * Da li pravilo uopšte učestvuje u odlučivanju o ceni.
 *
 * `approved_pending_biznisoft` učestvuje — firma je donela odluku — ali svaki
 * prikaz mora reći da potvrda još ne postoji.
 */
export function participatesInPricing(status) {
  return status === "approved_pending_biznisoft" || status === "confirmed";
}

/**
 * Šta se sme prikazati kupcu za dato pravilo.
 *
 * U ovoj fazi: NIŠTA što liči na garantovanu buduću cenu. Odobrena cena nije
 * fakturisana cena, a prikazana bez ograde se čita kao obećanje.
 *
 * @param {{ status: string }} rule
 * @returns {{ visibleToCustomer: boolean, note: string }}
 */
export function customerFacingDisclosure(rule) {
  return {
    visibleToCustomer: false,
    note: isBiznisoftConfirmed(rule.status)
      ? "Uslov je evidentiran kao primenjen u BizniSoftu. Cena porudžbine se i dalje potvrđuje uz porudžbinu."
      : "Odobreno, ali još nije potvrđeno u BizniSoftu — nije garantovana fakturisana cena.",
  };
}

/**
 * Tekst kojim se sme prikazati POSLEDNJA FAKTURISANA cena.
 *
 * Istorijska cena je činjenica; buduća nije. Ograda je deo teksta, a ne
 * preporuka za interfejs, da se ne bi negde izgubila u prosleđivanju.
 *
 * @param {string} isoDate
 */
export function lastInvoicedPriceLabel(isoDate) {
  if (!isoDate) return null;
  return `Poslednja fakturisana cena od ${isoDate} — informativno, nije potvrda buduće cene.`;
}
