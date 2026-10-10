import Link from "next/link";
import { forbidden, notFound } from "next/navigation";
import { DOCUMENT_KIND_LABELS, srDate } from "@/components/customer/account-format";
import { PageHeader } from "@/components/portal/PortalPrimitives";
import { can } from "@/lib/authz/permissions.mjs";
import { requireCapability } from "@/lib/authz/session";
import { belgradeDate } from "@/lib/recommendations/customerRhythm.mjs";
import { evaluateRebateArticles } from "@/lib/pricing/rebate-application-service";
import { OUTCOME_LABELS, REVIEW_OUTCOMES } from "@/lib/pricing/rebateApplication.mjs";
import { CRITERIA_TEXT } from "@/lib/pricing/rebateCriteria.mjs";
import { loadRebateReview } from "@/lib/pricing/rebate-review-service";
import { EXCEPTION_LABELS, HIGH_DISCOUNT, RECENT_DAYS, STATUS_LABELS } from "@/lib/pricing/rebateReview.mjs";
import { pct } from "../../format";
import { customerFamilies } from "@/lib/pricing/rebate-change-service";
import { RebateChangePanel } from "./RebateChangePanel";
import { PaymentOptionsPanel } from "./PaymentOptionsPanel";
import { approvedPaymentOptions, listPaymentOptions } from "@/lib/pricing/payment-option-service";
import { customerPricesByOption } from "@/lib/pricing/customer-price-service";
import { customerBrands } from "@/lib/pricing/rebate-change-service";
import { optionLabel } from "@/lib/pricing/paymentOptions.mjs";
import { CommercialStatusForm } from "./CommercialStatusForm";
import { commercialStatuses, type CommercialStatus } from "@/lib/customers/commercial-status-service";
import { COMMERCIAL_STATUSES, statusReason } from "@/lib/customers/commercial-status.mjs";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EXCEPTIONS_SHOWN = 150;
const TIMELINE_SHOWN = 30;
const ARTICLES_SHOWN = 200;

const OUTCOME_TONE: Record<string, string> = {
  primeni: "success",
  vec_vazi: "success",
  sukob: "danger",
  visok_rabat: "warning",
  nejasno: "warning",
  kratko: "warning",
  vec_predlozeno: "info",
};

