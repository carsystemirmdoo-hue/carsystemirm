import Link from "next/link";
import { DOCUMENT_KIND_LABELS, srDate } from "@/components/customer/account-format";
import { PageHeader } from "@/components/portal/PortalPrimitives";
import { can } from "@/lib/authz/permissions.mjs";
import { requireCapability } from "@/lib/authz/session";
import { loadDatasetInfo } from "@/lib/data-state/dataset";
import { loadRebateEvidence, type RebateEvidenceItem } from "@/lib/pricing/rebate-evidence-service";
import { ProposeRebateButton } from "./ProposeRebateButton";

export const dynamic = "force-dynamic";

const SECTIONS: { status: string; title: string; hint: string }[] = [
  { status: "consistent", title: "Dosledan rabat — kandidati za predlog", hint: "Isti rabat na najmanje 3 stavke u najmanje 2 dokumenta. Predlog ide na odobrenje; ne menja cenovnik." },
  { status: "contradictory", title: "Protivrečno", hint: "Različiti rabati za istu grupu. Proverite sa kancelarijom koji uslov važi — sistem ne bira." },
  { status: "missing_group", title: "Nedostaje grupa artikla", hint: "Artikli bez grupe: rabat po grupi se ne može izvesti. Grupu donosi šifarnik iz BizniSofta." },
  { status: "thin", title: "Premalo dokaza", hint: "Manje od 3 stavke ili samo jedan dokument." },
  { status: "no_discount", title: "Bez rabata na fakturama", hint: "Sve stavke bez rabata — dokaz da ugovorenog rabata za grupu nema." },
];

function Item({ item, canPropose }: { item: RebateEvidenceItem; canPropose: boolean }) {
  return (
    <li className="rb-item">
      <div className="rb-head">
        <Link href={`/portal/kupci/${item.customerId}`}>
          <strong>{item.customerName}</strong>
        </Link>
        <span>{item.productGroup ?? "bez grupe"}</span>
        {item.candidatePercent !== null ? <span className="kk-status" data-tone="success">{item.candidatePercent} %</span> : null}
        <small>
          {item.lineCount} stavki · {item.documentCount} dok. · {srDate(item.firstOn)} – {srDate(item.lastOn)}
        </small>
      </div>
      <ul className="rb-values">
        {item.values.map((v) => (
          <li key={v.discountPercent}>
            <strong>{v.discountPercent} %</strong> na {v.lines} stavki, {v.documents} dok. — npr.{" "}
            {v.samples.map((s: { invoiceId: string; documentLabel: string; issuedOn: string; articleCode: string }, i: number) => (
              <span key={s.invoiceId}>
                {i ? ", " : ""}
                {s.documentLabel} ({srDate(s.issuedOn)}, {s.articleCode})
              </span>
            ))}
          </li>
        ))}
      </ul>
      {item.existing.length ? (
        <p className="rb-note">Postojeći uslov: {item.existing.map((e) => `${e.source} ${e.discountPercent} %`).join("; ")}</p>
      ) : null}
      {item.conflict ? <p className="rb-warn">Razlikuje se od postojećeg uslova — {item.conflict}.</p> : null}
      {item.corrections ? (
        <p className="rb-warn">
          Kupac ima i dokumente koji mogu promeniti stvarni rabat ({item.corrections.count}:{" "}
          {item.corrections.kinds.map((k: string) => DOCUMENT_KIND_LABELS[k] ?? k).join(", ").toLowerCase()}) — proveriti ručno.
        </p>
      ) : null}
      {item.status === "consistent" && canPropose && item.productGroup ? (
        item.alreadyProposed ? (
          <small className="rb-ok">Predlog već postoji.</small>
        ) : (
          <ProposeRebateButton customerId={item.customerId} productGroup={item.productGroup} />
        )
      ) : null}
    </li>
  );
}

export default async function RebatesFromInvoicesPage() {
  const user = await requireCapability("view:cene", "/portal/cene/rabati-iz-faktura");
  const [{ items, lineCount, missingGroupLines }, dataset] = await Promise.all([loadRebateEvidence(user), loadDatasetInfo()]);
  const canPropose = can(user, "prices:propose");
  return (
    <>
      <PageHeader
        eyebrow="Finansije"
        title="Rabati po grupama iz faktura"
        description="Priprema uslova iz potvrđenih računa-otpremnica: samo procenat rabata na stavci, nikad istorijska cena. Rezultat je predlog sa dokazima — važi tek posle odobrenja i unosa u BizniSoft."
        actions={<Link className="rr-link" href="/portal/cene/rabati-iz-faktura/kupci">Pregled po kupcu →</Link>}
      />
      <section className="portal-panel">
        <div className="kk-pricelist" data-kind={dataset.kind === "demo" ? "demo" : "off"}>
          <strong>{lineCount} potvrđenih stavki</strong>
          <span>
            {dataset.kind === "demo" ? "DEMO: izmišljene fakture i rabati. " : ""}
            {missingGroupLines ? `${missingGroupLines} stavki nema grupu artikla. ` : ""}
            Korekcije popusta, storna i povrati se ne računaju u rabat i prikazuju se kao upozorenje.
          </span>
        </div>
      </section>
      {SECTIONS.map((sec) => {
        const list = items.filter((i) => i.status === sec.status);
        if (list.length === 0) return null;
        return (
          <section key={sec.status} className="portal-panel">
            <div className="portal-section-header">
              <div>
                <h2>
                  {sec.title} · {list.length}
                </h2>
                <p>{sec.hint}</p>
              </div>
            </div>
            <div className="portal-panel-body">
              <ol className="rb-list">
                {list.map((i) => (
                  <Item key={`${i.customerId}|${i.productGroup}`} item={i} canPropose={canPropose} />
                ))}
              </ol>
            </div>
          </section>
        );
      })}
    </>
  );
}
