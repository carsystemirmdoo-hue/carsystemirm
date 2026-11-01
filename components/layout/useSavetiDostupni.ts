"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/*
 * Da li biblioteka „Saveti i vodiči“ ima bar jedan objavljen članak (meni „Saveti i podrška“).
 * Zaglavlje je statičko i deli se svim stranicama, pa se stanje čita iz kratke javne rute
 * (`/vodici/stanje.json`, keš 60 s). Zaglavlje ostaje montirano pri prelasku na drugu stranu,
 * pa se stanje ponovo čita pri promeni strane i povratku na karticu, ako je starije od 60 s.
 * Dok odgovor ne stigne, ili ako ne stigne, grupa se ne prikazuje — meni nikada ne vodi na
 * praznu biblioteku.
 */
export type SavetiDostupnost = { biblioteka: boolean; problemi: boolean };
const NISTA: SavetiDostupnost = { biblioteka: false, problemi: false };
const STAROST_MS = 60_000;
let cached: SavetiDostupnost | null = null;
let loadedAt = 0;
let pending: Promise<SavetiDostupnost> | null = null;

const broj = (value: unknown) => (typeof value === "number" ? value : 0);

function load() {
  if (pending && Date.now() - loadedAt < STAROST_MS) return pending;
  loadedAt = Date.now();
  pending = fetch("/vodici/stanje.json", { headers: { accept: "application/json" } })
    .then((response) => (response.ok ? response.json() : {}))
    .then((data: { objavljeno?: unknown; problemi?: unknown }) => {
      cached = { biblioteka: broj(data.objavljeno) > 0, problemi: broj(data.problemi) > 0 };
      return cached;
    })
    .catch(() => cached ?? NISTA);
  return pending;
}

export function useSavetiDostupni() {
  const pathname = usePathname();
  const [dostupni, setDostupni] = useState<SavetiDostupnost>(cached ?? NISTA);
  useEffect(() => {
    let live = true;
    const osvezi = () => {
      if (document.visibilityState === "hidden") return;
      void load().then((value) => {
        if (live) setDostupni(value);
      });
    };
    osvezi();
    document.addEventListener("visibilitychange", osvezi);
    return () => {
      live = false;
      document.removeEventListener("visibilitychange", osvezi);
    };
  }, [pathname]);
  return dostupni;
}
