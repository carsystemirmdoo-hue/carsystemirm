import { ORDER_STATUS_LABELS } from "./orderRules.mjs";

/**
 * Prikaz stanja zahteva: oznaka, ton, ko je na potezu i šta sledi.
 *
 * Samo prikaz — prelaze i dozvole i dalje proverava server (`orderRules.mjs`,
 * `ordering-service.ts`). Ton ima i oblik oznake (krug, romb, kvačica, x,
 * prazan kvadrat), pa se stanje ne razlikuje samo po boji.
 */

const TONE = {
  submitted: "info",
  under_review: "info",
  changes_requested: "warning",
  awaiting_customer: "warning",
  confirmed: "success",
  rejected: "danger",
  cancelled: "neutral",
  superseded: "neutral",
};

/** Kraće oznake gde opšti naziv ne kaže kome se obraća. */
const CUSTOMER_LABEL = { awaiting_customer: "Izmenjen predlog — čeka Vašu potvrdu" };
const OFFICE_LABEL = { awaiting_customer: "Predlog čeka kupca" };

/**
 * @param {string} status
 * @param {{ audience: "customer" | "office", biznisoftRecorded?: boolean, pendingProposal?: boolean, oldVersion?: boolean }} ctx
 * @returns {{ tone: string, label: string, turn: "customer" | "office" | "none", turnText: string, title: string, next: string }}
 */
export function orderStage(status, ctx) {
  const v = stage(status, ctx);
  return { ...v, title: titleOf(status, ctx) };
}

function stage(status, ctx) {
  const customer = ctx.audience === "customer";
  const tone = TONE[status] ?? "neutral";
  const label =
    (customer ? CUSTOMER_LABEL[status] : OFFICE_LABEL[status]) ??
    ORDER_STATUS_LABELS[status] ??
    "Nepoznato stanje";

  if (ctx.oldVersion) {
    return { tone: "neutral", label, turn: "none", turnText: "Stara verzija — samo istorija", next: "Radnje se obavljaju na važećoj verziji." };
  }
  switch (status) {
    case "submitted":
      return customer
        ? { tone, label, turn: "office", turnText: "Na potezu: kancelarija", next: "Kancelarija proverava raspoloživost, cene i isporuku. Zahtev još nije porudžbina, faktura ni rezervacija." }
        : { tone, label, turn: "office", turnText: "Na potezu: kancelarija — prijem", next: "Preuzmite zahtev u obradu da kupac vidi da je u radu." };
    case "under_review":
      return customer
        ? { tone, label, turn: "office", turnText: "Na potezu: kancelarija", next: "Kancelarija proverava artikle, količine i cene." }
        : { tone, label, turn: "office", turnText: "Na potezu: kancelarija — provera i odluka", next: "Potvrdite porudžbinu, pripremite izmenjen predlog, zatražite izmenu ili odbijte zahtev." };
    case "changes_requested":
      if (ctx.pendingProposal) {
        return customer
          ? { tone, label, turn: "customer", turnText: "Na potezu: Vi", next: "Kancelarija je pripremila izmenjen predlog. Potvrdite ga ili odbijte na predlogu." }
          : { tone, label, turn: "customer", turnText: "Na potezu: kupac", next: "Izmenjen predlog čeka potvrdu kupca." };
      }
      return customer
        ? { tone, label, turn: "customer", turnText: "Na potezu: Vi", next: "Kancelarija traži izmenu. Vratite stavke u korpu i pošaljite ispravku ili otkažite zahtev." }
        : { tone, label, turn: "customer", turnText: "Na potezu: kupac", next: "Čeka se ispravka kupca. Ako je kupac odbio izmenjen predlog, možete pripremiti novi." };
    case "awaiting_customer":
      return { tone, label, turn: "customer", turnText: `Na potezu: ${customer ? "Vi" : "kupac"}`, next: customer ? "Pregledajte izmene i potvrdite ili odbijte predlog. Original ostaje sačuvan." : "Kupac potvrđuje ili odbija predlog. Original ostaje sačuvan." };
    case "confirmed":
      if (customer) {
        return { tone, label, turn: "none", turnText: "Potvrđeno", next: "Porudžbina je potvrđena. Ovo nije faktura ni potvrda isporuke." };
      }
      return ctx.biznisoftRecorded
        ? { tone, label, turn: "none", turnText: "Uneto u BizniSoft", next: "U portalu nema daljih koraka." }
        : { tone, label, turn: "office", turnText: "Na potezu: kancelarija — unos u BizniSoft", next: "Unesite porudžbinu u BizniSoft ručno i upišite broj dokumenta." };
    case "rejected":
    case "cancelled":
    case "superseded":
      return { tone, label, turn: "none", turnText: "Nema daljih radnji", next: status === "superseded" ? "Zamenjen novom verzijom; zapis ostaje u istoriji." : "Zapis ostaje u istoriji." };
    default:
      return { tone, label, turn: "none", turnText: "Nema daljih radnji", next: "" };
  }
}

/** Naslov bloka „Šta sledi“ — šta se desilo, bez ponavljanja „Na potezu“. */
function titleOf(status, ctx) {
  const customer = ctx.audience === "customer";
  if (ctx.oldVersion) return "Stara verzija";
  switch (status) {
    case "submitted":
      return customer ? "Zahtev je primljen" : "Novi zahtev — prijem";
    case "under_review":
      return customer ? "Zahtev je u obradi" : "Provera i odluka";
    case "changes_requested":
      if (ctx.pendingProposal) return customer ? "Pripremljen je izmenjen predlog" : "Predlog čeka kupca";
      return customer ? "Kancelarija traži izmenu" : "Čeka se ispravka kupca";
    case "awaiting_customer":
      return customer ? "Kancelarija je izmenila Vaš zahtev" : "Izmenjen predlog je poslat kupcu";
    case "confirmed":
      if (customer) return "Porudžbina je potvrđena";
      return ctx.biznisoftRecorded ? "Uneto u BizniSoft" : "Unos u BizniSoft";
    case "rejected":
      return "Zahtev je odbijen";
    case "cancelled":
      return "Zahtev je otkazan";
    case "superseded":
      return "Zamenjen novom verzijom";
    default:
      return "Stanje zahteva";
  }
}
