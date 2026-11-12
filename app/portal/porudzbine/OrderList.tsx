"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { IncomingOrder } from "@/lib/procurement/incoming-service";
import { leadLabel, stavki } from "@/lib/procurement/incoming.mjs";
import { changeLineAction, closeOrderAction, searchArticlesAction } from "./actions";
import styles from "./Porudzbine.module.css";

const fmt = (n: number) => n.toLocaleString("sr-Latn-RS", { maximumFractionDigits: 3 });
const dmy = (d: string | null) => (d ? `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}.` : "—");
const SOURCE: Record<string, string> = { excel: "iz Excela", rucno: "ručni unos", nabavka: "iz Nabavke" };

function LinkArticle({ onPick }: { onPick: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<{ id: string; code: string; name: string }[]>([]);
  return (
    <div className={styles.search}>
      <input
        className={styles.pick}
        value={q}
        placeholder="Poveži: naša šifra ili naziv…"
        onChange={async (e) => {
          setQ(e.target.value);
          setRes(e.target.value.trim().length >= 2 ? await searchArticlesAction(e.target.value) : []);
        }}
      />
      {res.length ? (
        <div className={styles.results}>
          {res.map((a) => (
            <button key={a.id} type="button" className={styles.result} onClick={() => onPick(a.id)}>
              <span className={styles.code}>{a.code}</span> {a.name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Order({ o, canEdit }: { o: IncomingOrder; canEdit: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; text: string }>) =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? null : r.text);
      router.refresh();
    });
  const open = o.status === "otvoreno";
  const waiting = o.lines.filter((l) => l.status === "ceka").length;
  const badge = open ? o.countdown.state : o.status;
  return (
    <section className={styles.order}>
      <div className={styles.orderHead}>
        <div>
          <span className={styles.orderTitle}>{o.supplier}</span>
          {o.reference ? <span className={styles.muted}> · {o.reference}</span> : null}
          <span className={styles.sub}>
            Poručeno {dmy(o.orderedOn)} · rok {leadLabel(o.leadMin, o.leadMax)} (očekuje se {o.leadMin > 0 ? `${dmy(o.countdown.expectedFrom)}–` : "do "}
            {dmy(o.countdown.expectedTo)}) · {SOURCE[o.source] ?? o.source} · {o.createdBy}
            {o.note ? ` · ${o.note}` : ""}
          </span>
        </div>
        <div className={styles.actions}>
          <span className={styles.badge} data-s={badge}>
            {open ? o.countdown.label : o.status === "zatvoreno" ? `stiglo ${dmy(o.closedAt?.slice(0, 10) ?? null)}` : "otkazano"}
          </span>
          {open && canEdit ? (
            <>
              <button type="button" className={`${styles.button} ${styles.mini}`} disabled={pending} onClick={() => run(() => closeOrderAction({ orderId: o.id, action: "zatvoreno" }))}>
                Sve stiglo
              </button>
              <button
                type="button"
                className={`${styles.button} ${styles.mini}`}
                disabled={pending}
                onClick={() => {
                  if (window.confirm(`Otkazati celu porudžbinu (čeka ${stavki(waiting)})?`)) run(() => closeOrderAction({ orderId: o.id, action: "otkazano" }));
                }}
              >
                Otkaži
              </button>
            </>
          ) : null}
        </div>
      </div>
      {msg ? <p className={styles.hint}><span className={styles.msg} data-ok="false">{msg}</span></p> : null}
      <div className={styles.tablewrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Artikal</th>
              <th scope="col">Šifra dobavljača</th>
              <th scope="col" className={styles.num}>Poručeno</th>
              <th scope="col" className={styles.num}>Stiglo</th>
              <th scope="col" className={styles.num}>Lager sada</th>
              <th scope="col">Stanje</th>
              {canEdit && open ? <th scope="col" aria-label="Akcije" /> : null}
            </tr>
          </thead>
          <tbody>
            {o.lines.map((l) => (
              <tr key={l.id} className={l.status === "ceka" ? undefined : styles.done}>
                <td>
                  {l.articleId ? (
                    <>
                      <span className={styles.code}>{l.articleCode}</span> {l.articleName}
                    </>
                  ) : (
                    <>
                      <span className={styles.warn}>nije povezano</span>
                      <span className={styles.sub}>{l.supplierName}</span>
                      {canEdit && l.status === "ceka" ? <LinkArticle onPick={(id) => run(() => changeLineAction({ lineId: l.id, action: "povezi", articleId: id }))} /> : null}
                    </>
                  )}
                </td>
                <td>
                  {l.supplierCode ? <span className={styles.code}>{l.supplierCode}</span> : "—"}
                  {l.articleId && l.supplierName && l.supplierName !== l.articleName ? <span className={styles.sub}>{l.supplierName}</span> : null}
                </td>
                <td className={styles.num}>
                  {fmt(l.quantity)} {l.unit ?? ""}
                </td>
                <td className={styles.num}>{l.received > 0 ? fmt(l.received) : "—"}</td>
                <td className={styles.num}>{l.stockNow === null ? "—" : fmt(l.stockNow)}</td>
                <td>
                  {l.status === "stiglo" ? (
                    <span className={styles.okc}>stiglo {dmy(l.arrivedAt?.slice(0, 10) ?? null)}</span>
                  ) : l.status === "otkazano" ? (
                    <span className={styles.muted}>otkazano</span>
                  ) : l.received > 0 ? (
                    <span className={styles.warn}>
                      stiglo {fmt(l.received)} od {fmt(l.quantity)}
                    </span>
                  ) : (
                    <span className={styles.muted}>čeka</span>
                  )}
                </td>
                {canEdit && open ? (
                  <td>
                    {l.status === "ceka" ? (
                      <div className={styles.actions}>
                        <button type="button" className={`${styles.button} ${styles.mini}`} disabled={pending} onClick={() => run(() => changeLineAction({ lineId: l.id, action: "stiglo" }))}>
                          Stiglo
                        </button>
                        <button type="button" className={`${styles.button} ${styles.mini}`} disabled={pending} onClick={() => run(() => changeLineAction({ lineId: l.id, action: "otkazano" }))}>
                          Otkaži
                        </button>
                      </div>
                    ) : (
                      <button type="button" className={`${styles.button} ${styles.mini}`} disabled={pending} onClick={() => run(() => changeLineAction({ lineId: l.id, action: "vrati" }))}>
                        Vrati na čekanje
                      </button>
                    )}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function OrderList({ orders, canEdit, stockDate }: { orders: IncomingOrder[]; canEdit: boolean; stockDate: string | null }) {
  const open = orders.filter((o) => o.status === "otvoreno");
  const closed = orders.filter((o) => o.status !== "otvoreno");
  const late = open.filter((o) => o.countdown.state === "kasni").length;
  return (
    <>
      <div className={styles.panel}>
        <div className={styles.head}>
          <h2>
            U dolasku ({open.length}){late ? <span className={styles.warn}> · kasni {late}</span> : null}
          </h2>
          <span className={styles.muted}>
            Stavka se zatvara sama kada potvrđen lager pokaže veće stanje artikla. Važeći lager: {dmy(stockDate)}
          </span>
        </div>
        {open.length ? open.map((o) => <Order key={o.id} o={o} canEdit={canEdit} />) : <p className={styles.empty}>Nema robe u dolasku.</p>}
      </div>
      {closed.length ? (
        <details className={`${styles.panel} closed`}>
          <summary>Stiglo ili otkazano u poslednjih 30 dana ({closed.length})</summary>
          {closed.map((o) => (
            <Order key={o.id} o={o} canEdit={false} />
          ))}
        </details>
      ) : null}
    </>
  );
}
