import { quantity } from "@/lib/ordering/panelFormat.mjs";
import {
  Badge,
  Metric,
  PageHeader,
  SectionHeader,
  type Tone,
} from "@/components/portal/PortalPrimitives";
import { RecomputeRecommendations } from "@/features/portal/RecomputeRecommendations";
import { can, seesAllCustomers } from "@/lib/authz/permissions.mjs";
import { requireCapability } from "@/lib/authz/session";
import { resolveLedgerScope } from "@/lib/ledger/effective-sales";
import { isRecommendationsEnabled } from "@/lib/recommendations/gate";
import { defaultAsOfDate } from "@/lib/recommendations/asOfDate.mjs";
import { belgradeDate } from "@/lib/recommendations/customerRhythm.mjs";
import {
  CONFIDENCE_LABELS,
  CONFIDENCE_LEVELS,
  STATUS_LABELS,
} from "@/lib/recommendations/policy.mjs";
import {
  recommendationRows,
  recommendationStatusCounts,
  salespeopleInScope,
  type RecommendationFilter,
  type RecommendationRow,
} from "@/lib/recommendations/query";
import { activeRun, recentRuns } from "@/lib/recommendations/recompute";
import { parseCustomerStatusFilter } from "@/lib/customers/customerStatus.mjs";
import type { RecommendationConfidence, RecommendationStatus } from "@/db/schema";

export const dynamic = "force-dynamic";

/**
 * Preporuke — INTERNI ekran za gazdu i komercijaliste.
 *
 * Odgovara na jedno pitanje: koji kupac će verovatno uskoro ponovo tražiti koji
 * BizniSoft artikal. Ne prikazuje količinu, cenu, maržu ni dostupnost, ne
 * predlaže nabavku i ne pravi porudžbinu — za to ne postoji ni kolona u bazi.
 *
 * Ovo NIJE kupčev ekran i ne postoji u kupčevom portalu. Ovlašćenje je
 * `view:preporuke`, odvojeno od `view:prodaja`: prodaja je ono što se dogodilo,
 * a ovo je procena onoga što tek treba da se dogodi, i procena se čita kao
 * obećanje.
 *
 * Svaki upit ide kroz `LedgerScope` razrešen NA SERVERU iz sesije. Nijedan
 * parametar iz adrese ne dodiruje opseg — filteri se dodaju uz njega, uvek
 * kroz `AND`, pa je rezultat presek, nikad unija.
 */

/** Radne grupe onako kako ih komercijalista čita. */
const GRUPE: {
  kljuc: string;
  naslov: string;
  statusi: RecommendationStatus[];
  tone: Tone;
  opis: string;
}[] = [
  {
    kljuc: "sada",
    naslov: "Treba kontaktirati sada",
    statusi: ["due"],
    tone: "success",
    opis: "Kupac je u svom uobičajenom terminu za ovaj artikal.",
  },
  {
    kljuc: "kasni",
    naslov: "Kasni",
    statusi: ["overdue"],
    tone: "danger",
    opis: "Uobičajeni termin je prošao, a kupovine još nema.",
  },
  {
    kljuc: "uskoro",
    naslov: "Uskoro",
    statusi: ["due_soon"],
    tone: "warning",
    opis: "Termin se približava; ima vremena za pripremu.",
  },
  {
    kljuc: "provisional",
    naslov: "Privremene procene",
    statusi: ["provisional"],
    tone: "neutral",
    opis:
      "Samo dve potvrđene kupovine — jedan razmak nije ritam. Prikazuje se " +
      "odvojeno i nikada se ne meša sa radnim preporukama.",
  },
  {
    kljuc: "ostalo",
    naslov: "Još nije vreme i uspavani",
    statusi: ["not_yet", "dormant"],
    tone: "info",
    opis: "Nema šta da se radi danas; stoji radi pregleda.",
  },
];

