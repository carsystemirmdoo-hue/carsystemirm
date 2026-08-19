/**
 * Model uloga i dozvola.
 *
 * Dva odvojena pojma:
 *  - `role`   — osnovna uloga (4 komada, uloga „Menadžer“ ne postoji),
 *  - `package` — paket dozvola koji Gazda dodeljuje pojedinačnom korisniku.
 *
 * Kod nikada ne proverava ime korisnika. Miroslav Suljagić ima dublji pristup
 * isključivo zato što mu je dodeljen paket „analitika“; isti paket bilo kom
 * drugom komercijalisti daje isti pristup, i oduzimanje paketa ga odmah uklanja.
 */

/** @typedef {"gazda"|"komercijalista"|"kancelarija"|"magacioner"} Role */
/** @typedef {"analitika"|"otprema"|"nabavka_predlog"|"porucivanje"|"limiti"|"korisnici"|"pragovi"|"zatvaranje"} PackageKey */

/** Paketi dozvola — isti spisak koji administracija prikazuje u /portal/dozvole. */
export const PERMISSION_PACKAGES = [
  {
    key: "analitika",
    name: "Napredna analitika i izveštaji",
    description:
      "Prodaja po danima, mesecima i godinama, poređenja, drill-down, izvoz i sačuvani filteri",
  },
  {
    key: "otprema",
    name: "Otprema i BEX pošiljke",
    description: "Kreiranje pošiljaka, bulk obrada, adresnice i štampa",
  },
  {
    key: "nabavka_predlog",
    name: "Predlog nabavke (bez poručivanja)",
    description: "Pregled i priprema predloga, bez potvrde količina",
  },
  {
    key: "porucivanje",
    name: "Poručivanje robe",
    description: "Potvrda konačnih količina i kreiranje porudžbine",
  },
  {
    key: "limiti",
    name: "Kreditni limiti",
    description: "Potvrda i izmena limita",
  },
  {
    key: "korisnici",
    name: "Korisnici i dozvole",
    description: "Dodela uloga i individualnih dozvola",
  },
  {
    key: "pragovi",
    name: "Sistemska pravila i pragovi",
    description: "Izmena pragova upozorenja",
  },
  {
    key: "zatvaranje",
    name: "Globalno zatvaranje upozorenja",
    description: "Zatvaranje ozbiljnih upozorenja za sve korisnike",
  },
];

export const PACKAGE_KEYS = PERMISSION_PACKAGES.map((item) => item.key);

export const ROLES = [
  { key: "gazda", label: "Gazda" },
  { key: "komercijalista", label: "Komercijalista" },
  { key: "kancelarija", label: "Kancelarija" },
  { key: "magacioner", label: "Magacioner" },
];

export const ROLE_LABELS = {
  gazda: "Gazda",
  komercijalista: "Komercijalista",
  kancelarija: "Kancelarija / Sekretarica",
  magacioner: "Magacioner",
};

/**
 * Sposobnosti koje kod zaista proverava. Rute i dugmad se vezuju za ove ključeve,
 * nikada direktno za ulogu — tako dodavanje paketa ne zahteva izmenu provera.
 */
export const CAPABILITIES = [
  "view:home",
  "view:analitika",
  "view:kupci",
  "view:prodaja",
  "view:povrati",
  "view:dugovanja",
  "view:limiti",
  "view:zalihe",
  "view:nabavka",
  "view:porudzbine",
  "view:otprema",
  "view:adresnice",
  "view:bex",
  "view:obavestenja",
  "view:izvestaji",
  "view:importi",
  "view:dozvole",
  "view:admin",
  "view:aktivnosti",
  "customers:view_all",
  "limits:approve",
  "procurement:prepare",
  "procurement:confirm",
  "orders:create",
  "shipments:create",
  "labels:print",
  "notifications:resolve_global",
  "users:manage",
  "settings:manage",
  "audit:view",
  "export:data",
];

/**
 * Šta uloga dobija bez ijednog dodatnog paketa.
 * Magacioner namerno nema pristup finansijskoj analitici, limitima ni korisnicima.
 */
