"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { triggerSyncAction, type SyncActionState } from "@/app/portal/importi/sinhronizacija/actions";

/**
 * Dugme „Skeniraj i sinhronizuj“.
 *
 * Ne prosleđuje nijedan parametar osim ID-a uređaja. Folder, server, raspored i
 * identitet ostaju u lokalnoj zaštićenoj konfiguraciji konektora — portal ih ne
 * zna i ne sme da ih menja.
 *
 * `disabled` je SAMO prikaz. Autorizacija i feature gate se proveravaju u
 * server akciji; skriveno ili onemogućeno dugme nikoga ne zaustavlja.
 */

const POCETNO: SyncActionState = { error: null, ok: null };

function Dugme({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="portal-button"
      data-variant="secondary"
      /*
       * `pending` gasi dugme dok akcija traje — prva odbrana od dvostrukog
       * klika. Prava odbrana je delimičan jedinstveni indeks u bazi: dva
       * paralelna submita ne mogu napraviti dve komande.
       */
      disabled={disabled || pending}
    >
      {pending ? "Šalje se…" : "Skeniraj i sinhronizuj"}
    </button>
  );
}

export function TriggerSync({ deviceId, disabled }: { deviceId: string; disabled: boolean }) {
  const [state, action] = useActionState(triggerSyncAction, POCETNO);

  return (
    <form action={action} className="portal-inline-form">
      <input type="hidden" name="deviceId" value={deviceId} />
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
