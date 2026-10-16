"use client";

import { useActionState, useState } from "react";
import { DateField } from "@/components/portal/DateField";
import { parseCsv, readXlsx } from "@/lib/pricing/tablePriceList.mjs";
import { applyImportAction, discardImportAction, prepareTableAction, uploadPdfAction, type ImportState } from "./actions";

const INITIAL: ImportState = { error: null, ok: null };

function Status({ state }: { state: ImportState }) {
  if (state.error) return <p className="pn-note" data-tone="danger" role="alert"><span>{state.error}</span></p>;
  if (state.ok) return <p className="pn-note" data-tone="success" role="status"><span>{state.ok}</span></p>;
  return null;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

const GUESS: [keyof Cols, RegExp][] = [
  ["code", /^(šifra|sifra|šif|sif|code|kod|artikal)\b/i],
  ["price", /(vp|cena|price)/i],
  ["name", /^(naziv|name|opis)/i],
  ["unit", /^(jm|j\.m\.|jed|unit)/i],
  ["pack", /^(pak|pakovanje|pack)/i],
];
type Cols = { code: string; price: string; name: string; unit: string; pack: string };

/** Korak 1–2: fajl, kolone i jedinica cene. Pregled se čita u pregledaču; server ponovo čita ceo fajl. */
export function TableImportForm() {
  const [state, action, pending] = useActionState(prepareTableAction, INITIAL);
  const [table, setTable] = useState<string[][] | null>(null);
  const [readErr, setReadErr] = useState<string | null>(null);
  const [header, setHeader] = useState(true);
  const [cols, setCols] = useState<Cols>({ code: "", price: "", name: "", unit: "", pack: "" });
  const [unit, setUnit] = useState<"" | "jm" | "pak">("");

  const onFile = async (f: File | null) => {
    setTable(null);
    setReadErr(null);
    if (!f) return;
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const t = /\.xlsx$/i.test(f.name) || (bytes[0] === 0x50 && bytes[1] === 0x4b) ? await readXlsx(bytes, inflateRaw) : parseCsv(new TextDecoder("utf-8").decode(bytes));
      setTable(t);
      const head = t[0] ?? [];
      const next: Cols = { code: "", price: "", name: "", unit: "", pack: "" };
      for (const [k, re] of GUESS) {
        const i = head.findIndex((h, idx) => re.test(h) && !Object.values(next).includes(String(idx)));
        if (i >= 0) next[k] = String(i);
      }
      setCols(next);
      setHeader(next.code !== "" || next.price !== "");
      if (/pak/i.test(head[Number(next.price)] ?? "")) setUnit("");
    } catch (e) {
      setReadErr((e as Error).message || "Fajl se ne može pročitati.");
    }
  };

  const width = Math.max(0, ...(table ?? []).slice(0, 6).map((r) => r.length));
  const options = Array.from({ length: width }, (_, i) => ({ v: String(i), t: header && table?.[0]?.[i] ? `${table[0][i]} (kolona ${i + 1})` : `Kolona ${i + 1}` }));
  const roleOf = (i: number) => (Object.entries(cols) as [keyof Cols, string][]).filter(([, v]) => v === String(i)).map(([k]) => ({ code: "šifra", price: "nova VP", name: "naziv", unit: "JM", pack: "pakovanje" })[k]).join(", ");
  const priceHead = table && header && cols.price !== "" ? table[0]?.[Number(cols.price)] ?? "" : "";

  return (
    <form action={action} className="pn-card" style={{ gap: 16 }}>
      <h2 className="pn-h2">Tabela (CSV ili XLSX)</h2>
      <div className="pn-field" style={{ maxWidth: 520 }}>
        <label htmlFor="uvoz-fajl">Fajl cenovnika</label>
        <input id="uvoz-fajl" type="file" name="fajl" accept=".csv,.txt,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required disabled={pending} onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
        <span className="pn-help">Prepoznavanje artikla je samo po šifri. Naziv iz fajla služi samo kao upozorenje — artikli se ne povezuju po sličnosti naziva.</span>
      </div>
      {readErr ? <p className="pn-error" role="alert">{readErr}</p> : null}
      {table ? (
        <>
          <label className="pn-check" style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="checkbox" name="zaglavlje" value="da" checked={header} onChange={(e) => setHeader(e.target.checked)} /> Prvi red je zaglavlje (nazivi kolona)
          </label>
          <div className="pn-fields" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            {(
              [
                ["code", "kolSifra", "Šifra artikla — obavezno", true],
                ["price", "kolCena", "Nova VP cena — obavezno", true],
                ["name", "kolNaziv", "Naziv (samo za proveru)", false],
                ["unit", "kolJm", "Jedinica mere (provera)", false],
                ["pack", "kolPak", "Pakovanje (provera)", false],
              ] as const
            ).map(([k, name, label, req]) => (
              <div key={k} className="pn-field">
                <label htmlFor={`kol-${k}`}>{label}</label>
                <select id={`kol-${k}`} name={name} value={cols[k]} required={req} onChange={(e) => setCols((p) => ({ ...p, [k]: e.target.value }))}>
                  <option value="">{req ? "— izaberite —" : "— nije u fajlu —"}</option>
                  {options.map((o) => (
                    <option key={o.v} value={o.v}>{o.t}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <fieldset className="pn-card" style={{ borderColor: unit ? "var(--p-line)" : "var(--pn-warn-mark)", borderWidth: 2 }}>
            <legend style={{ fontWeight: 600, padding: "0 6px" }}>Cena u fajlu je po — obavezan izbor</legend>
            <div className="ck-chips" role="radiogroup" aria-label="Jedinica cene">
              <label className="ck-chip" aria-pressed={unit === "jm"}>
                <input type="radio" name="jedinica" value="jm" checked={unit === "jm"} onChange={() => setUnit("jm")} className="pn-sr" /> jedinici mere (l, kg, kom)
              </label>
              <label className="ck-chip" aria-pressed={unit === "pak"}>
                <input type="radio" name="jedinica" value="pak" checked={unit === "pak"} onChange={() => setUnit("pak")} className="pn-sr" /> pakovanju — deli se količinom u pakovanju
              </label>
            </div>
            <p className="pn-small" style={{ margin: 0 }}>
              {unit === "pak"
                ? "VP po JM = cena iz fajla ÷ potvrđena količina JM u pakovanju. Artikal bez potvrđenog pakovanja ide među neispravne redove."
                : unit === "jm"
                  ? "Cena iz fajla se uzima kao VP po JM, bez preračuna. Pregled označava promene veće od 30 %."
                  : /pak/i.test(priceHead)
                    ? `Kolona „${priceHead}“ liči na cenu po pakovanju — proverite pre izbora.`
                    : "Izaberite jedinicu cene."}
            </p>
          </fieldset>
          <div className="ck-wrap">
            <div className="pn-small pn-muted" style={{ padding: "6px 10px", background: "var(--p-surface-subtle)" }}>Prvih 5 redova fajla</div>
            <div style={{ overflowX: "auto" }}>
              <table className="pn-table">
                <thead>
                  <tr>{options.map((o, i) => <th key={o.v}>{header ? table[0]?.[i] ?? "" : `Kolona ${i + 1}`} <span style={{ color: "var(--pn-info-ink)" }}>{roleOf(i) ? `→ ${roleOf(i)}` : ""}</span></th>)}</tr>
                </thead>
                <tbody>
                  {table.slice(header ? 1 : 0, (header ? 1 : 0) + 5).map((r, ri) => (
                    <tr key={ri}>{options.map((o, i) => <td key={o.v} className="pn-num">{r[i] ?? ""}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="pn-small pn-muted" style={{ margin: 0 }}>Ukupno redova: {table.length - (header ? 1 : 0)}.</p>
        </>
      ) : null}
      <div className="pn-actions" style={{ justifyContent: "flex-end" }}>
        <button type="submit" className="pn-btn" data-variant="primary" disabled={pending || !table || !unit || cols.code === "" || cols.price === ""} aria-busy={pending || undefined}>
          {pending ? "Čitam fajl…" : "Dalje: prepoznavanje po šifri"}
        </button>
      </div>
      <Status state={state} />
    </form>
  );
}

export function PdfImportForm() {
  const [state, action, pending] = useActionState(uploadPdfAction, INITIAL);
  return (
    <form action={action} className="pn-card">
      <h2 className="pn-h2">BizniSoft PDF</h2>
      <div className="pn-field">
        <label htmlFor="uvoz-pdf">Izveštaj „Stanje zaliha – nabavna i VP cena“</label>
        <input id="uvoz-pdf" type="file" name="cenovnik" accept="application/pdf,.pdf" required disabled={pending} />
        <span className="pn-help">Čita se samo VP cena po JM; nabavna cena, stanje i marža se ne čuvaju.</span>
      </div>
      <div className="pn-actions" style={{ justifyContent: "flex-end" }}>
        <button type="submit" className="pn-btn" disabled={pending}>{pending ? "Čitam PDF…" : "Otpremite na pregled"}</button>
      </div>
      <Status state={state} />
    </form>
  );
}

export type NewRow = { code: string; name: string; raw: string; perPack: boolean };

/** Korak 4–5: novi i neprepoznati, nejasne stavke, datum važenja i potvrda. */
export function ImportDecisionForm(props: {
  importId: string;
  reportDate: string;
  defaultDate: string;
  newRows: NewRow[];
  unclear: { code: string; fileName: string; portalName: string | null; price: string }[];
  groups: string[];
  toApply: number;
}) {
  const [state, action, pending] = useActionState(applyImportAction, INITIAL);
  const [modes, setModes] = useState<Record<string, string>>({});
  const [date, setDate] = useState(props.defaultDate);
  const [qty, setQty] = useState<Record<string, string>>({});
  const perUnit = (r: NewRow) => {
    const q = Number((qty[r.code] ?? "").replace(",", "."));
    const raw = Number(r.raw.replace(/\./g, "").replace(",", "."));
    if (!r.perPack) return r.raw;
    return q > 0 ? new Intl.NumberFormat("sr-Latn-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.round((raw * 100) / q) / 100) : "—";
  };
  return (
    <form action={action} className="pn" style={{ gap: 16 }}>
      <input type="hidden" name="importId" value={props.importId} />
      <section className="pn-card">
        <div className="pn-card-h"><h2>4. Novi i neprepoznati artikli ({props.newRows.length})</h2></div>
        {props.newRows.length === 0 ? <p className="pn-muted">Nema neprepoznatih šifara.</p> : null}
        <p className="pn-small pn-muted" style={{ margin: 0 }}>
          Za svaki red izaberite: <b>nov artikal</b> (uz JM i pakovanje; dobija podrazumevani rabat 30 % za avans i odloženo), <b>izričito povezivanje</b> sa postojećom šifrom ili
          preskakanje. Portal ne predlaže artikle po sličnosti naziva.
        </p>
        {props.newRows.map((r) => {
          const mode = modes[r.code] ?? "preskoci";
          return (
            <fieldset key={r.code} className="pn-card" style={{ borderColor: mode === "preskoci" ? "var(--p-line)" : "var(--p-ink)" }}>
              <legend style={{ fontWeight: 600, padding: "0 6px" }}>
                <span className="pn-num">{r.code}</span> · {r.name} · iz fajla {r.raw} {r.perPack ? "(po pakovanju)" : "(po JM)"}
              </legend>
              <input type="hidden" name="noviKod" value={r.code} />
              <div className="ck-chips" role="radiogroup" aria-label={`Odluka za ${r.code}`}>
                {(
                  [
                    ["novi", "Nov artikal"],
                    ["povezi", "Povežite sa postojećom šifrom"],
                    ["preskoci", "Preskočite red"],
                  ] as const
                ).map(([m, l]) => (
                  <label key={m} className="ck-chip" aria-pressed={mode === m}>
                    <input type="radio" className="pn-sr" name={`odluka:${r.code}`} value={m} checked={mode === m} onChange={() => setModes((p) => ({ ...p, [r.code]: m }))} /> {l}
                  </label>
                ))}
              </div>
              {mode === "novi" ? (
                <div className="pn-fields" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
                  <div className="pn-field"><label htmlFor={`n-${r.code}`}>Naziv u portalu</label><input id={`n-${r.code}`} name={`naziv:${r.code}`} defaultValue={r.name} required /></div>
                  <div className="pn-field">
                    <label htmlFor={`g-${r.code}`}>Grupa (opciono)</label>
                    <input id={`g-${r.code}`} name={`grupa:${r.code}`} list="uvoz-grupe" />
                  </div>
                  <div className="pn-field">
                    <label htmlFor={`j-${r.code}`}>JM</label>
                    <select id={`j-${r.code}`} name={`jm:${r.code}`} required defaultValue="">
                      <option value="">—</option>
                      {["l", "kg", "kom", "m", "par", "set"].map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div className="pn-field"><label htmlFor={`p-${r.code}`}>Pakovanje</label><input id={`p-${r.code}`} name={`pak:${r.code}`} placeholder="npr. limenka 0,5 l" required /></div>
                  <div className="pn-field">
                    <label htmlFor={`q-${r.code}`}>Količina JM u pakovanju</label>
                    <input id={`q-${r.code}`} name={`kol:${r.code}`} inputMode="decimal" placeholder="npr. 0,5" required value={qty[r.code] ?? ""} onChange={(e) => setQty((p) => ({ ...p, [r.code]: e.target.value }))} />
                  </div>
                  <div className="pn-field"><span>VP cena po JM</span><b className="pn-num" style={{ fontSize: 17, minHeight: 44, display: "flex", alignItems: "center" }}>{perUnit(r)}</b></div>
                </div>
              ) : null}
              {mode === "povezi" ? (
                <div className="pn-field" style={{ maxWidth: 320 }}>
                  <label htmlFor={`v-${r.code}`}>Tačna šifra postojećeg artikla</label>
                  <input id={`v-${r.code}`} name={`veza:${r.code}`} required pattern="[0-9A-Za-z./_\-]{1,32}" />
                  <span className="pn-help">Veza se pamti i važi i za sledeće uvoze.</span>
                </div>
              ) : null}
            </fieldset>
          );
        })}
        <datalist id="uvoz-grupe">{props.groups.map((g) => <option key={g} value={g} />)}</datalist>
      </section>

      {props.unclear.length ? (
        <section className="pn-card">
          <div className="pn-card-h"><h2>Ista šifra, drugačiji naziv ({props.unclear.length})</h2></div>
          <p className="pn-small pn-muted" style={{ margin: 0 }}>Podrazumevano se NE primenjuju. Označite samo one za koje ste sigurni da je isti artikal.</p>
          <table className="pn-table pn-table-cards">
            <thead><tr><th>Primeniti</th><th>Šifra</th><th>Naziv u fajlu</th><th>Naziv u portalu</th><th className="pn-r">VP / JM</th></tr></thead>
            <tbody>
              {props.unclear.map((u) => (
                <tr key={u.code}>
                  <td data-label="Primeniti"><input type="checkbox" name="nejasno" value={u.code} aria-label={`Primeniti ${u.code}`} /></td>
                  <td data-label="Šifra" className="pn-num">{u.code}</td>
                  <td data-label="Naziv u fajlu">{u.fileName}</td>
                  <td data-label="Naziv u portalu">{u.portalName ?? "—"}</td>
                  <td data-label="VP / JM" className="pn-r pn-num">{u.price}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      <section className="pn-card">
        <div className="pn-card-h"><h2>5. Završni pregled i potvrda</h2></div>
        <ul className="pn-small" style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 3 }}>
          <li><b>Rabati kupaca se ne menjaju</b> — ni redovni, ni akcijski, ni rabat koji se vraća posle akcije. Cene kupaca se od datuma važenja računaju iz nove VP cene.</li>
          <li>Do dana pre datuma važenja važi stara VP cena.</li>
          <li>Novi artikli dobijaju podrazumevani rabat 30 % za avans i odloženo, dok komercijalista ili vlasnik ne upiše dogovor; postojeći izričiti dogovori se ne prepisuju.</li>
          <li>Uvoz se beleži (ko, kada, fajl, broj redova). Obaveštenja o rabatima se ne šalju, jer se rabati ne menjaju.</li>
        </ul>
        <div className="pn-fields" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", alignItems: "end" }}>
          <DateField name="vaziOd" label="Nova VP cena važi od" value={date} onChange={(iso) => setDate(iso)} required hint={`Najranije ${props.reportDate.split("-").reverse().join("/")}`} />
          <div className="pn-field"><label htmlFor="uvoz-napomena">Napomena (nije obavezna)</label><input id="uvoz-napomena" name="napomena" maxLength={500} /></div>
        </div>
        <label className="pn-check" style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 600 }}>
          <input type="checkbox" name="potvrda" value="da" required /> Pregledao/la sam promene; primena menja samo VP cene ({props.toApply} prepoznatih).
        </label>
        <div className="pn-actions" style={{ justifyContent: "flex-end" }}>
          <button type="submit" className="pn-btn" data-variant="primary" disabled={pending} aria-busy={pending || undefined}>{pending ? "Primenjuje se…" : "Potvrdite uvoz"}</button>
        </div>
        <Status state={state} />
      </section>
    </form>
  );
}

export function DiscardImportForm({ importId }: { importId: string }) {
  const [state, action, pending] = useActionState(discardImportAction, INITIAL);
  return (
    <form action={action} className="pn-card">
      <input type="hidden" name="importId" value={importId} />
      <div className="pn-field" style={{ maxWidth: 520 }}>
        <label htmlFor="uvoz-razlog">Odbacite ovaj uvoz — razlog</label>
        <input id="uvoz-razlog" name="razlog" minLength={5} required placeholder="npr. pogrešna kolona cene" />
      </div>
      <div className="pn-actions" style={{ justifyContent: "flex-start" }}>
        <button type="submit" className="pn-btn" data-variant="danger" disabled={pending}>{pending ? "Odbacuje se…" : "Odbacite uvoz…"}</button>
      </div>
      <Status state={state} />
    </form>
  );
}
