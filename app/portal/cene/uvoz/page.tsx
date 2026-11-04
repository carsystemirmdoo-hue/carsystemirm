import Link from "next/link";
import { requireCapability } from "@/lib/authz/session";
import { listPriceListImports, listSuppliers } from "@/lib/pricing/price-list-service";
import { dmy } from "../kupci/format";
import { PdfImportForm, TableImportForm } from "./ImportForms";
import "../kupci/cene-kupca.css";

export const metadata = { title: "Uvoz VP cenovnika" };
export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; tone: "info" | "success" | "neutral" }> = {
  pregled: { label: "Čeka pregled", tone: "info" },
  primenjeno: { label: "Primenjeno", tone: "success" },
  odbaceno: { label: "Odbačeno", tone: "neutral" },
};

/** Uvoz VP cenovnika: gazda i kancelarija. Menja samo osnovne cene; rabati kupaca ostaju isti. */
export default async function PriceImportPage() {
  await requireCapability("pricelist:import", "/portal/cene/uvoz");
  const [imports, suppliers] = await Promise.all([listPriceListImports(), listSuppliers()]);
  return (
    <div className="pn">
      <div className="pn-head">
        <div>
          <h1 className="pn-title">Uvoz VP cenovnika</h1>
          <p className="pn-lead">
            Menja se samo VP cena. <b style={{ color: "var(--p-ink)" }}>Rabati kupaca ostaju isti</b>, a cene kupaca se od datuma važenja računaju iz nove VP cene. Otpremanje samo
            priprema pregled; VP cene se menjaju tek kada potvrdite uvoz.
          </p>
        </div>
      </div>
      <ol className="ck-chips" aria-label="Koraci uvoza" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {["1. Fajl", "2. Kolone i jedinica cene", "3. Prepoznavanje po šifri", "4. Novi i neprepoznati", "5. Završni pregled"].map((s, i) => (
          <li key={s}><span className="ck-chip" aria-current={i < 2 ? "true" : undefined}>{s}</span></li>
        ))}
      </ol>
      <TableImportForm suppliers={suppliers} />
      <PdfImportForm />
      <section className="pn-card pn-card-flush">
        <div className="pn-card-h"><h2>Uvozi</h2></div>
        <table className="pn-table pn-table-cards">
          <thead>
            <tr><th>Fajl</th><th>Format</th><th>Otpremljeno</th><th className="pn-r">Redova</th><th>Stanje</th><th>Važi od</th></tr>
          </thead>
          <tbody>
            {imports.map((imp) => {
              const st = STATUS[imp.status] ?? STATUS.pregled;
              return (
                <tr key={imp.id}>
                  <td data-label="Fajl"><Link href={`/portal/cene/uvoz/${imp.id}`} className="pn-row-link">{imp.fileName}</Link></td>
                  <td data-label="Format">{imp.sourceFormat === "tabela" ? "Tabela" : "BizniSoft PDF"}</td>
                  <td data-label="Otpremljeno" className="pn-num">{dmy(new Date(imp.uploadedAt).toISOString().slice(0, 10))}{imp.uploadedBy ? ` · ${imp.uploadedBy}` : ""}</td>
                  <td data-label="Redova" className="pn-r pn-num">{imp.rowCount}</td>
                  <td data-label="Stanje"><span className="pn-status" data-tone={st.tone}>{st.label}</span></td>
                  <td data-label="Važi od" className="pn-num">{imp.validFrom ? dmy(imp.validFrom) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {imports.length === 0 ? <p className="pn-empty" style={{ padding: 16 }}>Još nema uvoza.</p> : null}
      </section>
    </div>
  );
}
