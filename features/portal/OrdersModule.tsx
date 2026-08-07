"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { customers, portalUsers, products } from "@/mock-data/portal";
import { can, canAccessOrder } from "@/permissions/portal-permissions";
import { mockPortalService } from "@/services/portal/portal-service";
import type { OrderItem, OrderSource, OrderStatus } from "@/types/portal";
import { PortalIcon } from "@/components/portal/PortalIcon";
import { usePortal } from "@/components/portal/PortalProvider";
import {
  Badge,
  BulkToolbar,
  formatCurrency,
  formatDate,
  ModuleState,
  PageHeader,
  Panel,
  PortalButton,
  PortalLinkButton,
  SectionHeader,
  SelectionCheckbox,
  StateView,
  statusTone,
} from "@/components/portal/PortalPrimitives";

const statusOptions: Array<OrderStatus | "svi"> = [
  "svi",
  "nova",
  "čeka proveru",
  "čeka potvrdu kupca",
  "čeka odobrenje cene",
  "potvrđena",
  "čeka robu",
  "spremna za fakturisanje",
  "spremna za BEX",
  "u transportu",
  "isporučena",
  "problem",
];
const sourceOptions: Array<OrderSource | "svi"> = [
  "svi",
  "portal",
  "telefon",
  "email",
  "Viber",
  "WhatsApp",
  "komercijalista",
  "ručni unos",
  "uvoz",
];

