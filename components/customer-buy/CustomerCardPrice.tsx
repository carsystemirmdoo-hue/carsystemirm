"use client";

import { compactPrice } from "@/lib/pricing/compactPrice.mjs";
import { useCustomerOffers } from "./useCustomerOffers";
import styles from "./CustomerBuy.module.css";

/**
 * Cena prijavljenog kupca na kartici kataloga. Samo za proizvode sa POTVRĐENOM
 * vezom i cenom; ostale kartice ostaju kakve jesu (cenu traže na stranici
 * proizvoda). Anonimno: ništa.
 */
export function CustomerCardPrice({ cardKey }: { cardKey: string }) {
  const data = useCustomerOffers();
  if (!data || !data.ordering.enabled) return null;
  const mine = data.offers.filter((o) => o.cardKeys.includes(cardKey));
  if (mine.length === 0) return null;
  /*
   * Cena CELOG potvrđenog pakovanja. Sve opcije se prikazuju za ISTO pakovanje
   * (ono sa najnižom prvom cenom), da par „odloženo / avans“ uvek opisuje jednu
   * stvar; više pakovanja → „od“.
   */
  const priced = mine
    .filter((o) => o.state === "orderable" && o.pack)
    .map((o) => ({
      pack: o.pack!.label,
      prices: data.options.flatMap((opt) => {
        const p = o.byOption[opt.key];
        return p?.status === "cena" && p.packAmounts ? [{ code: opt.code, net: p.packAmounts.net }] : [];
      }),
    }))
    .filter((o) => o.prices.length > 0);
  if (priced.length === 0) {
    return <span className={styles.cardPrice} data-state="request">Vaša cena na upit</span>;
  }
  const ref = priced.reduce((a, b) => (Math.min(...b.prices.map((x) => x.net)) < Math.min(...a.prices.map((x) => x.net)) ? b : a));
  const view = compactPrice(ref.prices, { pack: ref.pack, from: priced.length > 1 });
  if (!view) {
    return <span className={styles.cardPrice} data-state="request">Vaša cena na upit</span>;
  }
  return (
    <span className={styles.cardPrice} data-state="price">
      <strong>{view.amounts}</strong>
      <small>{view.detail}</small>
    </span>
  );
}
