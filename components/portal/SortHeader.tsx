import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Naslov kolone koji menja redosled (2026-11-10). Strelica pokazuje smer:
 * ▲ rastuće, ▼ opadajuće, ↕ kolona nije izabrana. `aria-sort` je na `<th>`.
 *
 * Dve varijante, isti izgled:
 *   - `onClick` — tabela u pregledaču (klijent),
 *   - `href`    — serverska tabela, redosled ide kroz adresu (GET).
 */
export function SortHeader({
  label,
  active,
  dir,
  onClick,
  href,
  align = "left",
  className,
}: {
  label: ReactNode;
  active: boolean;
  dir: "asc" | "desc";
  onClick?: () => void;
  href?: string;
  align?: "left" | "right";
  className?: string;
}) {
  const arrow = active ? (dir === "asc" ? "▲" : "▼") : "↕";
  const inner = (
    <>
      <span>{label}</span>
      <span className="sort-arrow" data-active={active ? "true" : undefined} aria-hidden="true">{arrow}</span>
    </>
  );
  const title = active ? `Poređano ${dir === "asc" ? "rastuće" : "opadajuće"} — kliknite za obrnuto` : "Kliknite za ređanje po ovoj koloni";
  return (
    <th scope="col" aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"} className={className} style={align === "right" ? { textAlign: "right" } : undefined}>
      {href ? (
        <Link href={href} className="sort-head" data-align={align} title={title} scroll={false}>
          {inner}
        </Link>
      ) : (
        <button type="button" className="sort-head" data-align={align} title={title} onClick={onClick}>
          {inner}
        </button>
      )}
    </th>
  );
}
