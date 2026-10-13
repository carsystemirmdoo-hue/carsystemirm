import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Metric, PageHeader, SectionHeader } from "@/components/portal/PortalPrimitives";
import { StockConfirmForm, StockDiscardForm } from "@/features/portal/StockImportForms";
import { requireCapability } from "@/lib/authz/session";
import { dmy, dmyTime, quantity } from "@/lib/ordering/panelFormat.mjs";
import { stockProblemText } from "@/lib/stock/problemLabels.mjs";
import { loadStockImport, type StockLineView } from "@/lib/stock/stock-import-service";

export const dynamic = "force-dynamic";

const day = (iso: string | null) => (iso ? dmy(new Date(`${iso}T12:00:00Z`)) : "—");
const Q = new Intl.NumberFormat("sr-Latn-RS", { maximumFractionDigits: 3 });
const qty = (v: number | null) => (v === null ? "prazno" : Q.format(v));
const MAX_ROWS = 300;
const REASON: Record<string, string> = {
  pakovanje_nepotvrdjeno: "JM i pakovanje nisu potvrđeni",
  prazna_kolicina: "prazna količina",
  negativna_kolicina: "negativna količina",
  nepovezan: "šifra ne postoji u portalu",
  sudar_sifara: "sudar šifara u portalu",
};
type Problem = { code: string; row?: number; detail?: string; count?: number };
type Summary = { lines: number; zeros: number; negative: number; decimals: number; emptyQuantity: number; repeatedHeaders?: number; footerRows?: number; control?: Record<string, unknown>; sheet?: string | null; stockFilter?: string | null };

