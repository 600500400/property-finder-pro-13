
CREATE TABLE public.listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  external_id text NOT NULL,
  title text,
  price integer,
  deal_type text,
  property_type text,
  kraj text,
  city text,
  area_m2 numeric,
  price_per_m2 integer GENERATED ALWAYS AS (
    CASE WHEN area_m2 IS NOT NULL AND area_m2 > 0 AND price IS NOT NULL
         THEN (price / area_m2)::int ELSE NULL END
  ) STORED,
  ownership text,
  ownership_confidence text,
  url text NOT NULL,
  image_url text,
  description_snippet text,
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT listings_source_external_uq UNIQUE (source, external_id)
);
CREATE INDEX listings_source_deal_prop_idx ON public.listings (source, deal_type, property_type);
CREATE INDEX listings_active_idx ON public.listings (is_active) WHERE is_active = true;
CREATE INDEX listings_last_seen_idx ON public.listings (last_seen_at);
CREATE INDEX listings_kraj_idx ON public.listings (kraj);

GRANT SELECT ON public.listings TO authenticated;
GRANT ALL ON public.listings TO service_role;

ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY listings_read_authenticated ON public.listings
  FOR SELECT TO authenticated USING (true);


CREATE TABLE public.scrape_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  deal_type text,
  property_type text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  items_found integer NOT NULL DEFAULT 0,
  items_new integer NOT NULL DEFAULT 0,
  items_updated integer NOT NULL DEFAULT 0,
  items_deactivated integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'running',
  error_message text,
  duration_ms integer
);
CREATE INDEX scrape_runs_source_idx ON public.scrape_runs (source, started_at DESC);
CREATE INDEX scrape_runs_status_idx ON public.scrape_runs (status);

GRANT SELECT ON public.scrape_runs TO authenticated;
GRANT ALL ON public.scrape_runs TO service_role;

ALTER TABLE public.scrape_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY scrape_runs_read_authenticated ON public.scrape_runs
  FOR SELECT TO authenticated USING (true);
