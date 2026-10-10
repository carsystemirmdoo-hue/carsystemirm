import { amount, dmy, percent } from "@/lib/ordering/panelFormat.mjs";
import { DateField } from "@/components/portal/DateField";
import Link from "next/link";
import { asc } from "drizzle-orm";
import { Badge, PageHeader } from "@/components/portal/PortalPrimitives";
import { getDb } from "@/db/client";
import { articles } from "@/db/schema";
import { requireCapability } from "@/lib/authz/session";
import { listRuleConflicts, previewPricing } from "@/lib/pricing/evaluation-service";
import {
  listScopedCustomers,
  PricingScopeError,
  resolvePricingScope,
} from "@/lib/pricing/pricing-scope";
import { precedenceLabelFor, PRECEDENCE_LEVELS } from "@/lib/pricing/precedence.mjs";
import {
  PRICE_RULE_STATUS_LABELS,
  PRICE_RULE_STATUS_TONES,
} from "@/lib/portal/status-labels";

const CUSTOMER_SCOPE_LABELS: Record<string, string> = {
  customer: "jedan kupac",
  group: "grupa kupaca",
  all: "svi kupci",
};
const PRODUCT_SCOPE_LABELS: Record<string, string> = {
  article: "jedan artikal",
  product_group: "grupa proizvoda",
  brand: "proizvođač",
  all: "svi proizvodi",
};

export const dynamic = "force-dynamic";

/**
 * Pregled cena: matrica prvenstva, konflikti i provera konkretnog para.
 *
 * Ekran namerno počinje matricom. „Zašto ova cena" je pitanje koje
 * komercijalista dobija od kupca, i odgovor mora biti vidljiv pre nego što se
 * bilo šta izračuna.
 */
