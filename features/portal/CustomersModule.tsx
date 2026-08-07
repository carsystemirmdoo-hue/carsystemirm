"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { customers, portalUsers } from "@/mock-data/portal";
import { can, canAccessCustomer } from "@/permissions/portal-permissions";
import type { Customer, PriceRule } from "@/types/portal";
import { PortalIcon } from "@/components/portal/PortalIcon";
import { usePortal } from "@/components/portal/PortalProvider";
import {
  Badge,
  BulkToolbar,
  Delta,
  formatCurrency,
  formatDate,
  Metric,
  ModuleState,
  PageHeader,
  Panel,
  PortalButton,
  PortalLinkButton,
  SectionHeader,
  SelectionCheckbox,
  StateView,
  statusTone,
  TinyBars,
} from "@/components/portal/PortalPrimitives";

function ruleTargetsCustomer(rule: PriceRule, customer: Customer) {
  const { target } = rule;
  return (
    (!target.customerIds?.length || target.customerIds.includes(customer.id)) &&
    (!target.customerSegments?.length ||
      target.customerSegments.includes(customer.segment)) &&
    (!target.salesRepIds?.length ||
      target.salesRepIds.includes(customer.salesRepId)) &&
    (!target.cities?.length || target.cities.includes(customer.city)) &&
    (!target.regions?.length || target.regions.includes(customer.region))
  );
}

