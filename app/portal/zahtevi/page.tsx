import Link from "next/link";
import { countOf, STAVKA } from "@/lib/ordering/plural.mjs";
import { OrderStatusBadge } from "@/components/ordering/OrderStatusBadge";
import { ScrollTable } from "@/components/ordering/ScrollTable";
import { can } from "@/lib/authz/permissions.mjs";
import { requireCapability } from "@/lib/authz/session";
import { listOrderRequests, loadOrderingMode, type OrderListRow } from "@/lib/ordering/ordering-service";
import { trialOverview } from "@/lib/ordering/trial-service";
import { trialCustomerIds } from "@/lib/ordering/trial";
import { LiveRefresh } from "@/components/ordering/LiveRefresh";
import { staffOrderStamp } from "@/lib/ordering/live-stamp";
import { dmyTime, money } from "@/lib/ordering/panelFormat.mjs";
import { orderStage } from "@/lib/ordering/statusView.mjs";
import { TrialPanel } from "./TrialPanel";

export const dynamic = "force-dynamic";

/** Filteri stanja (ista podela kao ranije grupe). „Otvoreni“ = sve što još traži nečiji korak. */
const FILTERS = [
  { key: "otvoreni", title: "Otvoreni", test: (r: OrderListRow) => ["submitted", "under_review", "changes_requested", "awaiting_customer"].includes(r.status) || (r.status === "confirmed" && !r.biznisoftDocumentNumber) },
  { key: "novi", title: "Novi", test: (r: OrderListRow) => r.status === "submitted" },
  { key: "obrada", title: "U obradi", test: (r: OrderListRow) => r.status === "under_review" },
  { key: "kupac", title: "Čeka kupca", test: (r: OrderListRow) => r.status === "changes_requested" || r.status === "awaiting_customer" },
  { key: "biznisoft", title: "Potvrđene — za BizniSoft", test: (r: OrderListRow) => r.status === "confirmed" && !r.biznisoftDocumentNumber },
  { key: "potvrdjene", title: "Potvrđene", test: (r: OrderListRow) => r.status === "confirmed" },
  { key: "zatvoreni", title: "Odbijeni, otkazani i zamenjeni", test: (r: OrderListRow) => ["rejected", "cancelled", "superseded"].includes(r.status) },
  { key: "svi", title: "Svi", test: () => true },
] as const;

