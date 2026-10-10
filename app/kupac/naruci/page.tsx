import Link from "next/link";
import { requireCustomerSession } from "@/lib/authz/customer-session";
import { listRequestArticles } from "@/lib/ordering/request-service";
import { orderingEnabledFor } from "@/lib/ordering/trial";
import { ScrollTable } from "@/components/ordering/ScrollTable";
import { amount, dmy, percent } from "@/lib/ordering/panelFormat.mjs";
import { AddItem } from "./AddItem";

export const dynamic = "force-dynamic";

/**
 * Izbor robe za zahtev: artikli koje firma kupuje (ili pretraga). Uz svaki —
 * cena kupca za SVAKU odobrenu opciju plaćanja, bez PDV-a, po jedinici mere.
 * Druga cena nije akcija ni precrtana cena; to je cena druge opcije.
 */
export default async function RequestCatalogPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const session = await requireCustomerSession("/kupac/naruci");
  const { q } = await searchParams;
  if (!(await orderingEnabledFor(session.customerId))) {
    return (
      <div className="pn">
        <h1 className="pn-title">Izbor robe</h1>
        <div className="pn-card pn-empty">
          <strong>Poručivanje preko sajta još nije uključeno za Vašu firmu.</strong>
          <p>Porudžbine i dalje šaljete svom komercijalisti ili kancelariji.</p>
        </div>
      </div>
    );
  }
  const query = (q ?? "").trim();
  const { options, articles } = await listRequestArticles(session.customerId, query || null);
  return (
    <div className="pn">
      <header className="pn-head">
        <div>
          <h1 className="pn-title">Izbor robe</h1>
          <p className="pn-lead">
            {query ? `Rezultati za „${query}“.` : "Artikli koje Vaša firma kupuje, od poslednje kupovine."} Cene kupca su bez PDV-a, po jedinici mere.
            {options.length > 1 ? " Za svaki artikal prikazana je cena za svaku Vama odobrenu opciju plaćanja; opciju birate u korpi, za ceo zahtev." : ""}
          </p>
        </div>
        <Link href="/kupac/korpa" className="pn-btn" data-size="sm">
          Korpa →
        </Link>
      </header>

      <form method="get" className="pn-card" role="search">
        <div className="pn-filters">
          <div className="pn-field">
            <label htmlFor="naruci-q">Pretraga po šifri ili nazivu</label>
            <input id="naruci-q" type="search" name="q" defaultValue={query} maxLength={60} autoComplete="off" />
          </div>
          <button type="submit" className="pn-btn" data-variant="primary">
            Pretražite
          </button>
          {query ? (
            <Link href="/kupac/naruci" className="pn-btn" data-variant="quiet">
              Prikažite artikle koje kupujete
            </Link>
          ) : null}
        </div>
      </form>

      <section className="pn-card pn-card-flush" aria-labelledby="naruci-lista">
        <div className="pn-card-h">
          <h2 id="naruci-lista">
            {query ? "Rezultati pretrage" : "Artikli koje kupujete"} <span className="pn-muted pn-num" style={{ fontWeight: 400 }}>· {articles.length}</span>
          </h2>
          {articles.length >= 60 ? <span className="pn-small pn-muted">Prikazano prvih 60 — suzite pretragu za ostale.</span> : null}
        </div>
        {articles.length === 0 ? (
          <div className="pn-empty">
            <strong>{query ? `Nema artikla za „${query}“.` : "Još nema kupovina iz kojih bismo prikazali artikle."}</strong>
            <p>{query ? "Proverite šifru ili probajte deo naziva (najmanje dva znaka)." : "Robu pronađite pretragom po šifri ili nazivu."}</p>
          </div>
        ) : (
          <ScrollTable label="Artikli za izbor">
            <table className="pn-table pn-table-cards">
              <thead>
                <tr>
                  <th scope="col">Šifra</th>
                  <th scope="col">Naziv</th>
                  {options.map((o) => (
                    <th scope="col" className="pn-r" key={o.key}>
                      {o.label} <span className="pn-th-sub">cena kupca / JM bez PDV-a</span>
                    </th>
                  ))}
                  <th scope="col">Količina i dodavanje</th>
                </tr>
              </thead>
              <tbody>
                {articles.map((a) => (
                  <tr key={a.articleId}>
                    <td className="pn-c-code">{a.articleCode}</td>
                    <td className="pn-c-name">
                      <span className="pn-strong">{a.articleName}</span>
                      <span className="pn-sub">
                        {a.packConfirmed ? `Pakovanje ${a.packLabel}` : `JM: ${a.unit}`}
                        {a.lastOn ? ` · poslednja kupovina ${dmy(a.lastOn)}` : ""}
                      </span>
                      {a.problem ? <span className="pn-error">{a.problem}</span> : null}
                    </td>
                    {options.map((o) => {
                      const p = a.byOption[o.key];
                      return (
                        <td key={o.key} className="pn-r" data-label={o.label}>
                          {p.status === "cena" ? (
                            <>
                              <span className="pn-num pn-strong">
                                {amount(p.netPrice)} <span className="pn-muted" style={{ fontWeight: 400 }}>/ {a.unit}</span>
                              </span>
                              <span className="pn-sub pn-num">
                                osnovna {amount(p.listPrice)} · rabat {percent(p.discountPercent)}
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="pn-onreq">Na upit</span>
                              <span className="pn-sub">cenu potvrđuje kancelarija</span>
                            </>
                          )}
                        </td>
                      );
                    })}
                    <td className="pn-c-actions" data-label="">
                      <AddItem articleId={a.articleId} step={a.step} unit={a.unit} name={a.articleName} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
        )}
      </section>
    </div>
  );
}
