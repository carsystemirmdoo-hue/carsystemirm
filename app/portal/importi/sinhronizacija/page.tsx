import { desc } from "drizzle-orm";
import { Badge, Metric, PageHeader, SectionHeader } from "@/components/portal/PortalPrimitives";
import { getDb } from "@/db/client";
import { importRuns } from "@/db/schema";
import { can } from "@/lib/authz/permissions.mjs";
import { requireCapability } from "@/lib/authz/session";
import { pregledUredjaja } from "@/lib/sync/commands/service";
import { isDeviceIngestEnabled, isSyncOperationsEnabled } from "@/lib/sync/http/gate";
import { opisStanja, stanjeUredjaja } from "@/lib/sync/device/cycle-status.mjs";
import { BackupStatusPanel } from "@/features/portal/BackupStatusPanel";
import { DeviceAdmin } from "@/features/portal/DeviceAdmin";
import { loadBackupStatus } from "@/lib/backup/status-service";
import { TriggerSync } from "@/features/portal/TriggerSync";
import { dmyTime, quantity } from "@/lib/ordering/panelFormat.mjs";

export const dynamic = "force-dynamic";

/**
 * Operativni pregled sinhronizacije.
 *
 * Ekran postoji da bi kancelarija videla ŠTA se stvarno desilo, a ne da bi
 * izgledalo da se dešava. Zato su svuda razdvojene tvrdnje koje se lako
 * pobrkaju:
 *
 *  - „zatraženo“ nije „pokrenuto“;
 *  - poslednje javljanje uređaja nije uspešna sinhronizacija;
 *  - „završeno uz pregled“ nije potpuno knjiženje.
 *
 * Ovlašćenje: `sync:monitor` za pregled, `sync:trigger` za komandu,
 * `devices:manage` za uređaje. `view:importi` sam po sebi ne otvara ovu stranu.
 */

/** Prijateljski opis stanja komande — bez pogađanja i bez ulepšavanja. */
const STANJE_KOMANDE: Record<string, { tekst: string; tone: "success" | "warning" | "danger" | "info" | "neutral" }> = {
  queued: { tekst: "čeka uređaj", tone: "info" },
  delivered: { tekst: "preuzeto", tone: "info" },
  running: { tekst: "radi", tone: "info" },
  retry_pending: { tekst: "čeka retry", tone: "warning" },
  completed: { tekst: "završeno", tone: "success" },
  completed_with_review: { tekst: "završeno — traži pregled", tone: "warning" },
  failed: { tekst: "neuspeh", tone: "danger" },
  blocked: { tekst: "blokirano", tone: "danger" },
  expired: { tekst: "isteklo", tone: "danger" },
};

function proteklo(iso: string | null): string {
  if (!iso) return "nikad";
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 0) return "nepoznato";
  const min = Math.floor(ms / 60000);
  if (min < 1) return "pre manje od minuta";
  if (min < 60) return `pre ${min} min`;
  const sati = Math.floor(min / 60);
  if (sati < 24) return `pre ${sati} h`;
  return `pre ${Math.floor(sati / 24)} dana`;
}

/** Vreme u Europe/Belgrade, bez obzira na zonu servera (Vercel radi u UTC). */
const VREME_BG = { format: (d: Date) => dmyTime(d) };
function bg(iso: string | Date | null): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return Number.isNaN(d.getTime()) ? "—" : VREME_BG.format(d);
}

const ISHOD: Record<string, { tekst: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  obradjeno: { tekst: "obrađen", tone: "success" },
  preskoceno: { tekst: "preskočen po rasporedu", tone: "neutral" },
  greska: { tekst: "greška", tone: "danger" },
};

/** Prikaz statusa — vrednosti iz baze ostaju iste, menja se samo natpis. */
const STATUS_UREDJAJA: Record<string, { tekst: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  registered: { tekst: "čeka aktivaciju", tone: "warning" },
  active: { tekst: "aktivan", tone: "success" },
  suspended: { tekst: "privremeno isključen", tone: "warning" },
  revoked: { tekst: "opozvan", tone: "danger" },
};

const STATUS_UVOZA: Record<string, string> = {
  u_toku: "u toku",
  uspesno: "uspešno",
  uspesno_sa_upozorenjima: "uspešno, sa upozorenjima",
  greska: "greška",
  preskoceno_duplikat: "preskočeno (već uvezeno)",
};

