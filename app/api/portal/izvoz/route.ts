import { z } from "zod";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit/record";
import {
  apiAuthResponse,
  requireApiCapability,
} from "@/lib/authz/session";
import { EXPORT_FORMATS } from "@/lib/export/serializers.mjs";
import {
  loadSalesBreakdown,
  loadSalesLines,
  loadSalesSummary,
  type SalesBreakdownRow,
  type SalesLine,
  type SalesSummary,
} from "@/lib/sales/queries";

/**
 * Najviše stavki u izvozu „Stavke faktura" po formatu. Zbirni izvozi (po kupcu,
 * artiklu…) nemaju granicu — računaju se u bazi nad celim filtriranim skupom.
 * PDF je za štampu, pa je granica niža; kada je dostignuta, izveštaj to kaže.
 */
const STAVKE_GRANICA: Record<"csv" | "xlsx" | "pdf", number> = {
  csv: 200000,
  xlsx: 200000,
  pdf: 5000,
};

export const runtime = "nodejs";

const querySchema = z.object({
  format: z.enum(["csv", "xlsx", "pdf"]),
  view: z.enum(["stavke", "kupci", "komercijalisti", "artikli", "grupe"]),
  from: z.string().optional(),
  to: z.string().optional(),
  customerId: z.string().uuid().optional(),
  salespersonId: z.string().uuid().optional(),
  productGroup: z.string().optional(),
});

/**
 * Izvoz izveštaja.
 *
 * Podaci se učitavaju istim upitom kao i ekran, pa izvoz nikada ne može da
 * sadrži red koji korisnik ne sme da vidi — opseg je već u SQL-u.
 */
export async function GET(request: Request) {
  try {
    const user = await requireApiCapability("export:data");
    const url = new URL(request.url);
    const parsed = querySchema.safeParse(
      Object.fromEntries(url.searchParams.entries()),
    );
    if (!parsed.success) {
      return Response.json({ error: "Neispravni parametri." }, { status: 400, headers: { "Cache-Control": "private, no-store" } });
    }

    const { format, view, ...filter } = parsed.data;
    const summary = await loadSalesSummary(user, filter);
    const lines =
      view === "stavke"
        ? await loadSalesLines(user, filter, STAVKE_GRANICA[format])
        : [];
    const breakdown =
      view === "stavke" ? [] : await loadSalesBreakdown(user, filter, view);
    const skraceno = view === "stavke" && summary.lineCount > lines.length;

    const generatedAt = new Intl.DateTimeFormat("sr-Latn-RS", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date());

    const meta = {
      title: `Poslovni sistem · ${TITLES[view]}`,
      generatedAt,
      generatedBy: `${user.name} (${user.role})`,
      filters: [
        { label: "Period", value: `${filter.from ?? "početak"} — ${filter.to ?? "danas"}` },
        { label: "Obim", value: describeScope(user.role, user.permissions) },
        { label: "Kupac", value: filter.customerId ?? "svi" },
        { label: "Komercijalista", value: filter.salespersonId ?? "svi" },
        { label: "Grupa proizvoda", value: filter.productGroup ?? "sve" },
      ],
      note: [
        "Podaci o plaćanju nisu dostupni iz trenutnog izvora i nisu deo ovog izveštaja.",
        skraceno
          ? `Izvoz sadrži najnovijih ${lines.length} od ${summary.lineCount} stavki (granica za ${format.toUpperCase()}). Za potpun spisak izaberite CSV ili XLSX ili kraći period.`
          : null,
      ]
        .filter(Boolean)
        .join(" "),
    };

    const { columns, rows } = buildReport(view, lines, breakdown, summary);
    const serializer = EXPORT_FORMATS[format];
    const body = serializer.render(columns, rows, meta);

    await recordAudit({
      actor: { id: user.id, name: user.name, role: user.role },
      action: AUDIT_ACTIONS.exportGenerated,
      entityType: "Izveštaj",
      entityId: view,
      entityLabel: `${TITLES[view]} (${format})`,
      after: { redova: rows.length, filteri: meta.filters },
      reason: `Izvoz u ${format.toUpperCase()}`,
    });

    const fileName = `carsystem-${view}-${new Date().toISOString().slice(0, 10)}.${serializer.extension}`;
    return new Response(body, {
      headers: {
        "Content-Type": serializer.mime,
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const denied = apiAuthResponse(error);
    if (denied) return denied;
    throw error;
  }
}

const TITLES: Record<string, string> = {
  stavke: "Stavke faktura",
  kupci: "Promet po kupcu",
  komercijalisti: "Promet po komercijalisti",
  artikli: "Promet po artiklu",
  grupe: "Promet po grupi proizvoda",
};

function describeScope(role: string, permissions: string[]) {
  if (role === "gazda") return "cela firma";
  if (permissions.includes("analitika")) return "cela firma (paket analitika)";
  if (role === "kancelarija") return "cela firma";
  return "samo dodeljeni kupci";
}

function buildReport(
  view: string,
  lines: SalesLine[],
  breakdown: SalesBreakdownRow[],
  total: SalesSummary,
) {
  if (view === "stavke") {
    return {
      columns: [
        "Faktura",
        "Datum",
        "Vrsta dokumenta",
        "Kupac",
        "Komercijalista",
        "Šifra artikla",
        "Artikal",
        "Grupa",
        "Količina",
        "Iznos",
      ],
      rows: lines.map((line) => [
        line.invoiceNumber,
        line.issuedOn,
        line.sourceDocumentType ?? line.documentKind,
        line.customerName,
        line.salespersonName ?? "—",
        line.articleCode,
        line.articleName ?? "—",
        line.productGroup ?? "—",
        line.quantity,
        line.lineAmount,
      ]),
    };
  }

  // Zbirovi po grupi i UKUPNO dolaze iz baze, nad celim filtriranim skupom.
  return {
    columns: [
      TITLES[view].replace("Promet po ", ""),
      "Bruto",
      "Povrati",
      "Korekcije",
      "Nerazvrstano",
      "Neto",
      "Faktura",
    ],
    rows: [
      ...breakdown.map((row) => [
        row.label,
        row.gross,
        row.returnValue,
        row.correctionValue,
        row.unknownNegativeValue,
        row.net,
        row.invoiceCount,
      ]),
      [
        "UKUPNO",
        total.gross,
        total.returnValue,
        total.correctionValue,
        total.unknownNegativeValue,
        total.net,
        total.invoiceCount,
      ],
    ],
  };
}

export const dynamic = "force-dynamic";
