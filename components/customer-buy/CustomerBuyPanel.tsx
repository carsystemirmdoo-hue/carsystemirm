"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { addCatalogItemAction } from "@/app/kupac/naruci/actions";
import { requestPriceAction } from "@/app/kupac/upiti/actions";
import { useOptionalProductVariant } from "@/components/product/ProductVariantProvider";
import type { CatalogRequestOffer } from "@/lib/ordering/request-service";
import { money, unitLabel, useCustomerOffers, withVat, type OffersPayload } from "./useCustomerOffers";
import styles from "./CustomerBuy.module.css";

const same = (a: string | null | undefined, b: string | null | undefined) => Boolean(a && b && a.toLowerCase() === b.toLowerCase());

/**
 * Kupovina na stranici proizvoda — samo za prijavljenog kupca.
 *
 * Varijanta se čita iz istog konteksta kao selektor, pa panel uvek prati
 * izabranu varijantu. Pakovanje je BizniSoft artikal vezan za tu varijantu;
 * cena je kupčeva (cenovnik + rabat), bez PDV-a, sa stopom PDV-a. Lager se ne
 * prikazuje: izvor ne postoji. Bez cene ili rabata → „Zatraži cenu/uslove".
 */
export function CustomerBuyPanel({ fallbackSlug, fallbackName }: { fallbackSlug: string; fallbackName: string }) {
  const data = useCustomerOffers();
  const ctx = useOptionalProductVariant();
  const view = ctx?.activeVariant ?? null;
  const slug = view?.slug ?? fallbackSlug;
  const name = view?.name ?? fallbackName;
  const viewKeys = [view?.key, view?.id, view?.sku].filter(Boolean) as string[];
  const variantKey = view && view.key !== view.slug ? view.key : null;
  const variantLabel = view?.shadeLabel ?? null;

  const here = useMemo(
    () =>
      (data?.offers ?? []).filter(
        (o) => o.slug === slug && (o.variantKey === null || viewKeys.some((k) => same(k, o.variantKey))),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, slug, viewKeys.join("|")],
  );
  const orderable = here.filter((o) => o.state === "orderable");

  if (!data) return null;

  return (
    <section className={styles.panel} aria-labelledby="buy-panel-title">
      <header className={styles.panelHead}>
        <span className={styles.kicker}>Za Vašu firmu · {data.company}</span>
      </header>
      <h2 id="buy-panel-title" className={styles.panelTitle}>
        {name}
        {variantLabel ? <small> · {variantLabel}</small> : null}
      </h2>
      {!data.ordering.enabled ? (
        <>
          <p className={styles.note}>{data.ordering.reason ?? "Poručivanje preko sajta još nije uključeno."} Cenu i uslove možete zatražiti ovde.</p>
          <PriceRequest data={data} slug={slug} variantKey={variantKey} articleCode={null} kind="no_price" />
        </>
      ) : orderable.length > 0 ? (
        <BuyForm key={`${slug}|${variantKey}`} data={data} offers={orderable} slug={slug} variantKey={variantKey} />
      ) : (
        <>
          <p className={styles.note}>
            {here.length > 0
              ? "Cena na upit: za ovaj artikal Vaša cena još nije potvrđena."
              : "Cena na upit: ovaj proizvod još nije povezan sa našim šifrarnikom."}{" "}
            Pošaljite zahtev — javiće Vam se komercijalista ili kancelarija.
          </p>
          <PriceRequest data={data} slug={slug} variantKey={variantKey} articleCode={here[0]?.articleCode ?? null} kind="no_price" />
        </>
      )}
    </section>
  );
}

