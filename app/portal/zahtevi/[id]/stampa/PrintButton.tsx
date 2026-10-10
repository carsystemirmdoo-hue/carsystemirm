"use client";

export function PrintButton() {
  return (
    <button type="button" className="portal-button" onClick={() => window.print()}>
      Odštampajte zahtev
    </button>
  );
}
