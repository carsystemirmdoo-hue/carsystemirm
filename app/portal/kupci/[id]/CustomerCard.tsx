import { Badge } from "@/components/portal/PortalPrimitives";
import type { ArticleIdentity } from "@/lib/ordering/ordering-service";
import type { CrossSell } from "@/lib/recommendations/cross-sell";
import type { CustomerArticle, CustomerProfile } from "@/lib/recommendations/customer-profile";
import { CONFIDENCE_LABELS } from "@/lib/recommendations/policy.mjs";
import { ARTICLE_STATUS_LABELS, srDate } from "@/lib/recommendations/customerSummary.mjs";
import {
  CONFIDENCE_MEANING,
  legacySuggestions,
  MAIN_LIMIT,
  roughInterval,
  suggestionReason,
  suggestionTone,
} from "@/lib/recommendations/suggestionRanking.mjs";

type Tone = "success" | "warning" | "danger" | "neutral";

const STATUS_TONE: Record<string, Tone> = {
  dormant: "danger",
  overdue: "warning",
  due: "success",
  due_soon: "success",
  not_yet: "neutral",
  provisional: "neutral",
  insufficient_history: "neutral",
  not_computed: "neutral",
};

function dana(n: number) {
  const a = Math.abs(n);
  return a % 10 === 1 && a % 100 !== 11 ? `${a} dan` : `${a} dana`;
}

function statusLabel(status: string) {
  return ARTICLE_STATUS_LABELS[status as keyof typeof ARTICLE_STATUS_LABELS] ?? status;
}

/**
 * Vrh kartice: pet odgovora za pet sekundi.
 * Ko je kupac stoji u zaglavlju strane; ovde su stanje, promena i predlog.
 */
export function CustomerSummary({
  profile,
  assignees,
  inactive = false,
}: {
  profile: CustomerProfile;
  assignees: string[];
  /** Neaktivan kupac: bez predloga za razgovor. */
  inactive?: boolean;
}) {
  const s = profile.summary;
  return (
    <section className="portal-panel cs-summary" aria-label="Sažetak kupca">
      <div className="cs-summary-top">
        <Badge tone={s.status.tone as Tone}>{s.status.label}</Badge>
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

      <FreshnessLine profile={profile} />

      <div className="cs-summary-body">
        <div className="cs-block">
          <h3>Šta se promenilo</h3>
          <p>{s.change}</p>
        </div>

        <div className="cs-block cs-next">
          <h3>Predlog za sledeći razgovor</h3>
          <p>{inactive ? "Kupac je neaktivan — predlog za razgovor se ne daje." : s.nextStep}</p>
          <small>Interna pomoć komercijalisti. Ne šalje se kupcu i ne menja cenu ni uslove.</small>
        </div>
      </div>
    </section>
  );
}

/**
 * Artikal onako kako ga zaposleni prepoznaju: šifra i naziv iz BizniSofta, uz
 * kataloški proizvod, varijantu i pakovanje kada je veza potvrđena. Ništa se
 * ne povezuje ovde — samo se čita postojeća veza.
 */
function CatalogIdentity({ id }: { id: ArticleIdentity | undefined }) {
  if (!id) return <small className="cs-identity">bez zapisa u registru artikala</small>;
  if (!id.catalog) {
    return (
      <small className="cs-identity" data-state="none">
        Katalog: {id.mappingStatus === "suggested" ? "samo predlog veze — nije potvrđeno" : "nije povezano"}
      </small>
    );
  }
  return (
    <small className="cs-identity">
      Katalog:{" "}
      <a href={id.catalog.href} target="_blank" rel="noreferrer">
        {id.catalog.name}
      </a>
      {id.catalog.variantLabel ? ` · ${id.catalog.variantLabel}` : ""}
      {id.packLabel ? ` · ${id.packLabel}` : ""}
    </small>
  );
}