function BuyForm({ data, offers, slug, variantKey }: { data: OffersPayload; offers: CatalogRequestOffer[]; slug: string; variantKey: string | null }) {
  const [id, setId] = useState(offers[0].articleId);
  const offer = offers.find((o) => o.articleId === id) ?? offers[0];
  const [qty, setQty] = useState(String(offer.step));
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [askTerms, setAskTerms] = useState(false);
  useEffect(() => {
    setMsg(null);
    setQty(String(offer.step));
  }, [id, offer.step]);
  const unit = unitLabel(offer.unit);
  // Samo ODOBRENE opcije kupca, istim redom kao u korpi.
  const prices = data.options.map((o) => ({ option: o, price: offer.byOption[o.key] })).filter((x) => x.price);

  const add = () =>
    start(async () => {
      const r = await addCatalogItemAction({ articleId: offer.articleId, quantity: qty });
      setMsg(r.ok ? { ok: true, text: `Dodato u korpu (${r.count} ${r.count === 1 ? "stavka" : "stavke"}).` } : { ok: false, text: r.message });
      if (r.ok) window.dispatchEvent(new CustomEvent("cs-korpa", { detail: { count: r.count } }));
    });

  return (
    <div className={styles.buy}>
      <fieldset className={styles.packs}>
        <legend>Pakovanje (BizniSoft artikal)</legend>
        {offers.map((o) => {
          const first = data.options.map((x) => o.byOption[x.key]).find((p) => p?.status === "cena");
          return (
            <label key={o.articleId} className={styles.pack} data-active={o.articleId === offer.articleId ? "true" : undefined}>
              <input type="radio" name={`pack-${slug}-${variantKey ?? ""}`} value={o.articleId} checked={o.articleId === offer.articleId} onChange={() => setId(o.articleId)} />
              <span>
                <strong>{o.articleName}</strong>
                <small>
                  šifra {o.articleCode} · cena po {unitLabel(o.unit)}
                </small>
              </span>
              <span className={styles.packPrice}>
                {first && first.status === "cena" ? (
                  <>
                    {money.format(first.netPrice)} RSD
                    <small>bez PDV-a / {unitLabel(o.unit)}</small>
                  </>
                ) : (
                  <small>na upit</small>
                )}
              </span>
            </label>
          );
        })}
      </fieldset>

      <dl className={styles.priceFacts} aria-label="Vaša cena po opciji plaćanja">
        {prices.map(({ option, price }) =>
          price.status === "cena" ? (
            <div key={option.key}>
              <dt>
                {option.label}
                {option.note ? <small> · {option.note}</small> : null}
              </dt>
              <dd>
                <strong>
                  {money.format(price.netPrice)} RSD / {unit}
                </strong>{" "}
                bez PDV-a · {money.format(withVat(price.netPrice, price.vatPercent))} RSD sa PDV-om ({money.format(price.vatPercent)} %)
                <small>
                  {price.discountPercent
                    ? `osnovna ${money.format(price.listPrice)} − rabat ${money.format(price.discountPercent)} %`
                    : "osnovna cena, ugovoreni rabat 0 %"}
                </small>
              </dd>
            </div>
          ) : (
            <div key={option.key}>
              <dt>{option.label}</dt>
              <dd>na upit</dd>
            </div>
          ),
        )}
      </dl>

      <div className={styles.row}>
        <label className={styles.qty}>
          <span>Količina ({unit})</span>
          <input type="number" inputMode="decimal" min={offer.step} step={offer.step} value={qty} onChange={(e) => setQty(e.target.value)} disabled={pending} />
        </label>
        <button type="button" className={styles.add} onClick={add} disabled={pending} aria-busy={pending}>
          {pending ? "Dodajem…" : "Dodajte u korpu"}
        </button>
      </div>
      {msg ? (
        <p className={styles.msg} data-ok={msg.ok ? "true" : "false"} role="status">
          {msg.text} {msg.ok ? <Link href="/kupac/korpa">Otvorite korpu →</Link> : null}
        </p>
      ) : null}
      <p className={styles.fine}>
        Cena važi za {unit} kako je vodi BizniSoft. Opciju plaćanja birate u korpi, za ceo zahtev. Raspoloživost i rok isporuke potvrđuje kancelarija;
        zahtev nije rezervacija ni faktura.
      </p>
      {prices.every((x) => x.price.status !== "cena" || x.price.discountPercent === 0) ? (
        askTerms ? (
          <PriceRequest data={data} slug={slug} variantKey={variantKey} articleCode={offer.articleCode} kind="special_terms" />
        ) : (
          <button type="button" className={styles.link} onClick={() => setAskTerms(true)}>
            Nemate ugovoren rabat za ovaj proizvod? Zatražite posebne uslove →
          </button>
        )
      ) : null}
    </div>
  );
}

function PriceRequest({
  data,
  slug,
  variantKey,
  articleCode,
  kind,
}: {
  data: OffersPayload;
  slug: string;
  variantKey: string | null;
  articleCode: string | null;
  kind: "no_price" | "special_terms";
}) {
  const [key] = useState(() => crypto.randomUUID());
  const [qty, setQty] = useState("1");
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const send = () =>
    start(async () => {
      const r = await requestPriceAction({ slug, variantKey, articleCode, quantity: qty, note, kind, idempotencyKey: key });
      if (r.ok) setDone(r.requestNumber);
      else setError(r.message);
    });
  const reps = data.contacts.reps;

  if (done) {
    return (
      <div className={styles.request} data-done="true" role="status">
        <p>
          <strong>Zahtev {done} je poslat.</strong> Odgovor stiže u <Link href="/kupac/upiti">Moj nalog → Upiti</Link>.
        </p>
        <Contacts data={data} />
      </div>
    );
  }
  return (
    <div className={styles.request}>
      <h3>{kind === "special_terms" ? "Zatražite posebne uslove" : "Zatražite cenu/uslove"}</h3>
      <div className={styles.row}>
        <label className={styles.qty}>
          <span>Količina</span>
          <input type="number" inputMode="decimal" min="0.001" step="any" value={qty} onChange={(e) => setQty(e.target.value)} disabled={pending} />
        </label>
        <label className={styles.noteField}>
          <span>Napomena (nije obavezno)</span>
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} disabled={pending} placeholder="npr. mesečna potrošnja, pakovanje" />
        </label>
      </div>
      <button type="button" className={styles.add} onClick={send} disabled={pending} aria-busy={pending}>
        {pending ? "Šaljem…" : kind === "special_terms" ? "Pošaljite zahtev za uslove" : "Zatražite cenu/uslove"}
      </button>
      {error ? (
        <p className={styles.msg} data-ok="false" role="alert">
          {error}
        </p>
      ) : null}
      {reps.length || data.contacts.office ? <Contacts data={data} /> : null}
    </div>
  );
}

function Contacts({ data }: { data: OffersPayload }) {
  return (
    <p className={styles.contacts}>
      {data.contacts.reps.length ? (
        <>
          Vaš komercijalista:{" "}
          {data.contacts.reps.map((r, i) => (
            <span key={r.email}>
              {i ? ", " : ""}
              <strong>{r.name}</strong> · <a href={`mailto:${r.email}`}>{r.email}</a>
            </span>
          ))}
          <br />
        </>
      ) : null}
      Kancelarija:{" "}
      {data.contacts.office.phone && data.contacts.office.phoneHref ? (
        <>
          <a href={data.contacts.office.phoneHref}>{data.contacts.office.phone}</a> ·{" "}
        </>
      ) : null}
      <a href={data.contacts.office.emailHref}>{data.contacts.office.email}</a>
      {data.contacts.office.workingHours ? <> · {data.contacts.office.workingHours}</> : null}
    </p>
  );
}
