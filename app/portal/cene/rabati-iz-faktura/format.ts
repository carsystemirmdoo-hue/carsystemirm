const PCT = new Intl.NumberFormat("sr-Latn-RS", { maximumFractionDigits: 2 });

/** Procenat rabata u srpskom zapisu: „22,5 %". */
export function pct(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : `${PCT.format(value)} %`;
}
