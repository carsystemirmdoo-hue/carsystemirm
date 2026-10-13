import Link from "next/link";
import { Badge, PageHeader, SectionHeader } from "@/components/portal/PortalPrimitives";
import { StockUploadForm } from "@/features/portal/StockImportForms";
import { requireCapability } from "@/lib/authz/session";
import { dmy, dmyTime } from "@/lib/ordering/panelFormat.mjs";
import { currentStockSnapshot, listStockImports } from "@/lib/stock/stock-import-service";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; tone: "info" | "success" | "neutral" | "warning" | "danger" }> = {
  pregled: { label: "čeka pregled", tone: "info" },
  potvrdjeno: { label: "potvrđeno", tone: "success" },
  odbaceno: { label: "odbačeno", tone: "neutral" },
  neuspesno: { label: "neuspešno", tone: "danger" },
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
        description="Izvoz izveštaja „Stanje zaliha“ iz BizniSofta za 021 VELEPRODAJA. Otpremanje samo priprema pregled; važeći snimak se menja tek kada potvrdite."
        meta={
          <span>
            Važeći snimak:{" "}
            {current ? (
              <>stanje na dan {day(current.stockDate)} · potvrđeno {current.confirmedAt ? dmyTime(current.confirmedAt) : "—"} · <Link href={`/portal/zalihe/uvoz/${current.id}`}>pregled</Link></>
            ) : (
              "još nema"
            )}
          </span>
        }
      />

      <section className="portal-panel">
        <SectionHeader title="Novi izvoz" description="XLSX ili CSV, onakav kakav BizniSoft izveze — bez brisanja praznih kolona, zaglavlja ili strana." />
        <StockUploadForm />
      </section>

      <section className="portal-panel">
        <SectionHeader title="Otpremanja" description="Svako otpremanje ostaje u evidenciji: ko je otpremio, kada, šta je pročitano i kakva je odluka." />
        {imports.length === 0 ? (
          <p className="portal-empty">Još nijedan lager nije otpremljen.</p>
        ) : (
          <div className="portal-table-wrap">
            <table className="portal-table">
              <thead>
                <tr><th>Fajl</th><th>Objekat</th><th>Stanje na dan</th><th>Datum štampe</th><th className="portal-table-number">Stavki</th><th>Status</th><th>Otpremio</th><th>Odluka</th></tr>
              </thead>
              <tbody>
                {imports.map((i) => {
                  const st = STATUS[i.status] ?? STATUS.pregled;
                  return (
                    <tr key={i.id}>
                      <td><Link href={`/portal/zalihe/uvoz/${i.id}`}>{i.fileName}</Link></td>
                      <td>{i.warehouseCode ? `${i.warehouseCode} ${i.warehouseName ?? ""}` : "—"}</td>
                      <td>{day(i.stockDate)}</td>
                      <td>{day(i.printedOn)}</td>
                      <td className="portal-table-number">{i.lineCount}</td>
                      <td><Badge tone={st.tone}>{st.label}</Badge>{current?.id === i.id ? <> <Badge tone="success">važeći</Badge></> : null}</td>
                      <td>{i.uploaderName ?? "—"} · {dmyTime(i.uploadedAt)}</td>
                      <td>{i.decidedAt && i.status !== "neuspesno" ? dmyTime(i.decidedAt) : "—"}</td>
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
