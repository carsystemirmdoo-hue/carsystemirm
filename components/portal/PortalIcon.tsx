import type { SVGProps } from "react";

export type PortalIconName = "home" | "orders" | "customers" | "prices" | "products" | "sales" | "truck" | "sync" | "approval" | "activity" | "settings" | "search" | "plus" | "bell" | "chevron" | "menu" | "close" | "filter" | "download" | "more" | "arrow" | "warning" | "check" | "clock" | "lock" | "eye" | "edit" | "phone" | "mail" | "location" | "chart" | "package" | "copy" | "print" | "logout" | "panel" | "spark";

export function PortalIcon({ name, ...props }: { name: PortalIconName } & SVGProps<SVGSVGElement>) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const content: Record<PortalIconName, React.ReactNode> = {
    home: <><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></>,
    orders: <><path d="M6 3h12l2 4v14H4V7l2-4Z"/><path d="M4 8h16M9 12h6"/></>,
    customers: <><circle cx="9" cy="8" r="4"/><path d="M2.5 21a6.5 6.5 0 0 1 13 0M16 6.5a3.5 3.5 0 0 1 0 6.8M17.5 16a5 5 0 0 1 4 5"/></>,
    prices: <><path d="M20 12 12 20 4 12V4h8l8 8Z"/><circle cx="8.5" cy="8.5" r="1"/></>,
    products: <><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 8 9 5 9-5v8l-9 5-9-5V8Z"/></>,
    sales: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
    truck: <><path d="M3 5h12v12H3zM15 9h4l3 4v4h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></>,
    sync: <><path d="M20 7h-5V2"/><path d="M4 17h5v5"/><path d="M18.5 17a8 8 0 0 1-13-1M5.5 7a8 8 0 0 1 13 1"/></>,
    approval: <><path d="M9 3h6l1 2h4v16H4V5h4l1-2Z"/><path d="m8 13 3 3 6-7"/></>,
    activity: <><path d="M3 12h4l2-7 4 14 2-7h6"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1v.1h-4v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1-.4h-.1v-4H3A1.7 1.7 0 0 0 4.6 8.5a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1v-.1h4V3A1.7 1.7 0 0 0 15.5 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.14.38.35.72.6 1 .27.28.62.4 1 .4h.1v4H21a1.7 1.7 0 0 0-1.6.6Z"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
    chevron: <path d="m9 18 6-6-6-6"/>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16"/></>,
    close: <><path d="m6 6 12 12M18 6 6 18"/></>,
    filter: <path d="M4 5h16l-6 7v6l-4 2v-8L4 5Z"/>,
    download: <><path d="M12 3v12m0 0 5-5m-5 5-5-5M4 21h16"/></>,
    more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6"/></>,
    warning: <><path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 9v5M12 17.5h.01"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    lock: <><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
    eye: <><path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/></>,
    edit: <><path d="m14 4 6 6L9 21H3v-6L14 4Z"/><path d="m12 6 6 6"/></>,
    phone: <path d="M7 3H4a1 1 0 0 0-1 1c0 9.4 7.6 17 17 17a1 1 0 0 0 1-1v-3l-5-2-2 3c-3.5-1.4-6.6-4.5-8-8l3-2-2-5Z"/>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 7 9-7"/></>,
    location: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
    chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
    package: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/></>,
    copy: <><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></>,
    print: <><path d="M7 8V3h10v5M7 17H4V9h16v8h-3M7 14h10v7H7z"/></>,
    logout: <><path d="M10 4H4v16h6M14 8l4 4-4 4M18 12H9"/></>,
    panel: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/></>,
    spark: <><path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3Z"/><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z"/></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" {...common} {...props}>{content[name]}</svg>;
}
