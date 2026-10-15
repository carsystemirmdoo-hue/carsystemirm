/**
 * Tri koraka uvoza lagera: izbor fajla → provera → potvrda (dok. 65).
 * `current` je korak na kom je korisnik; `failed` označava da provera nije prošla.
 */
const STEPS = ["Izbor fajla", "Provera", "Potvrda"] as const;

export function StockImportSteps({ current, done = false, failed = false }: { current: 1 | 2 | 3; done?: boolean; failed?: boolean }) {
  return (
    <ol className="lg-steps" aria-label="Koraci uvoza lagera">
      {STEPS.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const state = done || n < current ? "done" : n === current ? (failed ? "failed" : "current") : "next";
        return (
          <li key={label} className="lg-step" data-state={state} aria-current={n === current && !done ? "step" : undefined}>
            <span className="lg-step-mark" aria-hidden="true">{state === "done" ? "✓" : state === "failed" ? "!" : n}</span>
            <span className="lg-step-label">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
