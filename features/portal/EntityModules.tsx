"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  auditEvents,
  customers,
  orders,
  portalUsers,
  products,
} from "@/fixtures/dev/portal";
import { can } from "@/permissions/portal-permissions";
import type { Product } from "@/types/portal";
import { PortalIcon } from "@/components/portal/PortalIcon";
import { usePortal } from "@/components/portal/PortalProvider";
import {
  AccessGuard,
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
  SectionHeader,
  SelectionCheckbox,
  StateView,
  statusTone,
  TinyBars,
  useDialogDismiss,
} from "@/components/portal/PortalPrimitives";

export function ProductsAdmin() {
  const { role } = usePortal();
  const [query, setQuery] = useState("");
  const [manufacturer, setManufacturer] = useState("svi");
  const [group, setGroup] = useState("sve");
  const [mapping, setMapping] = useState("svi");
  const [availability, setAvailability] = useState("sve");
  const [selected, setSelected] = useState<Product | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sort, setSort] = useState<"name" | "price" | "stock">("name");
  const filtered = useMemo(
    () =>
      products
        .filter((product) => {
          if (manufacturer !== "svi" && product.manufacturer !== manufacturer)
            return false;
          if (group !== "sve" && product.group !== group) return false;
          if (mapping !== "svi" && product.mappingStatus !== mapping)
            return false;
          if (availability !== "sve" && product.availability !== availability)
            return false;
          const value = query.toLocaleLowerCase("sr").trim();
          return (
            !value ||
            [
              product.name,
              product.sku,
              product.catalogNumber,
              product.manufacturer,
              ...product.aliases.map((alias) => alias.value),
            ].some((field) => field.toLocaleLowerCase("sr").includes(value))
          );
        })
        .sort((a, b) =>
          sort === "price"
            ? b.averageSalePrice - a.averageSalePrice
            : sort === "stock"
              ? b.variants.reduce(
                  (sum, variant) => sum + variant.available,
                  0,
                ) -
                a.variants.reduce((sum, variant) => sum + variant.available, 0)
              : a.name.localeCompare(b.name, "sr"),
        ),
    [query, manufacturer, group, mapping, availability, sort],
  );
  const canViewCost = can(role, "products:view_cost");
  const activeFilters = [
    Boolean(query),
    manufacturer !== "svi",
    group !== "sve",
    mapping !== "svi",
    availability !== "sve",
  ].filter(Boolean).length;
  const allVisibleSelected =
    filtered.length > 0 &&
    filtered.every((product) => selectedIds.includes(product.id));

  useEffect(() => {
    const productId = new URLSearchParams(window.location.search).get(
      "product",
    );
    if (productId)
      setSelected(products.find((product) => product.id === productId) ?? null);
  }, []);

  useEffect(() => {
    setSelectedIds([]);
  }, [availability, group, manufacturer, mapping, query, sort]);

  return (
    <AccessGuard permission="products:view">
      <PageHeader
        eyebrow="Master podaci"
        title="Proizvodi"
        description={`${filtered.length} proizvoda · katalog, dostupnost, BizniSoft mapiranje i cenovni parametri`}
        actions={
          <>
            <PortalButton
              icon="download"
              disabled
              title="CSV/XLSX uvoz nije implementiran u frontend prototipu."
            >
              Mock uvoz
            </PortalButton>
            {canViewCost ? (
              <PortalButton
                variant="primary"
                icon="plus"
                disabled
                title="Dodavanje proizvoda nije implementirano u frontend prototipu."
              >
                Dodaj proizvod · mock
              </PortalButton>
            ) : null}
          </>
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
                  placeholder="Naziv, šifra, kataloški broj ili sinonim"
                />
              </label>
              <select
                className="portal-filter-select"
                value={manufacturer}
                onChange={(event) => setManufacturer(event.target.value)}
                aria-label="Proizvođač"
              >
                <option value="svi">Svi proizvođači</option>
                {Array.from(
                  new Set(products.map((product) => product.manufacturer)),
                ).map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
              <select
                className="portal-filter-select"
                value={group}
                onChange={(event) => setGroup(event.target.value)}
                aria-label="Grupa proizvoda"
              >
                <option value="sve">Sve grupe</option>
                {Array.from(
                  new Set(products.map((product) => product.group)),
                ).map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
              <select
                className="portal-filter-select"
                value={availability}
                onChange={(event) => setAvailability(event.target.value)}
                aria-label="Dostupnost"
              >
                <option value="sve">Sva stanja</option>
                <option>na stanju</option>
                <option>nisko stanje</option>
                <option>nema na stanju</option>
              </select>
              <select
                className="portal-filter-select"
                value={mapping}
                onChange={(event) => setMapping(event.target.value)}
                aria-label="Mapiranje"
              >
                <option value="svi">Sva mapiranja</option>
                <option>mapiran</option>
                <option>čeka mapiranje</option>
                <option>greška</option>
              </select>
            </div>
            <div className="portal-table-toolbar-actions">
              <select
                className="portal-filter-select"
                value={sort}
                onChange={(event) => setSort(event.target.value as typeof sort)}
                aria-label="Sortiranje proizvoda"
              >
                <option value="name">Naziv A–Š</option>
                <option value="price">Najveća cena</option>
                <option value="stock">Najveće stanje</option>
              </select>
              {activeFilters ? (
                <PortalButton
                  variant="ghost"
                  icon="close"
                  onClick={() => {
                    setQuery("");
                    setManufacturer("svi");
                    setGroup("sve");
                    setAvailability("sve");
                    setMapping("svi");
                  }}
                >
                  Resetuj {activeFilters}
                </PortalButton>
              ) : null}
            </div>
          </div>
          {activeFilters ? (
            <div className="portal-active-filters">
              <span className="portal-filter-chip">
                {filtered.length} proizvoda
              </span>
              {manufacturer !== "svi" ? (
                <span className="portal-filter-chip">
                  Proizvođač: {manufacturer}
                </span>
              ) : null}
              {group !== "sve" ? (
                <span className="portal-filter-chip">Grupa: {group}</span>
              ) : null}
              {availability !== "sve" ? (
                <span className="portal-filter-chip">
                  Stanje: {availability}
                </span>
              ) : null}
            </div>
          ) : null}
          <BulkToolbar
            selectedCount={selectedIds.length}
            itemLabel={
              selectedIds.length === 1
                ? "proizvod izabran"
                : "proizvoda izabrano"
            }
            scopeLabel="Akcija važi samo za proizvode u trenutnom prikazu; izbor se resetuje pri promeni filtera."
            onClear={() => setSelectedIds([])}
          >
            <PortalButton
              variant="primary"
              disabled
              title="Grupna izmena proizvoda nije implementirana u frontend prototipu."
            >
              Dodaj u red · mock
            </PortalButton>
          </BulkToolbar>
          <div className="portal-table-wrap">
            <table className="portal-table portal-products-table">
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
                            : filtered.map((product) => product.id),
                        )
                      }
                      label="Izaberi sve proizvode u trenutnom prikazu"
                    />
                  </th>
                  <th className="portal-sticky-cell">Proizvod</th>
                  <th>Šifra</th>
                  <th>Kataloški broj</th>
                  <th>Proizvođač</th>
                  <th>Grupa</th>
                  <th>Pakovanje</th>
                  <th>Status</th>
                  <th>Dostupnost</th>
                  <th>BizniSoft šifra</th>
                  <th>Mapiranje</th>
                  <th>Kupci</th>
                  <th>Prosečna cena</th>
                  {canViewCost ? <th>Prosečna marža</th> : null}
                  <th>Poslednja prodaja</th>
                  <th>Akcije</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((product) => (
                  <tr
                    key={product.id}
                    data-selected={selectedIds.includes(product.id)}
                  >
                    <td>
                      <SelectionCheckbox
                        checked={selectedIds.includes(product.id)}
                        onChange={() =>
                          setSelectedIds((current) =>
                            current.includes(product.id)
                              ? current.filter((id) => id !== product.id)
                              : [...current, product.id],
                          )
                        }
                        label={`Izaberi ${product.name}`}
                      />
                    </td>
                    <td className="portal-sticky-cell">
                      <button
                        type="button"
                        className="portal-table-product"
                        onClick={() => setSelected(product)}
                      >
                        {product.image ? (
                          <span>
                            <Image
                              src={product.image}
                              alt=""
                              width={32}
                              height={32}
                            />
                          </span>
                        ) : (
                          <span>
                            <PortalIcon name="products" />
                          </span>
                        )}
                        <div>
                          <strong>{product.name}</strong>
                          <small>{product.subgroup}</small>
                        </div>
                      </button>
                    </td>
                    <td className="portal-technical">{product.sku}</td>
                    <td className="portal-technical">
                      {product.catalogNumber}
                    </td>
                    <td>
                      <Badge>{product.manufacturer}</Badge>
                    </td>
                    <td>{product.group}</td>
                    <td>{product.packaging}</td>
                    <td>
                      <Badge tone={statusTone(product.status)}>
                        {product.status}
                      </Badge>
                    </td>
                    <td>
                      <Badge tone={statusTone(product.availability)}>
                        {product.availability}
                      </Badge>
                    </td>
                    <td className="portal-technical">
                      {product.bizniSoftCode ?? "nije uneta"}
                    </td>
                    <td>
                      <Badge tone={statusTone(product.mappingStatus)}>
                        {product.mappingStatus}
                      </Badge>
                    </td>
                    <td>{product.customerCount}</td>
                    <td className="portal-table-number">
                      {formatCurrency(product.averageSalePrice)}
                    </td>
                    {canViewCost ? (
                      <td>
                        <Badge
                          tone={
                            product.averageMargin < 20 ? "warning" : "success"
                          }
                        >
                          {product.averageMargin}%
                        </Badge>
                      </td>
                    ) : null}
                    <td>{formatDate(product.lastSaleAt)}</td>
                    <td>
                      <button
                        type="button"
                        className="portal-icon-button"
                        aria-label={`Otvori ${product.name}`}
                        onClick={() => setSelected(product)}
                      >
                        <PortalIcon name="eye" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!filtered.length ? (
            <div className="portal-inline-empty portal-inline-empty-large">
              <PortalIcon name="search" />
              Nema proizvoda za aktivne filtere.
            </div>
          ) : null}
        </Panel>
      </ModuleState>
      {selected ? (
        <ProductDrawer
          product={selected}
          canViewCost={canViewCost}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </AccessGuard>
  );
}

function ProductDrawer({
  product,
  canViewCost,
  onClose,
}: {
  product: Product;
  canViewCost: boolean;
  onClose: () => void;
}) {
  useDialogDismiss(onClose);
  return (
    <div
      className="portal-drawer-layer"
      role="dialog"
      aria-modal="true"
      aria-label={`Detalj proizvoda ${product.name}`}
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <aside className="portal-drawer">
        <header>
          <div>
            <span>Detalj proizvoda</span>
            <h2>{product.name}</h2>
            <p>
              {product.sku} · {product.manufacturer}
            </p>
          </div>
          <button className="portal-icon-button" onClick={onClose}>
            <PortalIcon name="close" />
          </button>
        </header>
        <div className="portal-drawer-scroll">
          <div className="portal-product-drawer-hero">
            {product.image ? (
              <Image
                src={product.image}
                alt={product.name}
                width={180}
                height={180}
              />
            ) : (
              <PortalIcon name="products" />
            )}
            <div>
              <Badge tone={statusTone(product.availability)}>
                {product.availability}
              </Badge>
              <strong>{formatCurrency(product.basePrice)}</strong>
              <span>Osnovna cena · {product.packaging}</span>
            </div>
          </div>
          <div className="portal-drawer-section">
            <SectionHeader title="Osnovni podaci" />
            <div className="portal-detail-list">
              <div>
                <span>Kategorija</span>
                <strong>
                  {product.group} · {product.subgroup}
                </strong>
              </div>
              <div>
                <span>Kataloški broj</span>
                <strong>{product.catalogNumber}</strong>
              </div>
              <div>
                <span>BizniSoft šifra</span>
                <strong>{product.bizniSoftCode ?? "Nije mapirano"}</strong>
              </div>
              <div>
                <span>Status mapiranja</span>
                <Badge tone={statusTone(product.mappingStatus)}>
                  {product.mappingStatus}
                </Badge>
              </div>
              {canViewCost ? (
                <>
                  <div>
                    <span>Nabavna cena</span>
                    <strong>{formatCurrency(product.purchasePrice)}</strong>
                  </div>
                  <div>
                    <span>Minimalna cena</span>
                    <strong>{formatCurrency(product.minimumPrice)}</strong>
                  </div>
                  <div>
                    <span>Prosečna marža</span>
                    <strong>{product.averageMargin}%</strong>
                  </div>
                </>
              ) : null}
            </div>
          </div>
          <div className="portal-drawer-section">
            <SectionHeader title="Varijante i stanje" />
            <div className="portal-table-wrap">
              <table className="portal-table">
                <thead>
                  <tr>
                    <th>Pakovanje</th>
                    <th>Šifra</th>
                    <th>Cena</th>
                    <th>Stanje</th>
                  </tr>
                </thead>
                <tbody>
                  {product.variants.map((variant) => (
                    <tr key={variant.id}>
                      <td>{variant.packaging}</td>
                      <td className="portal-technical">{variant.sku}</td>
                      <td>{formatCurrency(variant.price)}</td>
                      <td>{variant.available}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="portal-drawer-section">
            <SectionHeader
              title="Sinonimi"
              action={
                <PortalButton
                  icon="plus"
                  disabled
                  title="Dodavanje sinonima nije implementirano u frontend prototipu."
                >
                  Dodaj · mock
                </PortalButton>
              }
            />
            {product.aliases.length ? (
              <div className="portal-list">
                {product.aliases.map((alias) => (
                  <div className="portal-list-item" key={alias.id}>
                    <span className="portal-list-marker">
                      <PortalIcon name="spark" />
                    </span>
                    <span>
                      <strong>„{alias.value}“</strong>
                      <small>Pouzdanost mapiranja {alias.confidence}%</small>
                    </span>
                    <Badge tone="success">aktivno</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="portal-inline-empty">
                Nema sačuvanih sinonima.
              </div>
            )}
          </div>
          <div className="portal-drawer-section">
            <SectionHeader title="Prodajni rezultat" />
            <div className="portal-metrics portal-drawer-metrics">
              <Metric label="Kupci" value={String(product.customerCount)} />
              <Metric
                label="Prosečna cena"
                value={formatCurrency(product.averageSalePrice)}
              />
            </div>
          </div>
        </div>
        <footer>
          <PortalButton onClick={onClose}>Zatvori</PortalButton>
          {canViewCost ? (
            <PortalButton
              variant="primary"
              icon="edit"
              disabled
              title="Izmena proizvoda nije implementirana u frontend prototipu."
            >
              Izmeni proizvod · mock
            </PortalButton>
          ) : null}
        </footer>
      </aside>
    </div>
  );
}

export function SalesRepsAdmin() {
  const { role } = usePortal();
  const salesReps = portalUsers.filter((user) => user.role === "sales");
  const [selectedId, setSelectedId] = useState(salesReps[0]?.id ?? "");
  if (!can(role, "sales_reps:view")) return <StateView state="permission" />;
  const selected = salesReps.find((rep) => rep.id === selectedId)!;
  const repCustomers = customers.filter(
    (customer) => customer.salesRepId === selected.id,
  );
  const repOrders = orders.filter((order) => order.salesRepId === selected.id);
  const revenue = repCustomers.reduce(
    (sum, customer) => sum + customer.financial.revenue30d,
    0,
  );
  return (
    <>
      <PageHeader
        eyebrow="Prodajni tim"
        title="Komercijalisti"
        description="Rezultati, portfolio rizik, aktivnosti i zahtevi za cenu po komercijalisti."
        actions={
          <PortalButton
            variant="primary"
            icon="plus"
            disabled
            title="Dodavanje komercijaliste nije implementirano u frontend prototipu."
          >
            Dodaj komercijalistu · mock
          </PortalButton>
        }
      />
      <ModuleState>
        <div className="portal-metrics">
          <Metric
            label="Ukupan promet tima"
            value="8.420.000 RSD"
            change="+7,8%"
            tone="success"
          />
          <Metric
            label="Realizacija targeta"
            value="67%"
            context="4.560.000 RSD preostalo"
            tone="info"
          />
          <Metric label="Aktivni kupci" value="43" context="15 u mock skupu" />
          <Metric
            label="Dospela dugovanja"
            value="2.860.000 RSD"
            context="12 kupaca"
            tone="danger"
          />
        </div>
        <Panel>
          <SectionHeader
            title="Pregled tima"
            description="Izaberite red za detaljan prikaz ispod"
          />
          <div className="portal-table-wrap">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Komercijalista</th>
                  <th>Region</th>
                  <th>Kupci</th>
                  <th>Aktivni</th>
                  <th>Promet</th>
                  <th>Target</th>
                  <th>Realizacija</th>
                  <th>Marža</th>
                  <th>Novi kupci</th>
                  <th>Izgubljeni</th>
                  <th>Dospelo</th>
                  <th>Otvorene porudžbine</th>
                  <th>Zahtevi</th>
                  <th>Poslednja aktivnost</th>
                </tr>
              </thead>
              <tbody>
                {salesReps.map((rep, index) => {
                  const owned = customers.filter(
                    (customer) => customer.salesRepId === rep.id,
                  );
                  const repRevenue = owned.reduce(
                    (sum, customer) => sum + customer.financial.revenue30d,
                    0,
                  );
                  const target = 950000 + index * 330000;
                  const realization = Math.round((repRevenue / target) * 100);
                  return (
                    <tr
                      key={rep.id}
                      className="portal-clickable-row"
                      data-selected={rep.id === selectedId}
                      onClick={() => setSelectedId(rep.id)}
                    >
                      <td>
                        <div className="portal-rep-cell">
                          <span>{rep.initials}</span>
                          <strong>{rep.name}</strong>
                        </div>
                      </td>
                      <td>{rep.region}</td>
                      <td>{owned.length}</td>
                      <td>
                        {
                          owned.filter(
                            (customer) => customer.status === "aktivan",
                          ).length
                        }
                      </td>
                      <td className="portal-table-number">
                        {formatCurrency(repRevenue)}
                      </td>
                      <td className="portal-table-number">
                        {formatCurrency(target)}
                      </td>
                      <td>
                        <div className="portal-realization-cell">
                          <div
                            className="portal-progress"
                            data-tone={realization > 70 ? "success" : "warning"}
                          >
                            <span
                              style={{
                                width: `${Math.min(100, realization)}%`,
                              }}
                            />
                          </div>
                          <b>{realization}%</b>
                        </div>
                      </td>
                      <td>{21 + index}%</td>
                      <td>{index % 3}</td>
                      <td>
                        {
                          owned.filter(
                            (customer) => customer.status === "u padu",
                          ).length
                        }
                      </td>
                      <td>
                        {formatCurrency(
                          owned.reduce(
                            (sum, customer) =>
                              sum + customer.financial.overdueDebt,
                            0,
                          ),
                        )}
                      </td>
                      <td>
                        {
                          orders.filter(
                            (order) =>
                              order.salesRepId === rep.id &&
                              order.status !== "isporučena",
                          ).length
                        }
                      </td>
                      <td>{(index % 2) + 1}</td>
                      <td>{formatDate(auditEvents[index].occurredAt, true)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
        <div className="portal-grid portal-rep-detail" data-layout="wide-left">
          <div className="portal-stack">
            <Panel>
              <SectionHeader
                title={`${selected.name} · KPI pregled`}
                description={selected.region}
              />
              <div className="portal-summary-strip">
                <div>
                  <span>Promet 30 dana</span>
                  <strong>{formatCurrency(revenue)}</strong>
                </div>
                <div>
                  <span>Broj kupaca</span>
                  <strong>{repCustomers.length}</strong>
                </div>
                <div>
                  <span>Otvorene porudžbine</span>
                  <strong>
                    {
                      repOrders.filter((order) => order.status !== "isporučena")
                        .length
                    }
                  </strong>
                </div>
                <div>
                  <span>Prosečna marža</span>
                  <strong>
                    {repCustomers.length
                      ? Math.round(
                          repCustomers.reduce(
                            (sum, customer) =>
                              sum + customer.financial.averageMargin,
                            0,
                          ) / repCustomers.length,
                        )
                      : 0}
                    %
                  </strong>
                </div>
              </div>
              <div className="portal-sales-rep-chart">
                <TinyBars
                  values={[42, 55, 48, 63, 71, 68, 79, 83, 77, 91, 96, 104]}
                  tone="success"
                />
                <div>
                  <span>Sep</span>
                  <span>Okt</span>
                  <span>Nov</span>
                  <span>Dec</span>
                  <span>Jan</span>
                  <span>Feb</span>
                  <span>Mar</span>
                  <span>Apr</span>
                  <span>Maj</span>
                  <span>Jun</span>
                  <span>Jul</span>
                  <span>Avg</span>
                </div>
              </div>
            </Panel>
            <Panel>
              <SectionHeader title="Kupci u padu" />
              <div className="portal-table-wrap">
                <table className="portal-table">
                  <thead>
                    <tr>
                      <th>Kupac</th>
                      <th>Promet 30d</th>
                      <th>Trend</th>
                      <th>Bez porudžbine</th>
                      <th>Dugovanje</th>
                    </tr>
                  </thead>
                  <tbody>
                    {repCustomers
                      .filter(
                        (customer) =>
                          customer.status === "u padu" ||
                          customer.sales.daysSinceLastOrder > 30,
                      )
                      .map((customer) => (
                        <tr key={customer.id}>
                          <td>
                            <Link
                              className="portal-table-link"
                              href={`/portal/kupci/${customer.id}`}
                            >
                              {customer.companyName}
                            </Link>
                          </td>
                          <td>
                            {formatCurrency(customer.financial.revenue30d)}
                          </td>
                          <td>
                            <Delta value={customer.sales.trendPercent} />
                          </td>
                          <td>{customer.sales.daysSinceLastOrder} dana</td>
                          <td>{formatCurrency(customer.financial.debt)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
          <aside className="portal-stack">
            <Panel>
              <SectionHeader title="Najjači kupci" />
              <div className="portal-list">
                {repCustomers
                  .sort(
                    (a, b) => b.financial.revenue365d - a.financial.revenue365d,
                  )
                  .slice(0, 5)
                  .map((customer, index) => (
                    <Link
                      href={`/portal/kupci/${customer.id}`}
                      className="portal-list-item"
                      key={customer.id}
                    >
                      <span className="portal-rank">{index + 1}</span>
                      <span>
                        <strong>{customer.companyName}</strong>
                        <small>
                          {formatCurrency(customer.financial.revenue365d)} ·{" "}
                          {customer.sales.trendPercent}%
                        </small>
                      </span>
                      <PortalIcon name="chevron" />
                    </Link>
                  ))}
              </div>
            </Panel>
            <Panel>
              <SectionHeader title="Interna beleška gazde" />
              <div className="portal-confidential-note">
                <PortalIcon name="lock" />
                <p>
                  Fokus na reaktivaciju kupaca sa padom i širenje R-M sistema
                  kod ključnih lakirnica u regionu.
                </p>
              </div>
              <div className="portal-panel-body">
                <PortalButton
                  icon="edit"
                  disabled
                  title="Izmena beleške nije implementirana u frontend prototipu."
                >
                  Izmeni belešku · mock
                </PortalButton>
              </div>
            </Panel>
          </aside>
        </div>
      </ModuleState>
    </>
  );
}
