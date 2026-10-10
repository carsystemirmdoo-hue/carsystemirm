"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  addToCart as addItem,
  cartCount,
  clearCart as emptyState,
  emptyCart,
  parseStoredCart,
  removeFromCart as removeItem,
  setQuantity as setItemQuantity,
  cartStorageKey,
  isDiscardedCartKey,
  type CartItem,
  type CartState,
} from "@/lib/cart/cart-model.mjs";

export type CartInput = Omit<CartItem, "id" | "quantity">;

type CartContextValue = {
  items: CartItem[];
  count: number;
  ready: boolean;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  add: (item: CartInput, quantity?: number) => void;
  addMany: (entries: { item: CartInput; quantity: number }[]) => number;
  setQuantity: (id: string, quantity: number) => void;
  remove: (id: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({
  children,
  userScope,
}: {
  children: ReactNode;
  /**
   * Stabilan identitet prijavljenog korisnika.
   *
   * Obavezan: korpa se cuva pod kljucem vezanim za njega, pa drugi nalog na
   * istom pretrazivacu ne zatice prethodnu korpu.
   */
  userScope: string;
}) {
  const [state, setState] = useState<CartState>(emptyCart);
  const [ready, setReady] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const storageKey = useMemo(() => cartStorageKey(userScope), [userScope]);

  /*
   * Korpa se cita tek na klijentu da SSR i hidratacija ostanu identicni.
   *
   * Efekat zavisi od `storageKey`: promena naloga u istoj kartici ponovo cita
   * stanje pod NOVIM kljucem, pa se prethodna korpa ne prenosi. `ready` se
   * privremeno gasi da upisni efekat ne pregazi novi kljuc starim stanjem.
   */
  useEffect(() => {
    setReady(false);
    /*
     * `localStorage` baca SecurityError kad su podaci sajta blokirani
     * (podešavanje pregledača ili politika firme). Neuhvaćena greška u efektu
     * obara ceo portal, pa korpa tada radi samo u memoriji ove kartice.
     */
    let storage: Storage;
    try {
      storage = window.localStorage;
      setState(parseStoredCart(storage.getItem(storageKey)));
    } catch {
      setState(parseStoredCart(null));
      setReady(true);
      return;
    }
    setReady(true);
    /*
     * Zapisi iz ranijih verzija se UKLANJAJU, ne migriraju.
     *
     * `carsystem.cart.v1` je bio jedan globalni kljuc, a `carsystem.cart.v2.*`
     * je koristio 32-bitni otisak — ni u jednom slucaju se ne moze pouzdano
     * utvrditi kom nalogu zapis pripada, pa bi prenos znacio pripisivanje tudje
     * korpe.
     */
    try {
      for (const key of Object.keys(storage)) {
        if (isDiscardedCartKey(key)) storage.removeItem(key);
      }
    } catch {
      // Čišćenje starih zapisa nije neophodno za rad korpe.
    }
  }, [storageKey]);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // Skladište blokirano ili puno: korpa ostaje u memoriji ove kartice.
    }
  }, [ready, state, storageKey]);

  const add = useCallback((item: CartInput, quantity = 1) => {
    setState((current) => addItem(current, item, quantity));
  }, []);

  const addMany = useCallback(
    (entries: { item: CartInput; quantity: number }[]) => {
      setState((current) =>
        entries.reduce(
          (accumulator, entry) => addItem(accumulator, entry.item, entry.quantity),
          current,
        ),
      );
      return entries.length;
    },
    [],
  );

  const value = useMemo<CartContextValue>(
    () => ({
      items: state.items,
      count: cartCount(state),
      ready,
      isOpen,
      openCart: () => setIsOpen(true),
      closeCart: () => setIsOpen(false),
      add,
      addMany,
      setQuantity: (id, quantity) =>
        setState((current) => setItemQuantity(current, id, quantity)),
      remove: (id) => setState((current) => removeItem(current, id)),
      clear: () => setState(emptyState()),
    }),
    [add, addMany, isOpen, ready, state],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart mora biti unutar <CartProvider>.");
  }
  return context;
}
