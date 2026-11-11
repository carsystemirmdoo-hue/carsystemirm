"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { cellValue, columnKind, compareCells, firstDir } from "@/lib/ui/tableSort.mjs";

/**
 * Ređanje SVAKE tabele u portalu (2026-11-11, zahtev vlasnika: „svaka tabela, ne samo neka“).
 *
 * Tabele koje već imaju svoje ređanje (`SortHeader`, `aria-sort` u zaglavlju) ili nose
 * `data-sort="off"` (štampa, stavke porudžbine koje se menjaju) se preskaču. Ostale dobijaju
 * klik na naslov kolone: redovi u `<tbody>` se ređaju po tekstu ćelije (lib/ui/tableSort.mjs).
 *
 * Redovi koji pripadaju prethodnom redu (detalji ispod reda, `data-sort-attach`) i redovi
 * sa jednom ćelijom preko cele širine („Nema podataka“) ostaju vezani / na kraju.
 * Kada React osveži telo tabele, izabrani redosled se ponovo primenjuje.
 */

type State = { col: number; dir: "asc" | "desc" };
const STATE = new WeakMap<HTMLTableElement, State>();
const ARROW = { asc: "▲", desc: "▼" } as const;

function eligible(table: HTMLTableElement) {
  if (table.dataset.sort === "off" || table.closest("[data-sort='off']")) return false;
  const head = table.tHead;
  if (!head || head.rows.length !== 1 || !table.tBodies.length) return false;
  // Tabela sa sopstvenim ređanjem (SortHeader postavlja aria-sort na svaki svoj <th>).
  if (head.querySelector("th[aria-sort]:not([data-auto-sort])")) return false;
  return true;
}

/** Ćelija u redu po vizuelnoj koloni (uzima u obzir colSpan). */
function cellAt(row: HTMLTableRowElement, col: number) {
  let x = 0;
  for (const cell of Array.from(row.cells)) {
    const span = cell.colSpan || 1;
    if (col >= x && col < x + span) return span === 1 ? cell : null;
    x += span;
  }
  return null;
}

function headerColumns(table: HTMLTableElement) {
  const out: { th: HTMLTableCellElement; col: number }[] = [];
  let x = 0;
  for (const th of Array.from(table.tHead!.rows[0].cells)) {
    if ((th.colSpan || 1) === 1) out.push({ th, col: x });
    x += th.colSpan || 1;
  }
  return out;
}

const text = (cell: HTMLTableCellElement | null) => {
  if (!cell) return "";
  if (cell.dataset.sortValue !== undefined) return cell.dataset.sortValue;
  const input = cell.querySelector("input:not([type=checkbox]):not([type=hidden]), select") as HTMLInputElement | null;
  return (input?.value ?? cell.textContent ?? "").trim();
};

function applySort(table: HTMLTableElement, state: State) {
  const body = table.tBodies[0];
  const rows = Array.from(body.rows);
  // Grupe: glavni red + redovi koji idu uz njega (detalji). Red preko cele širine ide na kraj.
  const groups: { main: HTMLTableRowElement; rows: HTMLTableRowElement[] }[] = [];
  const tail: HTMLTableRowElement[] = [];
  for (const r of rows) {
    if (r.dataset.sortAttach !== undefined && groups.length) groups[groups.length - 1].rows.push(r);
    else if (r.cells.length === 1 && (r.cells[0].colSpan || 1) > 1) tail.push(r);
    else groups.push({ main: r, rows: [r] });
  }
  if (groups.length < 2) return;
  const values = groups.map((g) => cellValue(text(cellAt(g.main, state.col))));
  const kind = columnKind(values);
  const order = groups.map((g, i) => ({ g, v: values[i], i }));
  order.sort((a, b) => compareCells(a.v, b.v, kind, state.dir) || a.i - b.i);
  const wanted = [...order.flatMap((o) => o.g.rows), ...tail];
  if (wanted.every((r, i) => body.rows[i] === r)) return;
  const frag = document.createDocumentFragment();
  for (const r of wanted) frag.appendChild(r);
  body.appendChild(frag);
}

function paintHeaders(table: HTMLTableElement) {
  const st = STATE.get(table);
  for (const { th, col } of headerColumns(table)) {
    const on = st?.col === col;
    th.setAttribute("aria-sort", on ? (st!.dir === "asc" ? "ascending" : "descending") : "none");
    const arrow = th.querySelector(":scope > .auto-sort-arrow");
    if (arrow) {
      arrow.textContent = on ? ARROW[st!.dir] : "↕";
      arrow.toggleAttribute("data-active", on);
    }
  }
}

function enhance(table: HTMLTableElement) {
  if (table.dataset.autoSort === "on" || !eligible(table)) return;
  table.dataset.autoSort = "on";
  for (const { th, col } of headerColumns(table)) {
    // Prazno zaglavlje (kolona sa dugmetom „Otvori“ i sl.) se ne ređa.
    if (!th.textContent?.trim()) continue;
    th.dataset.autoSort = "";
    th.setAttribute("aria-sort", "none");
    th.tabIndex = 0;
    th.title = "Kliknite za ređanje po ovoj koloni";
    const arrow = document.createElement("span");
    arrow.className = "auto-sort-arrow";
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "↕";
    th.appendChild(arrow);
    const run = () => {
      if (table.dataset.sort === "off") return;
      const cur = STATE.get(table);
      let dir: "asc" | "desc";
      if (cur?.col === col) dir = cur.dir === "asc" ? "desc" : "asc";
      else {
        const vals = Array.from(table.tBodies[0].rows).map((r) => cellValue(text(cellAt(r, col))));
        dir = firstDir(columnKind(vals));
      }
      const next = { col, dir };
      STATE.set(table, next);
      applySort(table, next);
      paintHeaders(table);
    };
    th.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).closest("a, button, input, select, label")) return;
      run();
    });
    th.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        run();
      }
    });
  }
  // React je zamenio/dodao redove → ponovo primeni izabrani redosled.
  const obs = new MutationObserver(() => {
    const st = STATE.get(table);
    if (st && table.dataset.sort !== "off") applySort(table, st);
  });
  obs.observe(table.tBodies[0], { childList: true });
}

export function AutoSortTables() {
  const pathname = usePathname();
  const search = useSearchParams();
  useEffect(() => {
    const root = document.querySelector(".portal-main");
    if (!root) return;
    const scan = () => root.querySelectorAll("table").forEach((t) => enhance(t as HTMLTableElement));
    scan();
    // Tabele koje se pojave kasnije (otvoren panel, učitan deo strane).
    let queued = false;
    const obs = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        scan();
      });
    });
    obs.observe(root, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, [pathname, search]);
  return null;
}
