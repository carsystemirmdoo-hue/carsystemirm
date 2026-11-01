"use client";

import { useEffect, useState } from "react";

/*
 * Da li biblioteka „Saveti i vodiči“ ima bar jedan objavljen članak (meni „Saveti i podrška“).
 * Zaglavlje je statičko i deli se svim stranicama, pa se stanje čita jednom po učitavanju
 * iz kratke javne rute (`/vodici/stanje.json`, keš 60 s). Dok odgovor ne stigne, ili ako ne
 * stigne, grupa se ne prikazuje — meni nikada ne vodi na praznu biblioteku.
 */
export type SavetiDostupnost = { biblioteka: boolean; problemi: boolean };
const NISTA: SavetiDostupnost = { biblioteka: false, problemi: false };
let cached: SavetiDostupnost | null = null;
let pending: Promise<SavetiDostupnost> | null = null;

const broj = (value: unknown) => (typeof value === "number" ? value : 0);

function load() {
  pending ??= fetch("/vodici/stanje.json", { headers: { accept: "application/json" } })
    .then((response) => (response.ok ? response.json() : {}))
    .then((data: { objavljeno?: unknown; problemi?: unknown }) => {
      cached = { biblioteka: broj(data.objavljeno) > 0, problemi: broj(data.problemi) > 0 };
      return cached;
    })
    .catch(() => NISTA);
  return pending;
}

export function useSavetiDostupni() {
  const [dostupni, setDostupni] = useState<SavetiDostupnost>(cached ?? NISTA);
  useEffect(() => {
    let live = true;
    void load().then((value) => {
      if (live) setDostupni(value);
    });
    return () => {
      live = false;
    };
  }, []);
  return dostupni;
}
