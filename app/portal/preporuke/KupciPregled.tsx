import Link from "next/link";
import { ClickableRows } from "@/components/portal/ClickableRows";
import { PageHeader } from "@/components/portal/PortalPrimitives";
import { SortHeader } from "@/components/portal/SortHeader";
import { sortRows } from "@/lib/ui/sortRows.mjs";
import type { RecommendationCustomerCount } from "@/lib/recommendations/query";

/**
 * Preporuke — lista kupaca sa brojem preporuka (2026-11-10).
 *
 * Komercijalista ovde bira kupca; klik otvara samo preporuke tog kupca
 * (`/portal/kupci/[id]/preporuke`), gde se pravi ponuda ili artikal odbija sa
 * razlogom — posle čega je broj ovde manji. Detaljan pregled po artiklima
 * ostaje na `?prikaz=artikli` (vlasnik i kancelarija).
 */
/** Kolone za ređanje (adresa: ?red=…&smer=…) i njihov prirodan prvi smer. */
const KOLONE = {
  kupac: { value: (r: RecommendationCustomerCount) => r.customerName, first: "asc" },
  ponuda: { value: (r: RecommendationCustomerCount) => r.total, first: "desc" },
  kasni: { value: (r: RecommendationCustomerCount) => r.overdue, first: "desc" },
  sada: { value: (r: RecommendationCustomerCount) => r.due, first: "desc" },
  uskoro: { value: (r: RecommendationCustomerCount) => r.dueSoon, first: "desc" },
} as const;
type Kolona = keyof typeof KOLONE;

export function KupciPregled({
  rows,
  q,
  red,
  smer,
  hasRun,
  asOfDate,
  showDetailLink,
}: {
  rows: RecommendationCustomerCount[];
  q: string;
  hasRun: boolean;
  asOfDate: string | null;
  showDetailLink: boolean;
  red?: string;
  smer?: string;
}) {
  const key: Kolona = red && red in KOLONE ? (red as Kolona) : "ponuda";
  const dir: "asc" | "desc" = smer === "asc" || smer === "desc" ? smer : KOLONE[key].first;
  const href = (k: Kolona) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    p.set("red", k);
    p.set("smer", k === key ? (dir === "asc" ? "desc" : "asc") : KOLONE[k].first);
    return `/portal/preporuke?${p.toString()}`;
  };
  const head = (k: Kolona, text: string, right = false) => (
    <SortHeader label={text} active={k === key} dir={dir} href={href(k)} align={right ? "right" : "left"} className={right ? "pk-num" : undefined} />
  );
  const t = q.trim().toLocaleLowerCase("sr-Latn");
  const shown = sortRows(t ? rows.filter((r) => r.customerName.toLocaleLowerCase("sr-Latn").includes(t)) : rows, KOLONE[key].value, dir);
  const total = rows.reduce((s, r) => s + r.total, 0);

  return (
    <>
      <PageHeader
        eyebrow="Moji kupci"
        title="Preporuke"
        description="Kupci kojima je vreme za novu porudžbinu. Kliknite na kupca da vidite šta da mu ponudite."
        meta={
          hasRun ? (
            <span>
              {rows.length} kupaca · {total} artikala za ponudu{asOfDate ? ` · obračun ${asOfDate.split("-").reverse().join(".")}.` : ""}
            </span>
          ) : undefined
        }
        actions={showDetailLink ? <Link className="rr-link" href="/portal/preporuke?prikaz=artikli">Detaljno po artiklima →</Link> : undefined}
      />

      <section className="portal-panel">
        <form method="get" className="rr-filters" role="search" aria-label="Pretraga kupaca">
          <label>
            <span>Kupac</span>
            <input type="search" name="q" defaultValue={q} placeholder="Upišite ime kupca" autoComplete="off" />
          </label>
          <input type="hidden" name="red" value={key} />
          <input type="hidden" name="smer" value={dir} />
          <button type="submit">Traži</button>
        </form>

        {!hasRun ? (
          <p className="pk-empty">Preporuke još nisu izračunate.</p>
        ) : (
          <ClickableRows className="portal-table-wrap">
            <table className="portal-table rr-table rr-table--rows pk-table">
              <thead>
                <tr>
                  {head("kupac", "Kupac")}
                  {head("ponuda", "Za ponudu", true)}
                  {head("kasni", "Kasni", true)}
                  {head("sada", "Treba sada", true)}
                  {head("uskoro", "Uskoro", true)}
                  <th scope="col" aria-label="Otvori" />
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.customerId}>
                    <th scope="row">
                      <Link className="rr-row-link" href={`/portal/kupci/${r.customerId}/preporuke`}>{r.customerName}</Link>
                    </th>
                    <td className="pk-num"><span className="pk-count">{r.total}</span></td>
                    <td className="pk-num">{r.overdue ? <span className="pk-late">{r.overdue}</span> : "—"}</td>
                    <td className="pk-num">{r.due || "—"}</td>
                    <td className="pk-num">{r.dueSoon || "—"}</td>
                    <td className="pk-open">Otvori →</td>
                  </tr>
                ))}
                {shown.length === 0 ? (
                  <tr>
                    <td colSpan={6}>{t ? "Nema kupca sa tim imenom među preporukama." : "Nijedan kupac trenutno nema preporuku."}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </ClickableRows>
        )}
      </section>
    </>
  );
}
