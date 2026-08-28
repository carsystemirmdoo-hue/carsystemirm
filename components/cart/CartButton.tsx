"use client";

import { useCart } from "./CartProvider";
import styles from "./CartButton.module.css";

export function CartButton() {
  const { count, openCart, ready } = useCart();

  return (
    <button
      type="button"
      className={styles.button}
      onClick={openCart}
      aria-label={count > 0 ? `Otvori korpu, ${count} stavki` : "Otvori korpu"}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
        <path
          d="M2.75 3.75h2.1l2.2 10.2h9.6l2-7.2H6.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="9.2" cy="18.8" r="1.35" fill="currentColor" />
        <circle cx="16.4" cy="18.8" r="1.35" fill="currentColor" />
      </svg>
      {ready && count > 0 ? (
        <span className={styles.badge} aria-hidden="true">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </button>
  );
}
