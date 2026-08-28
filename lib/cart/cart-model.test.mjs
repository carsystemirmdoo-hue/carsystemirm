import assert from "node:assert/strict";
import test from "node:test";
import {
  addToCart,
  cartCount,
  cartItemId,
  cartStorageKey,
  isDiscardedCartKey,
  clearCart,
  emptyCart,
  parseStoredCart,
  removeFromCart,
  setQuantity,
  CART_MAX_QUANTITY,
  LEGACY_CART_STORAGE_KEY,
  WEAK_CART_STORAGE_PREFIX,
} from "./cart-model.mjs";

const base = { productSlug: "baslac-35-m214", familySlug: "baslac-line-35",
  variantId: "35-M214", sku: "35-M214", name: "Baslac 35-M214", image: null,
  volume: "3,5 L", brandSlug: "baslac", inventoryKey: "baslac:35-m214:3-5l" };

test("dodavanje jedne varijante", () => {
  const s = addToCart(emptyCart, base, 2);
  assert.equal(s.items.length, 1);
  assert.equal(s.items[0].quantity, 2);
  assert.equal(s.items[0].id, cartItemId(base));
});

test("ista varijanta se spaja umesto da pravi duplikat", () => {
  let s = addToCart(emptyCart, base, 2);
  s = addToCart(s, base, 3);
  assert.equal(s.items.length, 1);
  assert.equal(s.items[0].quantity, 5);
});

test("dodavanje vise varijanti", () => {
  const other = { ...base, productSlug: "baslac-35-m331", variantId: "35-M331", sku: "35-M331" };
  let s = addToCart(emptyCart, base, 1);
  s = addToCart(s, other, 4);
  assert.equal(s.items.length, 2);
  assert.equal(cartCount(s), 5);
});

test("promena kolicine i uklanjanje", () => {
  let s = addToCart(emptyCart, base, 1);
  s = setQuantity(s, cartItemId(base), 7);
  assert.equal(s.items[0].quantity, 7);
  s = setQuantity(s, cartItemId(base), 0);
  assert.equal(s.items.length, 0, "kolicina 0 uklanja stavku");
  s = addToCart(emptyCart, base, 1);
  assert.equal(removeFromCart(s, cartItemId(base)).items.length, 0);
  assert.equal(clearCart().items.length, 0);
});

test("kolicina je ogranicena i celobrojna", () => {
  assert.equal(addToCart(emptyCart, base, 0).items[0].quantity, 1);
  assert.equal(addToCart(emptyCart, base, 5000).items[0].quantity, 999);
  assert.equal(addToCart(emptyCart, base, 2.6).items[0].quantity, 3);
});

test("persistencija odbacuje neispravne i nepostojece zapise", () => {
  const stored = JSON.stringify(addToCart(emptyCart, base, 2));
  assert.equal(parseStoredCart(stored).items.length, 1);
  assert.equal(parseStoredCart(null).items.length, 0);
  assert.equal(parseStoredCart("{niječejson").items.length, 0);
  assert.equal(parseStoredCart('{"items":[{"id":"x"}]}').items.length, 0);
  // SKU koji vise ne postoji u katalogu se odbacuje.
  assert.equal(parseStoredCart(stored, new Set(["drugi-slug"])).items.length, 0);
  assert.equal(parseStoredCart(stored, new Set(["baslac-35-m214"])).items.length, 1);
});

test("korpa ne nosi cenu", () => {
  const s = addToCart(emptyCart, base, 1);
  assert.equal("price" in s.items[0], false);
  assert.equal("cena" in s.items[0], false);
});

/* ==========================================================================
 * Izolacija korisnika i skladiste
 * ========================================================================== */

/* ==========================================================================
 * Validacija kolicine i identiteta
 * ========================================================================== */

const OSNOVA = {
  productSlug: "baslac-line-35",
  variantId: "35-M1010",
  sku: "35-M1010",
  name: "Baslac 35-M1010",
  image: null,
  volume: "3,5 L",
  brandSlug: "baslac",
  familySlug: "baslac-line-35",
  inventoryKey: null,
};

test("nevalidna kolicina se odbija, ne propagira", () => {
  for (const lose of [NaN, Infinity, -Infinity, -5, 0, "abc", null, undefined]) {
    const s = addToCart(emptyCart, OSNOVA, lose);
    assert.equal(s.items.length, 1);
    assert.ok(Number.isInteger(s.items[0].quantity), `${lose} → ${s.items[0].quantity}`);
    assert.ok(s.items[0].quantity >= 1, `${lose} daje kolicinu ispod 1`);
    assert.ok(s.items[0].quantity <= CART_MAX_QUANTITY, `${lose} prelazi maksimum`);
  }
});

