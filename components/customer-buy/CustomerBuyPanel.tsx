"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { addCatalogItemAction } from "@/app/kupac/naruci/actions";
import { PICKED_EVENT } from "@/components/ordering/CompanionPanel";
import { requestPriceAction } from "@/app/kupac/upiti/actions";
import { useOptionalProductVariant } from "@/components/product/ProductVariantProvider";
import type { CatalogRequestOffer } from "@/lib/ordering/request-service";
import { money, unitLabel, useCustomerOffers, type OffersPayload } from "./useCustomerOffers";
import { isSinglePiece } from "@/lib/ordering/packRule.mjs";
import { offersForView } from "./offerStatus.mjs";
import styles from "./CustomerBuy.module.css";


/**
 * Kupovina na stranici proizvoda — samo za prijavljenog kupca.
 *
 * Varijanta se čita iz istog konteksta kao selektor, pa panel uvek prati
 * izabranu varijantu. Pakovanje je BizniSoft artikal vezan za tu varijantu;
 * cena je kupčeva (cenovnik + rabat), bez PDV-a, sa stopom PDV-a. Stanje iz
 * poslednjeg potvrđenog izvoza lagera ide u poseban blok, nezavisno od toga da li je
 * poručivanje uključeno (dok. 65 §4). Bez cene ili rabata → „Zatraži cenu/uslove".
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
    () => offersForView(data?.offers ?? [], slug, viewKeys),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, slug, viewKeys.join("|")],
  );
  // Pakovanja po nazivu sa brojevima (0,5L → 1L → 5L), ne po redosledu iz baze.
  const orderable = here
    .filter((o) => o.state === "orderable")
    .sort((a, b) => a.articleName.localeCompare(b.articleName, "sr", { numeric: true }));

  if (!data) return null;
  const procurement = here.length === 0 || here.every((o) => o.state === "inquiry");

  return (
    <section className={styles.panel} aria-labelledby="buy-panel-title">
      <header className={styles.panelHead}>
        <span className={styles.kicker}>Za Vašu firmu · {data.company}</span>
      </header>
      <h2 id="buy-panel-title" className={styles.panelTitle}>
        {name}
        {variantLabel ? <small> · {variantLabel}</small> : null}
      </h2>
      <StockBlock data={data} offers={here} />
      {!data.ordering.enabled ? (
        <>
          <p className={styles.note}>{data.ordering.reason ?? "Poručivanje preko sajta još nije uključeno."} Cenu i uslove možete zatražiti ovde.</p>
          <PriceRequest data={data} slug={slug} variantKey={variantKey} articleCode={null} kind="no_price" />
        </>
      ) : orderable.length > 0 ? (
        <BuyForm key={`${slug}|${variantKey}`} data={data} offers={orderable} slug={slug} variantKey={variantKey} />
      ) : (
        <>
          {/* Bez potvrđene ponude (nije povezano ili samo upit za nabavku) → upit za nabavku; inače upit za cenu. */}
          <p className={styles.note}>
            {procurement
              ? "Ovaj proizvod trenutno nije u našoj ponudi za direktno poručivanje (nije na lageru ili ga nismo uvozili). Pošaljite upit za nabavku — kancelarija proverava nabavku, cenu i rok."
              : here.some((o) => o.state === "no_pack")
                ? "Cena na upit: pakovanje (zapremina) ovog artikla još nije potvrđeno, pa se ne poručuje preko sajta. Pošaljite zahtev — javiće Vam se komercijalista ili kancelarija."
                : "Cena na upit: za ovaj artikal Vaša cena još nije potvrđena. Pošaljite zahtev — javiće Vam se komercijalista ili kancelarija."}
          </p>
          <PriceRequest
            data={data}
            slug={slug}
            variantKey={variantKey}
            articleCode={here[0]?.articleCode ?? null}
            kind={procurement ? "procurement" : "no_price"}
          />
        </>
      )}
    </section>
  );
}

/**
 * Stanje po pakovanju ove varijante. Broj samo za potvrđeno pakovanje iz svežeg snimka;
 * inače „Raspoloživost na upit“. Zastareo snimak → samo poruka o proveri, bez brojeva.
 */
function StockBlock({ data, offers }: { data: OffersPayload; offers: CatalogRequestOffer[] }) {
  const stock = data.stock;
  if (!stock || offers.length === 0) return null;
  const rows = offers
    .filter((o) => o.state !== "inquiry")
    .sort((a, b) => a.articleName.localeCompare(b.articleName, "sr", { numeric: true }));
  return (
    <section className={styles.stock} data-state={stock.state} aria-label="Stanje na lageru">
      {stock.state === "svez" && rows.length > 0 ? (
        <ul className={styles.stockList}>
          {rows.map((o) => {
            const line = stock.byArticle[o.articleId] ?? { state: "upit" as const, text: "Raspoloživost na upit" };
            const label = o.pack ? (isSinglePiece(o.pack, o.unit) ? `1 ${unitLabel(o.unit)}` : o.pack.label) : null;
            return (
              <li key={o.articleId} data-state={line.state}>
                {rows.length > 1 && label ? <span className={styles.stockPack}>{label}</span> : null}
                <strong>{line.text}</strong>
              </li>
            );
          })}
        </ul>
      ) : stock.state === "svez" ? (
        <p className={styles.stockLead}>Raspoloživost na upit</p>
      ) : null}
      <p className={styles.stockCaption}>
        {stock.headline} {stock.note}
      </p>
    </section>
  );
}

