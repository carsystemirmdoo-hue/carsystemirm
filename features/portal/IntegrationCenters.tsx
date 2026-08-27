"use client";

import { useEffect, useMemo, useState } from "react";
import { customers, products } from "@/fixtures/dev/portal";
import type { BexShipment, BizniSoftSyncRecord } from "@/types/portal";
import { PortalIcon } from "@/components/portal/PortalIcon";
import { usePortal } from "@/components/portal/PortalProvider";
import {
  Badge,
  BulkToolbar,
  formatCurrency,
  formatDate,
  Metric,
  ModuleState,
  PageHeader,
  Panel,
  PortalButton,
  SectionHeader,
  SelectionCheckbox,
  statusTone,
  useDialogDismiss,
} from "@/components/portal/PortalPrimitives";
import { AccessGuard } from "@/features/portal/LegacyAccessGuard";

export function BexCenter() {
  const {
    notify,
    bexShipments: shipments,
    updateBexShipment,
    logEvent,
  } = usePortal();
  const [status, setStatus] = useState("svi");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<BexShipment | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sort, setSort] = useState<"newest" | "weight">("newest");
  const filtered = useMemo(
    () =>
      shipments
        .filter(
          (shipment) =>
            (status === "svi" || shipment.status === status) &&
            (!query ||
              `${shipment.orderNumber} ${shipment.customerName} ${shipment.trackingNumber}`
                .toLocaleLowerCase("sr")
                .includes(query.toLocaleLowerCase("sr"))),
        )
        .sort((a, b) =>
          sort === "weight"
            ? b.weight - a.weight
            : b.orderNumber.localeCompare(a.orderNumber),
        ),
    [shipments, status, query, sort],
  );
  const allVisibleSelected =
    filtered.length > 0 &&
    filtered.every((shipment) => selectedIds.includes(shipment.id));

  useEffect(() => {
    setSelectedIds([]);
  }, [query, sort, status]);

  function createShipment(shipment: BexShipment) {
    if (shipment.validationIssues.length) {
      notify(
        "Pošiljka nije spremna",
        shipment.validationIssues.join(" · "),
        "warning",
      );
      setSelected(shipment);
      return;
    }
    updateBexShipment(shipment.id, {
      status: "kreirana",
      trackingNumber: `BEX${Date.now().toString().slice(-8)}`,
    });
    logEvent({
      action: "Kreirana BEX pošiljka",
      module: "BEX",
      entityType: "Porudžbina",
      entityId: shipment.orderId,
      entityLabel: shipment.orderNumber,
      severity: "info",
      reason: "Pošiljka je prošla mock validaciju",
      before: { status: shipment.status },
      after: { status: "kreirana" },
    });
    setSelected(null);
    notify(
      "BEX pošiljka je mock kreirana",
      `${shipment.orderNumber} je dobila demonstracioni tracking broj.`,
    );
  }

  function createSelectedShipments() {
    const chosen = shipments.filter((shipment) =>
      selectedIds.includes(shipment.id),
    );
    const valid = chosen.filter(
      (shipment) => !shipment.validationIssues.length,
    );
    valid.forEach((shipment) => {
      updateBexShipment(shipment.id, {
        status: "kreirana",
        trackingNumber:
          shipment.trackingNumber ??
          `BEX${Date.now().toString().slice(-8)}${shipment.id.slice(-1)}`,
      });
      logEvent({
        action: "Bulk kreirana BEX pošiljka",
        module: "BEX",
        entityType: "Porudžbina",
        entityId: shipment.orderId,
        entityLabel: shipment.orderNumber,
        severity: "info",
        reason: "Pošiljka je prošla mock validaciju u grupnoj obradi",
        before: { status: shipment.status },
        after: { status: "kreirana" },
      });
    });
    notify(
      valid.length
        ? "Validne BEX pošiljke su kreirane"
        : "Nijedna pošiljka nije kreirana",
      `${valid.length} od ${chosen.length} izabranih pošiljki je prošlo validaciju.`,
      valid.length ? "success" : "warning",
    );
    setSelectedIds([]);
  }

  return (
    <AccessGuard permission="integrations:bex">
      <PageHeader
        eyebrow="Logistika"
        title="BEX centar"
        description="Validacija adresa, priprema pošiljki, tracking i otkupnine u mock režimu."
        actions={
          <>
            <Badge tone="success" dot>
              Veza dostupna · mock
            </Badge>
            <PortalButton
              icon="sync"
              disabled
              title="Osvežavanje BEX statusa zahteva pravi servis i nije deo frontend prototipa."
            >
              Osveži statuse · mock
            </PortalButton>
          </>
        }
      />
      <ModuleState>
        <div className="portal-metrics">
          <Metric
            label="Spremne za slanje"
            value={String(
              shipments.filter((item) => item.status === "spremna").length,
            )}
            context="validacija prošla"
            tone="info"
            icon="package"
          />
          <Metric
            label="U transportu"
            value={String(
              shipments.filter((item) => item.status === "u transportu").length,
            )}
            context="aktivne pošiljke"
            icon="truck"
          />
          <Metric
            label="Greške"
            value={String(
              shipments.filter((item) => item.status === "greška").length,
            )}
            context="zahtevaju dopunu"
            tone="danger"
            icon="warning"
          />
          <Metric
            label="Otkupnine"
            value={formatCurrency(
              shipments.reduce((sum, item) => sum + item.cashOnDelivery, 0),
            )}
            context="mock ukupno"
            tone="success"
            icon="prices"
          />
        </div>
        <div className="portal-grid" data-layout="wide-left">
          <Panel>
            <div className="portal-table-toolbar">
              <div className="portal-table-toolbar-main">
                <label className="portal-search-field">
                  <PortalIcon name="search" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Porudžbina, kupac ili tracking"
                  />
                </label>
                <select
                  className="portal-filter-select"
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  aria-label="Status BEX pošiljke"
                >
                  <option value="svi">Svi statusi</option>
                  <option>spremna</option>
                  <option>kreirana</option>
                  <option>greška</option>
                  <option>u transportu</option>
                  <option>isporučena</option>
                  <option>vraćena</option>
                  <option>odbijena</option>
                </select>
              </div>
              <div className="portal-table-toolbar-actions">
                <select
                  className="portal-filter-select"
                  value={sort}
                  onChange={(event) =>
                    setSort(event.target.value as typeof sort)
                  }
                  aria-label="Sortiranje BEX pošiljki"
                >
                  <option value="newest">Najnovije prvo</option>
                  <option value="weight">Najveća težina</option>
                </select>
                {query || status !== "svi" ? (
                  <PortalButton
                    variant="ghost"
                    icon="close"
                    onClick={() => {
                      setQuery("");
                      setStatus("svi");
                    }}
                  >
                    Resetuj
                  </PortalButton>
                ) : null}
              </div>
            </div>
            {query || status !== "svi" ? (
              <div className="portal-active-filters">
                <span className="portal-filter-chip">
                  {filtered.length} pošiljki
                </span>
                {status !== "svi" ? (
                  <span className="portal-filter-chip">Status: {status}</span>
                ) : null}
              </div>
            ) : null}
            <BulkToolbar
              selectedCount={selectedIds.length}
              itemLabel={
                selectedIds.length === 1
                  ? "pošiljka izabrana"
                  : "pošiljki izabrano"
              }
              scopeLabel="Kreiranje važi samo za pošiljke u trenutnom prikazu; nevalidne će biti preskočene."
              onClear={() => setSelectedIds([])}
            >
              <PortalButton
                variant="primary"
                icon="truck"
                onClick={createSelectedShipments}
              >
                Kreiraj validne
              </PortalButton>
            </BulkToolbar>
            <div className="portal-table-wrap">
              <table className="portal-table portal-bex-table">
                <thead>
                  <tr>
                    <th>
                      <SelectionCheckbox
                        checked={allVisibleSelected}
                        mixed={selectedIds.length > 0 && !allVisibleSelected}
                        onChange={() =>
                          setSelectedIds(
                            allVisibleSelected
                              ? []
                              : filtered.map((shipment) => shipment.id),
                          )
                        }
                        label="Izaberi sve BEX pošiljke u trenutnom prikazu"
                      />
                    </th>
                    <th>Porudžbina</th>
                    <th>Kupac</th>
                    <th>Primalac</th>
                    <th>Telefon</th>
                    <th>Adresa</th>
                    <th>Mesto</th>
                    <th>Paketi</th>
                    <th>Težina</th>
                    <th>Otkupnina</th>
                    <th>Status</th>
                    <th>Tracking</th>
                    <th>Preuzimanje</th>
                    <th>Isporuka</th>
                    <th>Akcije</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((shipment) => (
                    <tr
                      key={shipment.id}
                      data-selected={selectedIds.includes(shipment.id)}
                    >
                      <td>
                        <SelectionCheckbox
                          checked={selectedIds.includes(shipment.id)}
                          onChange={() =>
                            setSelectedIds((current) =>
                              current.includes(shipment.id)
                                ? current.filter((id) => id !== shipment.id)
                                : [...current, shipment.id],
                            )
                          }
                          label={`Izaberi ${shipment.orderNumber}`}
                        />
                      </td>
                      <td className="portal-technical">
                        <strong>{shipment.orderNumber}</strong>
                      </td>
                      <td>{shipment.customerName}</td>
                      <td>
                        {shipment.recipient || (
                          <span className="portal-danger-text">nedostaje</span>
                        )}
                      </td>
                      <td>
                        {shipment.phone || (
                          <span className="portal-danger-text">nedostaje</span>
                        )}
                      </td>
                      <td>
                        <strong>{shipment.address || "nedostaje"}</strong>
                        <small>
                          {shipment.postalCode || "bez poštanskog broja"}
                        </small>
                      </td>
                      <td>{shipment.city}</td>
                      <td>{shipment.packageCount}</td>
                      <td>{shipment.weight.toFixed(1)} kg</td>
                      <td className="portal-table-number">
                        {formatCurrency(shipment.cashOnDelivery)}
                      </td>
                      <td>
                        <Badge tone={statusTone(shipment.status)}>
                          {shipment.status}
                        </Badge>
                        {shipment.validationIssues[0] ? (
                          <small className="portal-danger-text">
                            {shipment.validationIssues[0]}
                          </small>
                        ) : null}
                      </td>
                      <td className="portal-technical">
                        {shipment.trackingNumber ?? "nije kreiran"}
                      </td>
                      <td>
                        {shipment.pickupAt
                          ? formatDate(shipment.pickupAt, true)
                          : "nije preuzeto"}
                      </td>
                      <td>
                        {shipment.deliveredAt
                          ? formatDate(shipment.deliveredAt, true)
                          : "nije isporučeno"}
                      </td>
                      <td>
                        <div className="portal-table-actions">
                          <button
                            type="button"
                            className="portal-icon-button"
                            aria-label={`Pregled ${shipment.orderNumber}`}
                            onClick={() => setSelected(shipment)}
                          >
                            <PortalIcon name="eye" />
                          </button>
                          <button
                            className="portal-icon-button"
                            aria-label={`Kreiraj ${shipment.orderNumber}`}
                            onClick={() => createShipment(shipment)}
                          >
                            <PortalIcon name="truck" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!filtered.length ? (
              <div className="portal-inline-empty portal-inline-empty-large">
                <PortalIcon name="search" />
                Nema BEX pošiljki za aktivne filtere.
              </div>
            ) : null}
          </Panel>
          <aside className="portal-stack">
            <Panel>
              <SectionHeader
                title="Validacija pre slanja"
                description="Aktivna pravila"
              />
              <div className="portal-check-list">
                {[
                  "Telefon primaoca",
                  "Poštanski broj",
                  "Potpuna adresa",
                  "Ime primaoca",
                  "Tip usluge",
                  "Otkupnina",
                  "Potvrđena porudžbina",
                ].map((label) => (
                  <div key={label} data-complete="true">
                    <span>
                      <PortalIcon name="check" />
                    </span>
                    <strong>{label}</strong>
                    <Badge tone="success">aktivno</Badge>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel>
              <SectionHeader
                title="Otkupnine"
                description="Status razduženja je mock"
              />
              <div className="portal-detail-list">
                <div>
                  <span>Čekaju razduženje</span>
                  <strong>{formatCurrency(218400)}</strong>
                </div>
                <div>
                  <span>Razduženo danas</span>
                  <strong>{formatCurrency(346900)}</strong>
                </div>
                <div>
                  <span>Kašnjenje</span>
                  <strong>0 pošiljki</strong>
                </div>
              </div>
            </Panel>
          </aside>
        </div>
      </ModuleState>
      {selected ? (
        <BexLabel
          shipment={selected}
          onClose={() => setSelected(null)}
          onCreate={() => createShipment(selected)}
        />
      ) : null}
    </AccessGuard>
  );
}

function BexLabel({
  shipment,
  onClose,
  onCreate,
}: {
  shipment: BexShipment;
  onClose: () => void;
  onCreate: () => void;
}) {
  useDialogDismiss(onClose);
  return (
    <div
      className="portal-drawer-layer"
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <aside className="portal-drawer portal-label-drawer">
        <header>
          <div>
            <span>Mock adresnica</span>
            <h2>{shipment.orderNumber}</h2>
            <p>Pregled pre kreiranja BEX pošiljke</p>
          </div>
          <button className="portal-icon-button" onClick={onClose}>
            <PortalIcon name="close" />
          </button>
        </header>
        <div className="portal-drawer-scroll">
          <div className="portal-shipping-label">
            <header>
              <strong>BEX</strong>
              <span>
                {shipment.trackingNumber ?? "TRACKING ČEKA KREIRANJE"}
              </span>
            </header>
            <section>
              <small>PRIMALAC</small>
              <h3>{shipment.recipient || "NEDOSTAJE PRIMALAC"}</h3>
              <p>{shipment.customerName}</p>
              <p>{shipment.address || "NEDOSTAJE ADRESA"}</p>
              <p>
                {shipment.postalCode || "----"} {shipment.city}
              </p>
              <strong>{shipment.phone || "NEDOSTAJE TELEFON"}</strong>
            </section>
            <div>
              <span>
                <small>PAKETA</small>
                <strong>{shipment.packageCount}</strong>
              </span>
              <span>
                <small>TEŽINA</small>
                <strong>{shipment.weight.toFixed(1)} kg</strong>
              </span>
              <span>
                <small>OTKUPNINA</small>
                <strong>{formatCurrency(shipment.cashOnDelivery)}</strong>
              </span>
            </div>
            <footer>
              <span>{shipment.orderNumber}</span>
              <i>
                {Array.from({ length: 42 }, (_, index) => (
                  <b key={index} style={{ width: index % 4 === 0 ? 3 : 1 }} />
                ))}
              </i>
            </footer>
          </div>
          {shipment.validationIssues.length ? (
            <div className="portal-label-errors">
              <strong>Pošiljka nije spremna</strong>
              {shipment.validationIssues.map((issue) => (
                <span key={issue}>
                  <PortalIcon name="warning" />
                  {issue}
                </span>
              ))}
            </div>
          ) : (
            <div className="portal-label-ok">
              <PortalIcon name="check" />
              Svi obavezni podaci su validni.
            </div>
          )}
        </div>
        <footer>
          <PortalButton onClick={onClose}>Zatvori</PortalButton>
          <PortalButton
            variant="primary"
            icon="truck"
            disabled={Boolean(shipment.validationIssues.length)}
            onClick={onCreate}
          >
            Kreiraj mock pošiljku
          </PortalButton>
        </footer>
      </aside>
    </div>
  );
}

export function BizniSoftCenter() {
  const {
    notify,
    bizniSoftRecords: records,
    updateBizniSoftRecord,
    orders,
    logEvent,
  } = usePortal();
  const [status, setStatus] = useState("svi");
  const [selected, setSelected] = useState<BizniSoftSyncRecord | null>(null);
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sort, setSort] = useState<"attempt" | "retries">("attempt");
  const filtered = useMemo(
    () =>
      records
        .filter(
          (record) =>
            (status === "svi" || record.status === status) &&
            (!query ||
              `${record.entityLabel} ${record.entityId} ${record.issue ?? ""}`
                .toLocaleLowerCase("sr")
                .includes(query.toLocaleLowerCase("sr"))),
        )
        .sort((a, b) =>
          sort === "retries"
            ? b.retryCount - a.retryCount
            : b.lastAttemptAt.localeCompare(a.lastAttemptAt),
        ),
    [records, status, query, sort],
  );
  const allVisibleSelected =
    filtered.length > 0 &&
    filtered.every((record) => selectedIds.includes(record.id));

  useEffect(() => {
    setSelectedIds([]);
  }, [query, sort, status]);

  function retryRecords(ids: string[]) {
    const attemptedAt = new Date().toISOString();
    records
      .filter((record) => ids.includes(record.id))
      .forEach((record) => {
        updateBizniSoftRecord(record.id, {
          status: "čeka",
          retryCount: record.retryCount + 1,
          lastAttemptAt: attemptedAt,
        });
        logEvent({
          action: "Ponovljena BizniSoft sinhronizacija",
          module: "BizniSoft",
          entityType: record.entityType,
          entityId: record.entityId,
          entityLabel: record.entityLabel,
          severity: record.status === "greška" ? "warning" : "info",
          reason: "Zapis je ponovo dodat u zajednički mock red",
          before: { status: record.status, pokušaji: record.retryCount },
          after: { status: "čeka", pokušaji: record.retryCount + 1 },
        });
      });
    notify(
      "Ponovljena mock sinhronizacija",
      `${ids.length} ${ids.length === 1 ? "zapis je dodat" : "zapisa su dodata"} u red i broj pokušaja je ažuriran.`,
    );
    setSelectedIds([]);
  }

  function resolve(record: BizniSoftSyncRecord, source: "local" | "remote") {
    updateBizniSoftRecord(record.id, {
      status: "sinhronizovano",
      remoteValue: source === "local" ? record.localValue : record.remoteValue,
      issue: undefined,
    });
    logEvent({
      action: "Rešen BizniSoft konflikt",
      module: "BizniSoft",
      entityType: record.entityType,
      entityId: record.entityId,
      entityLabel: record.entityLabel,
      severity: "info",
      reason: `${source === "local" ? "Portal" : "BizniSoft"} je izabran kao izvor istine`,
      before: { status: record.status, vrednost: record.localValue },
      after: {
        status: "sinhronizovano",
        vrednost:
          source === "local"
            ? record.localValue
            : (record.remoteValue ?? "nema vrednosti"),
      },
    });
    setSelected(null);
    notify(
      "Razlika je mock rešena",
      `${source === "local" ? "Lokalni" : "BizniSoft"} podatak je izabran kao izvor istine.`,
    );
  }

  function syncQueuedRecords() {
    const queued = records.filter((record) => record.status === "čeka");
    if (!queued.length) {
      notify(
        "Mock red je prazan",
        "Nema zapisa sa statusom „čeka“ za obradu.",
        "warning",
      );
      return;
    }
    queued.forEach((record) =>
      updateBizniSoftRecord(record.id, {
        status: "sinhronizovano",
        remoteValue: record.localValue,
        issue: undefined,
        lastAttemptAt: new Date().toISOString(),
      }),
    );
    logEvent({
      action: "Završen BizniSoft mock ciklus",
      module: "BizniSoft",
      entityType: "Sinhronizacija",
      entityId: `biz-sync-${Date.now()}`,
      entityLabel: `${queued.length} ${queued.length === 1 ? "zapis" : "zapisa"}`,
      severity: "info",
      reason: "Svi zapisi iz trenutnog mock reda su obrađeni jednom akcijom",
      before: { status: "čeka", brojZapisa: queued.length },
      after: { status: "sinhronizovano", brojZapisa: queued.length },
    });
    notify(
      "Mock sinhronizacija je završena",
      `${queued.length} ${queued.length === 1 ? "zapis je usklađen" : "zapisa su usklađena"}.`,
    );
  }
  return (
    <AccessGuard permission="integrations:biznisoft">
      <PageHeader
        eyebrow="ERP integracioni centar"
        title="BizniSoft"
        description="Red za sinhronizaciju, neusaglašeni podaci i mapiranje poslovnih šifara."
        actions={
          <>
            <Badge tone="success" dot>
              Veza dostupna · mock
            </Badge>
            <PortalButton icon="sync" onClick={syncQueuedRecords}>
              Pokreni mock sinhronizaciju
            </PortalButton>
          </>
        }
      />
      <ModuleState>
        <div className="portal-integration-status">
          <div>
            <span className="portal-integration-logo">
              <PortalIcon name="sync" />
            </span>
            <div>
              <span>Status veze</span>
              <strong>Mock adapter je spreman</strong>
              <small>
                Poslednja sinhronizacija danas u 10:14 · trajanje 18 sekundi
              </small>
            </div>
          </div>
          <div>
            <span>Uspešno</span>
            <strong>1.284</strong>
          </div>
          <div>
            <span>Čeka slanje</span>
            <strong>7</strong>
          </div>
          <div data-alert>
            <span>Greške</span>
            <strong>
              {records.filter((record) => record.status === "greška").length}
            </strong>
          </div>
          <div>
            <span>Neusaglašeno</span>
            <strong>
              {
                records.filter((record) => record.status === "neusaglašeno")
                  .length
              }
            </strong>
          </div>
        </div>
        <div className="portal-grid" data-layout="wide-left">
          <Panel>
            <div className="portal-table-toolbar">
              <div className="portal-table-toolbar-main">
                <label className="portal-search-field">
                  <PortalIcon name="search" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Entitet, šifra ili problem"
                  />
                </label>
                <select
                  className="portal-filter-select"
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  aria-label="Status sinhronizacije"
                >
                  <option value="svi">Svi statusi</option>
                  <option>čeka</option>
                  <option>sinhronizovano</option>
                  <option>greška</option>
                  <option>neusaglašeno</option>
                </select>
              </div>
              <div className="portal-table-toolbar-actions">
                <select
                  className="portal-filter-select"
                  value={sort}
                  onChange={(event) =>
                    setSort(event.target.value as typeof sort)
                  }
                  aria-label="Sortiranje sinhronizacije"
                >
                  <option value="attempt">Poslednji pokušaj</option>
                  <option value="retries">Najviše pokušaja</option>
                </select>
                {query || status !== "svi" ? (
                  <PortalButton
                    variant="ghost"
                    icon="close"
                    onClick={() => {
                      setQuery("");
                      setStatus("svi");
                    }}
                  >
                    Resetuj
                  </PortalButton>
                ) : null}
              </div>
            </div>
            {query || status !== "svi" ? (
              <div className="portal-active-filters">
                <span className="portal-filter-chip">
                  {filtered.length} zapisa
                </span>
                {status !== "svi" ? (
                  <span className="portal-filter-chip">Status: {status}</span>
                ) : null}
              </div>
            ) : null}
            <BulkToolbar
              selectedCount={selectedIds.length}
              itemLabel={
                selectedIds.length === 1 ? "zapis izabran" : "zapisa izabrano"
              }
              scopeLabel="Ponovni pokušaj važi samo za zapise u trenutnom prikazu; izbor se resetuje pri promeni filtera."
              onClear={() => setSelectedIds([])}
            >
              <PortalButton
                variant="primary"
                icon="sync"
                onClick={() => retryRecords(selectedIds)}
              >
                Ponovi izabrane
              </PortalButton>
            </BulkToolbar>
            <div className="portal-table-wrap">
              <table className="portal-table">
                <thead>
                  <tr>
                    <th>
                      <SelectionCheckbox
                        checked={allVisibleSelected}
                        mixed={selectedIds.length > 0 && !allVisibleSelected}
                        onChange={() =>
                          setSelectedIds(
                            allVisibleSelected
                              ? []
                              : filtered.map((record) => record.id),
                          )
                        }
                        label="Izaberi sve BizniSoft zapise u trenutnom prikazu"
                      />
                    </th>
                    <th>Entitet</th>
                    <th>Lokalni zapis</th>
                    <th>Status</th>
                    <th>Problem</th>
                    <th>Lokalna vrednost</th>
                    <th>BizniSoft vrednost</th>
                    <th>Poslednji pokušaj</th>
                    <th>Pokušaji</th>
                    <th>Akcije</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((record) => (
                    <tr
                      key={record.id}
                      data-selected={selectedIds.includes(record.id)}
                    >
                      <td>
                        <SelectionCheckbox
                          checked={selectedIds.includes(record.id)}
                          onChange={() =>
                            setSelectedIds((current) =>
                              current.includes(record.id)
                                ? current.filter((id) => id !== record.id)
                                : [...current, record.id],
                            )
                          }
                          label={`Izaberi ${record.entityLabel}`}
                        />
                      </td>
                      <td>
                        <Badge>{record.entityType}</Badge>
                      </td>
                      <td>
                        <strong>{record.entityLabel}</strong>
                        <small>{record.entityId}</small>
                      </td>
                      <td>
                        <Badge tone={statusTone(record.status)}>
                          {record.status}
                        </Badge>
                      </td>
                      <td>{record.issue ?? "Bez problema"}</td>
                      <td>{record.localValue}</td>
                      <td>{record.remoteValue ?? "nije dostupno"}</td>
                      <td>{formatDate(record.lastAttemptAt, true)}</td>
                      <td>{record.retryCount}</td>
                      <td>
                        <div className="portal-table-actions">
                          <button
                            className="portal-icon-button"
                            aria-label={`Uporedi ${record.entityLabel}`}
                            onClick={() => setSelected(record)}
                          >
                            <PortalIcon name="eye" />
                          </button>
                          <button
                            type="button"
                            className="portal-icon-button"
                            aria-label={`Ponovi ${record.entityLabel}`}
                            onClick={() => retryRecords([record.id])}
                          >
                            <PortalIcon name="sync" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!filtered.length ? (
              <div className="portal-inline-empty portal-inline-empty-large">
                <PortalIcon name="search" />
                Nema BizniSoft zapisa za aktivne filtere.
              </div>
            ) : null}
          </Panel>
          <aside className="portal-stack">
            <Panel>
              <SectionHeader title="Nepovezani podaci" />
              <div className="portal-detail-list">
                <div>
                  <span>Kupci bez šifre</span>
                  <strong>
                    {
                      customers.filter((customer) => !customer.bizniSoftCode)
                        .length
                    }
                  </strong>
                  <PortalButton
                    onClick={() => {
                      setStatus("svi");
                      setQuery("Kupac nije povezan");
                    }}
                  >
                    Mapiraj kupce
                  </PortalButton>
                </div>
                <div>
                  <span>Proizvodi bez šifre</span>
                  <strong>
                    {
                      products.filter((product) => !product.bizniSoftCode)
                        .length
                    }
                  </strong>
                  <PortalButton
                    onClick={() => {
                      setStatus("svi");
                      setQuery("Nedostaje BizniSoft šifra");
                    }}
                  >
                    Mapiraj proizvode
                  </PortalButton>
                </div>
                <div>
                  <span>Porudžbine čekaju slanje</span>
                  <strong>
                    {
                      orders.filter((order) => order.bizniSoftStatus === "čeka")
                        .length
                    }
                  </strong>
                  <PortalButton
                    onClick={() => {
                      setQuery("");
                      setStatus("čeka");
                    }}
                  >
                    Pregledaj red
                  </PortalButton>
                </div>
              </div>
            </Panel>
            <Panel>
              <SectionHeader title="Poslednji sync log" />
              <div className="portal-sync-log">
                <span>
                  <b data-tone="success" />
                  10:14:18 · završen ciklus
                </span>
                <span>
                  <b data-tone="success" />
                  10:14:12 · 28 proizvoda usklađeno
                </span>
                <span>
                  <b data-tone="danger" />
                  10:14:08 · 2 greške mapiranja
                </span>
                <span>
                  <b data-tone="warning" />
                  10:14:04 · 2 razlike cena
                </span>
                <span>
                  <b data-tone="success" />
                  10:14:00 · veza uspostavljena
                </span>
              </div>
            </Panel>
          </aside>
        </div>
      </ModuleState>
      {selected ? (
        <CompareDialog
          record={selected}
          onClose={() => setSelected(null)}
          onResolve={resolve}
        />
      ) : null}
    </AccessGuard>
  );
}

function CompareDialog({
  record,
  onClose,
  onResolve,
}: {
  record: BizniSoftSyncRecord;
  onClose: () => void;
  onResolve: (record: BizniSoftSyncRecord, source: "local" | "remote") => void;
}) {
  const [truth, setTruth] = useState<"local" | "remote">("local");
  useDialogDismiss(onClose);
  return (
    <div
      className="portal-modal-layer"
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <div className="portal-compare-dialog">
        <header>
          <div>
            <span>Poređenje podataka</span>
            <h2>{record.entityLabel}</h2>
            <p>{record.issue ?? "Pregled sinhronizovanog zapisa"}</p>
          </div>
          <button className="portal-icon-button" onClick={onClose}>
            <PortalIcon name="close" />
          </button>
        </header>
        <div className="portal-compare-grid">
          <button
            data-selected={truth === "local"}
            onClick={() => setTruth("local")}
          >
            <span>
              <Badge tone="info">Lokalni portal</Badge>
              <i>{truth === "local" ? <PortalIcon name="check" /> : null}</i>
            </span>
            <strong>{record.localValue}</strong>
            <small>Izmenjeno danas u 09:58</small>
          </button>
          <div>
            <PortalIcon name="arrow" />
            <span>razlika</span>
          </div>
          <button
            data-selected={truth === "remote"}
            onClick={() => setTruth("remote")}
          >
            <span>
              <Badge>BizniSoft</Badge>
              <i>{truth === "remote" ? <PortalIcon name="check" /> : null}</i>
            </span>
            <strong>{record.remoteValue ?? "Podatak nije dostupan"}</strong>
            <small>
              Poslednji pokušaj {formatDate(record.lastAttemptAt, true)}
            </small>
          </button>
        </div>
        <div className="portal-compare-note">
          <PortalIcon name="warning" />
          <p>
            Izabrana strana bi u produkciji postala izvor istine. U prototipu se
            menja samo frontend state.
          </p>
        </div>
        <footer>
          <PortalButton onClick={onClose}>Odustani</PortalButton>
          <PortalButton
            variant="primary"
            icon="check"
            onClick={() => onResolve(record, truth)}
          >
            Primeni izbor i označi rešeno
          </PortalButton>
        </footer>
      </div>
    </div>
  );
}