test("decimalna kolicina se zaokruzuje na ceo broj", () => {
  assert.equal(addToCart(emptyCart, OSNOVA, 2.4).items[0].quantity, 2);
  assert.equal(addToCart(emptyCart, OSNOVA, 2.6).items[0].quantity, 3);
});

test("prevelika kolicina se secе na maksimum", () => {
  assert.equal(addToCart(emptyCart, OSNOVA, 10_000).items[0].quantity, CART_MAX_QUANTITY);
  const pun = addToCart(emptyCart, OSNOVA, CART_MAX_QUANTITY);
  assert.equal(addToCart(pun, OSNOVA, 50).items[0].quantity, CART_MAX_QUANTITY);
});

test("identitet stavke je stabilan i razlikuje varijante", () => {
  const a = cartItemId({ productSlug: "baslac-line-35", variantId: "35-M1010" });
  const b = cartItemId({ productSlug: "baslac-line-35", variantId: "35-M1021" });
  const c = cartItemId({ productSlug: "baslac-line-35", variantId: null });

  assert.notEqual(a, b, "dve varijante dele isti identitet");
  assert.notEqual(a, c, "varijanta i proizvod bez varijante dele identitet");
  assert.equal(a, cartItemId({ productSlug: "baslac-line-35", variantId: "35-M1010" }));

  // Dve razlicite varijante ostaju dve stavke.
  const s = addToCart(addToCart(emptyCart, OSNOVA), { ...OSNOVA, variantId: "35-M1021", sku: "35-M1021" });
  assert.equal(s.items.length, 2);
});

test("ostecen i zastareo zapis se bezbedno odbacuje", () => {
  for (const lose of [
    null, "", "{", "[]", "null", "true", '{"items":null}', '{"items":{}}',
    '{"items":[{"id":1}]}', '{"items":[{"id":"x","productSlug":"y"}]}',
    '{"items":[{"id":"x","productSlug":"y","sku":"z","name":"n","quantity":-1}]}',
    '{"items":[{"id":"x","productSlug":"y","sku":"z","name":"n","quantity":"3"}]}',
  ]) {
    assert.deepEqual(parseStoredCart(lose), emptyCart, JSON.stringify(lose));
  }
});

test("skladiste ne sme nositi cenu, tokene ni sesiju", () => {
  const s = addToCart(emptyCart, OSNOVA, 2);
  const zapis = JSON.stringify(s);
  for (const zabranjeno of ["price", "cena", "total", "iznos", "rabat", "discount", "margin", "token", "session", "password"]) {
    assert.ok(!zapis.toLowerCase().includes(zabranjeno), `zapis nosi "${zabranjeno}"`);
  }
  // I ono sto se procita nazad ostaje bez tih polja.
  assert.deepEqual(Object.keys(parseStoredCart(zapis).items[0]).sort(), Object.keys(s.items[0]).sort());
});

/* ==========================================================================
 * Namespace korpe — ceo UUID, bez skracenog otiska
 * ========================================================================== */

const UUID_A = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const UUID_B = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

test("dva razlicita korisnicka ID-a imaju razlicite kljuceve", () => {
  const a = cartStorageKey(UUID_A);
  const b = cartStorageKey(UUID_B);
  assert.notEqual(a, b);
  assert.equal(a, cartStorageKey(UUID_A), "kljuc nije stabilan");
  // Velika slova u UUID-u su isti korisnik.
  assert.equal(a, cartStorageKey(UUID_A.toUpperCase()));
});

test("namespace je CEO UUID, ne skraceni otisak", () => {
  const k = cartStorageKey(UUID_A);

  assert.equal(k, `carsystem.cart.v3.${UUID_A}`);
  // Ceo UUID, sve cetiri crtice, 36 znakova.
  const ns = k.slice("carsystem.cart.v3.".length);
  assert.equal(ns.length, 36, `namespace ima ${ns.length} znakova umesto 36`);
  assert.match(ns, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);

  /*
   * Ovo je tvrdnja protiv POVRATKA na 32-bitni otisak: osam heksadecimalnih
   * znakova bez crtica je tacno oblik koji je ranije dozvoljavao sudar dva
   * naloga. Mutacija nazad na FNV obara ovaj test.
   */
  assert.doesNotMatch(ns, /^[0-9a-f]{8}$/, "namespace je opet 8-hex otisak");
  assert.ok(ns.includes("-"), "namespace nije UUID");
});

