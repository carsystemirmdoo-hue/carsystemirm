"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  customers,
  manufacturers,
  productGroups,
  products,
} from "@/fixtures/dev/portal";
import { can } from "@/permissions/portal-permissions";
import { mockPortalService } from "@/services/portal/portal-service";
import type {
  ApprovalRequest,
  PriceChangeBatch,
  PriceChangeType,
  PricePreviewRow,
} from "@/types/portal";
import { PortalIcon } from "@/components/portal/PortalIcon";
import { usePortal } from "@/components/portal/PortalProvider";
import {
  Badge,
  Delta,
  formatCurrency,
  formatDate,
  Metric,
  ModuleState,
  PageHeader,
  Panel,
  PortalButton,
  PortalLinkButton,
  SelectionCheckbox,
  SectionHeader,
  StateView,
  statusTone,
  useDialogDismiss,
} from "@/components/portal/PortalPrimitives";
import { AccessGuard } from "@/features/portal/LegacyAccessGuard";

const priceTypeLabels: Record<PriceChangeType, string> = {
  fixed: "Fiksna cena",
  discount: "Postavi rabat",
  rebate_increase: "Povećaj rabat",
  rebate_decrease: "Smanji rabat",
  increase_percent: "Povećaj cenu za %",
  decrease_percent: "Smanji cenu za %",
  increase_fixed: "Povećaj cenu za iznos",
  decrease_fixed: "Smanji cenu za iznos",
  margin: "Ciljana marža",
  rebate: "Postavi rabat",
  quantity: "Količinski rabat",
  promotion: "Promotivna cena",
};

function PricingNav({
  active,
  onViewChange,
}: {
  active: "overview" | "bulk" | "rules" | "history";
  onViewChange?: (view: "bulk" | "rules") => void;
}) {
  return (
    <nav className="portal-tabs portal-pricing-nav">
      <Link href="/portal/cene" data-active={active === "overview"}>
        Pregled cena
      </Link>
      {onViewChange ? (
        <button
          data-active={active === "bulk"}
          onClick={() => onViewChange("bulk")}
        >
          Bulk rabati
        </button>
      ) : (
        <Link href="/portal/cene/pravila" data-active={active === "bulk"}>
          Bulk rabati
        </Link>
      )}
      {onViewChange ? (
        <button
          data-active={active === "rules"}
          onClick={() => onViewChange("rules")}
        >
          Pravila rabata
        </button>
      ) : (
        <Link
          href="/portal/cene/pravila?view=rules"
          data-active={active === "rules"}
        >
          Pravila rabata
        </Link>
      )}
      <Link href="/portal/cene/istorija" data-active={active === "history"}>
        Istorija promena
      </Link>
    </nav>
  );
}

