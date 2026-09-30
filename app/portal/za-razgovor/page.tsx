import Link from "next/link";
import { sql } from "drizzle-orm";
import { Badge, PageHeader } from "@/components/portal/PortalPrimitives";
import { getDb } from "@/db/client";
import { can, seesAllCustomers } from "@/lib/authz/permissions.mjs";
import { requireCapability } from "@/lib/authz/session";
import { loadAssignedCustomerIds } from "@/lib/authz/user-repository";
import { resolveLedgerScope, type LedgerScope } from "@/lib/ledger/effective-sales";
import { listSalesReps } from "@/lib/partners/assignment-service";
import { loadCustomerProfiles, type CustomerProfile } from "@/lib/recommendations/customer-profile";
import { srDate } from "@/lib/recommendations/customerSummary.mjs";
import { isRecommendationsEnabled } from "@/lib/recommendations/gate";
import { loadCrossSell, type CrossSell } from "@/lib/recommendations/cross-sell";
import { listPriceRequests } from "@/lib/ordering/price-request-service";
import { loadRecomputeStatus } from "@/lib/recommendations/auto-recompute";
import { AutoRecomputeStatus } from "@/components/portal/AutoRecomputeStatus";
import { RecomputeButton } from "./RecomputeButton";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Tone = "success" | "warning" | "danger" | "neutral";

