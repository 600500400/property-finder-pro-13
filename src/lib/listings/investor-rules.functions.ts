import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export interface InvestorRules {
  excluded_localities: string[];
  min_net_yield: number | null;
  max_price: number | null;
  require_osobni: boolean;
}

const RulesSchema = z.object({
  excluded_localities: z.array(z.string().trim().min(1)).max(200).default([]),
  min_net_yield: z.number().min(0).max(50).nullable().optional(),
  max_price: z.number().min(0).nullable().optional(),
  require_osobni: z.boolean().default(false),
});

export const getMyInvestorRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<InvestorRules> => {
    const { data } = await context.supabase
      .from("user_investor_rules")
      .select("excluded_localities, min_net_yield, max_price, require_osobni")
      .eq("user_id", context.userId)
      .maybeSingle();
    return {
      excluded_localities: (data?.excluded_localities as string[] | null) ?? [],
      min_net_yield: (data?.min_net_yield as number | null) ?? null,
      max_price: (data?.max_price as number | null) ?? null,
      require_osobni: !!data?.require_osobni,
    };
  });

export const saveMyInvestorRules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RulesSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase.from("user_investor_rules").upsert({
      user_id: context.userId,
      excluded_localities: data.excluded_localities,
      min_net_yield: data.min_net_yield ?? null,
      max_price: data.max_price ?? null,
      require_osobni: data.require_osobni,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
