"use client";

export function PrintButton() {
  return (
    <button type="button" className="pn-btn" data-variant="primary" onClick={() => window.print()}>
      Odštampajte
    </button>
  );
}
