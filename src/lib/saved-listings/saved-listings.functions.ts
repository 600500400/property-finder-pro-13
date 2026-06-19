import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SaveInput = z.object({
  listing_url: z.string().url(),
  source: z.string().optional(),
  name: z.string().optional(),
  locality: z.string().optional(),
  price: z.number().nullable().optional(),
  area_m2: z.number().nullable().optional(),
  image_url: z.string().optional(),
});

export const listSavedListings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("saved_listings")
      .select("id, listing_url, source, name, locality, price, area_m2, image_url, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const saveListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SaveInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("saved_listings")
      .upsert(
        {
          user_id: context.userId,
          listing_url: data.listing_url,
          source: data.source ?? null,
          name: data.name ?? null,
          locality: data.locality ?? null,
          price: data.price ?? null,
          area_m2: data.area_m2 ?? null,
          image_url: data.image_url ?? null,
        },
        { onConflict: "user_id,listing_url" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const unsaveListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ listing_url: z.string().url() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("saved_listings")
      .delete()
      .eq("listing_url", data.listing_url);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
