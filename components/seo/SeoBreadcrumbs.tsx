import Link from "next/link";
import styles from "./SeoBreadcrumbs.module.css";

export type SeoBreadcrumbItem = {
  name: string;
  path: string;
};

export function SeoBreadcrumbs({
  items,
  tone = "default",
}: {
  items: SeoBreadcrumbItem[];
  tone?: "default" | "dark";
}) {
  return (
    <nav className={styles.nav} aria-label="Putanja" data-tone={tone}>
      <ol className={styles.list}>
        {items.map((item, index) => {
          const isCurrent = index === items.length - 1;
          return (
            <li className={styles.item} key={`${item.path}-${item.name}`}>
              {isCurrent ? (
                <span className={styles.current} aria-current="page">
                  {item.name}
                </span>
              ) : (
                <>
                  <Link href={item.path}>{item.name}</Link>
                  <span aria-hidden="true">/</span>
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
