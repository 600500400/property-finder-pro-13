ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS house_subtype text;

CREATE INDEX IF NOT EXISTS listings_house_subtype_idx ON public.listings (house_subtype);
CREATE INDEX IF NOT EXISTS listings_land_area_idx ON public.listings (land_area_m2);

-- Backfill plot size for houses from title/description text (Bazoš, iDnes).
UPDATE public.listings l
SET land_area_m2 = sub.n
FROM (
  SELECT id,
         NULLIF(regexp_replace(
           substring(
             coalesce(title, '') || ' ' || coalesce(description_snippet, '')
             from '(?i)pozem[a-zěáíéuy]*[^0-9]{0,18}([0-9][0-9 .,\u00a0]{1,9})\s*m\s*[2²]'
           ), '[^0-9]', '', 'g'), '')::numeric AS n
  FROM public.listings
  WHERE property_type = 'domy' AND land_area_m2 IS NULL
) sub
WHERE l.id = sub.id AND sub.n IS NOT NULL AND sub.n >= 30 AND sub.n <= 200000;

-- Backfill internal house subtype from title/description keywords.
UPDATE public.listings
SET house_subtype = CASE
  WHEN t ~ 'usedlost|statek' THEN 'usedlost'
  WHEN t ~ 'chat|chalup|rekreacni objekt|srub' THEN 'chalupa_chata'
  WHEN t ~ 'vil' THEN 'vila'
  WHEN t ~ 'radov|dvojdom' THEN 'dvojdomek_radovka'
  WHEN t ~ 'rodinn|domek|dum|domu' THEN 'rodinny_dum'
  ELSE 'jine'
END
FROM (
  SELECT id AS lid,
         lower(translate(coalesce(title,'') || ' ' || coalesce(description_snippet,''),
           'áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ', 'acdeeinorstuuyzACDEEINORSTUUYZ')) AS t
  FROM public.listings
  WHERE property_type = 'domy'
) s
WHERE public.listings.id = s.lid AND public.listings.property_type = 'domy';
