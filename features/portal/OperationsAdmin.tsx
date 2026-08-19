"use client";

import { useMemo, useState } from "react";
import { customers, portalUsers } from "@/fixtures/dev/portal";
import {
  can,
  ROLE_LABELS,
  rolePermissions,
} from "@/permissions/portal-permissions";
import type { ApprovalRequest, AuditEvent, UserRole } from "@/types/portal";
import { PortalIcon } from "@/components/portal/PortalIcon";
import { usePortal } from "@/components/portal/PortalProvider";
import {
  Badge,
  formatCurrency,
  formatDate,
  Metric,
  ModuleState,
  PageHeader,
  Panel,
  PortalButton,
  SectionHeader,
  StateView,
  statusTone,
  useDialogDismiss,
} from "@/components/portal/PortalPrimitives";

export function ApprovalsInbox() {
  const { role, notify, approvals, decideApproval } = usePortal();
  const [status, setStatus] = useState("čeka");
  const [type, setType] = useState<ApprovalRequest["type"] | "svi">("svi");
  const [requester, setRequester] = useState("svi");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"priority" | "newest">("priority");
  const [selectedId, setSelectedId] = useState(approvals[0]?.id ?? "");
  const [comment, setComment] = useState("");
  const filtered = useMemo(
    () =>
      approvals
        .filter((approval) => {
          if (status !== "svi" && approval.status !== status) return false;
          if (type !== "svi" && approval.type !== type) return false;
          if (requester !== "svi" && approval.requestedBy !== requester)
            return false;
          const value = query.trim().toLocaleLowerCase("sr");
          return (
            !value ||
            [
              approval.customerName,
              approval.requestedBy,
              approval.reason,
              approval.type,
            ].some((field) => field.toLocaleLowerCase("sr").includes(value))
          );
        })
        .sort((a, b) => {
          if (sort === "newest")
            return b.requestedAt.localeCompare(a.requestedAt);
          const riskOrder = { visok: 3, srednji: 2, nizak: 1 };
          return (
            riskOrder[b.risk] - riskOrder[a.risk] ||
            b.requestedAt.localeCompare(a.requestedAt)
          );
        }),
    [approvals, query, requester, sort, status, type],
  );
  const activeFilterCount = [
    status !== "svi",
    type !== "svi",
    requester !== "svi",
    Boolean(query),
  ].filter(Boolean).length;
  const selected =
    filtered.find((approval) => approval.id === selectedId) ??
    filtered[0] ??
    null;
  const selectedCustomer = selected
    ? customers.find((customer) => customer.id === selected.customerId)
    : undefined;

  if (!can(role, "approvals:view"))
    return (
      <StateView
        state="permission"
        title="Odobrenja su dostupna samo gazdi"
        description="Komercijalista može da pošalje zahtev, ali odluku donosi ovlašćena uloga."
      />
    );

  function decide(id: string, nextStatus: ApprovalRequest["status"]) {
    if (nextStatus !== "odobreno" && !comment.trim()) {
      notify(
        "Komentar je obavezan",
        "Dodajte razlog odbijanja ili instrukciju za doradu.",
        "warning",
      );
      return;
    }
    decideApproval(id, nextStatus, comment);
    setComment("");
    notify(
      nextStatus === "odobreno"
        ? "Zahtev je odobren"
        : nextStatus === "odbijeno"
          ? "Zahtev je odbijen"
          : "Zahtev je vraćen na doradu",
      nextStatus === "odobreno"
        ? "Cena i audit trag su ažurirani u zajedničkom mock stanju."
        : "Odluka je upisana u zajednički mock audit log.",
      nextStatus === "odobreno" ? "success" : "warning",
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Kontrola izuzetaka"
        title="Odobrenja"
        description="Centralni inbox za cene, limite, plaćanja, povrate i promene odgovornih osoba."
      />
      <ModuleState>
        <div className="portal-metrics">
          <Metric
            label="Čeka odluku"
            value={String(
              approvals.filter((approval) => approval.status === "čeka").length,
            )}
            context="aktivni mock zahtevi"
            tone="warning"
            icon="clock"
          />
          <Metric
            label="Visok rizik"
            value={String(
              approvals.filter(
                (approval) =>
                  approval.risk === "visok" && approval.status === "čeka",
              ).length,
            )}
            context="zahteva detaljan pregled"
            tone="danger"
            icon="warning"
          />
          <Metric
            label="Odobreno"
            value={String(
              approvals.filter((approval) => approval.status === "odobreno")
                .length,
            )}
            context="u trenutnom mock stanju"
            tone="success"
            icon="check"
          />
          <Metric
            label="Finansijski efekat"
            value={formatCurrency(
              approvals.reduce(
                (sum, approval) => sum + approval.financialEffect,
                0,
              ),
            )}
            context="otvoreni i rešeni zahtevi"
            icon="prices"
          />
        </div>
        <div
          className="portal-grid portal-approval-layout"
          data-layout="wide-left"
        >
          <Panel>
            <div className="portal-table-toolbar">
              <div className="portal-table-toolbar-main">
                <label className="portal-search-field">
                  <PortalIcon name="search" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Kupac, podnosilac, tip ili razlog"
                  />
                </label>
                <select
                  className="portal-filter-select"
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  aria-label="Status zahteva"
                >
                  <option value="svi">Svi statusi</option>
                  <option value="čeka">Čeka odluku</option>
                  <option value="dorada">Vraćeno na doradu</option>
                  <option value="odobreno">Odobreno</option>
                  <option value="odbijeno">Odbijeno</option>
                </select>
                <select
                  className="portal-filter-select"
                  value={type}
                  onChange={(event) =>
                    setType(event.target.value as typeof type)
                  }
                  aria-label="Tip zahteva"
                >
                  <option value="svi">Svi tipovi zahteva</option>
                  {Array.from(
                    new Set(approvals.map((approval) => approval.type)),
                  ).map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <select
                  className="portal-filter-select"
                  value={requester}
                  onChange={(event) => setRequester(event.target.value)}
                  aria-label="Podnosilac zahteva"
                >
                  <option value="svi">Svi podnosioci</option>
                  {Array.from(
                    new Set(approvals.map((approval) => approval.requestedBy)),
                  ).map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div className="portal-table-toolbar-actions">
                <select
                  className="portal-filter-select"
                  value={sort}
                  onChange={(event) =>
                    setSort(event.target.value as typeof sort)
                  }
                  aria-label="Sortiranje zahteva"
                >
                  <option value="priority">Najviši rizik prvo</option>
                  <option value="newest">Najnoviji prvo</option>
                </select>
                {activeFilterCount ? (
                  <PortalButton
                    variant="ghost"
                    icon="close"
                    onClick={() => {
                      setStatus("svi");
                      setType("svi");
                      setRequester("svi");
                      setQuery("");
                    }}
                  >
                    Resetuj {activeFilterCount}
                  </PortalButton>
                ) : null}
              </div>
            </div>
            <div className="portal-active-filters">
              <span className="portal-filter-chip">
                {filtered.length} rezultata · odluke su pojedinačne zbog
                različitog rizika
              </span>
            </div>
            <div className="portal-approval-list">
              {filtered.map((approval) => (
                <button
                  key={approval.id}
                  data-selected={selected?.id === approval.id}
                  onClick={() => setSelectedId(approval.id)}
                >
                  <span className="portal-approval-type">
                    <PortalIcon
                      name={
                        approval.type.includes("cena") ||
                        approval.type.includes("rabat")
                          ? "prices"
                          : approval.type.includes("limit")
                            ? "chart"
                            : "approval"
                      }
                    />
                  </span>
                  <span>
                    <small>{approval.type}</small>
                    <strong>{approval.customerName}</strong>
                    <p>{approval.reason}</p>
                    <em>
                      {approval.requestedBy} ·{" "}
                      {formatDate(approval.requestedAt, true)}
                    </em>
                  </span>
                  <span>
                    <Badge tone={statusTone(approval.status)}>
                      {approval.status}
                    </Badge>
                    <Badge
                      tone={
                        approval.risk === "visok"
                          ? "danger"
                          : approval.risk === "srednji"
                            ? "warning"
                            : "success"
                      }
                    >
                      rizik: {approval.risk}
                    </Badge>
                    <strong data-negative={approval.financialEffect < 0}>
                      {approval.financialEffect > 0 ? "+" : ""}
                      {formatCurrency(approval.financialEffect)}
                    </strong>
                  </span>
                </button>
              ))}
              {!filtered.length ? (
                <div className="portal-inline-empty portal-inline-empty-large">
                  <PortalIcon name="approval" />
                  Nema zahteva u ovom statusu.
                </div>
              ) : null}
            </div>
          </Panel>
          {selected ? (
            <aside className="portal-approval-detail">
              <Panel>
                <SectionHeader
                  title="Pregled zahteva"
                  description={selected.id}
                />
                <div className="portal-approval-detail-head">
                  <Badge>{selected.type}</Badge>
                  <h2>{selected.customerName}</h2>
                  <p>{selected.reason}</p>
                </div>
                <div className="portal-approval-compare">
                  <div>
                    <span>Trenutno</span>
                    <strong>{selected.currentValue}</strong>
                  </div>
                  <PortalIcon name="arrow" />
                  <div>
                    <span>Predlog</span>
                    <strong>{selected.proposedValue}</strong>
                  </div>
                </div>
                <div className="portal-detail-list">
                  <div>
                    <span>Podnosilac</span>
                    <strong>{selected.requestedBy}</strong>
                  </div>
                  {selected.productName ? (
                    <div>
                      <span>Proizvod</span>
                      <strong>{selected.productName}</strong>
                    </div>
                  ) : null}
                  {selected.proposedMargin !== undefined ? (
                    <div>
                      <span>Predložena marža</span>
                      <Badge
                        tone={
                          selected.proposedMargin <
                          (selectedCustomer?.internal.minimumMargin ?? 18)
                            ? "danger"
                            : "success"
                        }
                      >
                        {selected.proposedMargin}%
                      </Badge>
                    </div>
                  ) : null}
                  <div>
                    <span>Finansijski efekat</span>
                    <strong
                      className={
                        selected.financialEffect < 0 ? "portal-danger-text" : ""
                      }
                    >
                      {formatCurrency(selected.financialEffect)}
                    </strong>
                  </div>
                  <div>
                    <span>Procena rizika</span>
                    <Badge
                      tone={
                        selected.risk === "visok"
                          ? "danger"
                          : selected.risk === "srednji"
                            ? "warning"
                            : "success"
                      }
                    >
                      {selected.risk}
                    </Badge>
                  </div>
                  <div>
                    <span>Status</span>
                    <Badge tone={statusTone(selected.status)}>
                      {selected.status}
                    </Badge>
                  </div>
                </div>
                {selectedCustomer ? (
                  <div className="portal-approval-context">
                    <strong>Kontekst odluke</strong>
                    <p>
                      Kupac ima promet od{" "}
                      {formatCurrency(selectedCustomer.financial.revenue90d)} u
                      poslednjih 90 dana, prosečnu maržu{" "}
                      {selectedCustomer.financial.averageMargin}% i{" "}
                      {formatCurrency(selectedCustomer.financial.overdueDebt)}{" "}
                      dospelog dugovanja.
                    </p>
                  </div>
                ) : null}
                <label className="portal-field portal-approval-comment">
                  <span>Komentar odluke</span>
                  <textarea
                    value={comment}
                    disabled={
                      selected.status === "odobreno" ||
                      selected.status === "odbijeno"
                    }
                    onChange={(event) => setComment(event.target.value)}
                    placeholder="Dodajte obrazloženje…"
                  />
                </label>
                <div className="portal-approval-actions">
                  <PortalButton
                    variant="danger"
                    disabled={
                      selected.status === "odobreno" ||
                      selected.status === "odbijeno"
                    }
                    onClick={() => decide(selected.id, "odbijeno")}
                  >
                    Odbij
                  </PortalButton>
                  <PortalButton
                    disabled={
                      selected.status === "odobreno" ||
                      selected.status === "odbijeno"
                    }
                    onClick={() => decide(selected.id, "dorada")}
                  >
                    Vrati na doradu
                  </PortalButton>
                  <PortalButton
                    variant="primary"
                    icon="check"
                    disabled={
                      selected.status === "odobreno" ||
                      selected.status === "odbijeno"
                    }
                    onClick={() => decide(selected.id, "odobreno")}
                  >
                    Odobri
                  </PortalButton>
                </div>
              </Panel>
            </aside>
          ) : null}
        </div>
      </ModuleState>
    </>
  );
}

export function ActivityLog() {
  const { role, auditEvents } = usePortal();
  const [selected, setSelected] = useState<AuditEvent | null>(null);
  const [module, setModule] = useState("svi");
  const [userName, setUserName] = useState("svi");
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [query, setQuery] = useState("");
  if (!can(role, "audit:view"))
    return (
      <StateView
        state="permission"
        title="Audit log nije dostupan ovoj ulozi"
      />
    );
  const events = auditEvents.filter(
    (event) =>
      (module === "svi" || event.module === module) &&
      (userName === "svi" || event.userName === userName) &&
      (!criticalOnly || event.severity === "critical") &&
      (!query ||
        `${event.action} ${event.entityLabel} ${event.userName}`
          .toLocaleLowerCase("sr")
          .includes(query.toLocaleLowerCase("sr"))),
  );
  const hasFilters = Boolean(
    query || module !== "svi" || userName !== "svi" || criticalOnly,
  );
  return (
    <>
      <PageHeader
        eyebrow="Sistemski trag"
        title="Aktivnosti"
        description="Centralni audit log promena cena, porudžbina, kupaca i integracija."
      />
      <ModuleState>
        <Panel>
          <div className="portal-table-toolbar">
            <div className="portal-table-toolbar-main">
              <label className="portal-search-field">
                <PortalIcon name="search" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Akcija, korisnik ili entitet"
                />
              </label>
              <select
                className="portal-filter-select"
                value={module}
                onChange={(event) => setModule(event.target.value)}
                aria-label="Modul"
              >
                <option value="svi">Svi moduli</option>
                {Array.from(
                  new Set(auditEvents.map((event) => event.module)),
                ).map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
              <select
                className="portal-filter-select"
                value={userName}
                onChange={(event) => setUserName(event.target.value)}
                aria-label="Korisnik"
              >
                <option value="svi">Svi korisnici</option>
                {Array.from(
                  new Set(auditEvents.map((event) => event.userName)),
                ).map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
              <label className="portal-check-filter">
                <input
                  type="checkbox"
                  checked={criticalOnly}
                  onChange={(event) => setCriticalOnly(event.target.checked)}
                />
                Samo kritične
              </label>
            </div>
            <div className="portal-cluster">
              {hasFilters ? (
                <PortalButton
                  variant="ghost"
                  icon="close"
                  onClick={() => {
                    setQuery("");
                    setModule("svi");
                    setUserName("svi");
                    setCriticalOnly(false);
                  }}
                >
                  Resetuj
                </PortalButton>
              ) : null}
              <PortalButton
                icon="download"
                disabled
                title="Izvoz audita nije implementiran u frontend prototipu."
              >
                Izvezi audit · mock
              </PortalButton>
            </div>
          </div>
          {hasFilters ? (
            <div className="portal-active-filters">
              <span className="portal-filter-chip">
                {events.length} događaja
              </span>
              {module !== "svi" ? (
                <span className="portal-filter-chip">Modul: {module}</span>
              ) : null}
              {criticalOnly ? (
                <span className="portal-filter-chip">Samo kritične</span>
              ) : null}
            </div>
          ) : null}
          <div className="portal-activity-feed">
            {events.map((event) => (
              <button key={event.id} onClick={() => setSelected(event)}>
                <span
                  className="portal-list-marker"
                  data-tone={
                    event.severity === "critical"
                      ? "danger"
                      : event.severity === "warning"
                        ? "warning"
                        : "neutral"
                  }
                >
                  <PortalIcon
                    name={
                      event.severity === "critical" ? "warning" : "activity"
                    }
                  />
                </span>
                <span>
                  <div>
                    <strong>{event.action}</strong>
                    <Badge
                      tone={
                        event.severity === "critical"
                          ? "danger"
                          : event.severity === "warning"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {event.module}
                    </Badge>
                  </div>
                  <p>
                    {event.entityType}: {event.entityLabel}
                  </p>
                  <small>{event.reason}</small>
                </span>
                <span>
                  <strong>{event.userName}</strong>
                  <small>{ROLE_LABELS[event.role]}</small>
                </span>
                <time>{formatDate(event.occurredAt, true)}</time>
                <PortalIcon name="chevron" />
              </button>
            ))}
          </div>
          {!events.length ? (
            <div className="portal-inline-empty portal-inline-empty-large">
              <PortalIcon name="search" />
              Nema audit događaja za aktivne filtere.
            </div>
          ) : null}
          <footer className="portal-pagination">
            <span>{events.length} događaja u prikazu</span>
            <div>
              <button disabled>Prethodna</button>
              <button data-active="true">1</button>
              <button disabled>Sledeća</button>
            </div>
          </footer>
        </Panel>
      </ModuleState>
      {selected ? (
        <AuditDrawer event={selected} onClose={() => setSelected(null)} />
      ) : null}
    </>
  );
}

function AuditDrawer({
  event,
  onClose,
}: {
  event: AuditEvent;
  onClose: () => void;
}) {
  useDialogDismiss(onClose);
  return (
    <div
      className="portal-drawer-layer"
      role="dialog"
      aria-modal="true"
      onMouseDown={(click) => {
        if (click.currentTarget === click.target) onClose();
      }}
    >
      <aside className="portal-drawer portal-audit-drawer">
        <header>
          <div>
            <span>Audit događaj · {event.id}</span>
            <h2>{event.action}</h2>
            <p>
              {formatDate(event.occurredAt, true)} · {event.module}
            </p>
          </div>
          <button className="portal-icon-button" onClick={onClose}>
            <PortalIcon name="close" />
          </button>
        </header>
        <div className="portal-drawer-scroll">
          <div className="portal-audit-summary">
            <span className="portal-avatar">
              {event.userName
                .split(" ")
                .map((word) => word[0])
                .join("")}
            </span>
            <div>
              <strong>{event.userName}</strong>
              <small>
                {ROLE_LABELS[event.role]} · {event.action}
              </small>
            </div>
            <Badge
              tone={
                event.severity === "critical"
                  ? "danger"
                  : event.severity === "warning"
                    ? "warning"
                    : "neutral"
              }
            >
              {event.severity}
            </Badge>
          </div>
          <div className="portal-detail-list">
            <div>
              <span>Entitet</span>
              <strong>
                {event.entityType} · {event.entityLabel}
              </strong>
            </div>
            <div>
              <span>Interni ID</span>
              <strong className="portal-technical">{event.entityId}</strong>
            </div>
            <div>
              <span>Razlog</span>
              <strong>{event.reason}</strong>
            </div>
          </div>
          <div className="portal-audit-diff">
            <SectionHeader
              title="Pre i posle"
              description="Promenjena polja su jasno izdvojena"
            />
            {Object.keys({ ...event.before, ...event.after }).map((key) => (
              <div key={key}>
                <strong>{key}</strong>
                <span>
                  <small>Pre</small>
                  <code>{String(event.before[key] ?? "nije postojalo")}</code>
                </span>
                <PortalIcon name="arrow" />
                <span>
                  <small>Posle</small>
                  <code>{String(event.after[key] ?? "obrisano")}</code>
                </span>
              </div>
            ))}
          </div>
          <div className="portal-audit-technical">
            <SectionHeader title="Tehnički kontekst" />
            <code>{`{\n  "eventId": "${event.id}",\n  "actorRole": "${event.role}",\n  "source": "frontend-mock",\n  "persisted": false\n}`}</code>
          </div>
        </div>
        <footer>
          <PortalButton onClick={onClose}>Zatvori</PortalButton>
        </footer>
      </aside>
    </div>
  );
}

type SettingsTab =
  | "users"
  | "permissions"
  | "integrations"
  | "pricing"
  | "notifications";

export function PortalSettings() {
  const { role, notify } = usePortal();
  const [tab, setTab] = useState<SettingsTab>("users");
  if (!can(role, "settings:manage"))
    return (
      <StateView
        state="permission"
        title="Podešavanja su dostupna samo gazdi"
      />
    );
  return (
    <>
      <PageHeader
        eyebrow="Administracija"
        title="Podešavanja"
        description="Mock konfiguracija korisnika, dozvola, integracija i poslovnih pravila."
        actions={
          <PortalButton
            variant="primary"
            icon="check"
            onClick={() =>
              notify(
                "Podešavanja su mock sačuvana",
                "Promene će nestati nakon osvežavanja.",
              )
            }
          >
            Sačuvaj izmene
          </PortalButton>
        }
      />
      <div className="portal-settings-layout">
        <nav>
          {[
            ["users", "Korisnici", "customers"],
            ["permissions", "Role i dozvole", "lock"],
            ["integrations", "Integracije", "sync"],
            ["pricing", "Zaštita cena", "prices"],
            ["notifications", "Obaveštenja", "bell"],
          ].map(([id, label, icon]) => (
            <button
              key={id}
              data-active={tab === id}
              onClick={() => setTab(id as SettingsTab)}
            >
              <PortalIcon name={icon as "customers"} />
              {label}
            </button>
          ))}
        </nav>
        <Panel>
          {tab === "users" ? <SettingsUsers /> : null}
          {tab === "permissions" ? <SettingsPermissions /> : null}
          {tab === "integrations" ? <SettingsIntegrations /> : null}
          {tab === "pricing" ? <SettingsPricing /> : null}
          {tab === "notifications" ? <SettingsNotifications /> : null}
        </Panel>
      </div>
    </>
  );
}

function SettingsUsers() {
  return (
    <>
      <SectionHeader
        title="Korisnici portala"
        description="Nalozi su demonstracioni, bez prave autentifikacije"
        action={
          <PortalButton
            icon="plus"
            disabled
            title="Dodavanje korisnika nije implementirano u frontend prototipu."
          >
            Dodaj korisnika · mock
          </PortalButton>
        }
      />
      <div className="portal-table-wrap">
        <table className="portal-table">
          <thead>
            <tr>
              <th>Korisnik</th>
              <th>Email</th>
              <th>Rola</th>
              <th>Region</th>
              <th>Status</th>
              <th>Poslednja prijava</th>
              <th>Akcije</th>
            </tr>
          </thead>
          <tbody>
            {portalUsers.map((user, index) => (
              <tr key={user.id}>
                <td>
                  <div className="portal-rep-cell">
                    <span>{user.initials}</span>
                    <strong>{user.name}</strong>
                  </div>
                </td>
                <td>{user.email}</td>
                <td>
                  <Badge>{ROLE_LABELS[user.role]}</Badge>
                </td>
                <td>{user.region ?? "Cela firma"}</td>
                <td>
                  <Badge tone="success" dot>
                    aktivan
                  </Badge>
                </td>
                <td>{index ? "danas, 08:42" : "danas, 07:55"}</td>
                <td>
                  <button
                    className="portal-icon-button"
                    aria-label={`Izmeni ${user.name}`}
                    disabled
                    title="Izmena korisnika nije implementirana u frontend prototipu."
                  >
                    <PortalIcon name="edit" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function SettingsPermissions() {
  return (
    <>
      <SectionHeader
        title="Matrica dozvola"
        description="Centralizovana mock konfiguracija iz permissions sloja"
      />
      <div className="portal-permission-matrix">
        {(["owner", "sales", "office"] as UserRole[]).map((role) => (
          <section key={role}>
            <header>
              <strong>{ROLE_LABELS[role]}</strong>
              <Badge>{rolePermissions[role].length} dozvola</Badge>
            </header>
            <div>
              {rolePermissions[role].map((permission) => (
                <span key={permission}>
                  <PortalIcon name="check" />
                  {permission}
                </span>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

function SettingsIntegrations() {
  return (
    <>
      <SectionHeader
        title="Integracioni adapteri"
        description="Samo dizajn i mock status, bez pravih pristupnih podataka"
      />
      <div className="portal-settings-cards">
        <article>
          <span>
            <PortalIcon name="sync" />
          </span>
          <div>
            <strong>BizniSoft</strong>
            <small>Mock adapter · poslednja sinhronizacija 10:14</small>
          </div>
          <Badge tone="success" dot>
            spremno
          </Badge>
          <PortalButton
            disabled
            title="Podešavanje BizniSoft mapiranja nije implementirano u frontend prototipu."
          >
            Podesi mapiranje · mock
          </PortalButton>
        </article>
        <article>
          <span>
            <PortalIcon name="truck" />
          </span>
          <div>
            <strong>BEX kurirska služba</strong>
            <small>Mock adapter · validacija polja uključena</small>
          </div>
          <Badge tone="success" dot>
            spremno
          </Badge>
          <PortalButton
            disabled
            title="Podešavanje BEX usluga nije implementirano u frontend prototipu."
          >
            Podesi usluge · mock
          </PortalButton>
        </article>
      </div>
    </>
  );
}

function SettingsPricing() {
  return (
    <>
      <SectionHeader
        title="Globalna zaštita cena"
        description="Produkcijska pravila će se validirati na serveru"
      />
      <div className="portal-panel-body">
        <div className="portal-form-grid">
          <label className="portal-field">
            <span>Podrazumevana minimalna marža</span>
            <input type="number" defaultValue="18" />
            <small>Procenat ispod kojeg je promena blokirana</small>
          </label>
          <label className="portal-field">
            <span>Maksimalni rabat komercijaliste</span>
            <input type="number" defaultValue="12" />
          </label>
          <label className="portal-field">
            <span>Prag za obavezno odobrenje</span>
            <input type="number" defaultValue="500" />
            <small>Broj cenovnih kombinacija</small>
          </label>
          <label className="portal-field">
            <span>Podrazumevani rok posebne cene</span>
            <input type="number" defaultValue="90" />
            <small>Dana</small>
          </label>
        </div>
      </div>
    </>
  );
}

function SettingsNotifications() {
  return (
    <>
      <SectionHeader title="Pravila obaveštenja" />
      <div className="portal-settings-toggles">
        {[
          "Nova porudžbina",
          "Zahtev za odobrenje",
          "Kupac preko limita",
          "BEX greška",
          "BizniSoft greška",
          "Kupac nije naručivao 60 dana",
          "Dugovanje je dospelo",
          "Cena uskoro ističe",
          "Proizvod nije prepoznat",
        ].map((label, index) => (
          <label key={label}>
            <span>
              <strong>{label}</strong>
              <small>
                Portal obaveštenje{index < 4 ? " · email kasnije" : ""}
              </small>
            </span>
            <input type="checkbox" defaultChecked={index !== 8} />
          </label>
        ))}
      </div>
    </>
  );
}
