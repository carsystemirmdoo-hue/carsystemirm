import Link from "next/link";
import { DateRangeField } from "@/components/portal/DateRangeField";
import { Badge, Metric, PageHeader } from "@/components/portal/PortalPrimitives";
import { srDate } from "@/components/customer/account-format";
import { requireCapability } from "@/lib/authz/session";
import { dmyTime } from "@/lib/ordering/panelFormat.mjs";
import { optionLabel } from "@/lib/pricing/paymentOptions.mjs";
import { DECISION_LABELS, scopeLabel, transitionLabel } from "@/lib/pricing/ownerChanges.mjs";
import { loadOwnerChanges, MAX_CHANGE_ROWS, priceDecisionMakers } from "@/lib/pricing/owner-changes-service";
import { belgradeDate } from "@/lib/recommendations/customerRhythm.mjs";

export const dynamic = "force-dynamic";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TONES = { approved: "success", rejected: "neutral", revoked: "warning" } as const;

function minusDays(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/**
 * Promene cena i rabata koje su doneli komercijalisti — jedan blok za vlasnika
 * (2026-11-09): ko je promenio, kome, šta i sa koliko na koliko.
 */
export default async function OwnerChangesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireCapability("prices:oversee", "/portal/cene/promene");
  const params = await searchParams;
  const today = belgradeDate(new Date());
  let od = params.od && ISO.test(params.od) ? params.od : minusDays(today, 6);
  let doD = params.do && ISO.test(params.do) ? params.do : today;
  if (od > doD) [od, doD] = [doD, od];
  const ko = params.ko && UUID.test(params.ko) ? params.ko : null;
  const ukljuciVlasnika = params.vlasnik === "1";

  const [{ blocks, people, rules, truncated }, makers] = await Promise.all([
    loadOwnerChanges(user, { od, do: doD, ko, ukljuciVlasnika }),
    priceDecisionMakers(user),
  ]);
  const approved = blocks.filter((b) => b.decision === "approved").length;

  return (
    <>
      <PageHeader
        eyebrow="Finansije"
        title="Promene komercijalista"
        description="Svaka odluka o ceni ili rabatu koju nije doneo vlasnik, na jednom mestu: ko je promenio, kom kupcu, šta i sa koliko na koliko. Jedan red je jedna odluka, i kada obuhvata više artikala."
        meta={
          <span>
            Period: <b>{srDate(od)}</b> – <b>{srDate(doD)}</b>
          </span>
        }
      />

      <section className="portal-panel">
        <form className="portal-filters" method="get">
          <DateRangeField nameOd="od" nameDo="do" defaultOd={od} defaultDo={doD} primeniOdmah={false} />
          <label className="portal-field">
            <span>Ko je odlučio</span>
            <select name="ko" defaultValue={ko ?? ""}>
              <option value="">Svi</option>
              {makers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label className="portal-field">
            <span>Vlasnikove odluke</span>
            <select name="vlasnik" defaultValue={ukljuciVlasnika ? "1" : ""}>
              <option value="">Bez mojih odluka</option>
              <option value="1">I moje odluke</option>
            </select>
          </label>
          <button type="submit" className="portal-button" data-variant="primary">
            Prikažite
          </button>
        </form>
        <p>
          <Link href={`/portal/cene/promene?od=${today}&do=${today}`}>Danas</Link> ·{" "}
          <Link href={`/portal/cene/promene?od=${minusDays(today, 6)}&do=${today}`}>Poslednjih 7 dana</Link> ·{" "}
          <Link href={`/portal/cene/promene?od=${minusDays(today, 29)}&do=${today}`}>Poslednjih 30 dana</Link>
        </p>
      </section>

      <section className="portal-metrics">
        <Metric label="Odluka" value={String(blocks.length)} context={`${rules} pravila`} />
        <Metric label="Odobreno" value={String(approved)} tone="success" />
        <Metric label="Odbijeno ili opozvano" value={String(blocks.length - approved)} tone={blocks.length - approved ? "warning" : "neutral"} />
        <Metric
          label="Po osobi"
          value={people.length ? people.map((p) => `${p.name} ${p.blocks}`).join(" · ") : "—"}
        />
      </section>

      {truncated ? (
        <section className="portal-panel" data-accent="warning">
          <p>Prikazano je prvih {MAX_CHANGE_ROWS} pravila. Suzite period ili izaberite osobu.</p>
        </section>
      ) : null}

      <section className="portal-panel">
        <h2>Odluke ({blocks.length})</h2>
        {blocks.length === 0 ? (
          <p>U ovom periodu nema odluka o cenama i rabatima{ukljuciVlasnika ? "" : " koje nije doneo vlasnik"}.</p>
        ) : (
          <div className="portal-table-wrap">
            <table className="portal-table">
              <thead>
                <tr>
                  <th scope="col">Kada</th>
                  <th scope="col">Ko</th>
                  <th scope="col">Kupac</th>
                  <th scope="col">Šta</th>
                  <th scope="col">Promena</th>
                  <th scope="col">Važi od</th>
                  <th scope="col">Obrazloženje</th>
                </tr>
              </thead>
              <tbody>
                {blocks.map((b) => (
                  <tr key={b.key}>
                    <td data-label="Kada">{dmyTime(b.decidedAt)}</td>
                    <th scope="row" data-label="Ko">
                      {b.decidedByName}
                      <small>
                        <Badge tone={TONES[b.decision as keyof typeof TONES]}>{DECISION_LABELS[b.decision as keyof typeof DECISION_LABELS]}</Badge>
                        {b.proposedByName && b.proposedByName !== b.decidedByName ? ` · predložio ${b.proposedByName}` : ""}
                      </small>
                    </th>
                    <td data-label="Kupac">
                      {b.customerId ? (
                        <Link href={`/portal/cene/rabati-iz-faktura/kupci/${b.customerId}`}>{b.customerName ?? "—"}</Link>
                      ) : (
                        (b.customerName ?? "više kupaca")
                      )}
                    </td>
                    <td data-label="Šta">
                      {b.items.length === 1 ? (
                        scopeLabel(b.items[0])
                      ) : (
                        <details>
                          <summary>{b.scope}</summary>
                          <ul>
                            {b.items.map((it) => (
                              <li key={it.id}>
                                {scopeLabel(it)}: {transitionLabel(it.valueKind, it.oldValue, it.newValue)}
                                {it.paymentCondition ? ` · ${optionLabel(it.paymentCondition)}` : ""}
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                      {b.items.length === 1 && b.items[0].paymentCondition ? <small>{optionLabel(b.items[0].paymentCondition)}</small> : null}
                    </td>
                    <td data-label="Promena">
                      <strong>{b.change}</strong>
                    </td>
                    <td data-label="Važi od">{srDate(b.effectiveFrom)}</td>
                    <td data-label="Obrazloženje">
                      <small>{b.reason ?? "—"}</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p>
          <small>
            Stari rabat je vrednost pravila koje je promena zamenila; „novo“ znači da ranije nije postojalo pravilo za taj opseg.
            Opcije plaćanja (avans, gotovina…) nisu u ovoj tabeli; stižu u dnevnom obaveštenju. Potpun, nepromenljiv trag je u Aktivnostima.
          </small>
        </p>
      </section>
    </>
  );
}
