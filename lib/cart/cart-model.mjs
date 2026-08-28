/**
 * Model korpe za ceo katalog.
 *
 * Korpa je lista proizvoda za upit/ponudu. Cena i stanje se NE čuvaju ovde —
 * client-side podatak nije autoritet. Konačna provera SKU-a, stanja, količine
 * i cene kupca radi se na serveru pri slanju upita.
 *
 * @typedef {{
 *   id: string, productSlug: string, familySlug: string|null,
 *   variantId: string|null, sku: string, name: string, image: string|null,
 *   volume: string|null, brandSlug: string, inventoryKey: string|null,
 *   quantity: number
 * }} CartItem
 * @typedef {{ items: CartItem[] }} CartState
 */

/**
 * Prefiks i verzija zapisa u `localStorage`.
 *
 * Verzija je deo kljuca namerno: kada se oblik zapisa ili pravilo namespace-a
 * promeni, stari zapis se ne cita niti migrira nego jednostavno vise ne postoji
 * pod novim kljucem.
 */
export const CART_STORAGE_PREFIX = "carsystem.cart";
export const CART_STORAGE_VERSION = "v3";

/**
 * Kanonski UUID, kakav Postgres upisuje u `users.id`.
 *
 * Kolona je `uuid("id").primaryKey().defaultRandom()`, a `loadPortalUser`
 * cita bas nju — vrednost koja stize do `CartProvider`-a je uvek kanonski
 * UUID, bez obzira sta je token nosio. TypeScript ga siri na `string`, pa se
 * oblik proverava ovde, na granici.
 */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Kljuc pod kojim se korpa cuva, vezan za PRIJAVLJENOG korisnika.
 *
 * Namespace je CEO UUID korisnika. To je 122 slucajna bita — dva naloga ne mogu
 * zavrsiti pod istim kljucem.
 *
 * Zasto ne skraceni otisak
 * ------------------------
 * Ranija verzija je koristila 32-bitni FNV-1a otisak. Trideset dva bita nisu
 * granica izmedju korisnika: po rodjendanskom paradoksu sudar postaje verovatan
 * vec na desetinama hiljada vrednosti, a jedan sudar znaci da dva naloga dele
 * korpu. Pun kanonski UUID prakticno uklanja rizik tog sudara.
 *
 * Sta UUID jeste, a sta nije
 * --------------------------
 * UUID ne sadrzi email, ime ni citljiv poslovni podatak, pa moze stajati u
 * kljucu. Ali on JESTE pseudonimni identifikator koji se moze povezati sa
 * nalogom — zato se ne ispisuje u QA logovima. Sve sto NIJE UUID se odbija:
 * email, ime i proizvoljan tekst ne smeju postati namespace.
 *
 * OGRANICENJE: `localStorage` nije bezbednosna baza niti zamena za buducu
 * serversku korpu po korisniku/tenantu. Zapis je citljiv svakome ko ima pristup
 * profilu pretrazivaca na tom racunaru, a scope je po KORISNIKU, ne po tenantu.
 * Customer/tenant model jos ne postoji; kada stigne, kljuc mora dobiti i njegov
 * identitet, a nosilac istine mora postati server.
 *
 * @param {string} userId kanonski UUID prijavljenog korisnika
 * @returns {string}
 */
export function cartStorageKey(userId) {
  if (typeof userId !== "string" || !UUID_PATTERN.test(userId.trim())) {
    throw new Error(
      "cartStorageKey: ocekivan kanonski UUID korisnika (users.id)",
    );
  }
  return `${CART_STORAGE_PREFIX}.${CART_STORAGE_VERSION}.${userId.trim().toLowerCase()}`;
}

/**
 * Zapisi iz ranijih verzija koje treba ODBACITI, ne migrirati.
 *
 *   - `carsystem.cart.v1` — jedan globalni kljuc, bez ikakvog vlasnika;
 *   - `carsystem.cart.v2.*` — 32-bitni otisak, pa se vlasnik ne moze pouzdano
 *     utvrditi ni unazad.
 *
 * U oba slucaja se ne zna kom nalogu zapis pripada, pa prenos ka bilo kom
 * korisniku znaci pripisivanje tudje poslovne namere.
 */
