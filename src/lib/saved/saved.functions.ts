import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FiltersJson = z.record(z.string(), z.unknown());

export const listSavedFilters = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("saved_filters")
      .select("id, name, filters, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertSavedFilter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      id: z.string().uuid().optional(),
      name: z.string().min(1).max(80),
      filters: FiltersJson,
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.id) {
      const { error } = await supabase
        .from("saved_filters")
        .update({ name: data.name, filters: data.filters, updated_at: new Date().toISOString() })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabase
      .from("saved_filters")
      .insert({ user_id: userId, name: data.name, filters: data.filters })
      .select("id").single();
    if (error) throw new Error(error.message);
    return { id: row!.id };
  });

export const deleteSavedFilter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("saved_filters").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listScheduledScans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("scheduled_scans")
      .select("id, saved_filter_id, filters, email, frequency_per_day, max_per_email, enabled, last_run_at, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertScheduledScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      id: z.string().uuid().optional(),
      saved_filter_id: z.string().uuid().nullable().optional(),
      filters: FiltersJson,
      email: z.string().email(),
      frequency_per_day: z.number().int().min(1).max(6),
      max_per_email: z.number().int().min(1).max(100),
      enabled: z.boolean(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload = {
      filters: data.filters,
      email: data.email,
      frequency_per_day: data.frequency_per_day,
      max_per_email: data.max_per_email,
      enabled: data.enabled,
      saved_filter_id: data.saved_filter_id ?? null,
    };
    if (data.id) {
      const { error } = await supabase.from("scheduled_scans").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabase
      .from("scheduled_scans")
      .insert({ user_id: userId, ...payload })
      .select("id").single();
    if (error) throw new Error(error.message);
    return { id: row!.id };
  });

export const deleteScheduledScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("scheduled_scans").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
