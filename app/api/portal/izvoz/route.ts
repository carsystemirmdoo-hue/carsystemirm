import { z } from "zod";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit/record";
import {
  apiAuthResponse,
  requireApiCapability,
} from "@/lib/authz/session";
import { EXPORT_FORMATS } from "@/lib/export/serializers.mjs";
import { loadSalesLines } from "@/lib/sales/queries";
import { summarize, summarizeBy } from "@/lib/sales/totals.mjs";

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
      return Response.json({ error: "Neispravni parametri." }, { status: 400 });
    }

    const { format, view, ...filter } = parsed.data;
    const lines = await loadSalesLines(user, filter);

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
      note: "Podaci o plaćanju nisu dostupni iz trenutnog izvora i nisu deo ovog izveštaja.",
    };

    const { columns, rows } = buildReport(view, lines);
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

function buildReport(view: string, lines: Awaited<ReturnType<typeof loadSalesLines>>) {
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

  const keyOf: Record<string, (line: (typeof lines)[number]) => string> = {
    kupci: (line) => line.customerName,
    komercijalisti: (line) => line.salespersonName ?? "Bez komercijaliste",
    artikli: (line) => `${line.articleCode} · ${line.articleName ?? ""}`.trim(),
    grupe: (line) => line.productGroup ?? "Bez grupe",
  };

  const grouped = summarizeBy(lines, keyOf[view]);
  const total = summarize(lines);

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
      ...grouped.map((row) => [
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
        new Set(lines.map((line) => line.invoiceId)).size,
      ],
    ],
  };
}

export const dynamic = "force-dynamic";