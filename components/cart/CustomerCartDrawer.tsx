"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { removeFromCartAction, setRequestPacksAction } from "@/app/kupac/korpa/actions";
import { money, percent, quantity } from "@/lib/ordering/panelFormat.mjs";
import type { CustomerCartPreview } from "@/lib/cart/customer-cart";
import styles from "./CustomerCartDrawer.module.css";

export function CustomerCartDrawer({ publicSiteOpen }: { publicSiteOpen: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [cart, setCart] = useState<CustomerCartPreview | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const request = useRef<AbortController | null>(null);
  const close = useCallback(() => setOpen(false), []);
  const load = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/kupac/korpa", { cache: "no-store", credentials: "same-origin", signal: controller.signal });
      if (!response.ok) throw new Error(response.status === 401 ? "Sesija je istekla. Prijavite se ponovo za pregled korpe." : "Korpa trenutno nije dostupna. Pokušajte ponovo.");
      const body: CustomerCartPreview = await response.json();
      if (controller.signal.aborted) return;
      setCart(body);
      window.dispatchEvent(new CustomEvent("cs-korpa", { detail: { count: body.lines.length } }));
    } catch (cause) {
      if (!controller.signal.aborted) {
        setCart(null);
        setError(cause instanceof Error ? cause.message : "Proverite vezu i pokušajte ponovo.");
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const show = () => { setCart(null); setOpen(true); };
    window.addEventListener("cs-open-cart", show);
    return () => window.removeEventListener("cs-open-cart", show);
  }, []);
  useEffect(close, [pathname, close]);
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    dialog.current?.showModal();
    document.body.style.overflow = "hidden";
    void load();
    const refresh = () => { setCart(null); void load(); };
    window.addEventListener("focus", refresh);
    return () => {
      request.current?.abort();
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("focus", refresh);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open, load]);

  async function remove(id: string) {
    if (!cart || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = cart.mode === "request"
        ? await setRequestPacksAction({ articleId: id, packs: "0" })
        : await removeFromCartAction(id);
      if (!result.ok) setError(result.message);
      else await load();
    } catch {
      setError("Izmena nije potvrđena. Osvežite korpu pre ponovnog pokušaja.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;
  return createPortal(
    <dialog ref={dialog} className={styles.drawer} aria-labelledby="customer-cart-title" onKeyDown={(event) => {
      if (event.key !== "Tab") return;
      const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), input:not(:disabled), [tabindex="0"]'));
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }} onCancel={close} onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
      <div className={styles.panel}>
        <header className={styles.header}>
          <div><p>Vaša porudžbina</p><h2 id="customer-cart-title">Korpa{cart ? <span> ({cart.lines.length})</span> : null}</h2></div>
          <button type="button" className={styles.close} onClick={close} aria-label="Zatvorite korpu" autoFocus>×</button>
        </header>
        <div className={styles.content} aria-busy={loading || busy}>
          {error ? <div role="alert" className={styles.error}><p>{error}</p><button type="button" onClick={() => void load()} disabled={loading}>Pokušajte ponovo</button><Link href="/kupac/korpa" onClick={close}>Otvorite pregled korpe</Link></div> : null}
          {loading && !cart ? <p role="status">Učitavamo Vašu korpu i odobrene cene…</p> : null}
          {cart?.lines.length === 0 ? <div className={styles.empty}><h3>Korpa je prazna</h3><p>Izaberite proizvode i dodajte potrebne količine.</p><Link href={publicSiteOpen ? "/katalog" : "/kupac/naruci"} onClick={close}>Pogledajte proizvode →</Link></div> : null}
          {cart && cart.lines.length > 0 ? <>
            <p className={styles.note}>{cart.label}. Cene po jedinici mere su bez PDV-a.</p>
            <ul className={styles.items}>{cart.lines.map((line) => <li key={line.id}>
              <div className={styles.itemHeading}><div><small>{line.code}</small><h3>{line.name}</h3></div><button type="button" onClick={() => void remove(line.id)} disabled={busy || loading} aria-label={`Uklonite ${line.name}`}>Uklonite</button></div>
              <dl className={styles.prices}>
                <div><dt>Količina</dt><dd>{quantity(line.quantity)} {line.unit}</dd></div>
                <div><dt>Osnovna / {line.unit}</dt><dd>{line.listPrice === null ? "Na upit" : money(line.listPrice)}</dd></div>
                <div><dt>Rabat</dt><dd>{line.discount === null ? "—" : percent(line.discount)}</dd></div>
                <div><dt>Vaša cena / {line.unit}</dt><dd>{line.price === null ? "Na upit" : money(line.price)}</dd></div>
                <div className={styles.lineTotal}><dt>Ukupno sa PDV-om</dt><dd>{line.total === null ? "Nije utvrđeno" : money(line.total)}</dd></div>
              </dl>
              {line.problem ? <p className={styles.error}>{line.problem}</p> : null}
            </li>)}</ul>
          </> : null}
        </div>
        <footer className={styles.footer}>
          {cart && cart.lines.length > 0 ? <>
            <div className={styles.total}><span>{cart.incomplete ? "Zbir poznatih cena" : "Ukupno sa PDV-om"}</span><strong>{cart.lines.every((line) => line.total === null) ? "Na upit" : money(cart.totals.gross)}</strong></div>
            {cart.incomplete ? <p className={styles.note}>Stavke bez potvrđenog iznosa nisu uračunate u zbir.</p> : null}
            <Link href="/kupac/korpa" className={styles.primary} onClick={close}>Pregled i slanje →</Link>
            <p className={styles.note}>U sledećem koraku izmenite količine, izaberite plaćanje i dopunite podatke za isporuku.</p>
          </> : null}
          <button type="button" className={styles.continue} onClick={close}>← Nastavite kupovinu</button>
          {publicSiteOpen ? <nav className={styles.links} aria-label="Nastavite pregled sajta"><Link href="/" onClick={close}>Početna</Link><Link href="/katalog" onClick={close}>Svi proizvodi</Link></nav> : null}
        </footer>
      </div>
    </dialog>, document.body,
  );
}
