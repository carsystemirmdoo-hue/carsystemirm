/** Prikaz korpe firme; vrednosti šalje isključivo autentifikovani server. */
export type CustomerCartPreview = {
  mode: "request" | "legacy";
  label: string;
  totals: { net: number; vat: number; gross: number };
  incomplete: boolean;
  lines: {
    id: string;
    code: string;
    name: string;
    quantity: number;
    unit: string;
    listPrice: number | null;
    discount: number | null;
    price: number | null;
    total: number | null;
    problem: string | null;
  }[];
};
