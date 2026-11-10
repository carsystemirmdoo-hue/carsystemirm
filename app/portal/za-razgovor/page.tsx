import Link from "next/link";
import { ClickableRows } from "@/components/portal/ClickableRows";
import { Badge, PageHeader } from "@/components/portal/PortalPrimitives";
import { can, seesAllCustomers } from "@/lib/authz/permissions.mjs";
import { requireCapability } from "@/lib/authz/session";
import { loadAssignedCustomerIds } from "@/lib/authz/user-repository";
import { resolveLedgerScope, type LedgerScope } from "@/lib/ledger/effective-sales";
import { listSalesReps } from "@/lib/partners/assignment-service";
import { loadConversationCustomers } from "@/lib/customers/conversation-customers";
import { parseCustomerStatusFilter } from "@/lib/customers/customerStatus.mjs";
import { loadCustomerProfiles, type CustomerProfile } from "@/lib/recommendations/customer-profile";
import { srDate } from "@/lib/recommendations/customerSummary.mjs";
import { isRecommendationsEnabled } from "@/lib/recommendations/gate";
import { listPriceRequests } from "@/lib/ordering/price-request-service";
import { loadRecomputeStatus } from "@/lib/recommendations/auto-recompute";
import { AutoRecomputeStatus } from "@/components/portal/AutoRecomputeStatus";
import { RecomputeButton } from "./RecomputeButton";
import { dmyTime } from "@/lib/ordering/panelFormat.mjs";


export const metadata = { title: "Za razgovor" };

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Tone = "success" | "warning" | "danger" | "neutral";

type Item = {
  id: string;
  name: string;
  city: string | null;
  reps: string[];
  active: boolean;
  profile: CustomerProfile;
};

function dana(n: number) {
  const a = Math.abs(n);
  return a % 10 === 1 && a % 100 !== 11 ? `${a} dan` : `${a} dana`;
}

/** Koliko hitno: veće = više gore. Samo iz već izračunatih statusa. */
function urgency(p: CustomerProfile): number {
  const s = p.summary.status.key;
  if (s === "dormant") return 1000 + (p.summary.daysSinceLastPurchase ?? 0);
  if (s === "attention") {
    const lapsed = p.articles.filter((a) => a.status === "dormant").length;
    const worst = Math.max(
      0,
      ...p.articles
        .filter((a) => a.status === "overdue" && a.medianIntervalDays)
        .map((a) => -(a.daysUntilExpected ?? 0) / (a.medianIntervalDays ?? 1)),
    );
    return 500 + lapsed * 50 + Math.round(worst * 10);
  }
  return 0;
}

function fmtTime(at: Date | null) {
  if (!at) return "—";
  return dmyTime(at);
}

/** Jedan red tabele „Za razgovor“: ceo red vodi na preporuke kupca (2026-11-10). */
function TalkRow({ item, showReps }: { item: Item; showReps: boolean }) {
  const s = item.profile.summary;
  const names = s.mention.slice(0, 3).map((m) => m.name);
  const more = s.suggestionCounts.main - names.length;
  return (
    <tr>
      <th scope="row">
        <Link className="rr-row-link" href={`/portal/kupci/${item.id}/preporuke`}>{item.name}</Link>
        <small>
          {[item.city, showReps ? (item.reps.length ? item.reps.join(", ") : "bez komercijaliste") : null].filter(Boolean).join(" · ")}
        </small>
      </th>
      <td>
        <Badge tone={s.status.tone as Tone}>{s.status.label}</Badge>
      </td>
      <td className="zt-what">
        {names.length ? (
          <>
            {names.join(", ")}
            {more > 0 ? <small>i još {more}</small> : null}
          </>
        ) : (
          <span className="zt-muted">{s.change}</span>
        )}
      </td>
      <td className="zt-date">
        {s.lastPurchaseOn ? srDate(s.lastPurchaseOn) : "—"}
        {s.daysSinceLastPurchase !== null ? <small>pre {dana(s.daysSinceLastPurchase)}</small> : null}
      </td>
      <td className="pk-open">Otvori →</td>
    </tr>
  );
}


