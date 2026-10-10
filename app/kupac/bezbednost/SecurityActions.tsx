"use client";

import { ConfirmAction } from "@/components/ordering/ConfirmAction";
import { forgetDeviceAction, logoutAllDevicesAction } from "./actions";

/** Odjava sa svih uređaja — uz potvrdu, jer odjavljuje i ovaj uređaj. */
export function LogoutAllButton() {
  return (
    <ConfirmAction
      label="Odjavite me sa svih uređaja…"
      variant="danger"
      title="Odjava sa svih uređaja"
      body="Gase se sve prijave ovog naloga i svi zapamćeni uređaji, uključujući ovaj. Posle toga se ponovo prijavljujete lozinkom."
      confirmLabel="Odjavite me sa svih uređaja"
      pendingLabel="Odjavljuje se…"
      onConfirm={() => logoutAllDevicesAction()}
    />
  );
}

/** Zaboravljanje jednog zapamćenog uređaja. */
export function ForgetDeviceButton({ id, label }: { id: string; label: string }) {
  return (
    <ConfirmAction
      label="Zaboravite uređaj…"
      variant="danger"
      title="Zaboravite zapamćen uređaj"
      body={`„${label}“ više neće biti prijavljen bez lozinke.`}
      confirmLabel="Zaboravite uređaj"
      pendingLabel="Briše se…"
      onConfirm={() => forgetDeviceAction(id)}
    />
  );
}
