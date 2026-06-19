
CREATE TABLE public.saved_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_url text NOT NULL,
  source text,
  name text,
  locality text,
  price bigint,
  area_m2 numeric,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, listing_url)
);
GRANT SELECT, INSERT, DELETE ON public.saved_listings TO authenticated;
GRANT ALL ON public.saved_listings TO service_role;
ALTER TABLE public.saved_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_saved_listings_select" ON public.saved_listings FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own_saved_listings_insert" ON public.saved_listings FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own_saved_listings_delete" ON public.saved_listings FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX saved_listings_user_idx ON public.saved_listings(user_id, created_at DESC);
