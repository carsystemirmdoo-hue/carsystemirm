import Link from "next/link";
import { Badge, PageHeader, PortalLinkButton, SectionHeader } from "@/components/portal/PortalPrimitives";
import { StockUploadForm } from "@/features/portal/StockImportForms";
import { StockImportSteps } from "@/features/portal/StockImportSteps";
import { requireCapability } from "@/lib/authz/session";
import { dmy, dmyTime, quantity } from "@/lib/ordering/panelFormat.mjs";
import { currentStockSnapshot, listStockImports } from "@/lib/stock/stock-import-service";


export const metadata = { title: "Uvoz lagera" };

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; tone: "info" | "success" | "neutral" | "warning" | "danger" }> = {
  pregled: { label: "čeka potvrdu", tone: "info" },
  potvrdjeno: { label: "potvrđeno", tone: "success" },
  odbaceno: { label: "odbačeno", tone: "neutral" },
  neuspesno: { label: "nije prošlo proveru", tone: "danger" },
};
const day = (iso: string | null) => (iso ? dmy(new Date(`${iso}T12:00:00Z`)) : "—");

/** Ručni uvoz lagera (dok. 65). Vlasnik i kancelarija; kupci nemaju pristup /portal. */
export default async function StockImportPage() {
  await requireCapability("imports:write", "/portal/zalihe/uvoz");
  const [imports, current] = await Promise.all([listStockImports(), currentStockSnapshot()]);

  return (
    <>
      <PageHeader
        eyebrow="Logistika"
        title="Uvoz lagera"
        description="Izveštaj o stanju zaliha iz BizniSofta za 021 VELEPRODAJA."
        actions={current ? <PortalLinkButton href={`/portal/zalihe/uvoz/${current.id}`} variant="ghost">Važeći snimak</PortalLinkButton> : undefined}
      />

      <StockImportSteps current={1} />

      <div className="lg-layout">
        <section className="portal-panel lg-main">
          <SectionHeader title="Izaberite fajl" description="Izvoz otpremite onakav kakav ga BizniSoft napravi — bez sređivanja u Excel-u." />
          <div className="portal-panel-body">
            <StockUploadForm />
          </div>
        </section>

        <aside className="portal-panel lg-side" aria-label="Važeće stanje">
          <SectionHeader title="Važeće stanje" />
          <div className="portal-panel-body">
            {current ? (
              <dl className="lg-facts">
                <div><dt>Stanje na dan</dt><dd>{day(current.stockDate)}</dd></div>
                <div><dt>Potvrđeno</dt><dd>{current.confirmedAt ? dmyTime(current.confirmedAt) : "—"}</dd></div>
                <div><dt>Stavki</dt><dd>{quantity(current.lineCount)}</dd></div>
              </dl>
            ) : (
              <p className="lg-empty">Još nema potvrđenog lagera.</p>
            )}
            <ol className="lg-howto">
              <li>U BizniSoftu izvezite izveštaj o stanju zaliha za objekat 021 VELEPRODAJA.</li>
              <li>Izaberite fajl i pokrenite proveru.</li>
              <li>Pregledajte rezultat i potvrdite lager.</li>
            </ol>
          </div>
        </aside>
      </div>

      <section className="portal-panel">
        <SectionHeader
          title="Istorija uvoza"
          description="Svako otpremanje ostaje zabeleženo: ko, kada i sa kojim ishodom. Detaljne stavke čuvaju se samo za poslednja dva potvrđena lagera; nepotvrđene i odbačene posle 7 dana."
        />
        {imports.length === 0 ? (
          <p className="lg-empty portal-panel-body">Još nijedan lager nije otpremljen.</p>
        ) : (
          <div className="portal-table-wrap">
            <table className="portal-table lg-history">
              <thead>
                <tr><th>Stanje na dan</th><th>Fajl</th><th>Status</th><th className="portal-table-number">Stavki</th><th>Otpremio</th></tr>
              </thead>
              <tbody>
                {imports.map((i) => {
                  const st = STATUS[i.status] ?? STATUS.pregled;
                  return (
                    <tr key={i.id}>
                      <td data-label="Stanje na dan">{day(i.stockDate)}</td>
                      <td className="lg-file-cell" data-label="Fajl"><Link href={`/portal/zalihe/uvoz/${i.id}`}>{i.fileName}</Link></td>
                      <td data-label="Status">
                        <Badge tone={st.tone}>{st.label}</Badge>
                        {current?.id === i.id ? <> <Badge tone="success">važeći</Badge></> : null}
                        {i.linesPurgedAt ? <small className="lg-sub">stavke uklonjene po pravilu čuvanja</small> : null}
                      </td>
                      <td className="portal-table-number" data-label="Stavki">{quantity(i.lineCount)}</td>
                      <td data-label="Otpremio">{i.uploaderName ?? "—"}<small className="lg-sub">{dmyTime(i.uploadedAt)}</small></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