function ArticleRow({ a, asOfDate, identity }: { a: CustomerArticle; asOfDate: string | null; identity?: ArticleIdentity }) {
  return (
    <details className="cs-article" id={`artikal-${encodeURIComponent(a.articleCode)}`}>
      <summary>
        <span className="cs-article-status">
          <Badge tone={a.statusOutdated ? "neutral" : (STATUS_TONE[a.status] ?? "neutral")}>
            {statusLabel(a.status)}
          </Badge>
          {a.statusOutdated ? <small>kupljeno posle obračuna</small> : null}
        </span>
        <span className="cs-article-name">
          <strong>{a.articleName ?? a.articleCode}</strong>
          <small>BizniSoft {a.articleCode}</small>
          <CatalogIdentity id={identity} />
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
          Datumi kupovine iz potvrđenih dokumenata
          {asOfDate ? ` · status i termin su iz obračuna na dan ${srDate(asOfDate)}` : ""}:
        </p>
        <ol className="cs-dates">
          {a.purchaseDates.map((d) => (
            <li key={d} data-new={a.newPurchaseDates.includes(d) ? "true" : undefined}>
              {srDate(d)}
              {a.newPurchaseDates.includes(d) ? " · posle obračuna" : ""}
            </li>
          ))}
        </ol>
      </div>
    </details>
  );
}

/** Šta za predlog nedostaje — kaže se izričito, umesto da se prećuti. */
function suggestionLimits(id: ArticleIdentity | undefined): string[] {
  if (!id) return ["artikal nije u registru artikala", "grupa nije potvrđena", "bez veze sa katalogom", "bez važeće cene"];
  const out: string[] = [];
  if (!id.productGroup) out.push("grupa nije potvrđena");
  if (!id.catalog) out.push(id.mappingStatus === "suggested" ? "veza sa katalogom samo predložena" : "bez veze sa katalogom");
  if (!id.hasCurrentPrice) out.push("bez važeće cene u cenovniku");
  return out;
}

function SuggestionCard({
  a,
  identity,
  common,
}: {
  a: CustomerArticle;
  identity?: ArticleIdentity;
  common: Set<string>;
}) {
  // Zajednička ograničenja stoje jednom iznad liste; ovde samo ono što je drugačije.
  const limits = suggestionLimits(identity).filter((l) => !common.has(l));
  const conf = (a.confidence ?? "low") as keyof typeof CONFIDENCE_MEANING;
  return (
    <li className="cs-sugg" data-tone={suggestionTone(a)}>
      <div className="cs-sugg-head">
        <strong>{a.articleName ?? a.articleCode}</strong>
        <small>BizniSoft {a.articleCode}</small>
      </div>
      <p className="cs-sugg-reason">{suggestionReason(a)}</p>
      <dl className="cs-sugg-facts">
        <div>
          <dt>Poslednja kupovina</dt>
          <dd>
            {srDate(a.lastPurchaseOn)} <small>pre {dana(a.daysSinceLastPurchase)}</small>
          </dd>
        </div>
        <div>
          <dt>Osnova</dt>
          <dd>
            {a.eventCount} kupovina od {srDate(a.firstPurchaseOn)}
            {a.medianIntervalDays !== null ? (
              <small>uobičajen razmak {roughInterval(a.medianIntervalDays)}</small>
            ) : null}
          </dd>
        </div>
        <div>
          <dt>Pouzdanost</dt>
          <dd>
            {CONFIDENCE_LABELS[conf] ?? conf}
            <small>{CONFIDENCE_MEANING[conf]}</small>
          </dd>
        </div>
      </dl>
      {limits.length ? <p className="cs-sugg-limits">Ograničenje: {limits.join(" · ")}</p> : null}
      <a className="cs-sugg-basis" href={`#artikal-${encodeURIComponent(a.articleCode)}`}>
        Osnov i svi datumi
      </a>
    </li>
  );
}

/**
 * Predlozi za razgovor: prvo najviše pet, zatim „Prikažite sve" i odvojeno
 * slabiji signali. Pun spisak po grupama ostaje ispod (`CustomerArticles`).
 */