const ROLE_BASE = {
  gazda: [
    "view:home",
    "view:analitika",
    "view:kupci",
    "view:prodaja",
    "view:povrati",
    "view:dugovanja",
    "view:limiti",
    "view:zalihe",
    "view:nabavka",
    "view:porudzbine",
    "view:otprema",
    "view:adresnice",
    "view:bex",
    "view:obavestenja",
    "view:izvestaji",
    "view:importi",
    "view:dozvole",
    "view:admin",
    "view:aktivnosti",
    "customers:view_all",
    "limits:approve",
    "procurement:prepare",
    "procurement:confirm",
    "orders:create",
    "shipments:create",
    "labels:print",
    "notifications:resolve_global",
    "users:manage",
    "settings:manage",
    "audit:view",
    "export:data",
  ],
  komercijalista: [
    "view:home",
    "view:kupci",
    "view:prodaja",
    "view:dugovanja",
    "view:obavestenja",
    "export:data",
  ],
  kancelarija: [
    "view:home",
    "view:kupci",
    "view:prodaja",
    "view:dugovanja",
    "view:obavestenja",
    "view:importi",
    "customers:view_all",
    "export:data",
  ],
  magacioner: ["view:otprema", "view:adresnice", "view:bex"],
};

/** Šta svaki paket dodaje povrh osnovne uloge. */
const PACKAGE_GRANTS = {
  analitika: [
    "view:analitika",
    "view:povrati",
    "view:zalihe",
    "view:bex",
    "view:izvestaji",
    "view:importi",
    "customers:view_all",
    "export:data",
  ],
  nabavka_predlog: ["view:nabavka", "view:zalihe", "procurement:prepare"],
  porucivanje: [
    "view:nabavka",
    "view:porudzbine",
    "procurement:prepare",
    "procurement:confirm",
    "orders:create",
  ],
  otprema: [
    "view:otprema",
    "view:adresnice",
    "view:bex",
    "shipments:create",
    "labels:print",
  ],
  limiti: ["view:limiti", "limits:approve"],
  korisnici: ["view:dozvole", "view:aktivnosti", "users:manage", "audit:view"],
  pragovi: ["view:admin", "settings:manage"],
  zatvaranje: ["notifications:resolve_global"],
};

/**
 * Razrešava konačan skup sposobnosti. Poziva se na serveru pri svakom zahtevu,
 * sa paketima pročitanim iz baze — nikada iz tokena, da bi oduzimanje dozvole
 * delovalo odmah, bez ponovne prijave.
 *
 * @param {Role} role
 * @param {readonly string[]} [grantedPackages]
 * @returns {Set<string>}
 */
export function resolveCapabilities(role, grantedPackages = []) {
  const base = ROLE_BASE[role];
  if (!base) return new Set();

  const capabilities = new Set(base);
  for (const key of grantedPackages) {
    const grants = PACKAGE_GRANTS[key];
    if (!grants) continue;
    for (const capability of grants) capabilities.add(capability);
  }
  return capabilities;
}

/**
 * @param {{ role: Role, permissions?: readonly string[] }} user
 * @param {string} capability
 * @returns {boolean}
 */
export function can(user, capability) {
  if (!user || !user.role) return false;
  return resolveCapabilities(user.role, user.permissions ?? []).has(capability);
}

/**
 * Da li uloga sme da vidi sve kupce, ili je ograničena na dodeljene.
 * @param {{ role: Role, permissions?: readonly string[] }} user
 */
export function seesAllCustomers(user) {
  return can(user, "customers:view_all");
}

/**
 * Rute portala i sposobnost koju svaka zahteva. Isti izvor koristi i navigacija
 * i serverska provera, pa se prikaz i ovlašćenje ne mogu razići.
 */
export const ROUTE_CAPABILITY = {
  "/portal": "view:home",
  "/portal/analitika": "view:analitika",
  "/portal/kupci": "view:kupci",
  "/portal/prodaja": "view:prodaja",
  "/portal/povrati": "view:povrati",
  "/portal/dugovanja": "view:dugovanja",
  "/portal/limiti": "view:limiti",
  "/portal/zalihe": "view:zalihe",
  "/portal/nabavka": "view:nabavka",
  "/portal/porudzbine": "view:porudzbine",
  "/portal/otprema": "view:otprema",
  "/portal/adresnice": "view:adresnice",
  "/portal/bex": "view:bex",
  "/portal/obavestenja": "view:obavestenja",
  "/portal/izvestaji": "view:izvestaji",
  "/portal/importi": "view:importi",
  "/portal/dozvole": "view:dozvole",
  "/portal/admin": "view:admin",
  "/portal/aktivnosti": "view:aktivnosti",
};

/**
 * Najspecifičnija ruta koja odgovara putanji, da bi /portal/kupci/<id>
 * nasledio ovlašćenje sa /portal/kupci.
 *
 * @param {string} pathname
 * @returns {string | null}
 */
