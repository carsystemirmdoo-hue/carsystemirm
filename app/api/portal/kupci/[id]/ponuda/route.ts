import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit/record";
import { apiAuthResponse, requireApiCapability } from "@/lib/authz/session";
import { EXPORT_FORMATS } from "@/lib/export/serializers.mjs";
import { CustomerOfferError, loadCustomerOffer } from "@/lib/recommendations/customer-offer-service";
import { fileSlug, offerLines } from "@/lib/recommendations/customerOffer.mjs";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const noStore = { "Cache-Control": "private, no-store" };

/**
 * Ponuda kupcu u Excelu (2026-11-10): izabrani artikli iz tabele preporuka kupca.
 *
 * Sve se ponovo učitava na serveru istim upitom kao ekran (opseg, cene kupca na
 * današnji dan); iz adrese se uzimaju samo šifre, i to samo one koje kupac ima
 * u preporukama i koje nisu označene „Ne uzima više“.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!UUID.test(id)) return Response.json({ error: "Neispravan kupac." }, { status: 400, headers: noStore });
    const user = await requireApiCapability("view:preporuke");
    const wanted = new URL(request.url).searchParams.getAll("a").slice(0, 500);
    if (!wanted.length) return Response.json({ error: "Nije izabran nijedan artikal." }, { status: 400, headers: noStore });

    let data: Awaited<ReturnType<typeof loadCustomerOffer>>;
    try {
      data = await loadCustomerOffer(user, id);
    } catch (error) {
      if (error instanceof CustomerOfferError) return Response.json({ error: error.message }, { status: 403, headers: noStore });
      throw error;
    }
    const byCode = new Map(data.rows.filter((r) => !r.dismissal).map((r) => [r.articleCode, r]));
    const chosen = [...new Set(wanted)]
      .map((c) => byCode.get(c))
      .filter((r): r is NonNullable<typeof r> => Boolean(r))
      .map((r) => ({ code: r.articleCode, name: r.articleName, unit: r.unit, quantity: r.last?.quantity ?? 1, price: r.today }));
    if (!chosen.length) return Response.json({ error: "Izabrani artikli nisu u preporukama kupca." }, { status: 400, headers: noStore });

    const { lines, totalCents, priceless } = offerLines(
      chosen,
      data.lids.filter((l) => l.code).map((l) => ({ containerCode: l.containerCode, lid: { code: l.code, name: l.name, unit: "KOM", quantity: 0, price: l.price } })),
    );
    const num = (c: number) => Math.round(c) / 100;
    const columns = ["Šifra", "Naziv", "Količina", "JM", "VP cena", "Rabat %", "Neto cena", "Iznos"];
    const rows = lines.map((l) => [
      l.code,
      l.lid ? `${l.name} (uz posudu)` : l.name,
      l.quantity,
      l.unit ?? "",
      l.price ? num(l.price.baseCents) : "na upit",
      l.price && l.price.discountPercent !== null ? l.price.discountPercent : "",
      l.price ? num(l.price.netCents) : "na upit",
      l.amountCents === null ? "" : num(l.amountCents),
    ]);
    rows.push(["", "Ukupno bez PDV-a", "", "", "", "", "", num(totalCents)]);

    const generatedAt = new Intl.DateTimeFormat("sr-Latn-RS", { dateStyle: "medium", timeStyle: "short" }).format(new Date());
    const meta = {
      title: `Ponuda — ${data.customer.name}`,
      generatedAt,
      generatedBy: user.name,
      filters: [
        { label: "Cene", value: `po važećim uslovima kupca na dan ${data.today.split("-").reverse().join(".")}, bez PDV-a` },
        { label: "Količine", value: "predlog iz poslednje kupovine; menjaju se po dogovoru" },
      ],
      note: priceless ? `${priceless} stavki je „na upit“: cena se dogovara posebno.` : undefined,
    };
    const serializer = EXPORT_FORMATS.xlsx;
    const body = serializer.render(columns, rows, meta);

    await recordAudit({
      actor: { id: user.id, name: user.name, role: user.role },
      action: AUDIT_ACTIONS.exportGenerated,
      entityType: "Ponuda kupcu",
      entityId: id,
      entityLabel: data.customer.name,
      after: { stavki: lines.length, sifre: lines.map((l) => l.code) },
      reason: "Ponuda iz preporuka kupca",
    });

    const fileName = `Ponuda-${fileSlug(data.customer.name)}-${data.today}.${serializer.extension}`;
    // XLSX je binarni ZIP (Uint8Array), CSV i PDF su tekst.
    return new Response(typeof body === "string" ? body : new Uint8Array(body), {
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
