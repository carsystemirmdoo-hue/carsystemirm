"use client";

import { useEffect, useRef, useState } from "react";
import { DateField } from "@/components/portal/DateField";
import { danasBeograd, izIso, precica } from "@/lib/dates/dmy.mjs";
import { encodePeriod, PERIOD_COOKIE, PERIOD_COOKIE_MAX_AGE } from "@/lib/portal/periodMemory.mjs";

const PRECICE = [
  { kod: "30_dana", tekst: "30 dana" },
  { kod: "90_dana", tekst: "90 dana" },
  { kod: "ovaj_mesec", tekst: "Ovaj mesec" },
  { kod: "prethodni_mesec", tekst: "Prethodni mesec" },
  { kod: "ova_godina", tekst: "Ova godina" },
  { kod: "prosla_godina", tekst: "Prošla godina" },
  { kod: "sve", tekst: "Sve vreme" },
] as const;

/**
 * Period „Od – Do" sa prečicama.
 *
 * Šalje iste parametre kao ranija `type="date"` polja (ISO), pa se obuhvat
 * prodajnih zbirova ne menja. Prečica popuni oba polja i odmah primeni filter
 * (forma se šalje kao da je kliknuto „Primenite"). Period u kome je „Od" posle
 * „Do" se ne šalje.
 *
 * `zapamti`: pri slanju forme period se pamti u kolačiću (samo `/portal`), pa ga
 * ekrani Kupci, kartica kupca, Prodaja i Analitika preuzimaju kada adresa ne nosi period.
 */
export function DateRangeField({
  nameOd,
  nameDo,
  defaultOd,
  defaultDo,
  labelOd = "Od",
  labelDo = "Do",
  primeniOdmah = true,
  zapamti = false,
}: {
  nameOd: string;
  nameDo: string;
  defaultOd?: string | null;
  defaultDo?: string | null;
  labelOd?: string;
  labelDo?: string;
  primeniOdmah?: boolean;
  zapamti?: boolean;
}) {
  const [od, setOd] = useState(izIso(defaultOd ?? "") ? (defaultOd as string) : "");
  const [doD, setDo] = useState(izIso(defaultDo ?? "") ? (defaultDo as string) : "");
  const [posalji, setPosalji] = useState(false);
  const omotRef = useRef<HTMLFieldSetElement>(null);

  const obrnuto = od !== "" && doD !== "" && od > doD;

  // Prečica: posle upisa obe vrednosti forma se šalje jednom.
  useEffect(() => {
    if (!posalji) return;
    setPosalji(false);
    omotRef.current?.closest("form")?.requestSubmit();
  }, [posalji]);

  // Pamćenje: pri svakom slanju forme upisuje se ono što forma zaista šalje.
  useEffect(() => {
    if (!zapamti) return;
    const forma = omotRef.current?.closest("form");
    if (!forma) return;
    const upisi = () => {
      const fd = new FormData(forma);
      const vrednost = encodePeriod(String(fd.get(nameOd) ?? ""), String(fd.get(nameDo) ?? ""));
      document.cookie = `${PERIOD_COOKIE}=${encodeURIComponent(vrednost)}; path=/portal; max-age=${PERIOD_COOKIE_MAX_AGE}; samesite=lax`;
    };
    forma.addEventListener("submit", upisi);
    return () => forma.removeEventListener("submit", upisi);
  }, [zapamti, nameOd, nameDo]);

  const izabrana = PRECICE.find((p) => {
    const r = precica(p.kod, danasBeograd());
    return r.od === od && r.do === doD;
  })?.kod;

  return (
    <fieldset className="pd-range" ref={omotRef}>
      <legend className="pd-legend">Period</legend>
      <div className="pd-range-fields">
        <DateField name={nameOd} label={labelOd} value={od} onChange={(v) => setOd(v)} />
        <span className="pd-range-sep" aria-hidden="true">
          –
        </span>
        <DateField
          name={nameDo}
          label={labelDo}
          value={doD}
          onChange={(v) => setDo(v)}
          error={obrnuto ? "„Od“ je posle „Do“." : null}
        />
      </div>
      <div className="pd-shortcuts" role="group" aria-label="Brz izbor perioda">
        {PRECICE.map((p) => (
          <button
            key={p.kod}
            type="button"
            className="pd-chip"
            aria-pressed={izabrana === p.kod}
            onClick={() => {
              const r = precica(p.kod, danasBeograd());
              setOd(r.od);
              setDo(r.do);
              if (primeniOdmah) setPosalji(true);
            }}
          >
            {p.tekst}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
