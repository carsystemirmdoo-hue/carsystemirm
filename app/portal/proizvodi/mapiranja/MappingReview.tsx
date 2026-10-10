"use client";

import { useActionState, useState, useTransition } from "react";
import { Badge, Field, PortalButton } from "@/components/portal/PortalPrimitives";
import {
  decideMappingAction,
  describeCatalogTargetAction,
  proposeMappingAction,
  type MappingActionState,
} from "@/app/portal/proizvodi/mapiranja/actions";
import {
  PRODUCT_MAPPING_LABELS,
  PRODUCT_MAPPING_TONES,
} from "@/lib/portal/status-labels";

const INITIAL: MappingActionState = { error: null, ok: null };

export type MappingRow = {
  articleId: string;
  articleCode: string;
  articleName: string;
  brand: string | null;
  productGroup: string | null;
  status: string;
  catalogProductSlug: string | null;
  catalogVariantId: string | null;
  note: string | null;
  conflictReason: string | null;
  orderable: boolean;
  orderReason: string | null;
  catalogName: string | null;
  variantLabel: string | null;
};

type Target = Awaited<ReturnType<typeof describeCatalogTargetAction>>;

export function MappingReview({
  rows,
  canManage,
}: {
  rows: MappingRow[];
  canManage: boolean;
}) {
  const [proposeState, proposeAction, proposing] = useActionState(
    proposeMappingAction,
    INITIAL,
  );
  const [decideState, decideAction, deciding] = useActionState(
    decideMappingAction,
    INITIAL,
  );
  const [openId, setOpenId] = useState<string | null>(null);

  const message = decideState.ok ?? proposeState.ok;
  const error = decideState.error ?? proposeState.error;
  const open = rows.find((row) => row.articleId === openId) ?? null;

  if (rows.length === 0) {
    return (
      <section className="portal-panel">
        <p>Za izabrani filter nema nijednog artikla.</p>
      </section>
    );
  }

  return (
    <section className="portal-panel">
      {error ? (
        <div className="portal-login-error" role="alert">
          <span>
            <strong>Radnja nije izvršena</strong>
            <small>{error}</small>
          </span>
        </div>
      ) : null}
      {message ? (
        <p className="portal-login-hint" role="status">
          {message}
        </p>
      ) : null}

      <div className="portal-table-wrap">
        <table className="portal-table">
          <thead>
            <tr>
              <th scope="col">Šifra artikla</th>
              <th scope="col">Naziv</th>
              <th scope="col">Brend / grupa</th>
              <th scope="col">Kataloški proizvod</th>
              <th scope="col">Stanje</th>
              <th scope="col">Za poručivanje</th>
              {canManage ? <th scope="col">Radnja</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.articleId}>
                <td>
                  <strong>{row.articleCode}</strong>
                </td>
                <td>{row.articleName}</td>
                <td>
                  {row.brand ?? "—"}
                  <small>{row.productGroup ?? "bez grupe"}</small>
                </td>
                <td>
                  {row.status === "mapped" && row.catalogProductSlug ? (
                    <>
                      <strong>{row.catalogName ?? row.catalogProductSlug}</strong>
                      <small>{row.catalogProductSlug}</small>
                      {row.catalogVariantId ? (
                        <small>
                          varijanta: {row.variantLabel ? `${row.variantLabel} (${row.catalogVariantId})` : row.catalogVariantId}
                        </small>
                      ) : null}
                    </>
                  ) : row.catalogProductSlug ? (
                    <>
                      {row.catalogProductSlug}
                      {/*
                        * Predložena veza NE otvara ni sliku ni PDP. Prikazuje se
                        * kao kandidat, i to mora biti vidljivo iz same ćelije.
                        */}
                      <small>samo predlog — bez slike i bez PDP-a</small>
                    </>
                  ) : (
                    <>
                      —
                      <small>artikal ostaje vidljiv interno</small>
                    </>
                  )}
                </td>
                <td>
                  <Badge tone={PRODUCT_MAPPING_TONES[row.status] ?? "neutral"}>
                    {PRODUCT_MAPPING_LABELS[row.status] ?? row.status}
                  </Badge>
                  {row.conflictReason ? <small>{row.conflictReason}</small> : null}
                  {row.note ? <small>{row.note}</small> : null}
                </td>
                <td>
                  <Badge tone={row.orderable ? "success" : "neutral"}>{row.orderable ? "Poručivo" : "Nije poručivo"}</Badge>
                  {row.orderReason ? <small>{row.orderReason}</small> : null}
                </td>
                {canManage ? (
                  <td>
                    <div className="portal-cell-actions">
                      <form action={proposeAction}>
                        <input type="hidden" name="articleId" value={row.articleId} />
                        <PortalButton type="submit" variant="ghost" disabled={proposing}>
                          Predložite po šifri
                        </PortalButton>
                      </form>
                      <PortalButton
                        variant="ghost"
                        onClick={() =>
                          setOpenId(openId === row.articleId ? null : row.articleId)
                        }
                      >
                        {openId === row.articleId ? "Zatvorite" : "Odlučite"}
                      </PortalButton>
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canManage && open ? (
        <form action={decideAction} className="portal-form">
          <input type="hidden" name="articleId" value={open.articleId} />
          <h3>
            {open.articleCode} — {open.articleName}
          </h3>
          <Field label="Odluka" required>
            <select name="status" defaultValue="mapped" required>
              <option value="mapped">Potvrdite vezu</option>
              {/*
                * Odbijanje i poništavanje su različiti događaji i ne nude se
                * zajedno: predlog se odbija, potvrđena veza se poništava.
                * Ponuda oba iz istog stanja bi značila da razlika zavisi od
                * toga šta je korisnik slučajno izabrao.
                */}
              {open.status === "mapped" ? (
                <option value="revoked">Poništite potvrđenu vezu</option>
              ) : (
                <option value="rejected">Odbijte predlog</option>
              )}
              <option value="unmapped">Vratite u nemapirano</option>
            </select>
          </Field>
          <CatalogTargetPicker key={open.articleId} slug={open.catalogProductSlug} variant={open.catalogVariantId} />
          <Field label="Razlog" required hint="Upisuje se u trag revizije.">
            <input type="text" name="note" minLength={3} maxLength={500} required />
          </Field>
          <PortalButton type="submit" disabled={deciding}>
            {deciding ? "Čuvanje…" : "Sačuvajte odluku"}
          </PortalButton>
        </form>
      ) : null}
    </section>
  );
}

/**
 * Izbor tačnog kataloškog proizvoda i varijante.
 *
 * Slug se proverava na serveru i prikazuje se naziv i slika — da čovek vidi
 * ŠTA potvrđuje. Varijanta se bira sa spiska redova tog proizvoda; slobodan
 * unos ne postoji, pa ni pogrešno otkucana oznaka. Server pri čuvanju proverava
 * isto još jednom.
 */
function CatalogTargetPicker({ slug, variant }: { slug: string | null; variant: string | null }) {
  const [value, setValue] = useState(slug ?? "");
  const [target, setTarget] = useState<Target | undefined>(undefined);
  const [pending, start] = useTransition();
  const check = () => start(async () => setTarget(await describeCatalogTargetAction(value)));

  return (
    <>
      <Field label="Slug kataloškog proizvoda" hint="Obavezno pri potvrdi. Proverite pre čuvanja: vidi se naziv, slika i varijante.">
        <span style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            name="catalogProductSlug"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setTarget(undefined);
            }}
            maxLength={200}
          />
          <PortalButton variant="ghost" onClick={check} disabled={pending || !value.trim()}>
            {pending ? "Proveravam…" : "Proverite"}
          </PortalButton>
        </span>
      </Field>
      {target === null ? (
        <p className="portal-login-error" role="alert">
          <span>
            <strong>Proizvod ne postoji u katalogu.</strong>
          </span>
        </p>
      ) : null}
      {target ? (
        <div className="mp-target">
          {target.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={target.image.src} alt="" width={56} height={56} />
          ) : null}
          <span>
            <strong>{target.name}</strong>
            <small>{target.slug}</small>
            <small>
              {target.variants.length > 1
                ? `${target.variants.length} varijanti — izbor je obavezan`
                : "Proizvod bez varijanti-redova"}
            </small>
          </span>
        </div>
      ) : null}
      {target && target.variants.length > 1 ? (
        <Field label="Varijanta" required hint="Tačan red iz tabele šifara proizvoda.">
          <select name="catalogVariantId" defaultValue={variant ?? ""} required>
            <option value="" disabled>
              Izaberite varijantu
            </option>
            {target.variants.map((v) => (
              <option key={v.key} value={v.key}>
                {v.label} ({v.key})
              </option>
            ))}
          </select>
        </Field>
      ) : (
        <input type="hidden" name="catalogVariantId" value={target ? "" : (variant ?? "")} />
      )}
    </>
  );
}