export function PricingOverview() {
  const { role, priceRules } = usePortal();
  const canViewMargin = can(role, "prices:view_margin");
  return (
    <AccessGuard permission="prices:view">
      <PageHeader
        eyebrow="Komercijalna politika"
        title="Cene i rabati"
        description={
          canViewMargin
            ? "Aktivna pravila, posebne cene i odstupanja od minimalne marže."
            : "Aktivna pravila, posebne cene i zahtevi koji čekaju odobrenje."
        }
        actions={
          can(role, "prices:manage") ? (
            <PortalLinkButton
              href="/portal/cene/pravila"
              icon="plus"
              variant="primary"
            >
              Nova bulk izmena
            </PortalLinkButton>
          ) : (
            <PortalLinkButton
              href="/portal/cene/pravila"
              icon="approval"
              variant="primary"
            >
              Predloži izmenu
            </PortalLinkButton>
          )
        }
      />
      <PricingNav active="overview" />
      <ModuleState>
        <div className="portal-metrics">
          <Metric
            label="Aktivna pravila"
            value={String(
              priceRules.filter((rule) => rule.status === "aktivno").length,
            )}
            context="u 4 nivoa prioriteta"
            icon="prices"
          />
          <Metric
            label="Posebne cene kupaca"
            value="138"
            change="+12"
            context="ovog meseca"
            tone="info"
            icon="customers"
          />
          <Metric
            label={canViewMargin ? "Ispod ciljane marže" : "Cenovni izuzeci"}
            value="17"
            context={canViewMargin ? "kombinacija cena" : "zahtevaju odobrenje"}
            tone="warning"
            icon="warning"
          />
          <Metric
            label="Uskoro ističe"
            value="3"
            context="u narednih 30 dana"
            tone="danger"
            icon="clock"
          />
        </div>
        <div className="portal-grid" data-layout="wide-left">
          <Panel>
            <SectionHeader
              title="Aktivna pravila cena"
              description="Redosled prioriteta određuje koja cena pobeđuje"
              action={
                <Link href="/portal/cene/pravila" className="portal-text-link">
                  Upravljaj pravilima
                </Link>
              }
            />
            <div className="portal-table-wrap">
              <table className="portal-table">
                <thead>
                  <tr>
                    <th>Pravilo</th>
                    <th>Prioritet</th>
                    <th>Tip</th>
                    <th>Vrednost</th>
                    <th>Cilj</th>
                    {canViewMargin ? <th>Marža min.</th> : null}
                    <th>Status</th>
                    <th>Važi</th>
                  </tr>
                </thead>
                <tbody>
                  {priceRules.map((rule) => (
                    <tr key={rule.id}>
                      <td>
                        <strong>{rule.name}</strong>
                        <small>{rule.reason}</small>
                      </td>
                      <td>
                        <span className="portal-priority-number">
                          {rule.priority}
                        </span>
                      </td>
                      <td>{priceTypeLabels[rule.type]}</td>
                      <td className="portal-table-number">
                        {rule.type === "fixed"
                          ? formatCurrency(rule.value)
                          : `${rule.value}%`}
                      </td>
                      <td>
                        {[
                          ...(rule.target.customerIds ?? []),
                          ...(rule.target.customerSegments ?? []),
                          ...(rule.target.regions ?? []),
                          ...(rule.target.manufacturers ?? []),
                          ...(rule.target.productGroups ?? []),
                        ]
                          .slice(0, 3)
                          .join(" · ")}
                      </td>
                      {canViewMargin ? <td>{rule.minimumMargin}%</td> : null}
                      <td>
                        <Badge tone={statusTone(rule.status)}>
                          {rule.status}
                        </Badge>
                      </td>
                      <td>
                        {formatDate(rule.validFrom)}
                        {rule.validTo ? ` · ${formatDate(rule.validTo)}` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
          <Panel>
            <SectionHeader
              title="Zaštita marže"
              description="Najvažnija aktivna odstupanja"
            />
            <div className="portal-list">
              {[
                [
                  canViewMargin
                    ? "Cena ispod minimuma"
                    : "Cena zahteva odobrenje",
                  canViewMargin
                    ? "5 kombinacija · najniža marža 14,8%"
                    : "5 kombinacija je van dozvoljenog opsega",
                  "danger",
                ],
                [
                  "Preklapanje pravila",
                  "8 kombinacija ima dva aktivna pravila",
                  "warning",
                ],
                [
                  "Kupac sa dugovanjem",
                  "3 kupca imaju dodatni rabat",
                  "warning",
                ],
                [
                  "Odobrena cena je viša",
                  "1 nova cena ruši prethodno odobrenu",
                  "danger",
                ],
              ].map(([title, description, tone]) => (
                <div className="portal-list-item" key={title}>
                  <span className="portal-list-marker" data-tone={tone}>
                    <PortalIcon name="warning" />
                  </span>
                  <span>
                    <strong>{title}</strong>
                    <small>{description}</small>
                  </span>
                  <PortalIcon name="chevron" />
                </div>
              ))}
            </div>
          </Panel>
        </div>
        <Panel>
          <SectionHeader
            title="Posebne cene"
            description="Primeri pravila koja pobeđuju u cenovnoj hijerarhiji"
            action={
              <PortalButton
                icon="download"
                disabled
                title="Izvoz posebnih cena nije implementiran u frontend prototipu."
              >
                Izvezi · mock
              </PortalButton>
            }
          />
          <div className="portal-table-wrap">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Kupac</th>
                  <th>Proizvod</th>
                  <th>Kataloška cena</th>
                  <th>Posebna cena</th>
                  {can(role, "prices:view_margin") ? <th>Marža</th> : null}
                  <th>Pobedničko pravilo</th>
                  <th>Važi do</th>
                </tr>
              </thead>
              <tbody>
                {customers.slice(0, 7).map((customer, index) => {
                  const product = products[index];
                  return (
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
                        <strong>{product.name}</strong>
                        <small>{product.sku}</small>
                      </td>
                      <td className="portal-table-number">
                        {formatCurrency(product.basePrice)}
                      </td>
                      <td className="portal-table-number">
                        <strong>
                          {formatCurrency(
                            Math.round(
                              product.basePrice *
                                (1 - customer.baseDiscount / 100),
                            ),
                          )}
                        </strong>
                      </td>
                      {can(role, "prices:view_margin") ? (
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
                      <td>
                        <Badge tone="info">
                          {index % 2 === 0
                            ? "individualna grupa"
                            : "pravilo segmenta"}
                        </Badge>
                      </td>
                      <td>{index % 3 === 0 ? "30. sep 2026." : "Bez roka"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </ModuleState>
    </AccessGuard>
  );
}

type BulkOperation =
  | "set_rebate"
  | "increase_rebate"
  | "decrease_rebate"
  | "fixed_price"
  | "increase_price"
  | "decrease_price"
  | "quantity_rebate";

type FilterOption = { value: string; label: string };

const operationLabels: Record<BulkOperation, string> = {
  set_rebate: "Postavi rabat",
  increase_rebate: "Povećaj rabat",
  decrease_rebate: "Smanji rabat",
  fixed_price: "Postavi fiksnu cenu",
  increase_price: "Povećaj cenu za %",
  decrease_price: "Smanji cenu za %",
  quantity_rebate: "Količinski rabat",
};

function operationType(operation: BulkOperation): PriceChangeType {
  if (operation === "set_rebate") return "rebate";
  if (operation === "increase_rebate") return "rebate_increase";
  if (operation === "decrease_rebate") return "rebate_decrease";
  if (operation === "fixed_price") return "fixed";
  if (operation === "increase_price") return "increase_percent";
  if (operation === "decrease_price") return "decrease_percent";
  return "quantity";
}

function MultiFilter({
  label,
  options,
  selected,
  onChange,
  disabled = false,
}: {
  label: string;
  options: FilterOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  return (
    <details className="portal-multi-filter">
      <summary
        aria-disabled={disabled}
        onClick={(event) => {
          if (disabled) event.preventDefault();
        }}
      >
        {label}
        {selected.length ? <Badge tone="info">{selected.length}</Badge> : null}
        <PortalIcon name="chevron" />
      </summary>
      <div>
        {options.map((option) => (
          <label key={option.value}>
            <input
              type="checkbox"
              disabled={disabled}
              checked={selected.includes(option.value)}
              onChange={() =>
                onChange(
                  selected.includes(option.value)
                    ? selected.filter((item) => item !== option.value)
                    : [...selected, option.value],
                )
              }
            />
            <span>{option.label}</span>
          </label>
        ))}
        {selected.length && !disabled ? (
          <button type="button" onClick={() => onChange([])}>
            Očisti izbor
          </button>
        ) : null}
      </div>
    </details>
  );
}

function TablePagination({
  page,
  pages,
  total,
  onChange,
}: {
  page: number;
  pages: number;
  total: number;
  onChange: (page: number) => void;
}) {
  return (
    <footer className="portal-pagination">
      <span>{total} rezultata</span>
      <div>
        <button disabled={page === 1} onClick={() => onChange(page - 1)}>
          Prethodna
        </button>
        {Array.from({ length: pages }, (_, index) => index + 1).map((item) => (
          <button
            key={item}
            data-active={item === page}
            onClick={() => onChange(item)}
          >
            {item}
          </button>
        ))}
        <button disabled={page === pages} onClick={() => onChange(page + 1)}>
          Sledeća
        </button>
      </div>
    </footer>
  );
}

function outcomeTone(outcome: PricePreviewRow["outcome"]) {
  if (outcome === "blocked") return "danger" as const;
  if (outcome === "warning" || outcome === "approval")
    return "warning" as const;
  if (outcome === "manual") return "info" as const;
  if (outcome === "excluded") return "neutral" as const;
  return "success" as const;
}

const outcomeLabel: Record<NonNullable<PricePreviewRow["outcome"]>, string> = {
  ready: "spremno",
  warning: "upozorenje",
  approval: "potrebno odobrenje",
  blocked: "blokirano",
  manual: "ručno korigovano",
  excluded: "isključeno",
};

export function PricingRules() {
  const { role, user, priceRules, notify, addPriceBatch, submitApproval } =
    usePortal();
  const canManage = can(role, "prices:manage");
  const canViewMargin = can(role, "prices:view_margin");
  const access = can(role, "prices:view");
  const scopedCustomers = useMemo(
    () =>
      role === "sales"
        ? customers.filter((customer) => customer.salesRepId === user.id)
        : customers,
    [role, user.id],
  );
  const [view, setView] = useState<"bulk" | "rules">("bulk");
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerReps, setCustomerReps] = useState<string[]>(
    role === "sales" ? [user.id] : [],
  );
  const [customerSegments, setCustomerSegments] = useState<string[]>([]);
  const [customerRegions, setCustomerRegions] = useState<string[]>([]);
  const [customerCities, setCustomerCities] = useState<string[]>([]);
  const [customerStatus, setCustomerStatus] = useState("all");
  const [customerDebt, setCustomerDebt] = useState("all");
  const [customerActivity, setCustomerActivity] = useState("all");
  const [customerMoreOpen, setCustomerMoreOpen] = useState(false);
  const [customerPage, setCustomerPage] = useState(1);
  const [customerSelectionMode, setCustomerSelectionMode] = useState<
    "manual" | "allFiltered"
  >("manual");
  const [customerIds, setCustomerIds] = useState<string[]>([]);

  const [productQuery, setProductQuery] = useState("");
  const [productManufacturers, setProductManufacturers] = useState<string[]>(
    [],
  );
  const [productGroupsFilter, setProductGroupsFilter] = useState<string[]>([]);
  const [productSubgroups, setProductSubgroups] = useState<string[]>([]);
  const [productStatus, setProductStatus] = useState("all");
  const [productAvailability, setProductAvailability] = useState("all");
  const [productMoreOpen, setProductMoreOpen] = useState(false);
  const [productPage, setProductPage] = useState(1);
  const [productSelectionMode, setProductSelectionMode] = useState<
    "manual" | "allFiltered"
  >("manual");
  const [productIds, setProductIds] = useState<string[]>([]);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [operation, setOperation] = useState<BulkOperation>("set_rebate");
  const [value, setValue] = useState(10);
  const [minimumMargin, setMinimumMargin] = useState(18);
  const [validFrom, setValidFrom] = useState("2026-08-15");
  const [validTo, setValidTo] = useState("2026-09-30");
  const [noEnd, setNoEnd] = useState(false);
  const [reason, setReason] = useState("");
  const [batchName, setBatchName] = useState("");
  const [rows, setRows] = useState<PricePreviewRow[]>([]);
  const [previewing, setPreviewing] = useState(false);
  const [previewDone, setPreviewDone] = useState(false);
  const [previewQuery, setPreviewQuery] = useState("");
  const [previewStatus, setPreviewStatus] = useState("all");
  const [previewDirection, setPreviewDirection] = useState("all");
  const [detailRowId, setDetailRowId] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [completedBatchId, setCompletedBatchId] = useState("");

  useDialogDismiss(() => setCustomerMoreOpen(false), customerMoreOpen);
  useDialogDismiss(() => setProductMoreOpen(false), productMoreOpen);
  useDialogDismiss(() => setSettingsOpen(false), settingsOpen);
  useDialogDismiss(() => setDetailRowId(""), Boolean(detailRowId));
  useDialogDismiss(() => setConfirmOpen(false), confirmOpen);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setView(params.get("view") === "rules" ? "rules" : "bulk");
    const customerId = params.get("customer");
    if (
      customerId &&
      scopedCustomers.some((customer) => customer.id === customerId)
    ) {
      setCustomerIds([customerId]);
      setCustomerSelectionMode("manual");
    }
  }, [scopedCustomers]);

  const salesRepOptions = useMemo(
    () =>
      Array.from(
        new Map(
          scopedCustomers.map((customer) => [
            customer.salesRepId,
            customer.salesRepName,
          ]),
        ),
      ).map(([value, label]) => ({ value, label })),
    [scopedCustomers],
  );
  const regionOptions = useMemo(
    () =>
      [...new Set(scopedCustomers.map((customer) => customer.region))].map(
        (value) => ({ value, label: value }),
      ),
    [scopedCustomers],
  );
  const cityOptions = useMemo(
    () =>
      [...new Set(scopedCustomers.map((customer) => customer.city))].map(
        (value) => ({ value, label: value }),
      ),
    [scopedCustomers],
  );
  const subgroupOptions = useMemo(
    () =>
      [...new Set(products.map((product) => product.subgroup))].map(
        (value) => ({
          value,
          label: value,
        }),
      ),
    [],
  );

  const filteredCustomers = useMemo(() => {
    const query = customerQuery.trim().toLocaleLowerCase("sr");
    return scopedCustomers.filter((customer) => {
      const queryMatch =
        !query ||
        `${customer.companyName} ${customer.code} ${customer.pib} ${customer.city}`
          .toLocaleLowerCase("sr")
          .includes(query);
      const debtMatch =
        customerDebt === "all" ||
        (customerDebt === "overdue" && customer.financial.overdueDebt > 0) ||
        (customerDebt === "limit" &&
          customer.financial.debt > customer.financial.creditLimit) ||
        (customerDebt === "clear" && customer.financial.overdueDebt === 0);
      const activityMatch =
        customerActivity === "all" ||
        (customerActivity === "30" &&
          customer.sales.daysSinceLastOrder <= 30) ||
        (customerActivity === "60" && customer.sales.daysSinceLastOrder > 30) ||
        (customerActivity === "inactive" &&
          customer.sales.daysSinceLastOrder > 60);
      return (
        queryMatch &&
        (!customerReps.length || customerReps.includes(customer.salesRepId)) &&
        (!customerSegments.length ||
          customerSegments.includes(customer.segment)) &&
        (!customerRegions.length ||
          customerRegions.includes(customer.region)) &&
        (!customerCities.length || customerCities.includes(customer.city)) &&
        (customerStatus === "all" || customer.status === customerStatus) &&
        debtMatch &&
        activityMatch
      );
    });
  }, [
    scopedCustomers,
    customerQuery,
    customerReps,
    customerSegments,
    customerRegions,
    customerCities,
    customerStatus,
    customerDebt,
    customerActivity,
  ]);

  const filteredProducts = useMemo(() => {
    const query = productQuery.trim().toLocaleLowerCase("sr");
    return products.filter(
      (product) =>
        (!query ||
          `${product.name} ${product.sku} ${product.catalogNumber}`
            .toLocaleLowerCase("sr")
            .includes(query)) &&
        (!productManufacturers.length ||
          productManufacturers.includes(product.manufacturer)) &&
        (!productGroupsFilter.length ||
          productGroupsFilter.includes(product.group)) &&
        (!productSubgroups.length ||
          productSubgroups.includes(product.subgroup)) &&
        (productStatus === "all" || product.status === productStatus) &&
        (productAvailability === "all" ||
          product.availability === productAvailability),
    );
  }, [
    productQuery,
    productManufacturers,
    productGroupsFilter,
    productSubgroups,
    productStatus,
    productAvailability,
  ]);

  const customerPageSize = 5;
  const productPageSize = 6;
  const customerPages = Math.max(
    1,
    Math.ceil(filteredCustomers.length / customerPageSize),
  );
  const productPages = Math.max(
    1,
    Math.ceil(filteredProducts.length / productPageSize),
  );
  const customerPageRows = filteredCustomers.slice(
    (Math.min(customerPage, customerPages) - 1) * customerPageSize,
    Math.min(customerPage, customerPages) * customerPageSize,
  );
  const productPageRows = filteredProducts.slice(
    (Math.min(productPage, productPages) - 1) * productPageSize,
    Math.min(productPage, productPages) * productPageSize,
  );
  const selectedCustomerIds =
    customerSelectionMode === "allFiltered"
      ? filteredCustomers.map((customer) => customer.id)
      : customerIds;
  const selectedProductIds =
    productSelectionMode === "allFiltered"
      ? filteredProducts.map((product) => product.id)
      : productIds;
  const validScope =
    selectedCustomerIds.length > 0 && selectedProductIds.length > 0;
  const settingsValid =
    validScope &&
    value > 0 &&
    Boolean(validFrom) &&
    Boolean(reason.trim()) &&
    (noEnd || !validTo || validTo >= validFrom);

  useEffect(() => {
    setCustomerPage(1);
  }, [
    customerQuery,
    customerReps,
    customerSegments,
    customerRegions,
    customerCities,
    customerStatus,
    customerDebt,
    customerActivity,
  ]);
  useEffect(() => {
    setProductPage(1);
  }, [
    productQuery,
    productManufacturers,
    productGroupsFilter,
    productSubgroups,
    productStatus,
    productAvailability,
  ]);

  function selectCustomer(id: string) {
    const source =
      customerSelectionMode === "allFiltered"
        ? filteredCustomers.map((customer) => customer.id)
        : customerIds;
    setCustomerSelectionMode("manual");
    setCustomerIds(
      source.includes(id)
        ? source.filter((item) => item !== id)
        : [...source, id],
    );
    setPreviewDone(false);
  }

  function selectProduct(id: string) {
    const source =
      productSelectionMode === "allFiltered"
        ? filteredProducts.map((product) => product.id)
        : productIds;
    setProductSelectionMode("manual");
    setProductIds(
      source.includes(id)
        ? source.filter((item) => item !== id)
        : [...source, id],
    );
    setPreviewDone(false);
  }

  function toggleCustomerPage() {
    const pageIds = customerPageRows.map((customer) => customer.id);
    const allSelected = pageIds.every((id) => selectedCustomerIds.includes(id));
    const source = [...selectedCustomerIds];
    setCustomerSelectionMode("manual");
    setCustomerIds(
      allSelected
        ? source.filter((id) => !pageIds.includes(id))
        : [...new Set([...source, ...pageIds])],
    );
  }

  function toggleProductPage() {
    const pageIds = productPageRows.map((product) => product.id);
    const allSelected = pageIds.every((id) => selectedProductIds.includes(id));
    const source = [...selectedProductIds];
    setProductSelectionMode("manual");
    setProductIds(
      allSelected
        ? source.filter((id) => !pageIds.includes(id))
        : [...new Set([...source, ...pageIds])],
    );
  }

  function resetCustomerFilters() {
    setCustomerQuery("");
    setCustomerReps(role === "sales" ? [user.id] : []);
    setCustomerSegments([]);
    setCustomerRegions([]);
    setCustomerCities([]);
    setCustomerStatus("all");
    setCustomerDebt("all");
    setCustomerActivity("all");
  }

  function resetProductFilters() {
    setProductQuery("");
    setProductManufacturers([]);
    setProductGroupsFilter([]);
    setProductSubgroups([]);
    setProductStatus("all");
    setProductAvailability("all");
  }

  function changeView(next: "bulk" | "rules") {
    setView(next);
    const path =
      next === "rules"
        ? "/portal/cene/pravila?view=rules"
        : "/portal/cene/pravila";
    window.history.replaceState(null, "", path);
  }

  function classifyRow(row: PricePreviewRow): PricePreviewRow["outcome"] {
    const customer = customers.find((item) => item.id === row.customerId);
    if (!Number.isFinite(row.newPrice) || row.newPrice <= 0) return "blocked";
    if (row.newMargin < minimumMargin) return "blocked";
    if (
      customer &&
      (customer.financial.debt > customer.financial.creditLimit ||
        customer.financial.overdueDebt > 150000)
    )
      return "approval";
    if (row.warning) return "warning";
    return "ready";
  }

  async function preview() {
    if (!settingsValid || previewing) return;
    setPreviewing(true);
    setCompletedBatchId("");
    const result = await mockPortalService.previewPriceChange({
      target: {
        customerIds: selectedCustomerIds,
        productIds: selectedProductIds,
      },
      type: operationType(operation),
      value,
      minimumMargin,
    });
    const classified = result.map((row) => ({
      ...row,
      outcome: classifyRow(row),
    }));
    setRows(classified);
    setPreviewDone(true);
    setSettingsOpen(false);
    setPreviewing(false);
    notify(
      classified.length ? "Pregled je spreman" : "Nema pogođenih kombinacija",
      classified.length
        ? `${classified.length} kombinacija je obračunato bez primene izmene.`
        : "Izabrani kupci i proizvodi nemaju zajednički obračun.",
      classified.length ? "success" : "warning",
    );
  }

  function editPrice(row: PricePreviewRow, nextPrice: number) {
    if (!Number.isFinite(nextPrice) || nextPrice <= 0) return;
    const product = products.find((item) => item.id === row.productId);
    if (!product) return;
    const nextMargin =
      Math.round(((nextPrice - product.purchasePrice) / nextPrice) * 1000) / 10;
    const nextRebate =
      Math.round((1 - nextPrice / product.basePrice) * 1000) / 10;
    setRows((current) =>
      current.map((item) =>
        item.id === row.id
          ? {
              ...item,
              newPrice: nextPrice,
              newDiscount: nextRebate,
              newMargin: nextMargin,
              difference: nextPrice - item.currentPrice,
              warning:
                nextMargin < minimumMargin
                  ? `Marža ${nextMargin}% je ispod minimuma ${minimumMargin}%`
                  : item.warning?.includes("Marža")
                    ? undefined
                    : item.warning,
              outcome: nextMargin < minimumMargin ? "blocked" : "manual",
            }
          : item,
      ),
    );
    setCompletedBatchId("");
  }

  function editRebate(row: PricePreviewRow, rebate: number) {
    if (!Number.isFinite(rebate) || rebate < 0 || rebate >= 100) return;
    const product = products.find((item) => item.id === row.productId);
    if (!product) return;
    editPrice(
      row,
      Math.max(1, Math.round(product.basePrice * (1 - rebate / 100))),
    );
  }

  function toggleExcluded(row: PricePreviewRow) {
    setRows((current) =>
      current.map((item) =>
        item.id === row.id ? { ...item, excluded: !item.excluded } : item,
      ),
    );
    setCompletedBatchId("");
  }

  const displayRows = rows.filter((row) => {
    const effectiveOutcome = row.excluded ? "excluded" : row.outcome;
    const queryMatch =
      !previewQuery ||
      `${row.customerName} ${row.productName}`
        .toLocaleLowerCase("sr")
        .includes(previewQuery.toLocaleLowerCase("sr"));
    const statusMatch =
      previewStatus === "all" || effectiveOutcome === previewStatus;
    const directionMatch =
      previewDirection === "all" ||
      (previewDirection === "lower" && row.difference < 0) ||
      (previewDirection === "higher" && row.difference > 0) ||
      (previewDirection === "same" && row.difference === 0);
    return queryMatch && statusMatch && directionMatch;
  });
  const applicableRows = rows.filter(
    (row) => !row.excluded && row.outcome !== "blocked",
  );
  const blockedCount = rows.filter(
    (row) => !row.excluded && row.outcome === "blocked",
  ).length;
  const excludedCount = rows.filter((row) => row.excluded).length;
  const warningCount = rows.filter(
    (row) => !row.excluded && row.outcome === "warning",
  ).length;
  const approvalCount = rows.filter(
    (row) => !row.excluded && row.outcome === "approval",
  ).length;
  const manualCount = rows.filter(
    (row) => !row.excluded && row.outcome === "manual",
  ).length;
  const impactedCustomers = new Set(
    applicableRows.map((row) => row.customerId),
  );
  const impactedProducts = new Set(applicableRows.map((row) => row.productId));
  const averageCurrent = applicableRows.length
    ? applicableRows.reduce((sum, row) => sum + row.currentPrice, 0) /
      applicableRows.length
    : 0;
  const averageNext = applicableRows.length
    ? applicableRows.reduce((sum, row) => sum + row.newPrice, 0) /
      applicableRows.length
    : 0;
  const detailRow = rows.find((row) => row.id === detailRowId);

  async function applyChange() {
    if (!applicableRows.length || applying || completedBatchId) return;
    setApplying(true);
    const batchId = `batch-${Date.now()}`;
    const status: PriceChangeBatch["status"] = canManage
      ? "primenjeno"
      : "čeka odobrenje";
    const batch: PriceChangeBatch = {
      id: batchId,
      name:
        batchName.trim() ||
        `${operationLabels[operation]} · ${new Date().toLocaleDateString("sr-Latn-RS")}`,
      reason: reason.trim(),
      type: operationType(operation),
      value,
      target: {
        customerIds: selectedCustomerIds,
        productIds: selectedProductIds,
      },
      validFrom,
      validTo: noEnd ? undefined : validTo || undefined,
      minimumMargin,
      rows,
      status,
      createdBy: user.name,
      createdAt: new Date().toISOString(),
    };
    const result = await mockPortalService.applyMockPriceChange(batch);
    addPriceBatch(batch);
    if (!canManage) {
      const firstRow = applicableRows[0];
      const approval: ApprovalRequest = {
        id: `apr-${batchId}`,
        type: approvalCount ? "kupac preko limita" : "posebna cena",
        requestedBy: user.name,
        requestedAt: new Date().toISOString(),
        customerId: firstRow.customerId,
        customerName:
          impactedCustomers.size === 1
            ? firstRow.customerName
            : `${impactedCustomers.size} kupaca`,
        reason: `${reason.trim()} · ${applicableRows.length} kombinacija`,
        currentValue: `${formatCurrency(firstRow.currentPrice)} · rabat ${firstRow.currentDiscount}%`,
        proposedValue: `${formatCurrency(firstRow.newPrice)} · rabat ${firstRow.newDiscount}%`,
        financialEffect: applicableRows.reduce(
          (sum, row) => sum + row.difference,
          0,
        ),
        risk: approvalCount ? "visok" : "srednji",
        status: "čeka",
        priceBatchId: batchId,
        productId: firstRow.productId,
        productName: firstRow.productName,
        proposedPrice: firstRow.newPrice,
        proposedMargin: firstRow.newMargin,
      };
      submitApproval(approval, { logEvent: false });
    }
    setApplying(false);
    setConfirmOpen(false);
    setCompletedBatchId(batchId);
    notify(
      canManage ? "Bulk rabat je primenjen" : "Zahtev je poslat gazdi",
      `${result.affectedRows} kombinacija je sačuvano u istoriji promene.`,
      "success",
    );
  }

  const activeCustomerFilters = [
    ...customerReps.map((value) => ({
      key: `rep-${value}`,
      label:
        salesRepOptions.find((item) => item.value === value)?.label || value,
      clear: () =>
        setCustomerReps((current) => current.filter((item) => item !== value)),
    })),
    ...customerSegments.map((value) => ({
      key: `seg-${value}`,
      label: `Segment: ${value}`,
      clear: () =>
        setCustomerSegments((current) =>
          current.filter((item) => item !== value),
        ),
    })),
    ...customerRegions.map((value) => ({
      key: `reg-${value}`,
      label: value,
      clear: () =>
        setCustomerRegions((current) =>
          current.filter((item) => item !== value),
        ),
    })),
    ...customerCities.map((value) => ({
      key: `city-${value}`,
      label: value,
      clear: () =>
        setCustomerCities((current) =>
          current.filter((item) => item !== value),
        ),
    })),
    ...(customerStatus !== "all"
      ? [
          {
            key: "status",
            label: `Status: ${customerStatus}`,
            clear: () => setCustomerStatus("all"),
          },
        ]
      : []),
    ...(customerDebt !== "all"
      ? [
          {
            key: "debt",
            label: "Dugovanje",
            clear: () => setCustomerDebt("all"),
          },
        ]
      : []),
    ...(customerActivity !== "all"
      ? [
          {
            key: "activity",
            label: "Aktivnost",
            clear: () => setCustomerActivity("all"),
          },
        ]
      : []),
  ];
  const activeProductFilters = [
    ...productManufacturers.map((value) => ({
      key: `manufacturer-${value}`,
      label: value,
      clear: () =>
        setProductManufacturers((current) =>
          current.filter((item) => item !== value),
        ),
    })),
    ...productGroupsFilter.map((value) => ({
      key: `group-${value}`,
      label: value,
      clear: () =>
        setProductGroupsFilter((current) =>
          current.filter((item) => item !== value),
        ),
    })),
    ...productSubgroups.map((value) => ({
      key: `subgroup-${value}`,
      label: value,
      clear: () =>
        setProductSubgroups((current) =>
          current.filter((item) => item !== value),
        ),
    })),
    ...(productStatus !== "all"
      ? [
          {
            key: "product-status",
            label: `Status: ${productStatus}`,
            clear: () => setProductStatus("all"),
          },
        ]
      : []),
    ...(productAvailability !== "all"
      ? [
          {
            key: "availability",
            label: productAvailability,
            clear: () => setProductAvailability("all"),
          },
        ]
      : []),
  ];

  if (!access) return <StateView state="permission" />;
  if (view === "rules") {
    return (
      <>
        <PageHeader
          eyebrow="Komercijalna politika"
          title="Pravila rabata"
          description="Aktivna, zakazana i istekla pravila prikazana po nivou prioriteta."
          actions={
            <PortalLinkButton href="/portal/cene/istorija" icon="clock">
              Istorija promena
            </PortalLinkButton>
          }
        />
        <PricingNav active="rules" onViewChange={changeView} />
        <Panel>
          <SectionHeader
            title={`${priceRules.length} pravila rabata`}
            description="Najspecifičnije pravilo ima prednost nad opštim cenovnikom."
          />
          <div className="portal-table-wrap">
            <table className="portal-table portal-rebate-rules-table">
              <thead>
                <tr>
                  <th>Prioritet</th>
                  <th>Pravilo</th>
                  <th>Tip i vrednost</th>
                  <th>Obuhvat</th>
                  <th>Važenje</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {priceRules.map((rule) => (
                  <tr key={rule.id}>
                    <td>
                      <span className="portal-priority-number">
                        {rule.priority}
                      </span>
                    </td>
                    <td>
                      <strong>{rule.name}</strong>
                      <small>{rule.reason}</small>
                    </td>
                    <td>
                      {priceTypeLabels[rule.type]} ·{" "}
                      {rule.type === "fixed"
                        ? formatCurrency(rule.value)
                        : `${rule.value}%`}
                    </td>
                    <td>
                      {rule.target.customerIds?.length ||
                        rule.target.customerSegments?.length ||
                        0}{" "}
                      kupaca/segmenata ·{" "}
                      {rule.target.productIds?.length ||
                        rule.target.productGroups?.length ||
                        0}{" "}
                      proizvoda/grupa
                    </td>
                    <td>
                      {formatDate(rule.validFrom)}
                      {rule.validTo
                        ? ` – ${formatDate(rule.validTo)}`
                        : " – bez roka"}
                    </td>
                    <td>
                      <Badge tone={statusTone(rule.status)}>
                        {rule.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Komercijalna politika"
        title="Bulk rabati"
        description="Izaberite kupce i proizvode, proverite efekat i primenite mock izmenu sa audit tragom."
        actions={
          <>
            <PortalLinkButton href="/portal/cene/istorija" icon="clock">
              Istorija promena
            </PortalLinkButton>
            <PortalButton
              variant="primary"
              icon="prices"
              disabled={!validScope}
              onClick={() => setSettingsOpen(true)}
              title={
                !validScope
                  ? "Izaberite najmanje jednog kupca i jedan proizvod."
                  : undefined
              }
            >
              Podesi bulk rabat
            </PortalButton>
          </>
        }
      />
      <PricingNav active="bulk" onViewChange={changeView} />
      <ModuleState>
        <div className="portal-bulk-rebate-flow">
          <div className="portal-scope-summary" aria-live="polite">
            <div>
              <span>Kupci</span>
              <strong>{selectedCustomerIds.length} izabrano</strong>
              <small>
                {customerSelectionMode === "allFiltered"
                  ? "svi filtrirani"
                  : "ručni izbor"}
              </small>
            </div>
            <PortalIcon name="arrow" />
            <div>
              <span>Proizvodi</span>
              <strong>{selectedProductIds.length} izabrano</strong>
              <small>
                {productSelectionMode === "allFiltered"
                  ? "svi filtrirani"
                  : "ručni izbor"}
              </small>
            </div>
            <div className="portal-scope-logic">
              <span>Logika filtera</span>
              <strong>ILI unutar filtera · I između kategorija</strong>
              <small>
                {filteredCustomers.length} kupaca × {filteredProducts.length}{" "}
                proizvoda u rezultatu
              </small>
            </div>
          </div>

          <Panel className="portal-scope-panel">
            <SectionHeader
              title="1. Izaberite kupce"
              description={`${filteredCustomers.length} od ${scopedCustomers.length} kupaca odgovara filterima`}
              action={
                <PortalButton
                  variant="ghost"
                  icon="close"
                  onClick={resetCustomerFilters}
                >
                  Resetuj filtere
                </PortalButton>
              }
            />
            <div className="portal-scope-filterbar">
              <label className="portal-search-field">
                <PortalIcon name="search" />
                <input
                  value={customerQuery}
                  onChange={(event) => setCustomerQuery(event.target.value)}
                  placeholder="Naziv, šifra, PIB ili grad"
                />
              </label>
              <MultiFilter
                label="Komercijalista"
                options={salesRepOptions}
                selected={customerReps}
                onChange={setCustomerReps}
                disabled={role === "sales"}
              />
              <MultiFilter
                label="Segment"
                options={["ključni", "standard", "razvojni", "rizični"].map(
                  (value) => ({ value, label: value }),
                )}
                selected={customerSegments}
                onChange={setCustomerSegments}
              />
              <MultiFilter
                label="Region"
                options={regionOptions}
                selected={customerRegions}
                onChange={setCustomerRegions}
              />
              <MultiFilter
                label="Grad"
                options={cityOptions}
                selected={customerCities}
                onChange={setCustomerCities}
              />
              <PortalButton
                icon="filter"
                onClick={() => setCustomerMoreOpen(true)}
              >
                Još filtera
              </PortalButton>
            </div>
            {activeCustomerFilters.length ? (
              <div className="portal-filter-chips">
                {activeCustomerFilters.map((filter) => (
                  <button key={filter.key} onClick={filter.clear}>
                    {filter.label}
                    <PortalIcon name="close" />
                  </button>
                ))}
              </div>
            ) : null}
            <div className="portal-selection-control">
              <span>
                <strong>{selectedCustomerIds.length}</strong> kupaca izabrano
              </span>
              <div>
                <button
                  onClick={() => {
                    setCustomerSelectionMode("allFiltered");
                    setPreviewDone(false);
                  }}
                >
                  Izaberi sve filtrirane ({filteredCustomers.length})
                </button>
                <button
                  onClick={() => {
                    setCustomerSelectionMode("manual");
                    setCustomerIds([]);
                    setPreviewDone(false);
                  }}
                >
                  Poništi izbor
                </button>
              </div>
            </div>
            <div className="portal-table-wrap">
              <table className="portal-table portal-scope-table">
                <thead>
                  <tr>
                    <th>
                      <SelectionCheckbox
                        checked={
                          customerPageRows.length > 0 &&
                          customerPageRows.every((item) =>
                            selectedCustomerIds.includes(item.id),
                          )
                        }
                        mixed={
                          customerPageRows.some((item) =>
                            selectedCustomerIds.includes(item.id),
                          ) &&
                          !customerPageRows.every((item) =>
                            selectedCustomerIds.includes(item.id),
                          )
                        }
                        label="Izaberi kupce na ovoj strani"
                        onChange={toggleCustomerPage}
                      />
                    </th>
                    <th>Kupac</th>
                    <th>Komercijalista</th>
                    <th>Segment</th>
                    <th>Region / grad</th>
                    <th>Status</th>
                    <th>Osnovni rabat</th>
                    <th>Dugovanje</th>
                    <th>Poslednja aktivnost</th>
                  </tr>
                </thead>
                <tbody>
                  {customerPageRows.map((customer) => (
                    <tr
                      key={customer.id}
                      data-selected={selectedCustomerIds.includes(customer.id)}
                    >
                      <td>
                        <SelectionCheckbox
                          checked={selectedCustomerIds.includes(customer.id)}
                          label={`Izaberi ${customer.companyName}`}
                          onChange={() => selectCustomer(customer.id)}
                        />
                      </td>
                      <td>
                        <strong>{customer.companyName}</strong>
                        <small>
                          {customer.code} · PIB {customer.pib}
                        </small>
                      </td>
                      <td>{customer.salesRepName}</td>
                      <td>{customer.segment}</td>
                      <td>
                        {customer.region}
                        <small>{customer.city}</small>
                      </td>
                      <td>
                        <Badge tone={statusTone(customer.status)}>
                          {customer.status}
                        </Badge>
                      </td>
                      <td>{customer.baseDiscount}%</td>
                      <td className="portal-table-number">
                        {formatCurrency(customer.financial.debt)}
                      </td>
                      <td>pre {customer.sales.daysSinceLastOrder} dana</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!customerPageRows.length ? (
              <div className="portal-inline-empty">
                Nema kupaca za izabrane filtere.
              </div>
            ) : null}
            <TablePagination
              page={Math.min(customerPage, customerPages)}
              pages={customerPages}
              total={filteredCustomers.length}
              onChange={setCustomerPage}
            />
          </Panel>

          <Panel className="portal-scope-panel">
            <SectionHeader
              title="2. Izaberite proizvode"
              description={`${filteredProducts.length} od ${products.length} proizvoda odgovara filterima`}
              action={
                <PortalButton
                  variant="ghost"
                  icon="close"
                  onClick={resetProductFilters}
                >
                  Resetuj filtere
                </PortalButton>
              }
            />
            <div className="portal-scope-filterbar">
              <label className="portal-search-field">
                <PortalIcon name="search" />
                <input
                  value={productQuery}
                  onChange={(event) => setProductQuery(event.target.value)}
                  placeholder="Naziv, SKU ili kataloški broj"
                />
              </label>
              <MultiFilter
                label="Proizvođač"
                options={manufacturers.map((item) => ({
                  value: item.name,
                  label: item.name,
                }))}
                selected={productManufacturers}
                onChange={setProductManufacturers}
              />
              <MultiFilter
                label="Grupa"
                options={productGroups.map((item) => ({
                  value: item.name,
                  label: item.name,
                }))}
                selected={productGroupsFilter}
                onChange={setProductGroupsFilter}
              />
              <MultiFilter
                label="Podgrupa"
                options={subgroupOptions}
                selected={productSubgroups}
                onChange={setProductSubgroups}
              />
              <select
                className="portal-filter-select"
                value={productStatus}
                onChange={(event) => setProductStatus(event.target.value)}
                aria-label="Status proizvoda"
              >
                <option value="all">Svi statusi</option>
                <option value="aktivan">aktivan</option>
                <option value="povučen">povučen</option>
                <option value="najava">najava</option>
              </select>
              <PortalButton
                icon="filter"
                onClick={() => setProductMoreOpen(true)}
              >
                Još filtera
              </PortalButton>
            </div>
            {activeProductFilters.length ? (
              <div className="portal-filter-chips">
                {activeProductFilters.map((filter) => (
                  <button key={filter.key} onClick={filter.clear}>
                    {filter.label}
                    <PortalIcon name="close" />
                  </button>
                ))}
              </div>
            ) : null}
            <div className="portal-selection-control">
              <span>
                <strong>{selectedProductIds.length}</strong> proizvoda izabrano
              </span>
              <div>
                <button
                  onClick={() => {
                    setProductSelectionMode("allFiltered");
                    setPreviewDone(false);
                  }}
                >
                  Izaberi sve filtrirane ({filteredProducts.length})
                </button>
                <button
                  onClick={() => {
                    setProductSelectionMode("manual");
                    setProductIds([]);
                    setPreviewDone(false);
                  }}
                >
                  Poništi izbor
                </button>
              </div>
            </div>
            <div className="portal-table-wrap">
              <table className="portal-table portal-scope-table">
                <thead>
                  <tr>
                    <th>
                      <SelectionCheckbox
                        checked={
                          productPageRows.length > 0 &&
                          productPageRows.every((item) =>
                            selectedProductIds.includes(item.id),
                          )
                        }
                        mixed={
                          productPageRows.some((item) =>
                            selectedProductIds.includes(item.id),
                          ) &&
                          !productPageRows.every((item) =>
                            selectedProductIds.includes(item.id),
                          )
                        }
                        label="Izaberi proizvode na ovoj strani"
                        onChange={toggleProductPage}
                      />
                    </th>
                    <th>Proizvod</th>
                    <th>Proizvođač</th>
                    <th>Grupa / podgrupa</th>
                    <th>Status</th>
                    <th>Dostupnost</th>
                    <th>Kataloška cena</th>
                    <th>Prosečna marža</th>
                  </tr>
                </thead>
                <tbody>
                  {productPageRows.map((product) => (
                    <tr
                      key={product.id}
                      data-selected={selectedProductIds.includes(product.id)}
                    >
                      <td>
                        <SelectionCheckbox
                          checked={selectedProductIds.includes(product.id)}
                          label={`Izaberi ${product.name}`}
                          onChange={() => selectProduct(product.id)}
                        />
                      </td>
                      <td>
                        <strong>{product.name}</strong>
                        <small>
                          {product.sku} · {product.catalogNumber}
                        </small>
                      </td>
                      <td>{product.manufacturer}</td>
                      <td>
                        {product.group}
                        <small>{product.subgroup}</small>
                      </td>
                      <td>
                        <Badge tone={statusTone(product.status)}>
                          {product.status}
                        </Badge>
                      </td>
                      <td>{product.availability}</td>
                      <td className="portal-table-number">
                        {formatCurrency(product.basePrice)}
                      </td>
                      <td>
                        {canViewMargin
                          ? `${product.averageMargin}%`
                          : "zaštićeno"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!productPageRows.length ? (
              <div className="portal-inline-empty">
                Nema proizvoda za izabrane filtere.
              </div>
            ) : null}
            <TablePagination
              page={Math.min(productPage, productPages)}
              pages={productPages}
              total={filteredProducts.length}
              onChange={setProductPage}
            />
          </Panel>

          {previewDone ? (
            <section className="portal-rebate-preview">
              <div className="portal-pricing-impact portal-rebate-impact">
                <div>
                  <span>Pogođeni kupci</span>
                  <strong>{impactedCustomers.size}</strong>
                </div>
                <div>
                  <span>Pogođeni proizvodi</span>
                  <strong>{impactedProducts.size}</strong>
                </div>
                <div>
                  <span>Spremno za primenu</span>
                  <strong>{applicableRows.length}</strong>
                </div>
                <div>
                  <span>Prosečna cena</span>
                  <strong>{formatCurrency(averageNext)}</strong>
                  <Delta
                    value={
                      averageCurrent
                        ? Math.round(
                            ((averageNext - averageCurrent) / averageCurrent) *
                              1000,
                          ) / 10
                        : 0
                    }
                  />
                </div>
                <div>
                  <span>Upozorenja</span>
                  <strong>{warningCount}</strong>
                </div>
                <div>
                  <span>Odobrenje</span>
                  <strong>{approvalCount}</strong>
                </div>
                <div>
                  <span>Blokirano</span>
                  <strong>{blockedCount}</strong>
                </div>
                <div>
                  <span>Isključeno / ručno</span>
                  <strong>
                    {excludedCount} / {manualCount}
                  </strong>
                </div>
              </div>
              {completedBatchId ? (
                <div className="portal-workflow-success" role="status">
                  <PortalIcon name="check" />
                  <span>
                    <strong>
                      {canManage
                        ? "Mock izmena je primenjena"
                        : "Zahtev je poslat na odobrenje"}
                    </strong>
                    <small>
                      {completedBatchId} je dostupan u istoriji promena.
                    </small>
                  </span>
                  <div>
                    <PortalLinkButton href="/portal/cene/istorija">
                      Otvori istoriju
                    </PortalLinkButton>
                  </div>
                </div>
              ) : null}
              <Panel>
                <SectionHeader
                  title="3. Pregled pre potvrde"
                  description="Blokirani i isključeni redovi neće biti primenjeni. Ručne vrednosti imaju prednost."
                />
                <div className="portal-table-toolbar">
                  <label className="portal-search-field">
                    <PortalIcon name="search" />
                    <input
                      value={previewQuery}
                      onChange={(event) => setPreviewQuery(event.target.value)}
                      placeholder="Kupac ili proizvod"
                    />
                  </label>
                  <select
                    className="portal-filter-select"
                    value={previewStatus}
                    onChange={(event) => setPreviewStatus(event.target.value)}
                    aria-label="Status reda"
                  >
                    <option value="all">Svi statusi</option>
                    <option value="ready">spremno</option>
                    <option value="warning">upozorenje</option>
                    <option value="approval">potrebno odobrenje</option>
                    <option value="blocked">blokirano</option>
                    <option value="manual">ručno korigovano</option>
                    <option value="excluded">isključeno</option>
                  </select>
                  <select
                    className="portal-filter-select"
                    value={previewDirection}
                    onChange={(event) =>
                      setPreviewDirection(event.target.value)
                    }
                    aria-label="Smer promene"
                  >
                    <option value="all">Svi smerovi</option>
                    <option value="lower">Niža cena</option>
                    <option value="higher">Viša cena</option>
                    <option value="same">Bez promene</option>
                  </select>
                </div>
                <div className="portal-table-wrap">
                  <table className="portal-table portal-rebate-preview-table">
                    <thead>
                      <tr>
                        <th>Kupac</th>
                        <th>Proizvod</th>
                        <th>Trenutna cena</th>
                        <th>Trenutni rabat</th>
                        <th>Nova cena</th>
                        <th>Novi rabat</th>
                        {canViewMargin ? <th>Marža posle</th> : null}
                        <th>Razlika</th>
                        <th>Status</th>
                        <th>Akcije</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayRows.map((row) => {
                        const effectiveOutcome = row.excluded
                          ? "excluded"
                          : row.outcome || "ready";
                        return (
                          <tr key={row.id} data-state={effectiveOutcome}>
                            <td>
                              <strong>{row.customerName}</strong>
                            </td>
                            <td>
                              <strong>{row.productName}</strong>
                            </td>
                            <td>{formatCurrency(row.currentPrice)}</td>
                            <td>{row.currentDiscount}%</td>
                            <td>
                              <input
                                className="portal-price-input"
                                type="number"
                                min="1"
                                value={row.newPrice}
                                disabled={row.excluded}
                                aria-label={`Nova cena za ${row.customerName}`}
                                onChange={(event) =>
                                  editPrice(row, Number(event.target.value))
                                }
                              />
                            </td>
                            <td>
                              <input
                                className="portal-rebate-input"
                                type="number"
                                min="0"
                                max="99"
                                step="0.1"
                                value={row.newDiscount}
                                disabled={row.excluded}
                                aria-label={`Novi rabat za ${row.customerName}`}
                                onChange={(event) =>
                                  editRebate(row, Number(event.target.value))
                                }
                              />
                            </td>
                            {canViewMargin ? (
                              <td>
                                <Badge
                                  tone={
                                    row.newMargin < minimumMargin
                                      ? "danger"
                                      : "success"
                                  }
                                >
                                  {row.newMargin}%
                                </Badge>
                              </td>
                            ) : null}
                            <td>
                              <Delta value={row.difference} suffix=" RSD" />
                            </td>
                            <td>
                              <Badge tone={outcomeTone(effectiveOutcome)}>
                                {outcomeLabel[effectiveOutcome]}
                              </Badge>
                            </td>
                            <td>
                              <div className="portal-row-actions">
                                <button onClick={() => setDetailRowId(row.id)}>
                                  Detalji
                                </button>
                                <button
                                  data-danger={!row.excluded}
                                  onClick={() => toggleExcluded(row)}
                                >
                                  {row.excluded ? "Vrati" : "Isključi"}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {!displayRows.length ? (
                  <div className="portal-inline-empty">
                    Nema redova za izabrane preview filtere.
                  </div>
                ) : null}
              </Panel>
            </section>
          ) : null}
        </div>
        <div className="portal-rebate-action-slot">
          <div className="portal-rebate-actionbar">
            <div>
              <strong>
                {selectedCustomerIds.length} kupaca ×{" "}
                {selectedProductIds.length} proizvoda
              </strong>
              <span>
                {previewDone
                  ? `${applicableRows.length} spremno · ${blockedCount} blokirano · ${excludedCount} isključeno`
                  : "Podesite rabat da biste izračunali pregled."}
              </span>
            </div>
            <PortalButton
              icon="settings"
              disabled={!validScope}
              onClick={() => setSettingsOpen(true)}
            >
              Podesi bulk rabat
            </PortalButton>
            {previewDone ? (
              <PortalButton
                variant="primary"
                icon={canManage ? "check" : "approval"}
                disabled={!applicableRows.length || Boolean(completedBatchId)}
                onClick={() => setConfirmOpen(true)}
              >
                {canManage ? "Primeni izmene" : "Pošalji na odobrenje"}
              </PortalButton>
            ) : null}
          </div>
        </div>
      </ModuleState>

      {customerMoreOpen ? (
        <div
          className="portal-drawer-layer"
          role="dialog"
          aria-modal="true"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target)
              setCustomerMoreOpen(false);
          }}
        >
          <aside className="portal-drawer portal-filter-drawer">
            <header>
              <div>
                <span>Filteri kupaca</span>
                <h2>Još filtera</h2>
                <p>Filteri se kombinuju logikom I.</p>
              </div>
              <button
                className="portal-icon-button"
                onClick={() => setCustomerMoreOpen(false)}
              >
                <PortalIcon name="close" />
              </button>
            </header>
            <div className="portal-drawer-scroll portal-panel-body">
              <div className="portal-form-grid">
                <label className="portal-field">
                  <span>Status kupca</span>
                  <select
                    value={customerStatus}
                    onChange={(event) => setCustomerStatus(event.target.value)}
                  >
                    <option value="all">Svi statusi</option>
                    <option value="aktivan">aktivan</option>
                    <option value="u padu">u padu</option>
                    <option value="nov">nov</option>
                    <option value="blokiran">blokiran</option>
                    <option value="neaktivan">neaktivan</option>
                  </select>
                </label>
                <label className="portal-field">
                  <span>Dugovanje</span>
                  <select
                    value={customerDebt}
                    onChange={(event) => setCustomerDebt(event.target.value)}
                  >
                    <option value="all">Sva dugovanja</option>
                    <option value="overdue">Ima dospelo dugovanje</option>
                    <option value="limit">Preko kreditnog limita</option>
                    <option value="clear">Bez dospelog duga</option>
                  </select>
                </label>
                <label className="portal-field">
                  <span>Aktivnost</span>
                  <select
                    value={customerActivity}
                    onChange={(event) =>
                      setCustomerActivity(event.target.value)
                    }
                  >
                    <option value="all">Sva aktivnost</option>
                    <option value="30">Porudžbina u 30 dana</option>
                    <option value="60">Bez porudžbine 30+ dana</option>
                    <option value="inactive">Bez porudžbine 60+ dana</option>
                  </select>
                </label>
              </div>
            </div>
            <footer>
              <PortalButton onClick={resetCustomerFilters}>
                Resetuj
              </PortalButton>
              <PortalButton
                variant="primary"
                onClick={() => setCustomerMoreOpen(false)}
              >
                Prikaži {filteredCustomers.length} kupaca
              </PortalButton>
            </footer>
          </aside>
        </div>
      ) : null}

      {productMoreOpen ? (
        <div
          className="portal-drawer-layer"
          role="dialog"
          aria-modal="true"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setProductMoreOpen(false);
          }}
        >
          <aside className="portal-drawer portal-filter-drawer">
            <header>
              <div>
                <span>Filteri proizvoda</span>
                <h2>Još filtera</h2>
                <p>Status kataloga i dostupnost.</p>
              </div>
              <button
                className="portal-icon-button"
                onClick={() => setProductMoreOpen(false)}
              >
                <PortalIcon name="close" />
              </button>
            </header>
            <div className="portal-drawer-scroll portal-panel-body">
              <div className="portal-form-grid">
                <label className="portal-field">
                  <span>Status proizvoda</span>
                  <select
                    value={productStatus}
                    onChange={(event) => setProductStatus(event.target.value)}
                  >
                    <option value="all">Svi statusi</option>
                    <option value="aktivan">aktivan</option>
                    <option value="povučen">povučen</option>
                    <option value="najava">najava</option>
                  </select>
                </label>
                <label className="portal-field">
                  <span>Dostupnost</span>
                  <select
                    value={productAvailability}
                    onChange={(event) =>
                      setProductAvailability(event.target.value)
                    }
                  >
                    <option value="all">Sva dostupnost</option>
                    <option value="na stanju">na stanju</option>
                    <option value="nisko stanje">nisko stanje</option>
                    <option value="nema na stanju">nema na stanju</option>
                  </select>
                </label>
              </div>
            </div>
            <footer>
              <PortalButton onClick={resetProductFilters}>Resetuj</PortalButton>
              <PortalButton
                variant="primary"
                onClick={() => setProductMoreOpen(false)}
              >
                Prikaži {filteredProducts.length} proizvoda
              </PortalButton>
            </footer>
          </aside>
        </div>
      ) : null}

      {settingsOpen ? (
        <div
          className="portal-drawer-layer"
          role="dialog"
          aria-modal="true"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setSettingsOpen(false);
          }}
        >
          <aside className="portal-drawer portal-rebate-settings">
            <header>
              <div>
                <span>Bulk rabati</span>
                <h2>Podesi bulk rabat</h2>
                <p>
                  {selectedCustomerIds.length} kupaca ×{" "}
                  {selectedProductIds.length} proizvoda
                </p>
              </div>
              <button
                className="portal-icon-button"
                onClick={() => setSettingsOpen(false)}
              >
                <PortalIcon name="close" />
              </button>
            </header>
            <div className="portal-drawer-scroll">
              <div className="portal-panel-body portal-rebate-form">
                <label className="portal-field">
                  <span>Tip izmene *</span>
                  <select
                    value={operation}
                    onChange={(event) =>
                      setOperation(event.target.value as BulkOperation)
                    }
                  >
                    {Object.entries(operationLabels).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="portal-field">
                  <span>
                    {operation === "fixed_price"
                      ? "Nova fiksna cena"
                      : operation === "set_rebate"
                        ? "Novi rabat"
                        : operation.includes("rebate")
                          ? "Promena rabata"
                          : "Promena cene"}{" "}
                    *
                  </span>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={value}
                    onChange={(event) => setValue(Number(event.target.value))}
                  />
                  <small>{operation === "fixed_price" ? "RSD" : "%"}</small>
                </label>
                <div className="portal-price-example">
                  <PortalIcon name="prices" />
                  <span>
                    <strong>Primer obračuna</strong>
                    <small>
                      {operation === "fixed_price"
                        ? `${formatCurrency(4000)} → ${formatCurrency(value)}`
                        : operation === "set_rebate"
                          ? `Kataloška cena ${formatCurrency(4000)} uz rabat ${value}% → ${formatCurrency(4000 * (1 - value / 100))}`
                          : `${operationLabels[operation]} za ${value}% na postojećoj vrednosti.`}
                    </small>
                  </span>
                </div>
                <div className="portal-form-grid" data-columns="2">
                  <label className="portal-field">
                    <span>Važi od *</span>
                    <input
                      type="date"
                      value={validFrom}
                      onChange={(event) => setValidFrom(event.target.value)}
                    />
                  </label>
                  <label className="portal-field">
                    <span>Važi do</span>
                    <input
                      type="date"
                      value={validTo}
                      min={validFrom}
                      disabled={noEnd}
                      onChange={(event) => setValidTo(event.target.value)}
                    />
                  </label>
                </div>
                <label className="portal-check-filter">
                  <input
                    type="checkbox"
                    checked={noEnd}
                    onChange={(event) => setNoEnd(event.target.checked)}
                  />{" "}
                  Bez datuma završetka
                </label>
                <label className="portal-field">
                  <span>Razlog izmene *</span>
                  <textarea
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Zašto se rabat menja?"
                    rows={3}
                  />
                </label>
                <label className="portal-field">
                  <span>Naziv bulk izmene</span>
                  <input
                    value={batchName}
                    onChange={(event) => setBatchName(event.target.value)}
                    placeholder="Opciono, npr. Jesenja akcija R-M"
                  />
                </label>
                <details className="portal-rebate-disclosure">
                  <summary>
                    <span>
                      <strong>Zaštite</strong>
                      <small>5 zaštita aktivno</small>
                    </span>
                    <PortalIcon name="chevron" />
                  </summary>
                  <div>
                    {[
                      ["Minimalna marža", `blokiraj ispod ${minimumMargin}%`],
                      ["Preklapanje pravila", "upozori"],
                      ["Dospelo dugovanje", "zahtevaj odobrenje"],
                      ["Prevelik obuhvat", "upozori"],
                      ["Nevažeća cena", "blokiraj"],
                    ].map(([label, behavior]) => (
                      <div key={label}>
                        <span>
                          <PortalIcon name="check" />
                          {label}
                        </span>
                        <Badge
                          tone={
                            behavior.includes("blokiraj")
                              ? "danger"
                              : behavior.includes("odobrenje")
                                ? "warning"
                                : "info"
                          }
                        >
                          {behavior}
                        </Badge>
                      </div>
                    ))}
                    {canViewMargin ? (
                      <label className="portal-field">
                        <span>Minimalna marža</span>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={minimumMargin}
                          onChange={(event) =>
                            setMinimumMargin(Number(event.target.value))
                          }
                        />
                      </label>
                    ) : (
                      <small>
                        Komercijalista vidi ishod zaštite, ali ne menja prag
                        marže.
                      </small>
                    )}
                  </div>
                </details>
                <details className="portal-rebate-disclosure">
                  <summary>
                    <span>
                      <strong>Prioriteti cena</strong>
                      <small>8 nivoa, od najvišeg ka opštem</small>
                    </span>
                    <PortalIcon name="chevron" />
                  </summary>
                  <ol>
                    {[
                      "Fiksna cena kupca za proizvod",
                      "Cena kupca za grupu",
                      "Cena kupca za proizvođača",
                      "Pravilo segmenta",
                      "Promotivna cena",
                      "Količinski rabat",
                      "Opšti cenovnik",
                      "Kataloška cena",
                    ].map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ol>
                </details>
                {!settingsValid ? (
                  <div className="portal-form-error" role="alert">
                    <PortalIcon name="warning" />
                    Izaberite obuhvat i unesite vrednost, datum početka i razlog
                    izmene.
                  </div>
                ) : null}
              </div>
            </div>
            <footer>
              <PortalButton onClick={() => setSettingsOpen(false)}>
                Odustani
              </PortalButton>
              <PortalButton
                variant="primary"
                icon="eye"
                loading={previewing}
                disabled={!settingsValid}
                onClick={preview}
              >
                Izračunaj pregled
              </PortalButton>
            </footer>
          </aside>
        </div>
      ) : null}

      {detailRow ? (
        <div
          className="portal-drawer-layer"
          role="dialog"
          aria-modal="true"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setDetailRowId("");
          }}
        >
          <aside className="portal-drawer portal-row-detail">
            <header>
              <div>
                <span>Detalj obračuna</span>
                <h2>{detailRow.customerName}</h2>
                <p>{detailRow.productName}</p>
              </div>
              <button
                className="portal-icon-button"
                onClick={() => setDetailRowId("")}
              >
                <PortalIcon name="close" />
              </button>
            </header>
            <div className="portal-drawer-scroll">
              <div className="portal-history-meta">
                <div>
                  <span>Trenutna cena</span>
                  <strong>{formatCurrency(detailRow.currentPrice)}</strong>
                </div>
                <div>
                  <span>Nova cena</span>
                  <strong>{formatCurrency(detailRow.newPrice)}</strong>
                </div>
                <div>
                  <span>Trenutni rabat</span>
                  <strong>{detailRow.currentDiscount}%</strong>
                </div>
                <div>
                  <span>Novi rabat</span>
                  <strong>{detailRow.newDiscount}%</strong>
                </div>
                {canViewMargin ? (
                  <>
                    <div>
                      <span>Marža pre</span>
                      <strong>{detailRow.currentMargin}%</strong>
                    </div>
                    <div>
                      <span>Marža posle</span>
                      <strong>{detailRow.newMargin}%</strong>
                    </div>
                  </>
                ) : null}
              </div>
              <div className="portal-drawer-section portal-panel-body">
                <h3>Pobedničko pravilo</h3>
                <p>
                  <strong>{detailRow.winningRule}</strong> · prioritet{" "}
                  {detailRow.winningRulePriority}
                </p>
                <small>{detailRow.winningRuleReason}</small>
              </div>
              <div className="portal-drawer-section portal-panel-body">
                <h3>Zaštite i konflikti</h3>
                {detailRow.warning ? (
                  <p className="portal-danger-text">{detailRow.warning}</p>
                ) : (
                  <p>Nema upozorenja.</p>
                )}
                {detailRow.conflictingRules.length ? (
                  <ul>
                    {detailRow.conflictingRules.map((rule) => (
                      <li key={rule}>{rule}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
            <footer>
              <PortalButton onClick={() => setDetailRowId("")}>
                Zatvori
              </PortalButton>
              <PortalButton
                variant={detailRow.excluded ? "primary" : "secondary"}
                onClick={() => {
                  toggleExcluded(detailRow);
                  setDetailRowId("");
                }}
              >
                {detailRow.excluded ? "Vrati red" : "Isključi red"}
              </PortalButton>
            </footer>
          </aside>
        </div>
      ) : null}

      {confirmOpen ? (
        <div
          className="portal-modal-layer"
          role="dialog"
          aria-modal="true"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setConfirmOpen(false);
          }}
        >
          <div className="portal-compare-dialog portal-rebate-confirm">
            <header>
              <div>
                <span>Završna provera</span>
                <h2>
                  {canManage ? "Primeni bulk rabat?" : "Pošalji zahtev gazdi?"}
                </h2>
                <p>Ova potvrda ne menja obuhvat niti vrednosti.</p>
              </div>
              <button
                className="portal-icon-button"
                onClick={() => setConfirmOpen(false)}
              >
                <PortalIcon name="close" />
              </button>
            </header>
            <div className="portal-confirm-summary">
              <div>
                <span>Kupci</span>
                <strong>{impactedCustomers.size}</strong>
              </div>
              <div>
                <span>Proizvodi</span>
                <strong>{impactedProducts.size}</strong>
              </div>
              <div>
                <span>Kombinacije za primenu</span>
                <strong>{applicableRows.length}</strong>
              </div>
              <div>
                <span>Blokirano / isključeno</span>
                <strong>
                  {blockedCount} / {excludedCount}
                </strong>
              </div>
              <div>
                <span>Potrebno odobrenje</span>
                <strong>{approvalCount}</strong>
              </div>
              <div>
                <span>Važenje</span>
                <strong>
                  {formatDate(validFrom)}
                  {noEnd || !validTo
                    ? " – bez roka"
                    : ` – ${formatDate(validTo)}`}
                </strong>
              </div>
              <div data-span="2">
                <span>Izmena</span>
                <strong>
                  {operationLabels[operation]} · {value}
                  {operation === "fixed_price" ? " RSD" : "%"}
                </strong>
              </div>
              <div data-span="2">
                <span>Razlog</span>
                <strong>{reason}</strong>
              </div>
            </div>
            <footer>
              <PortalButton onClick={() => setConfirmOpen(false)}>
                Odustani
              </PortalButton>
              <PortalButton
                variant="primary"
                icon={canManage ? "check" : "approval"}
                loading={applying}
                disabled={!applicableRows.length}
                onClick={applyChange}
              >
                {canManage ? "Potvrdi i primeni" : "Potvrdi i pošalji"}
              </PortalButton>
            </footer>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function PricingHistory() {
  const { role, priceRules, priceBatches } = usePortal();
  const canViewMargin = can(role, "prices:view_margin");
  const [selectedId, setSelectedId] = useState(
    priceBatches[0]?.id ?? priceRules[0]?.id ?? "",
  );
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("svi");
  const [sort, setSort] = useState<"newest" | "name">("newest");
  if (!can(role, "prices:view")) return <StateView state="permission" />;
  const batchIds = new Set(priceBatches.map((batch) => `rule-${batch.id}`));
  const entries = [
    ...priceBatches.map((batch) => ({
      id: batch.id,
      name: batch.name,
      createdAt: batch.createdAt,
      createdBy: batch.createdBy,
      type: batch.type,
      value: batch.value,
      minimumMargin: batch.minimumMargin,
      status: batch.status,
      reason: `${batch.reason} · ${batch.rows.filter((row) => !row.excluded && row.outcome !== "blocked").length} cenovnih kombinacija`,
      target: batch.target,
      scopeCount: batch.rows.filter(
        (row) => !row.excluded && row.outcome !== "blocked",
      ).length,
    })),
    ...priceRules
      .filter((rule) => !batchIds.has(rule.id))
      .map((rule) => ({
        ...rule,
        scopeCount:
          (rule.target.customerIds?.length ?? 4) *
          (rule.target.productIds?.length ??
            rule.target.productGroups?.length ??
            7),
      })),
  ]
    .filter(
      (entry) =>
        (status === "svi" || entry.status === status) &&
        (!query ||
          `${entry.name} ${entry.createdBy} ${entry.reason}`
            .toLocaleLowerCase("sr")
            .includes(query.toLocaleLowerCase("sr"))),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name, "sr")
        : b.createdAt.localeCompare(a.createdAt),
    );
  const selected =
    entries.find((entry) => entry.id === selectedId) ?? entries[0];
  const hasFilters = Boolean(query || status !== "svi" || sort !== "newest");
  return (
    <>
      <PageHeader
        eyebrow="Audit cena"
        title="Istorija promena"
        description="Ko je, kada i zašto menjao cenu, sa poređenjem prethodne i nove verzije."
        actions={
          <PortalButton
            icon="download"
            disabled
            title="Izvoz istorije nije implementiran u frontend prototipu."
          >
            Izvezi istoriju · mock
          </PortalButton>
        }
      />
      <PricingNav active="history" />
      <ModuleState>
        <div className="portal-grid" data-layout="wide-left">
          <Panel>
            <div className="portal-table-toolbar">
              <label className="portal-search-field">
                <PortalIcon name="search" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Pravilo, korisnik ili razlog"
                />
              </label>
              <div className="portal-cluster">
                <select
                  className="portal-filter-select"
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  aria-label="Status promene"
                >
                  <option value="svi">Svi statusi</option>
                  <option value="primenjeno">primenjeno</option>
                  <option value="aktivno">aktivno</option>
                  <option value="čeka odobrenje">čeka odobrenje</option>
                  <option value="odbijeno">odbijeno</option>
                </select>
                <select
                  className="portal-filter-select"
                  value={sort}
                  onChange={(event) =>
                    setSort(event.target.value as typeof sort)
                  }
                  aria-label="Sortiranje istorije"
                >
                  <option value="newest">Najnovije prvo</option>
                  <option value="name">Naziv A–Š</option>
                </select>
                {hasFilters ? (
                  <PortalButton
                    variant="ghost"
                    icon="close"
                    onClick={() => {
                      setQuery("");
                      setStatus("svi");
                      setSort("newest");
                    }}
                  >
                    Resetuj
                  </PortalButton>
                ) : null}
              </div>
            </div>
            {hasFilters ? (
              <div className="portal-active-filters">
                <span className="portal-filter-chip">
                  {entries.length} rezultata
                </span>
                {status !== "svi" ? (
                  <span className="portal-filter-chip">Status: {status}</span>
                ) : null}
              </div>
            ) : null}
            <div className="portal-table-wrap">
              <table className="portal-table">
                <thead>
                  <tr>
                    <th>Datum</th>
                    <th>Promena</th>
                    <th>Korisnik</th>
                    <th>Obuhvat</th>
                    <th>Tip</th>
                    <th>Vrednost</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr
                      key={entry.id}
                      onClick={() => setSelectedId(entry.id)}
                      className="portal-clickable-row"
                      data-selected={selected?.id === entry.id}
                    >
                      <td>{formatDate(entry.createdAt, true)}</td>
                      <td>
                        <strong>{entry.name}</strong>
                        <small>{entry.reason}</small>
                      </td>
                      <td>{entry.createdBy}</td>
                      <td>{entry.scopeCount} kombinacija</td>
                      <td>{priceTypeLabels[entry.type]}</td>
                      <td className="portal-table-number">
                        {entry.type === "fixed"
                          ? formatCurrency(entry.value)
                          : `${entry.value}%`}
                      </td>
                      <td>
                        <Badge tone={statusTone(entry.status)}>
                          {entry.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!entries.length ? (
              <div className="portal-inline-empty portal-inline-empty-large">
                <PortalIcon name="search" />
                Nema promena za aktivne filtere.
              </div>
            ) : null}
          </Panel>
          {selected ? (
            <aside className="portal-history-diff">
              <Panel>
                <SectionHeader
                  title="Detalj promene"
                  description={selected.id}
                />
                <div className="portal-history-meta">
                  <div>
                    <span>Autor</span>
                    <strong>{selected.createdBy}</strong>
                  </div>
                  <div>
                    <span>Vreme</span>
                    <strong>{formatDate(selected.createdAt, true)}</strong>
                  </div>
                  <div>
                    <span>Razlog</span>
                    <strong>{selected.reason}</strong>
                  </div>
                  <div>
                    <span>Status</span>
                    <Badge tone={statusTone(selected.status)}>
                      {selected.status}
                    </Badge>
                  </div>
                </div>
                <div className="portal-diff">
                  <header>
                    <span>Pre</span>
                    <span>Posle</span>
                  </header>
                  <div>
                    <span>
                      <small>Tip pravila</small>
                      <strong>Osnovni cenovnik</strong>
                    </span>
                    <PortalIcon name="arrow" />
                    <span>
                      <small>Tip pravila</small>
                      <strong>{priceTypeLabels[selected.type]}</strong>
                    </span>
                  </div>
                  <div>
                    <span>
                      <small>Vrednost</small>
                      <strong>Bez izmene</strong>
                    </span>
                    <PortalIcon name="arrow" />
                    <span>
                      <small>Vrednost</small>
                      <strong>
                        {selected.type === "fixed"
                          ? formatCurrency(selected.value)
                          : `${selected.value}%`}
                      </strong>
                    </span>
                  </div>
                  {canViewMargin ? (
                    <div>
                      <span>
                        <small>Minimalna marža</small>
                        <strong>20%</strong>
                      </span>
                      <PortalIcon name="arrow" />
                      <span>
                        <small>Minimalna marža</small>
                        <strong>{selected.minimumMargin}%</strong>
                      </span>
                    </div>
                  ) : null}
                </div>
                {can(role, "prices:manage") ? (
                  <div className="portal-panel-body">
                    <PortalButton
                      variant="danger"
                      icon="sync"
                      disabled
                      title="Vraćanje cenovnika nije implementirano u frontend prototipu."
                    >
                      Vrati prethodnu verziju · mock
                    </PortalButton>
                  </div>
                ) : null}
              </Panel>
            </aside>
          ) : null}
        </div>
      </ModuleState>
    </>
  );
}
