import Link from "next/link";
import { notFound } from "next/navigation";
import { Fragment } from "react";
import { Badge, PageHeader, SectionHeader } from "@/components/portal/PortalPrimitives";
import { can } from "@/lib/authz/permissions.mjs";
import { requireCapability } from "@/lib/authz/session";
import { dmy, dmyTime } from "@/lib/ordering/panelFormat.mjs";
import { loadCurrentVp, loadVpDraft } from "@/lib/pricing/vp-draft-service";
import { changePercent, LARGE_CHANGE_PERCENT } from "@/lib/pricing/vpDraft.mjs";
import { stageOf } from "../stage";
import { VpDraftEditor } from "../VpDraftEditor";
import { OfficeStageForms, PrepareStageForms } from "../VpForms";

export const metadata = { title: "Priprema VP cenovnika" };
export const dynamic = "force-dynamic";

const money = new Intl.NumberFormat("sr-Latn-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const rsd = (c: number | null) => (c === null ? "—" : money.format(c / 100));
const pct = (p: number | null) => (p === null ? "—" : `${p > 0 ? "+" : ""}${String(p).replace(".", ",")} %`);

export default async function VpDraftPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ uredi?: string; korak?: string }> }) {
  const user = await requireCapability("view:vp_cenovnik", "/portal/vp-cenovnik");
  const { id } = await params;
  const { uredi, korak } = await searchParams;
  const DONE: Record<string, string> = {
    kancelarija: "Poslato kancelariji. Kancelarija je dobila obaveštenje.",
    vraceno: "Vraćeno na doradu. Menadžer prodaje je dobio obaveštenje sa napomenom.",
    vlasnik: "Poslato vlasniku. Vlasnik je dobio obaveštenje da potvrdi datum važenja.",
    odbaceno: "Priprema je odbačena.",
  };
  const doneText = korak ? DONE[korak] ?? null : null;
  const data = await loadVpDraft(user, id);
  if (!data) notFound();
  const { draft, rows, today } = data;
  const st = stageOf(draft);
  const canPrepare = can(user, "pricelist:prepare");
  const canOffice = can(user, "pricelist:office_check");
  const isOwner = can(user, "pricelist:manage");
  const editing = draft.stage === "priprema" && canPrepare && (uredi === "1" || rows.length === 0);

  const history = [
    { when: draft.created_at, who: draft.created_by_name, what: draft.origin === "excel" ? "napravio iz Excela" : "napravio pripremu" },
    draft.sent_to_office_at ? { when: draft.sent_to_office_at, who: draft.sent_to_office_name, what: "poslao kancelariji" } : null,
    draft.returned_at ? { when: draft.returned_at, who: draft.returned_name, what: `vratio na doradu: ${draft.returned_note ?? ""}` } : null,
    draft.office_checked_at ? { when: draft.office_checked_at, who: draft.office_checked_name, what: `proverila i poslala vlasniku${draft.office_note ? `: ${draft.office_note}` : ""}` } : null,
  ].filter((x): x is { when: string; who: string | null; what: string } => Boolean(x));

  const header = (
    <PageHeader
      eyebrow="VP cenovnik"
      title={draft.title}
      description={
        draft.stage === "priprema"
          ? "U pripremi. Kada je spremna, pošaljite je kancelariji; cene se ne menjaju dok vlasnik ne potvrdi."
          : draft.stage === "kancelarija"
            ? "Kancelarija proverava staru i novu cenu, preuzima Excel za BizniSoft i šalje vlasniku — ili vraća na doradu."
            : draft.stage === "vlasnik"
              ? "Kod vlasnika: potvrda datuma važenja na strani Cenovnik (uz drugi faktor)."
              : "Priprema je odbačena."
      }
      meta={
        <span>
          <Badge tone={st.tone}>{st.label}</Badge> · <Link href="/portal/vp-cenovnik">← VP cenovnik</Link>
        </span>
      }
    />
  );

  const done = doneText ? <p className="portal-permission-ok" role="status">{doneText}</p> : null;

  if (editing) {
    const base = await loadCurrentVp(today);
    return (
      <>
        {header}
        {done}
        {draft.returned_note ? <p className="portal-login-error" role="alert">Vraćeno na doradu ({draft.returned_name}): {draft.returned_note}</p> : null}
        <VpDraftEditor
          rows={base}
          today={today}
          initial={{ id: draft.id, title: draft.title, proposedValidFrom: draft.proposed_valid_from, note: draft.prepared_note ?? "", edits: { brands: {}, groups: {}, articles: {}, prices: {}, ...draft.edits } as never, rounding: draft.rounding }}
        />
      </>
    );
  }

  // Pregled: brend › grupa, stara pored nove.
  const tree = new Map<string, Map<string, typeof rows>>();
  for (const r of rows) {
    const g = tree.get(r.brand) ?? new Map<string, typeof rows>();
    g.set(r.group, [...(g.get(r.group) ?? []), r]);
    tree.set(r.brand, g);
  }
  const moved = rows.filter((r) => r.oldCents !== null && r.currentCents !== null && r.currentCents !== r.oldCents).length;
  const big = rows.filter((r) => r.oldCents && Math.abs(changePercent(r.oldCents, r.newCents) ?? 0) > LARGE_CHANGE_PERCENT).length;
  const brandSummary = [...tree].map(([brand, groups]) => {
    const list = [...groups.values()].flat();
    const old = list.reduce((a, r) => a + (r.oldCents ?? 0), 0);
    const nw = list.reduce((a, r) => a + (r.oldCents ? r.newCents : 0), 0);
    return { brand, count: list.length, avg: old ? changePercent(old, nw) : null };
  });

  return (
    <>
      {header}
      {done}

      <section className="portal-panel">
        <SectionHeader title={`Promenjene cene (${rows.length})`} description="Stara i nova VP cena bez PDV-a, po brendu i grupi. Excel „samo promene“ je za unos u BizniSoft; „ceo cenovnik“ ima i nepromenjene cene." />
        <p className="portal-export-links">
          <a className="portal-button" data-variant="primary" href={`/api/portal/vp-cenovnik/izvoz?vrsta=priprema&id=${draft.id}`} download>Excel — samo promene</a>
          <a className="portal-button" href={`/api/portal/vp-cenovnik/izvoz?vrsta=priprema&id=${draft.id}&sve=1`} download>Excel — ceo nov cenovnik</a>
          {draft.stage === "priprema" && canPrepare ? <Link className="portal-button" href={`/portal/vp-cenovnik/${draft.id}?uredi=1`}>Izmenite pripremu</Link> : null}
          {draft.stage === "vlasnik" && isOwner && draft.import_id ? (
            <Link className="portal-button" data-variant="primary" href={`/portal/cene/cenovnik/${draft.import_id}`}>Potvrdite važenje (Cenovnik)</Link>
          ) : null}
        </p>
        <ul className="vp-facts">
          <li>Po brendu: {brandSummary.map((b) => `${b.brand} ${b.count} (prosečno ${pct(b.avg)})`).join(" · ")}</li>
          {draft.proposed_valid_from ? <li>Predlog važenja: {dmy(draft.proposed_valid_from)}</li> : null}
          {draft.import_status === "primenjeno" && draft.import_valid_from ? <li>Primenjeno — važi od {dmy(draft.import_valid_from)}</li> : null}
          {draft.import_status === "odbaceno" ? <li>Vlasnik nije prihvatio{draft.import_decision_note ? `: ${draft.import_decision_note}` : ""}</li> : null}
          {big ? <li><strong>{big} cena se menja više od {LARGE_CHANGE_PERCENT} %</strong> — istaknute su u tabeli.</li> : null}
          {moved ? <li><strong>{moved} cena je u međuvremenu promenjena</strong> (važeća danas nije ista kao „stara“ u pripremi).</li> : null}
          {draft.prepared_note ? <li>Napomena: {draft.prepared_note}</li> : null}
        </ul>
        <div className="portal-table-wrap">
          {/* Brend › grupa se ne ređa klikom (pomešale bi se grupe). */}
          <table className="portal-table" data-sort="off">
            <thead>
              <tr><th>Šifra</th><th>Artikal</th><th className="portal-table-number">Stara VP</th><th className="portal-table-number">Nova VP</th><th className="portal-table-number">Promena</th></tr>
            </thead>
            <tbody>
              {[...tree].map(([brand, groups]) => (
                <Fragment key={brand}>
                  <tr><th colSpan={5} scope="rowgroup">{brand}</th></tr>
                  {[...groups].map(([group, list]) => (
                    <Fragment key={group}>
                      <tr><td colSpan={5}><small className="portal-table-sub">{group} · {list.length}</small></td></tr>
                      {list.map((r) => {
                        const ch = r.oldCents ? changePercent(r.oldCents, r.newCents) : null;
                        const warn = ch !== null && Math.abs(ch) > LARGE_CHANGE_PERCENT;
                        const drift = r.oldCents !== null && r.currentCents !== null && r.currentCents !== r.oldCents;
                        return (
                          <tr key={r.articleId}>
                            <td>{r.code}</td>
                            <td>{r.name}</td>
                            <td className="portal-table-number">
                              {rsd(r.oldCents)}
                              {drift ? <small className="portal-table-sub"> danas {rsd(r.currentCents)}</small> : null}
                            </td>
                            <td className="portal-table-number"><strong>{rsd(r.newCents)}</strong></td>
                            <td className="portal-table-number">{warn ? <Badge tone="warning">{pct(ch)}</Badge> : pct(ch)}</td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  ))}
                </Fragment>
              ))}
              {rows.length === 0 ? <tr><td colSpan={5}>U pripremi nema promena.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      {draft.stage === "priprema" && canPrepare ? (
        <section className="portal-panel">
          <SectionHeader title="Sledeći korak" description="Kancelarija dobija obaveštenje i proverava staru pored nove cene." />
          <PrepareStageForms id={draft.id} canSend={rows.length > 0} />
        </section>
      ) : null}

      {draft.stage === "kancelarija" && canOffice ? (
        <section className="portal-panel">
          <SectionHeader title="Provera kancelarije" description="Preuzmite Excel i unesite cene u BizniSoft. Kada je sve u redu, pošaljite vlasniku; ako nešto ne valja, vratite na doradu sa napomenom." />
          <OfficeStageForms id={draft.id} />
        </section>
      ) : null}

      <section className="portal-panel">
        <SectionHeader title="Tok" description="Ko je šta uradio i kada." />
        <ul className="vp-facts">
          {history.map((h, i) => (
            <li key={i}>{dmyTime(new Date(h.when))} — {h.who ?? "—"} {h.what}</li>
          ))}
        </ul>
      </section>
    </>
  );
}
