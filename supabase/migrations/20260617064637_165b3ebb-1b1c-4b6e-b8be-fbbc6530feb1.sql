
-- 1) flags on listings
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS flags jsonb NOT NULL DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS listings_flags_gin ON public.listings USING gin (flags jsonb_path_ops);

-- 2) user_investor_rules
CREATE TABLE IF NOT EXISTS public.user_investor_rules (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  excluded_localities text[] NOT NULL DEFAULT '{}',
  min_net_yield numeric,
  max_price numeric,
  require_osobni boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_investor_rules TO authenticated;
GRANT ALL ON public.user_investor_rules TO service_role;
ALTER TABLE public.user_investor_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own investor rules"
  ON public.user_investor_rules FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER user_investor_rules_set_updated_at
  BEFORE UPDATE ON public.user_investor_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) ai_analysis_usage
CREATE TABLE IF NOT EXISTS public.ai_analysis_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id uuid REFERENCES public.listings(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_analysis_usage_user_created
  ON public.ai_analysis_usage (user_id, created_at DESC);
GRANT SELECT, INSERT ON public.ai_analysis_usage TO authenticated;
GRANT ALL ON public.ai_analysis_usage TO service_role;
ALTER TABLE public.ai_analysis_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own ai usage"
  ON public.ai_analysis_usage FOR SELECT
  USING (auth.uid() = user_id);
-- inserts happen via service_role from server fn; no insert policy for authenticated
