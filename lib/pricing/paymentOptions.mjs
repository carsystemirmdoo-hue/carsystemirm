/**
 * Opcije plaćanja (0043). Šifra: `avans` ili `odlozeno_N` (N dana).
 * Izbor opcije NIJE dokaz uplate — avansna cena je uslovljena uplatom pre isporuke.
 */
export const OPTION_CODE = /^(avans|odlozeno_[0-9]{1,3})$/;

export function isOptionCode(code) {
  return typeof code === "string" && OPTION_CODE.test(code);
}

export function optionLabel(code) {
  if (code === "avans") return "Avansno plaćanje";
  const m = String(code ?? "").match(/^odlozeno_(\d{1,3})$/);
  if (m) return `Odloženo plaćanje — ${Number(m[1])} dana`;
  return "Plaćanje po dogovoru sa kancelarijom";
}

/** Napomena uz opciju: šta izbor znači, a šta NE znači. */
export function optionNote(code) {
  if (code === "avans") return "Cena važi uz uplatu pre isporuke; kancelarija proverava uplatu pre potvrde isporuke.";
  if (String(code ?? "").startsWith("odlozeno_")) return "Rok plaćanja računa se od datuma računa.";
  return "Uslovi plaćanja po dogovoru sa kancelarijom.";
}

/** Redosled prikaza: odloženo (od kraćeg roka) pa avans. */
export function sortOptions(codes) {
  const key = (c) => (c === "avans" ? 9999 : Number(String(c).split("_")[1] ?? 0));
  return [...codes].sort((a, b) => key(a) - key(b));
}
