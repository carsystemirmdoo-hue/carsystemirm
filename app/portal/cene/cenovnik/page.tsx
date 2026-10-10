import Link from "next/link";
import { Badge, PageHeader, SectionHeader } from "@/components/portal/PortalPrimitives";
import { BasePriceForm, PriceListUploadForm } from "@/features/portal/PriceListForms";
import { requireCapability } from "@/lib/authz/session";
import { basePriceHistory, checksAllowApply, listPriceListImports } from "@/lib/pricing/price-list-service";
import { dmy, dmyTime } from "@/lib/ordering/panelFormat.mjs";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; tone: "info" | "success" | "neutral" | "warning" }> = {
  pregled: { label: "čeka pregled", tone: "info" },
  primenjeno: { label: "primenjeno", tone: "success" },
  odbaceno: { label: "odbačeno", tone: "neutral" },
};
const D = { format: (d: Date) => dmy(d) };
const DT = { format: (d: Date) => dmyTime(d) };
const N = new Intl.NumberFormat("sr-Latn-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = (iso: string | null) => (iso ? D.format(new Date(`${iso}T12:00:00Z`)) : "—");

/**
 * Cenovnik: osnovne (VP) cene artikala. Samo gazda.
 *
 * Osnovna cena je jedno, rabat kupca drugo, konačna cena treće: ova strana
 * menja SAMO osnovnu cenu. Rabati su u „Cene i rabati“, fakture se ne diraju.
 */
export default async function PriceListPage({ searchParams }: { searchParams: Promise<{ sifra?: string }> }) {
  const user = await requireCapability("pricelist:manage", "/portal/cene/cenovnik");
  const { sifra } = await searchParams;
  const code = typeof sifra === "string" && /^[0-9A-Za-z./_-]{1,32}$/.test(sifra.trim()) ? sifra.trim() : null;
  const [imports, history] = await Promise.all([listPriceListImports(), code ? basePriceHistory(user, code) : Promise.resolve([])]);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeader
        eyebrow="Finansije"
        title="Cenovnik"
        description="Osnovne (VP) cene artikala iz BizniSoft cenovnika. Otpremanje samo priprema pregled; cene se menjaju tek kada Vi potvrdite primenu i izaberete datum važenja."
        meta={<span>Verzija: {imports.length}</span>}
      />

      <section className="portal-panel">
        <SectionHeader title="Novi cenovnik" description="PDF „Stanje zaliha – nabavna i VP cena“ iz BizniSofta, isti format kao do sada. Drugačiji PDF se odbija sa objašnjenjem." />
        <PriceListUploadForm />
      </section>

      <section className="portal-panel">
        <SectionHeader title="Otpremljeni cenovnici" description="Svaka verzija ostaje sačuvana: ko je otpremio, šta je pročitano, ko je i od kada primenio." />
        {imports.length === 0 ? (
          <p className="portal-empty">Još nijedan cenovnik nije otpremljen.</p>
        ) : (
          <div className="portal-table-wrap">
            <table className="portal-table">
              <thead>
                <tr><th>Fajl</th><th>Stanje na dan</th><th className="portal-table-number">Stavki</th><th>Kontrole</th><th>Status</th><th>Važi od</th><th>Otpremio</th></tr>
              </thead>
              <tbody>
                {imports.map((i) => {
                  const st = STATUS[i.status] ?? STATUS.pregled;
                  return (
                    <tr key={i.id}>
                      <td><Link href={`/portal/cene/cenovnik/${i.id}`}>{i.fileName}</Link></td>
                      <td>{day(i.reportDate)}</td>
                      <td className="portal-table-number">{i.rowCount}</td>
                      <td>{checksAllowApply(i.checks) ? <Badge tone="success">tačno pročitano</Badge> : <Badge tone="danger">ne slaže se</Badge>}</td>
                      <td><Badge tone={st.tone}>{st.label}</Badge>{i.status === "primenjeno" ? ` (${i.appliedCount})` : ""}</td>
                      <td>{day(i.validFrom)}</td>
                      <td>{i.uploadedBy ?? "—"} · {DT.format(i.uploadedAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="portal-panel">
        <SectionHeader title="Pojedinačna izmena osnovne cene" description="Za jedan artikal, sa datumom važenja i obrazloženjem. Prethodna cena ostaje u istoriji." />
        <BasePriceForm defaultCode={code ?? ""} defaultDate={today} />
      </section>

      <section className="portal-panel">
        <SectionHeader title="Istorija osnovne cene artikla" description="Unesite šifru da vidite sve verzije osnovne cene, odakle su i ko ih je uneo." />
        <form className="portal-settings-form pl-search" method="get">
          <label><span>Šifra artikla</span><input type="text" name="sifra" defaultValue={code ?? ""} maxLength={32} /></label>
          <button type="submit" className="portal-button">Prikažite</button>
        </form>
        {code ? (
          history.length === 0 ? (
            <p className="portal-empty">Za šifru {code} još nema osnovne cene.</p>
          ) : (
            <div className="portal-table-wrap">
              <table className="portal-table">
                <thead><tr><th>Važi od</th><th className="portal-table-number">Osnovna cena</th><th className="portal-table-number">PDV</th><th>Izvor</th><th>Obrazloženje</th><th>Uneo</th></tr></thead>
                <tbody>
                  {history.map((h, idx) => (
                    <tr key={idx}>
                      <td>{day(h.valid_from)}</td>
                      <td className="portal-table-number">{N.format(Number(h.net_price))}</td>
                      <td className="portal-table-number">{Number(h.vat_percent)} %</td>
                      <td>{h.source === "rucno" ? "ručna izmena" : `cenovnik ${h.file_name ?? ""}`}</td>
                      <td>{h.reason ?? "—"}</td>
                      <td>{h.created_by ?? "—"} · {DT.format(new Date(h.created_at))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : null}
      </section>
    </>
  );
}