function LineTable({ rows, showPacks = false }: { rows: StockLineView[]; showPacks?: boolean }) {
  if (!rows.length) return <p className="portal-empty">Nema.</p>;
  return (
    <>
      <div className="portal-table-wrap">
        <table className="portal-table">
          <thead>
            <tr><th>Šifra u izvozu</th><th>Naziv</th><th className="portal-table-number">Količina (izvorna)</th><th>Artikal u portalu</th>{showPacks ? <><th>Potvrđena JM / pakovanje</th><th className="portal-table-number">Celih pakovanja</th></> : null}<th className="portal-table-number">Red</th></tr>
          </thead>
          <tbody>
            {rows.slice(0, MAX_ROWS).map((l) => (
              <tr key={l.lineNo}>
                <td>{l.sourceCode}</td>
                <td>{l.name}</td>
                <td className="portal-table-number">{qty(l.quantity)}{l.quantity !== null && l.quantity < 0 ? <> <Badge tone="danger">negativno</Badge></> : null}</td>
                <td>{l.articleCode ?? "—"}{l.articleCode && !l.exactCode ? <> <Badge tone="neutral">bez vodećih nula</Badge></> : null}</td>
                {showPacks ? (
                  <>
                    <td>{l.unit ? `${l.unit} · ${l.packLabel}` : "—"}</td>
                    <td className="portal-table-number">{l.packs ?? (l.packReason ? REASON[l.packReason] ?? l.packReason : "—")}</td>
                  </>
                ) : null}
                <td className="portal-table-number">{l.sourceRow}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > MAX_ROWS ? <p className="portal-empty">Prikazano prvih {MAX_ROWS} od {rows.length}.</p> : null}
    </>
  );
}

export default async function StockImportReviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ isti?: string; ishod?: string }> }) {
  await requireCapability("imports:write", "/portal/zalihe/uvoz");
  const { id } = await params;
  const { isti, ishod } = await searchParams;
  const data = await loadStockImport(id);
  if (!data) notFound();
  const h = data.header;
  const problems = (h.problems as { errors?: Problem[]; warnings?: Problem[] }) ?? {};
  const errors = problems.errors ?? [];
  const warnings = problems.warnings ?? [];
  const s = (h.summary as Summary) ?? { lines: 0, zeros: 0, negative: 0, decimals: 0, emptyQuantity: 0 };
  const control = (s.control ?? {}) as { totalsMatch?: boolean | null; pagesComplete?: boolean | null; pagesDeclared?: number | null; rowValueMismatches?: number | null };
  const linked = data.lines.filter((l) => l.link === "povezan");
  const unlinked = data.lines.filter((l) => l.link === "nepovezan");
  const collisions = data.lines.filter((l) => l.link === "sudar");
  const packMissing = linked.filter((l) => !l.unit);
  const withPacks = linked.filter((l) => l.unit);
  const negative = data.lines.filter((l) => l.quantity !== null && l.quantity < 0);
  const empty = data.lines.filter((l) => l.quantity === null);
  const older = data.current && h.stockDate && data.current.stockDate && h.stockDate < data.current.stockDate;
  const isCurrent = data.current?.id === h.id;

  return (
    <>
      <PageHeader
        eyebrow="Uvoz lagera"
        title={h.fileName}
        description="Pregled pre potvrde. Ništa od ovoga još nije važeće stanje — postaje tek posle Vaše potvrde."
        meta={<span><Link href="/portal/zalihe/uvoz">← Sva otpremanja</Link> · otpremio {data.uploaderName ?? "—"} · {dmyTime(h.uploadedAt)}</span>}
      />
      {ishod === "potvrdjeno" && h.status === "potvrdjeno" ? (
        <p className="portal-permission-ok" role="status">Potvrđeno: ovo je sada važeći snimak zaliha (stanje na dan {day(h.stockDate)}).</p>
      ) : null}
      {ishod === "odbaceno" && h.status === "odbaceno" ? (
        <p className="portal-permission-ok" role="status">Otpremanje je odbačeno; važeći snimak nije menjan.</p>
      ) : null}
      {isti ? (
        <p className="portal-permission-ok" role="status">Isti fajl je već otpremljen {dmyTime(h.uploadedAt)} — nov unos nije napravljen. Prikazano je postojeće otpremanje.</p>
      ) : null}

      <section className="portal-panel">
        <SectionHeader title="Šta izveštaj sadrži" description="Pročitano iz sadržaja fajla; ništa se ne pretpostavlja iz naziva fajla." />
        <dl className="pl-facts">
          <div><dt>Poslovni objekat</dt><dd>{h.warehouseCode ? `${h.warehouseCode} ${h.warehouseName ?? ""}` : "—"}</dd></div>
          <div><dt>Stanje na dan</dt><dd>{day(h.stockDate)} — datum STANJA iz izveštaja; vreme izvoza izveštaj ne navodi</dd></div>
          <div><dt>Datum štampe</dt><dd>{day(h.printedOn)}</dd></div>
          <div><dt>Otpremljeno</dt><dd>{dmyTime(h.uploadedAt)}</dd></div>
          <div><dt>Format</dt><dd>{h.fileFormat.toUpperCase()}{s.sheet ? ` · list „${s.sheet}“` : ""}{s.stockFilter ? ` · filter „${s.stockFilter}“` : ""}</dd></div>
          <div><dt>Prepoznato stavki</dt><dd>{quantity(s.lines)} (nula {s.zeros}, decimalnih {s.decimals}, praznih {s.emptyQuantity}, negativnih {s.negative})</dd></div>
          <div><dt>Kontrola potpunosti</dt><dd>
            {control.totalsMatch === true ? <Badge tone="success">zbir vrednosti = „Ukupno“</Badge> : control.totalsMatch === false ? <Badge tone="danger">zbir se ne slaže</Badge> : <Badge tone="warning">zbir nije proveren</Badge>}{" "}
            {control.pagesComplete === true ? <Badge tone="success">strane {control.pagesDeclared}/{control.pagesDeclared}</Badge> : control.pagesComplete === false ? <Badge tone="danger">nedostaju strane</Badge> : null}
          </dd></div>
          <div><dt>Jedinica mere</dt><dd>Izveštaj je ne sadrži i ne zaključuje se iz naziva — koristi se samo potvrđena JM i pakovanje iz portala</dd></div>
          <div><dt>Ne čuva se</dt><dd>nabavna cena, vrednosti, VP cena i % RuC</dd></div>
          <div><dt>Status</dt><dd>{h.status}{isCurrent ? " · važeći snimak" : ""}{h.decidedAt && h.status !== "neuspesno" ? ` · ${data.deciderName ?? "—"} · ${dmyTime(h.decidedAt)}` : ""}{h.decisionNote ? ` — ${h.decisionNote}` : ""}</dd></div>
        </dl>
      </section>

      {errors.length ? (
        <section className="portal-panel" data-accent="danger">
          <SectionHeader title={`Greške koje blokiraju uvoz (${errors.length})`} description="Fajl se ne može potvrditi. Važeći snimak ostaje nepromenjen." />
          <ul>{errors.slice(0, 50).map((p, i) => <li key={i}>{stockProblemText(p)}</li>)}</ul>
        </section>
      ) : null}

      {warnings.length ? (
        <section className="portal-panel" data-accent="warning">
          <SectionHeader title={`Upozorenja (${warnings.length})`} description="Ne blokiraju uvoz, ali ih pogledajte pre potvrde." />
          <ul>{warnings.map((p, i) => <li key={i}>{stockProblemText(p)}</li>)}</ul>
        </section>
      ) : null}

      {data.lines.length ? (
        <>
          <section className="portal-metrics">
            <Metric label="Povezano sa artiklom" value={quantity(linked.length)} tone="success" context={`od toga preko šifre bez vodećih nula: ${linked.filter((l) => !l.exactCode).length}`} />
            <Metric label="Sa potvrđenom JM i pakovanjem" value={quantity(withPacks.length)} tone={withPacks.length ? "success" : "neutral"} context="samo za njih postoji broj celih pakovanja" />
            <Metric label="Bez potvrđene JM / pakovanja" value={quantity(packMissing.length)} tone={packMissing.length ? "warning" : "neutral"} context="izvorna količina se čuva, broj pakovanja ne postoji" />
            <Metric label="Nepovezano · sudari" value={`${quantity(unlinked.length)} · ${quantity(collisions.length)}`} tone={collisions.length ? "danger" : unlinked.length ? "warning" : "neutral"} context="šifra ne postoji u portalu · dve šifre u portalu daju isti ključ" />
          </section>

          {collisions.length ? (
            <section className="portal-panel" data-accent="danger">
              <SectionHeader title={`Sudari šifara (${collisions.length})`} description="Šifra iz izvoza odgovara dvema šiframa u portalu kada se zanemare vodeće nule. Veza se ne pravi." />
              <LineTable rows={collisions} />
            </section>
          ) : null}

          {negative.length || empty.length ? (
            <section className="portal-panel" data-accent="warning">
              <SectionHeader title={`Negativne i prazne količine (${negative.length + empty.length})`} description="Sačuvane su kao nalaz. Kupcu se nikad ne prikazuju; prazna količina nije nula." />
              <LineTable rows={[...negative, ...empty]} />
            </section>
          ) : null}

          <section className="portal-panel">
            <SectionHeader title={`Povezano, sa potvrđenom JM i pakovanjem (${withPacks.length})`} description="Broj CELIH pakovanja iz izvorne količine (naniže). To je stanje iz izvoza, ne garantovana raspoloživost." />
            <LineTable rows={withPacks} showPacks />
          </section>

          <section className="portal-panel">
            <SectionHeader title={`Povezano, bez potvrđene JM ili pakovanja (${packMissing.length})`} description="Izvorna količina se čuva; broj komada ili pakovanja se ne izračunava dok JM i pakovanje ne potvrdi čovek." />
            <LineTable rows={packMissing} />
          </section>

          <section className="portal-panel">
            <SectionHeader title={`Nepovezane šifre (${unlinked.length})`} description="Šifra iz izvoza ne postoji u portalu (artikal još nije fakturisan ili je star). Prisustvo u lageru ne vraća artikal u katalog." />
            <LineTable rows={unlinked} />
          </section>
        </>
      ) : null}

      {h.status === "pregled" ? (
        <section className="portal-panel">
          <SectionHeader title="Odluka" description="Potvrda menja važeći snimak zaliha u jednom koraku. Odbacivanje ga ne menja." />
          {older ? <p className="portal-login-error" role="alert">Važeći snimak je od {day(data.current?.stockDate ?? null)}; ovaj izveštaj je stariji i ne može ga zameniti.</p> : null}
          {!errors.length && !older && h.stockDate ? <StockConfirmForm importId={h.id} lines={h.lineCount} stockDate={h.stockDate} /> : null}
          <StockDiscardForm importId={h.id} />
        </section>
      ) : null}
    </>
  );
}
