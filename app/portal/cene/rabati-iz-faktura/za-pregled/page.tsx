import Link from "next/link";
import { srDate } from "@/components/customer/account-format";
import { CrumbLabel } from "@/components/portal/Breadcrumbs";
import { PageHeader } from "@/components/portal/PortalPrimitives";
import { seesAllCustomers } from "@/lib/authz/permissions.mjs";
import { requireCapability } from "@/lib/authz/session";
import { evaluateRebateArticles } from "@/lib/pricing/rebate-application-service";
import { OUTCOME_LABELS, REVIEW_OUTCOMES } from "@/lib/pricing/rebateApplication.mjs";
import { CRITERIA_TEXT, REBATE_CRITERIA } from "@/lib/pricing/rebateCriteria.mjs";
import { belgradeDate } from "@/lib/recommendations/customerRhythm.mjs";
import { pct } from "../format";

export const dynamic = "force-dynamic";

const SHOWN = 150;
const UNASSIGNED = "Bez dodele — vlasnik";

/**
 * Lista za ručni pregled: parovi kupac–artikal koji NISU automatski
 * pretvoreni u pravilo (sukob, visok rabat, nejasno, kratak period), sa
 * razlogom i dokazima. Razvrstano po trenutno zaduženom komercijalisti;
 * kupci bez dodele idu vlasniku. Opseg je opseg pozivaoca.
 */
export default async function RebateReviewQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ ishod?: string; komercijalista?: string }>;
}) {
  const user = await requireCapability("view:rabati", "/portal/cene/rabati-iz-faktura/za-pregled");
  const sp = await searchParams;
  const ishod = sp.ishod && REVIEW_OUTCOMES.includes(sp.ishod) ? sp.ishod : "sve";
  const komercijalista = (sp.komercijalista ?? "").slice(0, 120);

  const all = (await evaluateRebateArticles(user, belgradeDate(new Date()))).filter((e) => REVIEW_OUTCOMES.includes(e.result.outcome));
  const owner = (e: (typeof all)[number]) => (e.salespeople.length ? e.salespeople.join(", ") : UNASSIGNED);
  const groups = new Map<string, typeof all>();
  for (const e of all) groups.set(owner(e), [...(groups.get(owner(e)) ?? []), e]);
  const owners = [...groups.keys()].sort((a, b) => (a === UNASSIGNED ? 1 : b === UNASSIGNED ? -1 : a.localeCompare(b, "sr-Latn")));
  const counts = Object.fromEntries(REVIEW_OUTCOMES.map((o) => [o, all.filter((e) => e.result.outcome === o).length]));

  const filtered = all
    .filter((e) => (ishod === "sve" || e.result.outcome === ishod) && (!komercijalista || owner(e) === komercijalista))
    .sort((a, b) => owner(a).localeCompare(owner(b), "sr-Latn") || a.customerName.localeCompare(b.customerName, "sr-Latn") || (b.result.lastOn ?? "").localeCompare(a.result.lastOn ?? ""));

  return (
    <>
      <CrumbLabel segment="za-pregled" label="Za pregled" />
      <PageHeader
        eyebrow="Finansije · Rabati iz faktura"
        title="Rabati za ručni pregled"
        description="Slučajevi koji nisu automatski postali pravilo: istorija nije dovoljno dosledna, rabat je visok ili postoji sukob sa odobrenim pravilom. Ništa ovde ne menja cenu."
        meta={
          <span>
            {seesAllCustomers(user) ? "Svi kupci." : "Vaši dodeljeni kupci."} Kriterijumi ({REBATE_CRITERIA.version}, privremeni):{" "}
            {CRITERIA_TEXT[3]}.
          </span>
        }
        actions={
          <>
            <Link className="rr-link" href="/portal/cene/rabati-iz-faktura/predlozi">Pokrivenost i grupni predlozi →</Link>{" "}
            <Link className="rr-link" href="/portal/cene/rabati-iz-faktura/kupci">Pregled po kupcu →</Link>
          </>
        }
      />

      <section className="portal-metrics rr-metrics" aria-label="Po komercijalisti">
        {owners.map((o) => (
          <div key={o} className="portal-metric" data-tone={o === UNASSIGNED ? "warning" : "neutral"}>
            <span className="portal-metric-label">{o}</span>
            <strong className="portal-metric-value">{groups.get(o)!.length}</strong>
            <small className="portal-metric-context">
              {REVIEW_OUTCOMES.map((k) => `${groups.get(o)!.filter((e) => e.result.outcome === k).length} ${OUTCOME_LABELS[k as keyof typeof OUTCOME_LABELS].toLowerCase()}`).join(" · ")}
            </small>
          </div>
        ))}
      </section>

      <section className="portal-panel">
        <form method="get" className="rr-filters" aria-label="Filteri">
          <label>
            <span>Ishod</span>
            <select name="ishod" defaultValue={ishod}>
              <option value="sve">Svi ({all.length})</option>
              {REVIEW_OUTCOMES.map((o) => (
                <option key={o} value={o}>
                  {OUTCOME_LABELS[o as keyof typeof OUTCOME_LABELS]} ({counts[o]})
                </option>
              ))}
            </select>
          </label>
          {owners.length > 1 ? (
            <label>
              <span>Nadležan</span>
              <select name="komercijalista" defaultValue={komercijalista}>
                <option value="">Svi</option>
                {owners.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <button type="submit">Prikažite</button>
        </form>
        <div className="portal-table-wrap">
          <table className="portal-table rr-table">
            <thead>
              <tr>
                <th scope="col">Kupac</th>
                <th scope="col">Artikal</th>
                <th scope="col">Ishod i razlog</th>
                <th scope="col">Poslednje fakture</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, SHOWN).map((e) => (
                <tr key={`${e.customerId}|${e.articleId}`}>
                  <th scope="row">
                    <Link href={`/portal/cene/rabati-iz-faktura/kupci/${e.customerId}?artikli=pregled#artikli`}>{e.customerName}</Link>
                    <small>{owner(e)}</small>
                  </th>
                  <td>
                    {e.articleCode}
                    <small>{e.articleName ?? ""}</small>
                  </td>
                  <td>
                    <span className="kk-status" data-tone={e.result.outcome === "sukob" ? "danger" : "warning"}>
                      {OUTCOME_LABELS[e.result.outcome as keyof typeof OUTCOME_LABELS]}
                    </span>
                    <small>{e.result.reason}</small>
                  </td>
                  <td>
                    {e.result.invoices.slice(-3).reverse().map((i) => (
                      <small key={i.invoiceId}>
                        <Link href={`/portal/prodaja/faktura/${i.invoiceId}`}>{i.documentLabel}</Link> · {srDate(i.issuedOn)} ·{" "}
                        {i.percent === null ? i.values.map((v) => pct(v)).join(" / ") : pct(i.percent)}
                      </small>
                    ))}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4}>Nema slučajeva za izabrane filtere.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {filtered.length > SHOWN ? (
          <p className="portal-data-note">
            Prikazano {SHOWN} od {filtered.length}. Suzite ishod ili nadležnog.
          </p>
        ) : null}
      </section>
    </>
  );
}
