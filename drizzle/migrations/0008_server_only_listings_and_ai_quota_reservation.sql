-- Browser nesmí číst listings přímo. Hledání i scannery používají serverovou service role.
REVOKE ALL PRIVILEGES ON TABLE public.listings FROM PUBLIC, anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.listings TO service_role;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS listings_read_authenticated ON public.listings;
DROP POLICY IF EXISTS listings_server_only ON public.listings;
CREATE POLICY listings_server_only ON public.listings AS RESTRICTIVE
  FOR SELECT TO anon, authenticated
  USING (false);

-- Jen serverová funkce smí zapisovat spotřebu AI.
REVOKE INSERT, UPDATE, DELETE ON public.ai_analysis_usage FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.reserve_ai_analysis(
  _user_id uuid,
  _listing_id uuid
)
RETURNS TABLE(
  allowed boolean,
  used bigint,
  quota_limit integer,
  reservation_id uuid
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_premium boolean;
  v_used bigint;
  v_limit integer;
  v_now timestamptz;
  v_month_start timestamptz;
  v_id uuid;
BEGIN
  IF _user_id IS NULL OR _listing_id IS NULL THEN
    RAISE EXCEPTION 'User and listing IDs are required';
  END IF;

  -- Sériově vyhodnotí kvótu pro jednoho uživatele a zabrání race condition.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(_user_id::text, 15092026)
  );

  v_now := pg_catalog.clock_timestamp();
  v_month_start := pg_catalog.date_trunc(
    'month',
    v_now AT TIME ZONE 'UTC'
  ) AT TIME ZONE 'UTC';

  IF NOT EXISTS (
    SELECT 1
    FROM public.listings
    WHERE id = _listing_id
      AND is_active
  ) THEN
    RAISE EXCEPTION 'Listing is unavailable';
  END IF;

  v_premium := public.is_premium(_user_id);
  v_limit := CASE WHEN v_premium IS TRUE THEN 50 ELSE 1 END;

  SELECT count(*)
  INTO v_used
  FROM public.ai_analysis_usage
  WHERE user_id = _user_id
    AND (
      v_premium IS NOT TRUE
      OR created_at >= v_month_start
    );

  IF v_used >= v_limit THEN
    RETURN QUERY SELECT false, v_used, v_limit, NULL::uuid;
    RETURN;
  END IF;

  -- Rezervace se zapisuje před AI voláním.
  INSERT INTO public.ai_analysis_usage(user_id, listing_id, created_at)
  VALUES (_user_id, _listing_id, v_now)
  RETURNING id INTO v_id;

  RETURN QUERY SELECT true, v_used + 1, v_limit, v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_ai_analysis(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_ai_analysis(uuid, uuid)
  TO service_role;
COMMENT ON FUNCTION public.reserve_ai_analysis(uuid, uuid) IS
  'Server-only atomic quota reservation; counts attempted calls including uncertain provider failures.';