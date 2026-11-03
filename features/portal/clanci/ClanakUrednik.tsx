"use client";

import { useActionState, useEffect, useId, useMemo, useRef, useState } from "react";
import { DateField } from "@/components/portal/DateField";
import { otpremiSlikuAction, sacuvajAction, type ClanakActionState, type SlikaActionState } from "@/app/portal/clanci/actions";
import { cistTekst, dozvoljenLink, markdownUHtml } from "@/lib/saveti/urednik/format.mjs";

/*
 * Urednik članka (panel „Članci“). Tekst se uređuje kao formatiran tekst; čuva se Markdown
 * podskup rubrike. Ništa se ne objavljuje čuvanjem: svako čuvanje je nova verzija, a izmena
 * javnog sadržaja poništava odobrenje (vidi lib/saveti/urednik/stanje.mjs).
 */

export type Izvor = {
  id: string;
  naziv: string;
  url?: string;
  verzija?: string;
  datumIzvora?: string;
  pristupljeno: string;
  tip: string;
  napomena?: string;
};

export type UrednikPocetno = {
  id: string | null;
  osnova: number;
  slug: string | null;
  tip: string;
  kategorija: string;
  naslov: string;
  metaNaslov: string;
  opis: string;
  telo: string;
  izvori: Izvor[];
  interneNapomene: string;
  nepotvrdjeno: string;
  slika: { id: string; alt: string; sirina: number; visina: number } | null;
};

const INITIAL: ClanakActionState = { error: null, ok: null };
const SLIKA_INITIAL: SlikaActionState = { error: null, slika: null };
const TIPOVI_IZVORA = [
  ["tehnicki-list", "Tehnički list"],
  ["bezbednosni-list", "Bezbednosni list"],
  ["katalog", "Katalog"],
  ["uputstvo", "Uputstvo"],
  ["stranica", "Stranica proizvođača"],
  ["propis", "Propis"],
  ["vest", "Vest"],
] as const;

/* -------------------------------------------------------------- DOM → Markdown */

function inline(node: Node): string {
  let out = "";
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      out += cistTekst(child.textContent ?? "");
      return;
    }
    if (!(child instanceof HTMLElement)) return;
    const tag = child.tagName;
    if (child.dataset.cite) {
      out += `[^${child.dataset.cite}]`;
      return;
    }
    if (tag === "BR") {
      out += " ";
      return;
    }
    const inner = inline(child);
    const wrap = (mark: string) => {
      const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(inner) as RegExpExecArray;
      return m[2] ? `${m[1]}${mark}${m[2]}${mark}${m[3]}` : inner;
    };
    if (tag === "STRONG" || tag === "B") out += wrap("**");
    else if (tag === "EM" || tag === "I") out += wrap("*");
    else if (tag === "CODE") out += inner.trim() ? `\`${inner.trim()}\`` : "";
    else if (tag === "A") {
      const href = dozvoljenLink(child.getAttribute("href"));
      // Razmaci na ivicama linka ostaju van njega („Pogledajte [katalog](…)“, ne „Pogledajte[ katalog]“).
      const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(inner) as RegExpExecArray;
      out += href && m[2] ? `${m[1]}[${m[2]}](${href})${m[3]}` : inner;
    } else out += inner;
  });
  return out;
}

const norm = (s: string) => s.replace(/[ \t]+/g, " ").trim();

function serialize(root: HTMLElement): string {
  const blocks: string[] = [];
  let loose = "";
  const flush = () => {
    if (norm(loose)) blocks.push(norm(loose));
    loose = "";
  };
  const walk = (parent: Node) => {
    parent.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        loose += cistTekst(node.textContent ?? "");
        return;
      }
      if (!(node instanceof HTMLElement)) return;
      const tag = node.tagName;
      if (node.dataset.md) {
        flush();
        blocks.push(node.dataset.md);
        return;
      }
      if (tag === "H2" || tag === "H3" || tag === "H1" || tag === "H4") {
        flush();
        const text = norm(inline(node));
        if (text) blocks.push(`${tag === "H3" || tag === "H4" ? "###" : "##"} ${text}`);
        return;
      }
      if (tag === "UL" || tag === "OL") {
        flush();
        const items = Array.from(node.querySelectorAll(":scope > li"))
          .map((li) => norm(inline(li)))
          .filter(Boolean);
        if (items.length) blocks.push(items.map((t, i) => (tag === "OL" ? `${i + 1}. ${t}` : `- ${t}`)).join("\n"));
        return;
      }
      if (tag === "P" || tag === "DIV" || tag === "BLOCKQUOTE" || tag === "SECTION") {
        flush();
        // Ugnežđeni blokovi (zalepljen tekst) se izravnavaju u pasuse.
        if (node.querySelector("p,div,h2,h3,ul,ol")) {
          walk(node);
          flush();
        } else {
          const text = norm(inline(node));
          if (text) blocks.push(text);
        }
        return;
      }
      if (tag === "BR") {
        flush();
        return;
      }
      // Inline element na vrhu (npr. podebljan tekst van pasusa) zadržava svoje oblikovanje.
      const tmp = document.createElement("span");
      tmp.appendChild(node.cloneNode(true));
      loose += inline(tmp);
    });
  };
  walk(root);
  flush();
  return blocks.join("\n\n");
}

