import { SectionHeader } from "@/components/portal/PortalPrimitives";
import type { BackupStatusItem } from "@/lib/backup/status-service";
import { BACKUP_LABELS, BACKUP_THRESHOLDS } from "@/lib/backup/status.mjs";

const DT = new Intl.DateTimeFormat("sr-Latn-RS", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Belgrade" });
const N = new Intl.NumberFormat("sr-Latn-RS");

const WHAT: Record<string, string> = {
  db_verified: "Kopija iz jednog snimka baze, vraćena u praznu bazu; poklopili su se sve tabele, sekvence, dozvole i zbirovi prodaje. Ovo NE znači da je kopija sačuvana van GitHub-a.",
  offsite_stored: "Šifrovana kopija preuzeta sa GitHub-a, otisak proveren i sačuvana na firminom računaru ili u oblaku. Tek ovo je kopija van GitHub-a.",
  pdf_backup: "Dnevna inkrementalna šifrovana kopija izvornih PDF-ova. Obrisan original ne briše sačuvanu kopiju.",
};

function detailOf(item: BackupStatusItem) {
  const r = item.lastOk;
  if (!r) return null;
  if (item.kind === "pdf_backup") {
    return `${N.format(r.files_new ?? 0)} novih, ${N.format(r.files_changed ?? 0)} promenjenih, ${N.format(r.files_missing ?? 0)} nestalih u izvoru · ukupno ${N.format(Number(r.rows ?? 0))} objekata`;
  }
  const parts = [];
  if (r.tables) parts.push(`${r.tables} tabela`);
  if (r.rows) parts.push(`${N.format(Number(r.rows))} redova`);
  if (r.migrations) parts.push(`migracija ${r.migrations}`);
  if (r.bytes) parts.push(`${(Number(r.bytes) / 1048576).toFixed(1)} MB`);
  return parts.join(" · ");
}

/** Tri odvojene tvrdnje o kopijama; nijedna ne zamenjuje drugu. */
export function BackupStatusPanel({ items, compact = false }: { items: BackupStatusItem[] | null; compact?: boolean }) {
  if (items === null) {
    return (
      <section className="portal-panel" data-accent="warning">
        <SectionHeader title="Rezervne kopije" description="Evidencija kopija još nije uključena u ovoj bazi (migracija 0036)." />
      </section>
    );
  }
  if (items.every((i) => i.state === "nije_podesen")) {
    return (
      <section className="portal-panel" data-accent="warning">
        <SectionHeader
          title="Backup nije podešen"
          description="Automatske rezervne kopije još nisu uključene. Do tada portal ne prikazuje nijednu kopiju kao uspešnu."
        />
        {!compact ? (
          <ul className="bk-missing">
            <li>{BACKUP_LABELS.db_verified}: nije uključeno (dnevna kopija iz privatnog GitHub repoa firme).</li>
            <li>{BACKUP_LABELS.offsite_stored}: nije uključeno (preuzimanje na firmin računar i u oblak).</li>
            <li>{BACKUP_LABELS.pdf_backup}: nije uključeno (dnevna šifrovana kopija izvornih PDF-ova).</li>
          </ul>
        ) : null}
      </section>
    );
  }
  const shown = compact ? items.filter((i) => i.tone !== "success") : items;
  if (compact && shown.length === 0) return null;
  return (
    <section className="portal-panel" data-accent={items.some((i) => i.tone === "danger") ? "danger" : items.some((i) => i.tone === "warning") ? "warning" : undefined}>
      <SectionHeader
        title="Rezervne kopije"
        description={compact ? "Upozorenje o kopijama — detalji su u Sinhronizaciji." : "Tri odvojene provere. Zelena je samo ona koja je zaista urađena u roku."}
      />
      <ul className="bk-list">
        {shown.map((i) => (
          <li key={i.kind} className="bk-item" data-tone={i.tone}>
            <div className="bk-head">
              <strong>{BACKUP_LABELS[i.kind as keyof typeof BACKUP_LABELS]}</strong>
              <span className="kk-status" data-tone={i.tone}>
                {i.state === "nije_podesen" ? "nije podešeno" : i.state === "nikad" ? "nema" : i.tone === "success" ? "u roku" : i.tone === "warning" ? "pažnja" : "kasni"}
              </span>
            </div>
            <p className="bk-when">
              {i.state === "nije_podesen" ? "Automatika nije uključena." : i.lastOk ? `Poslednja uspešna: ${DT.format(new Date(i.lastOk.finished_at))} (pre ${i.ageHours} h)` : "Nijedna uspešna još nije zabeležena."}
              {i.lastOk?.source_label ? ` · ${i.lastOk.source_label}` : ""}
            </p>
            {i.tone !== "success" ? <p className="bk-msg">{i.message}</p> : null}
            {!compact ? (
              <>
                {detailOf(i) ? <small>{detailOf(i)}</small> : null}
                <small>{WHAT[i.kind]} Upozorenje posle {BACKUP_THRESHOLDS[i.kind as keyof typeof BACKUP_THRESHOLDS].warn} h.</small>
              </>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
