"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const KEY = "cene-kupca-nedavno";

/** Nedavno otvarani kupci — samo pogodnost ovog pregledača; spisak se proverava na serveru pri otvaranju. */
export function RecentCustomers({ known }: { known: { id: string; name: string }[] }) {
  const [recent, setRecent] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    try {
      const list = JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as { id: string; name: string }[];
      setRecent(Array.isArray(list) ? list.slice(0, 5) : []);
    } catch {
      setRecent([]);
    }
  }, [known]);
  if (!recent.length) return null;
  return (
    <div className="ck-recent">
      <span className="pn-muted pn-small">Nedavno:</span>
      {recent.map((c) => (
        <Link key={c.id} href={`/portal/cene/kupci/${c.id}`} className="ck-chip">
          {c.name}
        </Link>
      ))}
    </div>
  );
}

/** Zapis u „nedavno“ (poziva se sa ekrana kupca). */
export function rememberCustomer(c: { id: string; name: string }) {
  try {
    const list = JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as { id: string; name: string }[];
    const next = [c, ...(Array.isArray(list) ? list : []).filter((x) => x.id !== c.id)].slice(0, 5);
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* pregledač bez skladišta: samo bez „nedavno“ */
  }
}