export default async function TalkListPage({
  searchParams,
}: {
  searchParams: Promise<{ komercijalista?: string; kupci?: string }>;
}) {
  const user = await requireCapability("view:preporuke", "/portal/za-razgovor");
  const params = await searchParams;
  const all = seesAllCustomers(user);

  /*
   * Opseg se razrešava na serveru. Filter po komercijalisti SUŽAVA opseg, i
   * samo za one koji vide sve kupce; komercijalista ga ne može zadati.
   */
  let scope: LedgerScope = await resolveLedgerScope(user);
  const repFilter = all && params.komercijalista && UUID.test(params.komercijalista) ? params.komercijalista : null;
  if (repFilter) scope = { customerIds: await loadAssignedCustomerIds(repFilter) };

  // Neaktivni kupci se podrazumevano izostavljaju; vide se kroz filter.
  const statusKupaca = parseCustomerStatusFilter(params.kupci);
  const [{ rows: customerRows, inactiveInScope }, reps, data] = await Promise.all([
    loadConversationCustomers(scope, statusKupaca),
    all ? listSalesReps() : Promise.resolve([]),
    loadCustomerProfiles(scope),
  ]);

  // Opseg je već sužen iznad (`resolveLedgerScope`); predlozi i upiti se računaju samo za te kupce.
  const [priceRequests, autoRecompute] = await Promise.all([
    listPriceRequests(user),
    loadRecomputeStatus(),
  ]);
  const openRequests = priceRequests.filter((r) => r.status === "open" || r.status === "in_progress").length;
  const items: Item[] = [...customerRows]
    .map((c) => ({
      id: c.id,
      name: c.name,
      city: c.city,
      reps: c.reps ?? [],
      active: c.active,
      profile: data.profiles.get(c.id) ?? null,
    }))
    .filter((x): x is Item => x.profile !== null);
  // Kupci bez ijednog dokumenta nemaju profil iz podataka; prikazuju se u sklopljenoj grupi.
  const withoutData = [...customerRows].filter((c) => !data.profiles.has(c.id));

  const aktivni = items.filter((i) => i.active);
  const neaktivni = items.filter((i) => !i.active);
  const byKey = (keys: string[]) => aktivni.filter((i) => keys.includes(i.profile.summary.status.key));
  const attention = byKey(["dormant", "attention"]).sort((a, b) => urgency(b.profile) - urgency(a.profile));
  const stale = byKey(["stale"]);
  const due = byKey(["due"]);
  const quiet = byKey(["steady", "not_computed", "thin", "none"]).sort((a, b) => a.name.localeCompare(b.name, "sr-Latn"));

  const canRecompute = can(user, "recommendations:recompute") && isRecommendationsEnabled();
  const lastIngest = items.reduce<Date | null>(
    (m, i) => (i.profile.lastIngestedAt && (!m || i.profile.lastIngestedAt > m) ? i.profile.lastIngestedAt : m),
    null,
  );

  return (
    <>
      <PageHeader
        eyebrow="Moji kupci"
        title="Za razgovor"
        description="Kupci koje vredi pozvati, najhitniji gore. Kliknite na kupca da vidite šta da mu ponudite."
      />

      <section className="portal-panel">
        <div className="zr-status">
          <div>
            <span>
              Podaci do <strong>{srDate(data.today)}</strong> · poslednji uvoz {fmtTime(lastIngest)}
            </span>
            <span>
              Obračun preporuka:{" "}
              {data.run ? (
                <>
                  <strong>{srDate(data.run.asOfDate)}</strong> · pokrenut {fmtTime(data.run.startedAt)}
                </>
              ) : (
                "nije pokrenut"
              )}
            </span>
            <AutoRecomputeStatus status={autoRecompute} canRetry={can(user, "recommendations:retry_auto")} />
            {openRequests ? (
              <span>
                <Link href="/portal/zahtevi/uslovi">Otvoreni upiti za cenu i uslove: {openRequests} →</Link>
              </span>
            ) : null}
            {statusKupaca === "aktivni" && inactiveInScope > 0 ? (
              <span>
                Neaktivni kupci ({inactiveInScope}) se ne prikazuju — izaberite „Neaktivni kupci“ za pregled.
              </span>
            ) : null}
            {stale.length ? (
              <span className="zr-warn">
                Za {stale.length} {stale.length === 1 ? "kupca" : "kupaca"} su posle obračuna stigli novi dokumenti — njihov savet se ne prikazuje dok se obračun ne ponovi.
              </span>
            ) : null}
          </div>
          <div className="zr-actions">
            <form method="get" className="portal-inline-form">
              {all ? (
                <select name="komercijalista" defaultValue={repFilter ?? ""} aria-label="Komercijalista">
                  <option value="">Svi komercijalisti</option>
                  {reps.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              ) : null}
              <select name="kupci" defaultValue={statusKupaca} aria-label="Kupci po statusu">
                <option value="aktivni">Aktivni kupci</option>
                <option value="neaktivni">Neaktivni kupci</option>
                <option value="svi">Svi kupci</option>
              </select>
              <button type="submit" className="portal-button" data-variant="primary">Prikažite</button>
            </form>
            {canRecompute ? <RecomputeButton label={stale.length ? "Preračunajte sada" : "Preračunajte"} /> : null}
          </div>
        </div>
      </section>

      {items.length === 0 && withoutData.length === 0 ? (
        <section className="portal-panel">
          <h2>Nema kupaca u ovom prikazu</h2>
          <p>
            {statusKupaca === "neaktivni"
              ? "Nema neaktivnih kupaca u ovom prikazu."
              : all
                ? "Izabrani komercijalista nema dodeljenih kupaca."
                : "Nemate dodeljenih kupaca."}
          </p>
        </section>
      ) : null}

      {attention.length || due.length || stale.length ? (
        <section className="portal-panel">
          <ClickableRows className="portal-table-wrap">
            <table className="portal-table rr-table rr-table--rows zt-table">
              <thead>
                <tr>
                  <th scope="col">Kupac</th>
                  <th scope="col">Stanje</th>
                  <th scope="col">Šta pomenuti</th>
                  <th scope="col">Poslednja kupovina</th>
                  <th scope="col" aria-label="Otvori" />
                </tr>
              </thead>
              <tbody>
                {[...attention, ...due, ...stale].map((item) => (
                  <TalkRow key={item.id} item={item} showReps={all} />
                ))}
              </tbody>
            </table>
          </ClickableRows>
        </section>
      ) : null}

      {neaktivni.length ? (
        <details className="portal-panel zr-quiet">
          <summary>Neaktivni kupci · {neaktivni.length}</summary>
          <ul className="zr-quiet-list">
            {neaktivni.map((i) => (
              <li key={i.id}>
                <Link href={`/portal/kupci/${i.id}`}>{i.name}</Link>
                <Badge tone="neutral">Neaktivan kupac</Badge>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {quiet.length || withoutData.length ? (
        <details className="portal-panel zr-quiet">
          <summary>
            Ostali kupci (bez hitnog razloga za poziv) · {quiet.length + withoutData.length}
          </summary>
          <ul className="zr-quiet-list">
            {quiet.map((i) => (
              <li key={i.id}>
                <Link href={`/portal/kupci/${i.id}`}>{i.name}</Link>
                <Badge tone={i.profile.summary.status.tone as Tone}>{i.profile.summary.status.label}</Badge>
                <small>{i.profile.summary.change}</small>
              </li>
            ))}
            {withoutData.map((c) => (
              <li key={c.id}>
                <Link href={`/portal/kupci/${c.id}`}>{c.name}</Link>
                <Badge tone="neutral">Nema potvrđenih kupovina</Badge>
                <small>U potvrđenim dokumentima nema nijedne kupovine ovog kupca.</small>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <p className="portal-footnote">
        Interna lista. Kupac je nikad ne vidi. Predlog ne sadrži cenu, rabat ni uslove plaćanja; naplata i
        zalihe se ne prikazuju jer izvor nije povezan.
      </p>
    </>
  );
}
