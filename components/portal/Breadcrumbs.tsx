"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * Ime zapisa u breadcrumbu umesto njegovog ID-a.
 *
 * Shell zna samo putanju; ime kupca zna stranica. Stranica ga javlja kroz
 * `<CrumbLabel>`, a do tada shell prikazuje opšti naziv („Detalj kupca"),
 * nikad sirov UUID.
 */
type Labels = Record<string, string>;
const Ctx = createContext<{ labels: Labels; set: (segment: string, label: string | null) => void }>({
  labels: {},
  set: () => {},
});

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [labels, setLabels] = useState<Labels>({});
  const set = (segment: string, label: string | null) =>
    setLabels((current) => {
      const next = { ...current };
      if (label) next[segment] = label;
      else delete next[segment];
      return next;
    });
  return <Ctx.Provider value={{ labels, set }}>{children}</Ctx.Provider>;
}

export function useCrumbLabels(): Labels {
  return useContext(Ctx).labels;
}

export function CrumbLabel({ segment, label }: { segment: string; label: string }) {
  const { set } = useContext(Ctx);
  useEffect(() => {
    set(segment, label);
    return () => set(segment, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segment, label]);
  return null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RECORD_LABELS: Record<string, string> = {
  kupci: "Detalj kupca",
  porudzbine: "Detalj porudžbine",
};

/** Opšti naziv za ID segment, dok stranica ne javi pravo ime. */
export function fallbackRecordLabel(segment: string, parent: string | undefined): string | null {
  if (!UUID.test(segment)) return null;
  return (parent && RECORD_LABELS[parent]) ?? "Detalj";
}