export default async function SyncOperationsPage() {
  const user = await requireCapability("sync:monitor", "/portal/importi/sinhronizacija");

  const smeKomandu = can(user, "sync:trigger");
  const smeUredjaje = can(user, "devices:manage");
  const prijemUkljucen = isDeviceIngestEnabled();
  const komandeUkljucene = isSyncOperationsEnabled();

  const uredjaji = await pregledUredjaja();

  const db = getDb();
  const prolazi = await db
    .select()
    .from(importRuns)
    .orderBy(desc(importRuns.startedAt))
    .limit(5);

  const aktivnih = uredjaji.filter((u) => u.status === "active").length;

  return (
    <>
      <PageHeader
        eyebrow="Sistem"
        title="Sinhronizacija"
        description={
          "Stanje kancelarijskog uređaja, poslednji uvozi i ručna komanda. " +
          "Brojevi su izveštaj uređaja o sopstvenom prolazu — za knjiženje su merodavne fakture."
        }
      />

      {/* ---------------------------------------------------------------- */}
      {!prijemUkljucen ? (
        <section className="portal-panel" data-accent="warning">
          <SectionHeader
            title="Prijem sa uređaja je isključen"
            description={
              "Server trenutno ne prima dokumente sa uređaja. Sistem NIJE online: komanda se ne " +
              "nudi, a uređaj koji se javi biće odbijen. Ovo je podešavanje servera, ne kvar uređaja."
            }
          />
        </section>
      ) : !komandeUkljucene ? (
        <section className="portal-panel" data-accent="warning">
          <SectionHeader
            title="Ručne komande su isključene"
            description={
              "Prijem dokumenata radi, ali daljinsko pokretanje skeniranja nije uključeno. " +
              "Automatski ciklusi konektora se time ne menjaju: radnim danima svakog sata od 08:02 do 19:02 " +
              "(praznici se preskaču), dok je kancelarijski računar uključen i nalog prijavljen."
            }
          />
        </section>
      ) : null}

      <BackupStatusPanel items={await loadBackupStatus()} />

      {/* ---------------------------------------------------------------- */}
      <section className="portal-metrics">
        <Metric
          label="Registrovanih uređaja"
          value={quantity(uredjaji.length)}
          context={`aktivnih: ${aktivnih}`}
        />
        <Metric
          label="Prijem sa uređaja"
          value={prijemUkljucen ? "uključen" : "isključen"}
          tone={prijemUkljucen ? "success" : "warning"}
          context="serverski feature gate"
        />
        <Metric
          label="Ručne komande"
          value={komandeUkljucene ? "uključene" : "isključene"}
          tone={komandeUkljucene ? "success" : "warning"}
          context="zaseban gate"
        />
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="portal-panel">
        <SectionHeader
          title="Uređaji"
          description={
            "Poslednje javljanje znači samo da se uređaj autentifikovano javio u tom trenutku — " +
            "ne da je sinhronizacija uspela."
          }
        />
        <div className="portal-table-wrap">
          <table className="portal-table portal-readiness-table">
            <thead>
              <tr>
                <th scope="col">Uređaj</th>
                <th scope="col">Status</th>
                <th scope="col">Opseg</th>
                <th scope="col">Poslednje javljanje</th>
                <th scope="col">Poslednji ciklus</th>
                <th scope="col">Poslednje uspešno skeniranje</th>
                <th scope="col">Poslednja komanda</th>
                {smeKomandu ? <th scope="col">Radnja</th> : null}
              </tr>
            </thead>
            <tbody>
              {uredjaji.map((u) => {
                const k = u.poslednjaKomanda;
                const opis = k ? (STANJE_KOMANDE[k.status] ?? { tekst: k.status, tone: "neutral" as const }) : null;
                return (
                  <tr key={u.id}>
                    <th scope="row">
                      {u.label}
                      <small>{u.deviceCode}</small>
                    </th>
                    <td>
                      <Badge tone={STATUS_UREDJAJA[u.status]?.tone ?? "neutral"}>
                        {STATUS_UREDJAJA[u.status]?.tekst ?? u.status}
                      </Badge>
                    </td>
                    <td>
                      {u.sourceSystem}/{u.issuerCode}
                    </td>
                    <td>
                      {proteklo(u.lastSeenAt)}
                      <small>{bg(u.lastSeenAt)} · samo kontakt</small>
                    </td>
                    <td>
                      {u.lastCycleAt ? (
                        <>
                          <Badge tone={ISHOD[u.lastCycleOutcome ?? ""]?.tone ?? "neutral"}>
                            {ISHOD[u.lastCycleOutcome ?? ""]?.tekst ?? "—"}
                          </Badge>
                          <small>
                            {bg(u.lastCycleAt)} · sledeći {bg(u.nextExpectedCycleAt)}
                          </small>
                        </>
                      ) : (
                        <small>nema izveštaja (konektor pre 0.3.9)</small>
                      )}
                    </td>
                    <td>
                      {u.lastScanCompletedAt ? (
                        <>
                          {bg(u.lastScanCompletedAt)}
                          <small>ceo izvor faktura pregledan</small>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      {k && opis ? (
                        <>
                          <Badge tone={opis.tone}>{opis.tekst}</Badge>
                          <small>
                            knjiženo {k.brojaci.postedCount} · duplikat {k.brojaci.duplicateCount} ·
                            pregled {k.brojaci.reviewCount} · nepodržano {k.brojaci.unsupportedCount} ·
                            čeka {k.brojaci.pendingCount}
                          </small>
                        </>
                      ) : (
                        <span>—</span>
                      )}
                    </td>
                    {smeKomandu ? (
                      <td>
                        <TriggerSync
                          deviceId={u.id}
                          disabled={!komandeUkljucene || u.status !== "active"}
                        />
                      </td>
                    ) : null}
                  </tr>
                );
              })}
              {uredjaji.length === 0 ? (
                <tr>
                  <td colSpan={smeKomandu ? 8 : 7}>
                    Nijedan uređaj nije registrovan. Dok ga nema, automatski uvoz sa kancelarijskog
                    računara ne postoji.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p className="portal-readiness-note">
          „Zatraženo“ nije „pokrenuto“: komandu preuzima uređaj pri sledećem javljanju.
          „Završeno — traži pregled“ znači da je ciklus gotov, ali da deo dokumenata čeka čoveka —
          to NIJE potpuno knjiženje. Pokrenut lokalni posao se ne prekida daljinski.
        </p>
      </section>

      {uredjaji
        .filter((u) => u.status === "active")
        .map((u) => {
          const ulaz = {
            now: new Date(),
            status: u.status,
            lastSeenAt: u.lastSeenAt ? new Date(u.lastSeenAt) : null,
            lastCycleAt: u.lastCycleAt ? new Date(u.lastCycleAt) : null,
            lastCycleOutcome: u.lastCycleOutcome,
            lastScanCompletedAt: u.lastScanCompletedAt ? new Date(u.lastScanCompletedAt) : null,
            nextExpectedCycleAt: u.nextExpectedCycleAt ? new Date(u.nextExpectedCycleAt) : null,
          };
          const stanje = stanjeUredjaja(ulaz);
          return (
            <section key={`ciklusi-${u.id}`} className="portal-panel">
              <SectionHeader
                title={`Ciklusi — ${u.label}`}
                description="Izveštaj posle svakog pokretanja zakazanog zadatka. Preskočen ciklus znači da računar radi, a po rasporedu nije bilo vreme za skeniranje."
              />
              <p className="portal-data-note" data-tone={stanje.ton === "warning" || stanje.ton === "danger" ? "warning" : undefined} role="status">
                {opisStanja(stanje, ulaz, bg)}
              </p>
              {u.poslednjiCiklusi.length > 0 ? (
                <div className="portal-table-wrap">
                  <table className="portal-table">
                    <thead>
                      <tr>
                        <th scope="col">Početak</th>
                        <th scope="col">Ishod</th>
                        <th scope="col">Razlog</th>
                        <th scope="col">Pregledano</th>
                        <th scope="col">Novo</th>
                        <th scope="col">Poslato</th>
                        <th scope="col">Skeniranje</th>
                        <th scope="col">Verzija</th>
                      </tr>
                    </thead>
                    <tbody>
                      {u.poslednjiCiklusi.map((c) => (
                        <tr key={c.cycleAt}>
                          <th scope="row">{bg(c.cycleAt)}</th>
                          <td>
                            <Badge tone={ISHOD[c.outcome]?.tone ?? "neutral"}>{ISHOD[c.outcome]?.tekst ?? c.outcome}</Badge>
                          </td>
                          <td>{c.errorCode ?? c.reason ?? "—"}</td>
                          <td className="portal-table-number">{c.scanned ?? "—"}</td>
                          <td className="portal-table-number">{c.newDocuments ?? "—"}</td>
                          <td className="portal-table-number">{c.sent ?? "—"}</td>
                          <td>{c.scanCompleted ? "potpuno" : "—"}</td>
                          <td>{c.connectorVersion ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </section>
          );
        })}

      {/* ---------------------------------------------------------------- */}
      <section className="portal-panel">
        <SectionHeader
          title="Poslednji uvozi"
          description="Merodavan zapis o knjiženju. Brojevi komande su izveštaj uređaja; ovo je ono što je stvarno ušlo."
        />
        <div className="portal-table-wrap">
          <table className="portal-table">
            <thead>
              <tr>
                <th scope="col">Vreme</th>
                <th scope="col">Status</th>
                <th scope="col">Pročitano</th>
                <th scope="col">Nove</th>
                <th scope="col">Ažurirane</th>
              </tr>
            </thead>
            <tbody>
              {prolazi.map((r) => (
                <tr key={r.id}>
                  <th scope="row">
                    {dmyTime(r.startedAt)}
                  </th>
                  <td>{STATUS_UVOZA[r.status] ?? r.status}</td>
                  <td className="portal-table-number">{r.rowsRead}</td>
                  <td className="portal-table-number">{r.invoicesCreated}</td>
                  <td className="portal-table-number">{r.invoicesUpdated}</td>
                </tr>
              ))}
              {prolazi.length === 0 ? (
                <tr>
                  <td colSpan={5}>Još nije zabeležen nijedan uvoz.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {smeUredjaje ? (
        <DeviceAdmin
          devices={uredjaji.map((u) => ({ id: u.id, label: u.label, deviceCode: u.deviceCode, status: u.status }))}
        />
      ) : null}
    </>
  );
}
