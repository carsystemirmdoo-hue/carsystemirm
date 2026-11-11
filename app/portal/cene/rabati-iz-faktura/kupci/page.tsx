import Link from "next/link";
import { srDate } from "@/components/customer/account-format";
import { PageHeader } from "@/components/portal/PortalPrimitives";
import { ClickableRows } from "@/components/portal/ClickableRows";
import { PortalSelect } from "@/components/portal/PortalSelect";
import { seesAllCustomers } from "@/lib/authz/permissions.mjs";
import { requireCapability } from "@/lib/authz/session";
import { loadRebateReviewList, type RebateReviewRow } from "@/lib/pricing/rebate-review-service";
import { STATUS_LABELS } from "@/lib/pricing/rebateReview.mjs";
import { pct } from "../format";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, string> = {
  stabilan: "success",
  nedavna_promena: "warning",
  razlike_po_grupi: "info",
  nedosledan: "danger",
  premalo: "neutral",
};

const EXCEPTION_FILTERS = [
  { key: "sve", label: "Svi kupci" },
  { key: "bilo_koji", label: "Sa bilo kojim izuzetkom" },
  { key: "visok", label: "Visok rabat — proveriti" },
  { key: "bez_rabata", label: "Stavke bez rabata" },
  { key: "odstupanje", label: "Odstupanje od grupe" },
  { key: "artikli", label: "Poseban rabat na artikal" },
] as const;

function matchesException(row: RebateReviewRow, filter: string) {
  const e = row.exceptions;
  switch (filter) {
    case "bilo_koji": return e.high + e.noDiscount + e.deviation + e.articles > 0;
    case "visok": return e.high > 0;
    case "bez_rabata": return e.noDiscount > 0;
    case "odstupanje": return e.deviation > 0;
    case "artikli": return e.articles > 0;
    default: return true;
  }
}

const fold = (s: string) => s.toLocaleLowerCase("sr-Latn").normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/đ/g, "dj");

