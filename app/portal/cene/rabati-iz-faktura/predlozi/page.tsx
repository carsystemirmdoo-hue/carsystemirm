import { quantity } from "@/lib/ordering/panelFormat.mjs";
import Link from "next/link";
import { srDate } from "@/components/customer/account-format";
import { CrumbLabel } from "@/components/portal/Breadcrumbs";
import { Metric, PageHeader } from "@/components/portal/PortalPrimitives";
import { can, seesAllCustomers } from "@/lib/authz/permissions.mjs";
import { requireCapability } from "@/lib/authz/session";
import { rebateCoverage, SINGLE_GROUP, UNASSIGNED, type CoveragePair } from "@/lib/pricing/rebate-coverage-service";
import { COMMERCIAL_STATUSES } from "@/lib/customers/commercial-status.mjs";
import { COVERAGE_RULES } from "@/lib/pricing/rebateCoverage.mjs";
import { belgradeDate } from "@/lib/recommendations/customerRhythm.mjs";
import { pct } from "../format";
import { CustomerGroupsForm } from "./CustomerGroupsForm";
import { GroupApproveButton } from "./GroupApproveButton";

export const dynamic = "force-dynamic";
const UNCLEAR_SHOWN = 40;
const OUTCOME: Record<CoveragePair["outcome"], string> = {
  odobreno: "Odobreno pravilo",
  ceka_odobrenje: "Čeka odobrenje",
  direktno: "Direktno potvrđeno",
  izvedeno: "Pouzdano izvedeno",
  nejasno: "Nejasno",
  van_programa: "Van programa",
  poseban_status: "Poseban poslovni status",
};

const share = (n: number, total: number) => (total ? `${Math.round((n / total) * 100)} %` : "—");

/**
 * Pokrivenost rabata (rabati-v2): direktno potvrđeni, pouzdano izvedeni i
 * stvarno nejasni parovi kupac–artikal. Izvedeni i direktni se odobravaju
 * GRUPNO po kupcu i dokazanoj porodici; izuzeci se vide u grupi. Postojeća
 * odobrena pravila se ne prepisuju. Komercijalista vidi samo svoje kupce.
 */
