import "server-only";
import { can } from "@/lib/authz/permissions.mjs";
import type { PortalUser } from "@/lib/authz/user-repository";
import { countOrderRequestsByState } from "@/lib/ordering/ordering-service";
import { countOpenPriceRequests } from "@/lib/ordering/price-request-service";
import { countSourceDocuments } from "@/lib/pdf/ingest";
import { pregledUredjaja } from "@/lib/sync/commands/service";
import { opisStanja, stanjeUredjaja } from "@/lib/sync/device/cycle-status.mjs";
import { dmyTime } from "@/lib/ordering/panelFormat.mjs";

export type WorkTone = "success" | "warning" | "danger" | "neutral";

export type WorkItem = {
  key: string;
  label: string;
  value: string;
  context: string;
  href: string;
  tone: WorkTone;
};

const N = new Intl.NumberFormat("sr-Latn-RS");
const BG = (d: Date) => dmyTime(d);

function countItem(key: string, label: string, n: number, context: string, href: string, tone: WorkTone = "warning"): WorkItem {
  return { key, label, value: N.format(n), context, href, tone: n > 0 ? tone : "success" };
}

/**
 * „Čeka obradu“ na početnoj: posao koji traži korak ovog korisnika.
 *
 * Svaka kartica postoji samo uz sposobnost koja otvara ekran na koji vodi, i
 * broji isti skup koji taj ekran prikazuje (isti uslovi, isti opseg kupaca) —
 * da broj na početnoj i broj na listi nikad ne budu dve različite istine.
 */
export async function loadWorkQueue(user: PortalUser): Promise<WorkItem[]> {
  const reviewsOrders = can(user, "customer_orders:review");
  const [orders, priceRequests, documents, devices] = await Promise.all([
    can(user, "view:zahtevi") ? countOrderRequestsByState(user) : null,
    can(user, "view:zahtevi") && can(user, "price_requests:handle") ? countOpenPriceRequests(user) : null,
    can(user, "view:importi") ? countSourceDocuments() : null,
    can(user, "sync:monitor") ? pregledUredjaja() : null,
  ]);

  const items: WorkItem[] = [];

  if (orders && reviewsOrders) {
    items.push(countItem("novi", "Novi zahtevi kupaca", orders.novi, "čekaju prijem u obradu", "/portal/zahtevi?stanje=novi"));
    items.push(countItem("obrada", "Zahtevi u obradi", orders.obrada, "čekaju potvrdu ili izmenu", "/portal/zahtevi?stanje=obrada", "neutral"));
    items.push(countItem("biznisoft", "Potvrđeno, bez BizniSoft broja", orders.biznisoft, "uneti u BizniSoft i upisati broj", "/portal/zahtevi?stanje=biznisoft"));
  } else if (orders) {
    items.push(countItem("otvoreni", "Otvoreni zahtevi kupaca", orders.otvoreni, "još traže nečiji korak", "/portal/zahtevi", "neutral"));
  }

  if (priceRequests !== null) {
    items.push(countItem("uslovi", "Upiti za cenu i uslove", priceRequests, "čekaju odgovor kupcu", "/portal/zahtevi/uslovi"));
  }

  if (documents) {
    const pregled = documents["review:pending"] ?? 0;
    const sudar = documents["revision:conflict"] ?? 0;
    const karantin = documents["validation:totals_mismatch"] ?? 0;
    const total = pregled + sudar + karantin;
    const parts = [
      pregled ? `ručni pregled ${N.format(pregled)}` : null,
      sudar ? `sudar verzija ${N.format(sudar)}` : null,
      karantin ? `zbirovi se ne slažu ${N.format(karantin)}` : null,
    ].filter(Boolean);
    // Vodi na filter samo kad je razlog jedan; inače na celu listu sa brojačima.
    const only = [pregled && "pregled", sudar && "sudar", karantin && "karantin"].filter(Boolean);
    const href = only.length === 1 ? `/portal/importi/dokumenti?filter=${only[0]}` : "/portal/importi/dokumenti";
    items.push(countItem("dokumenti", "Dokumenti za pregled", total, parts.length ? parts.join(" · ") : "svi uvezeni dokumenti su razrešeni", href));
  }

  if (devices) {
    const active = devices.filter((d) => d.status === "active");
    if (active.length === 0) {
      items.push({ key: "konektor", label: "Konektor", value: "nije aktivan", context: "nijedan uređaj ne šalje dokumente", href: "/portal/importi/sinhronizacija", tone: "warning" });
    } else {
      // Najgore stanje među aktivnim uređajima određuje karticu.
      const rank: Record<string, number> = { greska: 4, nema_ciklusa: 3, bez_izvestaja: 1, preskoceno: 0, obradjeno: 0 };
      const states = active.map((d) => {
        const ulaz = {
          now: new Date(),
          status: d.status,
          lastSeenAt: d.lastSeenAt ? new Date(d.lastSeenAt) : null,
          lastCycleAt: d.lastCycleAt ? new Date(d.lastCycleAt) : null,
          lastCycleOutcome: d.lastCycleOutcome,
          lastScanCompletedAt: d.lastScanCompletedAt ? new Date(d.lastScanCompletedAt) : null,
          nextExpectedCycleAt: d.nextExpectedCycleAt ? new Date(d.nextExpectedCycleAt) : null,
        };
        return { ulaz, stanje: stanjeUredjaja(ulaz) };
      });
      const worst = states.reduce((a, b) => ((rank[b.stanje.kod] ?? 0) > (rank[a.stanje.kod] ?? 0) ? b : a));
      const VALUE: Record<string, string> = { greska: "greška", nema_ciklusa: "kasni", bez_izvestaja: "bez izveštaja", preskoceno: "radi", obradjeno: "radi" };
      items.push({
        key: "konektor",
        label: active.length > 1 ? `Konektor (${active.length} uređaja)` : "Konektor",
        value: VALUE[worst.stanje.kod] ?? worst.stanje.kod,
        context: opisStanja(worst.stanje, worst.ulaz, BG),
        href: "/portal/importi/sinhronizacija",
        tone: worst.stanje.ton,
      });
    }
  }

  return items;
}