export function capabilityForPath(pathname) {
  const clean = pathname.replace(/\/+$/, "") || "/portal";

  let match = null;
  for (const route of Object.keys(ROUTE_CAPABILITY)) {
    if (clean === route) return ROUTE_CAPABILITY[route];
    // Koren „/portal“ se poredi samo tačno. Da se poredio i kao prefiks,
    // svaka nepoznata podruta bi nasledila najslabije ovlašćenje početne
    // strane umesto da bude odbijena.
    if (route !== "/portal" && clean.startsWith(`${route}/`)) {
      if (!match || route.length > match.length) match = route;
    }
  }
  return match ? ROUTE_CAPABILITY[match] : null;
}

/**
 * Grupe navigacije tačno kako ih definiše dizajn „Poslovni sistem v2“.
 *
 * `icon` je sužen na imena koja postoji u components/portal/PortalIcon.tsx —
 * bez toga bi TypeScript video običan `string` i propustio grešku u imenu ikone.
 *
 * @typedef {"home"|"chart"|"customers"|"sales"|"activity"|"orders"|"prices"|"package"|"products"|"approval"|"truck"|"print"|"bell"|"sync"|"lock"|"settings"} NavIcon
 * @typedef {{ href: string, label: string, icon: NavIcon }} NavItem
 * @type {ReadonlyArray<{ label: string, items: NavItem[] }>}
 */
export const NAV_GROUPS = [
  {
    label: "Pregled",
    items: [
      { href: "/portal", label: "Početna", icon: "home" },
      { href: "/portal/analitika", label: "Analitika", icon: "chart" },
    ],
  },
  {
    label: "Prodaja",
    items: [
      { href: "/portal/kupci", label: "Kupci", icon: "customers" },
      { href: "/portal/prodaja", label: "Prodaja", icon: "sales" },
      {
        href: "/portal/povrati",
        label: "Povrati i minus fakture",
        icon: "activity",
      },
    ],
  },
  {
    label: "Finansije",
    items: [
      { href: "/portal/dugovanja", label: "Dugovanja", icon: "orders" },
      { href: "/portal/limiti", label: "Kreditni limiti", icon: "prices" },
    ],
  },
  {
    label: "Logistika",
    items: [
      { href: "/portal/zalihe", label: "Zalihe", icon: "package" },
      { href: "/portal/nabavka", label: "Nabavka", icon: "products" },
      { href: "/portal/porudzbine", label: "Porudžbine", icon: "approval" },
      { href: "/portal/otprema", label: "Otprema", icon: "truck" },
      { href: "/portal/adresnice", label: "Adresnice", icon: "print" },
      { href: "/portal/bex", label: "BEX", icon: "truck" },
    ],
  },
  {
    label: "Sistem",
    items: [
      { href: "/portal/obavestenja", label: "Obaveštenja", icon: "bell" },
      { href: "/portal/izvestaji", label: "Izveštaji", icon: "chart" },
      { href: "/portal/importi", label: "Importi", icon: "sync" },
      { href: "/portal/dozvole", label: "Korisnici i dozvole", icon: "lock" },
      { href: "/portal/admin", label: "Administracija", icon: "settings" },
      { href: "/portal/aktivnosti", label: "Aktivnosti", icon: "activity" },
    ],
  },
];

/**
 * Navigacija filtrirana po sposobnostima korisnika. Prazne grupe otpadaju.
 * Ovo je isključivo kozmetika — svaka ruta se nezavisno proverava na serveru.
 *
 * @param {{ role: Role, permissions?: readonly string[] }} user
 */
export function navGroupsFor(user) {
  const capabilities = resolveCapabilities(user.role, user.permissions ?? []);
  return NAV_GROUPS.map((group) => ({
    label: group.label,
    items: group.items.filter((item) =>
      capabilities.has(ROUTE_CAPABILITY[item.href]),
    ),
  })).filter((group) => group.items.length > 0);
}

/**
 * Prva ruta koju korisnik sme da otvori — odredište posle prijave i
 * rezerva kada mu je tekuća ruta zabranjena.
 *
 * @param {{ role: Role, permissions?: readonly string[] }} user
 * @returns {string}
 */
export function landingRouteFor(user) {
  const groups = navGroupsFor(user);
  return groups[0]?.items[0]?.href ?? "/portal/nemate-pristup";
}