export default async function RebateCoveragePage({ searchParams }: { searchParams: Promise<{ komercijalista?: string; kupac?: string }> }) {
  const user = await requireCapability("view:rabati", "/portal/cene/rabati-iz-faktura/predlozi");
  const sp = await searchParams;
  const asOf = belgradeDate(new Date());
  const cov = await rebateCoverage(user, asOf);
  const owner = (s: string[]) => (s.length ? s.join(", ") : UNASSIGNED);
  const owners = [...new Set(cov.customers.map((c) => owner(c.salespeople)))].sort((a, b) => (a === UNASSIGNED ? 1 : b === UNASSIGNED ? -1 : a.localeCompare(b, "sr-Latn")));
  const komercijalista = (sp.komercijalista ?? "").slice(0, 120);
  const kupac = (sp.kupac ?? "").trim().toLowerCase().slice(0, 80);
  const shown = cov.customers
    .filter((c) => (!komercijalista || owner(c.salespeople) === komercijalista) && (!kupac || c.customerName.toLowerCase().includes(kupac)))
    .map((c) => ({ ...c, open: c.groups.reduce((n, g) => n + g.pairs.length, 0), unclear: c.pairs.filter((p) => p.segment !== "istorijsko" && p.outcome === "nejasno") }))
    .filter((c) => c.open > 0 || c.unclear.length > 0)
    .sort((a, b) => owner(a.salespeople).localeCompare(owner(b.salespeople), "sr-Latn") || b.open - a.open);
  const scopePairs = cov.customers
    .filter((c) => (!komercijalista || owner(c.salespeople) === komercijalista) && (!kupac || c.customerName.toLowerCase().includes(kupac)))
    .flatMap((c) => c.pairs);
  const scoped = cov.customers.filter((c) => (!komercijalista || owner(c.salespeople) === komercijalista) && (!kupac || c.customerName.toLowerCase().includes(kupac)));
  // Metrike: samo kupci koje stvarno pripremamo za portal i koji nemaju poseban dogovor.
  const preparedPairs = scoped.filter((c) => c.prepared && c.status === "redovan").flatMap((c) => c.pairs);
  const seg = (s: string) => preparedPairs.filter((p) => p.segment === s);
  const cur = seg("aktuelno");
  const special = scoped.filter((c) => c.status !== "redovan");
  const allCur = scopePairs.filter((p) => p.segment === "aktuelno");
  const count = (rows: CoveragePair[], o: CoveragePair["outcome"]) => rows.filter((p) => p.outcome === o).length;
  const canApprove = can(user, "prices:approve");
  const canPropose = can(user, "prices:propose");
  const verb = canApprove ? "Odobrite" : "Predložite";

  return (
    <>
      <CrumbLabel segment="predlozi" label="Pokrivenost i grupni predlozi" />
      <PageHeader
        eyebrow="Finansije · Rabati iz faktura"
        title="Pokrivenost rabata i grupni predlozi"
        description="Cela istorija kupca: poslednji uslovi, promene kroz vreme, doslednost po artiklu i porodice koje kupčeve fakture dokazuju. Ništa se ne primenjuje samo; grupa se odobrava jednim potezom, a izuzeci ostaju vidljivi."
        meta={
          <span>
            {seesAllCustomers(user) ? "Svi kupci." : "Vaši dodeljeni kupci."} Porodica važi tek kada je kupac dokaže: ≥ {COVERAGE_RULES.familyMinArticles} različita artikla,
            ≥ {COVERAGE_RULES.familyMinDays} dana kupovine, ≥ {Math.round(COVERAGE_RULES.familyShare * 100)} % stavki sa istim rabatom u poslednjih 6 (najviše 12) meseci, bez promene uslova u toku.
            Akcija na celoj fakturi ne menja uslov. Prva reč naziva ili opšti rabat kupca sami nisu dokaz. Kriterijum {COVERAGE_RULES.version}.
          </span>
        }
        actions={<Link className="rr-link" href="/portal/cene/rabati-iz-faktura/za-pregled">Stroga merila (pojedinačno) →</Link>}
      />

      <section className="portal-metrics rr-metrics" aria-label="Pokrivenost aktuelnih parova">
        <Metric label="Za portal: aktuelnih parova" value={quantity(cur.length)} context="redovni kupci u pripremi; aktivan kupac i artikal, kupljeno u 12 meseci" />
        <Metric label="Odobreno pravilo" value={quantity(count(cur, "odobreno"))} tone="success" context={share(count(cur, "odobreno"), cur.length)} />
        <Metric label="Direktno potvrđeno" value={quantity(count(cur, "direktno"))} tone="success" context={`${share(count(cur, "direktno"), cur.length)} · čeka grupno odobrenje`} />
        <Metric label="Pouzdano izvedeno" value={quantity(count(cur, "izvedeno"))} tone="warning" context={`${share(count(cur, "izvedeno"), cur.length)} · čeka grupno odobrenje`} />
        <Metric label="Nejasno" value={quantity(count(cur, "nejasno"))} tone="danger" context={`${share(count(cur, "nejasno"), cur.length)} · ručni pregled`} />
      </section>
      <section className="portal-panel">
        <h2>Svi kupci, kupci za portal i posebni računi</h2>
        <div className="portal-table-wrap">
          <table className="portal-table rr-table">
            <thead>
              <tr>
                <th scope="col">Skup (aktuelni parovi)</th>
                <th scope="col">Kupaca</th>
                <th scope="col">Parova</th>
                <th scope="col">Odobreno</th>
                <th scope="col">Direktno + izvedeno</th>
                <th scope="col">Nejasno</th>
                <th scope="col">Poseban status</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: "Svi kupci", rows: allCur, n: scoped.filter((c) => c.pairs.some((p) => p.segment === "aktuelno")).length },
                { label: "Pripremamo za portal (redovni)", rows: cur, n: scoped.filter((c) => c.prepared && c.status === "redovan" && c.pairs.some((p) => p.segment === "aktuelno")).length },
                { label: "Posebni računi", rows: special.flatMap((c) => c.pairs).filter((p) => p.segment === "aktuelno"), n: special.length },
              ].map((r) => (
                <tr key={r.label}>
                  <th scope="row">{r.label}</th>
                  <td className="portal-table-number">{quantity(r.n)}</td>
                  <td className="portal-table-number">{quantity(r.rows.length)}</td>
                  <td className="portal-table-number">{quantity(count(r.rows, "odobreno"))}</td>
                  <td className="portal-table-number">{quantity(count(r.rows, "direktno") + count(r.rows, "izvedeno"))}</td>
                  <td className="portal-table-number">{quantity(count(r.rows, "nejasno"))}</td>
                  <td className="portal-table-number">{quantity(count(r.rows, "poseban_status"))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="portal-data-note">
          Izdvajanje posebnih računa menja samo osnovicu procenta — to NIJE novootkriven rabat. Iz uslova posebnih kupaca ništa se ne izvodi ni za njih ni za druge kupce.
        </p>
        {special.length ? (
          <ul className="rc-articles">
            {special.map((c) => (
              <li key={c.customerId}>
                <strong>{c.customerName}</strong> — {COMMERCIAL_STATUSES[c.status as keyof typeof COMMERCIAL_STATUSES] ?? c.status}
                {c.prepared ? "" : " · ne priprema se za portal (bez naloga)"}
                {c.pairs.some((p) => p.special) ? ` · ranije odobrenih pravila: ${c.pairs.filter((p) => p.special).length} — poseban slučaj za odluku` : ""}
                {c.statusReason ? <small> — {c.statusReason}</small> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
      <p className="portal-data-note">
        Retke kupovine aktuelnih artikala (kupljeno pre više od 12 meseci): {seg("retko").length} parova — odobreno {count(seg("retko"), "odobreno")}, izvedeno{" "}
        {count(seg("retko"), "izvedeno")}, nejasno {count(seg("retko"), "nejasno")}. Istorijski skup (neaktivan kupac, artikal van programa ili van prodaje):{" "}
        {seg("istorijsko").length} parova, od toga van programa {count(seg("istorijsko"), "van_programa")} — samo istorija, ne nudi se.
      </p>

      <section className="portal-panel">
        <form method="get" className="rr-filters" aria-label="Filteri">
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
          <label>
            <span>Kupac</span>
            <input name="kupac" defaultValue={sp.kupac ?? ""} placeholder="deo naziva" />
          </label>
          <button type="submit" className="portal-button" data-variant="primary">Prikažite</button>
        </form>

        {shown.length === 0 ? <p className="portal-empty">Nema grupa ni nejasnih parova za izabrane filtere.</p> : null}
        {shown.map((c) => {
          return (
            <details key={c.customerId} className="rc-customer">
              <summary>
                <strong>{c.customerName}</strong>
                <small>
                  {owner(c.salespeople)} · poslednja faktura {srDate(c.lastOn)} · za grupno odobrenje {c.open} · nejasno {c.unclear.length}
                </small>
              </summary>
              {c.groups.length ? (
                <div className="portal-table-wrap">
                  <table className="portal-table rr-table">
                    <thead>
                      <tr>
                        <th scope="col">Porodica</th>
                        <th scope="col">Uslov</th>
                        <th scope="col">Dokaz kupca</th>
                        <th scope="col">Artikli</th>
                        <th scope="col">Odluka</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.groups.map((g) => {
                        const direct = g.pairs.filter((p) => p.outcome === "direktno").length;
                        const notes = g.pairs.filter((p) => p.reason);
                        return (
                          <tr key={g.key}>
                            <th scope="row">{g.key === SINGLE_GROUP ? "Pojedinačni artikli (izuzeci i artikli bez porodice)" : `„${g.key}“`}</th>
                            <td data-label="Uslov">{g.percent === null ? "po artiklu" : pct(g.percent)}</td>
                            <td data-label="Dokaz kupca">
                              {g.evidence ? (
                                <small>
                                  Poreklo: izvedeno iz faktura kupca (nije BizniSoft grupa) · {g.evidence.articles} artikala · {g.evidence.days} dana · {Math.round(g.evidence.share * 100)} % stavki
                                  {g.evidence.window ? ` · ${srDate(g.evidence.window[0])} – ${srDate(g.evidence.window[1])}` : ""}
                                  {g.evidence.actions ? ` · akcija na fakturi: ${g.evidence.actions} (ne menja uslov)` : ""}
                                </small>
                              ) : (
                                <small>sopstvena istorija svakog artikla (poslednje 2 kupovine isti rabat)</small>
                              )}
                            </td>
                            <td data-label="Artikli">
                              <details>
                                <summary>
                                  {g.pairs.length} ({direct} direktno, {g.pairs.length - direct} izvedeno){notes.length ? ` · napomena: ${notes.length}` : ""}
                                </summary>
                                <ul className="rc-articles">
                                  {g.pairs.map((p) => (
                                    <li key={p.articleId}>
                                      {p.articleName} — <b>{pct(p.percent ?? 0)}</b> · {OUTCOME[p.outcome].toLowerCase()} · poslednje:{" "}
                                      {p.lastInvoices.map((i) => `${srDate(i.issuedOn)} ${pct(i.percent)}`).join(", ")}
                                      {p.segment === "retko" ? " · retka kupovina" : ""}
                                      {p.reason ? <small> — {p.reason}</small> : null}
                                    </li>
                                  ))}
                                </ul>
                              </details>
                            </td>
                            <td data-label="Odluka">
                              {canPropose ? (
                                <GroupApproveButton
                                  customerId={c.customerId}
                                  groupKey={g.key}
                                  expected={g.pairs.map((p) => ({ articleId: p.articleId, percent: p.percent as number }))}
                                  label={`${verb} grupu (${g.pairs.length})`}
                                />
                              ) : (
                                <small>predlaže komercijalista sa paketom „cene_predlog“</small>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : null}
              {canPropose && c.groups.length > 1 ? (
                <CustomerGroupsForm
                  customerId={c.customerId}
                  verb={verb}
                  groups={c.groups.map((g) => ({
                    key: g.key,
                    label: g.key === SINGLE_GROUP ? "pojedinačni artikli (izuzeci)" : `„${g.key}“ ${g.percent === null ? "" : pct(g.percent)}`,
                    percent: g.percent,
                    preselect: g.key !== SINGLE_GROUP,
                    expected: g.pairs.map((p) => ({ articleId: p.articleId, percent: p.percent as number })),
                  }))}
                />
              ) : null}
              {c.unclear.length ? (
                <details className="rc-unclear">
                  <summary>Nejasno — ručni pregled ({c.unclear.length})</summary>
                  <ul className="rc-articles">
                    {c.unclear.slice(0, UNCLEAR_SHOWN).map((p) => (
                      <li key={p.articleId}>
                        {p.articleName} · {p.reason} · poslednje: {p.lastInvoices.map((i) => `${srDate(i.issuedOn)} ${pct(i.percent)}`).join(", ")}
                      </li>
                    ))}
                  </ul>
                  {c.unclear.length > UNCLEAR_SHOWN ? <p className="portal-data-note">Prikazano {UNCLEAR_SHOWN} od {c.unclear.length}.</p> : null}
                </details>
              ) : null}
            </details>
          );
        })}
      </section>
    </>
  );
}