export default async function RebateReviewListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; stanje?: string; izuzetak?: string; komercijalista?: string }>;
}) {
  const user = await requireCapability("view:rabati", "/portal/cene/rabati-iz-faktura/kupci");
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 80);
  const stanje = params.stanje && params.stanje in STATUS_LABELS ? params.stanje : "sva";
  const izuzetak = EXCEPTION_FILTERS.some((f) => f.key === params.izuzetak) ? (params.izuzetak as string) : "sve";
  const komercijalista = (params.komercijalista ?? "").slice(0, 120);

  const { rows, lineCount } = await loadRebateReviewList(user);
  const reps = [...new Set(rows.flatMap((r) => r.salespeople))].sort((a, b) => a.localeCompare(b, "sr-Latn"));
  const filtered = rows.filter(
    (r) =>
      (!q || fold(r.customerName).includes(fold(q))) &&
      (stanje === "sva" || r.status === stanje) &&
      matchesException(r, izuzetak) &&
      (!komercijalista || (komercijalista === "-" ? r.salespeople.length === 0 : r.salespeople.includes(komercijalista))),
  );
  /*
   * Komercijalista (bez celog opsega) vidi jednostavnu listu: klik na kupca vodi pravo u tabelu
   * rabata, a analiza faktura (stanje, izuzeci) je samo diskretna oznaka (2026-11-10).
   * Vlasnik i kancelarija zadržavaju pun pregled.
   */
  // 2026-11-11 (vlasnik): i vlasnik vidi samo jednostavnu listu → tabela rabata kupca; analiza faktura je sklonjena.
  const simple = true;
  const target = (customerId: string) =>
    simple ? `/portal/cene/rabati-iz-faktura/kupci/${customerId}/tabela` : `/portal/cene/rabati-iz-faktura/kupci/${customerId}`;
  const counts = Object.fromEntries(Object.keys(STATUS_LABELS).map((k) => [k, rows.filter((r) => r.status === k).length]));

  return (
    <>
      <PageHeader
        eyebrow="Finansije · Rabati iz faktura"
        title={simple ? "Rabati kupaca" : "Pregled rabata po kupcu"}
        description={
          simple
            ? "Kliknite na kupca da otvorite tabelu rabata: svi artikli u ponudi, i oni koje kupac još ne uzima, sa rabatom i neto cenom."
            : "Šta je zabeleženo na fakturama, po kupcu. Ovo je istorija, ne cenovnik: predlog uslova i odobreno pravilo prikazani su odvojeno na stranici kupca."
        }
        meta={
          <span>
            {seesAllCustomers(user)
              ? `Svi kupci sa fakturama (${rows.length}).`
              : `Vaši dodeljeni kupci sa fakturama (${rows.length}). Kupac koji Vam nije dodeljen ne otvara se ni preko direktne adrese.`}{" "}
            {lineCount.toLocaleString("sr-Latn-RS")} potvrđenih stavki.
          </span>
        }
      />

      <section className="portal-panel">
        <form method="get" className="rr-filters" role="search" aria-label="Pretraga kupaca">
          <label>
            <span>Kupac</span>
            <input type="search" name="q" defaultValue={q} placeholder="Naziv kupca" autoComplete="off" />
          </label>
          {simple ? null : (
          <>
          <label>
            <span>Stanje</span>
            <PortalSelect
              name="stanje"
              ariaLabel="Stanje"
              defaultValue={stanje}
              options={[
                { value: "sva", label: "Sva stanja" },
                ...Object.entries(STATUS_LABELS)
                  .filter(([k]) => k !== "bez_faktura")
                  .map(([k, label]) => ({ value: k, label: `${label} (${counts[k] ?? 0})` })),
              ]}
            />
          </label>
          <label>
            <span>Izuzeci</span>
            <PortalSelect name="izuzetak" ariaLabel="Izuzeci" defaultValue={izuzetak} options={EXCEPTION_FILTERS.map((f) => ({ value: f.key, label: f.label }))} />
          </label>
          </>
          )}
          {!simple && reps.length > 1 ? (
            <label>
              <span>Komercijalista (trenutno)</span>
              <PortalSelect
                name="komercijalista"
                ariaLabel="Komercijalista"
                defaultValue={komercijalista}
                options={[{ value: "", label: "Svi" }, ...reps.map((r) => ({ value: r, label: r })), { value: "-", label: "Bez dodele" }]}
              />
            </label>
          ) : null}
          <button type="submit" className="portal-button" data-variant="primary">Prikažite</button>
        </form>

        <ClickableRows className="portal-table-wrap">
{simple ? (
          <table className="portal-table rr-table rr-table--rows">
            <thead>
              <tr>
                <th scope="col">Kupac</th>
                <th scope="col">Najčešći rabat</th>
                <th scope="col">Poslednja faktura</th>
                <th scope="col">Rabati po artiklu u portalu</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const check = r.status === "nedosledan";
                return (
                  <tr key={r.customerId}>
                    <th scope="row">
                      <Link className="rr-row-link" href={target(r.customerId)}>{r.customerName}</Link>
                      {check ? (
                        <span className="rr-mark" title="Rabati na fakturama ovog kupca nisu bili ujednačeni." aria-label="rabati na fakturama nisu bili ujednačeni" />
                      ) : null}
                    </th>
                    <td>{r.mode ? <strong>{pct(r.mode.percent)}</strong> : "—"}</td>
                    <td>{r.last ? srDate(r.last.issuedOn) : "—"}</td>
                    <td>
                      {r.rules.approved ? `${r.rules.approved} odobreno` : "—"}
                      {r.rules.pending ? <small>{r.rules.pending} na čekanju</small> : null}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4}>Nema kupaca za ovu pretragu.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
          ) : (
          <table className="portal-table rr-table rr-table--rows">
            <thead>
              <tr>
                <th scope="col">Kupac</th>
                <th scope="col">Stanje</th>
                <th scope="col">Poslednji rabat</th>
                <th scope="col">Najčešći rabat</th>
                <th scope="col">Izuzeci</th>
                <th scope="col">Pravila u portalu</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.customerId}>
                  <th scope="row">
                    {/* Ceo red je klikabilan: `rr-row-link` se razvlači preko reda (CSS), tekst i dalje čita čitač ekrana. */}
                    <Link className="rr-row-link" href={target(r.customerId)}>{r.customerName}</Link>
                    <small>{r.salespeople.length ? r.salespeople.join(", ") : "bez dodele"}</small>
                  </th>
                  <td>
                    <span className="kk-status" data-tone={STATUS_TONE[r.status] ?? "neutral"}>
                      {STATUS_LABELS[r.status as keyof typeof STATUS_LABELS]}
                    </span>
                    {r.change ? (
                      <small>
                        {r.change.group}: {pct(r.change.previousPercent)} → {pct(r.change.currentPercent)} od {srDate(r.change.since)}
                      </small>
                    ) : null}
                  </td>
                  <td>
                    {r.last ? (
                      <>
                        <strong>{pct(r.last.percent)}</strong>
                        {r.last.mixed ? " (mešovito)" : ""}
                        <small>
                          {srDate(r.last.issuedOn)} · {r.last.groups.join(", ")}
                        </small>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    {r.mode ? (
                      <>
                        <strong>{pct(r.mode.percent)}</strong>
                        <small>
                          na {r.mode.invoices} od {r.invoiceCount} faktura · {Math.round(r.mode.share * 100)} % stavki
                        </small>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    <div className="rr-exc">
                    {r.exceptions.high ? <span data-kind="visok">{r.exceptions.high} visok rabat</span> : null}
                    {r.exceptions.noDiscount ? <span data-kind="nula">{r.exceptions.noDiscount} bez rabata</span> : null}
                    {r.exceptions.deviation ? <span>{r.exceptions.deviation} odstupa</span> : null}
                    {r.exceptions.articles ? <span>{r.exceptions.articles} art. poseban</span> : null}
                    {r.exceptions.high + r.exceptions.noDiscount + r.exceptions.deviation + r.exceptions.articles === 0 ? "—" : null}
                    </div>
                  </td>
                  <td>
                    {r.rules.approved ? `${r.rules.approved} odobreno` : "nema odobrenih"}
                    {r.rules.pending ? <small>{r.rules.pending} na čekanju</small> : null}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6}>Nema kupaca za izabrane filtere.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
          )}
        </ClickableRows>
        {simple ? (
          <p className="portal-data-note">
            Prikazano {filtered.length} od {rows.length}. „Najčešći rabat“ je rabat na najviše stavki faktura. Siva tačka uz
            ime znači da rabati na fakturama tog kupca nisu bili ujednačeni.
          </p>
        ) : (
          <p className="portal-data-note">
            Prikazano {filtered.length} od {rows.length}. „Najčešći rabat“ je vrednost na najviše stavki; broj faktura je
            broj računa na kojima se ta vrednost pojavljuje. Grupe su zaključene iz naziva artikla i važe kao predlog dok ne
            stigne šifarnik iz BizniSofta.
          </p>
        )}
      </section>
    </>
  );
}
