import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FiltersJson = z.record(z.string(), z.unknown());

const UpsertInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  filters: FiltersJson,
  min_yield: z.number().min(0).max(50).nullable().optional(),
  frequency: z.enum(["instant", "daily"]),
  is_active: z.boolean().default(true),
});

export const listSavedSearches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("saved_searches")
      .select("id, name, filters, min_yield, frequency, is_active, last_notified_at, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertSavedSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpsertInput.parse(input))
  .handler(async ({ data, context }) => {
    const payload = {
      name: data.name,
      filters: data.filters as never,
      min_yield: data.min_yield ?? null,
      frequency: data.frequency,
      is_active: data.is_active,
    };
    if (data.id) {
      const { error } = await context.supabase.from("saved_searches").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("saved_searches")
      .insert({ ...payload, user_id: context.userId })
      .select("id").single();
    if (error) throw new Error(error.message);
    return { id: row!.id };
  });

export const toggleSavedSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), is_active: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("saved_searches")
      .update({ is_active: data.is_active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSavedSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("saved_searches").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
