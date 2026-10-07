import Link from "next/link";
import { forbidden, notFound } from "next/navigation";
import { DOCUMENT_KIND_LABELS, srDate } from "@/components/customer/account-format";
import { PageHeader } from "@/components/portal/PortalPrimitives";
import { requireCapability } from "@/lib/authz/session";
import { loadRebateReview } from "@/lib/pricing/rebate-review-service";
import { EXCEPTION_LABELS, RECENT_DAYS, STATUS_LABELS } from "@/lib/pricing/rebateReview.mjs";
import { pct } from "../../format";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EXCEPTIONS_SHOWN = 150;
const TIMELINE_SHOWN = 30;

const BASIS_LABEL: Record<string, string> = {
  literal: "naziv počinje brendom",
  skracenica: "tumačenje prefiksa",
  prva_rec: "prva reč naziva",
  nema: "bez oznake u nazivu",
};

const RULE_STATUS: Record<string, string> = {
  approved_pending_biznisoft: "Odobreno, čeka unos u BizniSoft",
  office_recorded: "Kancelarija evidentirala unos",
  confirmed: "Potvrđeno fakturom",
  draft: "Nacrt",
  pending_approval: "Čeka odobrenje",
};

const invoiceHref = (id: string) => `/portal/prodaja/faktura/${id}`;

