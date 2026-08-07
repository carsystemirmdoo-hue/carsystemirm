import type { Permission, UserRole } from "@/types/portal";

export const ROLE_LABELS: Record<UserRole, string> = {
  owner: "Gazda",
  sales: "Komercijalista",
  office: "Sekretarica",
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  owner: "Kompletan pregled firme, cena, marži i odobrenja",
  sales: "Sopstveni kupci, porudžbine i zahtevi za cenu",
  office: "Operativna obrada porudžbina, BizniSoft i BEX",
};

export const rolePermissions: Record<UserRole, Permission[]> = {
  owner: [
    "dashboard:company",
    "orders:view_all",
    "orders:create",
    "orders:process",
    "customers:view_all",
    "customers:view_financials",
    "customers:view_confidential",
    "prices:view",
    "prices:propose",
    "prices:manage",
    "prices:view_margin",
    "products:view",
    "products:view_cost",
    "sales_reps:view",
    "integrations:bex",
    "integrations:biznisoft",
    "approvals:view",
    "approvals:decide",
    "audit:view",
    "settings:manage",
  ],
  sales: [
    "dashboard:sales",
    "orders:view_own",
    "orders:create",
    "customers:view_own",
    "customers:edit_own",
    "prices:view",
    "prices:propose",
    "products:view",
  ],
  office: [
    "dashboard:operations",
    "orders:view_all",
    "orders:create",
    "orders:process",
    "customers:view_all",
    "products:view",
    "integrations:bex",
    "integrations:biznisoft",
  ],
};

export function can(role: UserRole, permission: Permission) {
  return rolePermissions[role].includes(permission);
}

export type ActionAvailability = "allowed" | "approval" | "denied";

export function priceActionAvailability(role: UserRole, newMargin: number): ActionAvailability {
  if (role === "owner") return "allowed";
  if (role === "sales") return newMargin < 20 ? "approval" : "allowed";
  return "denied";
}

export function canAccessCustomer(role: UserRole, userId: string, salesRepId: string) {
  if (role === "owner" || role === "office") return true;
  return userId === salesRepId;
}

export function canAccessOrder(role: UserRole, userId: string, salesRepId: string) {
  if (role === "owner" || role === "office") return can(role, "orders:view_all");
  return can(role, "orders:view_own") && userId === salesRepId;
}

export function canAccessPortalPath(role: UserRole, pathname: string) {
  if (pathname === "/portal" || pathname === "/portal/prijava") return true;
  if (pathname.startsWith("/portal/porudzbine/nova")) return can(role, "orders:create");
  if (pathname.startsWith("/portal/porudzbine")) return can(role, "orders:view_all") || can(role, "orders:view_own");
  if (pathname.startsWith("/portal/kupci")) return can(role, "customers:view_all") || can(role, "customers:view_own");
  if (pathname.startsWith("/portal/cene")) return can(role, "prices:view");
  if (pathname.startsWith("/portal/proizvodi")) return can(role, "products:view");
  if (pathname.startsWith("/portal/komercijalisti")) return can(role, "sales_reps:view");
  if (pathname.startsWith("/portal/bex")) return can(role, "integrations:bex");
  if (pathname.startsWith("/portal/biznissoft")) return can(role, "integrations:biznisoft");
  if (pathname.startsWith("/portal/odobrenja")) return can(role, "approvals:view");
  if (pathname.startsWith("/portal/aktivnosti")) return can(role, "audit:view");
  if (pathname.startsWith("/portal/podesavanja")) return can(role, "settings:manage");
  return false;
}
