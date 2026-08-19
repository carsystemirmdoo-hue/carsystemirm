"use client";

import Link from "next/link";
import { customers, products } from "@/fixtures/dev/portal";
import {
  Badge,
  Delta,
  formatCurrency,
  formatDate,
  Metric,
  ModuleState,
  PageHeader,
  Panel,
  PortalLinkButton,
  SectionHeader,
  statusTone,
  TinyBars,
} from "@/components/portal/PortalPrimitives";
import { PortalIcon } from "@/components/portal/PortalIcon";
import { usePortal } from "@/components/portal/PortalProvider";

const revenueTrend = [
  62, 69, 64, 78, 82, 75, 91, 88, 97, 104, 99, 116, 121, 119,
];

function RevenueChart() {
  const points = revenueTrend
    .map(
      (value, index) =>
        `${(index / (revenueTrend.length - 1)) * 600},${170 - value}`,
    )
    .join(" ");
  const area = `0,170 ${points} 600,170`;
  return (
    <div className="portal-chart">
      <div className="portal-chart-legend">
        <span>
          <i />
          Promet, tekući mesec
        </span>
        <strong className="portal-technical">8.420.000 RSD</strong>
      </div>
      <svg
        className="portal-line-chart"
        viewBox="0 0 600 180"
        preserveAspectRatio="none"
        role="img"
        aria-label="Prodaja po danima"
      >
        <path className="grid" d="M0 30H600M0 75H600M0 120H600M0 165H600" />
        <polygon className="area" points={area} />
        <polyline className="line" points={points} />
        {revenueTrend.map((value, index) => (
          <circle
            className="dot"
            key={index}
            cx={(index / (revenueTrend.length - 1)) * 600}
            cy={170 - value}
            r="3"
          />
        ))}
      </svg>
      <div className="portal-chart-labels">
        <span>22. jul</span>
        <span>25. jul</span>
        <span>29. jul</span>
        <span>1. avg</span>
        <span>Danas</span>
      </div>
    </div>
  );
}

function AttentionList() {
  const items = [
    [
      "Kupci preko limita",
      "3 kupca · 1.420.000 RSD izloženosti",
      "danger",
      "/portal/kupci",
    ],
    [
      "Porudžbine bez kompletne adrese",
      "2 porudžbine čekaju kancelariju",
      "warning",
      "/portal/porudzbine",
    ],
    [
      "Proizvodi bez mapiranja",
      "4 šifre nisu povezane sa BizniSoftom",
      "warning",
      "/portal/biznissoft",
    ],
    [
      "BEX greške",
      "2 pošiljke nisu prošle validaciju",
      "danger",
      "/portal/bex",
    ],
    [
      "Kupci sa padom aktivnosti",
      "5 kupaca ispod očekivanog ritma",
      "info",
      "/portal/kupci",
    ],
  ] as const;
  return (
    <Panel>
      <SectionHeader
        title="Zahtevaju pažnju"
        description="Operativni izuzeci poređani po riziku"
        action={
          <Link className="portal-text-link" href="/portal/aktivnosti">
            Sve aktivnosti
          </Link>
        }
      />
      <div className="portal-list">
        {items.map(([title, description, tone, href]) => (
          <Link href={href} className="portal-list-item" key={title}>
            <span className="portal-list-marker" data-tone={tone}>
              <PortalIcon
                name={
                  tone === "danger"
                    ? "warning"
                    : tone === "info"
                      ? "chart"
                      : "clock"
                }
              />
            </span>
            <span>
              <strong>{title}</strong>
              <small>{description}</small>
            </span>
            <PortalIcon name="chevron" />
          </Link>
        ))}
      </div>
    </Panel>
  );
}