export default async function PricesOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ kupac?: string; artikal?: string; datum?: string }>;
}) {
  const user = await requireCapability("view:cene", "/portal/cene");
  const params = await searchParams;

  const db = getDb();
  const scope = await resolvePricingScope(user);

  const [customerOptions, articleOptions, conflicts] = await Promise.all([
    // Izbornik je već skopiran — ne nudi kupca kog korisnik ne sme da dodirne.
    listScopedCustomers(user),
    db
      .select({ id: articles.id, code: articles.code, name: articles.name })
      .from(articles)
      .orderBy(asc(articles.code))
      .limit(1000),
    listRuleConflicts(scope),
  ]);

  /*
   * `params.kupac` dolazi iz adrese. `previewPricing` ga provlači kroz
   * `assertPricingCustomerAccess` PRE ijednog upita; odbijanje je 403, ne
   * prazan rezultat — pokušaj mora biti vidljiv.
   */
  let preview = null;
  let previewError: string | null = null;
  if (params.kupac && params.artikal) {
    try {
      preview = await previewPricing({
        customerId: params.kupac,
        articleId: params.artikal,
        onDate: params.datum,
        viewer: user,
      });
    } catch (error) {
      if (error instanceof PricingScopeError) previewError = error.message;
      else throw error;
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Finansije"
        title="Cene i rabati"
        description="Cena se izvodi determinističkom matricom prvenstva. Kada dva pravila iste klase važe za isti dan i isti opseg, rezultat je konflikt — sistem ne bira."
        meta={
          conflicts.length > 0 ? (
            <Badge tone="danger">Konflikata: {conflicts.length}</Badge>
          ) : (
            <Badge tone="success">Bez konflikata</Badge>
          )
        }
      />

      {conflicts.length > 0 ? (
        <section className="portal-panel" data-accent="danger">
          <h2>Konflikti pravila</h2>
          <p>
            Sledeći opsezi imaju dva ili više aktivnih pravila iste klase sa
            preklopljenim važenjem. Dok traju, cena za te parove se ne izvodi.
          </p>
          <div className="portal-table-wrap">
            <table className="portal-table">
              <thead>
                <tr>
                  <th scope="col">Klasa</th>
                  <th scope="col">Opseg</th>
                  <th scope="col">Broj pravila</th>
                </tr>
              </thead>
              <tbody>
                {conflicts.map((conflict) => (
                  <tr key={`${conflict.precedenceLevel}-${conflict.scopeKey}`}>
                    <td>
                      <strong>{conflict.precedenceLevel}</strong>
                      <small>{precedenceLabelFor(conflict.precedenceLevel)}</small>
                    </td>
                    <td>{conflict.scopeKey}</td>
                    <td>{conflict.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            <Link href="/portal/cene/istorija">Otvorite istoriju</Link> da vidite
            koja se pravila sudaraju i opozovete jedno od njih.
          </p>
        </section>
      ) : null}

      <section className="portal-panel">
        <h2>Provera konkretne cene</h2>
        <p>
          Rezultat pokazuje pobedničko pravilo, sva razmatrana pravila i razlog
          odluke — ne samo broj.
        </p>
        <form className="portal-filters" method="get">
          <label className="portal-field">
            <span>Kupac</span>
            <select name="kupac" defaultValue={params.kupac ?? ""} required>
              <option value="">— izaberite —</option>
              {customerOptions.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </label>
          <label className="portal-field">
            <span>Artikal</span>
            <select name="artikal" defaultValue={params.artikal ?? ""} required>
              <option value="">— izaberite —</option>
              {articleOptions.map((article) => (
                <option key={article.id} value={article.id}>
                  {article.code} — {article.name}
                </option>
              ))}
            </select>
          </label>
          <DateField name="datum" label="Na dan" defaultValue={params.datum ?? ""} />
          <button className="portal-button" type="submit" data-variant="primary">
            <span>Proverite</span>
          </button>
        </form>

        {customerOptions.length === 0 || articleOptions.length === 0 ? (
          <p className="portal-login-hint">
            Provera traži bar jednog kupca i jedan artikal iz uvoza. Do tada nema
            šta da se proveri — i namerno se ne prikazuje primer.
          </p>
        ) : null}

        {previewError ? (
          <div className="portal-login-error" role="alert">
            <span>
              <strong>Prikaz odbijen</strong>
              <small>{previewError}</small>
            </span>
          </div>
        ) : null}

        {preview ? (
          <div className="portal-panel" data-accent={preview.conflict.length > 0 ? "danger" : "info"}>
            <h3>
              {preview.customerName} · {preview.articleCode} ({dmy(preview.onDate)})
            </h3>
            <p>{preview.reason}</p>
            {preview.winner ? (
              <p>
                <Badge tone={PRICE_RULE_STATUS_TONES[preview.winner.status] ?? "neutral"}>
                  {PRICE_RULE_STATUS_LABELS[preview.winner.status]}
                </Badge>{" "}
                {preview.confirmed ? null : (
                  <strong>
                    Odobreno, ali NIJE potvrđeno kao upisano u BizniSoft — nije
                    garantovana fakturisana cena.
                  </strong>
                )}
              </p>
            ) : null}
            {preview.considered.length > 0 ? (
              <div className="portal-table-wrap">
                <table className="portal-table">
                  <thead>
                    <tr>
                      <th scope="col">Klasa</th>
                      <th scope="col">Opseg</th>
                      <th scope="col">Vrednost</th>
                      <th scope="col">Ishod</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.considered.map((rule) => (
                      <tr key={rule.id}>
                        <td>
                          <strong>{rule.level}</strong>
                          <small>{precedenceLabelFor(rule.level)}</small>
                        </td>
                        <td>{rule.scopeKey}</td>
                        <td>
                          {rule.valueKind === "net_price"
                            ? `${amount(Number(rule.netPrice))}\u00a0${rule.currency}`
                            : percent(Number(rule.discountPercent))}
                        </td>
                        <td>
                          {preview.winner?.id === rule.id
                            ? "Pobedilo"
                            : preview.conflict.some((item) => item.id === rule.id)
                              ? "Konflikt"
                              : "Nadjačano"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="portal-panel">
        <h2>Matrica prvenstva</h2>
        <p>
          Uži opseg uvek pobeđuje širi. Redosled je podatak u kodu, ne skrivena
          lestvica uslova — zato se može ispisati ovde i uporediti sa dogovorom.
        </p>
        <div className="portal-table-wrap">
          <table className="portal-table">
            <thead>
              <tr>
                <th scope="col">Klasa</th>
                <th scope="col">Opseg kupca</th>
                <th scope="col">Opseg proizvoda</th>
              </tr>
            </thead>
            <tbody>
              {PRECEDENCE_LEVELS.map((entry) => (
                <tr key={entry.level}>
                  <td>
                    <strong>{entry.level}</strong>
                    <small>{entry.label}</small>
                  </td>
                  <td>{CUSTOMER_SCOPE_LABELS[entry.customerScope] ?? entry.customerScope}</td>
                  <td>{PRODUCT_SCOPE_LABELS[entry.productScope] ?? entry.productScope}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
