import Link from "next/link";
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
  active: boolean;
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
        {item.active ? (
          <Badge tone={s.status.tone as Tone}>{s.status.label}</Badge>
        ) : (
          <Badge tone="neutral">Neaktivan kupac</Badge>
        )}
      </div>
      <div className="zr-meta">
        <span>
          Poslednja kupovina: <strong>{s.lastPurchaseOn ? srDate(s.lastPurchaseOn) : "—"}</strong>
          {s.daysSinceLastPurchase !== null ? ` · pre ${dana(s.daysSinceLastPurchase)}` : ""}
        </span>
        {item.city ? <span>{item.city}</span> : null}
        {showReps ? <span>Komercijalista: {item.reps.length ? item.reps.join(", ") : "nije dodeljen"}</span> : null}
      </div>
      {item.active ? (
      <div className="zr-body">
        <div>
          <h3>Zašto</h3>
          <p>{s.change}</p>
          {s.mention.length ? (
            <ul className="zr-articles">
              {/* Najviše tri; ostatak rangirane liste je na kartici kupca. */}
              {s.mention.slice(0, 3).map((m) => (
                <li key={m.articleCode} data-tone={m.tone}>
                  <strong>{m.name}</strong> — {m.reason}
                </li>
              ))}
              {s.suggestionCounts.main > 3 ? (
                <li className="zr-more">
                  <Link href={`/portal/kupci/${item.id}`}>
                    još {s.suggestionCounts.main - 3} na kartici kupca
                  </Link>
                </li>
              ) : null}
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
            Otvorite karticu i osnov →
          </Link>
        </div>
      </div>
      ) : (
        <p className="zr-inactive">Kupac je označen kao neaktivan — bez predloga; istorija i osnov su na kartici kupca.</p>
      )}
    </li>
  );
}

/** Koliko kupaca po grupi se prikazuje odmah; ostali su u otvorivom delu. */
const ZR_ODMAH = 10;

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
      active: c.active,
      profile: data.profiles.get(c.id) ?? null,
      crossSell: crossSell.get(c.id) ?? null,
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
        eyebrow="Prodaja"
        title="Za razgovor"
        description={
          all
            ? "Kupci poređani po tome kome vredi posvetiti pažnju. Razlog i predlog potiču iz ritma kupovine tog kupca; osnov je na kartici kupca. Artikli po kupcu su iz redosleda R1 (eksperiment)."
            : "Vaši dodeljeni kupci, poređani po tome kome vredi posvetiti pažnju. Razlog i predlog potiču iz ritma kupovine tog kupca. Artikli po kupcu su iz redosleda R1 (eksperiment)."
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
              <button type="submit">Prikažite</button>
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

      {[
        { key: "attention", title: "Traže pažnju", hint: "Artikal van uobičajenog ritma, ili kupac koji je prestao da kupuje.", list: attention },
        { key: "stale", title: "Obračun zastareo — proveriti posle preračuna", hint: "Stigle su nove kupovine koje obračun još nije video.", list: stale },
        { key: "due", title: "Uskoro uobičajena porudžbina", hint: "Približava se uobičajeni termin.", list: due },
        { key: "inactive", title: "Neaktivni kupci", hint: "Označeni kao neaktivni: bez predloga, istorija ostaje na kartici.", list: neaktivni },
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
            {/* Prvih nekoliko kupaca odmah, ostatak na jedan klik — redosled
                se ne menja (lista od 75 kupaca pravila je stranu od ~16.000 px). */}
            <ol className="zr-list">
              {g.list.slice(0, ZR_ODMAH).map((item) => (
                <CustomerItem key={item.id} item={item} showReps={all} />
              ))}
            </ol>
            {g.list.length > ZR_ODMAH ? (
              <details className="zr-rest">
                <summary>
                  Prikažite ostalih {g.list.length - ZR_ODMAH} ({g.title.toLowerCase()})
                </summary>
                <ol className="zr-list" start={ZR_ODMAH + 1}>
                  {g.list.slice(ZR_ODMAH).map((item) => (
                    <CustomerItem key={item.id} item={item} showReps={all} />
                  ))}
                </ol>
              </details>
            ) : null}
          </section>
        ))}

      {quiet.length || withoutData.length ? (
        <details className="portal-panel zr-quiet">
          <summary>
            Bez potrebe za posebnim kontaktom, nije obračunato ili premalo istorije · {quiet.length + withoutData.length}
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
