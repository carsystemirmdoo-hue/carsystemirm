"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import {
  DANI_KRATKO,
  DANI_PUNO,
  GODINA_MAX,
  GODINA_MIN,
  MESECI,
  danUNedelji,
  danasBeograd,
  formatirajUnos,
  izIso,
  izUnosa,
  kursorPosle,
  mrezaMeseca,
  pomeri,
  uIso,
  uPrikaz,
} from "@/lib/dates/dmy.mjs";

type Ymd = { g: number; m: number; d: number };

export type DateFieldProps = {
  /** Ime parametra koji forma šalje — vrednost je ISO `yyyy-mm-dd`, kao i do sada. */
  name: string;
  label: string;
  defaultValue?: string | null;
  /** Kontrolisana vrednost (ISO ili ""). */
  value?: string;
  onChange?: (iso: string, ispravno: boolean) => void;
  required?: boolean;
  disabled?: boolean;
  hint?: string;
  /** Spoljna greška (npr. „Od je posle Do"). */
  error?: string | null;
  id?: string;
};

const PORUKA: Record<string, string> = {
  nepotpuno: "Upišite datum kao dd/mm/gggg.",
  nepostojeci: "Taj datum ne postoji.",
  prazno: "Datum je obavezan.",
};

/** Kod greške unosa (ili `null` kada je datum ispravan). */
const kodGreske = (r: ReturnType<typeof izUnosa>) => ("greska" in r ? r.greska : null);

const jednako = (a: Ymd | null, b: Ymd | null) =>
  !!a && !!b && a.g === b.g && a.m === b.m && a.d === b.d;

const punNaziv = (x: Ymd) =>
  `${DANI_PUNO[danUNedelji(x.g, x.m, x.d)]}, ${x.d}. ${MESECI[x.m - 1]} ${x.g}.`;

/**
 * Polje za datum: ručni unos `dd/mm/gggg` (kose crte se dodaju same) ili izbor
 * u kalendaru. Forma i dalje šalje ISO preko skrivenog polja, pa se API, baza i
 * obuhvat zbirova ne menjaju. Neispravan unos blokira slanje forme i prikazuje
 * kratku poruku uz polje.
 */
