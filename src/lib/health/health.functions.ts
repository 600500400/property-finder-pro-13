import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getScraperHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin, error: roleErr } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Forbidden");
    const { computeScraperHealth } = await import("./scraper-health.server");
    return await computeScraperHealth();
  });
