"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  approvalRequests as initialApprovals,
  auditEvents as initialAuditEvents,
  bexShipments as initialBexShipments,
  bizniSoftSyncRecords as initialBizniSoftRecords,
  demoUsers,
  notifications as initialNotifications,
  orders as initialOrders,
  priceRules as initialPriceRules,
  tasks as initialTasks,
} from "@/fixtures/dev/portal";
import type {
  ApprovalRequest,
  AuditEvent,
  BexShipment,
  BizniSoftSyncRecord,
  DemoDataState,
  Notification,
  Order,
  PriceChangeBatch,
  PriceRule,
  Task,
  User,
  UserRole,
} from "@/types/portal";

type ToastTone = "success" | "warning" | "info";
type AuditInput = Omit<AuditEvent, "id" | "occurredAt" | "userName" | "role">;

interface ToastMessage {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
}

interface PortalContextValue {
  user: User;
  role: UserRole;
  setRole: (role: UserRole) => void;
  signedIn: boolean;
  sessionReady: boolean;
  signIn: (role: UserRole) => void;
  signOut: () => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
  uiState: DemoDataState;
  setUiState: (state: DemoDataState) => void;
  notifications: Notification[];
  unreadCount: number;
  markNotificationRead: (id: string) => void;
  orders: Order[];
  addOrder: (order: Order) => void;
  updateOrder: (id: string, patch: Partial<Order>) => void;
  tasks: Task[];
  addTask: (task: Task) => void;
  toggleTask: (id: string) => void;
  bexShipments: BexShipment[];
  upsertBexShipment: (shipment: BexShipment) => void;
  updateBexShipment: (id: string, patch: Partial<BexShipment>) => void;
  bizniSoftRecords: BizniSoftSyncRecord[];
  upsertBizniSoftRecord: (record: BizniSoftSyncRecord) => void;
  updateBizniSoftRecord: (
    id: string,
    patch: Partial<BizniSoftSyncRecord>,
  ) => void;
  approvals: ApprovalRequest[];
  submitApproval: (
    approval: ApprovalRequest,
    options?: { logEvent?: boolean },
  ) => void;
  decideApproval: (
    id: string,
    status: ApprovalRequest["status"],
    comment?: string,
  ) => void;
  priceRules: PriceRule[];
  priceBatches: PriceChangeBatch[];
  addPriceBatch: (batch: PriceChangeBatch) => void;
  auditEvents: AuditEvent[];
  logEvent: (event: AuditInput) => void;
  toasts: ToastMessage[];
  notify: (title: string, description?: string, tone?: ToastTone) => void;
}

const PortalContext = createContext<PortalContextValue | null>(null);

function ruleFromBatch(batch: PriceChangeBatch): PriceRule {
  const appliedRows = batch.rows.filter(
    (row) => !row.excluded && row.outcome !== "blocked",
  );
  const appliedCustomerIds = [
    ...new Set(appliedRows.map((row) => row.customerId)),
  ];
  const appliedProductIds = [
    ...new Set(appliedRows.map((row) => row.productId)),
  ];
  const appliedTarget = {
    ...batch.target,
    pairIds: appliedRows.map((row) => `${row.customerId}:${row.productId}`),
    customerIds: appliedCustomerIds,
    productIds: appliedProductIds,
  };
  const priority =
    appliedTarget.customerIds?.length && appliedTarget.productIds?.length
      ? 1
      : batch.target.customerIds?.length && batch.target.productGroups?.length
        ? 2
        : batch.target.customerIds?.length && batch.target.manufacturers?.length
          ? 3
          : batch.target.customerSegments?.length
            ? 4
            : batch.type === "promotion"
              ? 5
              : batch.type === "quantity"
                ? 6
                : 7;
  return {
    id: `rule-${batch.id}`,
    name: batch.name,
    priority,
    type: batch.type,
    value: batch.value,
    target: appliedTarget,
    status: "aktivno",
    validFrom: batch.validFrom,
    validTo: batch.validTo,
    minimumMargin: batch.minimumMargin,
    createdBy: batch.createdBy,
    createdAt: batch.createdAt,
    reason: batch.reason,
  };
}

