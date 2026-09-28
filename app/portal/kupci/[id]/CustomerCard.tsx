import { Badge } from "@/components/portal/PortalPrimitives";
import type { CustomerArticle, CustomerProfile } from "@/lib/recommendations/customer-profile";
import { CONFIDENCE_LABELS, STATUS_LABELS } from "@/lib/recommendations/policy.mjs";
import { srDate } from "@/lib/recommendations/customerSummary.mjs";

type Tone = "success" | "warning" | "danger" | "neutral";

const STATUS_TONE: Record<string, Tone> = {
  dormant: "danger",
  overdue: "warning",
  due: "success",
  due_soon: "success",
  not_yet: "neutral",
  provisional: "neutral",
  insufficient_history: "neutral",
};

function dana(n: number) {
  const a = Math.abs(n);
  return a % 10 === 1 && a % 100 !== 11 ? `${a} dan` : `${a} dana`;
}

function statusLabel(status: string) {
  return STATUS_LABELS[status as keyof typeof STATUS_LABELS] ?? status;
}

/**
 * Vrh kartice: pet odgovora za pet sekundi.
 * Ko je kupac stoji u zaglavlju strane; ovde su stanje, promena i predlog.
 */
export function CustomerSummary({
  profile,
  assignees,
}: {
  profile: CustomerProfile;
  assignees: string[];
}) {
  const s = profile.summary;
  return (
    <section className="portal-panel cs-summary" aria-label="Sažetak kupca">
      <div className="cs-summary-top">
        <Badge tone={s.status.tone}>{s.status.label}</Badge>
        <dl className="cs-facts">
          <div>
            <dt>Poslednja kupovina</dt>
            <dd>
              {s.lastPurchaseOn ? srDate(s.lastPurchaseOn) : "—"}
              {s.daysSinceLastPurchase !== null ? <small>pre {dana(s.daysSinceLastPurchase)}</small> : null}
            </dd>
          </div>
          <div>
            <dt>Uobičajeno</dt>
            <dd>{s.usual}</dd>
          </div>
          <div>
            <dt>Komercijalista</dt>
            <dd>{assignees.length ? assignees.join(", ") : "nije dodeljen"}</dd>
          </div>
        </dl>
      </div>

      <div className="cs-summary-body">
        <div className="cs-block">
          <h3>Šta se promenilo</h3>
          <p>{s.change}</p>
        </div>

        {s.mention.length ? (
          <div className="cs-block">
            <h3>Vredi pomenuti</h3>
            <ul className="cs-mentions">
              {s.mention.map((m) => (
                <li key={m.articleCode} data-tone={m.tone}>
                  <a href={`#artikal-${encodeURIComponent(m.articleCode)}`}>
                    <strong>{m.name}</strong>
                    <span>{m.reason}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="cs-block cs-next">
          <h3>Predlog za sledeći razgovor</h3>
          <p>{s.nextStep}</p>
          <small>Interna pomoć komercijalisti. Ne šalje se kupcu i ne menja cenu ni uslove.</small>
        </div>
      </div>
    </section>
  );
}

function ArticleRow({ a, asOfDate }: { a: CustomerArticle; asOfDate: string }) {
  return (
    <details className="cs-article" id={`artikal-${encodeURIComponent(a.articleCode)}`}>
      <summary>
        <Badge tone={STATUS_TONE[a.status] ?? "neutral"}>{statusLabel(a.status)}</Badge>
        <span className="cs-article-name">
          <strong>{a.articleName ?? a.articleCode}</strong>
          <small>{a.articleCode}</small>
        </span>
        <span className="cs-article-fact">
          <small>Poslednja</small>
          {srDate(a.lastPurchaseOn)}
          <small>pre {dana(a.daysSinceLastPurchase)}</small>
        </span>
        <span className="cs-article-fact">
          <small>Uobičajeno</small>
          {a.medianIntervalDays !== null ? `na ~${dana(a.medianIntervalDays)}` : "—"}
        </span>
        <span className="cs-article-fact">
          <small>Kupovina</small>
          {a.eventCount}
        </span>
        <span className="cs-article-open" aria-hidden="true">Osnov</span>
      </summary>
      <div className="cs-basis">
        <p>{a.explanation}</p>
        <dl className="cs-basis-facts">
          <div>
            <dt>Prva kupovina</dt>
            <dd>{srDate(a.firstPurchaseOn)}</dd>
          </div>
          <div>
            <dt>Očekivani termin</dt>
            <dd>
              {a.expectedNextOn ? srDate(a.expectedNextOn) : "—"}
              {a.toleranceDays !== null ? <small> ± {dana(a.toleranceDays)}</small> : null}
            </dd>
          </div>
          <div>
            <dt>Pouzdanost</dt>
            <dd>
              {a.confidence
                ? CONFIDENCE_LABELS[a.confidence as keyof typeof CONFIDENCE_LABELS] ?? a.confidence
                : "—"}
            </dd>
          </div>
          <div>
            <dt>Dokumenata</dt>
            <dd>{a.documentCount}</dd>
          </div>
        </dl>
        <p className="cs-dates-label">
          Datumi kupovine iz potvrđenih dokumenata (stanje na dan {srDate(asOfDate)}):
        </p>
        <ol className="cs-dates">
          {a.purchaseDates.map((d) => (
            <li key={d}>{srDate(d)}</li>
          ))}
        </ol>
      </div>
    </details>
  );
}

/** Glavna lista: svaki artikal tačno jednom, grupe po važnosti. */
export function CustomerArticles({ profile }: { profile: CustomerProfile }) {
  if (profile.articles.length === 0) return null;
  return (
    <section className="portal-panel">
      <div className="portal-section-header">
        <div>
          <h2>Artikli ({profile.articles.length})</h2>
          <p>
            Svaki artikal je naveden jednom, u grupi koja najviše govori o njemu. Kliknite na red za
            osnov: sve datume kupovine i kako je termin izračunat.
          </p>
        </div>
      </div>
      <div className="portal-panel-body cs-groups">
        {profile.groups.map((g) => {
          const rows = g.items.map((a) => (
            <ArticleRow key={a.articleCode} a={a as CustomerArticle} asOfDate={profile.asOfDate} />
          ));
          return g.key === "thin" ? (
            <details key={g.key} className="cs-group cs-group-thin">
              <summary>
                {g.label} · {g.items.length}
              </summary>
              <div className="cs-group-list">{rows}</div>
            </details>
          ) : (
            <div key={g.key} className="cs-group">
              <h3>
                {g.label} <span>· {g.items.length}</span>
              </h3>
              <div className="cs-group-list">{rows}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function CustomerMethod({ profile }: { profile: CustomerProfile }) {
  return (
    <details className="portal-panel cs-method">
      <summary>Kako se računa</summary>
      <div className="portal-panel-body">
        <p>
          Osnova su potvrđeni prodajni dokumenti ({profile.documentCount} dokumenata,{" "}
          {profile.purchaseDayCount} dana sa kupovinom), stanje na dan {srDate(profile.asOfDate)}.
          Kupovina koja nije uvezena ovde se ne vidi.
        </p>
        <p>
          Za svaki artikal se meri razmak između kupovina tog kupca i uzima medijana — jedna vanredna
          nabavka ne pomera ritam. „Prošao uobičajeni termin” znači da je prošlo više od uobičajenog
          razmaka uz dozvoljeno odstupanje. „Ranije redovno, sada ne” znači da je prošlo najmanje tri
          uobičajena razmaka i više od 180 dana. Sa jednom ili dve kupovine ritam se ne procenjuje.
        </p>
        <p>
          Pouzdanost nije verovatnoća: zavisi od broja kupovina, pravilnosti ritma i dužine istorije.
          Algoritam: {profile.hasActiveRun ? "cadence_v1" : "obračun preporuka još nije pokrenut"}.
        </p>
      </div>
    </details>
  );
}
