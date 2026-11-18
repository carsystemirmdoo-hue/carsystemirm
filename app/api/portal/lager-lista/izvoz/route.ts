import { z } from "zod";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit/record";
import { apiAuthResponse, requireApiCapability } from "@/lib/authz/session";
import { buildXlsx, XLSX_MIME } from "@/lib/export/xlsxFile.mjs";
import { lagerCustomerPrices, loadLagerList, type LagerRow } from "@/lib/stock/lager-list-service";
import { searchHaystack, searchLager } from "@/lib/stock/lagerSearch.mjs";

/**
 * Izvoz Lager liste u .xlsx (2026-11-18, menadžer prodaje): isti filteri kao na ekranu —
 * pretraga, brend, „samo na stanju“ i (opciono) cena izabranog kupca. Bez granice od 200
 * redova sa ekrana: izvoz sadrži sve redove koji odgovaraju filteru.
 * Podaci dolaze iz istog servisa kao ekran, pa izvoz ne može imati ništa što ekran ne prikazuje.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  q: z.string().max(120).optional(),
  brend: z.string().max(60).optional(),
  stanje: z.enum(["1"]).optional(),
  kupac: z.string().uuid().optional(),
});

const unitLabel = (u: string | null) => (u ? (u.toUpperCase() === "LIT" ? "L" : u.toLowerCase()) : "");

export async function GET(request: Request) {
  try {
    const user = await requireApiCapability("view:lager_lista");
    const parsed = schema.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()));
    if (!parsed.success) return Response.json({ error: "Neispravni parametri." }, { status: 400, headers: { "Cache-Control": "private, no-store" } });
    const { q = "", brend, stanje, kupac } = parsed.data;

    const data = await loadLagerList();
    const base = data.rows
      .filter((r) => (!brend || r.brand === brend) && (!stanje || (r.stock !== null && r.stock > 0)))
      .map((r) => ({ ...r, hay: searchHaystack(r) }));
    const hits = (q.trim() ? searchLager(base, q) : [...base].sort((a, b) => a.name.localeCompare(b.name, "sr-Latn"))) as (LagerRow & { hay: string })[];
    const forCustomer = kupac ? await lagerCustomerPrices(user, kupac, hits.filter((r) => !r.newCode).map((r) => r.key)) : null;

    const dmy = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}.`;
    const head = ["Šifra", "Naziv", "Brend", "Grupa", "Stanje", "JM", "Pakovanje", "VP cena (bez PDV-a)", "U dolasku", "Najraniji dolazak"];
    if (forCustomer) head.push(`Cena za ${forCustomer.customer.name}`, "Rabat %");
    const rows: Array<Array<string | number | null>> = [
      [`Lager lista — ${dmy(data.today)}${data.stockDate ? ` · stanje lagera od ${dmy(data.stockDate)}` : ""}`],
      [[brend ? `brend: ${brend}` : "svi brendovi", stanje ? "samo na stanju" : null, q.trim() ? `pretraga: ${q.trim()}` : null].filter(Boolean).join(" · ")],
      [],
      head,
      ...hits.map((r) => {
        const line: Array<string | number | null> = [
          r.code,
          r.name,
          r.brand,
          r.group,
          r.stock,
          unitLabel(r.unit),
          r.packLabel,
          r.price,
          r.incoming?.quantity ?? null,
          r.incoming?.nearest ? dmy(r.incoming.nearest) : null,
        ];
        if (forCustomer) {
          const p = forCustomer.prices[r.key];
          if (!p) line.push(null, null);
          else if (p.status === "cena") line.push(p.netCents / 100, p.discountPercent);
          else line.push(p.status === "na_upit" ? "na upit" : "van ponude", null);
        }
        return line;
      }),
    ];
    const body = buildXlsx({
      sheetName: "Lager lista",
      rows,
      boldRows: [0, 3],
      widths: [12, 52, 12, 22, 10, 6, 14, 14, 11, 12, ...(forCustomer ? [16, 9] : [])],
    });

    await recordAudit({
      actor: { id: user.id, name: user.name, role: user.role },
      action: AUDIT_ACTIONS.exportGenerated,
      entityType: "Izveštaj",
      entityId: "lager-lista",
      entityLabel: "Lager lista (xlsx)",
      after: { redova: hits.length, brend: brend ?? null, samoNaStanju: Boolean(stanje), pretraga: q.trim() || null, kupac: forCustomer?.customer.id ?? null },
      reason: "Izvoz u XLSX",
    });

    return new Response(new Uint8Array(body), {
      headers: {
        "Content-Type": XLSX_MIME,
        "Content-Disposition": `attachment; filename="lager-lista-${data.today}.xlsx"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    const denied = apiAuthResponse(error);
    if (denied) return denied;
    throw error;
  }
}
