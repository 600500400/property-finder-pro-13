
-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_self_read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email) VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- saved_filters
CREATE TABLE public.saved_filters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  filters JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX saved_filters_user_idx ON public.saved_filters(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_filters TO authenticated;
GRANT ALL ON public.saved_filters TO service_role;
ALTER TABLE public.saved_filters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "saved_filters_owner" ON public.saved_filters FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- scheduled_scans
CREATE TABLE public.scheduled_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  saved_filter_id UUID REFERENCES public.saved_filters(id) ON DELETE CASCADE,
  filters JSONB NOT NULL,
  email TEXT NOT NULL,
  frequency_per_day INT NOT NULL DEFAULT 1 CHECK (frequency_per_day BETWEEN 1 AND 6),
  max_per_email INT NOT NULL DEFAULT 20,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX scheduled_scans_user_idx ON public.scheduled_scans(user_id);
CREATE INDEX scheduled_scans_run_idx ON public.scheduled_scans(enabled, last_run_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_scans TO authenticated;
GRANT ALL ON public.scheduled_scans TO service_role;
ALTER TABLE public.scheduled_scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scheduled_scans_owner" ON public.scheduled_scans FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- scan_results
CREATE TABLE public.scan_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_scan_id UUID NOT NULL REFERENCES public.scheduled_scans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  count INT NOT NULL,
  results JSONB NOT NULL,
  meta JSONB,
  emailed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX scan_results_user_idx ON public.scan_results(user_id, created_at DESC);
GRANT SELECT ON public.scan_results TO authenticated;
GRANT ALL ON public.scan_results TO service_role;
ALTER TABLE public.scan_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scan_results_owner_read" ON public.scan_results FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- ai_analyses (globální cache, klíč = SHA256 z url+price)
CREATE TABLE public.ai_analyses (
  url_hash TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  payload JSONB NOT NULL,
  model TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ai_analyses_created_idx ON public.ai_analyses(created_at DESC);
GRANT SELECT ON public.ai_analyses TO authenticated;
GRANT ALL ON public.ai_analyses TO service_role;
ALTER TABLE public.ai_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_analyses_read_authenticated" ON public.ai_analyses FOR SELECT TO authenticated USING (true);
