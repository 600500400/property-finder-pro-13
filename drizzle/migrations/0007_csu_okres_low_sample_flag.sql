ALTER TABLE public.csu_house_prices_okres
  ADD COLUMN IF NOT EXISTS low_sample boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.csu_house_prices_okres.low_sample IS
  'Source cell was footnote-marked "1) Malý počet údajů k dispozici" - low number of observations.';