const STATUS_TONE: Record<RecommendationStatus, Tone> = {
  due: "success",
  overdue: "danger",
  due_soon: "warning",
  provisional: "neutral",
  not_yet: "info",
  dormant: "info",
  insufficient_history: "neutral",
};

const CONFIDENCE_TONE: Record<RecommendationConfidence, Tone> = {
  high: "success",
  medium: "warning",
  low: "neutral",
};

function datum(iso: string | null): string {
  if (!iso) return "—";
  const [g, m, d] = iso.split("-");
  return `${d}.${m}.${g}.`;
}

function dana(n: number): string {
  const a = Math.abs(n);
  return a % 10 === 1 && a % 100 !== 11 ? `${a} dan` : `${a} dana`;
}

/** „kasni 12 dana" / „za 5 dana" / „danas" — bez znaka koji niko ne čita. */
function odstupanje(daysUntilExpected: number | null): string {
  if (daysUntilExpected === null) return "—";
  if (daysUntilExpected === 0) return "danas";
  return daysUntilExpected < 0
    ? `kasni ${dana(daysUntilExpected)}`
    : `za ${dana(daysUntilExpected)}`;
}

function proteklo(iso: string | null): string {
  if (!iso) return "nikad";
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 0) return "nepoznato";
  const min = Math.floor(ms / 60000);
  if (min < 1) return "pre manje od minuta";
  if (min < 60) return `pre ${min} min`;
  const sati = Math.floor(min / 60);
  if (sati < 24) return `pre ${sati} h`;
  return `pre ${Math.floor(sati / 24)} dana`;
}

/**
 * Filteri iz adrese, svedeni na poznate vrednosti.
 *
 * Nepoznata vrednost se ODBACUJE, ne prosleđuje: `status=' OR 1=1` ne sme ni da
 * stigne do upita, a `status=nepostojeci` ne sme da postane prazan filter koji
 * tiho vraća sve.
 */
function filterIz(params: {
  q?: string;
  status?: string;
  pouzdanost?: string;
  komercijalista?: string;
  kupci?: string;
}): RecommendationFilter {
  const statusi = (params.status ?? "")
    .split(",")
    .filter((s): s is RecommendationStatus => s in STATUS_LABELS);
  const pouzdanost = (params.pouzdanost ?? "")
    .split(",")
    .filter((c): c is RecommendationConfidence =>
      (CONFIDENCE_LEVELS as readonly string[]).includes(c),
    );
  return {
    q: params.q?.slice(0, 120),
    status: statusi.length ? statusi : undefined,
    confidence: pouzdanost.length ? pouzdanost : undefined,
    /*
     * UUID oblik se proverava ovde. Neispravna vrednost bi u upitu bila greška
     * tipa, a greška tipa u `WHERE` daje 500 umesto praznog rezultata.
     */
    salespersonUserId: /^[0-9a-f-]{36}$/i.test(params.komercijalista ?? "")
      ? params.komercijalista
      : undefined,
    customerStatus: parseCustomerStatusFilter(params.kupci),
  };
}