export default async function OrderRequestsPage({ searchParams }: { searchParams: Promise<{ q?: string; verzije?: string; stanje?: string }> }) {
  const user = await requireCapability("view:zahtevi", "/portal/zahtevi");
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 80);
  // Podrazumevano samo važeća verzija svakog zahteva; stare verzije su u istoriji detalja.
  const allVersions = sp.verzije === "sve";
  const filter = FILTERS.find((f) => f.key === sp.stanje) ?? FILTERS[0];
  const [rows, mode, trialIds, stamp] = await Promise.all([
    listOrderRequests(user, null, q, { allVersions }),
    loadOrderingMode(),
    trialCustomerIds(),
    staffOrderStamp(user, null),
  ]);
  const allCustomers = process.env.CUSTOMER_ORDERING === "cenovnik";
  const canReview = can(user, "customer_orders:review");
  const isOwner = can(user, "customer_accounts:manage") && can(user, "prices:approve");
  const trials = isOwner ? await trialOverview() : [];
  const list = rows.filter(filter.test);
  const href = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const next = { q: q || null, verzije: allVersions ? "sve" : null, stanje: filter.key === "otvoreni" ? null : filter.key, ...patch };
    for (const [k, v] of Object.entries(next)) if (v) p.set(k, v);
    const s = p.toString();
    return `/portal/zahtevi${s ? `?${s}` : ""}`;
  };

  return (
    <div className="pn">
      <header className="pn-head">
        <div>
          <h1 className="pn-title">Zahtevi kupaca</h1>
          <p className="pn-lead">
            {canReview
              ? "Zahtev postaje porudžbina tek Vašom potvrdom. Potvrđenu porudžbinu u pilotu ručno unosite u BizniSoft i ovde upisujete broj dokumenta."
              : "Zahtevi Vaših kupaca, samo za pregled. Prijem i potvrdu radi kancelarija."}
          </p>
        </div>
        <span className="pn-small pn-muted">Osvežava se automatski na 15 sekundi.</span>
      </header>

      <nav className="pn-tabs" aria-label="Zahtevi kupaca">
        <div className="pn-tabs-scroll">
          <Link href="/portal/zahtevi" aria-current="page">
            Zahtevi za porudžbinu
          </Link>
          <Link href="/portal/zahtevi/uslovi">Cena i uslovi</Link>
        </div>
      </nav>

      {allCustomers ? (
        <p className="pn-note" data-tone="info">
          <span>
            <strong>Poručivanje je uključeno za kupce sa nalogom.</strong> Cene iz cenovnika i odobrenih uslova kupca. Potvrđenu porudžbinu unosite u BizniSoft ručno.
          </span>
        </p>
      ) : trialIds.length ? (
        <p className="pn-note" data-tone="info">
          <span>
            <strong>Kontrolisana proba.</strong> Zahtev mogu da pošalju samo izdvojeni test kupci ({trialIds.length}). Za stvarne kupce poručivanje preko sajta još nije
            uključeno.
          </span>
        </p>
      ) : mode.enabled ? (
        <p className="pn-note" data-tone="warning">
          <span>
            <strong>DEMO poručivanje · {mode.priceList.name}.</strong> Izmišljeni cenovnik i izmišljeni kupci. Nijedan zahtev ne ide u BizniSoft.
          </span>
        </p>
      ) : (
        <p className="pn-note">
          <span>
            <strong>Poručivanje preko sajta još nije uključeno.</strong> Kupci porudžbine i dalje šalju svom komercijalisti.
          </span>
        </p>
      )}

      <form method="get" className="pn-card" role="search" style={{ gap: 12 }}>
        <div className="pn-filters">
          <div className="pn-field">
            <label htmlFor="zahtevi-q">Pretraga</label>
            <input id="zahtevi-q" type="search" name="q" defaultValue={q} maxLength={80} placeholder="Broj zahteva, kupac, šifra ili naziv artikla" />
          </div>
          {allVersions ? <input type="hidden" name="verzije" value="sve" /> : null}
          {filter.key !== "otvoreni" ? <input type="hidden" name="stanje" value={filter.key} /> : null}
          <button type="submit" className="pn-btn">
            Tražite
          </button>
          {q ? (
            <Link href={href({ q: null })} className="pn-btn" data-variant="quiet">
              Poništite pretragu
            </Link>
          ) : null}
          <Link href={href({ verzije: allVersions ? null : "sve" })} className="pn-btn" data-variant="quiet" style={{ marginLeft: "auto" }}>
            {allVersions ? "Samo važeće verzije" : "Prikažite i stare verzije"}
          </Link>
        </div>
        <div className="pn-chips" role="group" aria-label="Stanje">
          {FILTERS.map((f) => (
            <Link key={f.key} href={href({ stanje: f.key === "otvoreni" ? null : f.key })} className="pn-chip" aria-current={f.key === filter.key ? "true" : undefined}>
              {f.title} <span className="pn-num">{rows.filter(f.test).length}</span>
            </Link>
          ))}
        </div>
      </form>

      <section className="pn-card pn-card-flush" aria-labelledby="lista-naslov">
        <div className="pn-card-h">
          <h2 id="lista-naslov">
            {filter.title} <span className="pn-muted pn-num" style={{ fontWeight: 400 }}>· {list.length}</span>
          </h2>
          <span className="pn-small pn-muted">
            {allVersions ? "Prikazane su i stare verzije" : "Prikazane su važeće verzije; stare su u istoriji svakog zahteva"}
            {q ? ` · pretraga „${q}“` : ""}
          </span>
        </div>
        {list.length === 0 ? (
          <div className="pn-empty">
            <strong>{q ? `Nema zahteva za „${q}“ u ovom prikazu.` : filter.key === "otvoreni" ? "Nema otvorenih zahteva." : "Nema zahteva u ovom prikazu."}</strong>
            <p>{q ? "Proverite broj ili naziv, ili izaberite „Svi“." : "Novi zahtevi se pojavljuju sami; stranica se osvežava na 15 sekundi."}</p>
          </div>
        ) : (
          <ScrollTable label="Spisak zahteva">
            <table className="pn-table pn-table-cards pn-table-sticky">
              <thead>
                <tr>
                  <th scope="col">Broj</th>
                  <th scope="col">Kupac</th>
                  <th scope="col" className="pn-r">
                    Stavki
                  </th>
                  <th scope="col" className="pn-r">
                    Ukupno sa PDV-om
                  </th>
                  <th scope="col">Stanje</th>
                  <th scope="col">Na potezu</th>
                  <th scope="col">Poslato</th>
                </tr>
              </thead>
              <tbody>
                {list.map((o) => {
                  const st = orderStage(o.status, { audience: "office", biznisoftRecorded: Boolean(o.biznisoftDocumentNumber) });
                  const allOnRequest = o.lineCount > 0 && o.onRequestLinesCount >= o.lineCount;
                  return (
                    <tr key={o.id}>
                      <td className="pn-c-name" style={{ minWidth: 140 }}>
                        <Link href={`/portal/zahtevi/${o.id}`} className="pn-row-link pn-num">
                          {o.orderNumber ?? o.requestNumber}
                        </Link>
                        <span className="pn-sub">
                          {o.orderNumber ? `zahtev ${o.requestNumber}` : null}
                          {o.revisionNo > 1 ? `${o.orderNumber ? " · " : ""}verzija ${o.revisionNo}` : null}
                          {!allVersions && o.otherVersions ? ` · u istoriji: ${o.otherVersions}` : null}
                        </span>
                      </td>
                      <td data-label="Kupac" style={{ minWidth: 180 }}>
                        <span style={{ overflowWrap: "anywhere" }}>{o.customerName}</span>
                        {o.paymentOptionLabel ? <span className="pn-sub">{o.paymentOptionLabel}</span> : null}
                      </td>
                      <td className="pn-r pn-num" data-label="Stavki">
                        {o.lineCount}
                      </td>
                      <td className="pn-r" data-label="Ukupno sa PDV-om">
                        {allOnRequest ? (
                          <span className="pn-muted">Iznos još nije utvrđen</span>
                        ) : (
                          <span className="pn-num pn-strong">{money(o.grossTotal, o.currency)}</span>
                        )}
                        {o.onRequestLinesCount && !allOnRequest ? <span className="pn-sub">nije konačno · + {countOf(o.onRequestLinesCount, STAVKA)} na upit</span> : null}
                        {o.priceListKind === "demo" ? <span className="pn-sub">demo cene</span> : null}
                      </td>
                      <td data-label="Stanje">
                        <OrderStatusBadge status={o.status} audience="office" biznisoftRecorded={Boolean(o.biznisoftDocumentNumber)} />
                      </td>
                      <td data-label="Na potezu" style={{ fontWeight: st.turn === "office" ? 650 : 400, color: st.turn === "none" ? "var(--p-muted)" : undefined }}>
                        {st.turn === "office" ? "Kancelarija" : st.turn === "customer" ? "Kupac" : "—"}
                        {st.turn === "office" ? <span className="pn-sub">{st.title}</span> : null}
                      </td>
                      <td className="pn-num" data-label="Poslato">
                        {dmyTime(o.submittedAt).split(" ")[0]}
                        <span className="pn-sub">{dmyTime(o.submittedAt).split(" ")[1]}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ScrollTable>
        )}
        {rows.length >= 200 ? <p className="pn-card-foot">Prikazano je najviše 200 najnovijih zahteva. Za starije koristite pretragu.</p> : null}
      </section>

      {isOwner ? (
        <details className="pn-card">
          <summary style={{ cursor: "pointer", minHeight: 32 }}>
            <strong>Kontrolisana proba</strong> <span className="pn-muted pn-small">· vidljivo samo vlasniku</span>
          </summary>
          <TrialPanel trials={trials} />
        </details>
      ) : null}
      <LiveRefresh endpoint="/api/portal/zahtevi/stanje" stamp={stamp} what="Spisak zahteva" />
    </div>
  );
}
