import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Metric, PageHeader, SectionHeader } from "@/components/portal/PortalPrimitives";
import { PriceListApplyForm, PriceListDiscardForm, type UnclearRow } from "@/features/portal/PriceListForms";
import { requireCapability } from "@/lib/authz/session";
import { rowsToApply } from "@/lib/pricing/priceListMatch.mjs";
import { loadPriceListReview, trialPriceCalculation } from "@/lib/pricing/price-list-service";
import { dmy, dmyTime, percent, quantity } from "@/lib/ordering/panelFormat.mjs";

export const dynamic = "force-dynamic";

const N = new Intl.NumberFormat("sr-Latn-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const D = { format: (d: Date) => dmy(d) };
const DT = { format: (d: Date) => dmyTime(d) };
const rsd = (cents: number | null | undefined) => (cents === null || cents === undefined ? "—" : N.format(cents / 100));
const day = (iso: string | null) => (iso ? D.format(new Date(`${iso}T12:00:00Z`)) : "—");
const pct = (a: number, b: number) => `${a > b ? "+" : ""}${percent(Math.round(((a / b) - 1) * 1000) / 10)}`;
const MAX_ROWS = 400;

const TRIAL_LABELS: Record<string, string> = {
  isto: "Ista neto cena kao na poslednjoj fakturi",
  novaOsnovica: "Isti rabat, nova osnovna cena (razlika zbog cenovnika)",
  bezPravilaSaRabatomNaFakturi: "Portal nema odobren rabat, a poslednja faktura ga je imala",
  drugiRabat: "Odobren rabat se razlikuje od rabata na poslednjoj fakturi",
  sukob: "Sukob pravila (rabat se ne računa dok ga čovek ne razreši)",
  ostalo: "Ostalo",
};

export default async function PriceListReviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ datum?: string; isti?: string }> }) {
  const user = await requireCapability("pricelist:manage", "/portal/cene/cenovnik");
  const { id } = await params;
  const { datum, isti } = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const review = await loadPriceListReview(user, id, datum);
  if (!review) notFound();
  const imp = review.import;
  const trial = await trialPriceCalculation(user, id, review.onDate, 8);
  const s = review.summary;
  const changes = review.rows
    .filter((r) => r.status === "povezano" && r.change !== "ista")
    .sort((a, b) => (b.currentCents && a.currentCents ? Math.abs(b.vpPriceCents / b.currentCents - 1) - Math.abs(a.vpPriceCents / a.currentCents - 1) : 0));
  const unclear: UnclearRow[] = review.rows
    .filter((r) => r.status === "nejasno")
    .map((r) => ({ code: r.code, pdfName: r.name, portalName: r.articleName, price: rsd(r.vpPriceCents), note: r.note ?? "", applicable: r.change !== "ista" }));
  const unmatched = review.rows.filter((r) => r.status === "nepovezano");
  const broken = review.rows.filter((r) => r.status === "duplikat" || r.status === "neispravna_cena");
  const problems = (imp.problems as { kind: string; page?: number; code?: string; detail?: string }[]) ?? [];
  const checks = imp.checks as { rows: number; totalVpMatches: boolean; rowChecksFailed: number };
  const vats = [...new Set(review.rows.map((r) => r.vatPercent))];
  const willApply = rowsToApply(review.rows).length;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeader
        eyebrow="Cenovnik"
        title={imp.fileName}
        description="Pregled pre primene. Ništa od ovoga još nije osnovna cena — upisuje se tek posle Vaše potvrde."
        meta={<span><Link href="/portal/cene/cenovnik">← Svi cenovnici</Link> · otpremio {DT.format(imp.uploadedAt)}</span>}
      />
      {isti ? (
        <p className="portal-permission-ok" role="status">
          Isti fajl je već otpremljen {DT.format(imp.uploadedAt)} — nov unos nije napravljen. Prikazano je postojeće otpremanje.
        </p>
      ) : null}

      <section className="portal-panel">
        <SectionHeader title="Šta PDF sadrži" description="Pročitano iz samog dokumenta; ništa se ne pretpostavlja iz naziva fajla." />
        <dl className="pl-facts">
          <div><dt>Izveštaj</dt><dd>{imp.reportTitle}{imp.businessUnit ? ` · ${imp.businessUnit}` : ""}</dd></div>
          <div><dt>Stanje na dan</dt><dd>{day(imp.reportDate)} — datum STANJA, ne početak važenja</dd></div>
          <div><dt>Datum štampe</dt><dd>{day(imp.printDate)}</dd></div>
          <div><dt>Strana / stavki</dt><dd>{imp.pageCount} / {imp.rowCount}</dd></div>
          <div><dt>Kontrola čitanja</dt><dd>{checks.totalVpMatches && checks.rowChecksFailed === 0 ? <Badge tone="success">zbir VP vrednosti i svi redovi se slažu</Badge> : <Badge tone="danger">ne slaže se — primena je zaključana</Badge>}</dd></div>
          <div><dt>Cena</dt><dd>VP cena bez PDV-a — potvrđeno na fakturama (jedinična cena = VP, PDV 20 % se dodaje posebno)</dd></div>
          <div><dt>Valuta</dt><dd>{imp.currency} — <strong>nije navedena</strong> ni u cenovniku ni na fakturama; potvrđuje se pri primeni</dd></div>
          <div><dt>PDV</dt><dd>{vats.map((v) => `${v} %`).join(", ")}</dd></div>
          <div><dt>Jedinica mere</dt><dd>PDF je ne sadrži; koristi se jedinica artikla iz portala</dd></div>
          <div><dt>Ne čuva se</dt><dd>nabavna cena, količina na stanju, vrednosti i % RuC</dd></div>
        </dl>
      </section>

      <section className="portal-metrics">
        <Metric label="Povezano" value={quantity(s.povezano)} tone="success" context={`nove ${s.nova} · promena ${s.promena} · iste ${s.ista}`} />
        <Metric label="Nejasno" value={quantity(s.nejasno)} tone={s.nejasno ? "warning" : "neutral"} context="samo uz Vašu potvrdu" />
        <Metric label="Nepovezano" value={quantity(s.nepovezano)} tone={s.nepovezano ? "warning" : "neutral"} context="šifra ne postoji u portalu" />
        <Metric label="Duplikati i greške" value={quantity(s.duplikat + s.neispravnaCena)} tone={s.duplikat + s.neispravnaCena ? "danger" : "neutral"} context={`velika promena (>30 %): ${s.velikaPromena}`} />
      </section>

      {problems.length ? (
        <section className="portal-panel" data-accent="danger">
          <SectionHeader title="Problemi pri čitanju" description="Ove stavke se ne primenjuju." />
          <ul>{problems.slice(0, 50).map((p, i) => <li key={i}>{p.kind}{p.code ? ` · ${p.code}` : ""}{p.page ? ` · strana ${p.page}` : ""}{p.detail ? ` — ${p.detail}` : ""}</li>)}</ul>
        </section>
      ) : null}

      <section className="portal-panel">
        <SectionHeader
          title={`Promene osnovne cene (${changes.length})`}
          description={`Prema važećoj osnovnoj ceni na dan ${day(review.onDate)} „Poslednja na fakturi“ je samo informacija — nije izvor cene.`}
        />
        <div className="portal-table-wrap">
          <table className="portal-table">
            <thead><tr><th>Šifra</th><th>Naziv</th><th className="portal-table-number">Važeća</th><th className="portal-table-number">Nova</th><th className="portal-table-number">Promena</th><th className="portal-table-number">Poslednja na fakturi</th><th>Napomena</th></tr></thead>
            <tbody>
              {changes.slice(0, MAX_ROWS).map((r) => (
                <tr key={r.code}>
                  <td>{r.code}</td><td>{r.name}</td>
                  <td className="portal-table-number">{rsd(r.currentCents)}</td>
                  <td className="portal-table-number">{rsd(r.vpPriceCents)}</td>
                  <td className="portal-table-number">{r.currentCents ? pct(r.vpPriceCents, r.currentCents) : "nova"}</td>
                  <td className="portal-table-number">{r.lastInvoiced ? `${rsd(r.lastInvoiced.cents)} (${day(r.lastInvoiced.on)})` : "—"}</td>
                  <td>
                    {r.flags.includes("velika_promena") ? <Badge tone="warning">velika promena</Badge> : null}
                    {r.flags.includes("bez_jedinice_mere") ? <Badge tone="neutral">bez JM u portalu</Badge> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {changes.length > MAX_ROWS ? <p className="portal-empty">Prikazano prvih {MAX_ROWS} od {changes.length} (najveće promene prve).</p> : null}
      </section>

      <section className="portal-panel">
        <SectionHeader title={`Nepovezane šifre (${unmatched.length})`} description="Šifra iz cenovnika ne postoji u portalu (artikal još nije fakturisan). Ne primenjuju se; artikal dobija cenu tek kada postoji u portalu." />
        {unmatched.length ? (
          <div className="portal-table-wrap">
            <table className="portal-table">
              <thead><tr><th>Šifra</th><th>Naziv u cenovniku</th><th className="portal-table-number">VP cena</th><th className="portal-table-number">Strana</th></tr></thead>
              <tbody>{unmatched.slice(0, MAX_ROWS).map((r) => <tr key={r.code}><td>{r.code}</td><td>{r.name}</td><td className="portal-table-number">{rsd(r.vpPriceCents)}</td><td className="portal-table-number">{r.page}</td></tr>)}</tbody>
            </table>
          </div>
        ) : <p className="portal-empty">Nema.</p>}
      </section>

      {broken.length ? (
        <section className="portal-panel" data-accent="danger">
          <SectionHeader title={`Duplikati i neispravne cene (${broken.length})`} description="Ne primenjuju se ni uz potvrdu." />
          <ul>{broken.map((r, i) => <li key={i}>{r.code} · {r.name} — {r.note}</li>)}</ul>
        </section>
      ) : null}

      <section className="portal-panel">
        <SectionHeader
          title="Probni obračun sa odobrenim rabatima"
          description={`Osnovna cena iz ovog cenovnika + odobreni rabati, za parove kupac–artikal fakturisane u 6 meseci pre ${day(trial.onDate)}, upoređeno sa poslednjom fakturom. Ništa se ne upisuje.`}
        />
        <ul className="pl-trial">
          {Object.entries(trial.counts).filter(([k]) => k !== "parova").map(([k, v]) => <li key={k}><strong>{v}</strong> {TRIAL_LABELS[k] ?? k}</li>)}
          <li>Ukupno parova: <strong>{trial.counts.parova}</strong></li>
        </ul>
        <div className="portal-table-wrap">
          <table className="portal-table">
            <thead><tr><th>Slučaj</th><th>Kupac</th><th>Artikal</th><th className="portal-table-number">Osnovna</th><th className="portal-table-number">Rabat</th><th className="portal-table-number">Konačna (portal)</th><th>Poslednja faktura</th><th className="portal-table-number">Osnovna / rabat / neto na fakturi</th></tr></thead>
            <tbody>
              {(trial.examples as { kind: string; customer: string; code: string; name: string; baseCents: number; rulePercent: number | null; fixedNet: number | null; portalNetCents: number; invoice: string; invoiceOn: string; invoiceBaseCents: number; invoiceDiscount: number; invoiceNetCents: number }[]).map((e, i) => (
                <tr key={i}>
                  <td>{TRIAL_LABELS[e.kind] ?? e.kind}</td><td>{e.customer}</td><td>{e.code} {e.name}</td>
                  <td className="portal-table-number">{rsd(e.baseCents)}</td>
                  <td className="portal-table-number">{e.rulePercent !== null ? `${e.rulePercent} %` : e.fixedNet !== null ? "fiksna" : "—"}</td>
                  <td className="portal-table-number">{rsd(e.portalNetCents)}</td>
                  <td>{e.invoice} · {day(e.invoiceOn)}</td>
                  <td className="portal-table-number">{rsd(e.invoiceBaseCents)} / {e.invoiceDiscount} % / {rsd(e.invoiceNetCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {imp.status === "pregled" ? (
        <>
          <section className="portal-panel" data-accent="warning">
            <SectionHeader
              title="Primena"
              description={review.canApply ? "Upisuje osnovne cene od izabranog datuma. Ista cena se ne upisuje ponovo; nepovezane, duplikati i nejasne bez potvrde se preskaču." : "Kontrole čitanja nisu prošle — ovaj cenovnik se ne može primeniti. Odbacite ga i otpremite ispravan PDF."}
            />
            {review.canApply ? <PriceListApplyForm importId={imp.id} reportDate={imp.reportDate} defaultDate={today < imp.reportDate ? imp.reportDate : today} unclear={unclear} toApply={willApply} /> : null}
          </section>
          <section className="portal-panel">
            <SectionHeader title="Odbacivanje" description="Cenovnik ostaje u istoriji kao odbačen; osnovne cene se ne menjaju." />
            <PriceListDiscardForm importId={imp.id} />
          </section>
        </>
      ) : (
        <section className="portal-panel">
          <SectionHeader
            title={imp.status === "primenjeno" ? "Primenjeno" : "Odbačeno"}
            description={imp.status === "primenjeno" ? `Važi od ${day(imp.validFrom)} · upisano ${imp.appliedCount} osnovnih cena · ${imp.decidedAt ? DT.format(imp.decidedAt) : ""}` : `${imp.decidedAt ? DT.format(imp.decidedAt) : ""}`}
          />
          {imp.decisionNote ? <p>{imp.decisionNote}</p> : null}
        </section>
      )}
    </>
  );
}
