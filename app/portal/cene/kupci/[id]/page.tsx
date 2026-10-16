import Link from "next/link";
import { forbidden, notFound } from "next/navigation";
import { CrumbLabel } from "@/components/portal/Breadcrumbs";
import { requireCapability } from "@/lib/authz/session";
import { loadRebateSheet, RebateSheetError, SHEET_FILTERS, type SheetFilter } from "@/lib/pricing/customer-rebate-service";
import { dmy, optKey, optShort, pct } from "../format";
import { RebateSheetClient } from "./RebateSheetClient";
import "../cene-kupca.css";

export const metadata = { title: "Cene kupca" };
export const dynamic = "force-dynamic";

const FILTER_LABEL: Record<SheetFilter, string> = {
  svi: "Svi artikli",
  posebni: "Dogovor za artikal",
  akcije: "Akcije",
  nepotvrdjeno: "Nije potvrđeno",
  novi: "Novi artikli",
};

export default async function RebateSheetPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string; prikaz?: string; strana?: string }> }) {
  const user = await requireCapability("view:cene_kupca", "/portal/cene/kupci");
  const { id } = await params;
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 80);
  const filter = (SHEET_FILTERS as readonly string[]).includes(sp.prikaz ?? "") ? (sp.prikaz as SheetFilter) : "svi";
  const page = Number(sp.strana) > 0 ? Math.floor(Number(sp.strana)) : 1;
  let sheet;
  try {
    sheet = await loadRebateSheet(user, id, { q, filter, page });
  } catch (error) {
    if (error instanceof RebateSheetError && error.code === "forbidden") forbidden();
    if (error instanceof RebateSheetError && error.code === "nema") notFound();
    throw error;
  }
  const href = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const next = { q: q || null, prikaz: filter === "svi" ? null : filter, strana: sheet.page > 1 ? String(sheet.page) : null, ...patch };
    for (const [k, v] of Object.entries(next)) if (v) p.set(k, v);
    const s = p.toString();
    return `/portal/cene/kupci/${id}${s ? `?${s}` : ""}`;
  };
  const c = sheet.customer;

  return (
    <div className="pn">
      <CrumbLabel segment={id} label={c.name} />
      <p className="pn-back"><Link href="/portal/cene/kupci">← Svi kupci</Link></p>
      <section className="ck-customer" aria-label="Kupac čije cene gledate">
        <div className="ck-customer-main">
          <span className="ck-eyebrow">Cene za kupca</span>
          <h1 className="ck-customer-name">{c.name}</h1>
          <span className="ck-customer-meta">
            <b>PIB {c.pib}</b>
            {c.city ? ` · ${c.city}` : ""} · komercijalista {c.reps.length ? c.reps.join(", ") : "nije dodeljen"}
          </span>
        </div>
        <div className="ck-bases">
          {sheet.options.map((o) => (
            <div key={o.code ?? "osnovno"} className="ck-base" data-opt={optKey(o.code)}>
              <div className="ck-base-label">{optShort(o.code)}</div>
              <div className="ck-base-value">osnovni rabat <b>{pct(o.rabat)}</b></div>
            </div>
          ))}
        </div>
        <div className="ck-customer-side">
          <span className="ck-access" data-edit={sheet.canEdit ? "true" : "false"}>{sheet.canEdit ? "Možete da menjate" : "Samo pregled"}</span>
          <Link href="/portal/cene/kupci" className="pn-btn" data-size="sm">Promenite kupca</Link>
        </div>
      </section>

      {sheet.isOffice ? (
        <p className="pn-note" data-tone="info">
          <span>
            Prikazani su <strong>dogovoreni</strong> rabati i cene, bez PDV-a, po jedinici mere. Na fakturi u BizniSoftu možete upisati drugačiji rabat — dogovor u
            portalu se time ne menja. Kolona „Poslednja faktura“ pokazuje stvarno fakturisan rabat.
          </span>
        </p>
      ) : null}
      {sheet.options.length === 1 && sheet.options[0].code === null ? (
        <p className="pn-note" data-tone="warning"><span>Kupac nema odobrenu opciju plaćanja (avans ili odloženo), pa se prikazuje jedan, osnovni uslov.</span></p>
      ) : null}

      <div className="ck-tools">
        <form method="get" action={`/portal/cene/kupci/${id}`} role="search">
          {filter !== "svi" ? <input type="hidden" name="prikaz" value={filter} /> : null}
          <input type="search" name="q" defaultValue={q} placeholder="Pronađite artikal — naziv ili šifra" aria-label="Pronađite artikal" autoComplete="off" />
          <button type="submit" className="pn-btn" data-size="sm">Pronađite</button>
        </form>
        <nav className="ck-chips" aria-label="Prikaži">
          {SHEET_FILTERS.map((f) => (
            <Link key={f} href={href({ prikaz: f === "svi" ? null : f, strana: null })} className="ck-chip" aria-current={filter === f ? "true" : undefined} data-guard="izmene">
              {FILTER_LABEL[f]} <span className="pn-num">{sheet.counts[f]}</span>
            </Link>
          ))}
        </nav>
        {!sheet.isOffice ? <span className="ck-formula">Čuva se rabat · cena = VP × (1 − rabat) · bez PDV-a · po JM</span> : null}
      </div>

      <RebateSheetClient
        customerId={c.id}
        customerName={c.name}
        today={sheet.today}
        options={sheet.options.map((o) => ({ code: o.code, label: o.label, short: optShort(o.code), key: optKey(o.code), base: o.rabat }))}
        rows={sheet.rows}
        canEdit={sheet.canEdit}
        isOffice={sheet.isOffice}
        role={user.role}
        footer={{
          shown: sheet.rows.length,
          total: sheet.total,
          page: sheet.page,
          pages: sheet.pages,
          prev: sheet.page > 1 ? href({ strana: String(sheet.page - 1) }) : null,
          next: sheet.page < sheet.pages ? href({ strana: String(sheet.page + 1) }) : null,
        }}
        reps={c.reps}
      />
      <p className="pn-small pn-muted">Stanje na dan {dmy(sheet.today)}.</p>
    </div>
  );
}
