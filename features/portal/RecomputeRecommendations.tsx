"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { recomputeAction, type RecomputeState } from "@/app/portal/preporuke/actions";

/**
 * Ručni recompute preporuka.
 *
 * `disabled` je SAMO prikaz. Sposobnost i feature gate se proveravaju u server
 * akciji; onemogućeno dugme nikoga ne zaustavlja.
 *
 * Datum je vidljivo polje, ne skriveni `new Date()`. Obračun mora da može da se
 * ponovi za tačno određen dan — sutra u kancelariji, posle uvoza istorije, sa
 * danom koji stoji u izveštaju.
 */

const POCETNO: RecomputeState = { error: null, ok: null };

function Dugme({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="portal-button"
      data-variant="secondary"
      /*
       * `pending` gasi dugme dok obračun traje — prva odbrana od dvostrukog
       * klika. Prava odbrana je delimičan jedinstveni indeks u bazi: dva
       * paralelna prolaza ne mogu oba biti u toku.
       */
      disabled={disabled || pending}
    >
      {pending ? "Računa se…" : "Preračunaj preporuke"}
    </button>
  );
}

export function RecomputeRecommendations({
  defaultAsOfDate,
  disabled,
}: {
  defaultAsOfDate: string;
  disabled: boolean;
}) {
  const [state, action] = useActionState(recomputeAction, POCETNO);

  return (
    <form action={action} className="portal-inline-form">
      <label className="portal-field" style={{ margin: 0 }}>
        <span>Na dan</span>
        <input
          type="date"
          name="asOfDate"
          defaultValue={defaultAsOfDate}
          required
          pattern="\d{4}-\d{2}-\d{2}"
        />
      </label>
      <Dugme disabled={disabled} />
      {state.error ? (
        <small role="alert" data-tone="danger">
          {state.error}
        </small>
      ) : null}
      {state.ok ? <small data-tone="success">{state.ok}</small> : null}
    </form>
  );
}