function OwnerDashboard() {
  const { orders } = usePortal();
  const problemOrders = orders.filter((order) => order.hasProblem).length;
  const inactiveCustomers = customers.filter(
    (customer) => customer.sales.daysSinceLastOrder > 45,
  ).length;
  return (
    <>
      <PageHeader
        eyebrow="Kontrolni centar"
        title="Poslovni pregled"
        description="Ključni pokazatelji, odstupanja i operativni red za utorak, 4. avgust 2026."
        actions={
          <>
            <PortalLinkButton href="/portal/cene" icon="prices">
              Nova izmena cena
            </PortalLinkButton>
            <PortalLinkButton
              href="/portal/porudzbine/nova"
              icon="plus"
              variant="primary"
            >
              Nova porudžbina
            </PortalLinkButton>
          </>
        }
      />
      <ModuleState>
        <div className="portal-metrics portal-owner-primary-metrics">
          <Metric
            label="Promet danas"
            value="1.248.630 RSD"
            change="+12,4%"
            context="prema prošlom utorku"
            tone="success"
            icon="chart"
          />
          <Metric
            label="Promet ovog meseca"
            value="8.420.000 RSD"
            change="+7,8%"
            context="u odnosu na jul"
            tone="success"
            icon="chart"
          />
          <Metric
            label="Nove porudžbine"
            value="7"
            context="3 u poslednjem satu"
            tone="info"
            icon="orders"
          />
          <Metric
            label="Problematične"
            value={String(problemOrders)}
            change="2 kritične"
            context="zahtevaju reakciju"
            tone="danger"
            icon="warning"
          />
        </div>
        <div className="portal-summary-strip portal-owner-secondary">
          <div>
            <span>Spremne za slanje</span>
            <strong>11</strong>
            <small>8 BEX · 3 lični prevoz</small>
          </div>
          <div>
            <span>Prosečna porudžbina</span>
            <strong>68.450 RSD</strong>
            <small>+3,1% · 30 dana</small>
          </div>
          <div>
            <span>Bruto marža</span>
            <strong>23,8%</strong>
            <small>−0,6 pp · cilj 24,5%</small>
          </div>
          <div data-alert>
            <span>Dospela dugovanja</span>
            <strong>2.860.000 RSD</strong>
            <small>+8,2% · 12 kupaca</small>
          </div>
        </div>
        <div className="portal-grid" data-layout="wide-left">
          <Panel>
            <SectionHeader
              title="Prodaja po danima"
              description="Fakturisano i potvrđene porudžbine"
              action={
                <Badge tone="success" dot>
                  Osveženo 10:34
                </Badge>
              }
            />
            <RevenueChart />
          </Panel>
          <AttentionList />
        </div>
        <div className="portal-grid" data-columns="3">
          <Panel>
            <SectionHeader
              title="Prodaja po komercijalistima"
              description="Realizacija mesečnog targeta"
            />
            <div className="portal-ranked-list">
              {[
                ["Marko Petrović", 78, 2640000],
                ["Nenad Simić", 71, 2190000],
                ["Tamara Kovač", 64, 1680000],
                ["Ana Ristić", 59, 1210000],
                ["Luka Nikolić", 51, 700000],
              ].map(([name, percent, revenue]) => (
                <div key={String(name)}>
                  <span>
                    <strong>{name}</strong>
                    <small>{formatCurrency(Number(revenue))}</small>
                  </span>
                  <div
                    className="portal-progress"
                    data-tone={Number(percent) > 70 ? "success" : "warning"}
                  >
                    <span style={{ width: `${percent}%` }} />
                  </div>
                  <b>{percent}%</b>
                </div>
              ))}
            </div>
          </Panel>
          <Panel>
            <SectionHeader
              title="Proizvođači"
              description="Udeo u prodaji ovog meseca"
            />
            <div className="portal-share-list">
              {[
                ["R-M", 36],
                ["Carsystem", 27],
                ["baslac", 16],
                ["SIA", 11],
                ["Ostali", 10],
              ].map(([name, share], index) => (
                <div key={String(name)}>
                  <span
                    style={{
                      background: `oklch(${0.51 + index * 0.055} ${index < 2 ? 0.16 : 0.05} ${25 + index * 46})`,
                    }}
                  />
                  <strong>{name}</strong>
                  <b>{share}%</b>
                </div>
              ))}
            </div>
          </Panel>
          <Panel>
            <SectionHeader
              title="Rizik portfolija"
              description="Kupci koji odstupaju od plana"
            />
            <div className="portal-compact-stats">
              <div>
                <span>Bez porudžbine 45+ dana</span>
                <strong>{inactiveCustomers}</strong>
              </div>
              <div>
                <span>Preko kreditnog limita</span>
                <strong>3</strong>
              </div>
              <div>
                <span>Pad prometa veći od 20%</span>
                <strong>4</strong>
              </div>
              <div>
                <span>Aktivne reklamacije</span>
                <strong>3</strong>
              </div>
            </div>
          </Panel>
        </div>
        <div className="portal-grid" data-layout="wide-left">
          <Panel>
            <SectionHeader
              title="Kupci sa najvećim odstupanjem"
              description="Promet, naplata i aktivnost"
              action={
                <Link className="portal-text-link" href="/portal/kupci">
                  Otvori sve kupce
                </Link>
              }
            />
            <div className="portal-table-wrap">
              <table className="portal-table">
                <thead>
                  <tr>
                    <th>Kupac</th>
                    <th>Razlog</th>
                    <th>Promet 30d</th>
                    <th>Trend</th>
                    <th>Dugovanje</th>
                    <th>Poslednja porudžbina</th>
                  </tr>
                </thead>
                <tbody>
                  {customers
                    .filter(
                      (customer) =>
                        customer.status === "u padu" ||
                        customer.financial.debt >
                          customer.financial.creditLimit,
                    )
                    .slice(0, 6)
                    .map((customer) => (
                      <tr key={customer.id}>
                        <td>
                          <Link
                            className="portal-table-link"
                            href={`/portal/kupci/${customer.id}`}
                          >
                            {customer.companyName}
                          </Link>
                          <small>{customer.salesRepName}</small>
                        </td>
                        <td>
                          <Badge
                            tone={
                              customer.financial.debt >
                              customer.financial.creditLimit
                                ? "danger"
                                : "warning"
                            }
                          >
                            {customer.financial.debt >
                            customer.financial.creditLimit
                              ? "Preko limita"
                              : "Pad aktivnosti"}
                          </Badge>
                        </td>
                        <td className="portal-table-number">
                          {formatCurrency(customer.financial.revenue30d)}
                        </td>
                        <td>
                          <Delta value={customer.sales.trendPercent} />
                        </td>
                        <td className="portal-table-number">
                          {formatCurrency(customer.financial.debt)}
                        </td>
                        <td>{customer.sales.daysSinceLastOrder} dana</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Panel>
          <Panel>
            <SectionHeader
              title="Najprodavaniji proizvodi"
              description="Količina i marža, 30 dana"
            />
            <div className="portal-list">
              {products.slice(0, 5).map((product, index) => (
                <div className="portal-list-item" key={product.id}>
                  <span className="portal-rank">{index + 1}</span>
                  <span>
                    <strong>{product.name}</strong>
                    <small>
                      {product.manufacturer} · {product.customerCount} kupaca
                    </small>
                  </span>
                  <span className="portal-list-end">
                    <strong>{154 - index * 17} kom</strong>
                    <small>{product.averageMargin}% marže</small>
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </ModuleState>
    </>
  );
}

function SalesDashboard() {
  const {
    user,
    approvals,
    auditEvents: liveAuditEvents,
    orders: liveOrders,
    tasks: sharedTasks,
    addTask,
    notify,
  } = usePortal();
  const ownCustomers = customers.filter(
    (customer) => customer.salesRepId === user.id,
  );
  const ownCustomerIds = new Set(ownCustomers.map((customer) => customer.id));
  const ownOrderIds = new Set(
    liveOrders
      .filter((order) => order.salesRepId === user.id)
      .map((order) => order.id),
  );
  const auditEvents = liveAuditEvents.filter(
    (event) =>
      ownCustomerIds.has(event.entityId) || ownOrderIds.has(event.entityId),
  );
  const tasks = sharedTasks.filter(
    (task) =>
      task.assigneeId === user.id &&
      (!task.customerId || ownCustomerIds.has(task.customerId)),
  );
  const openTasks = tasks.filter((task) => !task.completed).length;
  const pendingPriceRequests = approvals.filter(
    (approval) =>
      approval.requestedBy === user.name && approval.status === "čeka",
  ).length;
  const attention = ownCustomers.filter(
    (customer) =>
      customer.sales.daysSinceLastOrder > 30 ||
      customer.sales.trendPercent < 0 ||
      customer.financial.overdueDebt > 100000,
  );
  return (
    <>
      <PageHeader
        eyebrow="Moj portfolio"
        title={`Dobro jutro, ${user.name.split(" ")[0]}`}
        description="Prodajni ritam, kupci kojima treba pažnja i današnji zadaci."
        actions={
          <>
            <PortalLinkButton href="/portal/kupci" icon="customers">
              Moji kupci
            </PortalLinkButton>
            <PortalLinkButton
              href="/portal/porudzbine/nova"
              icon="plus"
              variant="primary"
            >
              Nova porudžbina
            </PortalLinkButton>
          </>
        }
      />
      <ModuleState>
        <div className="portal-metrics">
          <Metric
            label="Promet ovog meseca"
            value="2.640.000 RSD"
            change="+9,2%"
            context="prema planu"
            tone="success"
            icon="chart"
          />
          <Metric
            label="Realizacija targeta"
            value="78%"
            context="target 3.380.000 RSD"
            tone="info"
            icon="sales"
          />
          <Metric
            label="Aktivni kupci"
            value={String(
              ownCustomers.filter((customer) => customer.status === "aktivan")
                .length,
            )}
            context={`${ownCustomers.length} u portfoliju`}
            icon="customers"
          />
          <Metric
            label="Zahtevi za cenu"
            value={String(pendingPriceRequests)}
            context="čekaju odobrenje"
            tone="warning"
            icon="approval"
          />
        </div>
        <div className="portal-grid" data-layout="wide-left">
          <Panel>
            <SectionHeader
              title="Realizacija mesečnog plana"
              description="Dnevni ritam i projekcija do kraja avgusta"
            />
            <div className="portal-sales-target">
              <div>
                <span>
                  <small>Ostvareno</small>
                  <strong>2.640.000 RSD</strong>
                </span>
                <span>
                  <small>Target</small>
                  <strong>3.380.000 RSD</strong>
                </span>
              </div>
              <div className="portal-progress" data-tone="success">
                <span style={{ width: "78%" }} />
              </div>
              <p>
                Uz trenutni ritam, projekcija je <strong>3.520.000 RSD</strong>,
                odnosno 104% targeta.
              </p>
              <TinyBars values={revenueTrend.slice(3)} tone="success" />
            </div>
          </Panel>
          <Panel>
            <SectionHeader
              title="Današnji zadaci"
              description={`${openTasks} otvorenih · ${tasks.length - openTasks} završenih`}
            />
            <div className="portal-list">
              {tasks.slice(0, 4).map((task) => (
                <div className="portal-list-item" key={task.id}>
                  <span
                    className="portal-task-check"
                    data-completed={task.completed}
                  >
                    <PortalIcon name="check" />
                  </span>
                  <span>
                    <strong>{task.title}</strong>
                    <small>
                      {new Date(task.dueAt).toLocaleTimeString("sr-RS", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </small>
                  </span>
                  <Badge
                    tone={task.priority === "visoka" ? "danger" : "neutral"}
                  >
                    {task.priority}
                  </Badge>
                </div>
              ))}
            </div>
          </Panel>
        </div>
        <Panel>
          <SectionHeader
            title="Kupci kojima treba pažnja"
            description="Razlozi su izvedeni iz prodajnog ritma, naplate i otvorenih zahteva"
            action={
              <PortalLinkButton href="/portal/kupci" icon="filter">
                Filtriraj kupce
              </PortalLinkButton>
            }
          />
          <div className="portal-table-wrap">
            <table className="portal-table">
              <thead>
                <tr>
                  <th className="portal-sticky-cell">Kupac</th>
                  <th>Razlog</th>
                  <th>Promet 30d</th>
                  <th>Trend</th>
                  <th>Naplata</th>
                  <th>Bez porudžbine</th>
                  <th>Sledeći korak</th>
                </tr>
              </thead>
              <tbody>
                {(attention.length ? attention : ownCustomers).map(
                  (customer, index) => (
                    <tr key={customer.id}>
                      <td className="portal-sticky-cell">
                        <Link
                          className="portal-table-link"
                          href={`/portal/kupci/${customer.id}`}
                        >
                          {customer.companyName}
                        </Link>
                        <small>{customer.city}</small>
                      </td>
                      <td>
                        <Badge tone={index === 0 ? "danger" : "warning"}>
                          {customer.sales.trendPercent < 0
                            ? "Značajan pad prometa"
                            : customer.financial.overdueDebt > 100000
                              ? "Kašnjenje u plaćanju"
                              : "Nema porudžbine 45 dana"}
                        </Badge>
                      </td>
                      <td className="portal-table-number">
                        {formatCurrency(customer.financial.revenue30d)}
                      </td>
                      <td>
                        <Delta value={customer.sales.trendPercent} />
                      </td>
                      <td>
                        <Badge
                          tone={
                            customer.financial.overdueDebt > 100000
                              ? "warning"
                              : "neutral"
                          }
                        >
                          {customer.financial.overdueDebt > 100000
                            ? "zahteva proveru"
                            : "bez signala"}
                        </Badge>
                      </td>
                      <td>{customer.sales.daysSinceLastOrder} dana</td>
                      <td>
                        {(() => {
                          const taskId = `task-reminder-${customer.id}`;
                          const exists = sharedTasks.some(
                            (task) => task.id === taskId,
                          );
                          return (
                            <button
                              className="portal-text-button"
                              type="button"
                              disabled={exists}
                              title={
                                exists
                                  ? "Podsetnik je već dodat u mock zadatke."
                                  : undefined
                              }
                              onClick={() => {
                                addTask({
                                  id: taskId,
                                  title: `Kontaktirati ${customer.companyName}`,
                                  dueAt: "2026-08-04T17:00:00",
                                  assigneeId: user.id,
                                  customerId: customer.id,
                                  priority:
                                    customer.sales.trendPercent < 0
                                      ? "visoka"
                                      : "srednja",
                                  completed: false,
                                });
                                notify(
                                  "Podsetnik je dodat",
                                  `${customer.companyName} je dodat u zajedničke mock zadatke.`,
                                );
                              }}
                            >
                              {exists
                                ? "Podsetnik postoji"
                                : "Postavi podsetnik"}
                            </button>
                          );
                        })()}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </Panel>
        <div className="portal-grid" data-columns="2">
          <Panel>
            <SectionHeader title="Top proizvodi kod mojih kupaca" />
            <div className="portal-list">
              {products.slice(0, 5).map((product, index) => (
                <div className="portal-list-item" key={product.id}>
                  <span className="portal-rank">{index + 1}</span>
                  <span>
                    <strong>{product.name}</strong>
                    <small>
                      {product.manufacturer} · {product.group}
                    </small>
                  </span>
                  <Delta value={12 - index * 3} />
                </div>
              ))}
            </div>
          </Panel>
          <Panel>
            <SectionHeader title="Nedavne aktivnosti" />
            <div className="portal-list">
              {auditEvents.slice(0, 5).map((event) => (
                <div className="portal-list-item" key={event.id}>
                  <span className="portal-list-marker">
                    <PortalIcon name="activity" />
                  </span>
                  <span>
                    <strong>{event.action}</strong>
                    <small>
                      {event.entityLabel} · {event.userName}
                    </small>
                  </span>
                  <time>{formatDate(event.occurredAt, true)}</time>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </ModuleState>
    </>
  );
}

const officeColumns = [
  "nova",
  "čeka proveru",
  "čeka potvrdu kupca",
  "čeka robu",
  "spremna za fakturisanje",
  "spremna za BEX",
  "u transportu",
  "problem",
] as const;

function OfficeDashboard() {
  const { user, orders, bexShipments, bizniSoftRecords, tasks, toggleTask } =
    usePortal();
  const officeTasks = tasks.filter((task) => task.assigneeId === user.id);
  const officeOpenTasks = officeTasks.filter((task) => !task.completed).length;
  return (
    <>
      <PageHeader
        eyebrow="Operativni centar"
        title="Obrada porudžbina"
        description="Nove porudžbine, nedostajući podaci i priprema za poslovne sisteme."
        actions={
          <PortalLinkButton
            href="/portal/porudzbine/nova"
            icon="plus"
            variant="primary"
          >
            Nova porudžbina
          </PortalLinkButton>
        }
      />
      <ModuleState>
        <div className="portal-office-quick">
          <div>
            <span className="portal-office-quick-icon">
              <PortalIcon name="search" />
            </span>
            <span>
              <strong>Brza pretraga kupca</strong>
              <small>Naziv, PIB, šifra ili telefon</small>
            </span>
            <Link href="/portal/kupci">
              Otvori pretragu <PortalIcon name="arrow" />
            </Link>
          </div>
          <div>
            <span className="portal-office-quick-icon">
              <PortalIcon name="phone" />
            </span>
            <span>
              <strong>Poslednji pozivi i beleške</strong>
              <small>6 novih unosa od jutros</small>
            </span>
            <Link href="/portal/kupci">Prikaži</Link>
          </div>
          <div>
            <span className="portal-office-quick-icon">
              <PortalIcon name="approval" />
            </span>
            <span>
              <strong>Današnji zadaci</strong>
              <small>
                {officeOpenTasks} otvorena ·{" "}
                {officeTasks.length - officeOpenTasks} završena
              </small>
            </span>
            <a href="#portal-office-tasks">Pregled</a>
          </div>
        </div>
        <Panel>
          <div id="portal-office-tasks">
            <SectionHeader
              title="Današnji zadaci"
              description={`${officeOpenTasks} otvorena · ${officeTasks.length - officeOpenTasks} završena`}
            />
            <div className="portal-list">
              {officeTasks.map((task) => (
                <div className="portal-list-item" key={task.id}>
                  <button
                    type="button"
                    className="portal-task-check"
                    data-completed={task.completed}
                    aria-label={
                      task.completed
                        ? `Ponovo otvori: ${task.title}`
                        : `Označi kao završeno: ${task.title}`
                    }
                    onClick={() => toggleTask(task.id)}
                  >
                    <PortalIcon name="check" />
                  </button>
                  <span>
                    <strong>{task.title}</strong>
                    <small>
                      {new Date(task.dueAt).toLocaleTimeString("sr-RS", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </small>
                  </span>
                  <Badge
                    tone={task.priority === "visoka" ? "danger" : "neutral"}
                  >
                    {task.priority}
                  </Badge>
                </div>
              ))}
              {!officeTasks.length ? (
                <div className="portal-inline-empty">
                  Nema zadataka za danas.
                </div>
              ) : null}
            </div>
          </div>
        </Panel>
        <Panel>
          <SectionHeader
            title="Operativni tok"
            description="Porudžbine po trenutnom statusu, horizontalni pregled"
            action={
              <Link className="portal-text-link" href="/portal/porudzbine">
                Otvori tabelu
              </Link>
            }
          />
          <div className="portal-kanban">
            {officeColumns.map((column) => {
              const columnOrders = orders
                .filter((order) => order.status === column)
                .slice(0, 3);
              return (
                <section key={column} data-critical={column === "problem"}>
                  <header>
                    <span>{column}</span>
                    <b>
                      {orders.filter((order) => order.status === column).length}
                    </b>
                  </header>
                  <div>
                    {columnOrders.length ? (
                      columnOrders.map((order) => (
                        <Link
                          href={`/portal/porudzbine/${order.id}`}
                          key={order.id}
                          className="portal-kanban-order"
                        >
                          <span>
                            <strong>{order.number}</strong>
                            <Badge tone={statusTone(order.source)}>
                              {order.source}
                            </Badge>
                          </span>
                          <h3>{order.customerName}</h3>
                          <small>
                            {order.items.length} stavke ·{" "}
                            {formatCurrency(order.total)}
                          </small>
                          {order.warnings[0] ? (
                            <em>
                              <PortalIcon name="warning" />
                              {order.warnings[0]}
                            </em>
                          ) : null}
                        </Link>
                      ))
                    ) : (
                      <div className="portal-kanban-empty">Nema porudžbina</div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </Panel>
        <div className="portal-grid" data-columns="3">
          <Panel>
            <SectionHeader
              title="Nedostajući podaci"
              description="Blokira dalju obradu"
            />
            <div className="portal-list">
              {orders
                .filter((order) => order.warnings.length)
                .slice(0, 5)
                .map((order) => (
                  <Link
                    className="portal-list-item"
                    href={`/portal/porudzbine/${order.id}`}
                    key={order.id}
                  >
                    <span className="portal-list-marker" data-tone="warning">
                      <PortalIcon name="warning" />
                    </span>
                    <span>
                      <strong>{order.customerName}</strong>
                      <small>{order.warnings[0]}</small>
                    </span>
                    <PortalIcon name="chevron" />
                  </Link>
                ))}
            </div>
          </Panel>
          <Panel>
            <SectionHeader title="BEX pošiljke sa greškom" />
            <div className="portal-list">
              {bexShipments
                .filter((shipment) => shipment.status === "greška")
                .map((shipment) => (
                  <Link
                    className="portal-list-item"
                    href="/portal/bex"
                    key={shipment.id}
                  >
                    <span className="portal-list-marker" data-tone="danger">
                      <PortalIcon name="truck" />
                    </span>
                    <span>
                      <strong>{shipment.orderNumber}</strong>
                      <small>{shipment.validationIssues.join(" · ")}</small>
                    </span>
                    <PortalIcon name="chevron" />
                  </Link>
                ))}
            </div>
          </Panel>
          <Panel>
            <SectionHeader title="BizniSoft čeka obradu" />
            <div className="portal-list">
              {bizniSoftRecords
                .filter((record) => record.status !== "sinhronizovano")
                .slice(0, 5)
                .map((record) => (
                  <Link
                    className="portal-list-item"
                    href="/portal/biznissoft"
                    key={record.id}
                  >
                    <span
                      className="portal-list-marker"
                      data-tone={
                        record.status === "greška" ? "danger" : "warning"
                      }
                    >
                      <PortalIcon name="sync" />
                    </span>
                    <span>
                      <strong>{record.entityLabel}</strong>
                      <small>{record.issue ?? record.status}</small>
                    </span>
                    <PortalIcon name="chevron" />
                  </Link>
                ))}
            </div>
          </Panel>
        </div>
      </ModuleState>
    </>
  );
}

export function PortalDashboard() {
  const { role } = usePortal();
  const dashboard =
    role === "sales" ? (
      <SalesDashboard />
    ) : role === "office" ? (
      <OfficeDashboard />
    ) : (
      <OwnerDashboard />
    );
  return <div className="portal-dashboard-root">{dashboard}</div>;
}