export const LEGACY_CART_STORAGE_KEY = "carsystem.cart.v1";
export const WEAK_CART_STORAGE_PREFIX = "carsystem.cart.v2.";

/**
 * Da li kljuc pripada zapisu koji se odbacuje.
 *
 * @param {string} key
 * @returns {boolean}
 */
export function isDiscardedCartKey(key) {
  if (typeof key !== "string") return false;
  return key === LEGACY_CART_STORAGE_KEY || key.startsWith(WEAK_CART_STORAGE_PREFIX);
}

export const CART_MAX_QUANTITY = 999;

/** @type {CartState} */
export const emptyCart = { items: [] };

/**
 * @param {{ productSlug: string, variantId?: string|null }} input
 * @returns {string}
 */
export function cartItemId(input) {
  return input.variantId
    ? `${input.productSlug}::${input.variantId}`
    : input.productSlug;
}

/** @param {number} value @returns {number} */
function clampQuantity(value) {
  if (!Number.isFinite(value)) return 1;
  return Math.min(CART_MAX_QUANTITY, Math.max(1, Math.round(value)));
}

/**
 * Dodavanje iste varijante povećava količinu umesto da pravi duplikat.
 * @param {CartState} state
 * @param {Omit<CartItem, "id"|"quantity">} item
 * @param {number} [quantity]
 * @returns {CartState}
 */
export function addToCart(state, item, quantity = 1) {
  const id = cartItemId(item);
  const wanted = clampQuantity(quantity);
  const existing = state.items.find((entry) => entry.id === id);

  if (existing) {
    return {
      items: state.items.map((entry) =>
        entry.id === id
          ? { ...entry, quantity: clampQuantity(entry.quantity + wanted) }
          : entry,
      ),
    };
  }

  return { items: [...state.items, { ...item, id, quantity: wanted }] };
}

/**
 * @param {CartState} state @param {string} id @param {number} quantity
 * @returns {CartState}
 */
export function setQuantity(state, id, quantity) {
  if (quantity <= 0) return removeFromCart(state, id);
  return {
    items: state.items.map((entry) =>
      entry.id === id ? { ...entry, quantity: clampQuantity(quantity) } : entry,
    ),
  };
}

/** @param {CartState} state @param {string} id @returns {CartState} */
export function removeFromCart(state, id) {
  return { items: state.items.filter((entry) => entry.id !== id) };
}

/** @returns {CartState} */
export function clearCart() {
  return { items: [] };
}

/** @param {CartState} state @returns {number} */
export function cartCount(state) {
  return state.items.reduce((total, entry) => total + entry.quantity, 0);
}

/**
 * Čita sačuvanu korpu i odbacuje zapise bez važećeg oblika ili čiji SKU više
 * ne postoji u katalogu.
 *
 * @param {string|null} raw
 * @param {ReadonlySet<string>} [knownSlugs]
 * @returns {CartState}
 */
export function parseStoredCart(raw, knownSlugs) {
  if (!raw) return emptyCart;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return emptyCart;
    const items = parsed.items;
    if (!Array.isArray(items)) return emptyCart;

    const valid = items.filter((entry) => {
      if (!entry || typeof entry !== "object") return false;
      if (typeof entry.id !== "string" || typeof entry.productSlug !== "string") {
        return false;
      }
      if (typeof entry.sku !== "string" || typeof entry.name !== "string") {
        return false;
      }
      if (typeof entry.quantity !== "number" || entry.quantity <= 0) return false;
      if (knownSlugs && !knownSlugs.has(entry.productSlug)) return false;
      return true;
    });

    return {
      items: valid.map((item) => ({ ...item, quantity: clampQuantity(item.quantity) })),
    };
  } catch {
    return emptyCart;
  }
}
