import { SectionHeader } from "@/components/portal/PortalPrimitives";
import type { BackupStatusItem } from "@/lib/backup/status-service";
import { BACKUP_LABELS, BACKUP_THRESHOLDS } from "@/lib/backup/status.mjs";

const DT = new Intl.DateTimeFormat("sr-Latn-RS", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Belgrade" });
const N = new Intl.NumberFormat("sr-Latn-RS");

const WHAT: Record<string, string> = {
  db_verified: "Kopija iz jednog snimka baze, vraćena u praznu bazu; poklopili su se sve tabele, sekvence, dozvole i zbirovi prodaje. Ovo NE znači da je kopija sačuvana van GitHub-a.",
  offsite_stored: "Šifrovana kopija preuzeta sa GitHub-a, otisak proveren i sačuvana na firminom računaru (van GitHub-a). Ovo NE potvrđuje kopiju u oblaku: Google Drive se otprema ručno i portal ga ne prati.",
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

const SHORT: Record<string, string> = {
  db_verified: "provera kopije baze",
  offsite_stored: "kopija na firminom računaru",
  pdf_backup: "kopija PDF-ova",
};

const MISSING: Record<string, string> = {
  offsite_stored: "Šifrovana kopija na firminom računaru (van GitHub-a) još nije podešena.",
  pdf_backup: "Kopija izvornih PDF-ova nije uključena — dokumenti su u BizniSoftu, a nezavisna kopija BizniSoft baze još nije potvrđena.",
};

/**
 * Tri odvojene tvrdnje o kopijama; nijedna ne zamenjuje drugu.
 *
 * „Kopija baze proverena“ i „Zaštita i čuvanje kopija nisu potpuno podešeni“
 * su dve različite poruke: dnevna kopija može da radi i da bude zelena, a da
 * druga lokacija ili PDF kopija još ne postoje. Tada portal NE kaže da kopija
 * nema.
 */
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
          description="Nijedna automatska kopija još nije zabeležena. Do tada portal ne prikazuje nijednu kopiju kao uspešnu."
        />
        {!compact ? (
          <ul className="bk-missing">
            <li>{BACKUP_LABELS.db_verified}: još nije zabeležena (dnevna kopija iz privatnog GitHub repoa firme).</li>
            <li>{BACKUP_LABELS.offsite_stored}: nije podešeno (preuzimanje na firmin računar i u oblak).</li>
            <li>{BACKUP_LABELS.pdf_backup}: nije podešeno (dnevna šifrovana kopija izvornih PDF-ova).</li>
          </ul>
        ) : null}
      </section>
    );
  }
  const active = items.filter((i) => i.state !== "nije_podesen");
  const missing = items.filter((i) => i.state === "nije_podesen");
  const shown = compact ? active.filter((i) => i.tone !== "success") : active;
  if (compact && shown.length === 0 && missing.length === 0) return null;
  const dbOk = active.some((i) => i.kind === "db_verified" && i.tone === "success");
  const accent = active.some((i) => i.tone === "danger") ? "danger" : active.some((i) => i.tone === "warning") || missing.length ? "warning" : undefined;
  return (
    <section className="portal-panel" data-accent={accent}>
      <SectionHeader
        title="Rezervne kopije"
        description={
          compact
            ? `${dbOk ? "Kopija baze proverena je u roku. " : ""}Detalji su u Sinhronizaciji.`
            : "Odvojene provere. Zelena je samo ona koja je zaista urađena u roku."
        }
      />
      {shown.length ? (
        <ul className="bk-list">
          {shown.map((i) => (
            <li key={i.kind} className="bk-item" data-tone={i.tone}>
              <div className="bk-head">
                <strong>{BACKUP_LABELS[i.kind as keyof typeof BACKUP_LABELS]}</strong>
                <span className="kk-status" data-tone={i.tone}>
                  {i.state === "nikad" ? "nema" : i.tone === "success" ? "u roku" : i.tone === "warning" ? "pažnja" : "kasni"}
                </span>
              </div>
              <p className="bk-when">
                {i.lastOk ? `Poslednja uspešna: ${DT.format(new Date(i.lastOk.finished_at))} (pre ${i.ageHours} h)` : "Nijedna uspešna još nije zabeležena."}
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
      ) : null}
      {missing.length ? (
        <div className="bk-incomplete" data-tone="warning">
          <strong>Zaštita i čuvanje kopija nisu potpuno podešeni</strong>
          {!compact ? (
            <ul className="bk-missing">
              {missing.map((i) => (
                <li key={i.kind}>{MISSING[i.kind] ?? `${BACKUP_LABELS[i.kind as keyof typeof BACKUP_LABELS]}: nije podešeno.`}</li>
              ))}
            </ul>
          ) : (
            <p className="bk-msg">Još nije podešeno: {missing.map((i) => SHORT[i.kind] ?? i.kind).join(", ")}.</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