function BuyForm({ data, offers, slug, variantKey }: { data: OffersPayload; offers: CatalogRequestOffer[]; slug: string; variantKey: string | null }) {
  const [id, setId] = useState(offers[0].articleId);
  const offer = offers.find((o) => o.articleId === id) ?? offers[0];
  const pack = offer.pack!;
  const [packs, setPacks] = useState("1");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [askTerms, setAskTerms] = useState(false);
  useEffect(() => {
    setMsg(null);
    setPacks("1");
  }, [id]);
  const unit = unitLabel(offer.unit);
  // Samo ODOBRENE opcije kupca, istim redom kao u korpi.
  const prices = data.options.map((o) => ({ option: o, price: offer.byOption[o.key] })).filter((x) => x.price);
  const n = /^\d{1,3}$/.test(packs.trim()) && Number(packs) >= 1 ? Number(packs) : null;
  const billing = n !== null ? Math.round(n * pack.quantity * 1000) / 1000 : null;
  // Jedan komad = jedno pakovanje: obračun je isti broj, ne ponavlja se.
  const single = isSinglePiece(pack, offer.unit);

  const add = () =>
    start(async () => {
      const r = await addCatalogItemAction({ articleId: offer.articleId, packs: packs.trim() });
      setMsg(r.ok ? { ok: true, text: `Dodato u korpu (${r.count} ${r.count === 1 ? "stavka" : "stavke"}).` } : { ok: false, text: r.message });
      if (r.ok) {
        window.dispatchEvent(new CustomEvent("cs-korpa", { detail: { count: r.count } }));
        window.dispatchEvent(new CustomEvent(PICKED_EVENT, { detail: { articleId: offer.articleId, packs: Number(packs.trim()) || 1 } }));
      }
    });

  return (
    <div className={styles.buy}>
      <fieldset className={styles.packs}>
        <legend>Pakovanje</legend>
        {offers.map((o) => {
          const first = data.options.map((x) => o.byOption[x.key]).find((p) => p?.status === "cena");
          return (
            <label key={o.articleId} className={styles.pack} data-active={o.articleId === offer.articleId ? "true" : undefined}>
              <input type="radio" name={`pack-${slug}-${variantKey ?? ""}`} value={o.articleId} checked={o.articleId === offer.articleId} onChange={() => setId(o.articleId)} />
              <span>
                {/* Kupac vidi potvrđeno pakovanje i šifru; interni BizniSoft naziv (npr. „… 400ML“) vidi samo kancelarija. */}
                <strong>{isSinglePiece(o.pack, o.unit) ? `1 ${unitLabel(o.unit)}` : o.pack?.label}</strong>
                <small>šifra {o.articleCode}</small>
              </span>
              <span className={styles.packPrice}>
                {first && first.status === "cena" && first.packAmounts ? (
                  <>
                    {money.format(first.packAmounts.net)} RSD
                    <small>bez PDV-a / pakovanje</small>
                  </>
                ) : (
                  <small>na upit</small>
                )}
              </span>
            </label>
          );
        })}
      </fieldset>

      <dl className={styles.priceFacts} aria-label="Vaša cena pakovanja po opciji plaćanja">
        {prices.map(({ option, price }) =>
          price.status === "cena" && price.packAmounts ? (
            <div key={option.key}>
              <dt>
                {option.label}
                {option.note ? <small> · {option.note}</small> : null}
              </dt>
              <dd>
                <strong>
                  {money.format(price.packAmounts.net)} RSD / {pack.label}
                </strong>{" "}
                bez PDV-a · {money.format(price.packAmounts.gross)} RSD sa PDV-om ({money.format(price.vatPercent)} %)
                <small>
                  {single ? "" : `${money.format(price.netPrice)} RSD / ${unit} · `}
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
          <span>{single ? `Količina (${unit})` : `Broj pakovanja (${pack.label})`}</span>
          <input type="number" inputMode="numeric" min={1} step={1} value={packs} onChange={(e) => setPacks(e.target.value)} disabled={pending} />
        </label>
        <button type="button" className={styles.add} onClick={add} disabled={pending} aria-busy={pending}>
          {pending ? "Dodajem…" : "Dodajte u korpu"}
        </button>
      </div>
      {billing !== null && !single ? (
        <p className={styles.fine} data-billing>
          {n} × {pack.label} = {String(billing).replace(".", ",")} {unit} u obračunu
        </p>
      ) : null}
      {msg ? (
        <p className={styles.msg} data-ok={msg.ok ? "true" : "false"} role="status">
          {msg.text} {msg.ok ? <Link href="/kupac/korpa">Otvorite korpu →</Link> : null}
        </p>
      ) : null}
      <p className={styles.fine}>
        {single
          ? "Cena je po komadu, kako je vodi BizniSoft. "
          : `Poručuju se cela pakovanja. Cenovnik vodi cenu po ${unit}; cena pakovanja = ${String(pack.quantity).replace(".", ",")} ${unit} × cena po ${unit}. `}
        Opciju plaćanja birate u korpi, za ceo zahtev. Raspoloživost i rok isporuke potvrđuje kancelarija; zahtev nije rezervacija ni faktura.
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
  kind: "no_price" | "special_terms" | "procurement";
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
      <h3>{kind === "special_terms" ? "Zatražite posebne uslove" : kind === "procurement" ? "Upit za nabavku" : "Zatražite cenu/uslove"}</h3>
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
        {pending ? "Šaljem…" : kind === "special_terms" ? "Pošaljite zahtev za uslove" : kind === "procurement" ? "Pošaljite upit za nabavku" : "Zatražite cenu/uslove"}
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
