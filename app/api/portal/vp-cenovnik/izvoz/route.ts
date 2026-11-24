import { z } from "zod";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit/record";
import { apiAuthResponse, requireApiCapability } from "@/lib/authz/session";
import { buildXlsx, XLSX_MIME } from "@/lib/export/xlsxFile.mjs";
import { loadCurrentVp, loadVpDraft } from "@/lib/pricing/vp-draft-service";
import { changePercent } from "@/lib/pricing/vpDraft.mjs";
import { belgradeDate } from "@/lib/recommendations/customerRhythm.mjs";

/**
 * Excel VP cenovnika (2026-11-18).
 *
 *  ?vrsta=vazeci              važeći VP cenovnik, brend › grupa › artikal, sa PRAZNOM kolonom „Nova VP“:
 *                             menadžer prodaje je popuni i otpremi kao novu pripremu.
 *  ?vrsta=priprema&id=…       priprema: stara i nova cena i promena (za proveru i unos u BizniSoft);
 *                             `&sve=1` — ceo cenovnik (nepromenjene cene ostaju iste).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  vrsta: z.enum(["vazeci", "priprema"]),
  id: z.string().uuid().optional(),
  brend: z.string().max(60).optional(),
  sve: z.enum(["1"]).optional(),
});

const rsd = (c: number | null) => (c === null ? null : Math.round(c) / 100);
const dmy = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}.`;
const safeName = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "dj").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "priprema";

export async function GET(request: Request) {
  try {
    const user = await requireApiCapability("view:vp_cenovnik");
    const parsed = schema.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()));
    if (!parsed.success) return Response.json({ error: "Neispravni parametri." }, { status: 400, headers: { "Cache-Control": "private, no-store" } });
    const { vrsta, id, brend, sve } = parsed.data;
    const today = belgradeDate(new Date());
    let rows: Array<Array<string | number | null>>;
    let widths: number[];
    let fileName: string;
    let label: string;
    let count: number;

    if (vrsta === "vazeci") {
      const base = (await loadCurrentVp(today)).filter((r) => !brend || r.brand === brend);
      rows = [
        [`VP cenovnik — važi ${dmy(today)}${brend ? ` — ${brend}` : ""}`],
        ["Upišite novu cenu u kolonu „Nova VP“ (bez PDV-a) samo za artikle koji se menjaju; prazno = ostaje ista. Fajl otpremite na strani VP cenovnik."],
        [],
        ["Šifra", "Naziv", "Brend", "Grupa", "JM", "PDV %", "VP cena", "Nova VP"],
        ...base.map((r) => [r.code, r.name, r.brand, r.group, r.unit, r.vatPercent, rsd(r.oldCents), null]),
      ];
      widths = [12, 54, 12, 26, 6, 7, 12, 12];
      fileName = `vp-cenovnik-${today}${brend ? `-${safeName(brend)}` : ""}.xlsx`;
      label = "Važeći VP cenovnik";
      count = base.length;
    } else {
      if (!id) return Response.json({ error: "Nedostaje priprema." }, { status: 400 });
      const data = await loadVpDraft(user, id);
      if (!data) return Response.json({ error: "Priprema ne postoji." }, { status: 404 });
      const { draft } = data;
      const head = ["Šifra", "Naziv", "Brend", "Grupa", "PDV %", "Stara VP", "Nova VP", "Promena %"];
      let body: Array<Array<string | number | null>>;
      if (sve) {
        const changed = new Map(data.rows.map((r) => [r.articleId, r]));
        const base = await loadCurrentVp(today);
        body = base.map((b) => {
          const c = changed.get(b.articleId);
          const nw = c ? c.newCents : b.oldCents;
          return [b.code, b.name, b.brand, b.group, b.vatPercent, rsd(b.oldCents), rsd(nw), c && b.oldCents ? changePercent(b.oldCents, c.newCents) : 0];
        });
        // Artikli sa novom cenom koji danas nemaju cenu (dodati tačnom cenom).
        const inBase = new Set(base.map((b) => b.articleId));
        for (const r of data.rows) if (!inBase.has(r.articleId)) body.push([r.code, r.name, r.brand, r.group, r.vatPercent, null, rsd(r.newCents), null]);
      } else {
        body = data.rows.map((r) => [r.code, r.name, r.brand, r.group, r.vatPercent, rsd(r.oldCents), rsd(r.newCents), r.oldCents ? changePercent(r.oldCents, r.newCents) : null]);
      }
      rows = [
        [`Nov VP cenovnik — ${draft.title}`],
        [
          [
            sve ? "ceo cenovnik" : `samo promenjene cene (${data.rows.length})`,
            draft.proposed_valid_from ? `predlog: važi od ${dmy(draft.proposed_valid_from)}` : null,
            `pripremio ${draft.created_by_name}`,
            draft.office_checked_name ? `proverila ${draft.office_checked_name}` : null,
            `preuzeto ${dmy(today)}`,
          ]
            .filter(Boolean)
            .join(" · "),
        ],
        [],
        head,
        ...body,
      ];
      widths = [12, 54, 12, 26, 7, 12, 12, 10];
      fileName = `vp-cenovnik-nov-${safeName(draft.title)}${sve ? "-ceo" : ""}.xlsx`;
      label = `Priprema VP cenovnika: ${draft.title}${sve ? " (ceo)" : ""}`;
      count = body.length;
    }

    const file = buildXlsx({ sheetName: "VP cenovnik", rows, boldRows: [0, 3], widths });
    await recordAudit({
      actor: { id: user.id, name: user.name, role: user.role },
      action: AUDIT_ACTIONS.exportGenerated,
      entityType: "Izveštaj",
      entityId: vrsta === "vazeci" ? "vp-cenovnik" : `vp-priprema:${id}`,
      entityLabel: `${label} (xlsx)`.slice(0, 160),
      after: { redova: count, brend: brend ?? null },
      reason: "Izvoz u XLSX",
    });
    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": XLSX_MIME,
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    const denied = apiAuthResponse(error);
    if (denied) return denied;
    throw error;
  }
}
