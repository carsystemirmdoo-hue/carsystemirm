import { PortalIcon, type PortalIconName } from "./PortalIcon";

/**
 * Iskren prikaz ekrana koji je izgrađen, ovlašćen i dostupan, ali još nema izvor
 * podataka. Namerno nema nijednog dugmeta koje bi izgledalo upotrebljivo a ne
 * radilo ništa — umesto toga stoji šta tačno nedostaje i šta je uslov da proradi.
 */
export function PhaseNotice({
  icon = "clock",
  title,
  summary,
  requires,
  phase,
}: {
  icon?: PortalIconName;
  title: string;
  summary: string;
  /** Konkretni preduslovi: izvor podataka, pristupni podaci, uređaj. */
  requires: string[];
  phase: string;
}) {
  return (
    <section className="portal-panel" data-accent="info">
      <div className="portal-state" data-state="offline">
        <span className="portal-state-icon">
          <PortalIcon name={icon} />
        </span>
        <h2>{title}</h2>
        <p>{summary}</p>
      </div>
      <div className="portal-phase-notice">
        <h3>Šta je potrebno da ovaj ekran proradi</h3>
        <ul>
          {requires.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="portal-phase-notice-tag">Planirano: {phase}</p>
      </div>
    </section>
  );
}

/**
 * Vrednost koja se ne može izvesti iz trenutnog izvora podataka.
 * Fakture ne nose podatak o plaćanju, pa se sve što iz njega sledi
 * prikazuje ovako — nikada kao nula ni kao procena predstavljena kao činjenica.
 */
export function UnavailableValue({ note }: { note?: string }) {
  return (
    <span className="portal-unavailable" title={note}>
      Podatak nije dostupan iz trenutnog izvora
    </span>
  );
}