export function CustomersList() {
  const { role, user, notify, addTask } = usePortal();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("svi");
  const [salesRep, setSalesRep] = useState("svi");
  const [region, setRegion] = useState("svi");
  const [riskOnly, setRiskOnly] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [sort, setSort] = useState<"name" | "revenue" | "activity">("name");
  const visibleCustomers = useMemo(
    () =>
      customers
        .filter((customer) => {
          if (role === "sales" && customer.salesRepId !== user.id) return false;
          if (status !== "svi" && customer.status !== status) return false;
          if (salesRep !== "svi" && customer.salesRepId !== salesRep)
            return false;
          if (region !== "svi" && customer.region !== region) return false;
          if (riskOnly && customer.internal.risk !== "visok") return false;
          const value = query.trim().toLocaleLowerCase("sr");
          return (
            !value ||
            [
              customer.companyName,
              customer.legalName,
              customer.pib,
              customer.code,
              customer.city,
              customer.contacts[0]?.phone,
            ].some((field) => field?.toLocaleLowerCase("sr").includes(value))
          );
        })
        .sort((a, b) =>
          sort === "revenue"
            ? b.financial.revenue365d - a.financial.revenue365d
            : sort === "activity"
              ? a.sales.daysSinceLastOrder - b.sales.daysSinceLastOrder
              : a.companyName.localeCompare(b.companyName, "sr"),
        ),
    [role, user.id, status, salesRep, region, riskOnly, query, sort],
  );
  const activeFilters = [
    status !== "svi",
    salesRep !== "svi",
    region !== "svi",
    riskOnly,
    Boolean(query),
  ].filter(Boolean).length;
  const allVisibleSelected =
    visibleCustomers.length > 0 &&
    visibleCustomers.every((customer) => selected.includes(customer.id));

  useEffect(() => {
    setSelected([]);
  }, [query, region, riskOnly, salesRep, sort, status]);

  return (
    <>
      <PageHeader
        eyebrow="CRM i prodajni portfolio"
        title="Kupci"
        description={`${visibleCustomers.length} kupaca u trenutnom prikazu · Customer 360 profil dostupan klikom na naziv`}
        actions={
          <PortalButton
            icon="plus"
            variant="primary"
            disabled
            title="Dodavanje kupca nije implementirano u frontend prototipu."
          >
            Dodaj kupca · mock
          </PortalButton>
        }
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
                  placeholder="Naziv, PIB, šifra, grad ili telefon"
                />
              </label>
              <select
                className="portal-filter-select"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                aria-label="Status kupca"
              >
                <option value="svi">Svi statusi</option>
                <option>aktivan</option>
                <option>nov</option>
                <option>u padu</option>
                <option>blokiran</option>
                <option>neaktivan</option>
              </select>
              {role !== "sales" ? (
                <select
                  className="portal-filter-select"
                  value={salesRep}
                  onChange={(event) => setSalesRep(event.target.value)}
                  aria-label="Komercijalista"
                >
                  <option value="svi">Svi komercijalisti</option>
                  {portalUsers
                    .filter((item) => item.role === "sales")
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                </select>
              ) : null}
              <select
                className="portal-filter-select"
                value={region}
                onChange={(event) => setRegion(event.target.value)}
                aria-label="Region"
              >
                <option value="svi">Svi regioni</option>
                {Array.from(
                  new Set(customers.map((customer) => customer.region)),
                ).map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
              <label className="portal-check-filter">
                <input
                  type="checkbox"
                  checked={riskOnly}
                  onChange={(event) => setRiskOnly(event.target.checked)}
                />
                Rizični kupci
              </label>
            </div>
            <div className="portal-table-toolbar-actions">
              <select
                className="portal-filter-select"
                value={sort}
                onChange={(event) => setSort(event.target.value as typeof sort)}
                aria-label="Sortiranje kupaca"
              >
                <option value="name">Naziv A–Š</option>
                <option value="revenue">Najveći promet</option>
                <option value="activity">Najskorija porudžbina</option>
              </select>
              {activeFilters ? (
                <PortalButton
                  variant="ghost"
                  icon="close"
                  onClick={() => {
                    setQuery("");
                    setStatus("svi");
                    setSalesRep("svi");
                    setRegion("svi");
                    setRiskOnly(false);
                  }}
                >
                  Resetuj {activeFilters}
                </PortalButton>
              ) : null}
            </div>
          </div>
          {activeFilters ? (
            <div className="portal-active-filters">
              {query ? (
                <span className="portal-filter-chip">Pretraga: {query}</span>
              ) : null}
              {status !== "svi" ? (
                <span className="portal-filter-chip">Status: {status}</span>
              ) : null}
              {salesRep !== "svi" ? (
                <span className="portal-filter-chip">
                  Komercijalista:{" "}
                  {portalUsers.find((item) => item.id === salesRep)?.name}
                </span>
              ) : null}
              {region !== "svi" ? (
                <span className="portal-filter-chip">Region: {region}</span>
              ) : null}
              {riskOnly ? (
                <span className="portal-filter-chip">
                  Visok rizik
                  <button
                    aria-label="Ukloni filter visokog rizika"
                    onClick={() => setRiskOnly(false)}
                  >
                    <PortalIcon name="close" />
                  </button>
                </span>
              ) : null}
            </div>
          ) : null}
          <BulkToolbar
            selectedCount={selected.length}
            itemLabel={
              selected.length === 1 ? "kupac izabran" : "kupaca izabrano"
            }
            scopeLabel="Akcija važi samo za kupce u trenutnom prikazu; izbor se resetuje pri promeni filtera."
            onClear={() => setSelected([])}
          >
            <PortalButton
              variant="primary"
              onClick={() => {
                selected.forEach((customerId) => {
                  const customer = visibleCustomers.find(
                    (item) => item.id === customerId,
                  );
                  if (!customer) return;
                  addTask({
                    id: `task-contact-${customer.id}`,
                    title: `Kontaktirati ${customer.companyName}`,
                    dueAt: "2026-08-05T12:00:00",
                    assigneeId: customer.salesRepId || user.id,
                    customerId: customer.id,
                    priority: "srednja",
                    completed: false,
                  });
                });
                notify(
                  "Zadaci su dodati",
                  `${selected.length} kupaca je dodato u zajedničke mock zadatke.`,
                );
                setSelected([]);
              }}
            >
              Dodaj zadatak
            </PortalButton>
          </BulkToolbar>
          <div className="portal-table-wrap">
            <table className="portal-table portal-customers-table">
              <thead>
                <tr>
                  <th>
                    <SelectionCheckbox
                      checked={allVisibleSelected}
                      mixed={selected.length > 0 && !allVisibleSelected}
                      onChange={() =>
                        setSelected(
                          allVisibleSelected
                            ? []
                            : visibleCustomers.map((customer) => customer.id),
                        )
                      }
                      label="Izaberi sve kupce u trenutnom prikazu"
                    />
                  </th>
                  <th className="portal-sticky-cell">Kupac</th>
                  <th>Šifra</th>
                  <th>Grad</th>
                  <th>PIB</th>
                  <th>Komercijalista</th>
                  <th>Segment</th>
                  <th>Status</th>
                  <th>Promet YTD</th>
                  <th>Poslednja porudžbina</th>
                  <th>Bez porudžbine</th>
                  {can(role, "customers:view_financials") ? (
                    <>
                      <th>Dugovanje</th>
                      <th>Kreditni limit</th>
                      <th>Kašnjenje</th>
                      <th>Marža</th>
                    </>
                  ) : null}
                  <th>Trend</th>
                  <th>Akcije</th>
                </tr>
              </thead>
              <tbody>
                {visibleCustomers.map((customer) => (
                  <tr
                    key={customer.id}
                    data-selected={selected.includes(customer.id)}
                  >
                    <td>
                      <SelectionCheckbox
                        checked={selected.includes(customer.id)}
                        onChange={() =>
                          setSelected((current) =>
                            current.includes(customer.id)
                              ? current.filter((id) => id !== customer.id)
                              : [...current, customer.id],
                          )
                        }
                        label={`Izaberi ${customer.companyName}`}
                      />
                    </td>
                    <td className="portal-sticky-cell">
                      <Link
                        className="portal-table-link"
                        href={`/portal/kupci/${customer.id}`}
                      >
                        {customer.companyName}
                      </Link>
                      <small>{customer.legalName}</small>
                    </td>
                    <td className="portal-technical">{customer.code}</td>
                    <td>{customer.city}</td>
                    <td className="portal-technical">{customer.pib}</td>
                    <td>{customer.salesRepName}</td>
                    <td>
                      <Badge>{customer.segment}</Badge>
                    </td>
                    <td>
                      <Badge tone={statusTone(customer.status)}>
                        {customer.status}
                      </Badge>
                    </td>
                    <td className="portal-table-number">
                      {formatCurrency(customer.financial.revenue365d)}
                    </td>
                    <td>{formatDate(customer.sales.lastOrderAt)}</td>
                    <td>
                      <Badge
                        tone={
                          customer.sales.daysSinceLastOrder > 45
                            ? "warning"
                            : "neutral"
                        }
                      >
                        {customer.sales.daysSinceLastOrder} dana
                      </Badge>
                    </td>
                    {can(role, "customers:view_financials") ? (
                      <>
                        <td className="portal-table-number">
                          <span
                            className={
                              customer.financial.debt >
                              customer.financial.creditLimit
                                ? "portal-danger-text"
                                : ""
                            }
                          >
                            {formatCurrency(customer.financial.debt)}
                          </span>
                        </td>
                        <td className="portal-table-number">
                          {formatCurrency(customer.financial.creditLimit)}
                        </td>
                        <td>{customer.financial.averageDelayDays} dana</td>
                        <td>{customer.financial.averageMargin}%</td>
                      </>
                    ) : null}
                    <td>
                      <div className="portal-trend-cell">
                        <Delta value={customer.sales.trendPercent} />
                        <TinyBars
                          values={[
                            7,
                            9,
                            8,
                            12,
                            11,
                            Math.max(2, 10 + customer.sales.trendPercent / 5),
                          ]}
                          tone={
                            customer.sales.trendPercent < 0
                              ? "accent"
                              : "success"
                          }
                        />
                      </div>
                    </td>
                    <td>
                      <div className="portal-table-actions">
                        <Link
                          href={`/portal/kupci/${customer.id}`}
                          className="portal-icon-button"
                          aria-label={`Otvori ${customer.companyName}`}
                        >
                          <PortalIcon name="eye" />
                        </Link>
                        <Link
                          href={`/portal/porudzbine/nova?customer=${customer.id}`}
                          className="portal-icon-button"
                          aria-label={`Nova porudžbina za ${customer.companyName}`}
                        >
                          <PortalIcon name="plus" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!visibleCustomers.length ? (
            <div className="portal-inline-empty portal-inline-empty-large">
              <PortalIcon name="search" />
              Nema kupaca za aktivne filtere.
            </div>
          ) : null}
          <footer className="portal-pagination">
            <span>
              Prikazano {visibleCustomers.length} kupaca · mock skup je
              ograničen na jednu stranu
            </span>
            <div>
              <button disabled>Prethodna</button>
              <button data-active="true">1</button>
              <button disabled>Sledeća</button>
            </div>
          </footer>
        </Panel>
      </ModuleState>
    </>
  );
}

type CustomerTab =
  | "pregled"
  | "kontakti"
  | "uslovi"
  | "finansije"
  | "prodaja"
  | "operativa"
  | "aktivnosti"
  | "interno";

export function CustomerDetail({ customerId }: { customerId: string }) {
  const { role, user, orders } = usePortal();
  const [tab, setTab] = useState<CustomerTab>("pregled");
  const customer = customers.find((item) => item.id === customerId);
  if (!customer)
    return (
      <Panel>
        <StateView
          state="empty"
          title="Kupac nije pronađen"
          description="Proverite internu šifru ili se vratite na listu kupaca."
          action={
            <PortalLinkButton href="/portal/kupci">
              Nazad na kupce
            </PortalLinkButton>
          }
        />
      </Panel>
    );
  if (!canAccessCustomer(role, user.id, customer.salesRepId))
    return (
      <StateView
        state="permission"
        title="Kupac nije u vašem portfoliju"
        description="Komercijalista može da vidi samo kupce koji su mu dodeljeni."
      />
    );
  const financialAllowed = can(role, "customers:view_financials");
  const internalAllowed = can(role, "customers:view_confidential");
  const tabs: Array<[CustomerTab, string]> = [
    ["pregled", "Pregled"],
    ["kontakti", "Kontakti i adrese"],
    ["uslovi", "Komercijalni uslovi"],
    ...(financialAllowed
      ? [["finansije", "Finansije"] as [CustomerTab, string]]
      : []),
    ["prodaja", "Prodaja"],
    ["operativa", "Operativa"],
    ["aktivnosti", "Aktivnosti"],
    ...(internalAllowed
      ? [["interno", "Interna procena"] as [CustomerTab, string]]
      : []),
  ];
  const customerOrders = orders.filter(
    (order) => order.customerId === customer.id,
  );

  return (
    <>
      <div className="portal-customer-hero">
        <div className="portal-customer-identity">
          <span>
            {customer.companyName
              .split(" ")
              .map((word) => word[0])
              .slice(0, 2)
              .join("")}
          </span>
          <div>
            <div className="portal-cluster">
              <h1>{customer.companyName}</h1>
              <Badge tone={statusTone(customer.status)} dot>
                {customer.status}
              </Badge>
              <Badge>{customer.segment}</Badge>
            </div>
            <p>
              {customer.code} · PIB {customer.pib} · {customer.city} ·{" "}
              {customer.salesRepName}
            </p>
          </div>
        </div>
        <div className="portal-page-actions">
          <PortalLinkButton
            href={`/portal/cene/pravila?customer=${customer.id}`}
            icon={role === "sales" ? "approval" : "prices"}
          >
            {role === "sales" ? "Predloži cenu" : "Posebna cena"}
          </PortalLinkButton>
          <PortalLinkButton
            href={`/portal/porudzbine/nova?customer=${customer.id}`}
            icon="plus"
            variant="primary"
          >
            Nova porudžbina
          </PortalLinkButton>
        </div>
      </div>
      <div className="portal-customer-signal">
        {financialAllowed ? (
          <div>
            <span>Promet 365 dana</span>
            <strong>{formatCurrency(customer.financial.revenue365d)}</strong>
            <Delta value={customer.sales.trendPercent} />
          </div>
        ) : (
          <div>
            <span>Trend aktivnosti</span>
            <strong>
              {customer.sales.trendPercent > 0 ? "rast" : "zahteva pažnju"}
            </strong>
            <Delta value={customer.sales.trendPercent} />
          </div>
        )}
        <div>
          <span>Poslednja porudžbina</span>
          <strong>{customer.sales.daysSinceLastOrder} dana</strong>
          <small>{formatDate(customer.sales.lastOrderAt)}</small>
        </div>
        <div>
          <span>Otvorene porudžbine</span>
          <strong>{customer.openOrders}</strong>
          <small>{customerOrders.length} ukupno u mock-u</small>
        </div>
        {financialAllowed ? (
          <>
            <div
              data-alert={
                customer.financial.debt > customer.financial.creditLimit
              }
            >
              <span>Dugovanje</span>
              <strong>{formatCurrency(customer.financial.debt)}</strong>
              <small>
                {formatCurrency(customer.financial.overdueDebt)} dospelo
              </small>
            </div>
            <div>
              <span>Prosečna marža</span>
              <strong>{customer.financial.averageMargin}%</strong>
              <small>minimum {customer.internal.minimumMargin}%</small>
            </div>
          </>
        ) : (
          <div>
            <span>Status uslova</span>
            <strong>{customer.priceList}</strong>
            <small>Rok {customer.paymentTermDays} dana</small>
          </div>
        )}
      </div>
      <div className="portal-tabs portal-customer-tabs">
        {tabs.map(([id, label]) => (
          <button key={id} data-active={tab === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      <ModuleState>
        {tab === "pregled" ? (
          <CustomerOverview customerId={customer.id} />
        ) : null}
        {tab === "kontakti" ? (
          <CustomerContacts customerId={customer.id} />
        ) : null}
        {tab === "uslovi" ? <CustomerTerms customerId={customer.id} /> : null}
        {tab === "finansije" && financialAllowed ? (
          <CustomerFinancials customerId={customer.id} />
        ) : null}
        {tab === "prodaja" ? <CustomerSales customerId={customer.id} /> : null}
        {tab === "operativa" ? (
          <CustomerOperations customerId={customer.id} />
        ) : null}
        {tab === "aktivnosti" ? (
          <CustomerActivities customerId={customer.id} />
        ) : null}
        {tab === "interno" && internalAllowed ? (
          <CustomerInternal customerId={customer.id} />
        ) : null}
      </ModuleState>
    </>
  );
}

function DetailGrid({ rows }: { rows: Array<[string, React.ReactNode]> }) {
  return (
    <dl className="portal-definition-grid">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value || "Nije uneto"}</dd>
        </div>
      ))}
    </dl>
  );
}

function CustomerOverview({ customerId }: { customerId: string }) {
  const { orders, notify, role, user, tasks, addTask, priceRules } =
    usePortal();
  const pricingAllowed = can(role, "prices:view");
  const customer = customers.find((item) => item.id === customerId)!;
  const opportunityTaskId = `task-opportunity-${customer.id}`;
  const opportunityTaskExists = tasks.some(
    (task) => task.id === opportunityTaskId,
  );
  const activeCustomerRules = priceRules.filter(
    (rule) => rule.status === "aktivno" && ruleTargetsCustomer(rule, customer),
  );
  const recentOrders = orders
    .filter((order) => order.customerId === customer.id)
    .slice(0, 5);
  return (
    <div
      className="portal-grid portal-customer-tab-content"
      data-layout="wide-left"
    >
      <div className="portal-stack">
        <Panel>
          <SectionHeader
            title="Osnovni podaci"
            action={
              <PortalButton
                icon="edit"
                disabled
                title="Izmena osnovnih podataka nije implementirana u frontend prototipu."
              >
                Izmeni · mock
              </PortalButton>
            }
          />
          <DetailGrid
            rows={[
              ["Pravni naziv", customer.legalName],
              ["Interna šifra", customer.code],
              ["BizniSoft šifra", customer.bizniSoftCode],
              ["PIB", customer.pib],
              ["Matični broj", customer.registrationNumber],
              ["PDV status", customer.vatStatus],
              ["Pravna forma", customer.legalForm],
              ["Delatnost", customer.industry],
              ["Početak saradnje", formatDate(customer.cooperationSince)],
              ["Veličina kupca", customer.size],
              ["Region", customer.region],
              ["Izvor kupca", customer.source],
            ]}
          />
        </Panel>
        <Panel>
          <SectionHeader
            title="Nedavne porudžbine"
            action={
              <Link href="/portal/porudzbine" className="portal-text-link">
                Sve porudžbine
              </Link>
            }
          />
          <div className="portal-table-wrap">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Broj</th>
                  <th>Datum</th>
                  <th>Vrednost</th>
                  <th>Status</th>
                  <th>Izvor</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <Link
                        className="portal-table-link portal-technical"
                        href={`/portal/porudzbine/${order.id}`}
                      >
                        {order.number}
                      </Link>
                    </td>
                    <td>{formatDate(order.createdAt)}</td>
                    <td className="portal-table-number">
                      {formatCurrency(order.total)}
                    </td>
                    <td>
                      <Badge tone={statusTone(order.status)}>
                        {order.status}
                      </Badge>
                    </td>
                    <td>{order.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!recentOrders.length ? (
            <div className="portal-inline-empty">
              Kupac još nema porudžbine.
            </div>
          ) : null}
        </Panel>
      </div>
      <aside className="portal-stack">
        <Panel>
          <SectionHeader title="Sledeća prilika" />
          <div className="portal-opportunity">
            <PortalIcon name="spark" />
            <strong>{customer.sales.nextOpportunity}</strong>
            <p>
              Potencijal: {customer.sales.potential} · procenjeni udeo novčanika{" "}
              {customer.sales.shareOfWallet}%
            </p>
            <PortalButton
              disabled={opportunityTaskExists}
              title={
                opportunityTaskExists
                  ? "Zadatak je već dodat u zajedničko mock stanje."
                  : undefined
              }
              onClick={() => {
                addTask({
                  id: opportunityTaskId,
                  title: customer.sales.nextOpportunity,
                  dueAt: "2026-08-05T10:00:00",
                  assigneeId: customer.salesRepId || user.id,
                  customerId: customer.id,
                  priority: "srednja",
                  completed: false,
                });
                notify(
                  "Zadatak je dodat",
                  "Sledeća prilika je upisana u zajedničko mock stanje.",
                );
              }}
            >
              {opportunityTaskExists ? "Zadatak dodat" : "Dodaj zadatak"}
            </PortalButton>
          </div>
        </Panel>
        {pricingAllowed ? (
          <Panel>
            <SectionHeader title="Komercijalni signal" />
            <div className="portal-detail-list">
              <div>
                <span>Cenovnik</span>
                <strong>{customer.priceList}</strong>
              </div>
              <div>
                <span>Osnovni rabat</span>
                <strong>{customer.baseDiscount}%</strong>
              </div>
              <div>
                <span>Rok plaćanja</span>
                <strong>{customer.paymentTermDays} dana</strong>
              </div>
              <div>
                <span>Posebni uslovi</span>
                <strong>
                  {activeCustomerRules[0]?.name ??
                    customer.specialTerms ??
                    "Nema aktivnih"}
                </strong>
                <small>
                  {activeCustomerRules[0]?.validTo
                    ? `Ističu ${formatDate(activeCustomerRules[0].validTo)}`
                    : customer.specialTermsExpiresAt
                      ? `Ističu ${formatDate(customer.specialTermsExpiresAt)}`
                      : ""}
                </small>
              </div>
            </div>
          </Panel>
        ) : null}
        <Panel>
          <SectionHeader title="Status podataka" />
          <div className="portal-detail-list">
            <div>
              <span>BizniSoft</span>
              <Badge tone={statusTone(customer.bizniSoftSyncStatus)}>
                {customer.bizniSoftSyncStatus}
              </Badge>
            </div>
            <div>
              <span>BEX podaci</span>
              <Badge tone={statusTone(customer.bexDataStatus)}>
                {customer.bexDataStatus}
              </Badge>
            </div>
            <div>
              <span>Adrese</span>
              <strong>{customer.addresses.length} evidentirano</strong>
            </div>
            <div>
              <span>Kontakti</span>
              <strong>{customer.contacts.length} evidentirano</strong>
            </div>
          </div>
        </Panel>
      </aside>
    </div>
  );
}

function CustomerContacts({ customerId }: { customerId: string }) {
  const customer = customers.find((item) => item.id === customerId)!;
  return (
    <div className="portal-grid portal-customer-tab-content" data-columns="2">
      <Panel>
        <SectionHeader
          title="Kontakti"
          action={
            <PortalButton
              icon="plus"
              disabled
              title="Dodavanje kontakta nije implementirano u frontend prototipu."
            >
              Dodaj kontakt · mock
            </PortalButton>
          }
        />
        <div className="portal-contact-list">
          {customer.contacts.map((contact) => (
            <article key={contact.id}>
              <span>
                {contact.name
                  .split(" ")
                  .map((word) => word[0])
                  .join("")}
              </span>
              <div>
                <strong>{contact.name}</strong>
                <small>{contact.role}</small>
                <a href={`tel:${contact.phone}`}>
                  <PortalIcon name="phone" />
                  {contact.phone}
                </a>
                <a href={`mailto:${contact.email}`}>
                  <PortalIcon name="mail" />
                  {contact.email}
                </a>
                <p>
                  {contact.preferredChannel} · {contact.contactWindow}
                </p>
              </div>
              <PortalButton
                variant="ghost"
                icon="edit"
                disabled
                title="Izmena kontakta nije implementirana u frontend prototipu."
              >
                Izmeni · mock
              </PortalButton>
            </article>
          ))}
        </div>
      </Panel>
      <Panel>
        <SectionHeader
          title="Adrese"
          action={
            <PortalButton
              icon="plus"
              disabled
              title="Dodavanje adrese nije implementirano u frontend prototipu."
            >
              Dodaj adresu · mock
            </PortalButton>
          }
        />
        <div className="portal-address-list">
          {customer.addresses.map((address) => (
            <article key={address.id}>
              <div>
                <span>
                  <PortalIcon name="location" />
                  {address.type}
                </span>
                <Badge tone={address.complete ? "success" : "warning"}>
                  {address.complete ? "potpuna" : "nepotpuna"}
                </Badge>
              </div>
              <strong>
                {address.street}, {address.postalCode} {address.city}
              </strong>
              <small>
                {address.contactName} · {address.phone}
              </small>
              <p>
                {address.receivingHours} · {address.access}
              </p>
              {address.deliveryNote ? <em>{address.deliveryNote}</em> : null}
            </article>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function CustomerTerms({ customerId }: { customerId: string }) {
  const { approvals, priceRules, role } = usePortal();
  const customer = customers.find((item) => item.id === customerId)!;
  const financialAllowed = can(role, "customers:view_financials");
  const pricingAllowed = can(role, "prices:view");
  const marginAllowed = can(role, "prices:view_margin");
  const approved = approvals.filter(
    (approval) =>
      approval.customerId === customer.id &&
      approval.status === "odobreno" &&
      approval.productName,
  );
  const customerRules = priceRules.filter(
    (rule) => rule.status === "aktivno" && ruleTargetsCustomer(rule, customer),
  );
  return (
    <div
      className="portal-grid portal-customer-tab-content"
      data-layout="wide-left"
    >
      <div className="portal-stack">
        <Panel>
          <SectionHeader
            title="Komercijalni uslovi"
            action={
              <PortalLinkButton icon="edit" href="/portal/cene/pravila">
                Predloži izmenu
              </PortalLinkButton>
            }
          />
          <DetailGrid
            rows={[
              ["Cenovnik", customer.priceList],
              ...(pricingAllowed
                ? ([["Osnovni rabat", `${customer.baseDiscount}%`]] as Array<
                    [string, React.ReactNode]
                  >)
                : []),
              ["Valuta", "RSD"],
              ["Rok plaćanja", `${customer.paymentTermDays} dana`],
              ["Način plaćanja", customer.paymentMethod],
              ...(financialAllowed
                ? ([
                    [
                      "Kreditni limit",
                      formatCurrency(customer.financial.creditLimit),
                    ],
                  ] as Array<[string, React.ReactNode]>)
                : []),
              ...(pricingAllowed
                ? ([
                    ["Rabat", `${Math.max(2, customer.baseDiscount - 6)}%`],
                  ] as Array<[string, React.ReactNode]>)
                : []),
              [
                "Bonus dogovor",
                customer.segment === "ključni"
                  ? "Kvartalni bonus po realizaciji"
                  : "Nema",
              ],
              ["Besplatna dostava", customer.freeDelivery ? "Da" : "Ne"],
              [
                "Minimalna porudžbina",
                formatCurrency(customer.minimumOrderValue),
              ],
              ["Individualni dogovor", customer.specialTerms],
              [
                "Važi do",
                customer.specialTermsExpiresAt
                  ? formatDate(customer.specialTermsExpiresAt)
                  : "Bez roka",
              ],
            ]}
          />
        </Panel>
        {pricingAllowed ? (
          <Panel>
            <SectionHeader
              title="Odobrene posebne cene"
              description="Povezano sa approval tokom"
            />
            <div className="portal-detail-list">
              {approved.map((approval) => (
                <div key={approval.id}>
                  <span>{approval.productName}</span>
                  <strong>
                    {approval.proposedPrice
                      ? formatCurrency(approval.proposedPrice)
                      : approval.proposedValue}
                  </strong>
                  <small>
                    {marginAllowed && approval.proposedMargin !== undefined
                      ? `Odobrena marža ${approval.proposedMargin}%`
                      : "Odobrena posebna cena"}
                  </small>
                </div>
              ))}
              {customerRules.map((rule) => (
                <div key={rule.id}>
                  <span>{rule.name}</span>
                  <strong>
                    {rule.type === "fixed"
                      ? formatCurrency(rule.value)
                      : `${rule.value}%`}
                  </strong>
                  <small>
                    {rule.reason} · prioritet {rule.priority} · {rule.status}
                  </small>
                </div>
              ))}
              {!approved.length && !customerRules.length ? (
                <div>
                  <span>Status</span>
                  <strong>Nema odobrenih posebnih cena</strong>
                </div>
              ) : null}
            </div>
          </Panel>
        ) : null}
      </div>
      {pricingAllowed ? (
        <Panel>
          <SectionHeader title="Prioritet aktivne cene" />
          <div className="portal-priority-list">
            {[
              "Individualna cena za proizvod",
              "Individualna cena za grupu",
              "Cena proizvođača",
              "Pravilo segmenta",
              "Promotivna cena",
              "Količinski rabat",
              "Opšti cenovnik",
              "Kataloška cena",
            ].map((item, index) => (
              <div key={item} data-active={index === 0 && approved.length > 0}>
                <span>{index + 1}</span>
                <strong>{item}</strong>
                {index === 0 && approved.length > 0 ? (
                  <Badge tone="success">odobrena cena pobeđuje</Badge>
                ) : null}
              </div>
            ))}
          </div>
        </Panel>
      ) : (
        <Panel>
          <StateView
            state="permission"
            title="Cenovni detalji nisu dostupni"
            description="Sekretarica vidi operativne uslove, ali ne i pravila posebnih cena ili marže."
          />
        </Panel>
      )}
    </div>
  );
}

function CustomerFinancials({ customerId }: { customerId: string }) {
  const customer = customers.find((item) => item.id === customerId)!;
  const f = customer.financial;
  return (
    <div className="portal-customer-tab-content">
      <div className="portal-metrics">
        <Metric
          label="Ukupno dugovanje"
          value={formatCurrency(f.debt)}
          tone={f.debt > f.creditLimit ? "danger" : "neutral"}
        />
        <Metric
          label="Dospelo"
          value={formatCurrency(f.overdueDebt)}
          context={`najstarije ${f.oldestDebtDays} dana`}
          tone="danger"
        />
        <Metric
          label="Prosečno kašnjenje"
          value={`${f.averageDelayDays} dana`}
          context={`maksimalno ${f.maxDelayDays} dana`}
          tone="warning"
        />
        <Metric
          label="Profitabilnost"
          value={`${f.profitability}%`}
          context={`${formatCurrency(f.estimatedNetValue)} neto vrednost`}
          tone="success"
        />
      </div>
      <div className="portal-grid" data-columns="2">
        <Panel>
          <SectionHeader title="Promet i marža" />
          <DetailGrid
            rows={[
              ["Promet 30 dana", formatCurrency(f.revenue30d)],
              ["Promet 90 dana", formatCurrency(f.revenue90d)],
              ["Promet 365 dana", formatCurrency(f.revenue365d)],
              ["Prethodna godina", formatCurrency(f.previousYearRevenue)],
              ["Bruto marža", formatCurrency(f.grossMargin)],
              ["Prosečna marža", `${f.averageMargin}%`],
              ["Trošak dostave", formatCurrency(f.deliveryCost)],
              ["Prosečna porudžbina", formatCurrency(f.averageOrderValue)],
            ]}
          />
        </Panel>
        <Panel>
          <SectionHeader title="Kreditna izloženost" />
          <div className="portal-credit-visual">
            <div>
              <strong>
                {Math.round((f.creditUsed / f.creditLimit) * 100)}%
              </strong>
              <span>iskorišćenja limita</span>
            </div>
            <div
              className="portal-progress"
              data-tone={f.creditUsed > f.creditLimit ? "warning" : "success"}
            >
              <span
                style={{
                  width: `${Math.min(100, (f.creditUsed / f.creditLimit) * 100)}%`,
                }}
              />
            </div>
            <dl>
              <div>
                <dt>Limit</dt>
                <dd>{formatCurrency(f.creditLimit)}</dd>
              </div>
              <div>
                <dt>Iskorišćeno</dt>
                <dd>{formatCurrency(f.creditUsed)}</dd>
              </div>
              <div>
                <dt>Raspoloživo</dt>
                <dd>
                  {formatCurrency(Math.max(0, f.creditLimit - f.creditUsed))}
                </dd>
              </div>
            </dl>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function CustomerSales({ customerId }: { customerId: string }) {
  const customer = customers.find((item) => item.id === customerId)!;
  const s = customer.sales;
  return (
    <div
      className="portal-grid portal-customer-tab-content"
      data-layout="wide-left"
    >
      <Panel>
        <SectionHeader title="Prodajni parametri" />
        <DetailGrid
          rows={[
            ["Broj porudžbina", s.orderCount],
            ["Prosečan razmak", `${s.averageOrderGapDays} dana`],
            ["Omiljeni proizvođači", s.favoriteManufacturers.join(", ")],
            ["Omiljene grupe", s.favoriteGroups.join(", ")],
            ["Najčešći proizvodi", s.topProducts.join(", ")],
            ["Više ne kupuje", s.lostProducts.join(", ")],
            ["Procenjeni potencijal", s.potential],
            ["Share of wallet", `${s.shareOfWallet}%`],
            ["Sledeća prilika", s.nextOpportunity],
            ["Razlog pada", s.declineReason],
          ]}
        />
      </Panel>
      <Panel>
        <SectionHeader title="Trend prodaje" />
        <div className="portal-sales-trend-large">
          <TinyBars
            values={[
              32,
              41,
              38,
              52,
              49,
              58,
              61,
              57,
              66,
              70,
              62,
              Math.max(20, 60 + s.trendPercent),
            ]}
            tone={s.trendPercent < 0 ? "accent" : "success"}
          />
          <strong>
            <Delta value={s.trendPercent} /> u odnosu na prethodni period
          </strong>
          <p>
            Procena se zasniva na mock prometu, frekvenciji porudžbina i
            izgubljenim proizvodima.
          </p>
        </div>
      </Panel>
    </div>
  );
}

function CustomerOperations({ customerId }: { customerId: string }) {
  const customer = customers.find((item) => item.id === customerId)!;
  return (
    <div className="portal-grid portal-customer-tab-content" data-columns="2">
      <Panel>
        <SectionHeader title="Operativni parametri" />
        <DetailGrid
          rows={[
            ["Otvorene porudžbine", customer.openOrders],
            ["Kašnjenja isporuke", customer.openOrders > 2 ? 2 : 0],
            ["Reklamacije", customer.complaints],
            ["Povrati", customer.returns],
            ["Prosečno vreme obrade", `${customer.averageProcessingHours} h`],
            ["Preferirana isporuka", customer.preferredDelivery],
            ["Preferirani BEX servis", "Standard · SMS najava"],
            [
              "Problemi sa adresom",
              customer.bexDataStatus === "usklađeno" ? "Retko" : "Često",
            ],
            [
              "BizniSoft status",
              <Badge key="bs" tone={statusTone(customer.bizniSoftSyncStatus)}>
                {customer.bizniSoftSyncStatus}
              </Badge>,
            ],
            [
              "BEX status",
              <Badge key="bex" tone={statusTone(customer.bexDataStatus)}>
                {customer.bexDataStatus}
              </Badge>,
            ],
          ]}
        />
      </Panel>
      <Panel>
        <SectionHeader title="Kontrolna lista podataka" />
        <div className="portal-check-list">
          {[
            ["PIB i pravni podaci", Boolean(customer.pib)],
            ["BizniSoft šifra", Boolean(customer.bizniSoftCode)],
            ["Telefon na adresi", Boolean(customer.addresses[0]?.phone)],
            ["Poštanski broj", Boolean(customer.addresses[0]?.postalCode)],
            ["Primalac robe", Boolean(customer.addresses[0]?.contactName)],
            ["Komercijalni uslovi", Boolean(customer.priceList)],
          ].map(([label, complete]) => (
            <div key={String(label)} data-complete={complete}>
              <span>
                <PortalIcon name={complete ? "check" : "warning"} />
              </span>
              <strong>{label}</strong>
              <Badge tone={complete ? "success" : "warning"}>
                {complete ? "potpuno" : "dopuniti"}
              </Badge>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function CustomerActivities({ customerId }: { customerId: string }) {
  const { auditEvents, orders } = usePortal();
  const customer = customers.find((item) => item.id === customerId)!;
  const orderIds = new Set(
    orders
      .filter((order) => order.customerId === customer.id)
      .map((order) => order.id),
  );
  const events = auditEvents.filter(
    (event) => event.entityId === customer.id || orderIds.has(event.entityId),
  );
  return (
    <Panel className="portal-customer-tab-content">
      <SectionHeader
        title="Sve aktivnosti kupca"
        description="Samo događaji povezani sa kupcem ili njegovim porudžbinama"
      />
      <div className="portal-activity-timeline">
        {events.slice(0, 20).map((event, index) => (
          <div key={event.id}>
            <span>
              <PortalIcon
                name={
                  index % 4 === 0
                    ? "phone"
                    : index % 4 === 1
                      ? "orders"
                      : index % 4 === 2
                        ? "prices"
                        : "activity"
                }
              />
            </span>
            <div>
              <strong>{event.action}</strong>
              <p>{event.reason}</p>
              <small>
                {event.userName} · {formatDate(event.occurredAt, true)}
              </small>
            </div>
          </div>
        ))}
        {!events.length ? (
          <div className="portal-inline-empty">
            Još nema povezanih aktivnosti.
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

function CustomerInternal({ customerId }: { customerId: string }) {
  const customer = customers.find((item) => item.id === customerId)!;
  const i = customer.internal;
  return (
    <div
      className="portal-grid portal-customer-tab-content"
      data-layout="wide-left"
    >
      <Panel>
        <SectionHeader
          title="Poverljiva interna procena"
          description="Vidljivo samo gazdi"
          action={
            <PortalButton
              icon="edit"
              disabled
              title="Izmena interne procene nije implementirana u frontend prototipu."
            >
              Izmeni procenu · mock
            </PortalButton>
          }
        />
        <DetailGrid
          rows={[
            ["Interna kategorija", i.category],
            ["Strateški značaj", i.strategicImportance],
            [
              "Procena rizika",
              <Badge key="risk" tone={statusTone(i.risk)}>
                {i.risk}
              </Badge>,
            ],
            ["Pouzdanost plaćanja", `${i.paymentReliability}/100`],
            ["Pregovaračka težina", `${i.negotiationWeight}/100`],
            ["Potencijal rasta", `${i.growthPotential}/100`],
            ["Verovatnoća odlaska", `${i.churnProbability}%`],
            ["Cenovna osetljivost", `${i.priceSensitivity}/100`],
            ["Kvalitet odnosa", `${i.relationshipQuality}/100`],
            ["Maksimalna izloženost", formatCurrency(i.recommendedExposure)],
            ["Minimalna marža", `${i.minimumMargin}%`],
          ]}
        />
      </Panel>
      <aside className="portal-stack">
        {i.warning ? (
          <Panel accent="warning">
            <SectionHeader title="Interno upozorenje" />
            <div className="portal-confidential-note">
              <PortalIcon name="warning" />
              <p>{i.warning}</p>
            </div>
          </Panel>
        ) : null}
        <Panel>
          <SectionHeader title="Poverljiva beleška" />
          <div className="portal-confidential-note">
            <PortalIcon name="lock" />
            <p>{i.confidentialNote ?? "Nema poverljive beleške."}</p>
          </div>
        </Panel>
      </aside>
    </div>
  );
}