export function CustomerSuggestions({
  profile,
  identities = {},
  order = "r1",
}: {
  profile: CustomerProfile;
  identities?: Record<string, ArticleIdentity>;
  /** „r1" = eksperimentalni redosled; „dosadasnji" = raniji, samo za poređenje. */
  order?: "r1" | "dosadasnji";
}) {
  if (profile.articles.length === 0) return null;
  const legacy = order === "dosadasnji";
  // Isti artikli i isti `cadence_v1` rezultat; razlikuje se samo izbor i redosled.
  const { top, main, weak } =
    legacy && profile.hasActiveRun && profile.freshness.state !== "new_documents"
      ? legacySuggestions(profile.articles)
      : profile.suggestions;
  const rest = main.slice(top.length);
  const shown = [...main, ...weak];
  const perArticle = shown.map((a) => suggestionLimits(identities[a.articleCode]));
  const common = new Set(
    perArticle.length ? perArticle[0].filter((l) => perArticle.every((x) => x.includes(l))) : [],
  );
  const card = (a: CustomerArticle) => (
    <SuggestionCard key={a.articleCode} a={a} identity={identities[a.articleCode]} common={common} />
  );
  return (
    <section className="portal-panel cs-suggestions" id="predlozi" aria-labelledby="cs-sugg-title">
      <div className="portal-section-header">
        <div>
          <h2 id="cs-sugg-title">
            Predlozi za razgovor{main.length ? ` (${top.length} od ${main.length})` : ""}
          </h2>
          {legacy ? (
            <p>
              Dosadašnji redosled, samo za poređenje: ranije redovni artikli, pa oni koji kasne, pa
              oni u roku — bez obzira na pouzdanost i starost poslednje kupovine. Pouzdanost govori
              koliko je ritam ujednačen, nije verovatnoća kupovine.
            </p>
          ) : (
            <p>
              Do {MAIN_LIMIT} artikala, poređanih po tome koliko je termin sada aktuelan, po pouzdanosti i
              po broju kupovina — ne samo po proteklom vremenu. Iz faktura se ne vidi lager ni potrošnja
              kupca: termin je ritam ranijih kupovina, ne datum kada mu nešto treba. Pouzdanost govori
              koliko je ritam ujednačen, nije verovatnoća kupovine.
            </p>
          )}
        </div>
        <div className="cs-sugg-order">
          <span className="cs-sugg-exp">
            {legacy ? "Dosadašnji redosled" : "Redosled R1 · eksperiment"}
          </span>
          <a
            href={`/portal/kupci/${encodeURIComponent(profile.customerId)}${legacy ? "" : "?redosled=dosadasnji"}#predlozi`}
          >
            {legacy ? "Vratite R1" : "Uporedite sa dosadašnjim"}
          </a>
        </div>
      </div>
      <div className="portal-panel-body cs-sugg-body">
        {common.size ? (
          <p className="cs-sugg-common">
            Za sve predloge: {[...common].join(" · ")}. Predlog je razgovor o artiklu, ne ponuda.
          </p>
        ) : null}
        {!profile.hasActiveRun ? (
          <p className="cs-sugg-empty">Predlozi se prikazuju posle obračuna preporuka.</p>
        ) : profile.freshness.state === "new_documents" ? (
          <p className="cs-sugg-empty">Posle obračuna su stigli novi dokumenti; predlozi se prikazuju posle novog obračuna.</p>
        ) : top.length === 0 ? (
          <p className="cs-sugg-empty">
            Nema pouzdanog predloga: nijedan artikal sa srednjom ili visokom pouzdanošću nije sada u
            terminu niti je nedavno prestao.
          </p>
        ) : (
          <ol className="cs-sugg-list">{top.map(card)}</ol>
        )}
        {rest.length ? (
          <details className="cs-sugg-more">
            <summary>Prikažite sve ({main.length})</summary>
            <ol className="cs-sugg-list" start={top.length + 1}>
              {rest.map(card)}
            </ol>
          </details>
        ) : null}
        {weak.length ? (
          <details className="cs-sugg-more cs-sugg-weak">
            <summary>Slabiji signali ({weak.length})</summary>
            <p>
              Samo dve kupovine ili neujednačen ritam — procena je slaba. Nije predlog, samo podsetnik
              ako razgovor ionako dođe do tog artikla.
            </p>
            <ol className="cs-sugg-list">{weak.map(card)}</ol>
          </details>
        ) : null}
        <a className="cs-sugg-all" href="#artikli">
          Svi artikli po grupama ({profile.articles.length})
        </a>
      </div>
    </section>
  );
}