type Counts = Record<string, number>;
const sum = (c: Counts, keys: readonly string[]) => keys.reduce((n, k) => n + (c[k] ?? 0), 0);
const RULE_OUTCOMES = ["primeni", "vec_vazi", "vec_predlozeno"] as const;
const ARTICLE_FILTERS = [
  { key: "pregled", label: "Za pregled", match: (o: string) => REVIEW_OUTCOMES.includes(o), count: (c: Counts) => sum(c, REVIEW_OUTCOMES) },
  { key: "dosledno", label: "Dosledno / pravilo", match: (o: string) => (RULE_OUTCOMES as readonly string[]).includes(o), count: (c: Counts) => sum(c, RULE_OUTCOMES) },
  { key: "sve", label: "Svi artikli", match: () => true, count: (c: Counts) => sum(c, Object.keys(c)) },
] as const;

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
  searchParams: Promise<{ izuzetak?: string; artikli?: string; predlog?: string }>;
}) {
  const { id } = await params;
  const user = await requireCapability("view:rabati", `/portal/cene/rabati-iz-faktura/kupci/${id}`);
  if (!UUID.test(id)) notFound();
  const data = await loadRebateReview(user, id);
  // Kupac postoji, ali nije u opsegu — ista poruka kao za ostale tuđe kupce.
  if (!data) forbidden();

  const { customer, salespeople, review: r, proposals, approvedRules, pendingRules, corrections } = data;
  const sp = await searchParams;
  const kind = sp.izuzetak;
  const today = belgradeDate(new Date());
  const canPropose = can(user, "prices:propose");
  const articles = await evaluateRebateArticles(user, today, customer.id);
  const articleCounts: Counts = {};
  for (const a of articles) articleCounts[a.result.outcome] = (articleCounts[a.result.outcome] ?? 0) + 1;
  const reviewCount = sum(articleCounts, REVIEW_OUTCOMES);
  const articleFilter = ARTICLE_FILTERS.some((f) => f.key === sp.artikli) ? (sp.artikli as string) : reviewCount ? "pregled" : "dosledno";
  const filterDef = ARTICLE_FILTERS.find((f) => f.key === articleFilter)!;
  const ORDER = ["sukob", "visok_rabat", "nejasno", "kratko", "primeni", "vec_predlozeno", "vec_vazi", "zastarelo", "bez_rabata", "jednokratno"];
  const shownArticles = articles
    .filter((a) => filterDef.match(a.result.outcome))
    .sort((x, y) => ORDER.indexOf(x.result.outcome) - ORDER.indexOf(y.result.outcome) || (y.result.lastOn ?? "").localeCompare(x.result.lastOn ?? ""));
  // „Važi“ = bezuslovno pravilo; uslovni rabat (kratak rok) nikad nije podrazumevan.
  const approvedByArticle = new Map(approvedRules.filter((p) => p.articleId && !p.paymentCondition).map((p) => [p.articleId as string, p]));
  const portalOnlyCount = approvedRules.filter((p) => p.portalOnly).length;
  const formArticles = [...articles]
    .sort((x, y) => (y.result.lastOn ?? "").localeCompare(x.result.lastOn ?? ""))
    .map((a) => {
      const last = a.result.invoices[a.result.invoices.length - 1];
      return {
        articleId: a.articleId,
        articleCode: a.articleCode,
        articleName: a.articleName,
        lastPercent: last?.percent ?? null,
        currentPercent: approvedByArticle.get(a.articleId)?.value ?? null,
      };
    });
  const families = canPropose ? await customerFamilies(user, customer.id, today) : [];
  const status = (await commercialStatuses()).get(customer.id) ?? null;
  const [optionRows, approvedOptions, brands] = await Promise.all([
    listPaymentOptions(customer.id),
    approvedPaymentOptions(customer.id, today),
    canPropose ? customerBrands(user, customer.id) : Promise.resolve([]),
  ]);
  const previewArticles = formArticles.slice(0, 25);
  const priceView = await customerPricesByOption(customer.id, previewArticles.map((a) => a.articleId), today);
  const initialArticle = sp.predlog && articles.some((a) => a.articleId === sp.predlog) ? sp.predlog : null;
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
                {kindCount("visok_rabat")} visok rabat · {kindCount("bez_rabata")} bez rabata · {r.articleDifferences.length} art. poseban
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
                  <span className="rr-step">2 · Predlog</span>
                  <h2>Šta bi moglo postati pravilo</h2>
                  <p>Predlog ne važi dok ga vlasnik ne odobri. Grupe iz naziva su samo informacija, ne osnova pravila.</p>
                </div>
              </div>
              <div className="portal-panel-body">
                <p className="rr-count">
                  Kupac–artikal: <strong>{articleCounts.primeni ?? 0}</strong> doslednih bez pravila ·{" "}
                  <strong>{articleCounts.vec_vazi ?? 0}</strong> već pravilo · <strong>{reviewCount}</strong> za ručni pregled
                </p>
                {proposals.length ? (
                  <ul className="rr-plain">
                    {proposals.map((p) => (
                      <li key={p.group}>
                        <strong>
                          {p.group}: {pct(p.percent)}
                        </strong>{" "}
                        <span className="kk-status" data-tone="info">grupa — predlog iz naziva</span>
                        <small>
                          {p.lines} stavki na {p.invoices} faktura ({Math.round(p.share * 100)} %)
                          {p.changedRecently ? ` · promenjeno u poslednjih ${RECENT_DAYS} dana` : ""}
                        </small>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {pendingRules.length ? (
                  <>
                    <h3 className="rr-sub">Predlozi koji čekaju odluku · {pendingRules.length}</h3>
                    <ul className="rr-plain">
                      {pendingRules.slice(0, 20).map((p) => (
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
                  <h2>Pravila koja važe u portalu</h2>
                  <p>Jedino ovo je odluka firme. „Samo portal“ znači: nije nalog za unos u BizniSoft.</p>
                </div>
              </div>
              <div className="portal-panel-body">
                {approvedRules.length ? (
                  <>
                    <p className="rr-count">
                      <strong>{approvedRules.length}</strong> odobrenih pravila
                      {portalOnlyCount ? ` · ${portalOnlyCount} samo u portalu` : ""}
                    </p>
                    <ul className="rr-plain">
                      {approvedRules.slice(0, 8).map((p) => (
                        <li key={p.id}>
                          {p.target}: <strong>{p.value}</strong>{" "}
                          {p.portalOnly ? <span className="kk-status" data-tone="warning">samo portal</span> : null}
                          <small>
                            {p.portalOnly ? "Odobreno — važi samo u portalu" : (RULE_STATUS[p.status] ?? p.status)} · od {srDate(p.effectiveFrom)}
                            {p.effectiveTo ? ` do ${srDate(p.effectiveTo)}` : ""}
                            {p.via ? ` · ${p.via}` : ""}
                          </small>
                        </li>
                      ))}
                    </ul>
                    {approvedRules.length > 8 ? <small className="rb-note">Ostala pravila su u tabeli artikala ispod.</small> : null}
                  </>
                ) : (
                  <p className="rb-note">Nema odobrenog pravila. Važi ono što je u BizniSoftu.</p>
                )}
              </div>
            </section>
          </div>

          <section className="portal-panel" id="artikli">
            <div className="portal-section-header">
              <div>
                <h2>Artikli: istorija, ocena i pravilo</h2>
                <p>
                  Ocena po paru kupac–artikal (najuži obuhvat). Storna i povrati nisu uključeni. Kriterijumi su privremeni:{" "}
                  {CRITERIA_TEXT[3]}.
                </p>
              </div>
              <nav className="rr-chips" aria-label="Artikli">
                {ARTICLE_FILTERS.map((f) => (
                  <Link key={f.key} href={`?artikli=${f.key}#artikli`} aria-current={articleFilter === f.key ? "true" : undefined}>
                    {f.label} ({f.count(articleCounts)})
                  </Link>
                ))}
              </nav>
            </div>
            <div className="portal-table-wrap">
              <table className="portal-table rr-table">
                <thead>
                  <tr>
                    <th scope="col">Artikal</th>
                    <th scope="col">Istorija (poslednje)</th>
                    <th scope="col">Ocena</th>
                    <th scope="col">Odobreno pravilo</th>
                    {canPropose ? <th scope="col">Predlog</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {shownArticles.slice(0, ARTICLES_SHOWN).map((a) => {
                    const last = a.result.invoices[a.result.invoices.length - 1];
                    const rule = approvedByArticle.get(a.articleId);
                    return (
                      <tr key={a.articleId}>
                        <th scope="row">
                          {a.articleCode}
                          <small>{a.articleName ?? ""}</small>
                        </th>
                        <td>
                          <strong>{last.percent === null ? last.values.map((v) => pct(v)).join(" / ") : pct(last.percent)}</strong>
                          <small>
                            <Link href={invoiceHref(last.invoiceId)}>{last.documentLabel}</Link> · {srDate(last.issuedOn)} · {a.result.invoiceCount} fakt.
                          </small>
                        </td>
                        <td>
                          <span className="kk-status" data-tone={OUTCOME_TONE[a.result.outcome] ?? "neutral"}>
                            {OUTCOME_LABELS[a.result.outcome as keyof typeof OUTCOME_LABELS]}
                          </span>
                          <small>{a.result.reason}</small>
                        </td>
                        <td>
                          {rule ? (
                            <>
                              <strong>{rule.value}</strong>
                              <small>
                                {rule.portalOnly ? "samo portal · " : ""}od {srDate(rule.effectiveFrom)}
                              </small>
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        {canPropose ? (
                          <td>
                            <Link className="rr-link rr-link-sm" href={`?artikli=${articleFilter}&predlog=${a.articleId}#predlog`}>
                              Predložite promenu
                            </Link>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                  {shownArticles.length === 0 ? (
                    <tr>
                      <td colSpan={canPropose ? 5 : 4}>Nema artikala za ovaj filter.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            {shownArticles.length > ARTICLES_SHOWN ? (
              <p className="portal-data-note">Prikazano {ARTICLES_SHOWN} od {shownArticles.length}.</p>
            ) : null}
          </section>

          {status || can(user, "prices:approve") ? (
            <section className="portal-panel" data-accent={status ? "warning" : undefined}>
              <div className="portal-section-header">
                <div>
                  <h2>Poseban poslovni status{status ? `: ${COMMERCIAL_STATUSES[status.status]}` : ""}</h2>
                  <p>
                    {status
                      ? `${statusReason(status.status)}. Obrazloženje: ${status.reason}. Fakture i ranije odobrena pravila ostaju; automatski predlozi i izvedene grupe se ne prave.`
                      : "Redovan kupac. Vlasnik može označiti poseban dogovor, kompenzaciju, uslove plaćanja, retku saradnju ili kupca van pripreme za portal."}
                  </p>
                </div>
              </div>
              {can(user, "prices:approve") ? (
                <div className="portal-panel-body">
                  <CommercialStatusForm customerId={customer.id} current={(status?.status ?? "redovan") as CommercialStatus} />
                </div>
              ) : null}
            </section>
          ) : null}

          <section className="portal-panel" id="opcije-placanja">
            <div className="portal-section-header">
              <div>
                <h2>Opcije plaćanja</h2>
                <p>Kupac bira samo odobrenu opciju. Svaka opcija ima svoje rabate (artikal → grupa → osnovni rabat); opcija bez svog pravila koristi osnovni uslov.</p>
              </div>
            </div>
            <div className="portal-panel-body">
              <PaymentOptionsPanel customerId={customer.id} rows={optionRows} canPropose={canPropose} canApprove={can(user, "prices:approve")} today={today} />
            </div>
          </section>

          <section className="portal-panel" id="cene-kupca">
            <div className="portal-section-header">
              <div>
                <h2>Cena kupca po opciji (pregled)</h2>
                <p>Poslednjih {previewArticles.length} artikala kupca: osnovna cena iz cenovnika, odobreni rabat i cena bez PDV-a po jedinici mere. Ovo vidi kupac na sajtu.</p>
              </div>
            </div>
            <div className="portal-table-wrap">
              <table className="portal-table rr-table">
                <thead>
                  <tr>
                    <th scope="col">Artikal</th>
                    {priceView.options.map((o) => (
                      <th scope="col" key={o.code ?? "osnovni"}>{o.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewArticles.map((a) => (
                    <tr key={a.articleId}>
                      <th scope="row">
                        {a.articleCode}
                        <small>{a.articleName}</small>
                      </th>
                      {priceView.options.map((o) => {
                        const p = o.prices.get(a.articleId);
                        return (
                          <td key={o.code ?? "osnovni"} data-label={o.label}>
                            {p && p.status === "cena" ? (
                              <>
                                <strong>{(p.netCents / 100).toLocaleString("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RSD</strong>
                                <small>bez PDV-a / {p.unit ?? "JM"} · rabat {p.discountPercent ?? "—"} %</small>
                              </>
                            ) : (
                              <small>{p && "message" in p ? p.message : "—"}</small>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {canPropose ? (
            <section className="portal-panel">
              <div className="portal-section-header">
                <div>
                  <h2>Promena rabata</h2>
                  <p>Jedan artikal, potvrđena grupa ili više artikala. Prvo pregled svih obuhvaćenih artikala, pa slanje. Predlog ide vlasniku na odobrenje i ne menja cenu dok ga ne odobri.</p>
                </div>
              </div>
              <div className="portal-panel-body">
                <RebateChangePanel
                  customerId={customer.id}
                  customerName={customer.name}
                  today={today}
                  initialArticleId={initialArticle}
                  articles={formArticles}
                  families={families}
                  brands={brands}
                  options={approvedOptions.map((c) => ({ code: c, label: optionLabel(c) }))}
                  canApprove={can(user, "prices:approve")}
                />
              </div>
            </section>
          ) : null}

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
                  „Visok rabat — proveriti“: rabat ≥ {HIGH_DISCOUNT} %; sam procenat ne dokazuje akciju. Odstupanje se računa samo u grupi čiji je rabat
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
