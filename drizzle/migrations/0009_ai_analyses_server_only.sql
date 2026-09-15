-- AI cache is server-only: browser roles must never read shared AI payloads.
DROP POLICY IF EXISTS "ai_analyses_read_authenticated" ON public.ai_analyses;
REVOKE ALL PRIVILEGES ON TABLE public.ai_analyses FROM PUBLIC, anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.ai_analyses TO service_role;
ALTER TABLE public.ai_analyses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ai_analyses_server_only ON public.ai_analyses;
CREATE POLICY ai_analyses_server_only ON public.ai_analyses
  AS RESTRICTIVE FOR SELECT TO anon, authenticated USING (false);