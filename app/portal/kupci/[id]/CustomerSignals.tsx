import { Badge } from "@/components/portal/PortalPrimitives";
import type { CustomerProfile } from "@/lib/recommendations/customer-profile";
import { CONFIDENCE_LABELS, STATUS_LABELS } from "@/lib/recommendations/policy.mjs";

type Row = CustomerProfile["signals"]["regular"][number];

function SignalTable({ rows, empty }: { rows: Row[]; empty: string }) {
  if (rows.length === 0) return <p>{empty}</p>;
  return (
    <div className="portal-table-wrap">
      <table className="portal-table">
        <thead>
          <tr>
            <th scope="col">Artikal</th>
            <th scope="col">Kupovine</th>
            <th scope="col">Prva / poslednja</th>
            <th scope="col">Tipičan razmak</th>
            <th scope="col">Status</th>
            <th scope="col">Zašto</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                <strong>{r.articleCode}</strong>
                {r.articleName ? <small>{r.articleName}</small> : null}
              </td>
              <td>{r.eventCount}</td>
              <td>
                {r.firstPurchaseOn}
                <small>{r.lastPurchaseOn}</small>
              </td>
              <td>{r.medianIntervalDays === null ? "—" : `${r.medianIntervalDays} dana`}</td>
              <td>
                <Badge tone="neutral">{STATUS_LABELS[r.status as keyof typeof STATUS_LABELS] ?? r.status}</Badge>
                <small>pouzdanost: {CONFIDENCE_LABELS[r.confidence as keyof typeof CONFIDENCE_LABELS] ?? r.confidence}</small>
              </td>
              <td>
                <small>{r.explanation}</small>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Signali za JEDNOG kupca. Serverska komponenta — podaci su već skopirani na
 * kupca koga je `requireCustomerAccess` propustio.
 */
export function CustomerSignals({ profile }: { profile: CustomerProfile }) {
  const { rhythm, signals } = profile;
  return (
    <section className="portal-panel">
      <h2>Ritam kupovine i signali</h2>
      <p className="portal-login-hint">
        Stanje na dan {profile.asOfDate}. Izvor: validne, originalne fakture iz
        uvezenih BizniSoft dokumenata ({profile.documentCount} dokumenata, {profile.purchaseDayCount} dana
        kupovine). Kupovina koja nije uvezena ovde se ne vidi. Interna procena, ne
        verovatnoća.
      </p>
      <h3>Kupac</h3>
      <p>
        <Badge tone="neutral">{STATUS_LABELS[rhythm.status as keyof typeof STATUS_LABELS] ?? rhythm.status}</Badge>{" "}
        {rhythm.explanation}
      </p>
      {!profile.hasActiveRun ? (
        <p>
          Signali po artiklu još nisu obračunati (nema aktivnog prolaza preporuka).
        </p>
      ) : (
        <>
          <h3>Duže ne uzima (u odnosu na svoj ritam)</h3>
          <SignalTable
            rows={signals.lapsed}
            empty="Nema artikla koji je kupac redovno uzimao, a sada ga duže ne uzima."
          />
          <h3>Prošao uobičajeni termin</h3>
          <SignalTable rows={signals.overdue} empty="Nijedan artikal nije prešao svoj uobičajeni termin." />
          <h3>Redovno uzima</h3>
          <SignalTable
            rows={signals.regular}
            empty="Nijedan artikal nema bar tri potvrđene kupovine — redovnost se ne može tvrditi."
          />
          {signals.thinHistoryCount > 0 ? (
            <p className="portal-login-hint">
              Još {signals.thinHistoryCount} artikala ima jednu ili dve kupovine; iz toga se ne izvodi
              nijedan zaključak.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
