import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { Badge, PageHeader, PortalLinkButton, SectionHeader } from "@/components/portal/PortalPrimitives";
import { StockConfirmForm, StockDiscardForm } from "@/features/portal/StockImportForms";
import { StockImportSteps } from "@/features/portal/StockImportSteps";
import { isMfaRecent, isSecondFactorSatisfied } from "@/lib/auth/session-assurance.mjs";
import { reauthUrlFor } from "@/lib/authz/redirects.mjs";
import { loadAuthenticatedSession, requireCapability } from "@/lib/authz/session";
import { dmy, dmyTime, quantity } from "@/lib/ordering/panelFormat.mjs";
import { stockProblemText } from "@/lib/stock/problemLabels.mjs";
import { loadStockImport, type StockLineView } from "@/lib/stock/stock-import-service";

export const dynamic = "force-dynamic";

const day = (iso: string | null) => (iso ? dmy(new Date(`${iso}T12:00:00Z`)) : "—");
const Q = new Intl.NumberFormat("sr-Latn-RS", { maximumFractionDigits: 3 });
const qty = (v: number | null) => (v === null ? "prazno" : Q.format(v));
const MAX_ROWS = 300;
const REASON: Record<string, string> = {
  pakovanje_nepotvrdjeno: "pakovanje nije potvrđeno",
  prazna_kolicina: "prazna količina",
  negativna_kolicina: "negativna količina",
  nepovezan: "šifra ne postoji u portalu",
  sudar_sifara: "sudar šifara",
  jm_razlika: "JM iz izveštaja ≠ potvrđena JM",
};
type Problem = { code: string; row?: number; detail?: string; count?: number };
type Summary = { lines: number; zeros: number; negative: number; decimals: number; emptyQuantity: number; control?: Record<string, unknown>; sheet?: string | null; stockFilter?: string | null; jmIzIzvestaja?: boolean };

