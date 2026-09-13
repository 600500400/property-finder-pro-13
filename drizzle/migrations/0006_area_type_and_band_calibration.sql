ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS area_type text;

CREATE TABLE IF NOT EXISTS public.csu_house_calibration_band (
  size_band text PRIMARY KEY,
  median_ratio numeric NOT NULL,
  factor numeric NOT NULL,
  typical_area_m2 numeric,
  sample_count integer NOT NULL DEFAULT 0,
  computed_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.csu_house_calibration_band TO anon;
GRANT SELECT ON public.csu_house_calibration_band TO authenticated;
GRANT ALL ON public.csu_house_calibration_band TO service_role;

ALTER TABLE public.csu_house_calibration_band ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public band calibration read" ON public.csu_house_calibration_band
  FOR SELECT TO anon, authenticated USING (true);