export default async function RecommendationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    pouzdanost?: string;
    komercijalista?: string;
    kupci?: string;
  }>;
}) {
  const user = await requireCapability("view:preporuke", "/portal/preporuke");
  const params = await searchParams;
  const filter = filterIz(params);

  const ukljuceno = isRecommendationsEnabled();
  const smeRecompute = can(user, "recommendations:recompute");
  const viditSve = seesAllCustomers(user);

  const scope = await resolveLedgerScope(user);
  const opsegDostupan = scope.customerIds === null || scope.customerIds.length > 0;

  const [run, prolazi, redovi, brojaci, komercijalisti] = await Promise.all([
    activeRun(),
    recentRuns(5),
    recommendationRows(scope, filter),
    recommendationStatusCounts(scope, { customerStatus: filter.customerStatus }),
    salespeopleInScope(scope),
  ]);

  const poGrupi = new Map<string, RecommendationRow[]>();
  for (const g of GRUPE) poGrupi.set(g.kljuc, []);
  for (const r of redovi) {
    const g = GRUPE.find((x) => x.statusi.includes(r.status));
    if (g) poGrupi.get(g.kljuc)!.push(r);
  }

  const zbir = (statusi: RecommendationStatus[]) =>
    statusi.reduce((s, k) => s + (brojaci[k] ?? 0), 0);

  /*
   * Podrazumevani `as of` je dan poslednjeg uspešnog prolaza, ne „danas" —
   * obračun se ponavlja za tačno određen dan koji ulazi u izveštaj. Pre prvog
   * obračuna polje dobija današnji dan (Beograd); prazno polje je ranije tiho
   * blokiralo slanje. Datum se u polju može promeniti.
   */
  const podrazumevaniDatum = defaultAsOfDate(run?.asOfDate, belgradeDate(new Date()));

  return (
    <>
      <PageHeader
        eyebrow="Prodaja"
        title="Preporuke"
        description={
          "Interna procena: koji kupac će verovatno uskoro ponovo tražiti koji BizniSoft artikal. " +
          "Zasnovana isključivo na potvrđenim kupovinama iz izvornih dokumenata."
        }
        meta={
          <>
            <span>
              Algoritam: <b>{run?.algorithmVersion ?? "—"}</b>
            </span>
            <span>
              Obračunato na dan: <b>{datum(run?.asOfDate ?? null)}</b>
            </span>
            <span>
              Poslednji uspešan prolaz:{" "}
              <b>{proteklo(run?.finishedAt ? String(run.finishedAt) : null)}</b>
            </span>
            <span>
              Osnov datuma: <b>{(run?.dateBasis ?? "issued_on") === "issued_on" ? "datum izdavanja fakture" : run?.dateBasis}</b>
            </span>
          </>
        }
        actions={
          smeRecompute ? (
            <RecomputeRecommendations
              defaultAsOfDate={podrazumevaniDatum}
              disabled={!ukljuceno}
            />
          ) : null
        }
      />

      {/* ------------------------------------------------------------------ */}
      <section className="portal-panel" data-accent="warning">
        <SectionHeader
          title="Ovo je procena, ne porudžbina"
          description={
            "Rezultat je izračunat iz istorije kupovine i ne tvrdi ništa o količini, jedinici mere, " +
            "ceni ni raspoloživosti. Ne šalje se kupcu, ne pravi porudžbinu i ne zamenjuje razgovor " +
            "sa kupcem. Sve što piše na ovoj strani odnosi se na TERMIN, nikad na iznos."
          }
        />
      </section>

      {!ukljuceno ? (
        <section className="portal-panel" data-accent="warning">
          <SectionHeader
            title="Preporuke su isključene na serveru"
            description={
              "Postojeći rezultati se prikazuju, ali novo preračunavanje nije dozvoljeno. " +
              "Ovo je podešavanje servera (FEATURE_RECOMMENDATIONS), ne kvar."
            }
          />
        </section>
      ) : null}

      {!opsegDostupan ? (
        <section className="portal-panel" data-accent="warning">
          <SectionHeader
            title="Nemate nijednog dodeljenog kupca"
            description={
              "Preporuke se prikazuju samo za kupce koji su Vam dodeljeni. Dok dodela nema, " +
              "ova strana je prazna — i to nije greška ni kvar podataka."
            }
          />
        </section>
      ) : null}

      {/* ------------------------------------------------------------------ */}
      {/*
        * Brojači mere CEO opseg, bez filtera — namerno.
        *
        * Da prate filter, broj bi se menjao pri svakoj pretrazi i niko ne bi
        * mogao da odgovori „koliko kupaca danas treba pozvati". Zato svaki
        * brojač to i kaže, umesto da se razlika sa naslovom grupe tumači kao
        * greška.
        */}
      <section className="portal-metrics">
        <Metric
          label="Treba kontaktirati sada"
          value={quantity(zbir(["due"]))}
          tone="success"
          context="ceo opseg, bez filtera"
        />
        <Metric
          label="Kasni"
          value={quantity(zbir(["overdue"]))}
          tone="danger"
          context="ceo opseg, bez filtera"
        />
        <Metric
          label="Uskoro"
          value={quantity(zbir(["due_soon"]))}
          tone="warning"
          context="ceo opseg, bez filtera"
        />
        <Metric
          label="Privremene procene"
          value={quantity(zbir(["provisional"]))}
          context="dve kupovine — nije ritam"
        />
      </section>

      {/* ------------------------------------------------------------------ */}
      <section className="portal-panel">
        <SectionHeader
          title="Pretraga i filteri"
          description="Pretraga gleda naziv kupca, šifru i naziv artikla. Opseg se ne menja filterima."
        />
        <form method="get" className="portal-filters">
          <label className="portal-field">
            <span>Pretraga</span>
            <input
              type="search"
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="kupac, šifra ili naziv artikla"
            />
          </label>
          <label className="portal-field">
            <span>Status</span>
            <select name="status" defaultValue={params.status ?? ""}>
              <option value="">svi statusi</option>
              {(Object.keys(STATUS_LABELS) as RecommendationStatus[])
                .filter((s) => s !== "insufficient_history")
                .map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
            </select>
          </label>
          <label className="portal-field">
            <span>Pouzdanost</span>
            <select name="pouzdanost" defaultValue={params.pouzdanost ?? ""}>
              <option value="">sve</option>
              {CONFIDENCE_LEVELS.map((c) => (
                <option key={c} value={c}>
                  {CONFIDENCE_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="portal-field">
            <span>Kupci</span>
            <select name="kupci" defaultValue={filter.customerStatus ?? "aktivni"}>
              <option value="aktivni">aktivni</option>
              <option value="neaktivni">neaktivni</option>
              <option value="svi">svi</option>
            </select>
          </label>
          {viditSve && komercijalisti.length > 0 ? (
            <label className="portal-field">
              <span>Komercijalista</span>
              <select name="komercijalista" defaultValue={params.komercijalista ?? ""}>
                <option value="">svi</option>
                {komercijalisti.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <button type="submit" className="portal-button" data-variant="secondary">
            Primenite
          </button>
        </form>
      </section>

      {/* ------------------------------------------------------------------ */}
      {run === null ? (
        <section className="portal-panel">
          <SectionHeader
            title="Preporuke još nisu izračunate"
            description={
              "Nijedan uspešan prolaz ne postoji. Dok se ne uveze istorija i ne pokrene " +
              "preračunavanje, ova strana nema šta da pokaže."
            }
          />
        </section>
      ) : (
        GRUPE.map((g) => {
          const stavke = poGrupi.get(g.kljuc) ?? [];
          return (
            <section className="portal-panel" key={g.kljuc} data-accent={g.tone}>
              <SectionHeader
                title={`${g.naslov} (${stavke.length})`}
                description={`${g.opis} Broj u naslovu prati filtere iznad.`}
              />
              {stavke.length === 0 ? (
                <p>
                  {g.kljuc === "provisional"
                    ? "Nema parova sa tačno dve potvrđene kupovine."
                    : "Nema stavki u ovoj grupi za izabrani opseg i filtere."}
                </p>
              ) : (
                <div className="portal-table-wrap">
                  {/*
                    * Zasebna klasa, ne kozmetika: browser QA broji redove
                    * PREPORUKA. Bez nje bi prazno stanje tabele „Poslednji
                    * prolazi" (jedan `tr` sa objašnjenjem) bilo prebrojano kao
                    * preporuka, i test bi padao nad ispravnim ekranom.
                    */}
                  <table className="portal-table portal-readiness-table portal-recommendation-table">
                    <thead>
                      <tr>
                        <th scope="col">Kupac</th>
                        <th scope="col">Artikal</th>
                        <th scope="col">Poslednja kupovina</th>
                        <th scope="col">Ciklusa</th>
                        <th scope="col">Tipičan razmak</th>
                        <th scope="col">Očekivano</th>
                        <th scope="col">Odstupanje</th>
                        <th scope="col">Pouzdanost</th>
                        <th scope="col">Objašnjenje</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stavke.map((r) => (
                        <tr key={r.id}>
                          <th scope="row">{r.customerName}</th>
                          <td>
                            {/* Šifra je identitet; naziv je samo pomoć čoveku. */}
                            <b>{r.articleCode}</b>
                            <small>{r.articleName ?? "—"}</small>
                          </td>
                          <td>
                            {datum(r.lastPurchaseOn)}
                            <small>pre {dana(r.daysSinceLastPurchase)}</small>
                          </td>
                          <td>{r.eventCount}</td>
                          <td>
                            {r.medianIntervalDays === null
                              ? "—"
                              : `${r.medianIntervalDays} dana`}
                            {r.medianIntervalDays !== null && r.toleranceDays !== null ? (
                              <small>
                                prozor {Math.max(1, r.medianIntervalDays - r.toleranceDays)}–
                                {r.medianIntervalDays + r.toleranceDays} dana
                              </small>
                            ) : null}
                          </td>
                          <td>
                            {datum(r.expectedNextOn)}
                            <small>
                              <Badge tone={STATUS_TONE[r.status]}>
                                {STATUS_LABELS[r.status]}
                              </Badge>
                            </small>
                          </td>
                          <td>{odstupanje(r.daysUntilExpected)}</td>
                          <td>
                            <Badge tone={CONFIDENCE_TONE[r.confidence]}>
                              {CONFIDENCE_LABELS[r.confidence]}
                            </Badge>
                            <small>
                              ciklusa {r.eventCount}
                              {r.stability === null
                                ? ""
                                : ` · stabilnost ${r.stability.toFixed(2)}`}
                            </small>
                          </td>
                          <td>{r.explanation}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          );
        })
      )}

      {/* ------------------------------------------------------------------ */}
      <section className="portal-panel">
        <SectionHeader
          title="Poslednji prolazi"
          description={
            "Neuspeo prolaz ne briše prethodni rezultat — zato se i vidi u ovoj listi, " +
            "umesto da nestane bez traga."
          }
        />
        <div className="portal-table-wrap">
          <table className="portal-table portal-readiness-table portal-recommendation-runs-table">
            <thead>
              <tr>
                <th scope="col">Pokrenut</th>
                <th scope="col">Na dan</th>
                <th scope="col">Status</th>
                <th scope="col">Ulaznih stavki</th>
                <th scope="col">Isključeno</th>
                <th scope="col">Parova</th>
                <th scope="col">Rezultata</th>
              </tr>
            </thead>
            <tbody>
              {prolazi.map((p) => (
                <tr key={p.id}>
                  <th scope="row">
                    {proteklo(String(p.startedAt))}
                    {p.isActive ? <small>aktivan</small> : null}
                  </th>
                  <td>{datum(p.asOfDate)}</td>
                  <td>
                    <Badge
                      tone={
                        p.status === "succeeded"
                          ? "success"
                          : p.status === "failed"
                            ? "danger"
                            : "info"
                      }
                    >
                      {p.status}
                    </Badge>
                    {p.failureCode ? <small>{p.failureCode}</small> : null}
                  </td>
                  <td>{p.inputLinesAccepted}</td>
                  <td>{p.inputLinesExcluded}</td>
                  <td>
                    {p.pairCount}
                    <small>sa ritmom: {p.repeatPairCount}</small>
                  </td>
                  <td>{p.resultCount}</td>
                </tr>
              ))}
              {prolazi.length === 0 ? (
                <tr>
                  <td colSpan={7}>Nijedan prolaz još nije pokrenut.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
