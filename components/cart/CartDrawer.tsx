"use client";

import Image from "next/image";
import Link from "next/link";
import { useCart } from "./CartProvider";
import styles from "./Cart.module.css";

/**
 * Korpa kao lista proizvoda za upit. Cena se ne prikazuje — javna cena ne
 * postoji, a cena prijavljenog kupca se rešava kroz postojeću integraciju.
 */
export function CartDrawer() {
  const { items, count, isOpen, closeCart, setQuantity, remove, clear } =
    useCart();

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Korpa">
      <button
        type="button"
        className={styles.scrim}
        aria-label="Zatvorite korpu"
        onClick={closeCart}
      />
      <aside className={styles.drawer}>
        <header className={styles.drawerHeader}>
          <h2>Lista za upit</h2>
          <span>{count} {count === 1 ? "stavka" : "stavki"}</span>
          <button type="button" onClick={closeCart} aria-label="Zatvorite korpu">
            ✕
          </button>
        </header>

        {items.length === 0 ? (
          <p className={styles.empty}>
            Lista je prazna. Dodajte proizvode sa stranice sistema ili iz kataloga.
          </p>
        ) : (
          <ul className={styles.list}>
            {items.map((item) => (
              <li key={item.id}>
                <div className={styles.thumb}>
                  {item.image ? (
                    <Image src={item.image} alt="" width={56} height={72} />
                  ) : null}
                </div>
                <div className={styles.itemInfo}>
                  <strong>{item.sku}</strong>
                  <span>{item.name}</span>
                  {item.volume ? <small>{item.volume}</small> : null}
                </div>
                <div className={styles.itemActions}>
                  <label>
                    <span className="sr-only">Količina za {item.sku}</span>
                    <input
                      type="number"
                      min={1}
                      max={999}
                      value={item.quantity}
                      onChange={(event) =>
                        setQuantity(item.id, Number(event.target.value))
                      }
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => remove(item.id)}
                    aria-label={`Uklonite ${item.sku}`}
                  >
                    Uklonite
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <footer className={styles.drawerFooter}>
          <p className={styles.note}>
            Dostupnost, pakovanje i cenu potvrđujemo odgovorom na upit.
          </p>
          <div className={styles.footerActions}>
            <Link className={styles.primary} href="/korpa" onClick={closeCart}>
              Otvorite listu
            </Link>
            {items.length > 0 ? (
              <button type="button" className={styles.ghost} onClick={clear}>
                Ispraznite
              </button>
            ) : null}
          </div>
        </footer>
      </aside>
    </div>
  );
}
