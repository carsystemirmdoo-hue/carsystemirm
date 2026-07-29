"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import styles from "./CatalogPage.module.css";

export function CatalogHeroSearch() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";

  function updateQuery(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    const normalized = value.slice(0, 80);
    if (normalized) params.set("q", normalized);
    else params.delete("q");
    const search = params.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
  }

  return (
    <>
      <label className={styles.searchLabel} htmlFor="catalog-search">
        Pretraga
      </label>
      <input
        id="catalog-search"
        className={styles.searchInput}
        type="search"
        value={query}
        onChange={(event) => updateQuery(event.target.value)}
        placeholder="Pretraži proizvode..."
      />
    </>
  );
}