/* -------------------------------------------------------------- urednik teksta */

function RichEditor({
  initialHtml,
  onChange,
  izvori,
  labelId,
}: {
  initialHtml: string;
  onChange: (md: string) => void;
  izvori: Izvor[];
  labelId: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const saved = useRef<Range | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [href, setHref] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [cite, setCite] = useState("");

  useEffect(() => {
    if (ref.current) {
      ref.current.innerHTML = initialHtml;
      document.execCommand("defaultParagraphSeparator", false, "p");
    }
    // Sadržaj se postavlja jednom; dalje ga vodi pregledač.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emit = () => ref.current && onChange(serialize(ref.current));
  const remember = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount && ref.current?.contains(sel.anchorNode)) saved.current = sel.getRangeAt(0).cloneRange();
  };
  const restore = () => {
    const root = ref.current;
    root?.focus();
    if (saved.current && root) {
      const range = saved.current.cloneRange();
      // Kursor „posle poslednjeg pasusa“ pregledač beleži na samom korenu urednika; ubačen citat
      // ili link bi tada postao poseban blok. Vraća se na kraj prethodnog pasusa ili stavke.
      if (range.collapsed && range.startContainer === root && range.startOffset > 0) {
        const prev = root.childNodes[range.startOffset - 1];
        if (prev instanceof HTMLElement && !prev.dataset.md) {
          const target = prev.tagName === "UL" || prev.tagName === "OL" ? prev.lastElementChild ?? prev : prev;
          range.selectNodeContents(target);
          range.collapse(false);
        }
      }
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  };
  const cmd = (name: string, value?: string) => {
    restore();
    document.execCommand(name, false, value);
    remember();
    emit();
  };

  const tools: { label: string; title: string; run: () => void; aria?: string }[] = [
    { label: "Podnaslov", title: "Podnaslov (nivo 2)", run: () => cmd("formatBlock", "h2") },
    { label: "Manji podnaslov", title: "Podnaslov (nivo 3)", run: () => cmd("formatBlock", "h3") },
    { label: "Pasus", title: "Običan pasus", run: () => cmd("formatBlock", "p") },
    { label: "B", title: "Podebljano", aria: "Podebljano", run: () => cmd("bold") },
    { label: "I", title: "Kurziv", aria: "Kurziv", run: () => cmd("italic") },
    { label: "• Lista", title: "Lista sa tačkama", run: () => cmd("insertUnorderedList") },
    { label: "1. Lista", title: "Numerisana lista", run: () => cmd("insertOrderedList") },
    {
      label: "Link",
      title: "Dodajte link na izabrani tekst",
      run: () => {
        remember();
        setLinkOpen(true);
        setLinkError(null);
      },
    },
    { label: "Uklonite link", title: "Uklonite link sa izabranog teksta", run: () => cmd("unlink") },
  ];

  const addLink = () => {
    const ok = dozvoljenLink(href);
    if (!ok) {
      setLinkError("Upišite adresu sa sajta (npr. /katalog) ili punu adresu koja počinje sa https://.");
      return;
    }
    restore();
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      document.execCommand("insertHTML", false, `<a href="${ok}">${ok}</a>`);
    } else {
      document.execCommand("createLink", false, ok);
    }
    setLinkOpen(false);
    setHref("");
    emit();
  };

  const addCite = () => {
    if (!cite) return;
    restore();
    // Ubacuje se kroz Range, ne execCommand: Chrome nepromenljiv element na kraju podebljanog
    // teksta izbacuje iz pasusa, pa bi oznaka izvora postala poseban blok.
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || !ref.current?.contains(sel.anchorNode)) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    // Na kraju podebljanog/kurziva/linka oznaka izvora ide iza oblikovanja, ne u njega.
    for (;;) {
      const node = range.startContainer;
      const atEnd = node.nodeType === Node.TEXT_NODE ? range.startOffset === (node.textContent ?? "").length : range.startOffset === node.childNodes.length;
      const parent = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement);
      if (!atEnd || !parent || parent === ref.current || !/^(B|STRONG|I|EM|A|CODE)$/.test(parent.tagName)) break;
      if (node.nodeType === Node.TEXT_NODE && node.nextSibling) break;
      range.setStartAfter(parent);
      range.collapse(true);
    }
    const span = document.createElement("span");
    span.className = "ed-cite";
    span.contentEditable = "false";
    span.dataset.cite = cite;
    span.textContent = `[${cite}]`;
    const space = document.createTextNode("\u00a0");
    range.insertNode(space);
    range.insertNode(span);
    range.setStartAfter(space);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    remember();
    emit();
  };

  return (
    <div className="cl-editor">
      <div className="cl-toolbar" role="toolbar" aria-label="Oblikovanje teksta">
        {tools.map((t) => (
          <button
            key={t.label}
            type="button"
            className="cl-tool"
            title={t.title}
            aria-label={t.aria ?? t.title}
            onMouseDown={(e) => e.preventDefault()}
            onClick={t.run}
            data-tool={t.label}
          >
            {t.label}
          </button>
        ))}
        {izvori.length ? (
          <span className="cl-cite-tool">
            <select aria-label="Izvor koji se navodi u tekstu" value={cite} onChange={(e) => setCite(e.target.value)} onMouseDown={remember}>
              <option value="">Navedite izvor…</option>
              {izvori.map((i) => (
                <option key={i.id} value={i.id}>
                  [{i.id}] {i.naziv.slice(0, 50)}
                </option>
              ))}
            </select>
            <button type="button" className="cl-tool" onMouseDown={(e) => e.preventDefault()} onClick={addCite} disabled={!cite}>
              Ubaci
            </button>
          </span>
        ) : null}
      </div>
      {linkOpen ? (
        <div className="cl-linkbar">
          <label>
            <span>Adresa linka</span>
            <input value={href} onChange={(e) => setHref(e.target.value)} placeholder="/katalog ili https://…" autoFocus onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addLink())} />
          </label>
          <button type="button" className="portal-button" data-variant="primary" data-size="sm" onClick={addLink}>
            Dodajte link
          </button>
          <button type="button" className="portal-button" data-size="sm" onClick={() => setLinkOpen(false)}>
            Odustanite
          </button>
          {linkError ? <p className="portal-field-error" role="alert">{linkError}</p> : null}
        </div>
      ) : null}
      <div
        ref={ref}
        className="cl-content"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-labelledby={labelId}
        onInput={emit}
        onKeyUp={remember}
        onMouseUp={remember}
        onBlur={() => {
          remember();
          emit();
        }}
        onPaste={(e) => {
          // Lepi se samo tekst: formatiranje iz Worda ili sa sajtova ne ulazi u članak.
          e.preventDefault();
          const text = e.clipboardData.getData("text/plain");
          const html = text
            .split(/\n{2,}/)
            .map((par) => `<p>${par.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, " ")}</p>`)
            .join("");
          document.execCommand("insertHTML", false, html);
          emit();
        }}
      />
      <p className="cl-hint">
        Tabele i istaknuti okviri iz postojećih tekstova su zaključani blokovi: mogu da se obrišu ili premeste, ali se ne
        kucaju. Lepi se samo tekst, bez formatiranja.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------- forma */