type Item = {
  id: string;
  name: string;
  city: string | null;
  reps: string[];
  profile: CustomerProfile;
  crossSell: CrossSell | null;
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
  return new Date(at).toLocaleString("sr-Latn-RS", {
    timeZone: "Europe/Belgrade",
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function CustomerItem({ item, showReps }: { item: Item; showReps: boolean }) {
  const s = item.profile.summary;
  return (
    <li className="zr-item">
      <div className="zr-head">
        <Link href={`/portal/kupci/${item.id}`} className="zr-name">
          {item.name}
        </Link>
        <Badge tone={s.status.tone as Tone}>{s.status.label}</Badge>
      </div>
      <div className="zr-meta">
        <span>
          Poslednja kupovina: <strong>{s.lastPurchaseOn ? srDate(s.lastPurchaseOn) : "—"}</strong>
          {s.daysSinceLastPurchase !== null ? ` · pre ${dana(s.daysSinceLastPurchase)}` : ""}
        </span>
        {item.city ? <span>{item.city}</span> : null}
        {showReps ? <span>Komercijalista: {item.reps.length ? item.reps.join(", ") : "nije dodeljen"}</span> : null}
      </div>
      <div className="zr-body">
        <div>
          <h3>Zašto</h3>
          <p>{s.change}</p>
          {s.mention.length ? (
            <ul className="zr-articles">
              {s.mention.map((m) => (
                <li key={m.articleCode} data-tone={m.tone}>
                  <strong>{m.name}</strong> — {m.reason}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {(() => {
          // Samo jak ili kataloški predlog; slab signal ostaje na kartici kupca.
          const top = item.crossSell?.suggestions.find((x) => x.peer?.strength === "strong" || x.catalog);
          if (!top) return null;
          const name = top.identity?.catalog?.name ?? top.identity?.bizName ?? top.articleCode;
          return (
            <div className="zr-xs">
              <h3>Za proširenje</h3>
              <p>
                <strong>{name}</strong> —{" "}
                {top.catalog
                  ? `kompatibilno sa „${top.catalog.viaName}” koji kupac uzima`
                  : `${top.peer!.support} od ${top.peer!.peers} sličnih firmi to uzima`}
                .
              </p>
            </div>
          );
        })()}
        <div className="zr-next">
          <h3>Predlog za razgovor</h3>
          <p>{s.nextStep}</p>
          <Link href={`/portal/kupci/${item.id}`} className="zr-open">
            Otvori karticu i osnov →
          </Link>
        </div>
      </div>
    </li>
  );
}

export default async function TalkListPage({
  searchParams,
}: {
  searchParams: Promise<{ komercijalista?: string }>;
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

  const db = getDb();
  const [customerRows, reps, data] = await Promise.all([
    db.execute<{ id: string; name: string; city: string | null; reps: string[] | null }>(sql`
      SELECT c.id, c.name, c.city,
             array_remove(array_agg(u.name ORDER BY u.name), NULL) AS reps
        FROM customers c
        LEFT JOIN customer_assignments ca ON ca.customer_id = c.id
        LEFT JOIN users u ON u.id = ca.user_id
       WHERE ${
         scope.customerIds === null
           ? sql`true`
           : scope.customerIds.length === 0
             ? sql`false`
             : sql`c.id IN (${sql.join(scope.customerIds.map((id) => sql`${id}::uuid`), sql`, `)})`
       }
       GROUP BY c.id, c.name, c.city`),
    all ? listSalesReps() : Promise.resolve([]),
    loadCustomerProfiles(scope),
  ]);

  // Opseg je već sužen iznad (`resolveLedgerScope`); predlozi i upiti se računaju samo za te kupce.
  const [crossSell, priceRequests, autoRecompute] = await Promise.all([
    loadCrossSell([...customerRows].map((c) => c.id)),
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
      profile: data.profiles.get(c.id) ?? null,
      crossSell: crossSell.get(c.id) ?? null,
    }))
    .filter((x): x is Item => x.profile !== null);
  // Kupci bez ijednog dokumenta nemaju profil iz podataka; prikazuju se u sklopljenoj grupi.
  const withoutData = [...customerRows].filter((c) => !data.profiles.has(c.id));

  const byKey = (keys: string[]) => items.filter((i) => keys.includes(i.profile.summary.status.key));
  const attention = byKey(["dormant", "attention"]).sort((a, b) => urgency(b.profile) - urgency(a.profile));
  const stale = byKey(["stale"]);
  const due = byKey(["due"]);
  const quiet = byKey(["steady", "thin", "none"]).sort((a, b) => a.name.localeCompare(b.name, "sr-Latn"));

  const canRecompute = can(user, "recommendations:recompute") && isRecommendationsEnabled();
  const lastIngest = items.reduce<Date | null>(
    (m, i) => (i.profile.lastIngestedAt && (!m || i.profile.lastIngestedAt > m) ? i.profile.lastIngestedAt : m),
    null,
  );

  return (
    <>
      <PageHeader
        eyebrow="Prodaja"
        title="Za razgovor"
        description={
          all
            ? "Kupci poređani po tome kome vredi posvetiti pažnju. Razlog i predlog potiču iz ritma kupovine tog kupca; osnov je na kartici kupca."
            : "Vaši dodeljeni kupci, poređani po tome kome vredi posvetiti pažnju. Razlog i predlog potiču iz ritma kupovine tog kupca."
        }
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
            {stale.length ? (
              <span className="zr-warn">
                Za {stale.length} {stale.length === 1 ? "kupca" : "kupaca"} su posle obračuna stigli novi dokumenti — njihov savet se ne prikazuje dok se obračun ne ponovi.
              </span>
            ) : null}
          </div>
          <div className="zr-actions">
            {all ? (
              <form method="get" className="portal-inline-form">
                <select name="komercijalista" defaultValue={repFilter ?? ""} aria-label="Komercijalista">
                  <option value="">Svi komercijalisti</option>
                  {reps.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <button type="submit">Prikaži</button>
              </form>
            ) : null}
            {canRecompute ? <RecomputeButton label={stale.length ? "Preračunaj sada" : "Preračunaj"} /> : null}
          </div>
        </div>
      </section>

      {items.length === 0 && withoutData.length === 0 ? (
        <section className="portal-panel">
          <h2>Nema kupaca u ovom prikazu</h2>
          <p>{all ? "Izabrani komercijalista nema dodeljenih kupaca." : "Nemate dodeljenih kupaca."}</p>
        </section>
      ) : null}

      {[
        { key: "attention", title: "Traže pažnju", hint: "Artikal van uobičajenog ritma, ili kupac koji je prestao da kupuje.", list: attention },
        { key: "stale", title: "Obračun zastareo — proveriti posle preračuna", hint: "Stigle su nove kupovine koje obračun još nije video.", list: stale },
        { key: "due", title: "Uskoro uobičajena porudžbina", hint: "Približava se uobičajeni termin.", list: due },
      ]
        .filter((g) => g.list.length)
        .map((g) => (
          <section key={g.key} className="portal-panel">
            <div className="portal-section-header">
              <div>
                <h2>
                  {g.title} · {g.list.length}
                </h2>
                <p>{g.hint}</p>
              </div>
            </div>
            <ol className="zr-list">
              {g.list.map((item) => (
                <CustomerItem key={item.id} item={item} showReps={all} />
              ))}
            </ol>
          </section>
        ))}

      {quiet.length || withoutData.length ? (
        <details className="portal-panel zr-quiet">
          <summary>
            Bez potrebe za posebnim kontaktom ili bez dovoljno istorije · {quiet.length + withoutData.length}
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
