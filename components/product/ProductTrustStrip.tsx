import styles from "./ProductDetailPage.module.css";

const trustItems = [
  ["01", "Profesionalni kvalitet"],
  ["02", "Tehnička podrška"],
  ["03", "Brza isporuka"],
  ["04", "Partnerska mreža"],
] as const;

export function ProductTrustStrip() {
  return (
    <section className={styles.trustStrip} aria-label="Podrška i poverenje">
      {trustItems.map(([index, label]) => (
        <div className={styles.trustItem} key={label}>
          <span className={styles.trustIcon}>{index}</span>
          <span>{label}</span>
        </div>
      ))}
    </section>
  );
}