const danas = () => new Date().toISOString().slice(0, 10);

export function ClanakUrednik({
  pocetno,
  kategorije,
  tipovi,
  smeUredjivanje,
  javno,
}: {
  pocetno: UrednikPocetno;
  kategorije: { slug: string; naziv: string }[];
  tipovi: [string, string][];
  smeUredjivanje: boolean;
  javno: boolean;
}) {
  const [state, action, pending] = useActionState(sacuvajAction, INITIAL);
  const [slikaState, slikaAction, slikaPending] = useActionState(otpremiSlikuAction, SLIKA_INITIAL);
  const [naslov, setNaslov] = useState(pocetno.naslov);
  const [metaNaslov, setMetaNaslov] = useState(pocetno.metaNaslov);
  const [opis, setOpis] = useState(pocetno.opis);
  const [telo, setTelo] = useState(pocetno.telo);
  const [izvori, setIzvori] = useState<Izvor[]>(pocetno.izvori);
  const [napomene, setNapomene] = useState(pocetno.interneNapomene);
  const [nepotvrdjeno, setNepotvrdjeno] = useState(pocetno.nepotvrdjeno);
  const [slika, setSlika] = useState(pocetno.slika);
  const [alt, setAlt] = useState(pocetno.slika?.alt ?? "");
  const [lokalna, setLokalna] = useState<string | null>(null);
  const [promeniAdresu, setPromeniAdresu] = useState(false);
  const [dirty, setDirty] = useState(false);
  const initialHtml = useMemo(() => markdownUHtml(pocetno.telo), [pocetno.telo]);
  const teloId = useId();
  const slikaForm = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (slikaState.slika) {
      setSlika({ ...slikaState.slika, alt });
      // Posle otpremanja prikazuje se obrađena slika sa servera (WebP), ne lokalni fajl.
      setLokalna(null);
      setDirty(true);
    }
    // alt se čuva odvojeno
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slikaState.slika]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const touch = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setDirty(true);
  };

  const sadrzaj = JSON.stringify({
    naslov,
    metaNaslov,
    opis,
    telo,
    izvori,
    interneNapomene: napomene,
    nepotvrdjeno,
    slikaId: slika?.id ?? null,
    slikaAlt: slika ? alt : "",
  });

  const setIzvor = (i: number, patch: Partial<Izvor>) => {
    setIzvori((list) => list.map((item, j) => (j === i ? { ...item, ...patch } : item)));
    setDirty(true);
  };

  return (
    <div className="cl-form">
      {/* Slika ima svoju formu (otpremanje), a članak svoju (čuvanje). */}
      <section className="portal-panel">
        <div className="portal-section-header">
          <div>
            <h2>Naslovna slika</h2>
            <p>JPG, PNG ili WebP do 8 MB, najmanje 600 × 300 px. Slika se čuva sažeta (WebP), bez podataka o lokaciji.</p>
          </div>
        </div>
        <div className="portal-panel-body cl-image">
          <div className="cl-image-preview" data-empty={!slika && !lokalna ? "true" : undefined}>
            {lokalna || slika ? (
              // eslint-disable-next-line @next/next/no-img-element -- pregled pre čuvanja
              <img src={lokalna ?? `/vodici/slike/${slika!.id}`} alt={alt || "Pregled naslovne slike"} />
            ) : (
              <span>Članak nema naslovnu sliku.</span>
            )}
          </div>
          <div className="cl-image-fields">
            {smeUredjivanje ? (
              <form ref={slikaForm} action={slikaAction} className="cl-image-upload">
                <label className="portal-field">
                  <span>Nova slika</span>
                  <input
                    type="file"
                    name="slika"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      setLokalna(f ? URL.createObjectURL(f) : null);
                    }}
                  />
                </label>
                <button type="submit" className="portal-button" data-variant="secondary" disabled={slikaPending || !lokalna}>
                  {slikaPending ? "Obrada…" : "Postavite sliku"}
                </button>
                {slikaState.error ? <p className="portal-field-error" role="alert">{slikaState.error}</p> : null}
                {lokalna ? <small>Pregled pre otpremanja. Slika ulazi u članak tek posle „Postavite sliku“ i „Sačuvajte nacrt“.</small> : slikaState.slika ? <small role="status">Slika je obrađena i spremna. Sačuvajte nacrt da bi ušla u članak.</small> : null}
              </form>
            ) : null}
            <label className="portal-field">
              <span>Alternativni tekst {slika ? <b aria-hidden="true">*</b> : null}</span>
              <input value={alt} onChange={(e) => touch(setAlt)(e.target.value)} maxLength={240} disabled={!slika || !smeUredjivanje} placeholder="Šta se vidi na slici, npr. „Lakirer nanosi bezbojni lak pištoljem“" />
              <small>Za čitače ekrana i pretraživače. Obavezno kada članak ima sliku.</small>
            </label>
            {slika && smeUredjivanje ? (
              <button
                type="button"
                className="portal-button"
                data-variant="ghost"
                onClick={() => {
                  setSlika(null);
                  setLokalna(null);
                  setDirty(true);
                }}
              >
                Uklonite sliku iz članka
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <form action={action} className="cl-main-form">
        <input type="hidden" name="id" value={pocetno.id ?? ""} />
        <input type="hidden" name="osnova" value={pocetno.osnova} />
        <input type="hidden" name="sadrzaj" value={sadrzaj} />

        <section className="portal-panel">
          <div className="portal-section-header">
            <div>
              <h2>Tekst članka</h2>
              <p>Javni deo članka. Čuvanje pravi novu verziju; izmena teksta, slike ili izvora traži novo odobrenje.</p>
            </div>
          </div>
          <div className="portal-panel-body cl-fields">
            {pocetno.id ? null : (
              <div className="cl-row">
                <label className="portal-field">
                  <span>Vrsta</span>
                  <select name="tip" defaultValue={pocetno.tip}>
                    {tipovi.map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="portal-field">
                  <span>Tema</span>
                  <select name="kategorija" defaultValue={pocetno.kategorija}>
                    {kategorije.map((k) => (
                      <option key={k.slug} value={k.slug}>
                        {k.naziv}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
            <label className="portal-field">
              <span>
                Naslov <b aria-hidden="true">*</b>
              </span>
              <input value={naslov} onChange={(e) => touch(setNaslov)(e.target.value)} maxLength={140} required disabled={!smeUredjivanje} />
              <small>{naslov.length} / 140 · Promena naslova ne menja adresu članka.</small>
            </label>
            <label className="portal-field">
              <span>
                Kratak opis <b aria-hidden="true">*</b>
              </span>
              <textarea value={opis} onChange={(e) => touch(setOpis)(e.target.value)} maxLength={320} rows={3} required disabled={!smeUredjivanje} />
              <small>{opis.length} / 320 · Prikazuje se na spisku i u pretraživačima.</small>
            </label>
            <label className="portal-field">
              <span>Naslov za pretraživače (nije obavezno)</span>
              <input value={metaNaslov} onChange={(e) => touch(setMetaNaslov)(e.target.value)} maxLength={70} disabled={!smeUredjivanje} placeholder={naslov.slice(0, 70)} />
              <small>{metaNaslov.length} / 70 · Ako je prazno, koristi se naslov.</small>
            </label>
            {pocetno.slug ? (
              <div className="cl-address">
                <p>
                  Adresa: <code>/vodici/{pocetno.slug}</code>
                  {javno ? " (javna)" : ""}
                </p>
                {smeUredjivanje ? (
                  <label className="cl-check">
                    <input type="checkbox" name="promeniAdresu" value="da" checked={promeniAdresu} onChange={(e) => setPromeniAdresu(e.target.checked)} />
                    <span>Izričito promenite adresu (stara adresa trajno preusmerava na novu)</span>
                  </label>
                ) : null}
                {promeniAdresu ? (
                  <label className="portal-field">
                    <span>Nova adresa</span>
                    <input name="novaAdresa" defaultValue={pocetno.slug} pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={120} />
                    <small>Samo mala slova bez kvačica, brojevi i crtice.</small>
                  </label>
                ) : null}
              </div>
            ) : null}
            <div className="portal-field">
              <span id={teloId}>
                Tekst <b aria-hidden="true">*</b>
              </span>
              {smeUredjivanje ? (
                <RichEditor
                  initialHtml={initialHtml}
                  izvori={izvori.filter((i) => i.id && i.naziv)}
                  labelId={teloId}
                  onChange={(md) => {
                    setTelo(md);
                    setDirty(true);
                  }}
                />
              ) : (
                <div className="cl-content" dangerouslySetInnerHTML={{ __html: initialHtml }} />
              )}
            </div>
          </div>
        </section>

        <section className="portal-panel">
          <div className="portal-section-header">
            <div>
              <h2>Izvori</h2>
              <p>Prikazuju se ispod članka. Oznaka izvora u tekstu povezuje rečenicu sa izvorom.</p>
            </div>
          </div>
          <div className="portal-panel-body cl-sources">
            {izvori.map((izvor, i) => (
              <fieldset key={i} className="cl-source">
                <legend>Izvor {i + 1}</legend>
                <div className="cl-row">
                  <label className="portal-field">
                    <span>Oznaka</span>
                    <input value={izvor.id} onChange={(e) => setIzvor(i, { id: e.target.value.toLowerCase() })} disabled={!smeUredjivanje} />
                  </label>
                  <label className="portal-field cl-grow">
                    <span>Naziv dokumenta ili stranice</span>
                    <input value={izvor.naziv} onChange={(e) => setIzvor(i, { naziv: e.target.value })} disabled={!smeUredjivanje} />
                  </label>
                </div>
                <div className="cl-row">
                  <label className="portal-field cl-grow">
                    <span>Adresa (https://…)</span>
                    <input value={izvor.url ?? ""} onChange={(e) => setIzvor(i, { url: e.target.value })} disabled={!smeUredjivanje} />
                  </label>
                  <label className="portal-field">
                    <span>Vrsta</span>
                    <select value={izvor.tip} onChange={(e) => setIzvor(i, { tip: e.target.value })} disabled={!smeUredjivanje}>
                      {TIPOVI_IZVORA.map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                      {!TIPOVI_IZVORA.some(([k]) => k === izvor.tip) ? <option value={izvor.tip}>{izvor.tip}</option> : null}
                    </select>
                  </label>
                </div>
                <div className="cl-row">
                  <label className="portal-field">
                    <span>Verzija dokumenta</span>
                    <input value={izvor.verzija ?? ""} onChange={(e) => setIzvor(i, { verzija: e.target.value })} disabled={!smeUredjivanje} />
                  </label>
                  <DateField
                    name={`izvor-${i}-datum-izvora`}
                    label="Datum izvora"
                    value={izvor.datumIzvora ?? ""}
                    onChange={(iso) => setIzvor(i, { datumIzvora: iso })}
                    disabled={!smeUredjivanje}
                  />
                  <DateField
                    name={`izvor-${i}-pristupljeno`}
                    label="Pristupljeno"
                    value={izvor.pristupljeno}
                    onChange={(iso) => setIzvor(i, { pristupljeno: iso })}
                    required
                    disabled={!smeUredjivanje}
                  />
                </div>
                {smeUredjivanje ? (
                  <button
                    type="button"
                    className="portal-button"
                    data-variant="ghost"
                    data-size="sm"
                    onClick={() => {
                      setIzvori((list) => list.filter((_, j) => j !== i));
                      setDirty(true);
                    }}
                  >
                    Uklonite izvor
                  </button>
                ) : null}
              </fieldset>
            ))}
            {smeUredjivanje ? (
              <button
                type="button"
                className="portal-button"
                data-variant="secondary"
                onClick={() => {
                  setIzvori((list) => [...list, { id: `izvor-${list.length + 1}`, naziv: "", url: "", tip: "tehnicki-list", pristupljeno: danas() }]);
                  setDirty(true);
                }}
              >
                Dodajte izvor
              </button>
            ) : null}
          </div>
        </section>

        <section className="portal-panel cl-internal">
          <div className="portal-section-header">
            <div>
              <h2>Za internu proveru</h2>
              <p>Ne prikazuje se na sajtu. Izmena samo ovih polja ne poništava odobrenje.</p>
            </div>
          </div>
          <div className="portal-panel-body cl-fields">
            <label className="portal-field">
              <span>Nepotvrđene tehničke tvrdnje</span>
              <textarea value={nepotvrdjeno} onChange={(e) => touch(setNepotvrdjeno)(e.target.value)} rows={4} disabled={!smeUredjivanje} />
              <small>Šta u tekstu još nije potvrdio proizvođač ili stručna osoba. Prazno = nema poznatih nepotvrđenih tvrdnji.</small>
            </label>
            <label className="portal-field">
              <span>Interne napomene za proveru</span>
              <textarea value={napomene} onChange={(e) => touch(setNapomene)(e.target.value)} rows={6} disabled={!smeUredjivanje} />
            </label>
          </div>
        </section>

        {smeUredjivanje ? (
          <div className="cl-savebar">
            {state.error ? (
              <p className="portal-login-error" role="alert">
                {state.error}
              </p>
            ) : dirty ? (
              <p className="cl-dirty" role="status">
                Imate nesačuvane izmene.
              </p>
            ) : null}
            <button type="submit" className="portal-button" data-variant="primary" disabled={pending} onClick={() => setDirty(false)}>
              {pending ? "Čuvanje…" : pocetno.id ? "Sačuvajte nacrt" : "Napravite nacrt"}
            </button>
          </div>
        ) : null}
      </form>
    </div>
  );
}