function LineTable({ rows, showPacks = false }: { rows: StockLineView[]; showPacks?: boolean }) {
  if (!rows.length) return <p className="lg-empty portal-panel-body">Nema.</p>;
  return (
    <>
      <div className="portal-table-wrap">
        <table className="portal-table lg-lines">
          <thead>
            <tr>
              <th>Šifra</th><th>Naziv</th><th className="portal-table-number">Količina</th><th>Artikal u portalu</th>
              {showPacks ? <><th>Pakovanje</th><th className="portal-table-number">Celih pakovanja</th></> : null}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, MAX_ROWS).map((l) => (
              <tr key={l.lineNo}>
                <td>{l.sourceCode}</td>
                <td>{l.name}</td>
                <td className="portal-table-number">{qty(l.quantity)}{l.quantity !== null && l.quantity < 0 ? <> <Badge tone="danger">negativno</Badge></> : null}</td>
                <td>{l.articleCode ?? "—"}</td>
                {showPacks ? (
                  <>
                    <td>{l.unit ? `${l.packLabel} (${l.unit})` : "—"}</td>
                    <td className="portal-table-number">{l.packs ?? (l.packReason ? REASON[l.packReason] ?? l.packReason : "—")}</td>
                  </>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > MAX_ROWS ? <p className="lg-empty portal-panel-body">Prikazano prvih {MAX_ROWS} od {quantity(rows.length)}.</p> : null}
    </>
  );
}

function Group({ title, count, tone, children, open = false }: { title: string; count: number; tone?: "danger" | "warning"; children: ReactNode; open?: boolean }) {
  return (
    <details className="lg-group" data-accent={tone} open={open}>
      <summary>
        <span>{title}</span>
        <span className="lg-count">{quantity(count)}</span>
      </summary>
      {children}
    </details>
  );
}

export default async function StockImportReviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ isti?: string; ishod?: string; raniji?: string; identitet?: string }> }) {
  const { id } = await params;
  await requireCapability("imports:write", `/portal/zalihe/uvoz/${id}`);
  const { isti, ishod, raniji, identitet } = await searchParams;
  // Potvrda i odbacivanje traže drugi faktor u poslednjih 10 minuta; ovde se samo unapred kaže.
  const session = await loadAuthenticatedSession();
  const mfaFresh = Boolean(session && isSecondFactorSatisfied(session.assurance) && isMfaRecent(session.mfaVerifiedAt));
  const data = await loadStockImport(id);
  if (!data) notFound();
  const h = data.header;
  const problems = (h.problems as { errors?: Problem[]; warnings?: Problem[] }) ?? {};
  const errors = problems.errors ?? [];
  const warnings = problems.warnings ?? [];
  const s = (h.summary as Summary) ?? { lines: 0, zeros: 0, negative: 0, decimals: 0, emptyQuantity: 0 };
  const control = (s.control ?? {}) as { totalsMatch?: boolean | null; pagesComplete?: boolean | null; pagesDeclared?: number | null };
  const linked = data.lines.filter((l) => l.link === "povezan");
  const unlinked = data.lines.filter((l) => l.link === "nepovezan");
  const collisions = data.lines.filter((l) => l.link === "sudar");
  const withPacks = linked.filter((l) => l.unit && l.packReason !== "jm_razlika");
  const noPack = linked.filter((l) => !l.unit || l.packReason === "jm_razlika");
  const anomalies = data.lines.filter((l) => l.quantity === null || l.quantity < 0);
  const older = data.current && h.stockDate && data.current.stockDate && h.stockDate < data.current.stockDate;
  const isCurrent = data.current?.id === h.id;
  const pending = h.status === "pregled";
  const canConfirm = pending && !errors.length && !older && Boolean(h.stockDate) && !h.linesPurgedAt;

  const outcome =
    h.status === "potvrdjeno"
      ? { tone: "success", title: isCurrent ? "Potvrđeno — ovo je važeće stanje" : "Potvrđeno", text: `Potvrdio ${data.deciderName ?? "—"}, ${h.decidedAt ? dmyTime(h.decidedAt) : "—"}.` }
      : h.status === "odbaceno"
        ? { tone: "neutral", title: "Odbačeno", text: h.decisionNote ? `Razlog: ${h.decisionNote}` : "Važeće stanje nije menjano." }
        : h.status === "neuspesno"
          ? { tone: "danger", title: "Fajl nije prošao proveru", text: "Ništa nije promenjeno. Ispravite izvoz i otpremite novi fajl." }
          : older
            ? { tone: "warning", title: "Stariji od važećeg stanja", text: `Važeće stanje je od ${day(data.current?.stockDate ?? null)}; stariji izvoz ga ne može zameniti.` }
            : errors.length
              ? { tone: "danger", title: "Fajl ima greške", text: "Ne može se potvrditi. Važeće stanje ostaje nepromenjeno." }
              : { tone: "success", title: "Provera je prošla — fajl je spreman za potvrdu", text: "Pregledajte sažetak i potvrdite lager." };

  return (
    <>
      <PageHeader
        eyebrow="Uvoz lagera"
        title={`Stanje na dan ${day(h.stockDate)}`}
        description={h.fileName}
        actions={<PortalLinkButton href="/portal/zalihe/uvoz" variant="ghost">Svi uvozi</PortalLinkButton>}
      />

      <StockImportSteps current={pending ? (canConfirm ? 3 : 2) : h.status === "potvrdjeno" ? 3 : 2} done={h.status === "potvrdjeno"} failed={h.status === "neuspesno" || (pending && !canConfirm)} />

      {raniji ? (
        <p className="portal-login-error lg-status" role="alert">
          Ovaj isti fajl je ranije odbijen starijom verzijom provere. Izvezite izveštaj ponovo iz BizniSofta i otpremite novi fajl — on će biti proveren ispravljenom verzijom.
        </p>
      ) : isti ? (
        <p className="portal-permission-ok lg-status" role="status">Isti fajl je već otpremljen {dmyTime(h.uploadedAt)} — prikazana je postojeća provera.</p>
      ) : null}
      {ishod === "potvrdjeno" && h.status === "potvrdjeno" ? <p className="portal-permission-ok lg-status" role="status">Lager je potvrđen.</p> : null}
      {ishod === "vec-odluceno" ? <p className="portal-permission-ok lg-status" role="status">O ovom fajlu je već odlučeno — prikazan je zapisani ishod. Ništa nije ponovljeno.</p> : null}
      {identitet === "potvrdjen" && pending && mfaFresh ? <p className="portal-permission-ok lg-status" role="status">Identitet je potvrđen. Sada možete da potvrdite lager — potvrda važi 10 minuta.</p> : null}
      {ishod === "odbaceno" && h.status === "odbaceno" ? <p className="portal-permission-ok lg-status" role="status">Otpremanje je odbačeno; važeće stanje nije menjano.</p> : null}

      <section className="lg-outcome" data-tone={outcome.tone}>
        <strong>{outcome.title}</strong>
        <span>{outcome.text}</span>
      </section>

      <section className="lg-summary" aria-label="Sažetak">
        <div><span>Objekat</span><strong>{h.warehouseCode ? `${h.warehouseCode} ${h.warehouseName ?? ""}` : "—"}</strong></div>
        <div><span>Stanje na dan</span><strong>{day(h.stockDate)}</strong></div>
        <div><span>Stavki</span><strong>{quantity(h.lineCount || s.lines)}</strong></div>
        <div>
          <span>Potpunost</span>
          <strong>
            {control.totalsMatch === true && control.pagesComplete !== false ? <Badge tone="success">sve strane i zbir se slažu</Badge> : control.totalsMatch === false || control.pagesComplete === false ? <Badge tone="danger">nepotpun fajl</Badge> : <Badge tone="warning">nije provereno</Badge>}
          </strong>
        </div>
      </section>

      {errors.length ? (
        <section className="portal-panel" data-accent="danger">
          <SectionHeader title="Šta treba ispraviti" />
          <ul className="lg-list portal-panel-body">{errors.slice(0, 50).map((p, i) => <li key={i}>{stockProblemText(p)}</li>)}</ul>
        </section>
      ) : null}

      {pending ? (
        <section className="portal-panel">
          <SectionHeader title={canConfirm ? "Potvrda" : "Odluka"} />
          <div className="portal-panel-body">
            {!mfaFresh ? (
              <div className="lg-reauth" role="note">
                <p>
                  <strong>Pre odluke ponovo potvrdite identitet.</strong> Potvrda i odbacivanje traže lozinku i kod iz aplikacije u poslednjih 10 minuta. Posle toga vraćate se na ovaj uvoz; ništa nije izmenjeno.
                </p>
                <PortalLinkButton href={reauthUrlFor(`/portal/zalihe/uvoz/${h.id}?identitet=potvrdjen`)} variant="secondary">Potvrdite identitet</PortalLinkButton>
              </div>
            ) : null}
            {canConfirm && h.stockDate ? <StockConfirmForm importId={h.id} lines={h.lineCount} stockDate={h.stockDate} /> : null}
            <StockDiscardForm importId={h.id} />
          </div>
        </section>
      ) : null}

      {warnings.length ? (
        <section className="portal-panel" data-accent="warning">
          <SectionHeader title="Za proveru" description="Ne sprečavaju potvrdu." />
          <ul className="lg-list portal-panel-body">{warnings.map((p, i) => <li key={i}>{stockProblemText(p)}</li>)}</ul>
        </section>
      ) : null}

      {h.linesPurgedAt ? (
        <section className="lg-outcome" data-tone="neutral">
          <strong>Detaljne stavke su uklonjene po pravilu čuvanja</strong>
          <span>
            {h.linesPurgedReason === "starija_od_dva_potvrdjena"
              ? "Čuvaju se samo poslednja dva potvrđena lagera."
              : "Nepotvrđena i odbačena otpremanja čuvaju stavke 7 dana."}{" "}
            Sačuvani su datum stanja, ko je uvezao i potvrdio, ishod, broj stavki i otisak fajla ({dmyTime(h.linesPurgedAt)}).
          </span>
        </section>
      ) : null}

      {data.lines.length ? (
        <div className="lg-groups">
          <Group title="Sa potvrđenim pakovanjem" count={withPacks.length}>
            <p className="lg-group-note">Broj celih pakovanja iz izvorne količine. To je stanje iz izvoza, ne garantovana raspoloživost.</p>
            <LineTable rows={withPacks} showPacks />
          </Group>
          <Group title="Bez potvrđenog pakovanja ili sa razlikom u JM" count={noPack.length}>
            <p className="lg-group-note">Količina se čuva, ali broj pakovanja se ne računa dok pakovanje ne potvrdi čovek.</p>
            <LineTable rows={noPack} showPacks />
          </Group>
          <Group title="Šifre kojih nema u portalu" count={unlinked.length}>
            <p className="lg-group-note">Artikal još nije fakturisan ili je star. Prisustvo u lageru ne vraća artikal u katalog.</p>
            <LineTable rows={unlinked} />
          </Group>
          {collisions.length ? (
            <Group title="Sudari šifara" count={collisions.length} tone="danger" open>
              <p className="lg-group-note">Šifra odgovara dvema šiframa u portalu kada se zanemare vodeće nule — veza se ne pravi.</p>
              <LineTable rows={collisions} />
            </Group>
          ) : null}
          {anomalies.length ? (
            <Group title="Prazne i negativne količine" count={anomalies.length} tone="warning">
              <p className="lg-group-note">Čuvaju se kao nalaz; kupcima se nikad ne prikazuju. Prazna količina nije nula.</p>
              <LineTable rows={anomalies} />
            </Group>
          ) : null}
        </div>
      ) : null}

      <details className="lg-group">
        <summary><span>Tehnički detalji</span></summary>
        <dl className="lg-facts portal-panel-body">
          <div><dt>Fajl</dt><dd>{h.fileName} · {h.fileFormat.toUpperCase()}{s.sheet ? ` · list „${s.sheet}“` : ""}</dd></div>
          <div><dt>Otpremio</dt><dd>{data.uploaderName ?? "—"} · {dmyTime(h.uploadedAt)}</dd></div>
          <div><dt>Datum štampe</dt><dd>{day(h.printedOn)}</dd></div>
          <div><dt>Vreme izvoza</dt><dd>izveštaj ga ne navodi</dd></div>
          <div><dt>Filter stanja</dt><dd>{s.stockFilter ?? "—"}</dd></div>
          <div><dt>Prepoznato</dt><dd>{quantity(s.lines)} stavki · nula {s.zeros} · decimalnih {s.decimals} · praznih {s.emptyQuantity} · negativnih {s.negative}</dd></div>
          <div><dt>Povezano</dt><dd>{quantity(linked.length)} sa artiklom ({linked.filter((l) => !l.exactCode).length} preko šifre bez vodećih nula)</dd></div>
          <div><dt>Jedinica mere</dt><dd>{s.jmIzIzvestaja ? "iz izveštaja — samo provera potvrđenog pakovanja" : "izveštaj je nema"}; ne zaključuje se iz naziva</dd></div>
          <div><dt>Ne čuva se</dt><dd>originalni fajl, cene, vrednosti i marže</dd></div>
          <div><dt>Verzija provere</dt><dd>{h.parserVersion}</dd></div>
          <div><dt>Otisak fajla (SHA-256)</dt><dd className="lg-mono">{h.fileSha256}</dd></div>
        </dl>
      </details>
    </>
  );
}
