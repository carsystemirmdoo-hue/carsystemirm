import Link from "next/link";
import { requireCustomerSession } from "@/lib/authz/customer-session";
import { listRequestArticles, requestOrderingEnabled } from "@/lib/ordering/request-service";
import { AddItem } from "./AddItem";

export const dynamic = "force-dynamic";

const money = (n: number) => `${n.toLocaleString("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RSD`;

/**
 * Izbor robe za zahtev: artikli koje firma kupuje (ili pretraga). Uz svaki —
 * cena za SVAKU odobrenu opciju plaćanja, bez PDV-a, po jedinici mere.
 * Druga cena nije akcija ni precrtana cena; to je cena druge opcije.
 */
export default async function RequestCatalogPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const session = await requireCustomerSession("/kupac/naruci");
  const { q } = await searchParams;
  if (!requestOrderingEnabled()) {
    return (
      <section className="portal-panel">
        <div className="portal-panel-body">
          <p>Poručivanje preko sajta još nije uključeno. Porudžbine i dalje šaljete svom komercijalisti.</p>
        </div>
      </section>
    );
  }
  const { options, articles } = await listRequestArticles(session.customerId, q ?? null);
  return (
    <section className="portal-panel">
      <div className="portal-section-header">
        <div>
          <h2>Izbor robe</h2>
          <p>
            {q ? `Rezultati za „${q}“.` : "Artikli koje Vaša firma kupuje."} Cene su bez PDV-a, po jedinici mere.
            {options.length > 1 ? " Prikazana je cena za svaku Vama odobrenu opciju plaćanja; opciju birate u korpi, za ceo zahtev." : ""}
          </p>
        </div>
        <Link href="/kupac/korpa" className="portal-section-link">Korpa →</Link>
      </div>
      <form method="get" className="rr-filters" role="search">
        <label>
          <span>Pretraga</span>
          <input name="q" defaultValue={q ?? ""} placeholder="šifra ili naziv" />
        </label>
        <button type="submit">Pretražite</button>
      </form>
      <div className="portal-table-wrap">
        <table className="portal-table rr-table kn-table">
          <thead>
            <tr>
              <th scope="col">Artikal</th>
              {options.map((o) => (
                <th scope="col" key={o.key}>{o.label}</th>
              ))}
              <th scope="col">Zahtev</th>
            </tr>
          </thead>
          <tbody>
            {articles.map((a) => (
              <tr key={a.articleId}>
                <th scope="row">
                  {a.articleName}
                  <small>Šifra {a.articleCode} · {a.packConfirmed ? `pakovanje ${a.packLabel}` : `JM: ${a.unit}`}{a.lastOn ? ` · poslednja kupovina ${a.lastOn.split("-").reverse().join(".")}` : ""}</small>
                </th>
                {options.map((o) => {
                  const p = a.byOption[o.key];
                  return (
                    <td key={o.key} data-label={o.label}>
                      {p.status === "cena" ? (
                        <>
                          <strong>{money(p.netPrice)}</strong>
                          <small>bez PDV-a / {a.unit}</small>
                        </>
                      ) : (
                        <small>Cena na upit</small>
                      )}
                    </td>
                  );
                })}
                <td data-label="Zahtev">
                  <AddItem articleId={a.articleId} step={a.step} unit={a.unit} />
                </td>
              </tr>
            ))}
            {articles.length === 0 ? (
              <tr>
                <td colSpan={options.length + 2}>Nema artikala. Pokušajte drugu pretragu.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