export function OrdersList() {
  const { orders, role, user, notify, updateOrder, logEvent } = usePortal();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<OrderStatus | "svi">("svi");
  const [source, setSource] = useState<OrderSource | "svi">("svi");
  const [salesRep, setSalesRep] = useState("svi");
  const [problemOnly, setProblemOnly] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [sort, setSort] = useState<"newest" | "value">("newest");

  const visibleOrders = useMemo(
    () =>
      orders
        .filter((order) => {
          if (role === "sales" && order.salesRepId !== user.id) return false;
          if (status !== "svi" && order.status !== status) return false;
          if (source !== "svi" && order.source !== source) return false;
          if (salesRep !== "svi" && order.salesRepId !== salesRep) return false;
          if (problemOnly && !order.hasProblem) return false;
          const normalized = query.trim().toLocaleLowerCase("sr");
          if (
            normalized &&
            ![order.number, order.customerName, order.salesRepName].some(
              (value) => value.toLocaleLowerCase("sr").includes(normalized),
            )
          )
            return false;
          return true;
        })
        .sort((a, b) =>
          sort === "value"
            ? b.total - a.total
            : b.createdAt.localeCompare(a.createdAt),
        ),
    [orders, role, user.id, status, source, salesRep, problemOnly, query, sort],
  );

  const activeFilterCount = [
    status !== "svi",
    source !== "svi",
    salesRep !== "svi",
    problemOnly,
    Boolean(query),
  ].filter(Boolean).length;
  const allVisibleSelected =
    visibleOrders.length > 0 &&
    visibleOrders.every((order) => selected.includes(order.id));

  useEffect(() => {
    setSelected([]);
  }, [problemOnly, query, salesRep, sort, source, status]);

  function toggleAll() {
    setSelected(
      allVisibleSelected ? [] : visibleOrders.map((order) => order.id),
    );
  }

  function bulkAction(
    label: string,
    patch: Partial<
      Pick<(typeof orders)[number], "status" | "bizniSoftStatus" | "bexStatus">
    >,
  ) {
    selected.forEach((id) => {
      const order = orders.find((item) => item.id === id);
      if (!order) return;
      updateOrder(id, patch);
      logEvent({
        action: label,
        module: "Porudžbine",
        entityType: "Porudžbina",
        entityId: id,
        entityLabel: order.number,
        severity: "info",
        reason: "Bulk obrada u mock operativnom toku",
        before: { status: order.status },
        after: { status: patch.status ?? order.status },
      });
    });
    notify(label, `${selected.length} porudžbine su obrađene u mock režimu.`);
    setSelected([]);
  }

  return (
    <>
      <PageHeader
        eyebrow="Operativa"
        title="Porudžbine"
        description={`${visibleOrders.length} rezultata · sortirano po ${sort === "newest" ? "poslednjoj izmeni" : "vrednosti"}`}
        actions={
          <>
            <PortalButton
              icon="download"
              disabled
              title="CSV izvoz nije implementiran u frontend prototipu."
            >
              Izvezi CSV · mock
            </PortalButton>
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
        <Panel>
          <div className="portal-table-toolbar">
            <div className="portal-table-toolbar-main">
              <label className="portal-search-field">
                <PortalIcon name="search" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Broj porudžbine ili kupac"
                />
              </label>
              <select
                className="portal-filter-select"
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as OrderStatus | "svi")
                }
                aria-label="Status porudžbine"
              >
                {statusOptions.map((item) => (
                  <option key={item} value={item}>
                    {item === "svi" ? "Svi statusi" : item}
                  </option>
                ))}
              </select>
              <select
                className="portal-filter-select"
                value={source}
                onChange={(event) =>
                  setSource(event.target.value as OrderSource | "svi")
                }
                aria-label="Izvor porudžbine"
              >
                {sourceOptions.map((item) => (
                  <option key={item} value={item}>
                    {item === "svi" ? "Svi izvori" : item}
                  </option>
                ))}
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
              <label className="portal-check-filter">
                <input
                  type="checkbox"
                  checked={problemOnly}
                  onChange={(event) => setProblemOnly(event.target.checked)}
                />
                Samo problematične
              </label>
            </div>
            <div className="portal-table-toolbar-actions">
              <select
                className="portal-filter-select"
                value={sort}
                onChange={(event) => setSort(event.target.value as typeof sort)}
                aria-label="Sortiranje"
              >
                <option value="newest">Najnovije prvo</option>
                <option value="value">Najveća vrednost</option>
              </select>
              {activeFilterCount ? (
                <PortalButton
                  variant="ghost"
                  icon="close"
                  onClick={() => {
                    setQuery("");
                    setStatus("svi");
                    setSource("svi");
                    setSalesRep("svi");
                    setProblemOnly(false);
                  }}
                >
                  Resetuj {activeFilterCount}
                </PortalButton>
              ) : (
                <PortalButton variant="ghost" icon="filter">
                  Još filtera
                </PortalButton>
              )}
            </div>
          </div>
          {activeFilterCount ? (
            <div className="portal-active-filters">
              {query ? (
                <span className="portal-filter-chip">
                  Pretraga: {query}
                  <button
                    aria-label="Ukloni pretragu"
                    onClick={() => setQuery("")}
                  >
                    <PortalIcon name="close" />
                  </button>
                </span>
              ) : null}
              {status !== "svi" ? (
                <span className="portal-filter-chip">
                  Status: {status}
                  <button
                    aria-label="Ukloni status"
                    onClick={() => setStatus("svi")}
                  >
                    <PortalIcon name="close" />
                  </button>
                </span>
              ) : null}
              {source !== "svi" ? (
                <span className="portal-filter-chip">
                  Izvor: {source}
                  <button
                    aria-label="Ukloni izvor"
                    onClick={() => setSource("svi")}
                  >
                    <PortalIcon name="close" />
                  </button>
                </span>
              ) : null}
              {salesRep !== "svi" ? (
                <span className="portal-filter-chip">
                  Komercijalista:{" "}
                  {portalUsers.find((item) => item.id === salesRep)?.name}
                  <button
                    aria-label="Ukloni komercijalistu"
                    onClick={() => setSalesRep("svi")}
                  >
                    <PortalIcon name="close" />
                  </button>
                </span>
              ) : null}
              {problemOnly ? (
                <span className="portal-filter-chip">
                  Problematične
                  <button
                    aria-label="Ukloni filter problematičnih"
                    onClick={() => setProblemOnly(false)}
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
              selected.length === 1
                ? "porudžbina izabrana"
                : "porudžbine izabrane"
            }
            scopeLabel="Akcije važe samo za redove u trenutnom prikazu; izbor se resetuje pri promeni filtera."
            onClear={() => setSelected([])}
          >
            <PortalButton
              variant="primary"
              onClick={() =>
                bulkAction("Status je promenjen", { status: "čeka proveru" })
              }
            >
              Promeni status
            </PortalButton>
            {can(role, "orders:process") ? (
              <>
                <PortalButton
                  icon="sync"
                  onClick={() =>
                    bulkAction("Pripremljeno za BizniSoft", {
                      bizniSoftStatus: "čeka",
                      status: "spremna za fakturisanje",
                    })
                  }
                >
                  BizniSoft
                </PortalButton>
                <PortalButton
                  icon="truck"
                  onClick={() =>
                    bulkAction("Pripremljeno za BEX", {
                      bexStatus: "spremno",
                      status: "spremna za BEX",
                    })
                  }
                >
                  BEX
                </PortalButton>
              </>
            ) : null}
          </BulkToolbar>
          <div className="portal-table-wrap">
            <table className="portal-table portal-orders-table">
              <thead>
                <tr>
                  <th>
                    <SelectionCheckbox
                      checked={allVisibleSelected}
                      mixed={selected.length > 0 && !allVisibleSelected}
                      onChange={toggleAll}
                      label="Izaberi sve porudžbine u trenutnom prikazu"
                    />
                  </th>
                  <th className="portal-sticky-cell">Broj</th>
                  <th>Datum i vreme</th>
                  <th>Kupac</th>
                  <th>Komercijalista</th>
                  <th>Izvor</th>
                  <th>Stavke</th>
                  <th>Vrednost</th>
                  <th>Status</th>
                  <th>Plaćanje</th>
                  <th>BizniSoft</th>
                  <th>BEX</th>
                  <th>Poslednja izmena</th>
                  <th>Akcije</th>
                </tr>
              </thead>
              <tbody>
                {visibleOrders.map((order) => (
                  <tr
                    key={order.id}
                    data-selected={selected.includes(order.id)}
                  >
                    <td>
                      <SelectionCheckbox
                        checked={selected.includes(order.id)}
                        onChange={() =>
                          setSelected((current) =>
                            current.includes(order.id)
                              ? current.filter((id) => id !== order.id)
                              : [...current, order.id],
                          )
                        }
                        label={`Izaberi ${order.number}`}
                      />
                    </td>
                    <td className="portal-sticky-cell">
                      <Link
                        className="portal-table-link portal-technical"
                        href={`/portal/porudzbine/${order.id}`}
                      >
                        {order.number}
                      </Link>
                      {order.hasProblem ? (
                        <small className="portal-danger-text">
                          zahteva pažnju
                        </small>
                      ) : null}
                    </td>
                    <td>{formatDate(order.createdAt, true)}</td>
                    <td>
                      <Link
                        className="portal-table-link"
                        href={`/portal/kupci/${order.customerId}`}
                      >
                        {order.customerName}
                      </Link>
                    </td>
                    <td>{order.salesRepName}</td>
                    <td>
                      <Badge>{order.source}</Badge>
                    </td>
                    <td>{order.items.length}</td>
                    <td className="portal-table-number">
                      {formatCurrency(order.total)}
                    </td>
                    <td>
                      <Badge tone={statusTone(order.status)}>
                        {order.status}
                      </Badge>
                    </td>
                    <td>
                      <Badge tone={statusTone(order.paymentStatus)}>
                        {order.paymentStatus}
                      </Badge>
                    </td>
                    <td>
                      <Badge tone={statusTone(order.bizniSoftStatus)}>
                        {order.bizniSoftStatus}
                      </Badge>
                    </td>
                    <td>
                      <Badge tone={statusTone(order.bexStatus)}>
                        {order.bexStatus}
                      </Badge>
                    </td>
                    <td>{formatDate(order.updatedAt, true)}</td>
                    <td>
                      <div className="portal-table-actions">
                        <Link
                          href={`/portal/porudzbine/${order.id}`}
                          className="portal-icon-button"
                          aria-label={`Otvori porudžbinu ${order.number}`}
                        >
                          <PortalIcon name="eye" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!visibleOrders.length ? (
            <div className="portal-inline-empty portal-inline-empty-large">
              <PortalIcon name="search" />
              Nema porudžbina za aktivne filtere.
            </div>
          ) : null}
          <footer className="portal-pagination">
            <span>
              Prikazano{" "}
              {visibleOrders.length ? `1–${visibleOrders.length}` : "0"} od{" "}
              {visibleOrders.length}
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

const quickMessage =
  "Pošaljite nam 5 komada 150 brusnih diskova, 3 crna spreja i 2 učvršćivača kao prošli put.";

function createDraftItem(
  productId: string,
  quantity = 1,
  originalInput?: string,
  confidence = 98,
): OrderItem {
  const product = products.find((item) => item.id === productId) ?? products[0];
  const appliedPrice = Math.round(product.basePrice * 0.9);
  return {
    id: `draft-${product.id}-${Date.now()}-${quantity}`,
    productId: product.id,
    sku: product.sku,
    productName: product.name,
    originalInput,
    quantity,
    regularPrice: product.basePrice,
    appliedPrice,
    discount: 10,
    margin: Math.round(
      ((appliedPrice - product.purchasePrice) / appliedPrice) * 100,
    ),
    mappingConfidence: confidence,
    mappingConfirmed: confidence > 90,
    available: product.availability !== "nema na stanju",
  };
}

export function NewOrder() {
  const router = useRouter();
  const { role, user, addOrder, notify } = usePortal();
  const scopedCustomers =
    role === "sales"
      ? customers.filter((customer) => customer.salesRepId === user.id)
      : customers;
  const [customerId, setCustomerId] = useState("");
  const [contactId, setContactId] = useState("");
  const [addressId, setAddressId] = useState("");
  const [message, setMessage] = useState(quickMessage);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [productId, setProductId] = useState(products[0].id);
  const [productQuery, setProductQuery] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState("BEX standard");
  const [paymentMethod, setPaymentMethod] = useState("virman");
  const [note, setNote] = useState("");
  const [rememberAlias, setRememberAlias] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submissionLocked = useRef(false);
  const [dirty, setDirty] = useState(false);
  const [formError, setFormError] = useState("");
  const customer = scopedCustomers.find((item) => item.id === customerId);
  const filteredProducts = useMemo(() => {
    const value = productQuery.trim().toLocaleLowerCase("sr");
    if (!value) return products;
    return products.filter((product) =>
      [
        product.name,
        product.sku,
        product.catalogNumber,
        product.manufacturer,
        ...product.aliases.map((alias) => alias.value),
      ].some((field) => field.toLocaleLowerCase("sr").includes(value)),
    );
  }, [productQuery]);
  const selectedProductId = filteredProducts.some(
    (product) => product.id === productId,
  )
    ? productId
    : (filteredProducts[0]?.id ?? "");
  const canViewCustomerFinancials = can(role, "customers:view_financials");
  const canViewPricing = can(role, "prices:view");

  useEffect(() => {
    const requestedCustomerId = new URLSearchParams(window.location.search).get(
      "customer",
    );
    const requestedCustomer = customers.find(
      (item) => item.id === requestedCustomerId,
    );
    if (
      requestedCustomer &&
      (role !== "sales" || requestedCustomer.salesRepId === user.id)
    )
      setCustomerId(requestedCustomer.id);
  }, [role, user.id]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
    };
    const handleInternalNavigation = (event: MouseEvent) => {
      if (!dirty) return;
      const link = (event.target as HTMLElement).closest("a[href]");
      if (!link || link.getAttribute("target") === "_blank") return;
      if (
        !window.confirm(
          "Imate nesnimljene izmene porudžbine. Napustiti stranicu?",
        )
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleInternalNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleInternalNavigation, true);
    };
  }, [dirty]);

  useEffect(() => {
    if (!customer) return;
    setContactId(customer.contacts[0]?.id ?? "");
    setAddressId(customer.addresses[0]?.id ?? "");
    setPaymentMethod(customer.paymentMethod);
    setDirty(true);
  }, [customer]);

  const total = items.reduce(
    (sum, item) => sum + item.appliedPrice * item.quantity,
    0,
  );
  const selectedAddress = customer?.addresses.find(
    (address) => address.id === addressId,
  );
  const warnings = useMemo(() => {
    const result: string[] = [];
    if (customer?.status === "blokiran")
      result.push(
        "Kupac je blokiran i porudžbina ne može biti potvrđena bez odobrenja gazde.",
      );
    if (customer && customer.financial.debt > customer.financial.creditLimit)
      result.push("Kupac je preko kreditnog limita.");
    if (customer && customer.financial.overdueDebt > 100000)
      result.push(
        canViewCustomerFinancials
          ? `Kupac ima ${formatCurrency(customer.financial.overdueDebt)} dospelog dugovanja.`
          : "Naplata kupca zahteva proveru ovlašćene osobe.",
      );
    if (selectedAddress && !selectedAddress.complete)
      result.push("Adresa za isporuku nije potpuna.");
    if (customer && !customer.pib) result.push("Nedostaje PIB kupca.");
    if (items.some((item) => !item.available))
      result.push("Jedan ili više proizvoda trenutno nema stanje.");
    if (items.some((item) => !item.mappingConfirmed))
      result.push("Jedan proizvod nije sigurno prepoznat.");
    const customerMinimumMargin = customer?.internal.minimumMargin ?? 0;
    if (items.some((item) => item.margin < customerMinimumMargin))
      result.push("Cena stavke je ispod minimalne marže i zahteva odobrenje.");
    return result;
  }, [canViewCustomerFinancials, customer, items, selectedAddress]);

  function changeCustomer(nextCustomerId: string) {
    if (
      items.length &&
      nextCustomerId !== customerId &&
      !window.confirm(
        "Promena kupca će ponovo izračunati cene postojećih stavki. Nastaviti?",
      )
    )
      return;
    const nextCustomer = scopedCustomers.find(
      (item) => item.id === nextCustomerId,
    );
    if (nextCustomer && items.length) {
      setItems((current) =>
        current.map((item) => {
          const product = products.find((entry) => entry.id === item.productId);
          if (!product) return item;
          const appliedPrice = Math.max(
            1,
            Math.round(
              product.basePrice * (1 - nextCustomer.baseDiscount / 100),
            ),
          );
          return {
            ...item,
            regularPrice: product.basePrice,
            appliedPrice,
            discount: nextCustomer.baseDiscount,
            margin: Math.round(
              ((appliedPrice - product.purchasePrice) / appliedPrice) * 100,
            ),
          };
        }),
      );
      notify(
        "Kupac i cene su promenjeni",
        "Postojeće stavke su zadržane, a cene ponovo izračunate prema uslovima novog kupca.",
        "info",
      );
    }
    setCustomerId(nextCustomerId);
    setDirty(true);
  }

  function parseMessage() {
    const normalizedMessage = message.trim().toLocaleLowerCase("sr");
    if (normalizedMessage.length < 5) {
      setFormError("Unesite poruku kupca pre pokretanja parsera.");
      notify(
        "Poruka nije obrađena",
        "Unos je prazan ili prekratak za pouzdano mock prepoznavanje.",
        "warning",
      );
      return;
    }
    if (
      !["disk", "sprej", "učvršćiva", "lak", "git"].some((term) =>
        normalizedMessage.includes(term),
      )
    ) {
      setFormError(
        "Mock parser nije pronašao proizvod. Dodajte ga ručno ili dopunite opis.",
      );
      notify(
        "Nema pouzdanog rezultata",
        "Nijedan proizvod nije automatski dodat; postojeće stavke nisu promenjene.",
        "warning",
      );
      return;
    }
    setFormError("");
    setParsing(true);
    window.setTimeout(() => {
      setItems([
        createDraftItem("prd-22", 5, "150 brusnih diskova", 91),
        createDraftItem("prd-17", 3, "crna spreja", 98),
        createDraftItem("prd-2", 2, "učvršćivača kao prošli put", 82),
      ]);
      setParsing(false);
      setDirty(true);
      notify(
        "Poruka je obrađena",
        "Pronađene su 3 stavke. Proverite predložena mapiranja.",
        "info",
      );
    }, 620);
  }

  function updateItem(id: string, patch: Partial<OrderItem>) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
    setDirty(true);
  }

  function addProduct(nextProductId: string) {
    const product = products.find((item) => item.id === nextProductId);
    if (!product) return;
    const alreadyAdded = items.some((item) => item.productId === nextProductId);
    setItems((current) => {
      const existing = current.find((item) => item.productId === nextProductId);
      return existing
        ? current.map((item) =>
            item.id === existing.id
              ? { ...item, quantity: item.quantity + 1 }
              : item,
          )
        : [...current, createDraftItem(nextProductId)];
    });
    if (alreadyAdded)
      notify(
        "Količina je spojena",
        `${product.name} je već u porudžbini; količina je povećana za 1.`,
        "info",
      );
    setProductQuery("");
    setProductId(products[0].id);
    setDirty(true);
  }

  function replaceItemProduct(id: string, nextProductId: string) {
    const current = items.find((item) => item.id === id);
    if (!current) return;
    const duplicate = items.find(
      (item) => item.id !== id && item.productId === nextProductId,
    );
    if (duplicate) {
      setItems((entries) =>
        entries
          .filter((item) => item.id !== id)
          .map((item) =>
            item.id === duplicate.id
              ? { ...item, quantity: item.quantity + current.quantity }
              : item,
          ),
      );
      setDirty(true);
      notify(
        "Duplikat je spojen",
        "Količine istog proizvoda su objedinjene u jednom redu.",
        "info",
      );
      return;
    }
    const replacement = createDraftItem(
      nextProductId,
      current.quantity,
      current.originalInput,
      100,
    );
    updateItem(id, {
      ...replacement,
      id,
      originalInput: current.originalInput,
      quantity: current.quantity,
    });
  }

  async function submitOrder(asDraft = false) {
    if (submitting || submissionLocked.current) return;
    if (!customer || !items.length || !selectedAddress) {
      setFormError(
        "Izaberite kupca, adresu i dodajte najmanje jedan proizvod.",
      );
      notify(
        "Porudžbina nije spremna",
        "Izaberite kupca, adresu i dodajte najmanje jedan proizvod.",
        "warning",
      );
      return;
    }
    submissionLocked.current = true;
    setFormError("");
    setSubmitting(true);
    try {
      const contact =
        customer.contacts.find((item) => item.id === contactId) ??
        customer.contacts[0];
      const needsApproval = warnings.some(
        (warning) =>
          warning.includes("odobrenje") ||
          warning.includes("blokiran") ||
          warning.includes("limita"),
      );
      const order = await mockPortalService.createMockOrder({
        customerId: customer.id,
        customerName: customer.companyName,
        salesRepId: customer.salesRepId,
        salesRepName: customer.salesRepName,
        source: "ručni unos",
        status: asDraft
          ? "nacrt"
          : needsApproval
            ? "čeka odobrenje cene"
            : "nova",
        items,
        total,
        paymentMethod,
        paymentStatus: paymentMethod === "pouzećem" ? "pouzećem" : "rok",
        bizniSoftStatus: "nije poslato",
        bexStatus: "nije kreirano",
        contactName: contact?.name ?? "Kontakt nije izabran",
        contactPhone: contact?.phone ?? "",
        deliveryAddress: `${selectedAddress.street}, ${selectedAddress.city}`,
        customerNote: note,
        internalNote: rememberAlias
          ? "Potvrđene sinonime zapamtiti za ovog kupca."
          : undefined,
        deliveryMethod,
        hasProblem: warnings.length > 0,
        warnings,
      });
      addOrder(order);
      setDirty(false);
      notify(
        asDraft ? "Nacrt je kreiran" : "Porudžbina je kreirana",
        `${order.number} je dodat u frontend state.`,
      );
      router.push(`/portal/porudzbine/${order.id}`);
    } catch {
      setSubmitting(false);
      submissionLocked.current = false;
      setFormError("Mock porudžbina trenutno nije mogla da bude kreirana.");
      notify(
        "Kreiranje nije uspelo",
        "Pokušajte ponovo; nijedan podatak nije dodat.",
        "warning",
      );
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Brzi operativni unos"
        title="Nova porudžbina"
        description="Ručno unesite porudžbinu ili nalepite poruku kupca. Nijedan podatak se ne šalje na server."
        meta={dirty ? <Badge tone="warning">Nesnimljene izmene</Badge> : null}
        actions={
          <>
            <PortalButton
              onClick={() => submitOrder(true)}
              disabled={submitting}
            >
              Sačuvaj nacrt
            </PortalButton>
            <PortalButton
              variant="primary"
              icon="check"
              loading={submitting}
              onClick={() => submitOrder(false)}
            >
              Kreiraj porudžbinu
            </PortalButton>
          </>
        }
      />
      {formError ? (
        <div className="portal-form-error" role="alert">
          <PortalIcon name="warning" />
          {formError}
        </div>
      ) : null}
      <div className="portal-order-progress">
        {["Kupac", "Proizvodi", "Provera", "Isporuka", "Potvrda"].map(
          (label, index) => (
            <span
              key={label}
              data-state={
                index === 0 && !customer
                  ? "active"
                  : index === 1 && customer && !items.length
                    ? "active"
                    : customer && items.length && index <= 3
                      ? "done"
                      : index === 4 && customer && items.length
                        ? "active"
                        : "upcoming"
              }
            >
              <i>{index + 1}</i>
              <b>{label}</b>
            </span>
          ),
        )}
      </div>
      <div className="portal-grid portal-order-entry" data-layout="wide-left">
        <div className="portal-stack">
          <Panel>
            <SectionHeader
              title="1. Kupac i komercijalni uslovi"
              description="Pretraga je ograničena prema dozvolama izabrane uloge"
            />
            <div className="portal-panel-body">
              <div className="portal-form-grid" data-columns="3">
                <label className="portal-field" data-span="2">
                  <span>Kupac *</span>
                  <select
                    value={customerId}
                    onChange={(event) => changeCustomer(event.target.value)}
                  >
                    <option value="">Izaberite kupca ili pretražite…</option>
                    {scopedCustomers.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.companyName} · {item.pib} · {item.city}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="portal-field">
                  <span>Način plaćanja</span>
                  <select
                    value={paymentMethod}
                    onChange={(event) => {
                      setPaymentMethod(event.target.value);
                      setDirty(true);
                    }}
                  >
                    <option>virman</option>
                    <option>avansno</option>
                    <option>pouzećem</option>
                    <option>gotovina</option>
                  </select>
                </label>
              </div>
              {customer ? (
                <div className="portal-customer-condition">
                  <div>
                    <span>Komercijalista</span>
                    <strong>{customer.salesRepName}</strong>
                  </div>
                  <div>
                    <span>Cenovnik</span>
                    <strong>{customer.priceList}</strong>
                  </div>
                  {canViewPricing ? (
                    <div>
                      <span>Osnovni rabat</span>
                      <strong>{customer.baseDiscount}%</strong>
                    </div>
                  ) : null}
                  <div>
                    <span>Rok plaćanja</span>
                    <strong>{customer.paymentTermDays} dana</strong>
                  </div>
                  {canViewCustomerFinancials ? (
                    <div
                      data-alert={
                        customer.financial.debt > customer.financial.creditLimit
                      }
                    >
                      <span>Iskorišćenje limita</span>
                      <strong>
                        {Math.round(
                          (customer.financial.creditUsed /
                            customer.financial.creditLimit) *
                            100,
                        )}
                        %
                      </strong>
                    </div>
                  ) : (
                    <div
                      data-alert={
                        customer.financial.debt > customer.financial.creditLimit
                      }
                    >
                      <span>Status naplate</span>
                      <strong>
                        {customer.financial.debt >
                        customer.financial.creditLimit
                          ? "provera potrebna"
                          : "bez blokade"}
                      </strong>
                    </div>
                  )}
                </div>
              ) : (
                <div className="portal-inline-empty">
                  <PortalIcon name="customers" />
                  Izaberite kupca da biste videli komercijalne uslove.
                </div>
              )}
            </div>
          </Panel>
          <Panel>
            <SectionHeader
              title="2. Brzi unos iz poruke"
              description="Mock parser prikazuje predlog, originalni unos ostaje vidljiv"
              action={
                <PortalButton
                  icon="spark"
                  loading={parsing}
                  onClick={parseMessage}
                >
                  Obradi poruku
                </PortalButton>
              }
            />
            <div className="portal-panel-body">
              <label className="portal-field">
                <span>Tekst porudžbine</span>
                <textarea
                  value={message}
                  onChange={(event) => {
                    setMessage(event.target.value);
                    setDirty(true);
                  }}
                  rows={4}
                />
                <small>
                  Primeri podržanih naziva: „crni git 1kg“, „cosmos sprej crni“,
                  „ona sia 150“, „RM učvršćivač“.
                </small>
              </label>
            </div>
          </Panel>
          <Panel>
            <SectionHeader
              title="3. Stavke porudžbine"
              description={`${items.length} ${items.length === 1 ? "stavka" : "stavke"} · pretraga razume i sačuvane sinonime`}
            />
            <div className="portal-product-adder">
              <label className="portal-search-field">
                <PortalIcon name="search" />
                <input
                  value={productQuery}
                  onChange={(event) => setProductQuery(event.target.value)}
                  placeholder="Naziv, šifra ili sinonim, npr. crni git"
                />
              </label>
              <select
                value={selectedProductId}
                onChange={(event) => setProductId(event.target.value)}
                aria-label="Pronađeni proizvod"
              >
                {filteredProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.sku} · {product.name} · {product.manufacturer}
                  </option>
                ))}
              </select>
              <PortalButton
                icon="plus"
                disabled={!selectedProductId}
                onClick={() => addProduct(selectedProductId)}
              >
                Dodaj proizvod
              </PortalButton>
            </div>
            {!filteredProducts.length ? (
              <div className="portal-inline-empty">
                <PortalIcon name="warning" />
                Nijedan proizvod ili sinonim nije prepoznat.
              </div>
            ) : null}
            {items.length ? (
              <div className="portal-table-wrap">
                <table className="portal-table portal-order-items-table">
                  <thead>
                    <tr>
                      <th>Originalni unos</th>
                      <th>Predloženi proizvod</th>
                      <th>Pouzdanost</th>
                      <th>Količina</th>
                      <th>Cena</th>
                      <th>Rabat</th>
                      <th>Ukupno</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          {item.originalInput ? (
                            <>
                              <strong>„{item.originalInput}“</strong>
                              <small>unos kupca</small>
                            </>
                          ) : (
                            <span className="portal-muted">
                              ručno dodat proizvod
                            </span>
                          )}
                        </td>
                        <td>
                          <select
                            className="portal-inline-select"
                            value={item.productId}
                            onChange={(event) =>
                              replaceItemProduct(item.id, event.target.value)
                            }
                            aria-label={`Proizvod za ${item.originalInput ?? item.productName}`}
                          >
                            {products.map((product) => (
                              <option key={product.id} value={product.id}>
                                {product.sku} · {product.name}
                              </option>
                            ))}
                          </select>
                          {!item.mappingConfirmed ? (
                            <button
                              className="portal-text-button"
                              type="button"
                              onClick={() =>
                                updateItem(item.id, {
                                  mappingConfirmed: true,
                                  mappingConfidence: 100,
                                })
                              }
                            >
                              Potvrdi mapiranje
                            </button>
                          ) : null}
                        </td>
                        <td>
                          <Badge
                            tone={
                              (item.mappingConfidence ?? 0) > 90
                                ? "success"
                                : (item.mappingConfidence ?? 0) > 80
                                  ? "warning"
                                  : "danger"
                            }
                          >
                            {item.mappingConfidence}%
                          </Badge>
                        </td>
                        <td>
                          <input
                            className="portal-quantity-input"
                            aria-label={`Količina za ${item.productName}`}
                            type="number"
                            min="1"
                            step="1"
                            inputMode="numeric"
                            value={item.quantity}
                            onChange={(event) =>
                              updateItem(item.id, {
                                quantity: Math.max(
                                  1,
                                  Math.floor(Number(event.target.value) || 1),
                                ),
                              })
                            }
                          />
                        </td>
                        <td>
                          <input
                            className="portal-price-input"
                            aria-label={`Cena za ${item.productName}`}
                            type="number"
                            min="1"
                            value={item.appliedPrice}
                            onChange={(event) => {
                              const price = Math.max(
                                1,
                                Number(event.target.value),
                              );
                              const product = products.find(
                                (entry) => entry.id === item.productId,
                              )!;
                              updateItem(item.id, {
                                appliedPrice: price,
                                discount: Math.round(
                                  (1 - price / item.regularPrice) * 100,
                                ),
                                margin: Math.round(
                                  ((price - product.purchasePrice) / price) *
                                    100,
                                ),
                              });
                            }}
                          />
                        </td>
                        <td>{item.discount}%</td>
                        <td className="portal-table-number">
                          {formatCurrency(item.appliedPrice * item.quantity)}
                        </td>
                        <td>
                          <button
                            className="portal-icon-button"
                            type="button"
                            onClick={() => {
                              setItems((current) =>
                                current.filter((entry) => entry.id !== item.id),
                              );
                              setDirty(true);
                            }}
                            aria-label="Ukloni stavku"
                          >
                            <PortalIcon name="close" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="portal-inline-empty portal-inline-empty-large">
                <PortalIcon name="products" />
                <span>
                  <strong>Nema stavki</strong>Obradite poruku ili dodajte
                  proizvod ručno.
                </span>
              </div>
            )}{" "}
            {items.some((item) => item.originalInput) ? (
              <label className="portal-alias-memory">
                <input
                  type="checkbox"
                  checked={rememberAlias}
                  onChange={(event) => setRememberAlias(event.target.checked)}
                />
                <span>
                  <strong>Zapamti potvrđene nazive za ovog kupca</strong>
                  <small>
                    Mock akcija demonstrira buduće čuvanje sinonima.
                  </small>
                </span>
              </label>
            ) : null}
          </Panel>
          <Panel>
            <SectionHeader title="4. Kontakt i isporuka" />
            <div className="portal-panel-body">
              <div className="portal-form-grid">
                <label className="portal-field">
                  <span>Kontakt</span>
                  <select
                    value={contactId}
                    onChange={(event) => {
                      setContactId(event.target.value);
                      setDirty(true);
                    }}
                    disabled={!customer}
                  >
                    {customer?.contacts.map((contact) => (
                      <option key={contact.id} value={contact.id}>
                        {contact.name} · {contact.phone}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="portal-field">
                  <span>Adresa isporuke</span>
                  <select
                    value={addressId}
                    onChange={(event) => {
                      setAddressId(event.target.value);
                      setDirty(true);
                    }}
                    disabled={!customer}
                  >
                    {customer?.addresses.map((address) => (
                      <option key={address.id} value={address.id}>
                        {address.street}, {address.city}{" "}
                        {address.complete ? "" : "· nepotpuno"}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="portal-field">
                  <span>Način isporuke</span>
                  <select
                    value={deliveryMethod}
                    onChange={(event) => {
                      setDeliveryMethod(event.target.value);
                      setDirty(true);
                    }}
                  >
                    <option>BEX standard</option>
                    <option>BEX ekspres</option>
                    <option>Lični prevoz</option>
                    <option>Preuzimanje u magacinu</option>
                  </select>
                </label>
                <label className="portal-field">
                  <span>Napomena kupca</span>
                  <input
                    value={note}
                    onChange={(event) => {
                      setNote(event.target.value);
                      setDirty(true);
                    }}
                    placeholder="Vreme isporuke, poziv pre dolaska…"
                  />
                </label>
              </div>
            </div>
          </Panel>
        </div>
        <aside className="portal-order-summary">
          <Panel>
            <SectionHeader title="Pregled porudžbine" />
            <div className="portal-order-total">
              <span>
                <small>Stavke</small>
                <strong>{items.length}</strong>
              </span>
              <span>
                <small>Količina</small>
                <strong>
                  {items.reduce((sum, item) => sum + item.quantity, 0)}
                </strong>
              </span>
              <span className="portal-order-total-main">
                <small>Ukupna vrednost</small>
                <strong>{formatCurrency(total)}</strong>
              </span>
            </div>
            {customer && canViewCustomerFinancials ? (
              <div className="portal-credit-meter">
                <div>
                  <span>Kreditni limit</span>
                  <strong>
                    {formatCurrency(customer.financial.creditLimit)}
                  </strong>
                </div>
                <div
                  className="portal-progress"
                  data-tone={
                    customer.financial.creditUsed >
                    customer.financial.creditLimit
                      ? "warning"
                      : "success"
                  }
                >
                  <span
                    style={{
                      width: `${Math.min(100, (customer.financial.creditUsed / customer.financial.creditLimit) * 100)}%`,
                    }}
                  />
                </div>
                <small>
                  Iskorišćeno {formatCurrency(customer.financial.creditUsed)}
                </small>
              </div>
            ) : customer ? (
              <div className="portal-credit-meter">
                <div>
                  <span>Status naplate</span>
                  <Badge
                    tone={
                      customer.financial.debt > customer.financial.creditLimit
                        ? "warning"
                        : "success"
                    }
                  >
                    {customer.financial.debt > customer.financial.creditLimit
                      ? "potrebna provera"
                      : "bez blokade"}
                  </Badge>
                </div>
                <small>
                  Finansijski iznosi nisu dostupni ovoj prototip ulozi.
                </small>
              </div>
            ) : null}
            <div className="portal-order-warnings">
              <h3>
                Provera porudžbine{" "}
                <Badge tone={warnings.length ? "warning" : "success"}>
                  {warnings.length
                    ? `${warnings.length} upozorenja`
                    : "bez upozorenja"}
                </Badge>
              </h3>
              {warnings.length ? (
                warnings.map((warning) => (
                  <div key={warning}>
                    <PortalIcon name="warning" />
                    <span>{warning}</span>
                  </div>
                ))
              ) : (
                <div data-ok>
                  <PortalIcon name="check" />
                  <span>Porudžbina prolazi sve trenutne mock provere.</span>
                </div>
              )}
            </div>
            <div className="portal-order-summary-actions">
              <PortalButton
                variant="primary"
                icon="check"
                loading={submitting}
                onClick={() => submitOrder(false)}
              >
                Kreiraj porudžbinu
              </PortalButton>
              <PortalButton
                onClick={() => submitOrder(true)}
                disabled={submitting}
              >
                Sačuvaj kao nacrt
              </PortalButton>
            </div>
          </Panel>
        </aside>
      </div>
    </>
  );
}

const orderTimeline: OrderStatus[] = [
  "nova",
  "čeka proveru",
  "čeka potvrdu kupca",
  "potvrđena",
  "rezervacija robe",
  "spremna za fakturisanje",
  "poslata u BizniSoft",
  "spremna za pakovanje",
  "spremna za BEX",
  "preuzeta od kurira",
  "u transportu",
  "isporučena",
];

export function OrderDetail({ orderId }: { orderId: string }) {
  const {
    orders,
    role,
    user,
    notify,
    updateOrder,
    logEvent,
    auditEvents,
    submitApproval,
    tasks,
    addTask,
    bexShipments,
    upsertBexShipment,
    bizniSoftRecords,
    upsertBizniSoftRecord,
  } = usePortal();
  const [note, setNote] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const order = orders.find((item) => item.id === orderId);
  const customer = order
    ? customers.find((item) => item.id === order.customerId)
    : undefined;
  if (!order)
    return (
      <Panel>
        <div className="portal-state" data-state="empty">
          <span className="portal-state-icon">
            <PortalIcon name="orders" />
          </span>
          <h2>Porudžbina nije pronađena</h2>
          <p>Proverite broj porudžbine ili se vratite na pregled.</p>
          <PortalLinkButton href="/portal/porudzbine">
            Nazad na porudžbine
          </PortalLinkButton>
        </div>
      </Panel>
    );
  if (!canAccessOrder(role, user.id, order.salesRepId))
    return (
      <StateView
        state="permission"
        title="Porudžbina nije u vašem portfoliju"
        description="Komercijalista može direktno da otvori samo porudžbine svojih kupaca."
      />
    );
  const directTimelineIndex = orderTimeline.indexOf(order.status);
  const blockedIndex =
    order.status === "čeka odobrenje cene"
      ? 2
      : order.status === "čeka robu"
        ? 4
        : order.status === "problem"
          ? order.bexStatus === "greška"
            ? 8
            : order.bizniSoftStatus === "greška"
              ? 5
              : 1
          : -1;
  const currentIndex = Math.max(
    0,
    directTimelineIndex >= 0 ? directTimelineIndex : blockedIndex,
  );
  const canViewMargin = can(role, "prices:view_margin");
  const canProcess = can(role, "orders:process");
  const canConfirm =
    ["nova", "čeka proveru", "čeka potvrdu kupca"].includes(order.status) &&
    !order.warnings.length;
  const canQueueBizniSoft =
    [
      "potvrđena",
      "rezervacija robe",
      "čeka robu",
      "spremna za fakturisanje",
    ].includes(order.status) &&
    !order.warnings.some((warning) => warning.includes("odobrenje"));
  const canPrepareBex =
    ["spremna za pakovanje", "spremna za BEX"].includes(order.status) &&
    order.bizniSoftStatus === "sinhronizovano" &&
    order.deliveryMethod.startsWith("BEX");
  const canMarkSent = order.bexStatus === "kreirano";
  const canCancel = !["isporučena", "otkazana"].includes(order.status);
  const resolutionTaskId = `task-order-${order.id}`;
  const resolutionTaskExists = tasks.some(
    (task) => task.id === resolutionTaskId,
  );
  const linkedAuditEvents = auditEvents.filter(
    (event) => event.entityId === order.id,
  );

  function changeOrder(
    label: string,
    description: string,
    patch: Partial<(typeof orders)[number]>,
  ) {
    if (!order) return;
    updateOrder(order.id, patch);
    logEvent({
      action: label,
      module: "Porudžbine",
      entityType: "Porudžbina",
      entityId: order.id,
      entityLabel: order.number,
      severity: patch.status === "otkazana" ? "warning" : "info",
      reason: description,
      before: {
        status: order.status,
        bizniSoft: order.bizniSoftStatus,
        bex: order.bexStatus,
      },
      after: {
        status: patch.status ?? order.status,
        bizniSoft: patch.bizniSoftStatus ?? order.bizniSoftStatus,
        bex: patch.bexStatus ?? order.bexStatus,
      },
    });
    notify(label, description);
  }

  function queueForBizniSoft() {
    if (!order || !canQueueBizniSoft) return;
    const existing = bizniSoftRecords.find(
      (record) =>
        record.entityType === "porudžbina" && record.entityId === order.id,
    );
    upsertBizniSoftRecord({
      id: existing?.id ?? `bs-live-${order.id}`,
      entityType: "porudžbina",
      entityId: order.id,
      entityLabel: order.number,
      status: "čeka",
      localValue: `${order.items.length} stavke, ${formatCurrency(order.total)}`,
      remoteValue: existing?.remoteValue,
      issue: undefined,
      lastAttemptAt: new Date().toISOString(),
      retryCount: existing?.retryCount ?? 0,
    });
    changeOrder(
      "Porudžbina je pripremljena za BizniSoft",
      "Mock payload je validiran i dodat u zajednički red.",
      { status: "spremna za fakturisanje", bizniSoftStatus: "čeka" },
    );
  }

  function prepareForBex() {
    if (!order || !canPrepareBex) return;
    const address =
      customer?.addresses.find((item) =>
        order.deliveryAddress.includes(item.street),
      ) ?? customer?.addresses[0];
    const validationIssues = [
      ...(!address?.complete ? ["Nepotpuna adresa"] : []),
      ...(!order.contactName ? ["Nedostaje primalac"] : []),
      ...(!order.contactPhone ? ["Nedostaje telefon"] : []),
      ...(!address?.postalCode ? ["Nedostaje poštanski broj"] : []),
    ];
    const existing = bexShipments.find(
      (shipment) => shipment.orderId === order.id,
    );
    upsertBexShipment({
      id: existing?.id ?? `bex-live-${order.id}`,
      orderId: order.id,
      orderNumber: order.number,
      customerName: order.customerName,
      recipient: order.contactName,
      phone: order.contactPhone,
      address: address?.street ?? order.deliveryAddress,
      city: address?.city ?? customer?.city ?? "",
      postalCode: address?.postalCode ?? "",
      packageCount: existing?.packageCount ?? 1,
      weight: existing?.weight ?? Math.max(1, order.items.length * 1.4),
      cashOnDelivery: order.paymentStatus === "pouzećem" ? order.total : 0,
      note: address?.deliveryNote,
      status: validationIssues.length ? "greška" : "spremna",
      trackingNumber: existing?.trackingNumber,
      pickupAt: existing?.pickupAt,
      deliveredAt: existing?.deliveredAt,
      validationIssues,
    });
    changeOrder(
      validationIssues.length
        ? "BEX validacija nije prošla"
        : "BEX pošiljka je pripremljena",
      validationIssues.length
        ? validationIssues.join(" · ")
        : "Mock validacija adrese je završena i pošiljka je u zajedničkom BEX redu.",
      validationIssues.length
        ? {
            status: "problem",
            bexStatus: "greška",
            hasProblem: true,
            warnings: Array.from(
              new Set([...order.warnings, ...validationIssues]),
            ),
          }
        : { status: "spremna za BEX", bexStatus: "spremno" },
    );
  }

  return (
    <>
      <div
        className="portal-order-status-header"
        data-problem={order.hasProblem}
      >
        <div>
          <span className="portal-page-eyebrow">Porudžbina</span>
          <div className="portal-cluster">
            <h1>{order.number}</h1>
            <Badge tone={statusTone(order.status)} dot>
              {order.status}
            </Badge>
            {order.hasProblem ? (
              <Badge tone="danger">
                <PortalIcon name="warning" />
                zahteva pažnju
              </Badge>
            ) : null}
          </div>
          <p>
            Kreirana {formatDate(order.createdAt, true)} · {order.source} ·
            poslednja izmena {formatDate(order.updatedAt, true)}
          </p>
        </div>
        <div className="portal-page-actions">
          <PortalButton
            icon="copy"
            disabled
            title="Dupliranje nije implementirano u frontend prototipu."
          >
            Dupliraj · mock
          </PortalButton>
          {canProcess ? (
            <>
              <PortalButton
                icon="print"
                disabled
                title="Generisanje radnog naloga nije implementirano u frontend prototipu."
              >
                Radni nalog · mock
              </PortalButton>
              <PortalButton
                variant="primary"
                icon="check"
                disabled={!canConfirm}
                title={
                  canConfirm
                    ? undefined
                    : "Potvrda je dostupna samo u početnim statusima i kada nema upozorenja."
                }
                onClick={() =>
                  changeOrder(
                    "Porudžbina je potvrđena",
                    "Status je promenjen u zajedničkom frontend stanju.",
                    { status: "potvrđena", hasProblem: false },
                  )
                }
              >
                Potvrdi
              </PortalButton>
            </>
          ) : null}
        </div>
      </div>
      {confirmCancel ? (
        <div className="portal-confirm-bar">
          <span>
            <PortalIcon name="warning" />
            <span>
              <strong>Otkazati potvrđenu porudžbinu?</strong>
              <small>
                Mock status i audit događaj ostaju aktivni do osvežavanja
                portala.
              </small>
            </span>
          </span>
          <div>
            <PortalButton
              variant="ghost"
              onClick={() => setConfirmCancel(false)}
            >
              Odustani
            </PortalButton>
            <PortalButton
              variant="danger"
              onClick={() => {
                changeOrder(
                  "Porudžbina je otkazana",
                  "Otkazivanje je potvrđeno u mock toku.",
                  { status: "otkazana", hasProblem: false },
                );
                setConfirmCancel(false);
              }}
            >
              Potvrdi otkazivanje
            </PortalButton>
          </div>
        </div>
      ) : null}
      <ModuleState>
        <Panel className="portal-status-timeline-panel">
          <SectionHeader
            title="Tok obrade"
            description={
              blockedIndex >= 0
                ? "Tok je blokiran na označenom koraku; rešite upozorenje pre nastavka."
                : "Završeni, trenutni i sledeći dozvoljeni koraci porudžbine."
            }
          />
          <div className="portal-status-timeline">
            {orderTimeline.map((status, index) => (
              <div
                key={status}
                data-state={
                  index === blockedIndex
                    ? "blocked"
                    : index < currentIndex
                      ? "done"
                      : index === currentIndex
                        ? "current"
                        : "upcoming"
                }
              >
                <span>
                  {index < currentIndex ? (
                    <PortalIcon name="check" />
                  ) : (
                    index + 1
                  )}
                </span>
                <b>{status}</b>
              </div>
            ))}
          </div>
        </Panel>
        {order.warnings.length ? (
          <Panel accent="warning" className="portal-order-alert">
            <div>
              <PortalIcon name="warning" />
              <span>
                <strong>
                  Porudžbina ima {order.warnings.length}{" "}
                  {order.warnings.length === 1 ? "upozorenje" : "upozorenja"}
                </strong>
                <small>{order.warnings.join(" · ")}</small>
              </span>
            </div>
            <PortalButton
              disabled={resolutionTaskExists}
              title={
                resolutionTaskExists
                  ? "Zadatak za ovu porudžbinu je već otvoren."
                  : undefined
              }
              onClick={() => {
                addTask({
                  id: resolutionTaskId,
                  title: `Rešiti upozorenja za ${order.number}`,
                  dueAt: "2026-08-04T16:00:00",
                  assigneeId: canProcess ? "usr-jelena" : user.id,
                  customerId: order.customerId,
                  priority: "visoka",
                  completed: false,
                });
                notify(
                  "Problem je označen za obradu",
                  "Zaduženje je dodato u zajednički mock operativni red.",
                );
              }}
            >
              {resolutionTaskExists ? "Zadatak otvoren" : "Označi za rešavanje"}
            </PortalButton>
          </Panel>
        ) : null}
        <div className="portal-grid" data-layout="wide-left">
          <div className="portal-stack">
            <Panel>
              <SectionHeader
                title="Stavke porudžbine"
                description={`${order.items.length} stavke · ${order.items.reduce((sum, item) => sum + item.quantity, 0)} komada`}
                action={
                  canProcess ? (
                    <PortalButton
                      icon="edit"
                      disabled
                      title="Izmena postojećih stavki nije implementirana u frontend prototipu."
                    >
                      Izmeni stavke · mock
                    </PortalButton>
                  ) : undefined
                }
              />
              <div className="portal-table-wrap">
                <table className="portal-table">
                  <thead>
                    <tr>
                      <th>Proizvod</th>
                      <th>Količina</th>
                      <th>Redovna cena</th>
                      <th>Primenjena cena</th>
                      <th>Rabat</th>
                      {canViewMargin ? <th>Marža</th> : null}
                      <th>Ukupno</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.productName}</strong>
                          <small>
                            {item.sku}
                            {item.originalInput
                              ? ` · „${item.originalInput}“`
                              : ""}
                          </small>
                        </td>
                        <td>{item.quantity}</td>
                        <td className="portal-table-number">
                          {formatCurrency(item.regularPrice)}
                        </td>
                        <td className="portal-table-number">
                          <strong>{formatCurrency(item.appliedPrice)}</strong>
                        </td>
                        <td>{item.discount}%</td>
                        {canViewMargin ? (
                          <td>
                            <Badge
                              tone={
                                item.margin < 18
                                  ? "danger"
                                  : item.margin < 21
                                    ? "warning"
                                    : "success"
                              }
                            >
                              {item.margin}%
                            </Badge>
                          </td>
                        ) : null}
                        <td className="portal-table-number">
                          {formatCurrency(item.appliedPrice * item.quantity)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="portal-order-financial-total">
                <span>
                  <small>Osnovica</small>
                  <strong>
                    {formatCurrency(Math.round(order.total / 1.2))}
                  </strong>
                </span>
                <span>
                  <small>PDV 20%</small>
                  <strong>
                    {formatCurrency(
                      order.total - Math.round(order.total / 1.2),
                    )}
                  </strong>
                </span>
                <span>
                  <small>Ukupno</small>
                  <strong>{formatCurrency(order.total)}</strong>
                </span>
              </div>
            </Panel>
            <Panel>
              <SectionHeader title="Napomene i interna komunikacija" />
              <div className="portal-notes-grid">
                <div>
                  <span>Napomena kupca</span>
                  <p>
                    {order.customerNote ??
                      "Kupac nije ostavio posebnu napomenu."}
                  </p>
                </div>
                <div>
                  <span>Interna napomena</span>
                  <p>{order.internalNote ?? "Nema interne napomene."}</p>
                </div>
              </div>
              <div className="portal-note-composer">
                <input
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Dodajte internu belešku…"
                />
                <PortalButton
                  icon="plus"
                  disabled={!note.trim()}
                  onClick={() => {
                    changeOrder("Interna beleška je dodata", note, {
                      internalNote: order.internalNote
                        ? `${order.internalNote}\n${note}`
                        : note,
                    });
                    setNote("");
                  }}
                >
                  Dodaj belešku
                </PortalButton>
              </div>
            </Panel>
            <Panel>
              <SectionHeader
                title="Istorija aktivnosti"
                description="Audit događaji povezani sa ovom porudžbinom"
                action={
                  can(role, "audit:view") ? (
                    <Link
                      className="portal-text-link"
                      href="/portal/aktivnosti"
                    >
                      Kompletan audit log
                    </Link>
                  ) : undefined
                }
              />
              <div className="portal-activity-timeline">
                {linkedAuditEvents.slice(0, 8).map((event) => (
                  <div key={event.id}>
                    <span>
                      <PortalIcon
                        name={
                          event.severity === "critical" ? "warning" : "activity"
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
                {!linkedAuditEvents.length ? (
                  <div className="portal-inline-empty">
                    Još nema audit događaja za ovu porudžbinu.
                  </div>
                ) : null}
              </div>
            </Panel>
          </div>
          <aside className="portal-stack">
            <Panel>
              <SectionHeader title="Kupac" />
              <div className="portal-detail-list">
                <Link
                  href={`/portal/kupci/${order.customerId}`}
                  className="portal-customer-title"
                >
                  <span>{order.customerName.slice(0, 2).toUpperCase()}</span>
                  <div>
                    <strong>{order.customerName}</strong>
                    <small>
                      {customer?.code} · {customer?.city}
                    </small>
                  </div>
                  <PortalIcon name="chevron" />
                </Link>
                <div>
                  <span>Kontakt</span>
                  <strong>{order.contactName}</strong>
                  <small>{order.contactPhone}</small>
                </div>
                <div>
                  <span>Adresa isporuke</span>
                  <strong>{order.deliveryAddress}</strong>
                </div>
                <div>
                  <span>Plaćanje</span>
                  <strong>
                    {order.paymentMethod} · {order.paymentStatus}
                  </strong>
                </div>
                <div>
                  <span>Isporuka</span>
                  <strong>{order.deliveryMethod}</strong>
                </div>
              </div>
            </Panel>
            <Panel>
              <SectionHeader title="Integracije" />
              <div className="portal-integration-actions">
                <div>
                  <span>
                    <PortalIcon name="sync" />
                    <span>
                      <strong>BizniSoft</strong>
                      <small>Faktura i stanje porudžbine</small>
                    </span>
                  </span>
                  <Badge tone={statusTone(order.bizniSoftStatus)}>
                    {order.bizniSoftStatus}
                  </Badge>
                  {canProcess ? (
                    <PortalButton
                      icon="sync"
                      disabled={
                        !canQueueBizniSoft ||
                        order.bizniSoftStatus === "čeka" ||
                        order.bizniSoftStatus === "sinhronizovano"
                      }
                      title={
                        canQueueBizniSoft
                          ? undefined
                          : "Prvo potvrdite porudžbinu i rešite cenovna odobrenja."
                      }
                      onClick={queueForBizniSoft}
                    >
                      Pripremi za BizniSoft
                    </PortalButton>
                  ) : null}
                  {canProcess && !canQueueBizniSoft ? (
                    <small className="portal-action-help">
                      Prvo potvrdite porudžbinu i rešite cenovna odobrenja.
                    </small>
                  ) : null}
                </div>
                <div>
                  <span>
                    <PortalIcon name="truck" />
                    <span>
                      <strong>BEX</strong>
                      <small>Pošiljka i adresnica</small>
                    </span>
                  </span>
                  <Badge tone={statusTone(order.bexStatus)}>
                    {order.bexStatus}
                  </Badge>
                  {canProcess ? (
                    <PortalButton
                      icon="truck"
                      disabled={
                        !canPrepareBex ||
                        order.bexStatus === "spremno" ||
                        order.bexStatus === "kreirano" ||
                        order.bexStatus === "u transportu" ||
                        order.bexStatus === "isporučeno"
                      }
                      title={
                        canPrepareBex
                          ? undefined
                          : !order.deliveryMethod.startsWith("BEX")
                            ? "Način isporuke ove porudžbine nije BEX."
                            : "BEX je dostupan tek nakon uspešne BizniSoft sinhronizacije."
                      }
                      onClick={prepareForBex}
                    >
                      Pripremi za BEX
                    </PortalButton>
                  ) : null}
                  {canProcess && !canPrepareBex ? (
                    <small className="portal-action-help">
                      {!order.deliveryMethod.startsWith("BEX")
                        ? "Način isporuke ove porudžbine nije BEX."
                        : "BEX se otključava posle uspešne BizniSoft sinhronizacije."}
                    </small>
                  ) : null}
                </div>
              </div>
            </Panel>
            <Panel>
              <SectionHeader title="Dokumenti" description="Mock prikaz" />
              <div className="portal-documents">
                <button
                  type="button"
                  disabled
                  title="Predračun nije generisan u frontend prototipu."
                >
                  <PortalIcon name="print" />
                  <span>
                    <strong>Predračun</strong>
                    <small>Nije generisan</small>
                  </span>
                </button>
                <button
                  type="button"
                  disabled
                  title="Otpremnica nije generisana u frontend prototipu."
                >
                  <PortalIcon name="package" />
                  <span>
                    <strong>Otpremnica</strong>
                    <small>Nije generisana</small>
                  </span>
                </button>
                <button
                  type="button"
                  disabled
                  title="BEX adresnica nije generisana u frontend prototipu."
                >
                  <PortalIcon name="truck" />
                  <span>
                    <strong>BEX adresnica</strong>
                    <small>Nije generisana</small>
                  </span>
                </button>
              </div>
            </Panel>
            <Panel>
              <SectionHeader title="Ostale akcije" />
              <div className="portal-panel-body portal-stack">
                <PortalButton
                  icon="approval"
                  onClick={() => {
                    submitApproval({
                      id: `apr-order-${order.id}`,
                      type: "kupac preko limita",
                      requestedBy: user.name,
                      requestedAt: new Date().toISOString(),
                      customerId: order.customerId,
                      customerName: order.customerName,
                      reason: `Operativni izuzetak za ${order.number}`,
                      currentValue: order.status,
                      proposedValue: "Dozvoli nastavak obrade",
                      financialEffect: order.total,
                      risk: order.hasProblem ? "visok" : "srednji",
                      status: "čeka",
                    });
                    notify(
                      "Poslato na odobrenje",
                      "Gazda zahtev vidi u zajedničkom approval inbox-u.",
                    );
                  }}
                >
                  Pošalji na odobrenje
                </PortalButton>
                {canProcess ? (
                  <>
                    <PortalButton
                      icon="truck"
                      disabled={!canMarkSent}
                      title={
                        canMarkSent
                          ? undefined
                          : "Pošiljka mora prvo dobiti BEX tracking broj."
                      }
                      onClick={() =>
                        changeOrder(
                          "Označeno kao poslato",
                          "Status je promenjen u zajedničkom mock stanju.",
                          {
                            status: "preuzeta od kurira",
                            bexStatus: "u transportu",
                          },
                        )
                      }
                    >
                      Označi kao poslato
                    </PortalButton>
                    <PortalButton
                      variant="danger"
                      icon="close"
                      disabled={!canCancel}
                      onClick={() => setConfirmCancel(true)}
                    >
                      Otkaži porudžbinu
                    </PortalButton>
                  </>
                ) : null}
              </div>
            </Panel>
          </aside>
        </div>
      </ModuleState>
    </>
  );
}