test("scope ne sme biti email ni proizvoljan tekst", () => {
  for (const lose of [
    "petar@example.com",
    "Petar Petrovic",
    "gazda",
    "3f2504e0",
    "3f2504e0-4f89-41d3-9a0c",
    "3f2504e0-4f89-41d3-9a0c-0305e82c3301-extra",
    "zzzzzzzz-4f89-41d3-9a0c-0305e82c3301",
  ]) {
    assert.throws(() => cartStorageKey(lose), /UUID/i, `prihvacen: ${lose}`);
  }
  // Kljuc nikada ne sme nositi email.
  for (const u of [UUID_A, UUID_B]) {
    assert.doesNotMatch(cartStorageKey(u), /@/);
  }
});

test("nevalidan scope se odbija, bez tihog fallbacka", () => {
  for (const lose of [undefined, null, "", "   ", 42, {}, [], true]) {
    assert.throws(() => cartStorageKey(lose), /UUID/i, String(lose));
  }
});

test("stari globalni i slabi v2 zapis se odbacuju, ne ucitavaju", () => {
  assert.equal(LEGACY_CART_STORAGE_KEY, "carsystem.cart.v1");
  assert.equal(WEAK_CART_STORAGE_PREFIX, "carsystem.cart.v2.");

  assert.ok(isDiscardedCartKey("carsystem.cart.v1"));
  assert.ok(isDiscardedCartKey("carsystem.cart.v2.ccdedf95"));
  assert.ok(isDiscardedCartKey("carsystem.cart.v2.00000000"));

  // Tekuci zapis se NE odbacuje.
  assert.ok(!isDiscardedCartKey(cartStorageKey(UUID_A)));
  assert.ok(!isDiscardedCartKey("nesto.drugo"));
  assert.ok(!isDiscardedCartKey(null));
});

test("promena korisnika ne prikazuje prethodnu korpu", () => {
  // Simulirani localStorage: jedan objekat, kljucevi po korisniku.
  const store = new Map();
  const stavka = {
    productSlug: "baslac-line-35",
    variantId: "35-M1010",
    sku: "35-M1010",
    name: "Baslac 35-M1010",
    image: null,
    volume: "3,5 L",
    brandSlug: "baslac",
    familySlug: "baslac-line-35",
    inventoryKey: null,
  };

  store.set(cartStorageKey(UUID_A), JSON.stringify(addToCart(emptyCart, stavka, 4)));

  // Drugi korisnik cita SVOJ kljuc — prazna korpa.
  assert.deepEqual(parseStoredCart(store.get(cartStorageKey(UUID_B)) ?? null), emptyCart);
  // Prvi korisnik i dalje ima svoju.
  assert.equal(parseStoredCart(store.get(cartStorageKey(UUID_A))).items[0].quantity, 4);

  // Odjava pa prijava drugog naloga: cita se njegov kljuc, ne prethodni.
  store.set(cartStorageKey(UUID_B), JSON.stringify(emptyCart));
  assert.deepEqual(parseStoredCart(store.get(cartStorageKey(UUID_B))), emptyCart);
  assert.equal(parseStoredCart(store.get(cartStorageKey(UUID_A))).items.length, 1);
});

test("odbaceni zapisi se ne mogu procitati kao korpa tekuceg korisnika", () => {
  const store = new Map();
  const tudja = JSON.stringify({
    items: [{ id: "x", productSlug: "y", sku: "z", name: "Tudja stavka", quantity: 9 }],
  });
  store.set("carsystem.cart.v1", tudja);
  store.set("carsystem.cart.v2.ccdedf95", tudja);

  // Ucitavanje ide iskljucivo po v3 kljucu; stari zapisi nisu dostupni.
  const kljuc = cartStorageKey(UUID_A);
  assert.ok(!store.has(kljuc));
  assert.deepEqual(parseStoredCart(store.get(kljuc) ?? null), emptyCart);

  // I svi zatecen zapisi su prepoznati kao za odbacivanje.
  for (const k of store.keys()) assert.ok(isDiscardedCartKey(k), k);
});