export function DateField({
  name,
  label,
  defaultValue,
  value,
  onChange,
  required = false,
  disabled = false,
  hint,
  error,
  id,
}: DateFieldProps) {
  const auto = useId();
  const poljeId = id ?? `datum-${auto}`;
  const porukaId = `${poljeId}-poruka`;
  const kalendarId = `${poljeId}-kalendar`;

  const pocetni = value ?? defaultValue ?? "";
  const [iso, setIso] = useState<string>(izIso(pocetni) ? pocetni : "");
  const [tekst, setTekst] = useState<string>(uPrikaz(pocetni));
  const [greska, setGreska] = useState<string | null>(null);
  const [otvoren, setOtvoren] = useState(false);

  const unosRef = useRef<HTMLInputElement>(null);
  const dugmeRef = useRef<HTMLButtonElement>(null);
  const omotRef = useRef<HTMLDivElement>(null);
  const kursorRef = useRef<number | null>(null);

  // Kontrolisana vrednost spolja (prečice perioda, „Sve vreme").
  useEffect(() => {
    if (value === undefined || value === iso) return;
    setIso(izIso(value) ? value : "");
    setTekst(uPrikaz(value));
    setGreska(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Kursor posle iste cifre posle formatiranja.
  useLayoutEffect(() => {
    if (kursorRef.current === null || !unosRef.current) return;
    unosRef.current.setSelectionRange(kursorRef.current, kursorRef.current);
    kursorRef.current = null;
  }, [tekst]);

  const vazecaGreska = greska ?? error ?? null;

  // Forma se ne šalje dok je unos neispravan ili period obrnut.
  useEffect(() => {
    unosRef.current?.setCustomValidity(vazecaGreska ?? "");
  }, [vazecaGreska]);

  const prijavi = useCallback(
    (novIso: string, ispravno: boolean) => {
      setIso(novIso);
      onChange?.(novIso, ispravno);
    },
    [onChange],
  );

  function naIzmenu(e: ChangeEvent<HTMLInputElement>) {
    const el = e.target;
    const tip = (e.nativeEvent as InputEvent).inputType ?? "";
    const brisanje = tip.startsWith("delete");
    let sirovo = el.value;
    const poz = el.selectionStart ?? sirovo.length;
    let cifaraPre = sirovo.slice(0, poz).replace(/\D/g, "").length;

    // Brisanje same kose crte briše cifru pre nje — inače bi Backspace „zapeo".
    const ranijeCifara = tekst.replace(/\D/g, "").length;
    const sadaCifara = sirovo.replace(/\D/g, "").length;
    if (brisanje && sadaCifara === ranijeCifara && sirovo.length < tekst.length) {
      const cifre = sirovo.replace(/\D/g, "");
      const ukloni = tip === "deleteContentForward" ? cifaraPre : cifaraPre - 1;
      if (ukloni >= 0 && ukloni < cifre.length) {
        const nove = cifre.slice(0, ukloni) + cifre.slice(ukloni + 1);
        sirovo = nove;
        cifaraPre = Math.max(0, ukloni);
      }
    }

    const novi = formatirajUnos(sirovo, brisanje);
    kursorRef.current = kursorPosle(novi, cifaraPre);
    setTekst(novi);

    const r = izUnosa(novi);
    if (r.iso) {
      setGreska(null);
      prijavi(r.iso, true);
    } else {
      // Poruka tek kad je unos dovoljno dug ili ga korisnik napusti.
      setGreska(novi.length >= 10 ? PORUKA[kodGreske(r) ?? "nepotpuno"] : null);
      prijavi("", novi.length === 0);
    }
  }

  function naNapustanje() {
    const r = izUnosa(tekst);
    if (r.iso) {
      setTekst(uPrikaz(r.iso));
      setGreska(null);
      if (r.iso !== iso) prijavi(r.iso, true);
    } else if (kodGreske(r) === "prazno") {
      setGreska(required ? PORUKA.prazno : null);
    } else {
      setGreska(PORUKA[kodGreske(r) ?? "nepotpuno"]);
    }
  }

  function izaberi(x: Ymd) {
    const novi = uIso(x.g, x.m, x.d);
    setTekst(uPrikaz(novi));
    setGreska(null);
    prijavi(novi, true);
    setOtvoren(false);
    dugmeRef.current?.focus();
  }

  function obrisi() {
    setTekst("");
    setGreska(required ? PORUKA.prazno : null);
    prijavi("", !required);
    setOtvoren(false);
    unosRef.current?.focus();
  }

  return (
    <div className="pd-field" ref={omotRef} data-open={otvoren || undefined}>
      <label htmlFor={poljeId} className="pd-label">
        {label}
      </label>
      <div className="pd-control" data-invalid={vazecaGreska ? "true" : undefined}>
        <input
          ref={unosRef}
          id={poljeId}
          className="pd-input"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="dd/mm/gggg"
          maxLength={10}
          value={tekst}
          onChange={naIzmenu}
          onBlur={naNapustanje}
          onInvalid={(e) => {
            // Umesto oblačića pregledača: kratka poruka uz polje i fokus na njemu.
            e.preventDefault();
            if (!vazecaGreska) setGreska(required && !tekst ? PORUKA.prazno : PORUKA.nepotpuno);
            unosRef.current?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && e.altKey) {
              e.preventDefault();
              setOtvoren(true);
            }
          }}
          required={required}
          disabled={disabled}
          aria-invalid={vazecaGreska ? true : undefined}
          aria-describedby={vazecaGreska || hint ? porukaId : undefined}
        />
        {tekst && !disabled ? (
          <button
            type="button"
            className="pd-clear"
            onClick={obrisi}
            aria-label={`Obrišite: ${label}`}
            title="Obrišite"
          >
            ×
          </button>
        ) : null}
        <button
          ref={dugmeRef}
          type="button"
          className="pd-btn"
          onClick={() => setOtvoren((o) => !o)}
          aria-haspopup="dialog"
          aria-expanded={otvoren}
          aria-controls={otvoren ? kalendarId : undefined}
          aria-label={`Otvorite kalendar: ${label}`}
          disabled={disabled}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <rect x="3.5" y="5" width="17" height="15" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
            <path d="M3.5 9.5h17M8 3v4M16 3v4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      {/* Kontrolisano polje šalje vrednost iz roditelja odmah (prečica + slanje forme). */}
      <input type="hidden" name={name} value={value !== undefined ? (izIso(value) ? value : "") : iso} />
      {vazecaGreska || hint ? (
        <small id={porukaId} className={vazecaGreska ? "pd-error" : "pd-hint"} role={vazecaGreska ? "alert" : undefined}>
          {vazecaGreska ?? hint}
        </small>
      ) : null}
      {otvoren ? (
        <Kalendar
          id={kalendarId}
          label={label}
          izabran={izIso(iso)}
          omotRef={omotRef}
          onIzbor={izaberi}
          onObrisi={obrisi}
          onZatvori={() => {
            setOtvoren(false);
            dugmeRef.current?.focus();
          }}
        />
      ) : null}
    </div>
  );
}

function Kalendar({
  id,
  label,
  izabran,
  omotRef,
  onIzbor,
  onObrisi,
  onZatvori,
}: {
  id: string;
  label: string;
  izabran: Ymd | null;
  omotRef: React.RefObject<HTMLDivElement | null>;
  onIzbor: (x: Ymd) => void;
  onObrisi: () => void;
  onZatvori: () => void;
}) {
  const danas = danasBeograd();
  const [fokus, setFokus] = useState<Ymd>(izabran ?? danas);
  const [polozaj, setPolozaj] = useState<"dole" | "gore" | "list">("dole");
  const [desno, setDesno] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const mrezaRef = useRef<HTMLDivElement>(null);

  // Kalendar ne sme izaći van ekrana: na uskom ili niskom ekranu je donji
  // list, inače ispod polja (ili iznad ako dole nema mesta), poravnat da stane
  // po širini.
  useLayoutEffect(() => {
    const omot = omotRef.current;
    const panel = panelRef.current;
    if (!omot || !panel) return;
    if (window.innerWidth < 520) {
      setPolozaj("list");
      return;
    }
    const r = omot.getBoundingClientRect();
    const visina = panel.offsetHeight;
    const sirina = panel.offsetWidth;
    const staneDole = r.bottom + visina + 12 <= window.innerHeight;
    const staneGore = r.top > visina + 12;
    // Nizak prozor (npr. zum 150–200 %): ni ispod ni iznad nema mesta, pa
    // kalendar postaje donji list koji je uvek ceo na ekranu.
    setPolozaj(staneDole ? "dole" : staneGore ? "gore" : "list");
    setDesno(r.left + sirina + 12 > window.innerWidth);
  }, [omotRef]);

  // Fokus na izabran/današnji dan pri otvaranju i posle pomeranja.
  useEffect(() => {
    const dugme = mrezaRef.current?.querySelector<HTMLButtonElement>('[data-focus="true"]');
    dugme?.focus({ preventScroll: polozaj !== "list" });
  }, [fokus, polozaj]);

  // Klik van kalendara ga zatvara.
  useEffect(() => {
    const van = (e: PointerEvent) => {
      if (omotRef.current && !omotRef.current.contains(e.target as Node)) onZatvori();
    };
    document.addEventListener("pointerdown", van);
    return () => document.removeEventListener("pointerdown", van);
  }, [omotRef, onZatvori]);

  function naTaster(e: KeyboardEvent<HTMLDivElement>) {
    const p: Record<string, () => Ymd> = {
      ArrowLeft: () => pomeri(fokus, -1),
      ArrowRight: () => pomeri(fokus, 1),
      ArrowUp: () => pomeri(fokus, -7),
      ArrowDown: () => pomeri(fokus, 7),
      PageUp: () => pomeri(fokus, 0, e.shiftKey ? -12 : -1),
      PageDown: () => pomeri(fokus, 0, e.shiftKey ? 12 : 1),
      Home: () => pomeri(fokus, -danUNedelji(fokus.g, fokus.m, fokus.d)),
      End: () => pomeri(fokus, 6 - danUNedelji(fokus.g, fokus.m, fokus.d)),
    };
    if (p[e.key]) {
      e.preventDefault();
      const n = p[e.key]();
      if (n.g >= GODINA_MIN && n.g <= GODINA_MAX) setFokus(n);
    }
  }

  const godine: number[] = [];
  for (let g = Math.max(GODINA_MIN, 2015); g <= danas.g + 2; g += 1) godine.push(g);
  if (!godine.includes(fokus.g)) godine.push(fokus.g);
  godine.sort((a, b) => a - b);

  const polja = mrezaMeseca(fokus.g, fokus.m);
  const redovi: (number | null)[][] = [];
  for (let i = 0; i < polja.length; i += 7) redovi.push(polja.slice(i, i + 7));

  return (
    <>
      {polozaj === "list" ? <div className="pd-scrim" aria-hidden="true" onClick={onZatvori} /> : null}
      <div
        ref={panelRef}
        id={id}
        className="pd-pop"
        data-polozaj={polozaj}
        data-desno={desno || undefined}
        role="dialog"
        aria-modal={polozaj === "list" ? true : undefined}
        aria-label={`Kalendar: ${label}`}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            onZatvori();
          }
        }}
      >
        <div className="pd-head">
          <button type="button" className="pd-nav" onClick={() => setFokus(pomeri(fokus, 0, -1))} aria-label="Prethodni mesec">
            ‹
          </button>
          <select
            className="pd-select"
            aria-label="Mesec"
            value={fokus.m}
            onChange={(e) => setFokus(pomeri({ ...fokus, m: Number(e.target.value), d: Math.min(fokus.d, 28) }, 0, 0))}
          >
            {MESECI.map((ime, i) => (
              <option key={ime} value={i + 1}>
                {ime}
              </option>
            ))}
          </select>
          <select
            className="pd-select"
            aria-label="Godina"
            value={fokus.g}
            onChange={(e) => setFokus({ ...fokus, g: Number(e.target.value), d: Math.min(fokus.d, 28) })}
          >
            {godine.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
          <button type="button" className="pd-nav" onClick={() => setFokus(pomeri(fokus, 0, 1))} aria-label="Sledeći mesec">
            ›
          </button>
        </div>
        <div className="pd-grid" role="grid" aria-label={`${MESECI[fokus.m - 1]} ${fokus.g}`} ref={mrezaRef} onKeyDown={naTaster}>
          <div role="row" className="pd-row pd-weekdays">
            {DANI_KRATKO.map((d) => (
              <span key={d} role="columnheader" className="pd-wd" aria-label={DANI_PUNO[DANI_KRATKO.indexOf(d)]}>
                {d}
              </span>
            ))}
          </div>
          {redovi.map((red, ri) => (
            <div role="row" className="pd-row" key={ri}>
              {red.map((d, ci) => {
                if (d === null) return <span key={ci} role="gridcell" className="pd-empty" />;
                const x = { g: fokus.g, m: fokus.m, d };
                const jeIzabran = jednako(x, izabran);
                const jeDanas = jednako(x, danas);
                const jeFokus = d === fokus.d;
                return (
                  <span key={ci} role="gridcell" aria-selected={jeIzabran || undefined}>
                    <button
                      type="button"
                      className="pd-day"
                      data-selected={jeIzabran || undefined}
                      data-today={jeDanas || undefined}
                      data-focus={jeFokus || undefined}
                      data-weekend={ci >= 5 || undefined}
                      tabIndex={jeFokus ? 0 : -1}
                      aria-label={`${punNaziv(x)}${jeDanas ? " (danas)" : ""}`}
                      aria-current={jeDanas ? "date" : undefined}
                      onClick={() => onIzbor(x)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onIzbor(x);
                        }
                      }}
                    >
                      {d}
                    </button>
                  </span>
                );
              })}
            </div>
          ))}
        </div>
        <div className="pd-foot">
          <button type="button" className="pd-link" onClick={() => onIzbor(danas)}>
            Danas
          </button>
          <button type="button" className="pd-link" onClick={onObrisi}>
            Obrišite
          </button>
          <button type="button" className="pd-link" onClick={onZatvori}>
            Zatvorite
          </button>
        </div>
      </div>
    </>
  );
}
