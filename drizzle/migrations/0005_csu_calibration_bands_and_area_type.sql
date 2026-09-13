-- Per-size-band ČSÚ calibration (replaces the single global ratio; the old singleton row stays until code migrates off it)
CREATE TABLE IF NOT EXISTS public.csu_house_calibration_bands (
  size_band text PRIMARY KEY,
  median_ratio numeric NOT NULL,
  factor numeric NOT NULL,
  typical_area_m2 numeric,
  sample_count integer NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.csu_house_calibration_bands TO anon;
GRANT SELECT ON public.csu_house_calibration_bands TO authenticated;
GRANT ALL ON public.csu_house_calibration_bands TO service_role;

ALTER TABLE public.csu_house_calibration_bands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public CSU band calibration read"
  ON public.csu_house_calibration_bands FOR SELECT
  TO anon, authenticated
  USING (true);

-- Which area label the scraped floor area came with: uzitna | obytna | zastavena | unlabelled
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS area_type text;