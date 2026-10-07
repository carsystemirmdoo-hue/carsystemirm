import { desc } from "drizzle-orm";
import { Badge, Metric, PageHeader, SectionHeader } from "@/components/portal/PortalPrimitives";
import { getDb } from "@/db/client";
import { importRuns } from "@/db/schema";
import { can } from "@/lib/authz/permissions.mjs";
import { requireCapability } from "@/lib/authz/session";
import { pregledUredjaja } from "@/lib/sync/commands/service";
import { isDeviceIngestEnabled, isSyncOperationsEnabled } from "@/lib/sync/http/gate";
import { DeviceAdmin } from "@/features/portal/DeviceAdmin";
import { TriggerSync } from "@/features/portal/TriggerSync";

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
              "Automatski termin u 09:00 se time ne menja."
            }
          />
        </section>
      ) : null}

      {/* ---------------------------------------------------------------- */}
      <section className="portal-metrics">
        <Metric
          label="Registrovanih uređaja"
          value={String(uredjaji.length)}
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
                      <small>samo kontakt, ne uspešan sync</small>
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
                  <td colSpan={smeKomandu ? 6 : 5}>
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
                    {new Intl.DateTimeFormat("sr-Latn-RS", {
                      dateStyle: "short",
                      timeStyle: "short",
                    }).format(r.startedAt)}
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