/** Glavna lista: svaki artikal tačno jednom, grupe po važnosti. */
export function CustomerArticles({
  profile,
  identities = {},
}: {
  profile: CustomerProfile;
  identities?: Record<string, ArticleIdentity>;
}) {
  if (profile.articles.length === 0) return null;
  return (
    <section className="portal-panel" id="artikli">
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
            <ArticleRow key={a.articleCode} a={a as CustomerArticle} asOfDate={profile.asOfDate} identity={identities[a.articleCode]} />
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
          {profile.purchaseDayCount} dana sa kupovinom) do {srDate(profile.today)}. Statusi i
          termini su iz obračuna preporuka
          {profile.asOfDate ? ` na dan ${srDate(profile.asOfDate)}` : " (još nije pokrenut)"}.
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

function fmtTime(at: Date | null) {
  if (!at) return "—";
  return new Date(at).toLocaleString("sr-Latn-RS", {
    timeZone: "Europe/Belgrade",
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Vreme podataka i obračuna, uvek vidljivo. Kada obračun kasni za podacima,
 * to se kaže izričito — stari status se ne predstavlja kao aktuelan.
 */
export function FreshnessLine({ profile }: { profile: CustomerProfile }) {
  const f = profile.freshness;
  const tone = f.state === "new_documents" ? "warning" : f.state === "aged" ? "note" : "plain";
  return (
    <div className="cs-freshness" data-tone={tone}>
      <span>
        Podaci do <strong>{srDate(profile.today)}</strong> · poslednji uvoz {fmtTime(profile.lastIngestedAt)}
      </span>
      <span>
        Obračun preporuka:{" "}
        {profile.asOfDate ? (
          <>
            <strong>{srDate(profile.asOfDate)}</strong> · pokrenut {fmtTime(profile.runStartedAt)}
          </>
        ) : (
          "nije pokrenut"
        )}
      </span>
      {f.state === "new_documents" ? (
        <span className="cs-freshness-msg">
          Zastareo za ovog kupca: posle obračuna je stiglo {f.newDocuments.length} nov
          {f.newDocuments.length === 1 ? " dokument" : "ih dokumenata"}. Savet se ne prikazuje dok se obračun ne ponovi.
        </span>
      ) : f.state === "aged" ? (
        <span className="cs-freshness-msg">
          Obračun je star {f.runAgeDays} dana; statusi se odnose na dan obračuna.
        </span>
      ) : null}
    </div>
  );
}

/**
 * Predlozi dodatnih proizvoda — interno. Svaki predlog nosi razlog koji se može
 * proveriti; slab signal je označen kao slab, a nedostatak podataka rečima.
 */
export function CustomerCrossSell({ crossSell, names }: { crossSell: CrossSell; names: Record<string, string> }) {
  const label = (code: string) => names[code] ?? code;
  return (
    <section className="portal-panel">
      <div className="portal-section-header">
        <div>
          <h2>Predlozi za proširenje ({crossSell.suggestions.length})</h2>
          <p>
            Artikli koje kupac ne uzima, a uz ono što uzima ih kupuju slične firme ili ih katalog navodi kao kompatibilne.
            Interno — kupac ovo ne vidi. Nije cena ni obećanje dostupnosti.
          </p>
        </div>
      </div>
      <div className="portal-panel-body">
        {!crossSell.ok ? (
          <p className="cs-xs-warn">
            {crossSell.reason} Predlozi iz sličnih kupovina se ne prikazuju{crossSell.suggestions.length ? "; ostaju samo kataloški." : "."}
          </p>
        ) : null}
        {crossSell.suggestions.length === 0 ? (
          crossSell.ok ? <p>Nema predloga: nijedan artikal ne uzima dovoljno sličnih firmi, a katalog ne navodi kompatibilne povezane proizvode.</p> : null
        ) : (
          <ol className="cs-xs">
            {crossSell.suggestions.map((s) => (
              <li key={s.articleCode}>
                <span className="cs-xs-name">
                  <strong>{s.identity?.catalog?.name ?? s.identity?.bizName ?? s.articleCode}</strong>
                  {s.identity?.catalog?.variantLabel ? <small> · {s.identity.catalog.variantLabel}</small> : null}
                  <small>
                    BizniSoft {s.articleCode}
                    {s.identity?.bizName ? ` — ${s.identity.bizName}` : ""}
                  </small>
                </span>
                <span className="cs-xs-why">
                  {s.peer ? (
                    <span>
                      {s.peer.strength === "weak" ? <em className="cs-xs-weak">slab signal</em> : null}
                      {s.peer.support} od {s.peer.peers} firmi sa sličnim kupovinama uzima i ovo (uz{" "}
                      {s.peer.because.map(label).join(", ")}).
                    </span>
                  ) : null}
                  {s.catalog ? (
                    <span>
                      Katalog: kompatibilno sa „{s.catalog.viaName}” koji kupac uzima ({s.catalog.viaCode}).
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ol>
        )}
        <p className="portal-footnote">
          Osnov: potvrđene kupovine iz poslednjih 365 dana ({crossSell.customersWithHistory} firmi, od toga{" "}
          {crossSell.peers} sa sličnim kupovinama). Imena drugih firmi se ne prikazuju.
        </p>
      </div>
    </section>
  );
}
