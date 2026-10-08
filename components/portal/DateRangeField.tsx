"use client";

import { useEffect, useRef, useState } from "react";
import { DateField } from "@/components/portal/DateField";
import { danasBeograd, izIso, precica } from "@/lib/dates/dmy.mjs";

const PRECICE = [
  { kod: "ovaj_mesec", tekst: "Ovaj mesec" },
  { kod: "prethodni_mesec", tekst: "Prethodni mesec" },
  { kod: "ova_godina", tekst: "Ova godina" },
  { kod: "sve", tekst: "Sve vreme" },
] as const;

/**
 * Period „Od – Do" sa prečicama.
 *
 * Šalje iste parametre kao ranija `type="date"` polja (ISO), pa se obuhvat
 * prodajnih zbirova ne menja. Prečica popuni oba polja i odmah primeni filter
 * (forma se šalje kao da je kliknuto „Primenite"). Period u kome je „Od" posle
 * „Do" se ne šalje.
 */
export function DateRangeField({
  nameOd,
  nameDo,
  defaultOd,
  defaultDo,
  labelOd = "Od",
  labelDo = "Do",
  primeniOdmah = true,
}: {
  nameOd: string;
  nameDo: string;
  defaultOd?: string | null;
  defaultDo?: string | null;
  labelOd?: string;
  labelDo?: string;
  primeniOdmah?: boolean;
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
