import Link from "next/link";
import { notFound } from "next/navigation";
import { CrumbLabel } from "@/components/portal/Breadcrumbs";
import { requireCapability } from "@/lib/authz/session";
import { loadPriceListReview, rowsToApplyCount } from "@/lib/pricing/price-list-service";
import { dmy, money } from "../../kupci/format";
import { DiscardImportForm, ImportDecisionForm } from "../ImportForms";
import "../../kupci/cene-kupca.css";

export const metadata = { title: "Pregled uvoza VP cenovnika" };
export const dynamic = "force-dynamic";

const GROUPS = [
  ["sve", "Svi redovi"],
  ["promena", "Promenjena VP"],
  ["ista", "Bez promene"],
  ["nepovezano", "Neprepoznati"],
  ["nejasno", "Drugačiji naziv"],
  ["duplikat", "Duplikati šifre"],
] as const;
type Group = (typeof GROUPS)[number][0];

const STATUS_TEXT: Record<string, [string, string]> = {
  povezano: ["Prepoznato po šifri", "var(--pn-ok-ink)"],
  nejasno: ["Ista šifra, drugačiji naziv — samo uz potvrdu", "var(--pn-warn-ink)"],
  nepovezano: ["Neprepoznata šifra — korak 4", "var(--pn-warn-ink)"],
  duplikat: ["Duplikat šifre — ne primenjuje se", "var(--pn-warn-ink)"],
  neispravna_cena: ["Neispravna cena — ne primenjuje se", "var(--pn-danger)"],
};

