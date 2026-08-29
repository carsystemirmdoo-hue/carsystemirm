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
  "office_recorded",
  "confirmed",
  "rejected",
  "reconciliation_failed",
  "revoked",
  "expired",
];

/**
 * Ko izvodi prelaz.
 *
 * `human` je svaki put kroz UI i server akciju. `system` je budući read-only
 * reconciliation servis nad `invoices`/`invoice_lines`. Razlika postoji zato
 * što dva stanja NISU odluka nego NALAZ: `confirmed` i `reconciliation_failed`
 * tvrde nešto o stvarno fakturisanom uslovu, a to čovek iz portala ne može
 * znati — može samo verovati da je dobro uneo u BizniSoft.
 */
export const ACTOR_HUMAN = "human";
export const ACTOR_SYSTEM = "system";

/**
 * Stanja koja sme postaviti ISKLJUČIVO reconciliation servis.
 *
 * Dok taj servis ne postoji, nijedan pozivalac ne prosleđuje `ACTOR_SYSTEM`,
 * pa su ova stanja nedostižna iz produkcije. Baza to isto sprovodi nezavisno
 * (`price_rules_confirmed_needs_invoice_ck`), pa zaobilaženje ovog modula ne
 * pomaže.
 */
export const SYSTEM_ONLY_STATUSES = ["confirmed", "reconciliation_failed"];

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
  /* Evidentiranje ručnog unosa u BizniSoft — ljudska radnja kancelarije. */
  office_record: "prices:apply",
  /*
   * `confirm` i `reconcile_fail` NEMAJU ljudsku sposobnost, i to je namerno.
   * Vrednost je sentinel koji nijedan paket ne dodeljuje i koji ne postoji u
   * `CAPABILITIES` — pa i kada bi neko izbegao proveru aktera, provera
   * sposobnosti bi i dalje odbila radnju.
   */
  confirm: "prices:reconcile_system",
  reconcile_fail: "prices:reconcile_system",
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
  /*
   * Odobreno pravilo NE ide pravo u `confirmed`.
   *
   * Sledeći ljudski korak je `office_recorded` — kancelarija kaže da je unela
   * uslov u BizniSoft. Tek posle toga usaglašavanje sa fakturom sme reći da li
   * je uslov stvarno primenjen.
   */
  approved_pending_biznisoft: ["office_recorded", "revoked", "expired"],
  /*
   * Iz evidencije kancelarije vode SAMO sistemski ishodi (i ljudski opoziv).
   * `confirmed` i `reconciliation_failed` postavlja reconciliation servis.
   */
  office_recorded: ["confirmed", "reconciliation_failed", "revoked", "expired"],
  // Potvrđeno pravilo se ne „vraća": potvrda je zapis o tome šta se dogodilo, a
  // istorija se ne prepravlja. Prestaje da važi opozivom ili istekom.
  confirmed: ["revoked", "expired"],
  /*
   * Neuspelo usaglašavanje nije kraj: kancelarija sme ponovo da unese u
   * BizniSoft i evidentira (nazad u `office_recorded`), ili gazda da opozove.
   * Prelaz pravo u `confirmed` više ne postoji — mora ponovo kroz evidenciju,
   * pa kroz usaglašavanje.
   */
  reconciliation_failed: ["office_recorded", "revoked"],
  rejected: [],
  revoked: [],
  expired: [],
};

/** Prelazi koji traže obrazložen razlog. */
const REASON_REQUIRED = new Set([
  "rejected",
  "revoked",
  "reconciliation_failed",
  /*
   * Evidencija kancelarije traži napomenu jer je ona jedini trag o tome ŠTA je
   * tačno uneto u BizniSoft. Bez nje bi kasnije usaglašavanje poredilo pravilo
   * sa fakturom bez ijednog podatka o tome šta je čovek mislio da je uneo.
   */
  "office_recorded",
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
 * @param {"human"|"system"} [input.actorKind]  podrazumevano `human`
 * @returns {string | null}
 */
export function rejectTransition({
  from,
  to,
  capabilities,
  reason,
  actorIsProposer = false,
  customerInScope = true,
  actorKind = ACTOR_HUMAN,
}) {
  if (!PRICE_RULE_STATUSES.includes(to)) {
    return `Nepoznato stanje „${to}".`;
  }
  const allowed = ALLOWED_TRANSITIONS[from];
  if (!allowed) return `Nepoznato polazno stanje „${from}".`;
  if (!allowed.includes(to)) {
    return `Prelaz „${from}" → „${to}" nije dozvoljen.`;
  }

  /*
   * Nalaz usaglašavanja nije ljudska odluka.
   *
   * Provera ide PRE provere sposobnosti da bi poruka rekla pravi razlog:
   * problem nije u tome što čoveku fali dozvola, nego u tome što tu tvrdnju
   * čovek uopšte ne može dati — on ne vidi fakturu, vidi samo šta je mislio da
   * je uneo u BizniSoft.
   */
  if (SYSTEM_ONLY_STATUSES.includes(to) && actorKind !== ACTOR_SYSTEM) {
    return (
      `Stanje „${to}" postavlja isključivo usaglašavanje sa fakturom. ` +
      'Ručno evidentiranje unosa u BizniSoft je stanje „office_recorded".'
    );
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
  if (to === "office_recorded") return "office_record";
  if (to === "rejected") return "reject";
  if (to === "confirmed") return "confirm";
  if (to === "reconciliation_failed") return "reconcile_fail";
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
 * Da li je kancelarija evidentirala ručni unos u BizniSoft.
 *
 * Namerno ODVOJENA funkcija od `isBiznisoftConfirmed`. Spajanje to dvoje je
 * tačno greška koju je postflight audit našao: tvrdnja čoveka je izgledala kao
 * dokaz sa fakture.
 */
export function isOfficeRecorded(status) {
  return status === "office_recorded";
}

/**
 * Da li pravilo uopšte učestvuje u odlučivanju o ceni.
 *
 * `approved_pending_biznisoft` učestvuje — firma je donela odluku — ali svaki
 * prikaz mora reći da potvrda još ne postoji.
 */
export function participatesInPricing(status) {
  return (
    status === "approved_pending_biznisoft" ||
    status === "office_recorded" ||
    status === "confirmed"
  );
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
  if (isBiznisoftConfirmed(rule.status)) {
    return {
      visibleToCustomer: false,
      note: "Uslov je potvrđen fakturom. Cena porudžbine se i dalje potvrđuje uz porudžbinu.",
    };
  }
  if (isOfficeRecorded(rule.status)) {
    return {
      visibleToCustomer: false,
      note: "Kancelarija evidentirala primenu — nije potvrđeno fakturom.",
    };
  }
  return {
    visibleToCustomer: false,
    note: "Odobreno, ali još nije uneto u BizniSoft — nije garantovana fakturisana cena.",
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
