import type { AIAnalysisErr } from "./analyze.functions";

/** Raw row shape returned by public.reserve_ai_analysis. */
export interface ReservationRow {
  allowed: boolean | null;
  used: number | string | null;
  quota_limit: number | string | null;
  reservation_id: string | null;
}

export interface ReservationOk {
  ok: true;
  used: number;
  limit: number;
  isPremium: boolean;
  reservationId: string | null;
}

export type ReservationOutcome = ReservationOk | { ok: false; error: AIAnalysisErr };

const RPC_FAILED: AIAnalysisErr = {
  ok: false,
  error: "ai_failed",
  message: "Nepodařilo se ověřit limit AI analýz.",
};

/**
 * Maps the reserve_ai_analysis RPC result onto the app's analysis outcomes.
 * The reservation is written BEFORE the AI call, so an attempt counts even when
 * the provider fails — that is deliberate (see the DB function's comment).
 */
export function mapReservation(
  reservation: ReservationRow | ReservationRow[] | null | undefined,
  rpcError: unknown,
): ReservationOutcome {
  if (rpcError) return { ok: false, error: RPC_FAILED };

  const row = Array.isArray(reservation) ? reservation[0] : reservation;
  if (!row) return { ok: false, error: RPC_FAILED };

  const used = Number(row.used ?? 0);
  const limit = Number(row.quota_limit ?? 1);
  const isPremium = limit > 1;

  if (row.allowed !== true) {
    if (!isPremium) {
      return {
        ok: false,
        error: {
          ok: false,
          error: "free_sample_used",
          message: "Vyčerpal jsi svou jednu ukázkovou AI analýzu. Premium = 50 analýz měsíčně.",
          used,
          limit,
        },
      };
    }
    return {
      ok: false,
      error: {
        ok: false,
        error: "monthly_limit_reached",
        message: `Měsíční limit AI analýz vyčerpán (${used}/${limit}). Reset 1. dne v měsíci.`,
        used,
        limit,
      },
    };
  }

  return { ok: true, used, limit, isPremium, reservationId: row.reservation_id ?? null };
}