export function PortalProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<UserRole>("owner");
  const [signedIn, setSignedIn] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [uiState, setUiState] = useState<DemoDataState>("normal");
  const [notifications, setNotifications] = useState(initialNotifications);
  const [orders, setOrders] = useState(initialOrders);
  const [tasks, setTasks] = useState(initialTasks);
  const [bexShipments, setBexShipments] = useState(initialBexShipments);
  const [bizniSoftRecords, setBizniSoftRecords] = useState(
    initialBizniSoftRecords,
  );
  const [approvals, setApprovals] = useState(initialApprovals);
  const [priceRules, setPriceRules] = useState(initialPriceRules);
  const [priceBatches, setPriceBatches] = useState<PriceChangeBatch[]>([]);
  const [auditEvents, setAuditEvents] = useState(initialAuditEvents);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const storedRole = window.localStorage.getItem(
      "carsystem-portal-role",
    ) as UserRole | null;
    const storedSession = window.localStorage.getItem(
      "carsystem-portal-session",
    );
    if (storedRole && storedRole in demoUsers) setRoleState(storedRole);
    setSignedIn(storedSession === "active");
    setSessionReady(true);
  }, []);

  const setRole = useCallback((nextRole: UserRole) => {
    setRoleState(nextRole);
    window.localStorage.setItem("carsystem-portal-role", nextRole);
  }, []);

  const signIn = useCallback((nextRole: UserRole) => {
    setRoleState(nextRole);
    setSignedIn(true);
    window.localStorage.setItem("carsystem-portal-role", nextRole);
    window.localStorage.setItem("carsystem-portal-session", "active");
  }, []);

  const signOut = useCallback(() => {
    setSignedIn(false);
    window.localStorage.removeItem("carsystem-portal-session");
  }, []);

  const notify = useCallback(
    (title: string, description?: string, tone: ToastTone = "success") => {
      const id = Date.now();
      setToasts((current) => [...current, { id, title, description, tone }]);
      window.setTimeout(
        () =>
          setToasts((current) => current.filter((toast) => toast.id !== id)),
        3600,
      );
    },
    [],
  );

  const logEvent = useCallback(
    (event: AuditInput) => {
      setAuditEvents((current) => [
        {
          ...event,
          id: `evt-live-${Date.now()}-${current.length}`,
          occurredAt: new Date().toISOString(),
          userName: demoUsers[role].name,
          role,
        },
        ...current,
      ]);
    },
    [role],
  );

  const addOrder = useCallback(
    (order: Order) => {
      setOrders((current) => [order, ...current]);
      logEvent({
        action: "Kreirana porudžbina",
        module: "Porudžbine",
        entityType: "Porudžbina",
        entityId: order.id,
        entityLabel: order.number,
        severity: order.hasProblem ? "warning" : "info",
        reason: "Porudžbina je kreirana kroz mock operativni tok",
        before: {},
        after: { status: order.status, vrednost: order.total },
      });
    },
    [logEvent],
  );

  const updateOrder = useCallback((id: string, patch: Partial<Order>) => {
    setOrders((current) =>
      current.map((order) =>
        order.id === id
          ? { ...order, ...patch, updatedAt: new Date().toISOString() }
          : order,
      ),
    );
  }, []);

  const addTask = useCallback(
    (task: Task) => {
      setTasks((current) =>
        current.some((item) => item.id === task.id)
          ? current
          : [task, ...current],
      );
      logEvent({
        action: "Dodat zadatak",
        module: "Zadaci",
        entityType: task.customerId ? "Kupac" : "Zadatak",
        entityId: task.customerId ?? task.id,
        entityLabel: task.title,
        severity: task.priority === "visoka" ? "warning" : "info",
        reason: "Zadatak je dodat u zajedničko mock stanje",
        before: { status: "nije postojao" },
        after: { status: "otvoren", rok: task.dueAt },
      });
    },
    [logEvent],
  );

  const toggleTask = useCallback(
    (id: string) => {
      const task = tasks.find((item) => item.id === id);
      if (!task) return;
      setTasks((current) =>
        current.map((item) =>
          item.id === id ? { ...item, completed: !item.completed } : item,
        ),
      );
      logEvent({
        action: task.completed ? "Ponovo otvoren zadatak" : "Završen zadatak",
        module: "Zadaci",
        entityType: task.customerId ? "Kupac" : "Zadatak",
        entityId: task.customerId ?? task.id,
        entityLabel: task.title,
        severity: "info",
        reason: "Status zadatka je promenjen u zajedničkom mock stanju",
        before: { završen: task.completed },
        after: { završen: !task.completed },
      });
    },
    [logEvent, tasks],
  );

  const syncOrderFromBex = useCallback(
    (shipment: BexShipment, patch: Partial<BexShipment>) => {
      const status = patch.status ?? shipment.status;
      const orderPatch: Partial<Order> =
        status === "greška"
          ? { status: "problem", bexStatus: "greška", hasProblem: true }
          : status === "spremna"
            ? { status: "spremna za BEX", bexStatus: "spremno" }
            : status === "kreirana"
              ? { bexStatus: "kreirano" }
              : status === "u transportu"
                ? { status: "u transportu", bexStatus: "u transportu" }
                : status === "isporučena"
                  ? { status: "isporučena", bexStatus: "isporučeno" }
                  : {};
      setOrders((current) =>
        current.map((order) =>
          order.id === shipment.orderId
            ? { ...order, ...orderPatch, updatedAt: new Date().toISOString() }
            : order,
        ),
      );
    },
    [],
  );

  const upsertBexShipment = useCallback(
    (shipment: BexShipment) => {
      setBexShipments((current) => [
        shipment,
        ...current.filter((item) => item.id !== shipment.id),
      ]);
      syncOrderFromBex(shipment, shipment);
    },
    [syncOrderFromBex],
  );

  const updateBexShipment = useCallback(
    (id: string, patch: Partial<BexShipment>) => {
      const shipment = bexShipments.find((item) => item.id === id);
      if (shipment) syncOrderFromBex(shipment, patch);
      setBexShipments((current) =>
        current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      );
    },
    [bexShipments, syncOrderFromBex],
  );

  const syncOrderFromBizniSoft = useCallback(
    (record: BizniSoftSyncRecord, patch: Partial<BizniSoftSyncRecord>) => {
      if (record.entityType !== "porudžbina") return;
      const status = patch.status ?? record.status;
      const bizniSoftStatus: Order["bizniSoftStatus"] =
        status === "sinhronizovano"
          ? "sinhronizovano"
          : status === "greška"
            ? "greška"
            : "čeka";
      const orderStatus: Order["status"] | undefined =
        status === "sinhronizovano"
          ? "spremna za pakovanje"
          : status === "greška"
            ? "problem"
            : undefined;
      setOrders((current) =>
        current.map((order) =>
          order.id === record.entityId
            ? {
                ...order,
                bizniSoftStatus,
                ...(orderStatus ? { status: orderStatus } : {}),
                ...(status === "greška" ? { hasProblem: true } : {}),
                updatedAt: new Date().toISOString(),
              }
            : order,
        ),
      );
    },
    [],
  );

  const upsertBizniSoftRecord = useCallback(
    (record: BizniSoftSyncRecord) => {
      setBizniSoftRecords((current) => [
        record,
        ...current.filter((item) => item.id !== record.id),
      ]);
      syncOrderFromBizniSoft(record, record);
    },
    [syncOrderFromBizniSoft],
  );

  const updateBizniSoftRecord = useCallback(
    (id: string, patch: Partial<BizniSoftSyncRecord>) => {
      const record = bizniSoftRecords.find((item) => item.id === id);
      if (record) syncOrderFromBizniSoft(record, patch);
      setBizniSoftRecords((current) =>
        current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      );
    },
    [bizniSoftRecords, syncOrderFromBizniSoft],
  );

  const submitApproval = useCallback(
    (approval: ApprovalRequest, options?: { logEvent?: boolean }) => {
      setApprovals((current) =>
        current.some((item) => item.id === approval.id)
          ? current
          : [approval, ...current],
      );
      if (options?.logEvent === false) return;
      logEvent({
        action: "Poslat zahtev za odobrenje",
        module: "Odobrenja",
        entityType: "Kupac",
        entityId: approval.customerId,
        entityLabel: approval.customerName,
        severity: approval.risk === "visok" ? "critical" : "warning",
        reason: approval.reason,
        before: { status: "nacrt", vrednost: approval.currentValue },
        after: { status: "čeka", vrednost: approval.proposedValue },
      });
    },
    [logEvent],
  );

  const addPriceBatch = useCallback(
    (batch: PriceChangeBatch) => {
      setPriceBatches((current) => [
        batch,
        ...current.filter((item) => item.id !== batch.id),
      ]);
      if (batch.status === "primenjeno") {
        const rule = ruleFromBatch(batch);
        setPriceRules((current) => [
          rule,
          ...current.filter((item) => item.id !== rule.id),
        ]);
      }
      logEvent({
        action:
          batch.status === "primenjeno"
            ? "Primenjena bulk promena cena"
            : "Kreiran zahtev za promenu cena",
        module: "Cene",
        entityType: "Promena cena",
        entityId: batch.id,
        entityLabel: batch.name,
        severity: batch.rows.some(
          (row) =>
            !row.excluded &&
            row.outcome !== "blocked" &&
            (row.warning || row.outcome === "approval"),
        )
          ? "warning"
          : "info",
        reason: `${batch.reason} · ${batch.rows.filter((row) => !row.excluded && row.outcome !== "blocked").length} cenovnih kombinacija`,
        before: { status: "nacrt" },
        after: { status: batch.status, vrednost: batch.value },
      });
    },
    [logEvent],
  );

  const decideApproval = useCallback(
    (id: string, status: ApprovalRequest["status"], comment?: string) => {
      const approval = approvals.find((item) => item.id === id);
      if (!approval) return;
      setApprovals((current) =>
        current.map((item) =>
          item.id === id
            ? { ...item, status, comment: comment || item.comment }
            : item,
        ),
      );
      if (status === "odobreno" && approval.priceBatchId) {
        const batch = priceBatches.find(
          (item) => item.id === approval.priceBatchId,
        );
        if (batch) {
          const approvedBatch = { ...batch, status: "primenjeno" as const };
          setPriceBatches((current) =>
            current.map((item) =>
              item.id === batch.id ? approvedBatch : item,
            ),
          );
          const rule = ruleFromBatch(approvedBatch);
          setPriceRules((current) => [
            rule,
            ...current.filter((item) => item.id !== rule.id),
          ]);
        }
      }
      logEvent({
        action:
          status === "odobreno"
            ? "Odobren zahtev"
            : status === "odbijeno"
              ? "Odbijen zahtev"
              : "Zahtev vraćen na doradu",
        module: "Odobrenja",
        entityType: "Kupac",
        entityId: approval.customerId,
        entityLabel: approval.customerName,
        severity: status === "odbijeno" ? "warning" : "info",
        reason: comment || approval.reason,
        before: { status: approval.status, vrednost: approval.currentValue },
        after: { status, vrednost: approval.proposedValue },
      });
    },
    [approvals, priceBatches, logEvent],
  );

  const value = useMemo<PortalContextValue>(
    () => ({
      user: demoUsers[role],
      role,
      setRole,
      signedIn,
      sessionReady,
      signIn,
      signOut,
      sidebarCollapsed,
      setSidebarCollapsed,
      mobileNavOpen,
      setMobileNavOpen,
      uiState,
      setUiState,
      notifications,
      unreadCount: notifications.filter((notification) => !notification.read)
        .length,
      markNotificationRead: (id) =>
        setNotifications((current) =>
          current.map((notification) =>
            notification.id === id
              ? { ...notification, read: true }
              : notification,
          ),
        ),
      orders,
      addOrder,
      updateOrder,
      tasks,
      addTask,
      toggleTask,
      bexShipments,
      upsertBexShipment,
      updateBexShipment,
      bizniSoftRecords,
      upsertBizniSoftRecord,
      updateBizniSoftRecord,
      approvals,
      submitApproval,
      decideApproval,
      priceRules,
      priceBatches,
      addPriceBatch,
      auditEvents,
      logEvent,
      toasts,
      notify,
    }),
    [
      role,
      setRole,
      signedIn,
      sessionReady,
      signIn,
      signOut,
      sidebarCollapsed,
      mobileNavOpen,
      uiState,
      notifications,
      orders,
      addOrder,
      updateOrder,
      tasks,
      addTask,
      toggleTask,
      bexShipments,
      upsertBexShipment,
      updateBexShipment,
      bizniSoftRecords,
      upsertBizniSoftRecord,
      updateBizniSoftRecord,
      approvals,
      submitApproval,
      decideApproval,
      priceRules,
      priceBatches,
      addPriceBatch,
      auditEvents,
      logEvent,
      toasts,
      notify,
    ],
  );

  return (
    <PortalContext.Provider value={value}>{children}</PortalContext.Provider>
  );
}

export function usePortal() {
  const value = useContext(PortalContext);
  if (!value)
    throw new Error("usePortal mora biti korišćen unutar PortalProvider-a");
  return value;
}