export default async function RebateReviewCustomerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ izuzetak?: string }>;
}) {
  const { id } = await params;
  const user = await requireCapability("view:cene", `/portal/cene/rabati-iz-faktura/kupci/${id}`);
  if (!UUID.test(id)) notFound();
  const data = await loadRebateReview(user, id);
  // Kupac postoji, ali nije u opsegu — ista poruka kao za ostale tuđe kupce.
  if (!data) forbidden();

  const { customer, salespeople, review: r, proposals, approvedRules, pendingRules, corrections } = data;
  const kind = (await searchParams).izuzetak;
  const exceptionKind = kind && kind in EXCEPTION_LABELS ? kind : null;
  const exceptions = exceptionKind ? r.exceptions.filter((e) => e.kind === exceptionKind) : r.exceptions;
  const kindCount = (k: string) => r.exceptions.filter((e) => e.kind === k).length;
  const timeline = [...r.timeline].reverse().slice(0, TIMELINE_SHOWN);

  return (
    <>
      <PageHeader
        eyebrow="Pregled rabata po kupcu"
        title={customer.name}
        description="Tri odvojene stvari: šta je zabeleženo na fakturama, šta bi iz toga mogao biti predlog uslova i šta je stvarno odobreno. Ništa na ovoj strani ne menja cene, pravila ni fakture."
        meta={<span>Trenutno zadužen{salespeople.length > 1 ? "i" : ""}: {salespeople.length ? salespeople.join(", ") : "nema dodele"}</span>}
        actions={
          <>
            <Link className="rr-link" href="/portal/cene/rabati-iz-faktura/kupci">← Svi kupci</Link>
            <Link className="rr-link" href={`/portal/kupci/${customer.id}`}>Kartica kupca</Link>
          </>
        }
      />

      {r.invoiceCount === 0 ? (
        <section className="portal-panel">
          <p className="portal-data-note">Kupac nema potvrđenih prodajnih stavki — nema rabata za pregled.</p>
        </section>
      ) : (
        <>
          <section className="portal-metrics rr-metrics" aria-label="Sažetak">
            <div className="portal-metric" data-tone="neutral">
              <span className="portal-metric-label">Poslednji zabeležen rabat</span>
              <strong className="portal-metric-value">{pct(r.last!.percent)}</strong>
              <small className="portal-metric-context">
                {srDate(r.last!.issuedOn)} · <Link href={invoiceHref(r.last!.invoiceId)}>{r.last!.documentLabel}</Link> ·{" "}
                {r.last!.groups.join(", ")}
                {r.last!.mixed ? ` · mešovito: ${r.last!.values.map((v) => `${pct(v.percent)} × ${v.lines}`).join(", ")}` : ""}
              </small>
            </div>
            <div className="portal-metric" data-tone="info">
              <span className="portal-metric-label">Najčešći rabat</span>
              <strong className="portal-metric-value">{pct(r.mode!.percent)}</strong>
              <small className="portal-metric-context">
                na {r.mode!.invoices} od {r.invoiceCount} faktura · {r.mode!.lines} od {r.lineCount} stavki
              </small>
            </div>
            <div className="portal-metric" data-tone={r.status === "stabilan" ? "success" : "warning"}>
              <span className="portal-metric-label">Stanje</span>
              <strong className="portal-metric-value rr-status">{STATUS_LABELS[r.status as keyof typeof STATUS_LABELS]}</strong>
              <small className="portal-metric-context">
                {r.change
                  ? `${r.change.group}: ${pct(r.change.previousPercent)} → ${pct(r.change.currentPercent)} od ${srDate(r.change.since)} (${r.change.sinceLabel}), ${r.change.currentInvoices} faktura zaredom`
                  : `${srDate(r.firstOn!)} – ${srDate(r.lastOn!)}`}
              </small>
            </div>
            <div className="portal-metric" data-tone={r.exceptions.length ? "warning" : "neutral"}>
              <span className="portal-metric-label">Izuzeci</span>
              <strong className="portal-metric-value">{r.exceptions.length}</strong>
              <small className="portal-metric-context">
                {kindCount("moguca_akcija")} akcija? · {kindCount("bez_rabata")} bez rabata · {r.articleDifferences.length} art. poseban
              </small>
            </div>
          </section>

          {corrections.length ? (
            <p className="rb-warn rr-banner" role="status">
              Kupac ima i dokumente koji mogu promeniti stvarni rabat (
              {corrections.map((c) => `${(DOCUMENT_KIND_LABELS[c.document_kind] ?? c.document_kind).toLowerCase()}: ${c.n}`).join(", ")}). Ne ulaze u
              ovaj obračun — proveriti ručno.
            </p>
          ) : null}

          <div className="rr-three">
            <section className="portal-panel rr-block" data-block="istorija">
              <div className="portal-section-header">
                <div>
                  <span className="rr-step">1 · Istorija</span>
                  <h2>Zabeleženo na fakturama</h2>
                  <p>Po predloženoj grupi (iz naziva artikla). Činjenica sa računa, ne uslov.</p>
                </div>
              </div>
              <div className="portal-table-wrap">
                <table className="portal-table">
                  <thead>
                    <tr>
                      <th scope="col">Grupa (predlog)</th>
                      <th scope="col">Najčešći</th>
                      <th scope="col">Poslednji</th>
                      <th scope="col">Ostale vrednosti</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.groups.map((g) => (
                      <tr key={g.label}>
                        <th scope="row">
                          {g.label}
                          <small>
                            {BASIS_LABEL[g.basis]} · {g.lines} stavki, {g.invoices} fakt.
                          </small>
                        </th>
                        <td>
                          <strong>{pct(g.percent)}</strong>
                          <small>{Math.round(g.share * 100)} % stavki</small>
                        </td>
                        <td>
                          {pct(g.last.percent)}
                          <small>
                            <Link href={invoiceHref(g.last.invoiceId)}>{g.last.documentLabel}</Link> · {srDate(g.last.issuedOn)}
                          </small>
                          {g.change ? (
                            <small className="rr-change">
                              promena {pct(g.change.previousPercent)} → {pct(g.change.currentPercent)} od {srDate(g.change.since)}
                            </small>
                          ) : null}
                        </td>
                        <td>
                          {g.values.length > 1
                            ? g.values
                                .slice(1, 5)
                                .map((v) => `${pct(v.percent)} × ${v.lines}`)
                                .join(", ")
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="portal-panel rr-block" data-block="predlog">
              <div className="portal-section-header">
                <div>
                  <span className="rr-step">2 · Predlog uslova</span>
                  <h2>Šta bi moglo postati pravilo</h2>
                  <p>
                    Samo grupe sa ustaljenim rabatom (≥ 85 % stavki, najmanje 2 fakture). Nije sačuvano i ne važi — postaje
                    pravilo tek posle predloga i odobrenja vlasnika.
                  </p>
                </div>
              </div>
              <div className="portal-panel-body">
                {proposals.length ? (
                  <ul className="rr-plain">
                    {proposals.map((p) => (
                      <li key={p.group}>
                        <strong>
                          {p.group}: {pct(p.percent)}
                        </strong>{" "}
                        <span className="kk-status" data-tone="info">predlog</span>
                        <small>
                          {p.lines} stavki na {p.invoices} faktura ({Math.round(p.share * 100)} %)
                          {p.changedRecently ? ` · rabat promenjen u poslednjih ${RECENT_DAYS} dana — proveriti pre predloga` : ""}
                        </small>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="rb-note">Nijedna grupa nema dovoljno ustaljen rabat za predlog.</p>
                )}
                {pendingRules.length ? (
                  <>
                    <h3 className="rr-sub">Već predloženo, čeka odluku</h3>
                    <ul className="rr-plain">
                      {pendingRules.map((p) => (
                        <li key={p.id}>
                          {p.target}: <strong>{p.value}</strong> <small>{RULE_STATUS[p.status] ?? p.status}, od {srDate(p.effectiveFrom)}</small>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </div>
            </section>

            <section className="portal-panel rr-block" data-block="odobreno">
              <div className="portal-section-header">
                <div>
                  <span className="rr-step">3 · Odobreno</span>
                  <h2>Važeće pravilo u portalu</h2>
                  <p>Jedino ovo je odluka firme. Istorijski rabat se ovde ne prepisuje automatski.</p>
                </div>
              </div>
              <div className="portal-panel-body">
                {approvedRules.length ? (
                  <ul className="rr-plain">
                    {approvedRules.map((p) => (
                      <li key={p.id}>
                        {p.target}: <strong>{p.value}</strong>{" "}
                        <small>
                          {RULE_STATUS[p.status] ?? p.status} · od {srDate(p.effectiveFrom)}
                          {p.effectiveTo ? ` do ${srDate(p.effectiveTo)}` : ""}
                          {p.via ? ` · ${p.via}` : ""}
                        </small>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="rb-note">
                    Nema odobrenog pravila za ovog kupca. Važi ono što je u BizniSoftu; portal ne izvodi uslov iz istorije.
                  </p>
                )}
              </div>
            </section>
          </div>

          {r.articleDifferences.length ? (
            <section className="portal-panel">
              <div className="portal-section-header">
                <div>
                  <h2>Artikli sa posebnim rabatom · {r.articleDifferences.length}</h2>
                  <p>Artikal na najmanje 2 fakture uvek ima isti rabat, različit od najčešćeg u svojoj predloženoj grupi.</p>
                </div>
              </div>
              <div className="portal-table-wrap">
                <table className="portal-table">
                  <thead>
                    <tr>
                      <th scope="col">Artikal</th>
                      <th scope="col">Grupa (predlog)</th>
                      <th scope="col">Rabat artikla</th>
                      <th scope="col">Najčešći u grupi</th>
                      <th scope="col">Fakture (poslednje)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.articleDifferences.map((a) => (
                      <tr key={a.articleCode}>
                        <th scope="row">
                          {a.articleCode}
                          <small>{a.articleName ?? ""}</small>
                        </th>
                        <td>{a.group}</td>
                        <td>
                          <strong>{pct(a.percent)}</strong>
                          <small>
                            {a.lines} stavki, {a.invoices} fakt.
                          </small>
                        </td>
                        <td>{pct(a.expected)}</td>
                        <td>
                          {a.samples.map((s, i) => (
                            <span key={s.invoiceId}>
                              {i ? ", " : ""}
                              <Link href={invoiceHref(s.invoiceId)}>{s.documentLabel}</Link> ({srDate(s.issuedOn)})
                            </span>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          <section className="portal-panel" id="izuzeci">
            <div className="portal-section-header">
              <div>
                <h2>Izuzeci na stavkama · {r.exceptions.length}</h2>
                <p>
                  „Moguća akcija“ je pretpostavka (rabat ≥ 50 %), ne potvrda. Odstupanje se računa samo u grupi čiji je rabat
                  ustaljen.
                </p>
              </div>
              <nav className="rr-chips" aria-label="Vrsta izuzetka">
                <Link href="?#izuzeci" aria-current={exceptionKind === null ? "true" : undefined}>
                  Svi ({r.exceptions.length})
                </Link>
                {Object.entries(EXCEPTION_LABELS).map(([k, label]) => (
                  <Link key={k} href={`?izuzetak=${k}#izuzeci`} aria-current={exceptionKind === k ? "true" : undefined}>
                    {label} ({kindCount(k)})
                  </Link>
                ))}
              </nav>
            </div>
            <div className="portal-table-wrap">
              <table className="portal-table">
                <thead>
                  <tr>
                    <th scope="col">Faktura</th>
                    <th scope="col">Datum</th>
                    <th scope="col">Artikal</th>
                    <th scope="col">Rabat</th>
                    <th scope="col">Uobičajeno u grupi</th>
                    <th scope="col">Vrsta</th>
                  </tr>
                </thead>
                <tbody>
                  {exceptions.slice(0, EXCEPTIONS_SHOWN).map((e, i) => (
                    <tr key={`${e.invoiceId}-${e.lineNumber}-${e.articleCode}-${i}`}>
                      <th scope="row">
                        <Link href={invoiceHref(e.invoiceId)}>{e.documentLabel}</Link>
                        {e.lineNumber ? <small>stavka {e.lineNumber}</small> : null}
                      </th>
                      <td className="portal-table-nowrap">{srDate(e.issuedOn)}</td>
                      <td>
                        <strong>{e.articleCode}</strong>
                        <small>{e.articleName ?? ""}</small>
                      </td>
                      <td>
                        <strong>{pct(e.percent)}</strong>
                      </td>
                      <td>
                        {e.expected === null ? "—" : pct(e.expected)}
                        <small>{e.group}</small>
                      </td>
                      <td>{EXCEPTION_LABELS[e.kind as keyof typeof EXCEPTION_LABELS]}</td>
                    </tr>
                  ))}
                  {exceptions.length === 0 ? (
                    <tr>
                      <td colSpan={6}>Nema izuzetaka ove vrste.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            {exceptions.length > EXCEPTIONS_SHOWN ? (
              <p className="portal-data-note">
                Prikazano najnovijih {EXCEPTIONS_SHOWN} od {exceptions.length}. Suzite vrstu izuzetka.
              </p>
            ) : null}
          </section>

          <section className="portal-panel">
            <details className="rr-details">
              <summary>
                Fakture redom (najnovije prve) · {r.invoiceCount}
              </summary>
              <div className="portal-table-wrap">
                <table className="portal-table">
                  <thead>
                    <tr>
                      <th scope="col">Faktura</th>
                      <th scope="col">Datum</th>
                      <th scope="col">Rabat na fakturi</th>
                      <th scope="col">Stavki</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timeline.map((t) => (
                      <tr key={t.invoiceId}>
                        <th scope="row">
                          <Link href={invoiceHref(t.invoiceId)}>{t.documentLabel}</Link>
                        </th>
                        <td className="portal-table-nowrap">{srDate(t.issuedOn)}</td>
                        <td>{t.mixed ? t.values.map((v) => `${pct(v.percent)} × ${v.lines}`).join(", ") : pct(t.percent)}</td>
                        <td className="portal-table-number">{t.lineCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {r.invoiceCount > TIMELINE_SHOWN ? (
                <p className="portal-data-note">Prikazano poslednjih {TIMELINE_SHOWN} od {r.invoiceCount} faktura.</p>
              ) : null}
            </details>
          </section>
        </>
      )}
    </>
  );
}