export default async function PriceImportReviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ grupa?: string; isti?: string }> }) {
  const user = await requireCapability("pricelist:import", "/portal/cene/uvoz");
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const review = await loadPriceListReview(user, id);
  if (!review) notFound();
  const imp = review.import as typeof review.import & { sourceFormat: string; priceUnit: string | null; problems: unknown };
  const group: Group = (GROUPS.map((g) => g[0]) as readonly string[]).includes(sp.grupa ?? "") ? (sp.grupa as Group) : "sve";
  const rows = review.rows as (typeof review.rows[number] & { rawCents?: number | null; filePack?: string | null; fileUnit?: string | null; lineNo?: number })[];
  const inGroup = (r: (typeof rows)[number]) =>
    group === "sve" ? true : group === "promena" ? r.status === "povezano" && r.change === "promena" : group === "ista" ? r.status === "povezano" && r.change === "ista" : r.status === group;
  const counts: Record<Group, number> = {
    sve: rows.length,
    promena: rows.filter((r) => r.status === "povezano" && r.change === "promena").length,
    ista: rows.filter((r) => r.status === "povezano" && r.change === "ista").length,
    nepovezano: rows.filter((r) => r.status === "nepovezano").length,
    nejasno: rows.filter((r) => r.status === "nejasno").length,
    duplikat: rows.filter((r) => r.status === "duplikat").length,
  };
  const problems = (Array.isArray(imp.problems) ? imp.problems : []) as { line?: number; code?: string | null; name?: string; reason?: string; message?: string }[];
  const perPack = imp.priceUnit === "pak";
  // Provera jedinice: sa „po JM“ artikli sa pakovanjem većim od 1 JM koji skaču > 30 % verovatno su cena pakovanja.
  const unitSuspects = imp.priceUnit === "jm" ? rows.filter((r) => r.flags.includes("velika_promena") && (r.packQuantity ?? 1) > 1) : [];
  const shown = rows.filter(inGroup);
  const pending = imp.status === "pregled";
  const today = new Date().toISOString().slice(0, 10);
  const defaultDate = imp.reportDate > today ? imp.reportDate : today;

  return (
    <div className="pn">
      <CrumbLabel segment={id} label={imp.fileName} />
      <p className="pn-back"><Link href="/portal/cene/uvoz">← Uvoz VP cenovnika</Link></p>
      <div className="pn-head">
        <div>
          <h1 className="pn-title">{imp.fileName}</h1>
          <p className="pn-lead">
            {imp.sourceFormat === "tabela" ? `Tabela · cena u fajlu po ${perPack ? "pakovanju (preračunato na JM)" : "jedinici mere"}` : `BizniSoft PDF · stanje ${dmy(imp.reportDate)}`} · {rows.length} redova
            {imp.status === "primenjeno" ? ` · primenjeno, važi od ${dmy(imp.validFrom)}` : imp.status === "odbaceno" ? " · odbačeno" : " · čeka potvrdu"}
          </p>
        </div>
      </div>
      <ol className="ck-chips" aria-label="Koraci uvoza" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {["1. Fajl", "2. Kolone i jedinica cene", "3. Prepoznavanje po šifri", "4. Novi i neprepoznati", "5. Završni pregled"].map((s, i) => (
          <li key={s}><span className="ck-chip" aria-current={pending ? (i === 2 ? "true" : undefined) : "true"}>{s}</span></li>
        ))}
      </ol>
      {sp.isti ? <p className="pn-note" data-tone="info"><span>Isti fajl sa istim izborom kolona je već otpremljen — otvoren je postojeći pregled.</span></p> : null}
      {unitSuspects.length ? (
        <div className="pn-note" data-tone="warning" role="alert">
          <span>
            <strong>Proverite jedinicu cene.</strong> {unitSuspects.length} artikala sa pakovanjem većim od 1 JM menja VP za više od 30 % (npr.{" "}
            {unitSuspects.slice(0, 2).map((r) => `${r.code}: ${money(r.currentCents)} → ${money(r.vpPriceCents)}`).join(", ")}). Ako je cena u fajlu po pakovanju, odbacite ovaj uvoz i
            otpremite fajl ponovo sa izborom „po pakovanju“.
          </span>
        </div>
      ) : null}

      <section className="pn-card pn-card-flush">
        <div className="pn-card-h">
          <h2>3. Prepoznavanje po šifri</h2>
          <span className="pn-small pn-muted">Artikli se povezuju samo po šifri; naziv je samo upozorenje. Artikli koji nisu u fajlu zadržavaju svoju VP cenu.</span>
        </div>
        <nav className="ck-chips" aria-label="Grupe redova" style={{ padding: "10px 16px" }}>
          {GROUPS.map(([g, l]) => (
            <Link key={g} href={`/portal/cene/uvoz/${id}${g === "sve" ? "" : `?grupa=${g}`}`} className="ck-chip" aria-current={group === g ? "true" : undefined}>
              {l} <span className="pn-num">{counts[g]}</span>
            </Link>
          ))}
          <span className="ck-chip" style={{ cursor: "default" }}>Neispravni <span className="pn-num">{problems.length}</span></span>
        </nav>
        <div style={{ overflowX: "auto" }}>
          <table className="pn-table pn-table-cards">
            <thead>
              <tr>
                <th>Šifra</th>
                <th>Naziv u fajlu · artikal u portalu</th>
                {perPack ? <th className="pn-r">Iz fajla (pakovanje)</th> : null}
                <th className="pn-r">Stara VP / JM</th>
                <th className="pn-r">Nova VP / JM</th>
                <th className="pn-r">Promena</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {shown.slice(0, 400).map((r, i) => {
                const [label, color] = STATUS_TEXT[r.status] ?? [r.status, "inherit"];
                const diff = r.currentCents && r.status !== "nepovezano" ? ((r.vpPriceCents / r.currentCents - 1) * 100) : null;
                const notes: string[] = [];
                if (r.note && r.status !== "povezano") notes.push(r.note);
                if (r.flags.includes("velika_promena")) notes.push("promena veća od 30 % — proverite");
                return (
                  <tr key={`${r.code}-${i}`} data-tone={r.status === "nepovezano" || r.status === "duplikat" || r.status === "nejasno" ? "warning" : undefined}>
                    <td data-label="Šifra" className="pn-num pn-strong">{r.code}</td>
                    <td data-label="Naziv">
                      {r.name}
                      <span className="pn-sub">{r.articleName ? `portal: ${r.articleName}` : "nema u portalu"}</span>
                    </td>
                    {perPack ? <td data-label="Iz fajla" className="pn-r pn-num">{money(r.rawCents ?? null)}{r.packQuantity ? <span className="pn-sub">÷ {String(r.packQuantity).replace(".", ",")}</span> : null}</td> : null}
                    <td data-label="Stara VP" className="pn-r pn-num">{money(r.currentCents)}</td>
                    <td data-label="Nova VP" className="pn-r pn-num pn-strong">{r.status === "nepovezano" ? (perPack ? "posle unosa pakovanja" : money(r.vpPriceCents)) : money(r.vpPriceCents)}</td>
                    <td data-label="Promena" className="pn-r pn-num" style={{ color: r.flags.includes("velika_promena") ? "var(--pn-danger)" : undefined, fontWeight: r.flags.includes("velika_promena") ? 700 : 400 }}>
                      {diff === null ? "" : `${diff > 0 ? "+" : ""}${diff.toFixed(1).replace(".", ",")} %`}
                    </td>
                    <td data-label="Status" style={{ color, fontWeight: 600 }}>
                      {label}
                      {notes.length ? <span className="pn-sub" style={{ fontWeight: 400 }}>{notes.join(" · ")}</span> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {shown.length > 400 ? <p className="pn-card-foot">Prikazano prvih 400 od {shown.length} redova ove grupe.</p> : null}
      </section>

      {problems.length ? (
        <section className="pn-card">
          <div className="pn-card-h"><h2>Neispravni redovi — ne uvoze se ({problems.length})</h2></div>
          <ul className="pn-small" style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 2 }}>
            {problems.slice(0, 200).map((p, i) => (
              <li key={i}>
                {p.line ? `Red ${p.line} · ` : ""}
                <span className="pn-num">{p.code ?? "—"}</span> {p.name ?? ""} — {p.reason ?? p.message ?? "neispravan red"}
              </li>
            ))}
          </ul>
          <p className="pn-small pn-muted" style={{ margin: 0 }}>VP cena ovih artikala ostaje ista dok se ne uveze ispravan red.</p>
        </section>
      ) : null}

      {pending ? (
        <>
          <ImportDecisionForm
            importId={id}
            reportDate={imp.reportDate}
            defaultDate={defaultDate}
            newRows={rows.filter((r) => r.status === "nepovezano").map((r) => ({ code: r.code, name: r.name, raw: money(r.rawCents ?? r.vpPriceCents), perPack }))}
            unclear={rows.filter((r) => r.status === "nejasno").map((r) => ({ code: r.code, fileName: r.name, portalName: r.articleName, price: money(r.vpPriceCents) }))}
            groups={review.productGroups}
            toApply={rowsToApplyCount(rows)}
          />
          <DiscardImportForm importId={id} />
        </>
      ) : (
        <p className="pn-note" data-tone={imp.status === "primenjeno" ? "success" : "info"}>
          <span>
            {imp.status === "primenjeno"
              ? `Primenjeno ${imp.appliedCount ?? 0} VP cena, važe od ${dmy(imp.validFrom)}. Rabati kupaca nisu menjani.`
              : `Uvoz je odbačen${imp.decisionNote ? `: ${imp.decisionNote}` : ""}. VP cene nisu menjane.`}
          </span>
        </p>
      )}
    </div>
  );
}
