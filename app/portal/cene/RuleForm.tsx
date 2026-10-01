"use client";

import { useActionState, useState } from "react";
import { Field, PortalButton } from "@/components/portal/PortalPrimitives";
import {
  proposeRuleAction,
  type PriceActionState,
} from "@/app/portal/cene/actions";

const INITIAL: PriceActionState = { error: null, ok: null };

export type Option = { id: string; label: string };

/**
 * Obrazac za predlog pravila cene.
 *
 * Polja opsega se prikazuju prema izabranom opsegu, ne sva odjednom. Obrazac
 * koji istovremeno nudi „kupac", „grupa" i „svi" navodi na popunjavanje dva
 * polja — a pravilo sme nositi tačno jedno.
 */
export function RuleForm({
  customers,
  groups,
  articles,
  productGroups,
  brands,
}: {
  customers: Option[];
  groups: Option[];
  articles: Option[];
  productGroups: string[];
  brands: string[];
}) {
  const [state, formAction, pending] = useActionState(proposeRuleAction, INITIAL);
  const [customerScope, setCustomerScope] = useState("customer");
  const [productScope, setProductScope] = useState("article");
  const [valueKind, setValueKind] = useState("discount_percent");

  return (
    <section className="portal-panel">
      <h2>Novi predlog</h2>
      <p>
        Predlog ide na odobrenje i <strong>ne utiče na cenu</strong> dok ne bude
        odobren. Odobrenje takođe nije potvrda iz BizniSofta.
      </p>

      {state.error ? (
        <div className="portal-login-error" role="alert">
          <span>
            <strong>Predlog nije poslat</strong>
            <small>{state.error}</small>
          </span>
        </div>
      ) : null}
      {state.ok ? (
        <p className="portal-login-hint" role="status">
          {state.ok}
        </p>
      ) : null}

      <form action={formAction} className="portal-form">
        <Field label="Opseg kupca" required>
          <select
            name="customerScope"
            value={customerScope}
            onChange={(event) => setCustomerScope(event.target.value)}
            required
          >
            <option value="customer">Konkretan kupac</option>
            <option value="group">Grupa kupaca</option>
            <option value="all">Svi kupci</option>
          </select>
        </Field>

        {customerScope === "customer" ? (
          <Field label="Kupac" required>
            <select name="customerId" required>
              <option value="">— izaberite —</option>
              {customers.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        {customerScope === "group" ? (
          <Field label="Grupa kupaca" required>
            <select name="customerGroupId" required>
              <option value="">— izaberite —</option>
              {groups.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        <Field label="Opseg proizvoda" required>
          <select
            name="productScope"
            value={productScope}
            onChange={(event) => setProductScope(event.target.value)}
            required
          >
            <option value="article">Konkretan artikal</option>
            <option value="product_group">Grupa proizvoda</option>
            <option value="brand">Proizvođač</option>
            <option value="all">Svi proizvodi</option>
          </select>
        </Field>

        {productScope === "article" ? (
          <Field label="Artikal" required>
            <select name="articleId" required>
              <option value="">— izaberite —</option>
              {articles.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        {productScope === "product_group" ? (
          <Field
            label="Grupa proizvoda"
            required
            hint={'Poklapanje je tačno, bez normalizacije — „BAZE" i „baze" nisu ista grupa.'}
          >
            <select name="productGroup" required>
              <option value="">— izaberite —</option>
              {productGroups.map((group) => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        {productScope === "brand" ? (
          <Field label="Proizvođač" required>
            <select name="brand" required>
              <option value="">— izaberite —</option>
              {brands.map((brand) => (
                <option key={brand} value={brand}>
                  {brand}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        <Field
          label="Vrsta vrednosti"
          required
          hint="Pravilo daje ILI rabat ILI fiksnu cenu — nikad oboje."
        >
          <select
            name="valueKind"
            value={valueKind}
            onChange={(event) => setValueKind(event.target.value)}
            required
          >
            <option value="discount_percent">Procenat rabata</option>
            <option value="net_price">Fiksna neto cena</option>
          </select>
        </Field>

        {valueKind === "discount_percent" ? (
          <Field label="Rabat (%)" required>
            <input
              type="number"
              name="discountPercent"
              min={0}
              max={100}
              step="0.001"
              required
            />
          </Field>
        ) : (
          <Field label="Neto cena (RSD)" required>
            <input type="number" name="netPrice" min={0} step="0.0001" required />
          </Field>
        )}

        <Field label="Važi od" required>
          <input type="date" name="effectiveFrom" required />
        </Field>
        <Field
          label="Važi do"
          hint="Prazno = bez roka. Oba datuma su uključena u važenje."
        >
          <input type="date" name="effectiveTo" />
        </Field>

        <Field label="Razlog predloga" required hint="Upisuje se u trag revizije.">
          <input type="text" name="reason" minLength={3} maxLength={500} required />
        </Field>

        <PortalButton type="submit" variant="primary" disabled={pending}>
          {pending ? "Slanje…" : "Pošaljite na odobrenje"}
        </PortalButton>
      </form>
    </section>
  );
}
