import { CommandError, primiNapredak } from "@/lib/sync/commands/service";
import { BodyError, parseJsonBody } from "@/lib/sync/http/gate";
import { syncJson, withAuthenticatedDevice } from "@/lib/sync/http/handler";

/**
 * ACK i progres od uređaja.
 *
 * Prima SAMO poznat command ID, stabilan event ID, dozvoljen prelaz, ograničene
 * zbirne brojeve i kratak enum razloga. Bez sirovih poruka, stack trace-a,
 * putanja, imena kupaca/fajlova, PIB-a i bilo kog dela dokumenta.
 *
 * `actorDevice` određuje SERVER iz potpisa; telo ga ne nosi.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PATH = "/api/sync/commands/update";

/** Dozvoljena stanja koja uređaj sme da prijavi. */
const STANJA = new Set([
  "running",
  "completed",
  "completed_with_review",
  "retry_pending",
  "failed",
  "blocked",
]);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EVENT_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,63}$/;

export async function POST(request: Request): Promise<Response> {
  return withAuthenticatedDevice(
    request,
    PATH,
    async ({ device, bodyBytes, requestId }) => {
      let telo: Record<string, unknown>;
      try {
        const parsed = parseJsonBody(bodyBytes);
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
          return syncJson(400, { ok: false, code: "body_not_object", requestId });
        }
        telo = parsed as Record<string, unknown>;
      } catch (error) {
        if (error instanceof BodyError) {
          return syncJson(error.status, { ok: false, code: error.code, requestId });
        }
        return syncJson(400, { ok: false, code: "body_unreadable", requestId });
      }

      /*
       * Stroga provera OBLIKA pre ijednog upita.
       *
       * Nepoznata polja se ne prihvataju: telo koje nosi `deviceId` ili
       * `requestedBy` pokušava da odluči nešto što odlučuje server.
       */
      const dozvoljena = new Set([
        "commandId", "eventId", "status", "sequence", "failureCode", "counters",
      ]);
      for (const k of Object.keys(telo)) {
        if (!dozvoljena.has(k)) {
          return syncJson(400, { ok: false, code: "unknown_field", requestId });
        }
      }

      const commandId = String(telo.commandId ?? "");
      const eventId = String(telo.eventId ?? "");
      const status = String(telo.status ?? "");
      const sequence = telo.sequence;

      if (!UUID.test(commandId)) {
        return syncJson(400, { ok: false, code: "command_id_invalid", requestId });
      }
      if (!EVENT_ID.test(eventId)) {
        return syncJson(400, { ok: false, code: "event_id_invalid", requestId });
      }
      if (!STANJA.has(status)) {
        return syncJson(400, { ok: false, code: "status_not_allowed", requestId });
      }
      if (!Number.isInteger(sequence) || (sequence as number) < 0 || (sequence as number) > 10_000) {
        return syncJson(400, { ok: false, code: "sequence_invalid", requestId });
      }

      const counters = telo.counters;
      if (counters !== undefined && (typeof counters !== "object" || counters === null || Array.isArray(counters))) {
        return syncJson(400, { ok: false, code: "counters_invalid", requestId });
      }

      try {
        const ishod = await primiNapredak({
          commandId,
          // IZ POTPISA, ne iz tela.
          actorDeviceId: device.deviceId,
          clientEventId: eventId,
          status: status as never,
          sequence: sequence as number,
          failureCode: typeof telo.failureCode === "string" ? telo.failureCode : null,
          counters: (counters ?? {}) as never,
        });

        if (ishod.result === "konflikt") {
          /*
           * 409, ne 400: zahtev je ispravan po obliku, ali se ne uklapa u
           * istoriju komande. Klijent ga ne treba ponavljati nepromenjenog.
           */
          return syncJson(409, { ok: false, code: ishod.razlog, requestId });
        }

        return syncJson(200, {
          ok: true,
          code: ishod.result === "vec_primljeno" ? "already_recorded" : "recorded",
          requestId,
          status: ishod.status,
        });
      } catch (error) {
        if (error instanceof CommandError) {
          const status = error.code === "command_not_found" ? 404 : 409;
          return syncJson(status, { ok: false, code: error.code, requestId });
        }
        // Poruka se NE prosleđuje: drajver ume da nosi deo upita.
        return syncJson(503, { ok: false, code: "temporarily_unavailable", requestId });
      }
    },
    { trazi: "operations" },
  );
}
